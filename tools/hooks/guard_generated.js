"use strict";
/**
 * Хук PreToolUse: не даёт править сгенерированные файлы.
 *
 * В этом проекте схема настроек, Приложение B PRD и сборка выводятся из
 * согласованного прототипа. Правка руками не переживает следующую генерацию:
 * `npm run gen:schema` перепишет файл, и работа потеряется молча. Гейты это
 * ловят, но уже после того, как труд вложен, — хук ловит на входе.
 *
 * Читает JSON хука со stdin, отвечает JSON'ом на stdout.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

/** Что запрещено и что делать вместо этого. */
const RULES = [
  {
    match: rel => rel.startsWith("src/ui/settings/schema/"),
    why: "схема настроек генерируется из прототипа",
    instead: "правьте docs/prototype/settings_prototype.html, затем npm run gen:schema",
  },
  {
    match: rel => rel === "src/ui/settings/custom/pick_data.ts",
    why: "знаки выбиралки генерируются из данных Unicode",
    instead: "правьте tools/build/gen_pick_data.js, затем node tools/build/gen_pick_data.js",
  },
  {
    match: rel => rel.startsWith("dist/"),
    why: "это результат сборки",
    instead: "правьте исходники, затем npm run build",
  },
  {
    /* Приложение B PRD своим файлом с 2026-09-25 (PRD разделён). */
    match: rel => rel === "docs/dev/prd/PRD_B_INVENTORY.md",
    why: "Приложение B PRD — опись, сгенерированная из прототипа",
    instead: "правьте docs/prototype/settings_prototype.html, затем python tests/prototype/update_prd.py",
  },
  {
    match: rel => rel === "tests/prototype/v1_inventory.tsv",
    why: "это замороженная опись настроек версии 1: она фиксирует прошлое",
    instead: "если сверка расходится, решение записывается в раздел 9 PRD, а не в данные",
  },
];

const PRD = "docs/dev/PRD_Settings_Overhaul_v1.md";

/**
 * Путь может прийти как C:\..., так и в стиле Git Bash (/c/...). Второй
 * вариант path.resolve на Windows уводит на несуществующий диск, проверка
 * молча пропускает файл — а молчаливый пропуск в защитном хуке хуже, чем
 * его отсутствие.
 */
function normalize(p) {
  const s = String(p || "");
  const m = /^\/([a-zA-Z])\/(.*)$/.exec(s);
  return m ? m[1].toUpperCase() + ":/" + m[2] : s;
}

function deny(reason) {
  /* Синхронно: process.exit сразу после асинхронной записи в канал теряет вывод. */
  fs.writeSync(1, JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

function relative(filePath) {
  if (!filePath) return null;
  const abs = path.resolve(normalize(filePath));
  const rel = path.relative(ROOT, abs).split(path.sep).join("/");
  return rel.startsWith("..") ? null : rel;
}

let raw = "";
process.stdin.on("data", chunk => { raw += chunk; });
process.stdin.on("end", () => {
  let input = {};
  try { input = JSON.parse(raw || "{}"); } catch { process.exit(0); }

  const tool = String(input.tool_name || "");
  const args = input.tool_input || {};
  const rel = relative(args.file_path);
  if (!rel) process.exit(0);

  for (const rule of RULES) {
    if (rule.match(rel)) {
      deny(rel + " не правится руками: " + rule.why + ". " + rule.instead + ".");
    }
  }

  /* PRD: раздел 9 выводится из прототипа, остальное - руками. Приложение B —
     своим файлом и стережётся списком выше. */
  if (rel === PRD) {
    if (tool === "Write") {
      deny("PRD целиком не перезаписывается: раздел 9 генерируется " +
        "(python tests/prototype/update_prd.py). Правьте нужный раздел через Edit.");
    }
  }

  process.exit(0);
});
