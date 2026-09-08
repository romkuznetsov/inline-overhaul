/**
 * Служебный файл правил не переписывается без нужды (Д-1 разбора готовности).
 *
 * **Что было.** `buildTagWheelRulesMarkdownFromConfig` клал в блок
 * `tagwheel-meta` отметку времени сборки, а `plugin_bootstrap` зовёт запись в
 * `onload` безусловно. Значит файл внутри `.obsidian/plugins/inline-overhaul/`
 * менялся при **каждом** запуске Obsidian на каждом устройстве. Платил за это
 * человек: Obsidian Sync, git и любая папочная синхронизация видели правку на
 * ровном месте, а с двумя устройствами это конфликт.
 *
 * **Починка из двух половин, и по отдельности ни одна не работает.** Снять
 * отметку времени — чтобы у одного конфига был один и тот же текст; читать
 * файл перед записью — чтобы этот текст не писался второй раз. Первую половину
 * стережёт `rules_document_roundtrip_tests.ts` (две сборки одного конфига
 * равны посимвольно), вторую — этот файл.
 *
 * **Проверяется поведение оркестратора, а не плагина.** Ему отдаются швы:
 * конфиг, сборка текста, чтение и запись. Это тот же способ, каким его зовёт
 * `generated_rules.js`, — подделан здесь только диск, и он назван (У-1).
 */

import assert from "node:assert/strict";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const nodeRequire = Module.createRequire(import.meta.url);
const orch = nodeRequire(path.join(root, "src", "features", "rules_sync_orchestrator.js"));

let passed = 0;
const ok = (label: string): void => { passed++; console.log("  ok   " + label); };

/** Диск на одну запись: что прочитали, что записали, сколько раз. */
function disk(start: string | null) {
  const writes: Array<{ path: string; text: string }> = [];
  const reads: string[] = [];
  let stored = start;
  return {
    writes, reads,
    get stored() { return stored; },
    readText: async (p: string) => {
      reads.push(p);
      if (stored === null) throw new Error("ENOENT " + p);
      return stored;
    },
    writeText: async (p: string, text: string) => {
      writes.push({ path: p, text });
      stored = text;
    },
  };
}

const PATH = ".obsidian/plugins/inline-overhaul/generated_rules.md";
const CFG = { pkm: {}, advanced: { generatedRulesPath: PATH } } as Any;

/** Оркестратору всё приходит швами — здесь они и собираются. */
function ctxFor(d: ReturnType<typeof disk>, text: string, extra?: Any) {
  const notices: string[] = [];
  const ctx = {
    getConfig: () => CFG,
    defaultGeneratedRulesPath: PATH,
    buildRulesMarkdown: () => text,
    readText: d.readText,
    writeText: d.writeText,
    notice: (m: string) => { notices.push(m); },
    ...(extra || {}),
  };
  return { ctx, notices };
}

/* ---- 1: тот же текст — записи нет -------------------------------------- */

{
  const d = disk("правила, версия первая");
  const { ctx } = ctxFor(d, "правила, версия первая");
  await orch.ensureGeneratedRulesNow(ctx, "onload");
  assert.deepEqual(d.writes, [],
    "файл переписан, хотя в нём уже лежало то же самое: " + JSON.stringify(d.writes));
  assert.deepEqual(d.reads, [PATH], "и прочитан ровно один раз, по тому же пути");
  ok("Д-1: содержимое совпало — записи нет");
}

/* ---- 2: положительный контроль — текст другой, запись есть -------------- */

{
  /*
   * Без этой проверки первая была бы зелёной и от того, что запись не
   * работает вовсе: «не писать» лучше всех выполняет тот, кто не пишет
   * никогда (У-88). Здесь спрашивается обратное.
   */
  const d = disk("правила, версия первая");
  const { ctx } = ctxFor(d, "правила, версия вторая");
  await orch.ensureGeneratedRulesNow(ctx, "onload");
  assert.equal(d.writes.length, 1, "изменившиеся правила обязаны дойти до диска");
  assert.equal(d.writes[0]?.text, "правила, версия вторая", "и дойти целиком");
  assert.equal(d.stored, "правила, версия вторая", "на диске теперь новое");
  ok("положительный контроль: изменившийся текст записывается");
}

/* ---- 3: файла нет — запись есть ---------------------------------------- */

{
  /*
   * Первый запуск в свежем vault: читать нечего, и отказ чтения не имеет
   * права отменить запись. Иначе движки PKM остались бы без правил вовсе, и
   * это был бы дефект дороже того, который чинится.
   */
  const d = disk(null);
  const { ctx } = ctxFor(d, "правила");
  await orch.ensureGeneratedRulesNow(ctx, "onload");
  assert.equal(d.writes.length, 1, "файла не было — он обязан появиться");
  ok("файла нет: чтение отказало, запись прошла");
}

/* ---- 4: шва чтения нет вовсе — запись есть ----------------------------- */

{
  /*
   * Обвязка, у которой `readText` не задан, и старые вызывающие места. Ответ
   * тот же: сравнивать не с чем, значит пишем. Проверяется явно, потому что
   * это единственная ветка, где нового кода не выполняется ни строки.
   */
  const d = disk("что-то");
  const { ctx } = ctxFor(d, "что-то");
  const noRead = { ...ctx, readText: undefined };
  await orch.ensureGeneratedRulesNow(noRead as Any, "onload");
  assert.equal(d.writes.length, 1, "без шва чтения запись обязана идти как раньше");
  assert.deepEqual(d.reads, [], "и читать никто не пытался");
  ok("шва чтения нет: поведение прежнее");
}

/* ---- 5: ручная пересборка говорит человеку в обоих случаях -------------- */

{
  /*
   * Кнопку пересборки человек нажал сам, и молчание он читает как «не
   * сработало». Сообщение обязано быть и тогда, когда на диске уже всё верно:
   * оно про «правила на месте», а не про то, что диск изменился (У-80).
   */
  const same = disk("правила");
  const a = ctxFor(same, "правила");
  await orch.ensureGeneratedRulesNow(a.ctx, "manual");
  assert.equal(same.writes.length, 0, "ручной вызов тоже не пишет лишнего");
  assert.equal(a.notices.length, 1, "и всё равно отвечает человеку");

  const changed = disk("правила");
  const b = ctxFor(changed, "правила другие");
  await orch.ensureGeneratedRulesNow(b.ctx, "manual");
  assert.equal(changed.writes.length, 1, "а изменившиеся — пишет");
  assert.equal(b.notices.length, 1, "и тоже отвечает");

  const quiet = disk("правила");
  const c = ctxFor(quiet, "правила");
  await orch.ensureGeneratedRulesNow(c.ctx, "onload");
  assert.deepEqual(c.notices, [], "а при загрузке не говорит ничего — это не его дело");
  ok("ручная пересборка отвечает человеку в обоих случаях, загрузка молчит");
}

/* ---- 6: пустой путь по-прежнему падает --------------------------------- */

{
  /*
   * Ветка, которую легко потерять при правке: пустой путь — это не «нечего
   * писать», а поломанный конфиг, и он обязан быть слышен. Проверяется, что
   * чтение перед записью её не проглотило.
   */
  const d = disk(null);
  const { ctx } = ctxFor(d, "правила", {
    getConfig: () => ({ pkm: {}, advanced: { generatedRulesPath: "" } }),
    defaultGeneratedRulesPath: "",
  });
  let threw = "";
  try { await orch.ensureGeneratedRulesNow(ctx, "onload"); } catch (e) { threw = String((e as Error).message || e); }
  assert.match(threw, /Generated rules path is empty/, "пустой путь обязан падать громко");
  assert.deepEqual(d.reads, [], "и падать до чтения, а не после");
  ok("пустой путь: падение осталось на месте");
}

console.log("\n" + passed + " проверок пройдено");
