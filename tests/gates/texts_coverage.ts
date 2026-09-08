/**
 * Г25: всё ли, что человек видит в настройках, лежит в файле текстов.
 *
 * Заказ заказчика к K1 (2026-09-06): «я не хочу проверять вручную, так что
 * проверь автоматически, что этот `en.js` содержит все текстовые элементы,
 * которые встречаются в настройках (в т.ч. текст модальных окон и т.д.)».
 *
 * Гейт отвечает ровно на этот вопрос — **есть ли строка в файле**, — и не
 * отвечает на соседний: «спрашивает ли её то место, где она нарисована». На
 * второй отвечает пин `texts_catalog_tests.ts`, который запрещает литерал на
 * месте ключа (У-82).
 *
 * **Что осталось за каталогом — перечислено пофайлово, с числом и причиной.**
 * Молчаливого списка исключений тут быть не должно: он и есть тот способ, каким
 * «проверено автоматически» превращается в «проверено ничего». Число растёт —
 * гейт краснеет: значит, в блок дописали видимую строку мимо каталога.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { visibleTextsUnder } from "../harness/visible_texts.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

const { SCHEMA, TABS } = await import(pathToFileURL(
  path.join(root, "src", "ui", "settings", "schema", "index.ts")).href);
const { panelCatalog } = await import(pathToFileURL(
  path.join(root, "src", "ui", "settings", "texts_panel.ts")).href);

/**
 * Файлы, которые гейт не читает вовсе, — и почему.
 *
 * Это не «пока не дошли руки», а «здесь видимых строк нет по устройству».
 */
const NOT_READ: ReadonlyArray<{ match: RegExp; why: string }> = [
  {
    match: /^src\/ui\/settings\/schema\/(?!custom_texts\.ts$)/,
    why: "схема и есть английский дом текста: каталог выводится из неё",
  },
  {
    /*
     * Только машинерия каталога: шапка файла на диске и русский засев. Сами
     * таблицы текстов — `texts_dialogs.ts` и `texts_custom.ts` — гейт читает
     * наравне со всем прочим. Иначе строку можно было бы завести в таблице и
     * не подключить к каталогу, а гейт бы промолчал.
     */
    match: /^src\/ui\/settings\/texts(_files|_panel|_seed_ru)?\.ts$/,
    why: "машинерия каталога: шапка файла на диске, а не панель",
  },
  {
    match: /^src\/ui\/settings\/howto\.ts$/,
    why: "заметка-руководство в vault, а не панель: третий кусок каталога (В-67)",
  },
];

/**
 * Файлы, где видимые строки есть, а в каталоге их нет.
 *
 * Второй кусок (В-67, «тексты внутри редактора Fields и соседних блоков»)
 * закрыт 2026-09-06: двенадцать файлов ушли из этого списка целиком. То, что
 * осталось, — не «руки не дошли», а решения: имена команд не переводятся (Я2),
 * формат заметки копии читается плагином обратно, суффикс `sub` часть формата.
 * Число — сколько строк сейчас; вырастет — гейт скажет.
 */
const SECOND_CHUNK: ReadonlyArray<{ file: string; left: number; why: string }> = [
  {
    file: "src/ui/settings/schema/custom_texts.ts",
    left: 15,
    why: "имена команд: их показывает палитра Obsidian, и переводить их нельзя (Я2)",
  },
  {
    file: "src/features/settings_backup.js",
    left: 24,
    why: "формат заметки копии: плагин читает её обратно, и она остаётся английской",
  },
  {
    file: "src/ui/settings/custom/command_reference.ts",
    left: 4,
    why: "имена строк прототипа, по которым узнаются семьи команд: адрес, а не текст (Я2)",
  },
  {
    file: "src/ui/settings/custom/fields_model.ts",
    left: 3,
    why: "суффикс `sub` дочернего Field и шаблон строки выбора: часть формата, а не текст",
  },
  {
    file: "src/ui/settings/obsidian_tab.ts",
    left: 3,
    why: "две ошибки, которые бросаются исключением, и имя английского языка в запасном пути руководства (10.13.51): у английского своего файла нет и быть не должно",
  },
  {
    /*
     * Механизм перевода руководства (10.13.51). Строки здесь трёх видов, и ни
     * один не переводится — но по разным причинам, и причины стоит различать.
     *
     * 1. `guide` и `language` — **адреса, а не текст**. Первое имя папки,
     *    второе имя свойства, которое человек пишет в своём файле. Переведи мы
     *    `language` — и файл человека перестал бы опознаваться его же
     *    плагином. Тот же довод, по которому не переводятся имена команд (Я2).
     * 2. `English` — значение свойства в **английском образце**. Образец по
     *    определению английский: его копируют, чтобы завести перевод.
     * 3. Подсказка про копирование в шапке образца. Её читает тот, кто открыл
     *    английский файл, чтобы его перевести, — то есть человек, который в
     *    эту минуту читает английский текст. Перевести подсказку и оставить
     *    руководство английским значило бы соврать о том, что за файл перед
     *    ним. В заметку человека она при этом не уезжает: `guideBody` её
     *    снимает, и это закреплено пином.
     */
    file: "src/ui/settings/guide_files.ts",
    left: 8,
    why: "механизм перевода руководства: два адреса, имя английского и подсказка в шапке английского образца — переводу не подлежит ни один",
  },
  {
    file: "src/ui/settings/actions.ts",
    left: 1,
    why: "имя английского языка в запасном пути кнопки `Read`, когда шва руководства нет (10.13.51)",
  },
  {
    file: "src/ui/settings/describe.ts",
    left: 1,
    why: "прежние имена настройки: шов `previouslyCalled` есть, панель его пока не кормит",
  },
];

export interface CoverageResult {
  total: number;
  found: number;
  uncovered: number;
  problems: readonly string[];
  lines: readonly string[];
}

export function checkTextsCoverage(): CoverageResult {
  const entries = panelCatalog(SCHEMA, TABS) as ReadonlyArray<{ key: string; text: string }>;
  const covered = new Set(entries.map(e => e.text.trim()));

  const skip = (rel: string): boolean => NOT_READ.some(r => r.match.test(rel));
  const found = visibleTextsUnder(root, ["src/ui/settings", "src/features/settings_backup.js"], skip);
  const gap = found.filter(f => !covered.has(f.text.trim()));

  const byFile = new Map<string, number>();
  for (const f of gap) byFile.set(f.file, (byFile.get(f.file) || 0) + 1);

  const problems: string[] = [];
  const lines: string[] = [];

  for (const [file, n] of [...byFile.entries()].sort()) {
    const known = SECOND_CHUNK.find(r => r.file === file);
    if (!known) {
      const shown = gap.filter(f => f.file === file).slice(0, 3)
        .map(f => f.line + ": " + JSON.stringify(f.text).slice(0, 60)).join("; ");
      problems.push("Г25: видимая строка мимо каталога в " + file + " (" + n + "): " + shown);
      continue;
    }
    if (n > known.left) {
      problems.push("Г25: в " + file + " строк вне каталога стало " + n
        + ", было " + known.left + " — новую строку завели мимо каталога");
    } else if (n < known.left) {
      lines.push("Г25: в " + file + " осталось " + n + " (было " + known.left
        + ") — поправьте число в списке");
    }
  }
  for (const known of SECOND_CHUNK) {
    if (!byFile.has(known.file) && known.left > 0) {
      lines.push("Г25: " + known.file + " закрыт целиком — уберите его из списка");
    }
  }

  return { total: entries.length, found: found.length, uncovered: gap.length, problems, lines };
}

/** Список того, что осталось, — для документа и для отчёта человеку. */
export function secondChunkRows(): ReadonlyArray<{ file: string; left: number; why: string }> {
  return SECOND_CHUNK;
}

/* Запуск в одиночку: `node tests/gates/texts_coverage.ts`. */
if (process.argv[1] && fs.existsSync(process.argv[1])
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const r = checkTextsCoverage();
  console.log("строк в каталоге " + r.total + ", видимых строк в исходниках " + r.found
    + ", вне каталога " + r.uncovered);
  for (const line of r.lines) console.log("  " + line);
  for (const p of r.problems) console.log("  FAIL " + p);
  process.exit(r.problems.length ? 1 : 0);
}
