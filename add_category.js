const fs = require("fs");

const INPUT_FILE = "items_dota2_complete.json";
const OUTPUT_FILE = "items_dota2_complete"; // Перезаписываем тот же файл

// ✅ Загружаем JSON
let items = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));

// ✅ Добавляем поле "game": "cs:go", если его нет
items = items.map(item => ({
    ...item,
    game: item.game || "dota2"
}));

// ✅ Сохраняем изменения в файл
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(items, null, 2), "utf8");

console.log("✅ Поле 'game' успешно добавлено ко всем объектам в items_complete.json");
