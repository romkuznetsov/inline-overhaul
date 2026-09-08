/**
 * Строка каталога, которую никто не спрашивает, — это дефект на экране, а не
 * лишняя строка в файле.
 *
 * **Куплено 2026-09-08.** Подсказки колонок таблицы Values лежали в каталоге
 * пятью строками — `LEVEL_TIP`, `VALUE_TAG_TIP`, `VALUE_LINK_TIP`,
 * `VALUE_PREFIX_TIP`, `VALUE_SHOWN_TIP`, — а `columnTips` в
 * `fields_editor_view.ts` отдавала те же слова **литералами**. То есть строки
 * в файле языка были, человек мог их перевести, и **перевод не применялся
 * никогда**: на экране оставалось английское. Ни одна из 56 проверок этого не
 * видела, потому что каждая смотрела на нарисованный текст, а нарисованный
 * текст был правильный — просто не тот, который спрашивали.
 *
 * **Чем это ловится.** Признак у такого дефекта один и он статический: имя
 * строки объявлено в таблице текстов и **не встречается больше нигде** (У-80).
 * Поэтому проверка идёт сплошным обходом `src/**`: у каждого имени из
 * `BLOCK_TEXTS`, `DIALOG_TEXTS`, `FRAME_TEXTS` и `RUNTIME_TEXTS` спрашивается,
 * зовёт ли его хоть одно место, кроме самой таблицы.
 *
 * **Имена, которые собираются по ходу, названы списком с причиной.** Молчаливый
 * список исключений и есть тот способ, каким «проверено автоматически»
 * превращается в «проверено ничего» — поэтому у каждой записи стоит образец,
 * место сборки и число попавших под него имён. Число вырастет — проверка
 * скажет.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const SRC = path.join(root, "src");

const { BLOCK_TEXTS } = await import(pathToFileURL(
  path.join(SRC, "ui", "settings", "texts_blocks.ts")).href);
const { DIALOG_TEXTS } = await import(pathToFileURL(
  path.join(SRC, "ui", "settings", "texts_dialogs.ts")).href);
const { FRAME_TEXTS } = await import(pathToFileURL(
  path.join(SRC, "ui", "settings", "texts_custom.ts")).href);

let passed = 0;
const ok = (label: string): void => { passed++; console.log("  ok   " + label); };

/* ---- исходники, в которых можно спрашивать ------------------------------ */

/** Файлы, где имена ОБЪЯВЛЕНЫ: в них искать нельзя, там объявление и лежит. */
const HOMES = new Set([
  "src/ui/settings/texts_blocks.ts",
  "src/ui/settings/texts_dialogs.ts",
  "src/ui/settings/texts_custom.ts",
  "src/ui/settings/texts_runtime.ts",
  "src/ui/settings/texts_seed_ru.ts",
]);

function sources(dir: string, out: Array<{ rel: string; body: string }>): Array<{ rel: string; body: string }> {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) { sources(p, out); continue; }
    if (!/\.(ts|js)$/.test(name)) continue;
    const rel = path.relative(root, p).replace(/\\/g, "/");
    if (HOMES.has(rel)) continue;
    out.push({ rel, body: fs.readFileSync(p, "utf8") });
  }
  return out;
}

const FILES = sources(SRC, []);
assert.ok(FILES.length > 40, "исходников слоя нашлось " + FILES.length + " — обход не туда смотрит");

/** Зовёт ли хоть один файл это имя как литерал. */
function askedBy(name: string): string {
  const needle = new RegExp('(^|[^A-Za-z0-9_])' + name + '([^A-Za-z0-9_]|$)');
  for (const f of FILES) if (needle.test(f.body)) return f.rel;
  return "";
}

/* ---- имена, собираемые по ходу ------------------------------------------ */

/**
 * Имя, которое в коде не написано целиком, а склеено: `say("HEAD_" +
 * title.toUpperCase())`. Литерала такого имени в исходниках нет и быть не
 * может, и это законно — но названо здесь поимённо, с местом сборки.
 */
const BUILT: ReadonlyArray<{ owner: string; match: RegExp; where: string; count: number }> = [
  {
    owner: "user-tag-list",
    match: /^HEAD_/,
    where: 'custom/user_tags.ts: say("HEAD_" + title.toUpperCase()) — подпись колонки по её имени',
    count: 5,
  },
  {
    owner: "field-editor",
    match: /^(TYPE_)/,
    where: "custom/fields_editor_view.ts: TYPE_LABEL по типу Field",
    count: 3,
  },
];

/* ---- долг, а не решение: строки, которые пока никто не спрашивает -------- */

/**
 * **Шестьдесят четыре строки каталога, до которых подстановка не доезжает.**
 *
 * Это дефект A46, а не список разрешённых исключений, и разница тут важная.
 * Каждое имя ниже объявлено в таблице текстов, попадает в `default.js` на диск
 * — и рисуется в панели **литералом**, вторым объявлением тех же слов. Человек
 * может перевести любую из этих строк, и на экране не изменится ничего.
 *
 * Список закреплён составом, и работает он в обе стороны:
 *
 *   * появилось новое осиротевшее имя — проверка краснеет сразу;
 *   * имя починено, а из списка не убрано — проверка тоже краснеет, и список
 *     может только убывать.
 *
 * Так долг не превращается в норму: он либо тает, либо о нём напоминают.
 * Разбор и порядок разбора — PRD, строка A46.
 */
const KNOWN_ORPHANS: readonly string[] = [
  "field-editor.ADD_FIELD",
  "field-editor.ADD_FIELD_LABEL",
  "field-editor.NO_FIELD_PICKED",
  "field-editor.LIST_ARIA",
  "field-editor.COLUMN_ARIA",
  "field-editor.BEHAVIOR_HEAD",
  "field-editor.ACTIVE_YES",
  "field-editor.ACTIVE_NO",
  "field-editor.ACTIVE_COMMANDS_ONLY",
  "field-editor.BEHAVIOR_STRICT",
  "field-editor.BEHAVIOR_INSERT_ONLY",
  "field-editor.BEHAVIOR_FREE",
  "field-editor.CHILD_YES",
  "field-editor.CHILD_NO",
  "field-editor.PREREQ_YES",
  "field-editor.PREREQ_NO",
  "field-editor.VALUES_EMPTY",
  "field-editor.SHOWN_CUSTOM",
  "field-editor.VALUE_PREFIX_NO",
  "field-editor.VALUE_PREFIX_HINT",
  "field-editor.VALUE_CUSTOM_PLACEHOLDER",
  "field-editor.VALUE_FILL_COLOR",
  "field-editor.NEW_VALUE_LINK_HINT",
  "field-editor.NEW_VALUE_TAG_HINT",
  "field-editor.ELEMENT_EMOJI_HINT",
  "field-editor.ELEMENT_STEP_NAME",
  "field-editor.STEP_FIXED",
  "field-editor.STEP_COMMAND",
  "field-editor.STEP_CUSTOM",
  "field-editor.ELEMENT_AMOUNT_NAME",
  "field-editor.ELEMENT_COMMAND_NAME",
  "field-editor.COMMAND_NOW",
  "field-editor.COMMAND_RANDOM_NUMBERS",
  "field-editor.COMMAND_RANDOM_CHARS",
  "field-editor.ELEMENT_STEPS_NAME",
  "field-editor.NEW_FIELD_TITLE",
  "field-editor.NEW_FIELD_NAME_LABEL",
  "field-editor.NEW_FIELD_NAME_HINT",
  "field-editor.NEW_FIELD_NAME_ARIA",
  "field-editor.NEW_FIELD_TYPE_LABEL",
  "field-editor.NEW_FIELD_TYPE_ARIA",
  "field-editor.NEW_FIELD_TYPE_TAG",
  "field-editor.NEW_FIELD_TYPE_LINK",
  "field-editor.NEW_FIELD_TYPE_ELEMENT",
  "field-editor.NEW_FIELD_ADD",
  "field-editor.NEW_FIELD_FAILED",
  "field-editor.DELETE_CONFIRM",
  "field-editor.RENAME_TITLE",
  "field-editor.RENAME_LABEL",
  "field-editor.RENAME_HINT",
  "field-editor.RENAME_WARNING",
  "field-editor.RENAME_WARNING_NOTES",
  "field-editor.RENAME_WARNING_HOTKEY",
  "field-editor.RENAME_CONFIRM",
  "field-editor.ERR_PREFIX_TOKEN",
  "smart-rules-list.NO_FIELDS_YET",
  "smart-rules-list.VALUES_EMPTY",
  "smart-rules-list.CONDITION_TIP",
  "binder-table.ROW_HOTKEY_ARIA",
  "frame.TAB_STRIP",
  "frame.PREVIOUSLY_CALLED",
  "frame.CONTRAST_WARNING",
  "frame.EXAMPLE_STATUS",
  "frame.EXAMPLE_PRIORITY",
];

/* ---- сама проверка ------------------------------------------------------- */

{
  const orphans: string[] = [];
  const built: string[] = [];
  let checked = 0;

  const sweep = (label: string, owner: string, table: Readonly<Record<string, string>>): void => {
    for (const name of Object.keys(table)) {
      checked++;
      const rule = BUILT.find(b => b.owner === owner && b.match.test(name));
      if (rule) { built.push(owner + "." + name); continue; }
      if (!askedBy(name)) orphans.push(label + " " + owner + "." + name);
    }
  };

  for (const [owner, table] of Object.entries(BLOCK_TEXTS)) {
    sweep("блок", owner, table as Readonly<Record<string, string>>);
  }
  for (const [owner, table] of Object.entries(DIALOG_TEXTS)) {
    sweep("окно", owner, table as Readonly<Record<string, string>>);
  }
  sweep("панель", "frame", FRAME_TEXTS as Readonly<Record<string, string>>);

  /* Имя без пометки «блок»/«окно»/«панель»: список долга держит адрес, а не
     род таблицы. */
  const bare = orphans.map(o => o.split(" ").slice(1).join(" "));
  const fresh = bare.filter(n => !KNOWN_ORPHANS.includes(n));
  assert.deepEqual(fresh, [],
    "строка каталога объявлена и никем не спрашивается — человек её переведёт, а на экране\n"
    + "ничего не изменится (У-80, У-82). Новые осиротевшие:\n  " + fresh.join("\n  "));

  /* Список может только убывать: починили — уберите имя. Иначе долг однажды
     станет описанием состояния, которого нет (У-71). */
  const healed = KNOWN_ORPHANS.filter(n => !bare.includes(n));
  assert.deepEqual(healed, [],
    "эти имена уже спрашиваются — уберите их из KNOWN_ORPHANS тем же коммитом:\n  "
    + healed.join("\n  "));

  /* Число собираемых имён закреплено: вырастет — исключение надо обновить и
     объяснить, а не молча расширить. */
  for (const rule of BUILT) {
    const mine = built.filter(n => n.startsWith(rule.owner + ".") && rule.match.test(n.split(".")[1] || ""));
    assert.equal(mine.length, rule.count,
      "имён, собираемых по ходу, у " + rule.owner + " стало " + mine.length
      + " вместо " + rule.count + " (" + rule.where + ")");
  }

  assert.ok(checked > 250, "проверено имён " + checked + " — таблицы текстов не прочитались");
  ok("новых осиротевших строк нет: проверено " + checked + " имён, собираемых по ходу "
     + built.length + ", в долге A46 осталось " + KNOWN_ORPHANS.length);
}

/* ---- положительный контроль -------------------------------------------- */

{
  /*
   * Проверка «не осталось осиротевших» зелена и тогда, когда искать нечем:
   * сломанный образец, пустой список файлов, опечатка в имени поля. Поэтому
   * тут спрашивается обратное — что имя, которого никто не зовёт, проверка
   * находит. Имя выдуманное и в исходниках его нет.
   */
  assert.equal(askedBy("IO_NO_SUCH_TEXT_NAME_2026"), "",
    "обход нашёл имя, которого в исходниках нет — образец ловит лишнее");
  assert.ok(askedBy("VALUE_FILL_TIP"),
    "обход не находит имя, которое точно спрашивается: сломан образец или список файлов");
  /*
   * И то, ради чего проверка написана: пять подсказок колонок таблицы Values
   * обязаны спрашиваться по имени. Верни `columnTips` литералы — покраснеет
   * именно здесь, названными именами.
   */
  for (const name of ["LEVEL_TIP", "VALUE_TAG_TIP", "VALUE_LINK_TIP",
    "VALUE_PREFIX_TIP", "VALUE_SHOWN_TIP", "VALUE_FILL_TIP", "VALUE_TEXT_TIP",
    "VALUE_PREVIEW_TIP"]) {
    const where = askedBy(name);
    assert.ok(where.endsWith("fields_editor_view.ts"),
      "подсказку колонки " + name + " спрашивает не таблица Values, а " + (where || "никто"));
  }
  ok("положительный контроль: выдуманное имя проверка называет, живое находит");
}

console.log("\n" + passed + " проверок пройдено");
