/**
 * Реестр действий кнопок (PRD 5.6).
 *
 * Проверяется не то, что реестр «есть», а три вещи, каждая из которых уже
 * ломалась в этом проекте по-своему:
 *
 *   1. **Кнопка без действия в панель не попадает.** Список `READY_ACTIONS` в
 *      реестре и такой же список в `build/gen_schema.js` обязаны совпадать:
 *      разойдись они — и в схеме окажется кнопка, которая ничего не делает
 *      (З8). Сверяются оба списка, а заодно и сама схема: у каждой кнопки в
 *      ней действие обязано быть в реестре.
 *   2. **Каждое действие реестра стоит на кнопке** (Г22, обратная сторона).
 *   3. **Шов, которого нет, — это сообщение, а не молчание**: без доступа к
 *      vault руководство говорит об этом человеку.
 *
 * Два раздела — «действие зовёт метод плагина» и «применение заметки
 * спрашивает» — сняты 2026-09-03 вместе с конфиг-заметкой (PRD 10.12): их
 * предмета в плагине больше нет. Подтверждение как таковое проверяется на
 * восстановлении копии — `settings_backup_tests.ts`.
 *
 * Настоящие здесь схема и реестр. Подделан плагин: его методы ходят в vault,
 * а vault в Node нет.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTION_TEXTS, READY_ACTIONS, buildActions } from "../../src/ui/settings/actions.ts";
import { HOWTO_LEGACY_PATH, HOWTO_PATH, howtoMarkdown } from "../../src/ui/settings/howto.ts";
import { STARTER_LEFT_BLOCK, STARTER_RIGHT_BLOCK } from "../../src/core/starter_config.ts";
import { SCHEMA, TABS } from "../../src/ui/settings/schema/index.ts";

/** Схема разбирается здесь как данные: типы её строк проверке не нужны. */
type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/* ---- 1. два списка и схема ---------------------------------------------- */

{
  const src = fs.readFileSync(path.join(root, "build", "gen_schema.js"), "utf8");
  const at = src.indexOf("const READY_ACTIONS = new Set([");
  assert.ok(at > 0, "список действий в генераторе нашёлся");
  const body = src.slice(at, src.indexOf("]", at));
  const inGen = [...body.matchAll(/"([^"]+)"/g)].map(m => m[1]);

  assert.deepEqual(inGen.slice().sort(), READY_ACTIONS.slice().sort(),
    "списки готовых действий в реестре и в генераторе разошлись: "
    + inGen.join(", ") + " против " + READY_ACTIONS.join(", "));
  ok("реестр и генератор согласны, какие действия готовы");
}

{
  /* И ни одной кнопки в схеме с действием не из реестра. */
  const ready = new Set<string>(READY_ACTIONS);
  const seen: string[] = [];
  for (const group of SCHEMA) {
    for (const item of group.items) {
      if (item.kind !== "buttons") continue;
      for (const b of item.buttons) {
        seen.push(b.action);
        assert.ok(ready.has(b.action),
          "в схеме кнопка `" + b.label + "` с действием вне реестра: " + b.action);
      }
    }
  }
  assert.ok(seen.length >= 3, "кнопки в схеме вообще есть: " + seen.join(", "));
  ok("З8: в схеме нет кнопки, за которой нет действия");
}

{
  /*
   * Г22, вторая половина: каждое действие реестра где-то используется. Иначе
   * реестр однажды обрастёт действиями, которые никто не зовёт, и «готово»
   * перестанет значить «видно в панели».
   */
  const used = new Set<string>();
  for (const group of SCHEMA) {
    for (const item of group.items) {
      if (item.kind !== "buttons") continue;
      for (const b of item.buttons) used.add(b.action);
    }
  }
  for (const action of READY_ACTIONS) {
    assert.ok(used.has(action),
      "действие реестра не используется ни одной кнопкой схемы: " + action);
  }
  ok("Г22: каждое действие реестра стоит на кнопке");
}

{
  /*
   * И обратное: недоделанные действия в схему не проползли. Список закрытый —
   * появится у них метод, проверка заставит его сюда вписать.
   */
  const notReady = ["open-hotkey"];
  for (const action of notReady) {
    assert.ok(!READY_ACTIONS.includes(action as never),
      action + " числится готовым: обновите список недоделанных");
  }
  ok("недоделанное действие названо поимённо");
}

/* ---- руководство (5.1, пункт 1) ----------------------------------------- */

/** Vault, которого в Node нет: подделка названа, как и все остальные. */
function makeVault(has: boolean): {
  seam: { exists: (p: string) => boolean; create: (p: string, t: string) => void; open: (p: string) => void };
  made: Array<{ path: string; text: string }>;
  opened: string[];
} {
  const made: Array<{ path: string; text: string }> = [];
  const opened: string[] = [];
  let there = has;
  return {
    seam: {
      exists: () => there,
      create: (p: string, t: string) => { made.push({ path: p, text: t }); there = true; },
      open: (p: string) => { opened.push(p); },
    },
    made,
    opened,
  };
}

{
  const v = makeVault(false);
  const notes: string[] = [];
  const actions = buildActions({ notify: m => { notes.push(m); }, vault: v.seam });
  await actions["open-howto"]!();

  assert.equal(v.made.length, 1, "заметки не было — она создана");
  assert.equal(v.made[0]?.path, HOWTO_PATH, "по своему пути");
  assert.equal(v.made[0]?.text, howtoMarkdown(), "с текстом руководства");
  assert.deepEqual(v.opened, [HOWTO_PATH], "и открыта");
  assert.equal(notes[0], ACTION_TEXTS.GUIDE_MADE + ": " + HOWTO_PATH,
    "человеку сказано, что заметка создана: " + notes.join(" | "));
  ok("руководство создаётся при первом вызове");
}

{
  /*
   * И только открывается при втором. Заметка принадлежит человеку — он в ней
   * пишет, — и перезапись стёрла бы его пометки.
   */
  const v = makeVault(true);
  const notes: string[] = [];
  const actions = buildActions({ notify: m => { notes.push(m); }, vault: v.seam });
  await actions["open-howto"]!();

  assert.deepEqual(v.made, [], "существующая заметка не переписывается");
  assert.deepEqual(v.opened, [HOWTO_PATH], "а просто открывается");
  assert.equal(notes[0], ACTION_TEXTS.GUIDE_OPENED + ": " + HOWTO_PATH,
    "и сказано именно это: " + notes.join(" | "));
  ok("руководство не переписывается: там пометки человека");
}

{
  /*
   * Переименование плагина 2026-09-06 сменило и имя заметки-руководства.
   * У того, кто её уже завёл, лежит старая — со своими пометками. Кнопка
   * обязана открыть её, а не завести вторую рядом.
   */
  const made: Array<{ path: string; text: string }> = [];
  const opened: string[] = [];
  const there = new Set<string>([HOWTO_LEGACY_PATH]);
  const notes: string[] = [];
  const actions = buildActions({
    notify: m => { notes.push(m); },
    vault: {
      exists: (p: string) => there.has(p),
      create: (p: string, t: string) => { made.push({ path: p, text: t }); there.add(p); },
      open: (p: string) => { opened.push(p); },
    },
  });
  await actions["open-howto"]!();

  assert.deepEqual(made, [], "рядом со старой заметкой завели вторую");
  assert.deepEqual(opened, [HOWTO_LEGACY_PATH], "открыли не ту заметку: " + opened.join(", "));
  assert.equal(notes[0], ACTION_TEXTS.GUIDE_OPENED + ": " + HOWTO_LEGACY_PATH,
    "сказали не про тот файл: " + notes.join(" | "));
  ok("руководство под прежним именем открывается, а не дублируется");
}

{
  /* Без доступа к vault кнопка отвечает словами, а не молчит. */
  const notes: string[] = [];
  const actions = buildActions({ notify: m => { notes.push(m); } });
  await actions["open-howto"]!();
  assert.ok(notes[0]?.includes(ACTION_TEXTS.NO_METHOD),
    "сказано, что открывать нечем: " + notes.join(" | "));
  ok("без доступа к vault руководство отвечает словами");
}

{
  /*
   * Разделы руководства сверяются целиком: проверка на одно слово в тексте
   * пропускала переименование раздела (найдено мутацией). Порядок и состав —
   * тот, которым заказчик переписал заметку 2026-09-05 (F2).
   *
   * Прежний запрет называть «floating button» и «command reference» снят: обе
   * вещи в плагине есть. Кнопка сделана 2026-09-01, справочник стоит на
   * вкладке Keyboard под именем `Commands & Hotkeys`. Пин четверо суток
   * охранял утверждение о состоянии, которое успело устареть, — ровно тот же
   * класс, что и «not implemented» в README (У-64). Что руководство не должно
   * называть снятые контролы, сторожит теперь `docs_terms_tests.ts`: список
   * снятого там один на все три документа (У-32).
   */
  const text = howtoMarkdown();
  const headings = text.split("\n").filter(l => l.startsWith("## ")).map(l => l.slice(3));
  assert.deepEqual(headings, [
    "What to set up first",
    "Fields and Values",
    "How a line is put together",
    "TagWheel",
    "Tag Bars",
    "Binder",
    "Transform: a line becomes a note",
    "Some pro tips to make things smoother",
    "Three setups you can copy",
  ], "разделы руководства: " + headings.join(" | "));
  assert.ok(text.startsWith("> [!Guide] inlineOverhaul"),
    "заметка начинается вводным коллаутом, которым её начал заказчик");
  ok("разделы руководства на месте");
}

{
  /*
   * Длинного тире в заметке быть не должно: прямая просьба заказчика
   * 2026-09-05 («убери ИИ-змы, `—` и т.д.»). Правило машинное, потому что
   * глазами оно теряется: в присланном им же тексте таких тире осталось шесть.
   */
  const text = howtoMarkdown();
  const dashes = text.split("\n")
    .map((line, i) => [i + 1, line] as [number, string])
    .filter(([, line]) => line.includes("\u2014"))
    .map(([i, line]) => i + ": " + line.trim());
  assert.deepEqual(dashes, [], "в руководстве осталось длинное тире:\n  " + dashes.join("\n  "));
  ok("длинных тире в руководстве нет");
}

{
  /*
   * Каждый путь к настройке, названный в руководстве, ведёт туда, где эта
   * настройка правда лежит.
   *
   * 2026-09-05 в присланном заказчиком тексте таких путей устарело три:
   * `Values per side` и `Opens` у скроллера, `Child tag` промежуточным
   * уровнем, `Start over` вне `Settings backup`. Нашлись они вычиткой, то есть
   * случайно, и стареть будут дальше: имя группы меняется правкой прототипа, а
   * заметка про это не узнаёт. Пин разбирает путь вида
   * `Вкладка → Группа → Строка` и спрашивает схему, есть ли там такое.
   */
  const text = howtoMarkdown();
  const paths = new Set<string>();
  const re = /`([^`]*→[^`]*)`/g;
  for (let m = re.exec(text); m; m = re.exec(text)) paths.add(String(m[1]));

  /* Путь Obsidian, а не наш: своей вкладки `Settings` у плагина нет. */
  paths.delete("Settings → Hotkeys");

  const tabByLabel = new Map(TABS.map(t => [String(t.label), String(t.id)]));
  /* Имена строк, кнопок и подзаголовков группы — всё, чем может быть третий шаг. */
  const namesOf = (group: Any): string[] => {
    const out: string[] = [];
    for (const it of (group.items || []) as Any[]) {
      if (it.name) out.push(String(it.name));
      for (const b of (it.buttons || []) as Any[]) if (b.label) out.push(String(b.label));
    }
    return out;
  };

  const broken: string[] = [];
  for (const raw of paths) {
    const steps = raw.split("→").map(s => s.trim()).filter(Boolean);
    /* Полное имя панели впереди пути — не шаг, а адрес самой панели. */
    if (steps[0] === "inlineOverhaul") steps.shift();

    const tab = tabByLabel.get(String(steps[0]));
    if (!tab) { broken.push(raw + ": нет вкладки " + steps[0]); continue; }
    if (steps.length < 2) continue;

    const group = SCHEMA.find((g: Any) => g.tab === tab && String(g.heading) === steps[1]);
    if (!group) { broken.push(raw + ": на вкладке нет группы " + steps[1]); continue; }
    if (steps.length < 3) continue;

    const names = namesOf(group);
    if (!names.includes(String(steps[2]))) {
      broken.push(raw + ": в группе нет строки " + steps[2] + " (есть: " + names.join(", ") + ")");
    }
  }
  assert.deepEqual(broken, [], "путь в руководстве ведёт не туда:\n  " + broken.join("\n  "));
  ok("пути к настройкам в руководстве сверены со схемой");
}

{
  /*
   * Стартовый набор назван в заметке правдиво (ПЗ1, дефект A32). До 2026-09-05
   * она обещала `Status` и `Priority`, которых на свежей установке не было ни
   * одного: набор в коде отсутствовал. Пин сверяет обещание с тем, что
   * действительно кладёт первая установка, а не с литералом рядом.
   */
  const promised = howtoMarkdown()
    .split("\n")
    .filter(l => l.includes("A fresh install comes with"))
    .join(" ");
  assert.ok(promised, "руководство обязано сказать, что человек получает из коробки");
  for (const name of STARTER_LEFT_BLOCK.concat(STARTER_RIGHT_BLOCK)) {
    assert.ok(howtoMarkdown().includes("`" + name + "`"),
      "стартовый Field не назван в руководстве: " + name);
  }
  ok("руководство называет тот стартовый набор, который и правда ставится");
}

console.log("\n" + passed + " проверок пройдено");
