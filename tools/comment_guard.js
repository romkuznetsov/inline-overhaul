"use strict";

/**
 * Сокращение комментариев не меняет кода — его заказ 2026-10-03 («минификация
 * кода… но с умом»). Сравнивает поток лексем без комментариев у каждого файла
 * `src/**` между рабочей копией и ревизией `<ref>` (по умолчанию `HEAD`).
 *
 *   node tools/comment_guard.js [ref]           — сторож: код совпал до лексемы
 *   node tools/comment_guard.js [ref] --archive <файл.md>
 *                                               — полный текст комментариев `<ref>`
 *                                                 по файлам и функциям, в архив
 *
 * Код выхода 1 — у какого-то файла код разошёлся; такой файл назван.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const ts = require(path.join(root, "node_modules", "typescript"));

const args = process.argv.slice(2);
const at = args.indexOf("--archive");
const archive = at === -1 ? "" : args[at + 1];
const ref = args.find((a, i) => !a.startsWith("--") && i !== at + 1) || "HEAD";

const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
/* `schema/*` выводится из прототипа (`npm run gen:schema`), и сверяет его свой гейт. */
const files = git("ls-tree", "-r", "--name-only", ref, "src").split("\n")
  .filter((f) => /\.(js|ts)$/.test(f) && !f.startsWith("src/ui/settings/schema/"));

/** Лексемы без комментариев — листья дерева разбора: сканер подряд теряет место после `${…}`. */
function tokens(text) {
  const sf = ts.createSourceFile("x.ts", text, ts.ScriptTarget.Latest, true);
  const out = [];
  const walk = (n) => {
    /* JSDoc дерево держит детьми узла — это комментарий, а не код. */
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const kids = n.getChildren(sf);
    if (!kids.length) { if (n.kind !== ts.SyntaxKind.EndOfFileToken) out.push(n.getText(sf)); return; }
    kids.forEach(walk);
  };
  walk(sf);
  return out;
}

/** Комментарии с именем ближайшей функции, класса или переменной, в которой они стоят. */
function comments(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const out = [];
  const seen = new Set();
  const nameOf = (node) => {
    for (let n = node; n; n = n.parent) {
      if (n.name && n.name.getText && (ts.isFunctionLike(n) || ts.isClassLike(n) || ts.isVariableDeclaration(n)
        || ts.isPropertyAssignment(n) || ts.isMethodDeclaration(n))) return n.name.getText(sf);
    }
    return "";
  };
  const visit = (node) => {
    const ranges = (ts.getLeadingCommentRanges(text, node.getFullStart()) || [])
      .concat(ts.getTrailingCommentRanges(text, node.getEnd()) || []);
    for (const r of ranges) {
      if (seen.has(r.pos)) continue;
      seen.add(r.pos);
      out.push({ line: sf.getLineAndCharacterOfPosition(r.pos).line + 1, owner: nameOf(node), text: text.slice(r.pos, r.end) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out.sort((a, b) => a.line - b.line);
}

let bad = 0;
const parts = [];
for (const file of files) {
  const before = git("show", ref + ":" + file);
  if (archive) {
    const list = comments(file, before);
    if (list.length) {
      parts.push("## `" + file + "`\n");
      for (const c of list) {
        parts.push("### " + (c.owner ? "`" + c.owner + "` · " : "") + "строка " + c.line + "\n\n```\n" + c.text.replace(/```/g, "ʼʼʼ") + "\n```\n");
      }
    }
    continue;
  }
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) { console.log("снят файл: " + file); bad++; continue; }
  const now = fs.readFileSync(abs, "utf8");
  if (now === before) continue;
  const a = tokens(before), b = tokens(now);
  const i = a.findIndex((t, n) => t !== b[n]);
  if (i !== -1 || a.length !== b.length) {
    bad++;
    const n = i === -1 ? Math.min(a.length, b.length) : i;
    console.log("КОД РАЗОШЁЛСЯ: " + file + " — лексема " + n + ": " + JSON.stringify(a.slice(n, n + 4)) + " → " + JSON.stringify(b.slice(n, n + 4)));
  }
}

if (archive) {
  const head = "# Комментарии кода до сокращения — " + ref + "\n\n"
    + "Его заказ 2026-10-03: комментарии в `src` сокращены до причины и ссылки. Здесь — их полный текст "
    + "до сокращения, по файлам; заголовок — функция или имя, в котором комментарий стоял, и строка. "
    + "Ищется по имени функции. Собрано `node tools/comment_guard.js " + ref + " --archive <файл>`.\n\n";
  fs.writeFileSync(path.resolve(archive), head + parts.join("\n"));
  console.log("архив: " + archive + ", файлов " + parts.filter((p) => p.startsWith("## ")).length);
} else {
  console.log(bad ? "расходится: " + bad : "ok: код всех файлов src совпал с " + ref + " до лексемы");
  process.exit(bad ? 1 : 0);
}
