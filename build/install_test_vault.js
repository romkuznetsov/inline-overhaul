"use strict";
/**
 * Разложить свежую сборку в тестовый vault.
 *
 *     npm run install:test
 *
 * Vault лежит рядом с репозиторием, а не внутри: он не должен попадать в
 * git и не должен путаться с настройками рабочего vault заказчика.
 *
 * Скрипт идемпотентен: заметки перезаписываются только если их нет, а
 * плагин и его манифест обновляются всегда. Настройки плагина (data.json)
 * не трогаются — иначе каждая переустановка стирала бы то, что вы только
 * что накрутили в панели.
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const vault = path.resolve(root, "..", "test-vault");
const pluginDir = path.join(vault, ".obsidian", "plugins", "inline-overhaul");

if (!fs.existsSync(path.join(dist, "main.js"))) {
  console.error("нет сборки: сначала npm run build");
  process.exit(1);
}

fs.mkdirSync(pluginDir, { recursive: true });

/* плагин обновляем всегда */
for (const name of ["main.js", "manifest.json", "styles.css"]) {
  const from = path.join(dist, name);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(pluginDir, name));
}

/* включаем плагин, если ещё не включён */
const listFile = path.join(vault, ".obsidian", "community-plugins.json");
let enabled = [];
try { enabled = JSON.parse(fs.readFileSync(listFile, "utf8")); } catch { enabled = []; }
if (!Array.isArray(enabled)) enabled = [];
if (!enabled.includes("inline-overhaul")) {
  enabled.push("inline-overhaul");
  fs.writeFileSync(listFile, JSON.stringify(enabled, null, 2) + "\n", "utf8");
}

/* заметки создаём один раз: вы могли что-то в них написать */
const NOTES = {
  "Проверка панели.md": [
    "Плагин уже включён в этом vault. Откройте настройки Obsidian и найдите",
    "**Inline Overhaul** в списке плагинов слева.",
    "",
    "## Что проверяем",
    "",
    "### 1. Отмена после протяжки слайдера",
    "",
    "Вкладка `Keyboard`, группа `Expanded select all`. Включите верхний тумблер,",
    "затем протяните слайдер `Time between presses` из края в край.",
    "",
    "Теперь вызовите из палитры команд отмену изменения настроек.",
    "",
    "- Ожидается: откатывается **весь жест**, значение возвращается к тому, что было до протяжки.",
    "- Плохо: откат на один шаг слайдера, и приходится жать отмену много раз.",
    "",
    "### 2. Поиск по старому имени",
    "",
    "В поиске настроек Obsidian наберите `Enhanced Mod+A`.",
    "",
    "- Ожидается: находится настройка `Expanded select all`. Так проверяется, что",
    "  старые имена попадают в поиск через поле `aliases`.",
    "- Заодно попробуйте `Multi-press delay` — это старое имя слайдера.",
    "",
    "### 3. Скрытая настройка и поиск",
    "",
    "В той же группе выключите `Count presses by timer`.",
    "",
    "- Ожидается: строка `Time between presses` исчезает из панели.",
    "- Вопрос, на который нужен ответ: находит ли её поиск, **пока она скрыта**?",
    "  Наберите `Time between presses` и посмотрите.",
    "",
    "### 4. Общий взгляд",
    "",
    "Пройдитесь по семи вкладкам. Ожидается 20 групп и 87 настроек, тексты — те,",
    "что вы согласовали в прототипе. Подсказки открываются по `?`, если включён",
    "`Show tips` в группе `Help`.",
    "",
    "## Чего пока не будет",
    "",
    "- **Настройки не влияют на поведение.** Панель пишет новые пути конфига",
    "  (`editor.selectAll.*`), а движок ещё читает старые. Это делает фаза 2,",
    "  миграция конфига. Сейчас проверяется панель, а не поведение.",
    "- **Нет своих блоков**: Fields, Binder, справочник команд, Smart Rules,",
    "  свойства заметки, вводные коллауты. Они переезжают в фазе 3.",
    "- **Нет кнопок** вроде `Open the guide` — им нужны действия из реестра (фаза 5).",
    "",
    "## Если панель пустая или с текстом про 1.13",
    "",
    "Значит Obsidian не поддерживает декларативные настройки, и версию нужно обновить.",
    "Сообщите — откатим `minAppVersion` и вернём свой рендерер.",
  ].join("\n"),

  "Демо строки.md": [
    "Строки в формате плагина — чтобы было на чём смотреть навигацию и теги.",
    "",
    "- #in_progress #high || Написать план на неделю || 📅 2026-08-25 [[Проект А]]",
    "- #todo || Позвонить в банк || 📅 2026-08-26",
    "\t- #todo #low || Собрать документы",
    "\t- #done || Уточнить тариф",
    "- #early || Разобрать входящие",
    "",
    "## Заголовок для проверки переходов",
    "",
    "- [ ] Обычная задача без тегов",
    "- [x] Сделанная задача",
    "",
    "Команды плагина ищите в палитре по слову `Inline`. Хоткеев по умолчанию нет —",
    "это осознанное решение, назначьте свои в настройках Obsidian.",
  ].join("\n"),
};

let created = 0;
for (const [name, text] of Object.entries(NOTES)) {
  const file = path.join(vault, name);
  if (fs.existsSync(file)) continue;
  fs.writeFileSync(file, text + "\n", "utf8");
  created++;
}

console.log("vault: " + vault);
console.log("плагин обновлён, заметок создано: " + created +
  (created ? "" : " (уже были на месте)"));
console.log("откройте эту папку в Obsidian: Open folder as vault");
