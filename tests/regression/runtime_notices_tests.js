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
   * Ключи со стороны кода собираются **разбором исходников**, а не списком
   * здесь: список пришлось бы править вместе с каждым новым сообщением, и он
   * бы устарел молча — тем же способом, каким устаёт всякий второй экземпляр
   * (У-32).
   */
  const FILES = [
    ["main.js", /__noticeKey\("([a-z-]+)",\s*"([a-z0-9-]+)"\)/g],
    ["pkm_v2/TagWheel/tagwheel.js", /tagWheelNoticeKey\('([a-z0-9-]+)'\)/g],
    ["pkm_v2/status_date.js", /statusDateNoticeKey\('([a-z0-9-]+)'\)/g],
    ["pkm_v2/status_tags.js", /noticeKey\('([a-z0-9-]+)'\)/g],
  ];

  const asked = new Set();
  for (const [rel, rx] of FILES) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    let m;
    while ((m = rx.exec(src)) !== null) {
      /* У TagWheel и status_* область зашита в саму функцию ключа: она одна
         на файл. У `main.js` областей несколько, и она первым аргументом. */
      if (rel === "main.js") asked.add("notice." + m[1] + "." + m[2]);
      else if (rel.includes("tagwheel")) asked.add("notice.tagwheel." + m[1]);
      else asked.add("notice.rules." + m[1]);
    }
  }
  assert.ok(asked.size >= 20,
    "сообщений в рантайме нашлось подозрительно мало: " + asked.size
    + ". Разбор исходника перестал находить вызовы — правьте выражения выше");

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

console.log("\n" + passed + " проверок пройдено");
