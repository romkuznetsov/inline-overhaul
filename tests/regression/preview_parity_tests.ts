/**
 * Предпросмотр строки нарисован дважды — сверка двух отрисовок (У-32).
 *
 * **Зачем.** Прототип нормативен по виду панели (Р8), но рисует панель свой
 * код: `src/ui/settings/custom/*` плюс `styles.css`. Обе отрисовки говорят с
 * вёрсткой одними и теми же переменными `--io-*`: одна ставит их по настройке,
 * другая читает в правиле. Переменная, которую ставит **одна** сторона, и есть
 * расхождение — один предпросмотр настройку показывает, второй нет.
 *
 * **Чем это куплено.** 2026-09-09, замечание заказчика по подложке блоков
 * (`S7`). В прототипе подложка была на точку выше и на четыре шире
 * написанного, в панели и в заметке — ровно по написанному, то есть под
 * пузырём тега невидима. Правило «на сколько подложка больше написанного»
 * оказалось объявлено дважды, разошлось молча, и **все проверки были
 * зелёными**: браузерный гейт меряет прототип, а панель мерить было нечем.
 * Тем же заходом нашлось второе такое место: зазор между полосами соседних
 * строк (`Gap between Bars`) панель показывала, а прототип — нет.
 *
 * **Почему сверяются переменные, а не правила стилей целиком.** Правил
 * расходится две дюжины, и почти все законно: прототип рисует свою обвязку —
 * полосу вкладок, окна, подсказки, — а панель берёт её у Obsidian, и свои
 * токены у прототипа тоже свои (`--font-mono` против `--font-monospace`
 * Obsidian). Список из двух дюжин исключений и есть тот способ, каким
 * «проверено автоматически» превращается в «проверено ничего». Переменные
 * настроек — другое дело: у них законных расхождений нет ни одного, и предмет
 * у них ровно тот, из-за которого заказчик приходит.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.join(import.meta.dirname, "..", "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

/** Файлы слоя настроек — обходом, а не списком имён (У-111). */
function panelSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) { walk(full); continue; }
      if (/\.(js|ts)$/.test(name)) out.push(fs.readFileSync(full, "utf8"));
    }
  };
  walk(path.join(repoRoot, "src", "ui", "settings"));
  return out;
}

/** Переменные, которые код ставит по настройке. */
function setByCssVar(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/cssVar\(\s*[^,]+,\s*"(--io-[A-Za-z0-9-]+)"/g)) out.add(String(m[1]));
  return out;
}

/**
 * Переменные, которые ставит **только** панель и это законно.
 *
 * Список пуст, и пустым он должен остаться. Заводя сюда строку, пишите рядом,
 * почему у прототипа этого нет и что должно случиться, чтобы строка ушла: без
 * этого исключение переживёт свою причину (У-71).
 *
 * `--io-twfill` сюда не входит и входить не должен: его ставит не слой
 * настроек, а `src/ui/editor/styles.js` для заливки строки TagWheel в самой
 * заметке. В предпросмотре его нет ни у кого.
 */
const PANEL_ONLY: readonly string[] = [];

/** И зеркальный список для прототипа — тоже пустой. */
const PROTO_ONLY: readonly string[] = [];

function main(): void {
  const proto = setByCssVar(read(path.join("docs", "prototype", "settings_prototype.html")));
  const panel = setByCssVar(panelSources().join("\n"));

  /*
   * Положительный контроль до сравнения: обе стороны обязаны быть непустыми и
   * сравнимого размера. Сверка двух пустых наборов зелена и не проверяет
   * ничего — так уже было с проверкой, сверявшей модуль сам с собой (У-92).
   */
  assert.ok(proto.size >= 20,
    "переменных предпросмотра в прототипе найдено " + proto.size
    + " — разбор сломан, и сверять было нечего");
  assert.ok(panel.size >= 20,
    "переменных предпросмотра в панели найдено " + panel.size
    + " — разбор сломан, и сверять было нечего");

  const onlyPanel = Array.from(panel).filter(v => !proto.has(v) && !PANEL_ONLY.includes(v)).sort();
  const onlyProto = Array.from(proto).filter(v => !panel.has(v) && !PROTO_ONLY.includes(v)).sort();

  assert.deepEqual(onlyPanel, [],
    "эти настройки показывает предпросмотр панели и не показывает прототип — "
    + "правило вида объявлено дважды и разошлось (У-32):\n  " + onlyPanel.join("\n  "));
  assert.deepEqual(onlyProto, [],
    "эти настройки показывает прототип и не показывает предпросмотр панели — "
    + "человек увидит в панели не то, что согласовано:\n  " + onlyProto.join("\n  "));

  /*
   * И обратная сторона: переменная, которую сторона ставит, а её же стили не
   * читают. Такая настройка доезжает до вёрстки и не делает ничего — тот же
   * класс, что «ключ, который движок нормализует и никто не читает» (У-16).
   */
  const readIn = (css: string): Set<string> => {
    const out = new Set<string>();
    for (const m of css.matchAll(/var\(\s*(--io-[A-Za-z0-9-]+)/g)) out.add(String(m[1]));
    return out;
  };
  const protoHtml = read(path.join("docs", "prototype", "settings_prototype.html"));
  const protoCss = Array.from(protoHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))
    .map(m => String(m[1] || "")).join("\n");
  const panelCss = read("styles.css");

  const protoDead = Array.from(proto).filter(v => !readIn(protoCss).has(v)).sort();
  const panelDead = Array.from(panel).filter(v => !readIn(panelCss).has(v)).sort();
  assert.deepEqual(protoDead, [],
    "прототип ставит эти переменные, а его же стили их не читают:\n  " + protoDead.join("\n  "));
  assert.deepEqual(panelDead, [],
    "панель ставит эти переменные, а `styles.css` их не читает:\n  " + panelDead.join("\n  "));

  console.log("  ok  предпросмотр панели и прототип показывают одни и те же настройки ("
    + proto.size + " переменных)");
}

main();
console.log("Preview parity regression tests: OK");
