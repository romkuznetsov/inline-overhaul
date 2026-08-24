"use strict";
/**
 * Схема настроек генерируется из согласованного прототипа (PRD Р8, Г23).
 *
 *     node build/gen_schema.js
 *
 * Почему генерация, а не перепечатка: девяносто две настройки с описаниями и
 * подсказками — это несколько тысяч слов, согласованных заказчиком построчно.
 * Перепечатанные руками, они разойдутся с Приложением B на первой же правке,
 * и никакой гейт этого не поймает, кроме сравнения текстов. Генератор делает
 * расхождение невозможным: `npm run gen:schema` не должен менять ни байта.
 *
 * Преобразование — над исходным текстом, а не над вычисленным объектом:
 * предикаты `on()`, `not()`, `eq()` нужно сохранить как код, а не как
 * результат их вызова.
 *
 * Что в схему не попадает и почему:
 *   - `kind: "custom"` — своим блокам нужны рендереры, они появляются в фазе 3;
 *   - `kind: "buttons"` — кнопке нужно действие из реестра 5.6, а показывать
 *     кнопку, которая ничего не делает, запрещено (З8).
 * Пропущенное перечисляется в шапке каждого файла, чтобы о нём не забыли.
 */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const PROTO = path.join(root, "docs", "prototype", "settings_prototype.html");
const OUT_DIR = path.join(root, "src", "ui", "settings", "schema");

const TAB_FILE = {
  general: "general.ts",
  keyboard: "keyboard.ts",
  navigation: "navigation.ts",
  pkm: "pkm.ts",
  visual: "visual.ts",
  transform: "transform.ts",
  advanced: "advanced.ts",
};
const TAB_CONST = {
  general: "GENERAL_GROUPS",
  keyboard: "KEYBOARD_GROUPS",
  navigation: "NAVIGATION_GROUPS",
  pkm: "PKM_GROUPS",
  visual: "VISUAL_GROUPS",
  transform: "TRANSFORM_GROUPS",
  advanced: "ADVANCED_GROUPS",
};

/** Найти конец литерала, начинающегося с открывающей скобки в позиции i. */
function matchBrace(text, i) {
  const open = text[i];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = null;
  for (let k = i; k < text.length; k++) {
    const c = text[k];
    if (inStr) {
      if (c === "\\") { k++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "/" && text[k + 1] === "*") { k = text.indexOf("*/", k) + 1; continue; }
    if (c === "/" && text[k + 1] === "/") { k = text.indexOf("\n", k); continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return k; }
  }
  throw new Error("не нашёл закрывающую скобку с позиции " + i);
}

/** Верхнеуровневые литералы внутри массива. */
function splitLiterals(body) {
  const out = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== "{") continue;
    const end = matchBrace(body, i);
    out.push(body.slice(i, end + 1));
    i = end;
  }
  return out;
}

function field(literal, name) {
  const m = new RegExp(name + ':\\s*"([^"]*)"').exec(literal);
  return m ? m[1] : null;
}

const src = fs.readFileSync(PROTO, "utf8");
const start = src.indexOf("const SCHEMA = [");
const arrStart = src.indexOf("[", start);
const arrEnd = matchBrace(src, arrStart);
const body = src.slice(arrStart + 1, arrEnd);

const groups = splitLiterals(body);
const perTab = {};
const skipped = {};
let kept = 0, dropped = 0;

for (const g of groups) {
  const tab = field(g, "tab");
  const id = field(g, "id");
  if (!tab || !TAB_FILE[tab]) throw new Error("группа " + id + ": неизвестная вкладка " + tab);

  /* items внутри группы: убираем свои блоки и кнопки */
  const itemsAt = g.indexOf("items:");
  const arrAt = g.indexOf("[", itemsAt);
  const arrTo = matchBrace(g, arrAt);
  const itemsBody = g.slice(arrAt + 1, arrTo);
  const items = splitLiterals(itemsBody);

  const keep = [];
  const drop = [];
  for (const it of items) {
    const kind = field(it, "kind");
    if (kind === "custom" || kind === "buttons") {
      drop.push((field(it, "id") || "?") + " (" + kind + ")");
      dropped++;
      continue;
    }
    keep.push(it);
    kept++;
  }

  let out;
  if (keep.length) {
    out = g.slice(0, arrAt + 1) + "\n" + keep.map(s => "    " + s.replace(/\n\s{6}/g, "\n      ")).join(",\n") + "\n  " + g.slice(arrTo);
  } else {
    out = g.slice(0, arrAt + 1) + g.slice(arrTo);   // пустой items
  }
  (perTab[tab] = perTab[tab] || []).push({ id, order: Number(/order:\s*(\d+)/.exec(g)?.[1] || 0), text: out, empty: !keep.length });
  if (drop.length) (skipped[tab] = skipped[tab] || []).push({ id, drop });
}

let files = 0;
for (const tab of Object.keys(TAB_FILE)) {
  const list = (perTab[tab] || []).filter(g => !g.empty).sort((a, b) => a.order - b.order);
  if (!list.length) continue;

  const text = list.map(g => g.text).join(",\n");
  const helpers = ["on", "not", "eq"].filter(h => new RegExp("[^A-Za-z]" + h + "\\(").test(text));

  const skipNote = (skipped[tab] || [])
    .map(s => " *   " + s.id + ": " + s.drop.join(", "))
    .join("\n");

  const head = [
    "/**",
    " * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.",
    " * Руками не правится. Правится прототип, затем `npm run gen:schema`.",
    " *",
    " * Тексты согласованы заказчиком и совпадают с Приложением B PRD.",
    skipNote ? " * Не перенесено (свои блоки и кнопки без действий, З8):\n" + skipNote : null,
    " */",
    "",
    'import type { SettingsGroup } from "../types.ts";',
    helpers.length ? "import { " + helpers.join(", ") + ' } from "../types.ts";' : null,
    "",
    "export const " + TAB_CONST[tab] + ": readonly SettingsGroup[] = [",
    text,
    "];",
    "",
  ].filter(l => l !== null).join("\n");

  fs.writeFileSync(path.join(OUT_DIR, TAB_FILE[tab]), head, "utf8");
  files++;
}

/* index.ts тоже генерируется: список вкладок и сборка. */
const tabsWithGroups = Object.keys(TAB_FILE).filter(t => (perTab[t] || []).some(g => !g.empty));
const TAB_LABEL = {
  general: ["General", null],
  keyboard: ["Keyboard", null],
  navigation: ["Navigation", "features.navigation.enabled"],
  pkm: ["Tags & PKM", "features.pkm.enabled"],
  visual: ["Visual", "features.visual.enabled"],
  transform: ["Transform", "features.transform.enabled"],
  advanced: ["Advanced", null],
};

/* Одна фраза о содержимом области берётся из вводного коллаута прототипа:
   текст согласован, придумывать второй незачем. */
const callouts = {};
{
  const at = src.indexOf("const TAB_CALLOUTS = {");
  if (at >= 0) {
    const from = src.indexOf("{", at + 20);
    const body = src.slice(from, matchBrace(src, from) + 1);
    /* Ищем каждое head: "..." и отступаем назад к ближайшему ключу вкладки.
       Без регулярных выражений: строковые операции надёжнее в пересылке. */
    let i = 0;
    for (;;) {
      const h = body.indexOf("head: \"", i);
      if (h < 0) break;
      const q1 = body.indexOf("\"", h + 6);
      let q2 = q1 + 1;
      while (q2 < body.length && !(body[q2] === "\"" && body[q2 - 1] !== "\\")) q2++;
      const text = body.slice(q1 + 1, q2);

      const before = body.slice(0, h);
      const brace = before.lastIndexOf("{");
      const colon = before.lastIndexOf(":", brace);
      const lineStart = before.lastIndexOf("\n", colon) + 1;
      const key = before.slice(lineStart, colon).trim();
      if (key && TAB_FILE[key]) callouts[key] = text;
      i = q2 + 1;
    }
  }
}

/* Вкладка, которая показывается сразу: иначе первый экран панели — пустое
   оглавление. General для этого и предназначен: что включено и с чего начать. */
const FLAT_TAB = "general";
const index = [
  "/**",
  " * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.",
  " * Руками не правится. Правится прототип, затем `npm run gen:schema`.",
  " */",
  "",
  'import type { SettingsGroup, TabDef } from "../types.ts";',
  ...tabsWithGroups.map(t => 'import { ' + TAB_CONST[t] + ' } from "./' + TAB_FILE[t].replace(/\.ts$/, ".ts") + '";'),
  "",
  "export const TABS: readonly TabDef[] = [",
  ...Object.keys(TAB_LABEL).map(t => {
    const [label, mod] = TAB_LABEL[t];
    const bits = ['id: "' + t + '"', 'label: "' + label + '"'];
    if (mod) bits.push('module: "' + mod + '"');
    if (callouts[t]) bits.push('desc: "' + callouts[t].replace(/"/g, '\\"') + '"');
    if (t === FLAT_TAB) bits.push("flat: true");
    return "  { " + bits.join(", ") + " },";
  }),
  "];",
  "",
  "export const SCHEMA: readonly SettingsGroup[] = [",
  ...tabsWithGroups.map(t => "  ..." + TAB_CONST[t] + ","),
  "];",
  "",
  "/** Группы одной вкладки в порядке показа. */",
  "export function groupsFor(tab: string): readonly SettingsGroup[] {",
  "  return SCHEMA.filter(g => g.tab === tab).slice().sort((a, b) => a.order - b.order);",
  "}",
  "",
  "/** Вкладки, у которых есть хотя бы одна группа. Пустых страниц не рисуем. */",
  "export function activeTabs(): readonly TabDef[] {",
  "  return TABS.filter(t => SCHEMA.some(g => g.tab === t.id));",
  "}",
  "",
].join("\n");
fs.writeFileSync(path.join(OUT_DIR, "index.ts"), index, "utf8");

console.log("групп из прототипа: " + groups.length + ", файлов записано: " + (files + 1));
console.log("настроек перенесено: " + kept + ", пропущено своих блоков и кнопок: " + dropped);
