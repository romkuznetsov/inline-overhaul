"use strict";

/**
 * Сообщения плагина в редакторе говорят выбранным языком (PRD 10.13.50,
 * третий кусок каталога, ответ заказчика на В-74).
 *
 * **Почему проверок две, а не одна.** Пин на литералы отвечает только на
 * половину вопроса — что ключ собран функцией, а не написан строкой (У-82).
 * Вторая половина в том, **доезжает ли перевод до нарисованного**: строка
 * может лежать в каталоге, ключ может быть собран правильно, а место вызова
 * при этом спрашивать не тот ключ или не спрашивать вовсе. Ровно этим вторым
 * куском каталога и закрывался предыдущий кусок (10.13.47), и находилось это
 * мутацией, а не чтением.
 *
 * Поэтому здесь подменяется сам шов — `globalThis.__inlineSay`, — и смотрится,
 * что вернул `say`. Это то же, что сделает панель на настоящем языке.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const { say } = require(path.join(root, "src", "core", "say.js"));

let passed = 0;
const ok = (label) => { passed++; console.log("  ok " + label); };

/** Каталог на время одной проверки: шов возвращается на место всегда. */
function withCatalog(map, fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, "__inlineSay");
  const before = globalThis.__inlineSay;
  globalThis.__inlineSay = (key, fallback) =>
    (Object.prototype.hasOwnProperty.call(map, key) ? map[key] : fallback);
  try { return fn(); }
  finally {
    if (had) globalThis.__inlineSay = before;
    else delete globalThis.__inlineSay;
  }
}

/* ---- шов: без каталога английский, с каталогом переведённое ------------- */

{
  const had = Object.prototype.hasOwnProperty.call(globalThis, "__inlineSay");
  const before = globalThis.__inlineSay;
  delete globalThis.__inlineSay;
  try {
    assert.strictEqual(
      say("notice.navigation.no-editor", "Open a note first"),
      "Open a note first",
      "без шва сообщение обязано остаться английским, а не стать ключом"
    );
    assert.strictEqual(
      say("notice.navigation.error", "Navigation error: {0}", "boom"),
      "Navigation error: boom",
      "без шва подстановка всё равно обязана произойти: иначе человек увидит {0}"
    );
  } finally {
    if (had) globalThis.__inlineSay = before;
  }
  ok("нет каталога — есть английский, и подстановка работает");
}

withCatalog({ "notice.navigation.no-editor": "Сначала откройте заметку" }, () => {
  assert.strictEqual(
    say("notice.navigation.no-editor", "Open a note first"),
    "Сначала откройте заметку",
    "перевод из каталога не доехал до сообщения"
  );
  ok("перевод из каталога доезжает до сообщения");
});

withCatalog({ "notice.navigation.error": "Ошибка навигации: {0}" }, () => {
  assert.strictEqual(
    say("notice.navigation.error", "Navigation error: {0}", "нет строки"),
    "Ошибка навигации: нет строки",
    "подстановка не применилась к переведённой строке"
  );
  ok("подстановка {0} работает и на переведённой строке");
});

withCatalog({ "notice.navigation.no-editor": "" }, () => {
  assert.strictEqual(
    say("notice.navigation.no-editor", "Open a note first"),
    "Open a note first",
    "пустая строка в каталоге обязана уступить английскому, а не стереть сообщение"
  );
  ok("незаполненное молча уступает английскому (Я4)");
});

{
  /* Падение перевода не должно съедать сообщение: человеку важнее увидеть
     английское, чем не увидеть ничего. */
  const had = Object.prototype.hasOwnProperty.call(globalThis, "__inlineSay");
  const before = globalThis.__inlineSay;
  globalThis.__inlineSay = () => { throw new Error("каталог сломан"); };
  try {
    assert.strictEqual(
      say("notice.pkm.no-editor", "Open a note first"),
      "Open a note first",
      "упавший перевод унёс сообщение с собой"
    );
  } finally {
    if (had) globalThis.__inlineSay = before;
    else delete globalThis.__inlineSay;
  }
  ok("упавший перевод не уносит сообщение");
}

/* ---- каждое сообщение рантайма есть в каталоге -------------------------- */

{
  /*
   * **Обе стороны, и это главное утверждение файла.** Ключ, который
   * спрашивает код, обязан быть в таблице; строка таблицы, которую никто не
   * спрашивает, — мёртвая. Расходятся такие молча: на экране всё равно
   * появится английский литерал со стороны вызова, и заметить, что перевод не
   * применился, можно только сравнив два языка строка за строкой.
   *
   * **Список файлов здесь стоял и устарел ровно так, как обещал свой же
   * комментарий** (2026-09-11). Первым в нём был `main.js`, где вызовов не
   * осталось ни одного: файл читался, не находил ничего и молча не добавлял в
   * проверку ничего. И областей было две, зашитых прямо сюда, — то есть сам
   * сторож объявлял правило ключа третий раз.
   *
   * Теперь обход сплошной, а область берётся у помощника, который её
   * подставляет: `функция(name) → noticeKey('область', name)`. Ключ собирает
   * общий модуль — тот же самый, что и рантайм.
   */
  const sayMod = require(path.join(root, "src", "core", "say.js"));

  const runtimeFiles = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === "node_modules" || name === ".git" || name === "dist") continue;
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) { walk(abs); continue; }
      if (/\.(?:js|ts)$/.test(name)) runtimeFiles.push(abs);
    }
  })(path.join(root, "src"));
  for (const name of fs.readdirSync(root)) {
    if (/\.js$/.test(name)) runtimeFiles.push(path.join(root, name));
  }
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) { walk(abs); continue; }
      if (/\.js$/.test(name)) runtimeFiles.push(abs);
    }
  })(path.join(root, "pkm_v2"));

  const asked = new Set();
  for (const abs of runtimeFiles) {
    const src = fs.readFileSync(abs, "utf8");

    /* Помощники с зашитой областью: имя → область, взятая из самого вызова. */
    const areaOf = new Map();
    const helperRx = /(?:function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{[^}]*?|const\s+([A-Za-z_$][\w$]*)\s*=\s*\([^)]*\)\s*=>\s*)[\w$.]*noticeKey\(\s*['"]([a-z0-9-]+)['"]\s*,/g;
    let h;
    while ((h = helperRx.exec(src)) !== null) {
      const helperName = h[1] || h[2];
      if (helperName) areaOf.set(helperName, h[3]);
    }

    /* Двухаргументная форма: область стоит первым аргументом вызова. */
    const twoRx = /\b[\w$.]*noticeKey\(\s*["']([a-z0-9-]+)["']\s*,\s*["']([a-z0-9-]+)["']\s*\)/g;
    let m;
    while ((m = twoRx.exec(src)) !== null) asked.add(sayMod.noticeKey(m[1], m[2]));

    /* Односложная: область берётся у помощника, а не пишется здесь. */
    const oneRx = /\b([A-Za-z_$][\w$]*)\(\s*["']([a-z0-9-]+)["']\s*\)/g;
    let o;
    while ((o = oneRx.exec(src)) !== null) {
      const area = areaOf.get(o[1]);
      if (area) asked.add(sayMod.noticeKey(area, o[2]));
    }
  }
  assert.ok(asked.size >= 20,
    "сообщений в рантайме нашлось подозрительно мало: " + asked.size
    + ". Обход перестал находить вызовы — правьте выражения выше");

  /* Таблица каталога читается как текст: она на TypeScript, а этот файл — на
     CommonJS, и тянуть сюда загрузчик типов ради списка ключей незачем. */
  const table = fs.readFileSync(
    path.join(root, "src", "ui", "settings", "texts_runtime.ts"), "utf8");
  const declared = new Set();
  {
    /* Разбор идёт по областям: `area: { "name": "text", … }`. */
    const areaRx = /^\s{2}([a-z]+):\s*\{$/gm;
    let a;
    while ((a = areaRx.exec(table)) !== null) {
      const area = a[1];
      const from = areaRx.lastIndex;
      const to = table.indexOf("\n  },", from);
      const body = table.slice(from, to < 0 ? table.length : to);
      const nameRx = /^\s{4}"?([a-z0-9-]+)"?:\s*"/gm;
      let n;
      while ((n = nameRx.exec(body)) !== null) declared.add("notice." + area + "." + n[1]);
    }
  }
  assert.ok(declared.size >= 20,
    "в таблице каталога нашлось подозрительно мало ключей: " + declared.size);

  const missing = [...asked].filter(k => !declared.has(k)).sort();
  assert.deepStrictEqual(missing, [],
    "код спрашивает ключ, которого нет в каталоге — перевод для него завести негде:\n  "
    + missing.join("\n  "));

  const unused = [...declared].filter(k => !asked.has(k)).sort();
  assert.deepStrictEqual(unused, [],
    "в каталоге лежит сообщение, которого никто не спрашивает — человек переведёт его зря:\n  "
    + unused.join("\n  "));

  ok("обе стороны сходятся: спрашивается " + asked.size + " ключей, объявлено столько же");
}

/* ---- префикса имени плагина нет ни у одного сообщения ------------------- */

{
  /*
   * Пункт 5 фазы 4 снял `InlineOverhaul:` у сообщений редактора Fields —
   * Obsidian показывает источник уведомления сам, а префикс отнимал треть
   * ширины окна у текста, ради которого окно и показано. До сообщений
   * редактора он тогда не дошёл: их оставалось двенадцать.
   *
   * Запрет стоит на **таблице каталога**, а не на исходниках: там дом текста,
   * и вернуться префикс может только туда.
   */
  const table = fs.readFileSync(
    path.join(root, "src", "ui", "settings", "texts_runtime.ts"), "utf8");
  const lines = table.split("\n")
    .map((text, i) => ({ no: i + 1, text }))
    .filter(({ text }) => !/^\s*(\*|\/\/|\/\*)/.test(text))
    .filter(({ text }) => /:\s*"InlineOverhaul/.test(text));
  assert.deepStrictEqual(lines.map(l => l.no), [],
    "сообщение снова начинается с имени плагина — Obsidian и так показывает источник");
  ok("ни одно сообщение не начинается с имени плагина");
}

{
  /*
   * **Сплошной обход, и вот зачем он появился.**
   *
   * Первая перепись сообщений считала `new Notice` в `main.js` и `pkm_v2/**` —
   * и пропустила больше двадцати. Причина: модули `src/` говорят не через
   * `new Notice`, а через `plugin.notice(...)` и через **текст исключения**,
   * который выше по стеку подставляется человеку в `Transform error: {0}`. Со
   * стороны `main.js` этого не видно вовсе, и обе стороны пина сходились —
   * потому что обе смотрели не туда.
   *
   * Отсюда правило: **перепись, идущая по списку файлов, проверяет список, а
   * не предмет.** Здесь обход сплошной: любой файл плагина, любая строка
   * живого кода, начинающаяся с имени плагина.
   *
   * Имена файлов (`InlineOverhaul_Generated_RULES_TagWheel.md`,
   * `InlineOverhaul_DevLog`) — не сообщения: это адреса, и переименовывать их
   * нельзя (у человека уже лежат файлы с такими именами).
   */
  const skipDirs = new Set(["node_modules", ".git", "dist", "docs", "tests", "media"]);
  const found = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      if (skipDirs.has(name)) continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(js|ts)$/.test(name)) continue;
      const rel = path.relative(root, full).replace(/\\/g, "/");
      const lines = fs.readFileSync(full, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = String(lines[i] || "");
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue;
        /* Адрес, а не речь: имя файла плагина. */
        const speech = line.replace(/InlineOverhaul_[A-Za-z0-9_]*/g, "");
        if (/["'`]InlineOverhaul[:\s]/.test(speech)) {
          found.push(rel + ":" + (i + 1) + "  " + line.trim().slice(0, 90));
        }
      }
    }
  };
  walk(root);
  assert.deepStrictEqual(found, [],
    "строка, которую увидит человек, снова начинается с имени плагина:\n  " + found.join("\n  "));
  ok("сплошной обход: ни в одном файле плагина нет речи, начинающейся с его имени");
}

/* ---- правило подстановки объявлено один раз ----------------------------- */

{
  /*
   * **Одно правило — одно место, и здесь оно про перевод сообщения** (В-100,
   * 2026-09-10, тридцать седьмое исключение к З3).
   *
   * До этого дня «спросить шов, при отказе остаться на английском, подставить
   * `{0}` по номеру» было объявлено **четыре раза**: в `src/core/say.js` и в
   * трёх движках под З3. Все четыре совпадали знак в знак — и именно поэтому
   * расхождение было бы незаметным: копия отвечала бы иначе только в тот
   * момент, когда общий код бросил. Так уже вышло с разбором даты, где копия
   * не сверяла результат обратно, и `2026-02-31` молча становилось третьим
   * марта (первый кусок В-97).
   *
   * **Запрет написан по форме, а не по имени** (У-126): копия начинается с
   * того, что шов берут в свою переменную. Имя помощника при этом может быть
   * любым, а комментарий, упоминающий шов словами, под форму не попадает.
   */
  const ENGINES = [
    ["pkm_v2/status_date.js", /require\("\.\.\/src\/core\/say\.js"\)/],
    ["pkm_v2/status_tags.js", /require\("\.\.\/src\/core\/say\.js"\)/],
    ["pkm_v2/TagWheel/tagwheel.js", /require\('\.\.\/\.\.\/src\/core\/say\.js'\)/],
  ];
  /* Форма копии: шов уезжает в свою переменную, и дальше его спрашивают сами. */
  const OWN_COPY = /(?:var|let|const)\s+[A-Za-z_$][\w$]*\s*=\s*globalThis\s*\.\s*__inlineSay/;

  for (const [rel, requireRx] of ENGINES) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    assert.ok(requireRx.test(src),
      rel + " не берёт общий помощник литеральным require — значит держит своё");
    assert.ok(/__say\(/.test(src),
      rel + " не зовёт общий помощник: правило объявлено где-то ещё");
    assert.ok(!OWN_COPY.test(src),
      rel + " снова берёт шов `__inlineSay` в свою переменную — это вторая"
      + " реализация одного правила (У-32)");
  }
  ok("три движка спрашивают общий помощник и своей копии подстановки не держат");

  /*
   * Положительный контроль запрета — на строке-образце, а не на том, что
   * нарушение в продукте ещё есть (У-127): такой контроль умирает вместе с
   * долгом. И вторая половина контроля важнее первой: комментарий, где шов
   * назван словами, запрет ронять не должен.
   */
  assert.ok(OWN_COPY.test("  var ask = globalThis.__inlineSay\n"),
    "запрет не узнаёт собственную форму копии — он бы молчал всегда");
  assert.ok(OWN_COPY.test("  const ask=globalThis.__inlineSay;"),
    "запрет читает форму копии только с пробелами вокруг знака равенства");
  assert.ok(!OWN_COPY.test(" * Шов — `globalThis.__inlineSay`, ставит его панель"),
    "запрет краснеет на упоминании шва в объяснении, а не на копии");
  ok("контроль запрета: форма копии узнаётся, а рассказ о шве — нет");
}


/* ---- формула ключа объявлена один раз ----------------------------------- */

{
  /*
   * **Запрет по форме, а не по имени** (У-126). Ключ сообщения — это склейка
   * `"notice." + область + "." + имя`, и объявлять её больше одного раза
   * нельзя: расходятся такие копии молча, а на экране это выглядит как
   * «перевод не применился вот к этим шести строкам».
   *
   * До 2026-09-11 склейка была написана **десять раз**: шесть копий в слое
   * команд слово в слово, одна в слое настроек, три в движках под З3 с зашитой
   * областью — и десятой был сам этот файл, собиравший ключ заново, чтобы
   * сверить. Над шестью из них стояла строка «Строит его одна функция, и её
   * зовут оба конца»: комментарий утверждал ровно то, чего не было.
   *
   * Дом теперь один — `src/core/say.js`, и он назван здесь по пути, а не по
   * содержимому: поиск идёт по всем файлам плагина, и разрешено ровно одно
   * место.
   */
  const FORMULA = /["']notice\.["']\s*\+/;

  /* Контроль до первого вывода: образец обязан находить свою же форму и не
     находить чужую. */
  assert.ok(FORMULA.test('return "notice." + area + "." + name;'),
    "контроль: образец не находит собственную форму — сломан он, а не рантайм");
  assert.ok(!FORMULA.test('return sayModule.noticeKey(area, name);'),
    "контроль: образец находит вызов общего модуля и объявил бы его копией");

  const files = [];
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === "node_modules" || name === ".git" || name === "dist") continue;
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) { walk(abs); continue; }
      if (/\.(?:js|ts)$/.test(name)) files.push(abs);
    }
  })(path.join(root, "src"));
  (function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) { walk(abs); continue; }
      if (/\.js$/.test(name)) files.push(abs);
    }
  })(path.join(root, "pkm_v2"));
  for (const name of fs.readdirSync(root)) {
    if (/\.js$/.test(name)) files.push(path.join(root, name));
  }

  assert.ok(files.length > 50,
    "положительный контроль: обход нашёл файлы плагина (" + files.length + ")");

  const home = path.join(root, "src", "core", "say.js");
  const elsewhere = [];
  let homeFound = false;
  for (const abs of files) {
    const code = fs.readFileSync(abs, "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join("\n");
    if (!FORMULA.test(code)) continue;
    if (abs === home) { homeFound = true; continue; }
    elsewhere.push(path.relative(root, abs).replace(/\\/g, "/"));
  }
  assert.ok(homeFound,
    "положительный контроль: в say.js формулы ключа нет — значит ищется не то");
  assert.deepStrictEqual(elsewhere, [],
    "формула ключа сообщения объявлена не только в say.js:\n  " + elsewhere.join("\n  "));
  ok("формула ключа сообщения объявлена ровно один раз, в say.js");
}

console.log("\n" + passed + " проверок пройдено");
