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
    match: rel => rel.startsWith("dist/"),
    why: "это результат сборки",
    instead: "правьте исходники, затем npm run build",
  },
  {
    match: rel => rel === "tests/prototype/v1_inventory.tsv",
    why: "это замороженная опись настроек версии 1: она фиксирует прошлое",
    instead: "если сверка расходится, решение записывается в раздел 9 PRD, а не в данные",
  },
];

const PRD = "docs/PRD_Settings_Overhaul_v1.md";
const APPENDIX = "## Приложение B. Опись целевого состояния";

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

  /* PRD: раздел 9 и Приложение B выводятся из прототипа, остальное - руками. */
  if (rel === PRD) {
    if (tool === "Write") {
      deny("PRD целиком не перезаписывается: раздел 9 и Приложение B генерируются " +
        "(python tests/prototype/update_prd.py). Правьте нужный раздел через Edit.");
    }
    const old = typeof args.old_string === "string" ? args.old_string : "";
    if (old) {
      let text = "";
      try { text = fs.readFileSync(path.join(ROOT, PRD), "utf8"); } catch { process.exit(0); }
      const appendixAt = text.indexOf(APPENDIX);
      const hit = text.indexOf(old);
      if (appendixAt >= 0 && hit >= 0 && hit > appendixAt) {
        deny("этот текст лежит в Приложении B, а оно генерируется из прототипа. " +
          "Правьте docs/prototype/settings_prototype.html, затем python tests/prototype/update_prd.py.");
      }
    }
  }

  process.exit(0);
});
