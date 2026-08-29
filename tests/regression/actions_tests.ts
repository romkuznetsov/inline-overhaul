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
 *   2. **Действие зовёт метод плагина**, а не свою копию его работы.
 *   3. **Применение заметки спрашивает** (Э2), и отказ — это отказ.
 *
 * Настоящие здесь схема и реестр. Подделан плагин: его методы ходят в vault,
 * а vault в Node нет.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTION_TEXTS, READY_ACTIONS, buildActions, type ConfirmRequest } from "../../src/ui/settings/actions.ts";
import { SCHEMA } from "../../src/ui/settings/schema/index.ts";

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
  assert.ok(seen.length >= 4, "кнопки в схеме вообще есть: " + seen.join(", "));
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
  const notReady = ["open-howto", "restore-backup", "open-hotkey"];
  for (const action of notReady) {
    assert.ok(!READY_ACTIONS.includes(action as never),
      action + " числится готовым: обновите список недоделанных");
  }
  ok("три недоделанных действия названы поимённо");
}

/* ---- 2. действие зовёт метод плагина ------------------------------------ */

interface Calls {
  called: string[];
  notes: string[];
}

function makeHost(over?: Record<string, unknown>): {
  calls: Calls;
  actions: ReturnType<typeof buildActions>;
  asked: ConfirmRequest[];
  answer: (yes: boolean) => void;
} {
  const calls: Calls = { called: [], notes: [] };
  const asked: ConfirmRequest[] = [];
  let yes = true;
  const plugin = {
    openTagWheelConfigNote: () => { calls.called.push("open"); return "PKM/Config.md"; },
    openTagWheelConfigTemplateNote: () => { calls.called.push("template"); return "PKM/Template.md"; },
    applyTagWheelConfigNote: () => { calls.called.push("apply"); return true; },
    ensureGeneratedRulesNow: (reason: string) => { calls.called.push("rules:" + reason); return true; },
    ...(over || {}),
  };
  const actions = buildActions({
    plugin,
    notify: (m: string) => { calls.notes.push(m); },
    confirm: async (o: ConfirmRequest) => { asked.push(o); return yes; },
  });
  return { calls, actions, asked, answer: (v: boolean) => { yes = v; } };
}

{
  const h = makeHost();
  await h.actions["generate-config-note"]!();
  assert.deepEqual(h.calls.called, ["open"], "зовётся метод плагина, а не своя копия его работы");
  assert.equal(h.calls.notes[0], ACTION_TEXTS.GENERATED + ": PKM/Config.md",
    "и человеку сказано, куда написано");
  ok("`Generate` пишет заметку методом плагина и называет путь");
}

{
  const h = makeHost();
  await h.actions["open-config-template"]!();
  await h.actions["regenerate-rules"]!();
  assert.deepEqual(h.calls.called, ["template", "rules:manual"],
    "шаблон и пересборка зовут свои методы, и пересборка называет причину");
  assert.equal(h.calls.notes[1], ACTION_TEXTS.RULES_DONE, "и обе отвечают словами");
  ok("`Open` и `Regenerate` зовут методы плагина");
}

{
  /* Метода нет — человеку говорят, панель работает. */
  const h = makeHost({ ensureGeneratedRulesNow: undefined });
  await h.actions["regenerate-rules"]!();
  assert.deepEqual(h.calls.called, [], "звать нечего");
  assert.ok(h.calls.notes[0]?.includes(ACTION_TEXTS.NO_METHOD),
    "и это сказано, а не проглочено: " + h.calls.notes.join(" | "));
  ok("отсутствие метода — сообщение, а не молчание");
}

{
  /* Метод бросил — сообщение, а не падение панели. */
  const h = makeHost({
    openTagWheelConfigNote: () => { throw new Error("no such folder"); },
  });
  await h.actions["generate-config-note"]!();
  assert.ok(h.calls.notes[0]?.includes("no such folder"),
    "причина показана человеку: " + h.calls.notes.join(" | "));
  ok("ошибка метода доходит до человека словами");
}

/* ---- 3. применение спрашивает (Э2) -------------------------------------- */

{
  const h = makeHost();
  await h.actions["apply-config-note"]!();
  assert.equal(h.asked.length, 1, "спросили один раз");
  assert.equal(h.asked[0]?.title, ACTION_TEXTS.APPLY_TITLE, "и назвали, что произойдёт");
  assert.equal(h.asked[0]?.danger, true, "кнопка согласия отмечена как уносящая данные");
  assert.deepEqual(h.calls.called, ["apply"], "после согласия метод позван");
  ok("Э2: применение заметки спрашивает перед тем, как переписать настройки");
}

{
  const h = makeHost();
  h.answer(false);
  await h.actions["apply-config-note"]!();
  assert.equal(h.asked.length, 1, "спросили");
  assert.deepEqual(h.calls.called, [], "и отказ ничего не позвал");
  assert.deepEqual(h.calls.notes, [], "и ничего не сказал");
  ok("отказ — это отказ: настройки не тронуты");
}

{
  /* Окна подтверждения нет вовсе — применение не идёт. Молчаливое согласие
     в разрушительном действии хуже неработающей кнопки. */
  const calls: string[] = [];
  const actions = buildActions({
    plugin: { applyTagWheelConfigNote: () => { calls.push("apply"); } },
    notify: () => {},
  });
  await actions["apply-config-note"]!();
  assert.deepEqual(calls, [], "без окна подтверждения применение не идёт");
  ok("без окна подтверждения применение не идёт вовсе");
}

console.log("\n" + passed + " проверок пройдено");
