/**
 * Вводный коллаут вкладки (PRD 10.1, К1–К3): шапка, тело, длинное — в
 * подсказке (К2, Ст12). Тексты — `schema/custom_texts.ts`. Кнопки перехода
 * нет (К3, 2026-08-26).
 */

import { TAB_CALLOUTS } from "../schema/custom_texts.ts";
import { calloutKey } from "../texts_custom.ts";
import type { SettingsCtx } from "../types.ts";
import { el, rich, tipBelow, type El } from "./dom.ts";

export function callout(tab: string): (host: El, ctx: SettingsCtx) => () => void {
  return (host: El, ctx: SettingsCtx): (() => void) => {
    const text = TAB_CALLOUTS[tab];
    /* Нет коллаута — ошибка генерации; пустую рамку не рисуем. */
    if (!text) return () => {};

    /* По ключу, выгрузка — запасной ответ (10.13.38, Я4): подстановка схемы
       до `kind: "custom"` не достаёт. */
    const say = (slot: "head" | "tip" | "body"): string =>
      (ctx.t ? ctx.t(calloutKey(tab, slot), text[slot]) : text[slot]);

    const box = el(host, "div", "io-callout");
    const head = el(box, "div", "io-callout__head");
    rich(head, say("head"));
    /* Подсказка под коллаутом: внутри рамки она дёргает панель */
    const closeTip = tipBelow({
      head,
      host,
      text: say("tip"),
      label: "this tab",
      id: "io-tip-callout-" + tab,
      showTips: Boolean(ctx.get("general.help.showTips")),
      showIds: Boolean(ctx.get("advanced.showSettingIds")),
    });
    rich(el(box, "p", "io-callout__body"), say("body"));

    /* Остальное уходит со строкой платформы (С5). */
    return closeTip;
  };
}
