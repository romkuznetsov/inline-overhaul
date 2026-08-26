"use strict";
/**
 * Хук PostToolUse: прототип изменился — сразу перегенерировать схему и
 * прогнать быстрые проверки.
 *
 * Прототип нормативен (PRD Р8): из него выводятся схема настроек, раздел 9 и
 * Приложение B. Дважды за одну сессию я забывал перегенерировать, и оба раза
 * это ловилось позже вручную. Хук закрывает разрыв.
 *
 * Здесь только быстрые проверки: генерация схемы, гейты схемы и текстов,
 * поиск нулевых байтов. Полный набор — `npm run gate:prototype`, он в CI.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const PROTO = "docs/prototype/settings_prototype.html";

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

function report(lines) {
  /* Синхронно: process.exit сразу после записи в канал теряет вывод. */
  fs.writeSync(1, JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: lines.join("\n"),
    },
  }));
  process.exit(0);
}

function run(label, file, args) {
  const r = spawnSync(process.execPath, [path.join(ROOT, file), ...args],
    { cwd: ROOT, encoding: "utf8", timeout: 90000 });
  if (r.status === 0) return "  ok   " + label;
  const tail = ((r.stdout || "") + (r.stderr || "")).trim().split("\n").slice(-6).join("\n         ");
  return "  FAIL " + label + "\n         " + tail;
}

/** Нулевой байт делает исходник двоичным: в ревью он становится невидим. */
function nulScan() {
  const exts = [".ts", ".js", ".mjs", ".json", ".md", ".css", ".html"];
  const skip = ["node_modules", ".git", "dist"];
  const dirty = [];
  const walk = dir => {
    for (const name of fs.readdirSync(dir)) {
      if (skip.includes(name)) continue;
      const full = path.join(dir, name);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) { walk(full); continue; }
      if (!exts.some(e => name.endsWith(e))) continue;
      if (fs.readFileSync(full).includes(0)) dirty.push(path.relative(ROOT, full));
    }
  };
  walk(ROOT);
  return dirty.length
    ? "  FAIL нулевые байты в исходниках: " + dirty.join(", ")
    : "  ok   нулевых байтов нет";
}

let raw = "";
process.stdin.on("data", chunk => { raw += chunk; });
process.stdin.on("end", () => {
  let input = {};
  try { input = JSON.parse(raw || "{}"); } catch { process.exit(0); }

  const filePath = (input.tool_input && input.tool_input.file_path)
    || (input.tool_response && input.tool_response.filePath);
  if (!filePath) process.exit(0);

  const rel = path.relative(ROOT, path.resolve(normalize(filePath))).split(path.sep).join("/");
  if (rel !== PROTO) process.exit(0);

  const lines = ["прототип изменился, быстрые проверки:"];
  lines.push(run("схема перегенерирована из прототипа", "build/gen_schema.js", []));
  lines.push(run("гейты схемы и текстов", "tests/prototype/gates.js", [path.join(ROOT, PROTO)]));
  lines.push(nulScan());
  lines.push("не забудьте: python tests/prototype/update_prd.py (раздел 9 и Приложение B)");
  report(lines);
});
