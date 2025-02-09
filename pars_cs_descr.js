const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");

puppeteer.use(StealthPlugin());

const INPUT_FILE = "items.json";
const OUTPUT_FILE = "items_rust_complete.json";

// ✅ Загружаем JSON
let items = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
let completedItems = fs.existsSync(OUTPUT_FILE) ? JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8")) : [];

// ✅ Фильтруем уже обработанные товары
let completedLinks = new Set(completedItems.map(item => item.link));
items = items.filter(item => !completedLinks.has(item.link));

if (items.length === 0) {
    console.log("✅ Все товары уже обработаны! Завершение работы.");
    process.exit(0);
}

// ✅ Функция задержки (100-200 мс)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ✅ Функция сохранения прогресса
function saveProgress() {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(completedItems, null, 2), "utf8");
    fs.writeFileSync(INPUT_FILE, JSON.stringify(items, null, 2), "utf8");
    console.log("\n✅ Прогресс сохранен.");
}

// ✅ Обработчик `Ctrl + C` (SIGINT)
process.on("SIGINT", () => {
    console.log("\n🛑 Получен сигнал остановки (Ctrl + C). Сохраняем прогресс...");
    saveProgress();
    process.exit(0);
});

// ✅ Функция парсинга описания (с 2 попытками)
async function scrapeDescription(url, page) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            await delay(100 + Math.random() * 100);
            await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

            const descriptionData = await page.evaluate(() => {
                const wrapper = document.querySelector("#skin-description-wrapper .section-block.about-block");
                if (!wrapper) return null;

                const titleElement = wrapper.querySelector("h2.block-name");
                const iznosElement = wrapper.querySelector("span p:nth-child(1)");
                const textElement = wrapper.querySelector('[itemprop="description"]');

                return {
                    description_title: titleElement ? titleElement.innerText.trim() : "",
                    description_iznos: iznosElement ? iznosElement.innerText.trim() : "",
                    description_text: textElement ? textElement.innerText.trim() : ""
                };
            });

            return descriptionData || { description_title: "", description_iznos: "", description_text: "" };
        } catch (error) {
            console.error(`❌ Ошибка при парсинге ${url} (Попытка ${attempt}): ${error.message}`);
        }
    }

    console.error(`❌ Две неудачные попытки парсинга. Оставляем пустые поля.`);
    return { description_title: "", description_iznos: "", description_text: "" };
}

// 🚀 Запуск парсера
(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
            "--window-size=1280,800"
        ]
    });

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
    });

    for (const item of items) {
        console.log(`🔍 Парсим описание для: ${item.name}`);

        const description = await scrapeDescription(item.link, page);

        // ✅ Добавляем новые поля и УДАЛЯЕМ `link`
        const { link, ...newItem } = item;
        completedItems.push({
            ...newItem,
            description_title: description.description_title,
            description_iznos: description.description_iznos,
            description_text: description.description_text
        });

        // ✅ Удаляем обработанный товар из items.json
        items = items.filter(i => i.link !== link);

        // ✅ Сохраняем прогресс после каждого товара
        saveProgress();
    }

    await browser.close();
    console.log("🚀 Парсинг завершен! Данные сохранены в items_complete.json");
})();
