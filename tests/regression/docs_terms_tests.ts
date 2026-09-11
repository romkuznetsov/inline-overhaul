/**
 * `README.md` и `instructions.md` против панели (PRD фаза 5.1, пункт 2).
 *
 * **Зачем проверка, а не вычитка.** Документы разошлись с панелью не потому, что
 * их плохо написали, а потому, что панель менялась семь фаз, а документы —
 * никогда. Вычитка это исправит один раз; проверка не даст разойтись снова.
 *
 * Проверяется три вещи, и все три — механические:
 *
 *   1. **Удалённых контролов в документах нет.** `Flush Settings Now`,
 *      `Execution Backend`, `Active Rules Path`, `YAML note format` и кнопка
 *      `Undo last settings change` убраны из панели (Р7, раздел 9). Документ,
 *      который их называет, посылает человека искать то, чего нет.
 *   2. **Старых имён команд нет.** Все команды переименованы в фазе 2, пункты
 *      8–9. Имя из документа обязано находиться в списке команд Obsidian, иначе
 *      человек не найдёт ни команду, ни место, где ей назначить клавишу.
 *   3. **Имена вкладок и терминов — те, что в панели** (6.1 и 7.3).
 *
 * **Секции про переименования — исключение, и это их работа.** В левой колонке
 * таблицы 7.3 стоят как раз старые имена: она объясняет, что во что
 * превратилось. Поэтому `## Glossary` в руководстве и `## Terms` в README
 * исключены целиком, и других исключений нет.
 *
 * `showcase.md` не проверяется вовсе: его текст и гифки — материал заказчика, а
 * отчёт о разошедшихся записях в нём намеренно называет старые имена.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { TABS } from "../../src/ui/settings/schema/index.ts";
import { howtoMarkdown } from "../../src/ui/settings/howto.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = createRequire(import.meta.url);
const ids = requireCjs(path.join(root, "src", "features", "command_ids.js")) as Any;

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/**
 * Документ без секций, которые объясняют переименования: `## Glossary` в
 * руководстве и `## Terms` в README. Старые имена в них — содержание секции, а
 * не недосмотр. Других исключений нет.
 */
function readDoc(name: string): string {
  let text = fs.readFileSync(path.join(root, name), "utf8");
  for (const heading of ["## Glossary", "## Terms"]) {
    const from = text.indexOf(heading);
    if (from < 0) continue;
    const to = text.indexOf("\n## ", from + 4);
    text = text.slice(0, from) + (to < 0 ? "" : text.slice(to));
  }
  return text;
}

/*
 * Документов плагина три, и запреты терминологии одинаковы для всех:
 * снятый контрол и старое имя команды посылают человека в пустоту откуда
 * угодно. `FEATURES.md` добавлен 2026-09-11.
 */
const DOCS = ["README.md", "instructions.md", "FEATURES.md"];

/*
 * А вот два требования ниже — только к руководствам: версия Obsidian и
 * ссылка на карту старых и новых ID. Лист возможностей рассказывает, что
 * плагин умеет, а не как его ставить, и требовать от него того же значило
 * бы завести ему чужую работу.
 */
const GUIDES = ["README.md", "instructions.md"];

/* ---- удалённые контролы ------------------------------------------------- */

{
  /**
   * Каждая запись — имя, убранное из панели, и решение, которым убрано.
   * Список закрытый: уберут ещё один контрол — впишут сюда, и проверка сама
   * найдёт документы, которые о нём ещё говорят.
   */
  const REMOVED: Array<[string, string]> = [
    ["Flush Settings Now", "Р7: сохранение автоматическое"],
    ["Execution Backend", "Р7: единственное значение"],
    ["Active Rules Path", "9.24: путь остался внутренним"],
    ["YAML note format", "10.2: заменено правилом Raw/Clean у каждого Value"],
    /* `Undo last settings change` в этот список НЕ входит: Р7 убрал кнопку с
       такой подписью, но имя команды прототип не менял, и оно осталось тем
       же. Запрет фразы запретил бы руководству назвать живую команду. */
    /* Конфиг-заметка и блок служебного файла сняты 2026-09-03 решениями
       В-28 и В-29 (PRD 10.12). Документ, который их называет, посылает
       человека нажимать то, чего нет. */
    ["Config note", "10.12: заметка снята решением В-28"],
    ["Generated files", "10.12: блок снят решением В-29"],
    ["Apply config note", "10.12: команда снята вместе с заметкой"],
    ["Open config template", "10.12: команда снята вместе с заметкой"],
    ["Template note", "10.12: шаблон снят вместе с заметкой"],
    ["Config Export Mode", "10.12: подробность заметки снята вместе с ней"],
    ["Show Info & Tips", "Ф15: тумблеры вида удалены"],
    ["Show DeepEditor", "Ф15: тумблеры вида удалены"],
    ["Show Color Settings", "Ф15: тумблеры вида удалены"],
    /* Переименование, а не снятие: тумблер жив и называется `Smart backspace`
       (заказчик 2026-09-05, 10.13.32 Д11). Старое имя запрещено, потому что
       оно ещё и врёт про устройство — «то же самое» читается как «вместе с
       `Smart Delete`», а клавиши теперь включаются врозь. Запрет снимается,
       только если заказчик вернёт прежнюю подпись. */
    ["Do the same on Backspace", "10.13.32 Д11: тумблер переименован в Smart backspace"],
    /* Команда, а не контрол, но посылает человека ровно так же — в пустоту:
       её больше нет в палитре Obsidian. Снята 2026-09-06 вместе с вызовом
       `app.setting.open()` (T8, фаза 6 пункт 5). Обратно не возвращается
       решением 7.2, поэтому запись здесь постоянная, а не до следующей фазы. */
    ["Open settings", "фаза 6 пункт 5: команда снята вместе с app.setting.open() (T8)"],
  ];

  /*
   * Заметка-руководство проверяется этим же списком, и список остаётся один
   * (У-32). Это третий документ плагина, и снятый контрол в нём посылает
   * человека ровно туда же, куда из README. Своего запрета у руководства был
   * свой список, и он успел устареть: он запрещал называть плавающую кнопку
   * через четверо суток после того, как она заработала.
   */
  const hitsIn = (src: Array<[string, string]>): string[] => {
    const out: string[] = [];
    for (const [doc, text] of src) {
      for (const [name, why] of REMOVED) {
        if (text.includes(name)) out.push(doc + ": «" + name + "» — " + why);
      }
    }
    return out;
  };
  const sources: Array<[string, string]> = DOCS.map(
    doc => [doc, readDoc(doc)] as [string, string],
  );
  sources.push(["заметка-руководство", howtoMarkdown()]);

  /*
   * Контроль до вывода (У-127, У-88). Запрет зелен двумя способами: снятых
   * контролов в документах нет — это работа, — и искать было нечем: список
   * опустел или документ прочитался пустым. Второе отличается от первого
   * только образцом, на котором запрет обязан краснеть.
   */
  assert.ok(REMOVED.length >= 10,
    "положительный контроль: список снятых контролов опустел, запрещать нечего");
  assert.strictEqual(hitsIn([["образец", "строка про " + String(REMOVED[0] && REMOVED[0][0]) + " внутри"]]).length, 1,
    "положительный контроль: запрет не видит снятый контрол в образце");
  assert.strictEqual(sources.length, DOCS.length + 1,
    "положительный контроль: прочитаны не все документы");
  for (const [doc, text] of sources) {
    assert.ok(text.length > 500,
      "положительный контроль: документ прочитан пустым, искать в нём нечего: " + doc);
  }

  const found = hitsIn(sources);
  assert.deepEqual(found, [],
    "документ называет контрол, которого в панели нет:\n  " + found.join("\n  "));
  ok("удалённых контролов в документах и в руководстве не осталось");
}

/* ---- старые имена команд ------------------------------------------------ */

{
  /**
   * Старые имена команд. Список замороженный: команды переименованы в фазе 2,
   * пункты 8–9, и новых старых имён больше не появится.
   *
   * Перечислены поимённо, а не пойманы приставкой модуля: приставка ловит и
   * обычный заголовок с двоеточием («Transform: a line becomes a note»), и
   * первая версия проверки на этом и споткнулась.
   */
  const OLD_NAMES = [
    "General: Open settings",
    "General: Undo last settings change",
    "General: Toggle",
    "Navigation: Move Up",
    "Navigation: Move Down",
    "Navigation: Move Left",
    "Navigation: Move Right",
    "Navigation: Jump Header",
    "Navigation: Inline Left",
    "Navigation: Inline Right",
    "PKM: TagWheel left",
    "PKM: TagWheel right",
    "Config: Apply TagWheel config",
    "Config: Open TagWheel template",
    "Transform: inline2note",
    "Binder: Smart bracket",
    "Enhanced Mod+A",
    "Enhanced Ctrl+A",
  ];
  const hitsIn = (src: Array<[string, string]>): string[] => {
    const out: string[] = [];
    for (const [doc, text] of src) {
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = String(lines[i] || "");
        for (const name of OLD_NAMES) {
          if (line.includes(name)) out.push(doc + ":" + (i + 1) + " «" + name + "»");
        }
      }
    }
    return out;
  };
  const sources: Array<[string, string]> = DOCS.map(
    doc => [doc, readDoc(doc)] as [string, string],
  );

  /* Образец, на котором запрет обязан краснеть (У-127). */
  assert.ok(OLD_NAMES.length >= 10,
    "положительный контроль: список старых имён опустел, запрещать нечего");
  assert.strictEqual(hitsIn([["образец", "команда " + OLD_NAMES[0] + " в строке"]]).length, 1,
    "положительный контроль: запрет не видит старое имя команды в образце");
  for (const [doc, text] of sources) {
    assert.ok(text.length > 500,
      "положительный контроль: документ прочитан пустым: " + doc);
  }

  const found = hitsIn(sources);
  assert.deepEqual(found, [],
    "документ называет команду её старым именем (T6, фаза 2 пункты 8–9):\n  " + found.join("\n  "));
  ok("старых имён команд в документах не осталось");
}

{
  /* И старой формы идентификатора тоже: в UI и в документах её быть не должно. */
  const LEGACY_ID = /inlineOverhaul_/;
  assert.ok(LEGACY_ID.test("id: inlineOverhaul_PKM_next"),
    "положительный контроль: образец со старой формой идентификатора не опознан");
  const found: string[] = [];
  for (const doc of DOCS) {
    const text = readDoc(doc);
    assert.ok(text.length > 500, "положительный контроль: документ прочитан пустым: " + doc);
    if (LEGACY_ID.test(text)) found.push(doc);
  }
  assert.deepEqual(found, [], "документ называет старый идентификатор команды: " + found.join(", "));
  ok("старой формы идентификатора команды в документах нет");
}

{
  /*
   * Обратная сторона: имя команды, названное в документе, обязано существовать.
   * Проверяются имена фиксированных команд — те, что не собираются из данных.
   */
  const names = Object.keys(ids.NAMES).map(id => String(ids.commandName(id)));
  /* Исключений здесь нет: `Open settings` снята 2026-09-06 (T8, фаза 6 пункт
     5), и вместе с ней снято исключение. Каждая живая команда обязана быть
     названа в руководстве своим нынешним именем. */
  /*
   * Порог до сравнения: спрашивать надо у непустого списка. Пустой `NAMES`
   * даёт пустой `missing`, и «каждая команда названа» становится правдой,
   * которую никто не проверял (У-88).
   */
  assert.ok(names.length >= 10,
    "положительный контроль: команд в реестре " + names.length + " — спрашивать не у чего");
  const missing = names.filter(name => !DOCS.some(doc => readDoc(doc).includes(name)));
  assert.deepEqual(missing, [],
    "эти команды существуют, а руководство о них молчит:\n  " + missing.join("\n  "));
  ok("каждая команда названа в руководстве своим нынешним именем");
}

/* ---- вкладки и терминология --------------------------------------------- */

{
  /* Имена областей — из схемы, а не из памяти. */
  const titles = (TABS as Any[]).map(t => String(t.label));
  assert.ok(titles.length >= 7,
    "положительный контроль: областей в схеме " + titles.length + " — спрашивать не у чего");
  const missing = titles.filter(title => !readDoc("instructions.md").includes(title));
  assert.deepEqual(missing, [],
    "руководство не называет область панели: " + missing.join(", "));

  const STALE_TABS = ["Tag & PKM", "→ Main", "→ Global", "→ Behavior", "Hotkeys → Binder"];
  const staleIn = (src: Array<[string, string]>): string[] => {
    const out: string[] = [];
    for (const [doc, text] of src) {
      for (const stale of STALE_TABS) if (text.includes(stale)) out.push(doc + ": «" + stale + "»");
    }
    return out;
  };
  assert.strictEqual(staleIn([["образец", "вкладка " + STALE_TABS[0] + " здесь"]]).length, 1,
    "положительный контроль: запрет не видит снятую вкладку в образце");
  const found = staleIn(DOCS.map(doc => [doc, readDoc(doc)] as [string, string]));
  assert.deepEqual(found, [],
    "документ называет вкладку или подвкладку, которых нет (Р5, 6.1):\n  " + found.join("\n  "));
  ok("области названы так же, как в панели, и подвкладок в документах нет");
}

{
  /* Внутренние термины, переименованные в 7.3, из документов ушли. */
  const RENAMED: Array<[string, string]> = [
    ["Deep Editor", "правая колонка редактора Fields"],
    ["Hierarchy Strip", "Tag Bars"],
    ["Flying button", "Floating button"],
    ["Prefix Resolver", "Prefix priority"],
    ["Free roam", "placement modes"],
    ["free roam", "placement modes"],
    ["Inline2Note", "Transform inline to note"],
  ];
  const renamedIn = (src: Array<[string, string]>): string[] => {
    const out: string[] = [];
    for (const [doc, text] of src) {
      for (const [stale, now] of RENAMED) {
        if (text.includes(stale)) out.push(doc + ": «" + stale + "» → " + now);
      }
    }
    return out;
  };
  assert.strictEqual(renamedIn([["образец", "термин " + String(RENAMED[0] && RENAMED[0][0]) + " здесь"]]).length, 1,
    "положительный контроль: запрет не видит внутренний термин в образце");
  const found = renamedIn(DOCS.map(doc => [doc, readDoc(doc)] as [string, string]));
  assert.deepEqual(found, [],
    "документ пользуется внутренним термином вместо имени из 7.3:\n  " + found.join("\n  "));
  ok("внутренних терминов 7.3 в документах не осталось");
}

/* ---- требуемая версия Obsidian и глоссарий ------------------------------ */

{
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")) as Any;
  const min = String(manifest.minAppVersion || "");
  assert.ok(min, "в манифесте нет minAppVersion");
  for (const doc of DOCS) {
    const text = fs.readFileSync(path.join(root, doc), "utf8");
    assert.ok(text.includes(min),
      doc + " не называет требуемую версию Obsidian " + min + " (фаза 5.1, пункт 2)");
  }
  ok("требуемая версия Obsidian названа в обоих документах и совпадает с манифестом");
}

{
  /* Глоссарий 7.3 на месте, и он не пустая заготовка (фаза 5.1, пункт 3). */
  const text = fs.readFileSync(path.join(root, "instructions.md"), "utf8");
  const from = text.indexOf("## Glossary");
  assert.ok(from > 0, "в руководстве нет глоссария");
  const to = text.indexOf("\n## ", from + 4);
  const section = text.slice(from, to < 0 ? text.length : to);
  const rows = section.split(/\r?\n/).filter(l => /^\|/.test(l) && !/^\|\s*-/.test(l));
  assert.ok(rows.length >= 15,
    "в глоссарии слишком мало строк: " + rows.length + ", а терминов в 7.3 больше");

  /* Каждое переименование 7.3 объяснено. */
  const MUST_EXPLAIN = ["Order", "Strip", "Deep Editor", "free roam", "Prefix Resolver",
    "subtag", "payload", "processed token", "Flying button", "zone"];
  const missing = MUST_EXPLAIN.filter(term => !section.includes(term));
  assert.deepEqual(missing, [],
    "глоссарий не объясняет термин из 7.3: " + missing.join(", "));
  ok("глоссарий 7.3 на месте и объясняет каждое переименование");
}

{
  /* Разрыв хоткеев назван в обоих руководствах: человек обязан о нём прочитать. */
  for (const doc of GUIDES) {
    const text = fs.readFileSync(path.join(root, doc), "utf8");
    assert.ok(text.includes("command_ids_v1_v2.md"),
      doc + " не ссылается на карту старых и новых ID команд (Р3, фаза 2, пункт 8)");
  }
  ok("оба документа предупреждают о слетевших хоткеях и ведут к карте");
}


/* ---- лист возможностей ---------------------------------------------------- */

{
  /**
   * `FEATURES.md` — лист возможностей, и у него своя опасность: он написан
   * ради описания в каталоге и разговора о деньгах, то есть читается теми, кто
   * проверить написанное не может. Стареет такой документ тише всех (У-64).
   *
   * Поэтому здесь не вычитка, а сверка с продуктом в обе стороны: **каждая**
   * команда обязана быть названа, **каждая** область панели обязана быть
   * названа, а запреты терминологии выше действуют на него наравне с
   * руководствами. Обещать то, чего нет, — ровно та ошибка, за которую в этом
   * проекте уже платили: про плавающую кнопку оба документа писали «not
   * implemented» четверо суток после того, как она заработала.
   */
  const text = readDoc("FEATURES.md");

  /* Контроль обхода до первого вывода: файл прочитан и он не пуст. */
  assert.ok(text.length > 2000,
    "положительный контроль: лист возможностей прочитан и он не пуст (" + text.length + ")");
  assert.ok(!text.includes("Move line sideways"),
    "положительный контроль: поиск по листу отличает несуществующее имя");

  /*
   * Контроль был только на стороне документа, а спрашивают обе: пустой реестр
   * команд или пустой список вкладок делает обе сверки зелёными, ничего не
   * сверив. Порог стоит на той стороне, которая **спрашивает** (У-88).
   */
  const names = Object.keys(ids.NAMES).map(id => String(ids.commandName(id)));
  assert.ok(names.length >= 10,
    "положительный контроль: команд в реестре " + names.length + " — сверять не с чем");
  const missingCommands = names.filter(name => !text.includes(name));
  assert.deepEqual(missingCommands, [],
    "лист возможностей молчит о команде, которая есть:\n  " + missingCommands.join("\n  "));

  const titles = (TABS as Any[]).map(t => String(t.label));
  assert.ok(titles.length >= 7,
    "положительный контроль: областей в схеме " + titles.length + " — сверять не с чем");
  const missingTabs = titles.filter(title => !text.includes(title));
  assert.deepEqual(missingTabs, [],
    "лист возможностей не называет область панели: " + missingTabs.join(", "));

  ok("лист возможностей называет каждую команду и каждую область панели");
}

console.log("\n" + passed + " проверок пройдено");
