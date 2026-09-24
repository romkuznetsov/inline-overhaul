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
 * строк (`Vertical gap between Bars`) панель показывала, а прототип — нет.
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
  const panelCss = read("src/styles.css");

  const protoDead = Array.from(proto).filter(v => !readIn(protoCss).has(v)).sort();
  const panelDead = Array.from(panel).filter(v => !readIn(panelCss).has(v)).sort();
  assert.deepEqual(protoDead, [],
    "прототип ставит эти переменные, а его же стили их не читают:\n  " + protoDead.join("\n  "));
  assert.deepEqual(panelDead, [],
    "панель ставит эти переменные, а `styles.css` их не читает:\n  " + panelDead.join("\n  "));

  console.log("  ok  предпросмотр панели и прототип показывают одни и те же настройки ("
    + proto.size + " переменных)");

  /*
   * **Кегль Block слушает всё, что в Block нарисовано** (его замечание
   * 2026-09-19, пункт 6: «размер элементов left/right block меняется в
   * зависимости от tags-text-size, кроме wikilink»).
   *
   * У ссылки правила размера не было **ни в одной** из двух отрисовок, поэтому
   * сверка сторон друг с другом этого и не видела: обе молчали одинаково
   * (У-194). Значит утверждений здесь два, и они про разное.
   */
  const scalesWith = (css: string, cls: string): boolean => {
    const re = new RegExp("\\." + cls + "\\b[^{}]*\\{([^}]*)\\}", "g");
    for (const m of css.matchAll(re)) {
      if (/font-size\s*:[^;]*--io-text-scale/.test(String(m[1] || ""))) return true;
    }
    return false;
  };

  /*
   * Первое: три класса, которыми предпросмотр рисует значения в Block. Список
   * здесь рукописный, и это его слабое место (У-111) — зато он отвечает на
   * вопрос, на который вывод из кода не отвечает: «а всё ли, что человек видит
   * в Block, кегль слушает». Классы печатаются вслух.
   */
  const inBlock = ["io-bubble", "io-elem", "io-link"];
  const deaf: string[] = [];
  for (const cls of inBlock) {
    if (!scalesWith(panelCss, cls)) deaf.push("styles.css: ." + cls);
    if (!scalesWith(protoCss, cls)) deaf.push("прототип: ." + cls);
  }
  assert.deepEqual(deaf, [],
    "нарисовано в Block, а кегль Block не слушает:\n  " + deaf.join("\n  "));

  /*
   * Второе, и оно выводится, а не пишется: класс, который слушает кегль в
   * одной отрисовке и не слушает в другой. Это уже сверка сторон, и списка ей
   * не нужно.
   */
  const scaled = (css: string): Set<string> => {
    const out = new Set<string>();
    for (const m of css.matchAll(/\.(io-[A-Za-z0-9_-]+)\b[^{}]*\{([^}]*)\}/g)) {
      if (/font-size\s*:[^;]*--io-text-scale/.test(String(m[2] || ""))) out.add(String(m[1]));
    }
    return out;
  };
  const inPanel = scaled(panelCss);
  const inProto = scaled(protoCss);
  const split = [
    ...Array.from(inPanel).filter(c => !inProto.has(c)).map(c => "только панель: ." + c),
    ...Array.from(inProto).filter(c => !inPanel.has(c)).map(c => "только прототип: ." + c),
  ].sort();
  assert.deepEqual(split, [],
    "кегль Block слушает одна отрисовка и не слушает вторая:\n  " + split.join("\n  "));
  assert.ok(inPanel.size >= inBlock.length,
    "обход не нашёл даже названных классов — значит он ищет не то (У-200)");

  console.log("  ok  кегль Block слушают все " + inPanel.size
    + " классов значений, и обе отрисовки одинаково");

  /*
   * **Сторона полосы называется классом, и класс этот нужен четырём местам**
   * (З-12, `Stripe direction`): его ставят две отрисовки и читают два файла
   * стилей. Класс, поставленный одной стороной, — то же расхождение, что
   * переменная: у человека полоса слушает направление в панели и не слушает в
   * прототипе, или наоборот.
   *
   * Список не пишется, а выводится: обход берёт все имена семьи из кода и из
   * стилей обеих сторон. Порог рядом — семья непуста, иначе сверялись бы два
   * пустых набора (У-92).
   */
  const familyIn = (src: string): Set<string> => {
    const out = new Set<string>();
    for (const m of src.matchAll(/io-line--blockfill-[A-Za-z0-9-]+/g)) out.add(String(m[0]));
    return out;
  };
  const sides = {
    "код прототипа": familyIn(protoHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "")),
    "код панели": familyIn(panelSources().join("\n")),
    "стили прототипа": familyIn(protoCss),
    "стили панели": familyIn(panelCss),
  };
  for (const [where, set] of Object.entries(sides)) {
    assert.ok(set.size >= 2,
      "сторон полосы в «" + where + "» найдено " + set.size
      + " — обход ищет не то, и сверять было нечего (У-200)");
  }
  const union = new Set(Object.values(sides).flatMap(s => Array.from(s)));
  const missing: string[] = [];
  for (const cls of Array.from(union).sort()) {
    for (const [where, set] of Object.entries(sides)) {
      if (!set.has(cls)) missing.push(where + ": нет ." + cls);
    }
  }
  assert.deepEqual(missing, [],
    "сторону полосы называет не всякая отрисовка и не всякие стили:\n  " + missing.join("\n  "));
  console.log("  ok  сторону полосы (" + union.size
    + " класса) ставят обе отрисовки и читают оба файла стилей");
}

main();
console.log("Preview parity regression tests: OK");
