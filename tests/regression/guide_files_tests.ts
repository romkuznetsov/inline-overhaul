/**
 * Механизм перевода заметки-руководства (PRD 10.13.51, ответ на В-73).
 *
 * Заказано «не переводи, а реализуй механизм», поэтому и проверяется механизм,
 * а не текст: образец догоняет, перевод не трогается, заметка не
 * перезаписывается, и **перевод доезжает до заметки**.
 *
 * Последнее — та же вторая половина вопроса, что у каталога панели (У-82).
 * Без неё механизм может быть собран правильно во всех частях и не соединён:
 * файл лежит, свойство читается, а `Read` всё равно пишет английское.
 */

import assert from "node:assert/strict";

import {
  GUIDE_DEFAULT,
  GUIDE_LANG_PROP,
  ensureGuideFiles,
  guideBody,
  guideFile,
  guideLanguageName,
  guideNotePath,
  guidePathOf,
  guideTextFor,
  type GuideFiles,
} from "../../src/ui/settings/guide_files.ts";
import { HOWTO_PATH } from "../../src/ui/settings/howto.ts";
import { buildActions, type VaultSeam } from "../../src/ui/settings/actions.ts";

let passed = 0;
const ok = (label: string): void => { passed++; console.log("  ok " + label); };

const FOLDER = ".obsidian/plugins/inline-overhaul";
const ENGLISH = "## First steps\n\nPress the button.";

/** Папка плагина в памяти: пишем и читаем, как настоящий адаптер. */
function makeFiles(seed: Record<string, string> = {}): GuideFiles & {
  disk: Record<string, string>;
  written: string[];
} {
  const disk: Record<string, string> = { ...seed };
  const written: string[] = [];
  return {
    disk,
    written,
    exists: (p: string) => Object.prototype.hasOwnProperty.call(disk, p) || p === FOLDER + "/guide",
    read: (p: string) => {
      if (!Object.prototype.hasOwnProperty.call(disk, p)) throw new Error("нет файла: " + p);
      return disk[p] as string;
    },
    write: (p: string, data: string) => { disk[p] = data; written.push(p); },
    mkdir: () => {},
  };
}

/* ---- образец: кладётся, догоняет, лишний раз не пишется ----------------- */

{
  const files = makeFiles();
  const wrote = await ensureGuideFiles(files, FOLDER, ENGLISH);
  const path = guidePathOf(FOLDER, GUIDE_DEFAULT);
  assert.deepEqual(wrote, [path], "образец не положен при первом запуске");
  assert.ok(files.disk[path]?.includes(ENGLISH), "в образце нет текста руководства");
  assert.ok(files.disk[path]?.startsWith("---\n" + GUIDE_LANG_PROP + ": English"),
    "у образца нет свойства языка — человеку нечего менять при копировании");
  ok("первый запуск кладёт образец, и в нём есть свойство языка");
}

{
  const files = makeFiles();
  await ensureGuideFiles(files, FOLDER, ENGLISH);
  files.written.length = 0;
  await ensureGuideFiles(files, FOLDER, ENGLISH);
  assert.deepEqual(files.written, [], "образец переписан, хотя ничего не менялось");
  ok("совпавший образец не переписывается");
}

{
  const files = makeFiles();
  await ensureGuideFiles(files, FOLDER, ENGLISH);
  files.written.length = 0;
  await ensureGuideFiles(files, FOLDER, ENGLISH + "\n\n## And one more thing");
  assert.equal(files.written.length, 1, "образец не догнал переписанное руководство");
  assert.ok(files.disk[guidePathOf(FOLDER, GUIDE_DEFAULT)]?.includes("And one more thing"),
    "в образце осталось вчерашнее руководство");
  ok("образец догоняет, когда руководство переписали в коде");
}

/* ---- перевод: не трогается никогда -------------------------------------- */

{
  /*
   * Правило здесь **строже**, чем у каталога, и это сознательно (Г-5). У
   * каталога есть «файл, слово в слово равный написанному плагином, — всё ещё
   * его»: ключи сравнимы. У прозы такого сравнения нет, и какой абзац человек
   * перевёл, машине не видно. Поэтому перевод человеческий с первой минуты.
   */
  const mine = "---\n" + GUIDE_LANG_PROP + ": Русский\n---\n\nМой перевод, ещё не дописанный.";
  const path = guidePathOf(FOLDER, "ru");
  const files = makeFiles({ [path]: mine });

  await ensureGuideFiles(files, FOLDER, ENGLISH);
  await ensureGuideFiles(files, FOLDER, ENGLISH + "\n\n## Something new");

  assert.equal(files.disk[path], mine, "плагин тронул перевод человека");
  assert.deepEqual(files.written.filter(p => p === path), [], "плагин писал в файл перевода");
  ok("перевод не трогается ни при каком расхождении");
}

/* ---- свойство языка ------------------------------------------------------ */

{
  assert.equal(
    guideLanguageName("---\n" + GUIDE_LANG_PROP + ": Русский\n---\n\nтекст", "ru"),
    "Русский", "имя языка не прочиталось из свойства");
  assert.equal(
    guideLanguageName('---\n' + GUIDE_LANG_PROP + ': "Deutsch"\n---\n\ntext', "de"),
    "Deutsch", "кавычки вокруг значения не сняты");
  /*
   * Сломанный frontmatter не прячет перевод целиком — он лишь оставляет его
   * без подписи. Человек правит эти файлы руками, и «я перевёл, а плагин
   * делает вид, что файла нет» — худший ответ на его работу (Я1).
   */
  assert.equal(guideLanguageName("нет никакой шапки", "ru"), "ru",
    "сломанная шапка обязана дать язык, подписанный именем файла");
  assert.equal(guideLanguageName("---\nother: x\n---\n\nтекст", "ru"), "ru",
    "чужое свойство принято за имя языка");
  ok("свойство языка читается, а сломанная шапка не прячет перевод");
}

/* ---- какой текст берётся ------------------------------------------------- */

{
  const files = makeFiles();
  const got = await guideTextFor(files, FOLDER, "ru", ENGLISH);
  assert.equal(got.text, ENGLISH, "без перевода взят не английский из кода");
  assert.equal(got.lang, "en", "без перевода язык не английский");
  ok("перевода нет — берётся английский из кода, и это работа механизма, а не отказ");
}

{
  const body = "## Первые шаги\n\nНажмите кнопку.";
  const files = makeFiles({
    [guidePathOf(FOLDER, "ru")]: "---\n" + GUIDE_LANG_PROP + ": Русский\n---\n\n" + body,
  });
  const got = await guideTextFor(files, FOLDER, "ru", ENGLISH);
  assert.equal(got.text.trim(), body, "текст перевода не взят");
  assert.equal(got.name, "Русский", "имя языка не доехало");
  assert.ok(!got.text.includes(GUIDE_LANG_PROP + ":"), "шапка уехала в заметку человека");
  ok("перевод берётся, а служебная шапка в заметку не уезжает");
}

{
  /* Подсказка про копирование — наша, и в заметке человека ей не место. */
  const withHint = guideFile(ENGLISH);
  assert.ok(withHint.includes("%%"), "в образце нет подсказки про копирование");
  assert.ok(!guideBody(withHint).includes("%%"), "подсказка уехала бы в заметку");
  assert.equal(guideBody(withHint).trim(), ENGLISH.trim(), "тело руководства повреждено");
  ok("подсказка про копирование остаётся в образце и не уезжает в заметку");
}

/* ---- имя заметки: у каждого языка своя ----------------------------------- */

{
  assert.equal(guideNotePath(HOWTO_PATH, "en", "English"), HOWTO_PATH,
    "английская заметка сменила имя — у того, у кого она уже лежит, появилась бы вторая");
  assert.equal(guideNotePath(HOWTO_PATH, "ru", "Русский"), "inlineOverhaul Guide (Русский).md",
    "заметка перевода не получила своего имени");
  assert.equal(guideNotePath(HOWTO_PATH, "ru", "ru/RU"), "inlineOverhaul Guide (ru-RU).md",
    "символ, недопустимый в имени файла, приехал из свойства как есть");
  ok("у каждого языка своя заметка, и имя её пригодно для файловой системы");
}

/* ---- перевод доезжает до заметки ---------------------------------------- */

{
  /*
   * **Главное утверждение файла.** Всё выше проверяет части; здесь
   * проверяется, что они соединены: нажатие `Read` при выбранном языке кладёт
   * в vault текст перевода, а не английский из кода.
   */
  const made: Array<{ path: string; text: string }> = [];
  const opened: string[] = [];
  const disk = new Set<string>();
  const vault: VaultSeam = {
    exists: (p: string) => disk.has(p),
    create: (p: string, text: string) => { disk.add(p); made.push({ path: p, text }); },
    open: (p: string) => { opened.push(p); },
  };

  const russian = "## Первые шаги\n\nНажмите кнопку.\n";
  const actions = buildActions({
    notify: () => {},
    vault,
    guide: async () => ({ text: russian, lang: "ru", name: "Русский" }),
  });

  await actions["open-howto"]!();
  assert.equal(made.length, 1, "заметка не создана");
  assert.equal(made[0]?.path, "inlineOverhaul Guide (Русский).md",
    "заметка перевода создана не под своим именем");
  assert.equal(made[0]?.text, russian, "в заметку уехал не перевод");
  assert.deepEqual(opened, ["inlineOverhaul Guide (Русский).md"], "заметка не открыта");
  ok("перевод доезжает до заметки: `Read` пишет его, а не английский");

  /* И второе нажатие только открывает: заметка принадлежит человеку (Р-1). */
  made.length = 0;
  await actions["open-howto"]!();
  assert.deepEqual(made, [], "заметка перезаписана вторым нажатием");
  ok("второе нажатие только открывает — заметка не перезаписывается (Р-1)");
}

{
  /*
   * И то, ради чего у каждого языка своё имя: английская заметка, которая уже
   * лежит, **остаётся на месте**. При одном имени на все языки человек после
   * перевода получил бы её же — молча, и единственным выходом было бы снести
   * заметку вместе со своими пометками.
   */
  const made: Array<{ path: string; text: string }> = [];
  const opened: string[] = [];
  const disk = new Set<string>([HOWTO_PATH]);
  const vault: VaultSeam = {
    exists: (p: string) => disk.has(p),
    create: (p: string, text: string) => { disk.add(p); made.push({ path: p, text }); },
    open: (p: string) => { opened.push(p); },
  };
  const actions = buildActions({
    notify: () => {},
    vault,
    guide: async () => ({ text: "перевод", lang: "ru", name: "Русский" }),
  });

  await actions["open-howto"]!();
  assert.equal(made.length, 1, "заметка перевода не создана рядом с английской");
  assert.equal(made[0]?.path, "inlineOverhaul Guide (Русский).md", "создана не та заметка");
  assert.ok(disk.has(HOWTO_PATH), "английская заметка человека исчезла");
  ok("заметка перевода встаёт рядом с английской, а не поверх неё");
}

console.log("\n" + passed + " проверок пройдено");
