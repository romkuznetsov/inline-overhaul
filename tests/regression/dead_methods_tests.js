"use strict";

/**
 * Имя, объявленное **методом**, к которому в коде нет ни одного обращения.
 *
 * **Зачем отдельно от `dead_exports_tests.js`.** Тот сторож считает экспорты
 * модуля и честно печатает «0 из 866». Метод класса или метод в литерале
 * объекта — другая форма, и ей он слеп по устройству. Цена этой слепоты
 * названа: `ConfigStore.flushNow` пролежал незваным с самого начала, при том
 * что PRD (CS7) требует звать его в `onunload`, — и правка настройки,
 * сделанная перед выключением плагина, пропадала молча (разбор —
 * `docs/AUDIT_2026-09-18.md`, 4.1). Рядом лежал `SettingsPane.dispose`, чей
 * собственный комментарий обещал «зовётся при выгрузке плагина».
 *
 * Мера видит одну форму (У-137): к экспортам нужен второй сторож, а не более
 * широкий первый.
 *
 * **Разбор берётся у настоящего разборщика, а не у своей маски** (У-96, У-139,
 * У-192). `typescript` уже лежит в зависимостях разработки и ставится `npm ci`;
 * своя маска на этом же предмете врала трижды — съедала файл до конца на
 * обратной кавычке внутри регулярного выражения, считала знаки не теми
 * единицами и находила предмет внутри собственных объяснений.
 *
 * **Направление ошибки выбрано нарочно** (У-192). Обращением считается любой
 * токен-имя и любое строковое содержимое, равное имени: значит `obj["flushNow"]`
 * и имя, собранное строкой, читаются как обращение. Сторож из-за этого может
 * **пропустить** мёртвое — и не может назвать мёртвым живое. Пропустить можно,
 * оболгать нельзя.
 *
 * **Контроль на каждый шаг обхода** (У-142), а не один на вывод:
 *   1. разбор нашёл методы вообще — их не меньше нижней границы;
 *   2. заведомо живые имена найдены живыми;
 *   3. заведомо мёртвое подсаженное имя найдено мёртвым;
 *   4. обращения и правда считаются — у живого имени их больше нуля.
 *
 * **Чего этот сторож не видит, и кто это видит вместо него.** Обращение — не
 * достижимость: цепочка имён, которые зовут друг друга и до которых не
 * доходит никто, остаётся для него живой (У-148). Проверено мутацией: снять
 * из `onunload` шаг `settings-pane` — и `disposePane` с `dispose` по-прежнему
 * зовут друг друга, а этот прогон зелёный. Краснеет на ней **другой** сторож,
 * `dead_exports_tests.js`: `disposeSettingTab` остаётся экспортом, которого
 * никто не зовёт. Два сторожа смотрят на разные формы и закрывают друг друга;
 * на достижимость отвечает `tools/coverage_map.js`, а он гейтом не является.
 *
 * Долг держит только один род — команды консоли (ниже). Новое незваное имя
 * роняет проверку и называет себя. Заводя такое имя нарочно, впишите его в
 * `DEBT` вместе с причиной — иначе следующая сессия начнёт разбор заново.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..", "..");
let passed = 0;
const ok = (label) => { passed++; console.log("  ok " + label); };

/** Где объявления ищутся: только рантайм, то есть то, что уезжает человеку. */
const DECL_ROOTS = ["src"];

/** Где ищутся обращения: весь код репозитория. Документы сюда не входят
    нарочно — упоминание в документе вызовом не является (У-138). */
const REF_ROOTS = ["src", "pkm_v2", "tests", "tools",
];

/**
 * Имена, которые зовёт платформа, а не наш код: искать их вызов бессмысленно.
 * Список закрытый — каждое имя либо в типах Obsidian, либо в типах CodeMirror.
 */
const PLATFORM_HOOKS = new Set([
  "constructor", "onload", "onunload", "onExternalSettingsChange",
  "display", "hide", "onOpen", "onClose",
  "onChooseItem", "getItems", "getItemText",
  "getSuggestions", "renderSuggestion", "selectSuggestion",
  "update", "destroy", "toDOM", "eq", "ignoreEvent", "markers", "mount",
]);

/**
 * Имена, объявленные нарочно и незваные **кодом**, с причиной у каждого.
 *
 * Здесь лежит ровно один род: команды, которые набирает человек в консоли
 * разработчика. У них звавшего нет и быть не может, и снимать их нельзя —
 * это инструмент, а не долг.
 *
 * Из первого прогона 2026-09-18 сюда не попало ничто другое: пять имён сняты,
 * `flushNow` **позван** (его требовал PRD, и молчание было дефектом), а
 * `dispose` доведён до вызова из выгрузки — разбор в
 * `docs/AUDIT_2026-09-18.md`, Р-3 и Р-4.
 */
const DEBT = {
  dumpLatest: "окно отладки полос в консоли: globalThis.__ioStripDebug, зовёт человек",
  scanVisible: "то же окно отладки полос",
  dumpLine: "то же окно отладки полос",
  dumpGeometry: "то же окно отладки полос",
  dumpMixed: "то же окно отладки полос",
};

function walk(rel, out, keep) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  const st = fs.statSync(abs);
  if (st.isFile()) { if (keep(abs)) out.push(abs); return out; }
  for (const name of fs.readdirSync(abs)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    walk(path.join(rel, name), out, keep);
  }
  return out;
}

const isCode = (f) => /\.(?:js|ts|mjs)$/.test(f) && !/\.d\.ts$/.test(f);

function sourceFileOf(file, text) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.ES2020, true,
    /\.ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
}

/* ---- шаг 1: что объявлено методом ------------------------------------- */

const declFiles = [];
for (const r of DECL_ROOTS) walk(r, declFiles, isCode);

/** имя -> [{ rel, line }] */
const declared = new Map();
/** «путь|смещение имени» — чтобы не считать объявление обращением к себе. */
const declPositions = new Set();

for (const file of declFiles) {
  const text = fs.readFileSync(file, "utf8");
  const sf = sourceFileOf(file, text);
  const rel = path.relative(root, file).replace(/\\/g, "/");
  (function scan(node) {
    const isMethod = ts.isMethodDeclaration(node)
      || ts.isGetAccessorDeclaration(node)
      || ts.isSetAccessorDeclaration(node);
    if (isMethod && node.name && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      if (!PLATFORM_HOOKS.has(name)) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        if (!declared.has(name)) declared.set(name, []);
        declared.get(name).push({ rel, line });
        declPositions.add(rel + "|" + node.name.getStart(sf));
      }
    }
    ts.forEachChild(node, scan);
  })(sf);
}

assert.ok(declared.size >= 50,
  "разбор не нашёл методов: объявлений " + declared.size + " — смотреть надо на обход, а не на продукт");
ok("контроль 1: разбор нашёл методы — имён " + declared.size);

/* ---- шаг 2: сколько раз к имени обращаются ----------------------------- */

const refFiles = [];
for (const r of REF_ROOTS) walk(r, refFiles, isCode);

const refs = new Map();
for (const name of declared.keys()) refs.set(name, 0);

/*
 * Обращения считаются по дереву, а не отдельным сканером. Сканер без
 * разборщика не знает, где кончается регулярное выражение: `/['"]/` он читает
 * делением и кавычкой, после чего половина файла становится одной строкой.
 * Проверено измерением: на `config_write.js` (7065 знаков) он давал 211
 * токенов и не находил `pluginFolderPath`, который там есть. Это тот же У-139,
 * только маска чужая.
 */
for (const file of refFiles) {
  const text = fs.readFileSync(file, "utf8");
  const sf = sourceFileOf(file, text);
  const rel = path.relative(root, file).replace(/\\/g, "/");
  (function scan(node) {
    let word = null;
    if (ts.isIdentifier(node)) {
      /* Само объявление обращением к себе не является. */
      if (!declPositions.has(rel + "|" + node.getStart(sf))) word = node.text;
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      /* Имя, собранное строкой, — тоже обращение: ошибаемся в сторону
         «пропустить мёртвое», а не «оболгать живое». */
      word = node.text;
    }
    if (word && refs.has(word)) refs.set(word, refs.get(word) + 1);
    ts.forEachChild(node, scan);
  })(sf);
}

/* ---- контроли на сам подсчёт ------------------------------------------ */

const LIVE = ["getSnapshot", "scheduleSave", "patch", "flushNow"];
for (const name of LIVE) {
  assert.ok(declared.has(name), "контроль: имя " + name + " не найдено объявлением — обход слеп");
  assert.ok(refs.get(name) > 0, "контроль: заведомо живое " + name + " названо незваным");
}
ok("контроль 2: заведомо живые имена найдены живыми — " + LIVE.join(", "));

assert.ok(!declared.has("__заведомоМёртвоеИмяДляКонтроля__"),
  "контрольное имя не должно встречаться в продукте");
declared.set("__заведомоМёртвоеИмяДляКонтроля__", [{ rel: "(контроль)", line: 0 }]);
refs.set("__заведомоМёртвоеИмяДляКонтроля__", 0);

/* ---- шаг 3: вердикт ---------------------------------------------------- */

const dead = [];
for (const [name, places] of declared) {
  if ((refs.get(name) || 0) > 0) continue;
  dead.push({ name, places });
}

const control = dead.find((d) => d.name === "__заведомоМёртвоеИмяДляКонтроля__");
assert.ok(control, "контроль: подсаженное мёртвое имя не найдено — вердикт слеп");
ok("контроль 3: подсаженное мёртвое имя найдено");

const real = dead.filter((d) => d.name !== "__заведомоМёртвоеИмяДляКонтроля__");
const unexplained = real.filter((d) => !DEBT[d.name]);

if (unexplained.length) {
  const lines = unexplained.map((d) =>
    "  " + d.name + "   " + d.places.map((p) => p.rel + ":" + p.line).join(", "));
  assert.fail("объявлено методом и не зовётся никем:\n" + lines.join("\n")
    + "\n\nЛибо снимите объявление, либо позовите его, либо впишите в DEBT с причиной.");
}

ok("незваных методов нет: проверено имён " + (declared.size - 1)
  + ", в долге " + Object.keys(DEBT).length);

console.log("Dead methods tests: OK (" + passed + " checks)");
