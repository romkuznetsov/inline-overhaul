"use strict";

/**
 * `resolveOrderConfig`: чем отвечает разрешение порядка Fields для движков.
 *
 * **Зачем заведено.** До 2026-09-18 у этой функции был запасной ход: нет
 * порядка в настройках — прочитать его из `data.json` через `vault`. Ход не мог
 * сработать ни при каком условии (путь папки настроек стоял литералом, а до
 * `.obsidian/**` `vault` не достаёт вовсе), и пробой со счётчиком это
 * подтвердил: 2759 вызовов на всех дорогах, заходов в ход — ноль. Ход снят,
 * разбор — `docs/AUDIT_2026-09-18.md`, 4.4 и Р-5.
 *
 * **Держать это пином по тексту файла нельзя** (У-63): пин на присутствие
 * функции был зелёным ровно всё то время, пока до функции никто не доходил.
 * Поэтому здесь проверяется **ответ**, а не написание: что функция отдаёт при
 * порядке в настройках, при его отсутствии и при пустой строке на его месте.
 *
 * **Что настоящее** (У-1). Сам модуль. Подделан один шов — `parseOrderConfig`,
 * который сюда и передают доводом: он не часть этой функции, его дом в
 * движках, и здесь он служит зеркалом, которое показывает, **что** функции
 * отдали на разбор.
 *
 * **Отрицательный контроль стоит рядом с каждым утверждением:** подделка
 * `vault`, которая отдала бы порядок, если бы его кто-то спросил, — и никто не
 * спрашивает.
 */

const assert = require("assert");
const path = require("path");

const bootstrap = require(path.join(__dirname, "..", "..", "src", "core", "pkm_runtime_bootstrap.js"));

let passed = 0;
const ok = (label) => { passed++; console.log("  ok " + label); };

/** Зеркало: запоминает, что именно отдали на разбор. */
function mirror() {
  const seen = [];
  const parse = (raw, normalizeKey) => {
    seen.push({ raw, hasNormalizer: typeof normalizeKey === "function" });
    return { parsed: raw };
  };
  return { seen, parse };
}

/**
 * `app`, у которого порядок **есть** и который отдал бы его, если бы его
 * спросили. Это и есть отрицательный контроль: счётчик обязан остаться нулём.
 */
function appThatWouldAnswer(counts) {
  return {
    vault: {
      getAbstractFileByPath(p) {
        counts.asked.push(String(p));
        return { path: String(p) };
      },
      async read() {
        counts.read += 1;
        return JSON.stringify({ pkm: { fields: { order: { fromFile: true } } } });
      },
    },
  };
}

async function run() {
  /* ---- порядок есть в настройках: разбирается он -------------------- */
  {
    const m = mirror();
    const counts = { asked: [], read: 0 };
    const got = await bootstrap.resolveOrderConfig(
      appThatWouldAnswer(counts),
      { RULES_ORDER: { fromSettings: true } },
      { orderConfigKey: "RULES_ORDER", parseOrderConfig: m.parse },
    );
    assert.deepStrictEqual(got, { parsed: { fromSettings: true } }, "разобран порядок из настроек");
    assert.strictEqual(m.seen.length, 1, "разбор позван один раз");
    assert.strictEqual(m.seen[0].hasNormalizer, true, "нормализатор ключа передан разбору");
    assert.deepStrictEqual(counts.asked, [], "у vault не спросили ничего");
    assert.strictEqual(counts.read, 0, "и ничего не прочитали");
    ok("порядок из настроек уходит в разбор, vault не трогается");
  }

  /* ---- порядка в настройках нет: vault всё равно не спрашивается ----- */
  {
    const m = mirror();
    const counts = { asked: [], read: 0 };
    const got = await bootstrap.resolveOrderConfig(
      appThatWouldAnswer(counts),
      {},
      { orderConfigKey: "RULES_ORDER", parseOrderConfig: m.parse },
    );
    assert.deepStrictEqual(got, { parsed: undefined }, "разбору отдано то, что пришло, — то есть ничего");
    assert.strictEqual(m.seen.length, 1, "разбор позван один раз");
    assert.deepStrictEqual(counts.asked, [],
      "запасного хода в data.json нет: у vault не спросили ни одного пути");
    assert.strictEqual(counts.read, 0, "и ничего не прочитали");
    ok("порядка нет — разбирается пустота, а не файл настроек");
  }

  /* ---- пустая строка на месте порядка: то же самое ------------------- */
  {
    const m = mirror();
    const counts = { asked: [], read: 0 };
    const got = await bootstrap.resolveOrderConfig(
      appThatWouldAnswer(counts),
      { RULES_ORDER: "   " },
      { orderConfigKey: "RULES_ORDER", parseOrderConfig: m.parse },
    );
    assert.deepStrictEqual(got, { parsed: "   " }, "пустая строка уходит в разбор как есть");
    assert.deepStrictEqual(counts.asked, [], "и здесь vault не спрашивается");
    ok("пустая строка на месте порядка не будит чтение файла");
  }

  /* ---- чего не хватает — отказ вслух, а не молчание ------------------ */
  {
    const m = mirror();
    await assert.rejects(
      () => bootstrap.resolveOrderConfig(null, {}, { parseOrderConfig: m.parse }),
      /orderConfigKey is required/,
      "без ключа порядка — отказ вслух",
    );
    await assert.rejects(
      () => bootstrap.resolveOrderConfig(null, {}, { orderConfigKey: "RULES_ORDER" }),
      /parseOrderConfig is required/,
      "без разбора — отказ вслух",
    );
    ok("недостающее объявляется отказом, а не тихим возвратом");
  }

  /* ---- положительный контроль к самой подделке ----------------------- */
  {
    const counts = { asked: [], read: 0 };
    const app = appThatWouldAnswer(counts);
    const af = app.vault.getAbstractFileByPath(".obsidian/plugins/inline-overhaul/data.json");
    const txt = await app.vault.read(af);
    assert.strictEqual(counts.asked.length, 1, "подделка и правда отвечает, когда её спрашивают");
    assert.ok(/fromFile/.test(txt), "и отдаёт порядок — то есть ноль выше получен не от её немоты");
    ok("контроль: подделка vault отвечает, если её спросить");
  }

  console.log("Order config resolve tests: OK (" + passed + " checks)");
}

run().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
