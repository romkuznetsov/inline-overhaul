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

const DOCS = ["README.md", "instructions.md"];

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
  ];

  /*
   * Заметка-руководство проверяется этим же списком, и список остаётся один
   * (У-32). Это третий документ плагина, и снятый контрол в нём посылает
   * человека ровно туда же, куда из README. Своего запрета у руководства был
   * свой список, и он успел устареть: он запрещал называть плавающую кнопку
   * через четверо суток после того, как она заработала.
   */
  const found: string[] = [];
  const sources: Array<[string, string]> = DOCS.map(
    doc => [doc, readDoc(doc)] as [string, string],
  );
  sources.push(["заметка-руководство", howtoMarkdown()]);
  for (const [doc, text] of sources) {
    for (const [name, why] of REMOVED) {
      if (text.includes(name)) found.push(doc + ": «" + name + "» — " + why);
    }
  }
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
  const found: string[] = [];
  for (const doc of DOCS) {
    const lines = readDoc(doc).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = String(lines[i] || "");
      for (const name of OLD_NAMES) {
        if (line.includes(name)) found.push(doc + ":" + (i + 1) + " «" + name + "»");
      }
    }
  }
  assert.deepEqual(found, [],
    "документ называет команду её старым именем (T6, фаза 2 пункты 8–9):\n  " + found.join("\n  "));
  ok("старых имён команд в документах не осталось");
}

{
  /* И старой формы идентификатора тоже: в UI и в документах её быть не должно. */
  const found: string[] = [];
  for (const doc of DOCS) {
    if (/inlineOverhaul_/.test(readDoc(doc))) found.push(doc);
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
  const missing = names.filter(name => {
    /* `Open settings` удаляется в фазе 6, и документы её уже не называют. */
    if (name === "Open settings") return false;
    return !DOCS.some(doc => readDoc(doc).includes(name));
  });
  assert.deepEqual(missing, [],
    "эти команды существуют, а руководство о них молчит:\n  " + missing.join("\n  "));
  ok("каждая команда названа в руководстве своим нынешним именем");
}

/* ---- вкладки и терминология --------------------------------------------- */

{
  /* Имена областей — из схемы, а не из памяти. */
  const titles = (TABS as Any[]).map(t => String(t.label));
  const missing = titles.filter(title => !readDoc("instructions.md").includes(title));
  assert.deepEqual(missing, [],
    "руководство не называет область панели: " + missing.join(", "));

  const STALE_TABS = ["Tag & PKM", "→ Main", "→ Global", "→ Behavior", "Hotkeys → Binder"];
  const found: string[] = [];
  for (const doc of DOCS) {
    const text = readDoc(doc);
    for (const stale of STALE_TABS) if (text.includes(stale)) found.push(doc + ": «" + stale + "»");
  }
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
  const found: string[] = [];
  for (const doc of DOCS) {
    const text = readDoc(doc);
    for (const [stale, now] of RENAMED) {
      if (text.includes(stale)) found.push(doc + ": «" + stale + "» → " + now);
    }
  }
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
  /* Разрыв хоткеев назван в обоих документах: человек обязан о нём прочитать. */
  for (const doc of DOCS) {
    const text = fs.readFileSync(path.join(root, doc), "utf8");
    assert.ok(text.includes("command_ids_v1_v2.md"),
      doc + " не ссылается на карту старых и новых ID команд (Р3, фаза 2, пункт 8)");
  }
  ok("оба документа предупреждают о слетевших хоткеях и ведут к карте");
}

console.log("\n" + passed + " проверок пройдено");
