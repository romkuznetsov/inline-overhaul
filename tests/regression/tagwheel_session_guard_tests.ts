/**
 * Пока открыта панель TagWheel, строкой распоряжается она, и больше никто.
 *
 * **Его замечание 2026-09-20** (заметка тестов, тест 4): «при активации
 * field-sub previous в строке у меня не меняется sub на предыдущий, вместо
 * этого курсор прыгает вниз и возникает странный артефакт — визуально у меня на
 * странице несколько кареток курсора».
 *
 * **Что происходило.** Панель на время сессии держит свой вид **в самом
 * документе** (исключение 30 к З3), и перехватывает она только свои клавиши.
 * Хоткей команды в её раскладке не значится, поэтому команда выполнялась — и
 * правила не строку человека, а картинку панели. Измерено стендом
 * `node tools/line_bench.js panelcmd left "- текст" category-sub-previous`: вид
 * панели `- ==**[Imp]** …==` превращался в `- #elder :: текст`, панель
 * оставалась живой, а `Esc` возвращал исходную строку — то есть работа команды
 * пропадала целиком. Дефект старше правок этой сессии: проверено тем же стендом
 * на рантайме коммита до неё (У-187).
 *
 * **Почему проверка здесь, а не в стенде.** Стенд зовёт движок напрямую, а
 * правило стоит в двери команд — `runPkmRuntime` в `plugin_commands.js`.
 * Стендом его не увидеть в принципе: до этой функции он не доходит (У-56).
 *
 * **Что закреплено.**
 *   1. при открытой сессии команда поля не доходит до движка и говорит вслух;
 *   2. открытие самой панели из-под правила выведено: второе нажатие той же
 *      команды — это её `Enter`, им сессия и применяется;
 *   3. без сессии команда идёт как шла — положительный контроль, без него
 *      первые два утверждения выполнялись бы и у двери, забитой наглухо;
 *   4. «панель жива» спрашивается у флага сессии, а не у наличия объекта: шов
 *      `window.__tagWheelState` остаётся на месте и после закрытия.
 */

import assert from "node:assert/strict";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { notices } from "../harness/obsidian_stub.ts";

type Any = any;

const internals = loadPluginInternals();

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/**
 * Плагин-подделка, у которой **вход в движок отравлен**: дошли до него —
 * упали. Так «команда не выполнилась» проверяется тем, что её некуда было
 * выполнить, а не отсутствием следа (У-146).
 */
function poisonedPlugin(): Any {
  return {
    app: {},
    getConfig: () => ({}),
    devLogEvent: () => {},
    /* Отрава стоит ровно на том шве, которым дверь зовёт движок: `runCommand`
       готового рантайма. Отравить загрузку было бы мимо — `ensurePkmRuntime`
       берёт готовый объект с плагина и загрузку не трогает. */
    pkmRuntimeV2: {
      runCommand: () => {
        throw new Error("движок позвали при открытой панели — правило не сработало");
      },
    },
  };
}

/** Состояние окна с открытой или закрытой сессией панели. */
function withSession(active: boolean, body: () => Promise<void>): Promise<void> {
  const prev = (globalThis as Any).window;
  let cancelled = 0;
  (globalThis as Any).window = {
    __tagWheelState: { active, cancel: () => { cancelled++; } },
  };
  return body().finally(() => {
    (globalThis as Any).window = prev;
    void cancelled;
  });
}

async function run(): Promise<void> {
  assert.equal(typeof internals.runPkmRuntime, "function",
    "дверь команд PKM не отдана наружу — проверять нечего");

  /* ---- 1. команда поля при открытой панели ----------------------------- */
  await withSession(true, async () => {
    notices.length = 0;
    await internals.runPkmRuntime(poisonedPlugin(), "statusTags", {});
    assert.equal(notices.length, 1,
      "команда при открытой панели промолчала — а человек звал её сам: "
      + JSON.stringify(notices));
    assert.ok(/TagWheel/.test(String(notices[0] || "")),
      "сообщение не называет причину отказа: " + notices[0]);
  });
  ok("команда поля при открытой панели не доходит до движка и говорит вслух");

  /* ---- 2. открытие панели из-под правила выведено ---------------------- */
  await withSession(true, async () => {
    notices.length = 0;
    await assert.rejects(
      () => internals.runPkmRuntime(poisonedPlugin(), "tagWheel", {}),
      /движок позвали при открытой панели/,
      "команда самой панели остановлена правилом — тогда её нечем применить",
    );
    assert.equal(notices.length, 0,
      "на команду панели выдан отказ, которого быть не должно: " + JSON.stringify(notices));
  });
  ok("открытие панели правилом не останавливается: им же сессия применяется");

  /* ---- 3. положительный контроль: без сессии команда идёт как шла ------- */
  await withSession(false, async () => {
    notices.length = 0;
    await assert.rejects(
      () => internals.runPkmRuntime(poisonedPlugin(), "statusTags", {}),
      /движок позвали при открытой панели/,
      "без открытой панели команда не дошла до движка — значит первые два\n"
      + "  утверждения выполнялись бы и у двери, забитой наглухо",
    );
    assert.equal(notices.length, 0,
      "без панели выдан отказ: " + JSON.stringify(notices));
  });
  ok("без открытой панели команда идёт прежней дорогой");

  /* ---- 4. живость спрашивается у флага, а не у наличия объекта ---------- */
  {
    const prev = (globalThis as Any).window;
    (globalThis as Any).window = { __tagWheelState: { active: false, cancel: () => {} } };
    assert.equal(internals.openTagWheelSession(), null,
      "закрытая сессия названа открытой: шов остаётся на месте и после закрытия");
    assert.equal(internals.closeTagWheelSession(), false,
      "закрывать было нечего, а закрытие отчиталось успехом");

    let cancelled = 0;
    (globalThis as Any).window = {
      __tagWheelState: { active: true, cancel: () => { cancelled++; } },
    };
    assert.ok(internals.openTagWheelSession(), "открытая сессия не найдена");
    assert.equal(internals.closeTagWheelSession(), true, "открытая сессия не закрылась");
    assert.equal(cancelled, 1,
      "закрытие не позвало `cancel` сессии — значит у «как закрывается панель» появился второй ответ");

    (globalThis as Any).window = { __tagWheelState: { active: true } };
    assert.equal(internals.closeTagWheelSession(), false,
      "у сессии без шва закрытия отчитались успехом: у старой сборки его нет");
    (globalThis as Any).window = prev;
  }
  ok("живость сессии спрашивается у флага, а закрытие — у её собственного шва");

  console.log("\n" + passed + " проверок пройдено");
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
