"use strict";

/**
 * Стенд «какой цвет панель предложит, когда цвет не задан».
 *
 *     node tools/theme_color_probe.js
 *     node tools/theme_color_probe.js --theme "<путь к theme.css>"
 *
 * **Зачем он есть.** Его замечание 2026-09-22: «при нажатии на „восстановить
 * значение по умолчанию“ получаю #000000 (а не дефолтный цвет темы) у
 * link-target-color, link-brackets-color, scroller-fill». У последнего
 * переменная темы была с самого начала — значит дело не в карте переменных.
 *
 * **Что здесь настоящее.** `app.css` из `obsidian-<версия>.asar` этой машины и
 * `theme.css` темы из его vault. Список путей и переменных берётся у продукта
 * (`THEME_COLOR_VARS`), а не переписывается здесь: вторая копия разошлась бы с
 * первой молча (У-32).
 *
 * **Что сравнивается.** Три величины на каждую переменную:
 *
 *   * `raw` — то, что отдаёт `getPropertyValue`, то есть **текст темы**;
 *   * `solved` — то же через настоящий узел, то есть цвет, посчитанный
 *     браузером;
 *   * `hex` — то, что из этого делает наш `toHexColor`, и ровно это Obsidian
 *     ставит кнопке «восстановить значение по умолчанию».
 *
 * Пустой `hex` значит чёрное поле у человека.
 *
 * **Контроль стоит до первого вывода** (правило 44): хотя бы у одной
 * переменной `raw` обязан быть в форме, которой наш разбор не понимает, —
 * иначе страница отвечала бы «всё хорошо» от того, что проверять нечего. На
 * его теме таких семь из восьми.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VAULT = path.join(ROOT, "..", "test-vault");

function requirePlaywright() {
  try {
    return require("playwright");
  } catch (_e) {
    console.error("браузера в наборе нет. Поставьте его двумя командами:");
    console.error("  npm i -D playwright");
    console.error("  npx playwright install chromium");
    process.exit(2);
  }
  return null;
}

/** `app.css` из архива сборки Obsidian этой машины. */
function appCss() {
  const dir = path.join(process.env.APPDATA || "", "obsidian");
  const names = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter(n => /^obsidian-.*\.asar$/.test(n)).sort()
    : [];
  if (!names.length) {
    console.error("не нашёл obsidian-<версия>.asar рядом с настройками Obsidian");
    process.exit(2);
  }
  const buf = fs.readFileSync(path.join(dir, names[names.length - 1]));
  const header = JSON.parse(buf.slice(16, 16 + buf.readUInt32LE(12)).toString("utf8"));
  const base = 8 + buf.readUInt32LE(4);
  let found = null;
  (function walk(node) {
    for (const [name, entry] of Object.entries(node.files || {})) {
      if (entry.files) { walk(entry); continue; }
      if (name === "app.css" && !found) {
        const off = base + Number(entry.offset);
        found = buf.slice(off, off + entry.size).toString("utf8");
      }
    }
  })(header);
  if (!found) throw new Error("в архиве нет app.css");
  return found;
}

/** Тема из его vault, если её не назвали ключом. */
function themeCss(argv) {
  const at = argv.indexOf("--theme");
  if (at >= 0 && argv[at + 1]) return fs.readFileSync(argv[at + 1], "utf8");
  const dir = path.join(VAULT, ".obsidian", "themes");
  if (!fs.existsSync(dir)) return "";
  const names = fs.readdirSync(dir);
  for (const n of names) {
    const file = path.join(dir, n, "theme.css");
    if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  }
  return "";
}

/**
 * Карта настроек и переменных — у продукта. Файл на TypeScript, поэтому
 * читается текстом: тянуть сюда загрузчик типов ради одного объекта дороже,
 * чем разобрать пары, а расхождение с продуктом ловит контроль ниже — пустой
 * список роняет стенд.
 */
function themeVars() {
  const src = fs.readFileSync(path.join(ROOT, "src", "ui", "settings", "custom", "theme_colors.ts"), "utf8");
  const at = src.indexOf("THEME_COLOR_VARS");
  const open = src.indexOf("{", at);
  const close = src.indexOf("\n};", open);
  const body = src.slice(open, close);
  const out = [];
  for (const m of body.matchAll(/"([^"]+)"\s*:\s*"(--[^"]+)"/g)) out.push({ path: m[1], variable: m[2] });
  return out;
}

async function main() {
  const pairs = themeVars();
  if (pairs.length < 5) {
    console.error("карта цветов темы прочиталась пустой или почти пустой: " + pairs.length);
    process.exit(1);
  }
  const theme = themeCss(process.argv.slice(2));
  if (!theme) {
    console.error("темы рядом с vault нет — стенд мерил бы одну Obsidian");
    process.exit(2);
  }

  const { chromium } = requirePlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let rows;
  try {
    await page.setContent('<body class="theme-light mod-windows"></body>');
    await page.addStyleTag({ content: appCss() });
    await page.addStyleTag({ content: theme });
    rows = await page.evaluate((list) => {
      const body = getComputedStyle(document.body);
      const probe = document.createElement("span");
      probe.style.display = "none";
      document.body.appendChild(probe);
      return list.map((p) => {
        const raw = body.getPropertyValue(p.variable).trim().replace(/\s+/g, " ");
        probe.style.color = "";
        probe.style.color = "var(" + p.variable + ")";
        const solved = getComputedStyle(probe).color.trim();
        return { path: p.path, variable: p.variable, raw, solved };
      });
    }, pairs);
  } finally {
    await browser.close();
  }

  /* Наш разбор цвета — тот же, что в панели. */
  const hexOf = (color) => {
    const src = String(color || "").trim().toLowerCase();
    const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(src);
    if (m) {
      const byte = (x) => {
        const n = Math.round(Math.min(255, Math.max(0, Number(x))));
        return (n < 16 ? "0" : "") + n.toString(16);
      };
      return "#" + byte(m[1]) + byte(m[2]) + byte(m[3]);
    }
    const v = src.replace(/^#/, "");
    return /^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(v) ? "#" + v : "";
  };

  /* Контроль до первого вывода: текст темы обязан быть не только в тех формах,
     которые наш разбор понимает, — иначе стенду нечего ловить. */
  const unreadableRaw = rows.filter(r => !hexOf(r.raw));
  if (!unreadableRaw.length) {
    console.error("контроль не прошёл: все переменные темы уже в понятной форме —");
    console.error("на такой теме стенд ответил бы «всё хорошо», ничего не проверив");
    process.exit(1);
  }

  let bad = 0;
  for (const r of rows) {
    const hex = hexOf(r.solved);
    if (!hex) bad++;
    console.log((hex || "ПУСТО ").padEnd(9)
      + r.variable.padEnd(24)
      + " " + r.path.padEnd(46)
      + " текстом темы: " + JSON.stringify(r.raw));
  }
  console.log("");
  console.log("переменных " + rows.length
    + "; текстом темы наш разбор не понимает " + unreadableRaw.length
    + "; через узел не разобралось " + bad);
  if (bad) {
    console.error("у этих настроек поле цвета покажет человеку чёрное");
    process.exit(1);
  }
  console.log("каждая переменная доезжает до поля цвета настоящим цветом");
}

main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
