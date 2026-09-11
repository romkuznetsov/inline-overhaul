/**
 * ID и имена команд после переименования (PRD фаза 2, пункты 8–9; T6, T7, Р3).
 *
 * **Что здесь закрепляется и почему это не «проверка на kebab-case».** Схема
 * идентификатора собиралась в трёх местах, и из этой тройки вырос дефект Б-11:
 * заметка конфигурации показывала хоткеи полей-дат пустыми, потому что третье
 * место собирало строку иначе, чем реестр команд. Поэтому проверка спрашивает
 * не «правильно ли выглядит строка», а:
 *
 *   * каждая зарегистрированная команда отвечает T7 и ни одна не повторяется;
 *   * имена команд взяты из прототипа, а не придуманы (Р8);
 *   * ни один старый идентификатор не остался в живом коде, и каждый назван в
 *     карте — иначе человек не узнает, что во что превратилось;
 *   * **поиск хоткея поля-даты находит ту команду, которую зарегистрировал
 *     реестр** — то есть корень Б-11 закрыт, а не заклеен;
 *   * идентификатор, уже отвечавший T7, не переименован: Р3 даёт один разрыв;
 *   * своя строка Binder не затеняет команду ядра;
 *   * старая форма идентификатора в конфиге Binder пересобирается.
 *
 * Подделок нет: определения команд берутся у настоящего реестра, записи идут
 * настоящим `migrateConfig` из `main.js` через загрузчик
 * `tests/harness/plugin_internals.ts`. Подделан один менеджер хоткеев — в Node
 * его нет вовсе, и это названо на месте.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPluginInternals } from "../harness/plugin_internals.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = createRequire(import.meta.url);
const ids = requireCjs(path.join(root, "src", "features", "command_ids.js")) as Any;
const registry = requireCjs(path.join(root, "src", "features", "command_registry.js")) as Any;
const internals = loadPluginInternals();

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

const FEATURE_ORDER = ["navigation", "pkm", "visual", "transform"];
const FEATURE_META: Record<string, { label: string }> = {
  navigation: { label: "Navigation" },
  pkm: { label: "PKM" },
  visual: { label: "Visual" },
  transform: { label: "Transform" },
};

/** Конфиг с двумя Fields: тегом и элементом-датой, плюс своя строка Binder. */
function makeConfig(): Any {
  return internals.migrateConfig({
    schemaVersion: 1,
    ui: {
      binderRows: [
        { rowId: "r1", insertText: "()", commandName: "Round brackets", commandId: "inlineOverhaul_Binder_Round_brackets" },
        /* Строка, названная как команда навигации: затенить её нельзя. */
        { rowId: "r2", insertText: "<>", commandName: "Move left", commandId: "" },
      ],
    },
    pkm: {
      behavior: {
        order: {
          left: ["status"],
          right: ["date_due"],
          labels: { status: "Status", date_due: "Due" },
          strictNames: { status: "status", date_due: "date_due" },
          types: { status: "tag", date_due: "element" },
          active: { status: "yes", date_due: "yes" },
          enabled: { status: true, date_due: true },
        },
        leftMode: { fields: [{ id: "status", orderKey: "status", prefix: "#", values: [{ token: "#todo" }] }] },
        rightMode: { fields: [{ id: "date_due", orderKey: "date_due", kind: "dateOffset", values: [] }] },
        elements: { fields: ["date_due"], byField: { date_due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD" } } },
        io: { separator1: "||", separator2: "||" },
      },
    },
  }) as Any;
}

/** Плагин в том объёме, в каком его трогает реестр команд. */
function makePlugin(cfg: Any): Any {
  return {
    app: { setting: { open: () => {}, openTabById: () => {} } },
    manifest: { id: "inline-overhaul" },
    store: { getSnapshot: () => cfg, patch: () => {}, undo: () => true },
    notice: () => {},
    getConfig: () => cfg,
  };
}

/** Все определения команд одним списком: так их видит Obsidian. */
function allDefs(cfg: Any): Any[] {
  const plugin = makePlugin(cfg);
  const out: Any[] = [];
  out.push(...registry.buildCoreCommandDefs(plugin, FEATURE_ORDER, FEATURE_META));
  out.push(...registry.buildNavigationCommandDefs(plugin, () => "rules.md"));
  out.push(...registry.buildPkmCommandDefs(
    () => "rules.md",
    () => "{}",
    () => "{}",
    internals.normalizePkmOrder,
    cfg,
    FEATURE_ORDER,
  ));
  out.push(...registry.buildBinderCommandDefs(cfg));
  /* Transform регистрируется прямо в `main.js`, реестра у него нет. */
  out.push({ id: "transform-inline-to-note", name: ids.commandName("transform-inline-to-note") });
  return out;
}

/* ---- T7: форма идентификатора и отсутствие повторов --------------------- */

{
  const cfg = makeConfig();
  const defs = allDefs(cfg);
  assert.ok(defs.length >= 18, "команд собралось меньше, чем ожидалось: " + defs.length);

  const wrong = defs
    .map(d => String(d && d.id || ""))
    .filter(id => !ids.isCompliantCommandId(id));
  assert.deepEqual(wrong, [],
    "эти идентификаторы не отвечают T7 — kebab-case без префикса плагина:\n  " + wrong.join("\n  "));

  const seen = new Map<string, number>();
  for (const d of defs) {
    const id = String(d && d.id || "");
    seen.set(id, (seen.get(id) || 0) + 1);
  }
  const dupes = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  assert.deepEqual(dupes, [],
    "два определения делят один идентификатор — второе затрёт первое: " + dupes.join(", "));
  ok("T7: все идентификаторы в kebab-case без префикса плагина и без повторов");
}

/* ---- T6: имена без префикса плагина и модуля ---------------------------- */

{
  const defs = allDefs(makeConfig());
  const prefixed = defs
    .map(d => String(d && d.name || ""))
    .filter(name => /^(General|Navigation|PKM|Config|Binder|Transform)\s*:/.test(name));
  assert.deepEqual(prefixed, [],
    "имя команды содержит префикс модуля — Obsidian добавит своё, и получится"
    + " «inlineOverhaul: Navigation: …»:\n  " + prefixed.join("\n  "));
  const empty = defs.filter(d => !String(d && d.name || "").trim()).map(d => String(d.id));
  assert.deepEqual(empty, [], "команда без имени: " + empty.join(", "));
  ok("T6: ни одно имя не несёт префикса плагина или модуля");
}

{
  /*
   * Имена взяты из прототипа, а не придуманы здесь: список `COMMANDS` в
   * `docs/prototype/settings_prototype.html` нормативен (Р8), и справочник
   * команд 10.5 показывает ровно эти строки.
   */
  const proto = fs.readFileSync(path.join(root, "docs", "prototype", "settings_prototype.html"), "utf8");
  /*
   * Порог до вывода: спрашивает здесь реестр имён, и пустей он — «имена
   * совпадают с прототипом» стало бы правдой, которую никто не проверял (У-88).
   */
  assert.ok(Object.keys(ids.NAMES).length >= 10,
    "положительный контроль: имён в реестре " + Object.keys(ids.NAMES).length + " — сверять не с чем");
  const missing: string[] = [];
  for (const id of Object.keys(ids.NAMES)) {
    const name = ids.NAMES[id];
    /* Исключений тут нет и заводить их не надо: единственное — `Open settings`,
       которой в прототипе не было, — снято 2026-09-06 вместе с самой командой
       (T8, фаза 6 пункт 5). Исключение живёт ровно столько, сколько предмет. */
    if (!proto.includes('"' + name + '"')) missing.push(id + ": " + name);
  }
  assert.deepEqual(missing, [],
    "этих имён в прототипе нет, значит они придуманы в коде (Р8):\n  " + missing.join("\n  "));
  ok("имена команд совпадают с прототипом");
}

/* ---- карта переименования полна ---------------------------------------- */

{
  /* Ни одного старого идентификатора в живом коде: только в карте и в
     переводчике старых строк Binder. */
  const files = [
    "main.js",
    "src/features/command_registry.js",
    "src/features/transform_feature.js",
  ];
  const strays: string[] = [];
  let linesRead = 0;
  for (const rel of files) {
    const src = fs.readFileSync(path.join(root, rel), "utf8");
    const lines = src.split(/\r?\n/);
    linesRead += lines.length;
    for (let i = 0; i < lines.length; i++) {
      const line = String(lines[i] || "");
      if (!/inlineOverhaul_/.test(line)) continue;
      /* Разрешено: комментарий и ветки перевода старой формы Binder. */
      if (/^\s*(\*|\/\*|\/\/)/.test(line)) continue;
      if (/existingId === "inlineOverhaul_Binder_/.test(line)) continue;
      strays.push(rel + ":" + (i + 1) + " " + line.trim().slice(0, 100));
    }
  }
  /*
   * Порог до вывода: список файлов рукописный, и пустей он или укоротись —
   * запрет остался бы зелёным от того, что читать стало нечего (У-88, У-111).
   */
  assert.ok(files.length >= 3 && linesRead > 500,
    "положительный контроль: прочитано " + files.length + " файлов и " + linesRead
    + " строк — запрет ниже мерит пустоту");
  assert.deepEqual(strays, [],
    "старый идентификатор остался в живом коде:\n  " + strays.join("\n  "));
  ok("старых идентификаторов в живом коде нет");
}

{
  /* Каждый старый идентификатор фиксированной команды назван в карте. */
  const wasIds = [...ids.RENAMED.keys()] as string[];
  /* Было четырнадцать; две команды конфиг-заметки сняты 2026-09-03 вместе с
     ней (PRD 10.12), и переводить их больше некуда. */
  assert.equal(wasIds.length, 12, "в карте переименования ожидалось 12 команд, а не " + wasIds.length);
  for (const was of wasIds) {
    assert.ok(/^inlineOverhaul_/.test(was), "в карте не старый идентификатор: " + was);
    const now = ids.renameCommandId(was);
    assert.ok(ids.isCompliantCommandId(now), "перевод не отвечает T7: " + was + " → " + now);
    assert.ok(ids.commandName(now), "у переименованной команды нет имени: " + now);
  }
  /* И обратное: идентификатор, отвечающий T7, карта отдаёт как есть. */
  assert.equal(ids.renameCommandId("undo-last-settings-change"), "undo-last-settings-change",
    "идентификатор, уже отвечавший T7, переименован — это второй разрыв, которого Р3 не даёт");
  assert.equal(ids.renameCommandId("toggle-feature-pkm"), "toggle-feature-pkm",
    "тумблер модуля переименован");
  ok("карта переименования полна и не трогает то, что уже отвечало T7");
}

{
  /*
   * Документ карты выведен из модуля, а не набран руками. Проверяется не
   * «упомянуты ли ID», а то, что генератор не даёт diff: расхождение здесь
   * означает документ, который человек прочитает один раз и не проверит.
   */
  const doc = fs.readFileSync(path.join(root, "docs", "command_ids_v1_v2.md"), "utf8");
  for (const [was, now] of ids.RENAMED as Map<string, string>) {
    assert.ok(doc.includes("`" + was + "`"), "в документе нет старого ID: " + was);
    assert.ok(doc.includes("`" + now + "`"), "в документе нет нового ID: " + now);
  }
  const check = spawnSync(process.execPath, [path.join(root, "tools", "command_ids_doc.js")],
    { cwd: root, encoding: "utf8" });
  assert.equal(check.status, 0,
    "документ карты разошёлся с модулем: перезаписать `node tools/command_ids_doc.js --write`\n"
    + String(check.stdout || "") + String(check.stderr || ""));
  ok("документ карты выведен из модуля и не разошёлся с ним");
}

/* ---- совпадения имён Fields разводятся ---------------------------------- */

{
  /*
   * Два Field, чьи строгие имена дают один kebab. Без разводки вторая пара
   * команд затёрла бы первую — Obsidian просто не зарегистрирует второй
   * `addCommand` с тем же идентификатором, и человек потеряет команду молча.
   *
   * Совпадение выглядит надуманным ровно до первого человека, который назвал
   * поле `date_due`, а второе — `date-due`.
   */
  const cfg = internals.migrateConfig({
    schemaVersion: 1,
    pkm: {
      behavior: {
        order: {
          left: ["a", "b"],
          right: [],
          labels: { a: "A", b: "B" },
          strictNames: { a: "date_due", b: "date-due" },
          types: { a: "tag", b: "tag" },
          active: { a: "yes", b: "yes" },
          enabled: { a: true, b: true },
        },
        leftMode: {
          fields: [
            { id: "a", orderKey: "a", prefix: "#", values: [{ token: "#one" }] },
            { id: "b", orderKey: "b", prefix: "#", values: [{ token: "#two" }] },
          ],
        },
        rightMode: { fields: [] },
        io: { separator1: "||", separator2: "||" },
      },
    },
  }) as Any;

  const defs = registry.buildPkmCommandDefs(
    () => "rules.md", () => "{}", () => "{}", internals.normalizePkmOrder, cfg, FEATURE_ORDER,
  ) as Any[];
  const forFields = defs.filter(d => ["a", "b"].includes(String(d.orderKey || "")));
  assert.equal(forFields.length, 4,
    "у двух Fields должно быть четыре команды, найдено " + forFields.length);

  const idList = forFields.map(d => String(d.id));
  assert.equal(new Set(idList).size, 4,
    "команды разных Fields делят идентификатор — вторая затрёт первую: " + idList.join(", "));
  assert.ok(idList.includes("date-due-next") && idList.includes("date-due-2-next"),
    "разводка не сработала: " + idList.join(", "));
  ok("совпадение строгих имён разводится, и ни одна команда не затирает другую");
}

/* ---- корень Б-11: поиск хоткея находит команду реестра ------------------ */

{
  const cfg = makeConfig();
  const defs = registry.buildPkmCommandDefs(
    () => "rules.md", () => "{}", () => "{}", internals.normalizePkmOrder, cfg, FEATURE_ORDER,
  ) as Any[];
  const due = defs.filter(d => String(d.orderKey || "") === "date_due");
  assert.equal(due.length, 2, "у поля-даты должно быть две команды, найдено " + due.length);
  const inc = due.find(d => d.direction === "increase");
  const dec = due.find(d => d.direction === "decrease");
  assert.equal(inc.id, "date-due-next", "идентификатор команды вперёд: " + inc.id);
  assert.equal(dec.id, "date-due-previous", "идентификатор команды назад: " + dec.id);
  /*
   * И в имени, и в идентификаторе — **строгое имя** Field (`Name`).
   *
   * Короткое имя для TagWheel (`Name in TagWheel`) сюда не доезжает вовсе:
   * «io-field-short должен влиять только на отображение field в TagWheel»
   * (замечание заказчика 2026-09-04). Фикстура держит их разными — строгое
   * `date_due`, короткое `Due`, — иначе проверка была бы слепа к их
   * расхождению (У-47).
   */
  assert.equal(inc.name, "date_due next", "имя команды берёт строгое имя Field: " + inc.name);
  assert.equal(dec.name, "date_due previous", "и у обратной команды тоже: " + dec.name);

  ok("идентификатор и имя команд поля-даты собирает реестр, а не своя копия схемы");
}

/* ---- Binder: старая форма в конфиге пересобирается ---------------------- */

{
  const cfg = makeConfig();
  const rows = (cfg.editor.binder.rows || []) as Any[];
  const legacy = rows.filter(r => ids.isLegacyCommandId(String(r.commandId || "")));
  assert.deepEqual(legacy, [],
    "старая форма идентификатора осталась в конфиге Binder: " + JSON.stringify(legacy));
  const round = rows.find(r => String(r.commandName || "") === "Round brackets");
  assert.equal(String(round.commandId), "round-brackets",
    "идентификатор пересобран из имени строки: " + String(round.commandId));

  /* Строка, названная как команда навигации, получила суффикс. */
  const shadow = rows.find(r => String(r.commandName || "") === "Move left");
  assert.equal(String(shadow.commandId), "move-left-2",
    "своя строка Binder затенила команду навигации: " + String(shadow.commandId));

  /* Системная строка на месте и с новым идентификатором. */
  const smart = rows.find(r => String(r.commandId || "") === "smart-bracket");
  assert.ok(smart, "системная строка Binder потерялась: " + JSON.stringify(rows.map(r => r.commandId)));

  /* И имя команды Binder — имя строки, без префикса модуля. */
  const binderDefs = registry.buildBinderCommandDefs(cfg) as Any[];
  const names = binderDefs.map(d => String(d.name || ""));
  assert.ok(names.includes("Smart bracket"), "имя системной команды: " + names.join(", "));
  assert.ok(names.includes("Round brackets"), "имя своей команды: " + names.join(", "));
  ok("Binder: старая форма пересобрана, ядро не затенено, имена без префикса");
}

/* ---- уведомление показывается один раз --------------------------------- */

{
  /*
   * Уведомление живёт в `main.js` и трогает `Notice`, поэтому проверяется его
   * условие, а не вёрстка: флаг в `viewState`, а не в настройках, и он
   * переживает миграцию, а не уезжает в `_unmigrated`.
   */
  const shown = internals.migrateConfig({ schemaVersion: 2, viewState: { commandIdsNotice: "shown" } }) as Any;
  assert.equal(shown.viewState.commandIdsNotice, "shown",
    "флаг уведомления не пережил migrateConfig");
  assert.equal(shown._unmigrated, undefined, "флаг уехал в _unmigrated");

  const fromV1 = internals.migrateConfig({ schemaVersion: 1, viewState: { commandIdsNotice: "shown" } }) as Any;
  assert.equal(fromV1.viewState.commandIdsNotice, "shown",
    "флаг уведомления не пережил переезд с версии 1");

  const fresh = internals.migrateConfig(null) as Any;
  assert.equal(fresh.viewState.commandIdsNotice, undefined,
    "на свежей установке флаг заранее не выставлен: иначе уведомление не покажется никому");

  /*
   * Уведомление уехало в `src/features/plugin_bootstrap.js` вместе с самой
   * загрузкой (кусок четвёртый разбора `main.js`, 2026-09-07). Утверждения
   * спрашивают то же самое там, где предмет теперь (У-94).
   */
  const src = fs.readFileSync(
    path.join(root, "src", "features", "plugin_bootstrap.js"), "utf8");
  assert.ok(/noticeCommandIdsChanged\(plugin\)/.test(src), "уведомление не позвано из onload");
  assert.ok(/if \(!plugin\._migratedFromV1\) return;/.test(src),
    "уведомление показывается не только тому, у кого был конфиг версии 1 (З8)");
  /* Тело функции целиком, а не отрезок в две тысячи знаков: отрезок задевал
     соседний код и проверял не то. */
  const noticeBody = src.slice(
    src.indexOf("function noticeCommandIdsChanged(plugin) {"),
    src.indexOf("function createSettingTab(plugin) {"),
  );
  assert.ok(noticeBody.length > 400, "тело уведомления не нашлось: " + noticeBody.length);
  assert.ok(!/app\.setting|hotkeyManager/.test(noticeBody),
    "в уведомлении приватное API: 7.2 разрешает его одним исключением, и это не оно");
  assert.ok(/Settings, Hotkeys/.test(noticeBody),
    "уведомление не говорит, куда идти назначать хоткеи заново");
  assert.ok(/command_ids_v1_v2\.md/.test(noticeBody),
    "уведомление не ссылается на карту");
  ok("уведомление показывается один раз и только после переезда с версии 1");
}

/* ---- T8: приватное API открытия настроек ------------------------------- */

{
  /*
   * **Приёмка пункта 5 фазы 6, сделанная машиной, а не глазами.** В PRD она
   * записана как «`grep` на `app.setting` по `src/` и `main.ts` — пусто, кроме
   * колонки хоткея в справочнике команд». Grep, который надо не забыть
   * запустить, — это проверка, которой нет; поэтому он стоит здесь.
   *
   * Разрешённое место ровно одно — `custom/hotkeys.ts` (К-2, 7.2): там
   * `app.setting` за feature-detect и `try/catch`, и без него кнопка просто
   * неактивна. Всё остальное — возврат команды `Open settings`, а её решением
   * 7.2 обратно не возвращают: это типовая причина замечания на community
   * review.
   *
   * Ищется по **живому коду**: строка комментария про `app.setting` — это
   * объяснение, а не вызов, и запрещать объяснения значило бы вычистить из
   * файлов ровно ту память, ради которой всё это писалось.
   */
  const ALLOWED = new Set(["src/ui/settings/custom/hotkeys.ts"]);

  const walk = (dir: string, out: string[]): string[] => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p, out);
      else if (/\.(js|ts)$/.test(name)) out.push(p);
    }
    return out;
  };

  const files = walk(path.join(root, "src"), []).concat([path.join(root, "main.js")]);
  const strays: string[] = [];
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (ALLOWED.has(rel)) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = String(lines[i] || "");
      const code = line.replace(/^\s*(\*|\/\/|\/\*).*$/, "");
      if (/\bapp\s*\.\s*setting\b|\bsetting\s*\.\s*(open|openTabById)\s*\(/.test(code)) {
        strays.push(rel + ":" + (i + 1) + "  " + line.trim());
      }
    }
  }
  assert.deepEqual(strays, [],
    "приватное API открытия настроек вне единственного разрешённого места (T8, 7.2):\n  "
    + strays.join("\n  "));

  /* И сама команда не вернулась: ни идентификатором, ни именем в карте. */
  assert.ok(!Object.prototype.hasOwnProperty.call(ids.NAMES, "open-inline-overhaul-settings"),
    "команда `Open settings` вернулась в карту имён — решением 7.2 её не возвращают");
  const registry = fs.readFileSync(path.join(root, "src", "features", "command_registry.js"), "utf8");
  assert.ok(!/id:\s*"open-inline-overhaul-settings"/.test(registry),
    "команда `Open settings` снова регистрируется");
  ok("T8: приватного API открытия настроек нет нигде, кроме колонки хоткея");
}

console.log("\n" + passed + " проверок пройдено");
