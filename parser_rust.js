const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");

puppeteer.use(StealthPlugin());

const CATEGORIES = [
    { name: "Rust", url: "https://lis-skins.com/ru/market/rust/?page=", pages: 57 },
];

const OUTPUT_FOLDER = "images";
const OUTPUT_FILE = "items.json";

if (!fs.existsSync(OUTPUT_FOLDER)) {
    fs.mkdirSync(OUTPUT_FOLDER);
}

// ✅ Функция загрузки изображения из локального кэша браузера
async function downloadImage(page, imageUrl, category, pageNumber, index) {
    try {
        const imageName = `page${pageNumber}_${category}_item${index + 1}.png`;
        const imagePath = path.join(OUTPUT_FOLDER, imageName);

        // 📥 Загружаем изображение из локального кэша браузера
        const response = await page.goto(imageUrl, { timeout: 30000 });
        const buffer = await response.buffer();
        fs.writeFileSync(imagePath, buffer);

        return imageName;
    } catch (error) {
        console.error(`❌ Ошибка загрузки изображения ${imageUrl}: ${error.message}`);
        return null;
    }
}

// ✅ Функция парсинга страницы категории
async function scrapePage(category, pageNumber, browser) {
    const url = `${category.url}${pageNumber}`;
    console.log(`🔄 Открываем страницу: ${url}`);

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
    });

    try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

        const items = await page.evaluate(() => {
            return Array.from(document.querySelectorAll(".item.market_item")).map((item) => {
                const nameElement = item.querySelector(".name-inner");
                const priceElement = item.querySelector(".price");
                const imgElement = item.querySelector("img.image");
                const linkElement = item.getAttribute("data-link");

                return {
                    name: nameElement ? nameElement.innerText.trim() : "Нет названия",
                    price: priceElement ? priceElement.innerText.trim().replace("€", "").trim() : "Нет цены",
                    imageUrl: imgElement ? imgElement.src : null,
                    link: linkElement || null
                };
            });
        });

        console.log(`✅ Найдено ${items.length} товаров на странице ${pageNumber} категории ${category.name}`);

        let validItems = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (!item.link || !item.imageUrl) continue; // ❌ Пропускаем товары без ссылки или изображения

            // ✅ Скачиваем изображение из локального кэша браузера
            const imageName = await downloadImage(page, item.imageUrl, category.name, pageNumber, i);
            if (!imageName) continue; // ❌ Пропускаем, если не удалось скачать

            item.category = category.name;
            item.image = imageName;

            validItems.push(item);
        }

        return validItems;
    } catch (error) {
        console.error(`❌ Ошибка при парсинге страницы ${pageNumber} категории ${category.name}: ${error.message}`);
        return [];
    } finally {
        await page.close();
    }
}

// ✅ Функция парсинга ВСЕХ страниц категории
async function scrapeCategory(category, browser) {
    let categoryItems = [];

    for (let i = 1; i <= category.pages; i++) {
        const items = await scrapePage(category, i, browser);
        categoryItems = categoryItems.concat(items);
    }

    return categoryItems;
}

// 🚀 Запуск парсера
(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled"
        ]
    });

    let allItems = [];

    for (const category of CATEGORIES) {
        console.log(`🚀 Начинаем парсинг категории: ${category.name}`);
        const items = await scrapeCategory(category, browser);
        allItems = allItems.concat(items);
    }

    await browser.close();

    // ✅ Сохраняем JSON
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allItems, null, 2));
    console.log("🚀 Парсинг завершен! Данные сохранены в items.json");
})();
