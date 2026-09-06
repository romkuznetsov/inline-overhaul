/**
 * Вводный коллаут вкладки (PRD 10.1, К1–К3).
 *
 * Первый блок каждой вкладки: одна фраза о том, что вкладка делает, абзац о
 * том, чего она не делает без спроса, и кнопка перехода. Длинное объяснение
 * живёт в подсказке, а не в тексте (К2, Ст12).
 *
 * Тексты берутся из `schema/custom_texts.ts` — выгрузки из прототипа. Здесь
 * только поведение: у записи `kind: 'custom'` нет ни `name`, ни `desc`, а
 * значит и вёрстка, и место текста наши.
 *
 * Кнопки перехода в коллауте нет: решение заказчика от 2026-08-26, подробности
 * в 10.1 К3. Ссылка на настройку двумя строками ниже ничего не давала.
 */

import { TAB_CALLOUTS } from "../schema/custom_texts.ts";
import type { SettingsCtx } from "../types.ts";
import { el, rich, tipBelow, type El } from "./dom.ts";

export function callout(tab: string): (host: El, ctx: SettingsCtx) => () => void {
  return (host: El, ctx: SettingsCtx): (() => void) => {
    const text = TAB_CALLOUTS[tab];
    /* Вкладка без коллаута — это ошибка генерации, а не пользовательская
       ситуация: рисовать пустую рамку незачем. */
    if (!text) return () => {};

    const box = el(host, "div", "io-callout");
    const head = el(box, "div", "io-callout__head");
    rich(head, text.head);
    /* «?» в шапке, подсказка — под коллаутом: внутри рамки она раздвигает
       его текст, и это выглядит как прыжок панели */
    const closeTip = tipBelow({
      head,
      host,
      text: text.tip,
      label: "this tab",
      id: "io-tip-callout-" + tab,
      showTips: Boolean(ctx.get("general.help.showTips")),
      showIds: Boolean(ctx.get("advanced.showSettingIds")),
    });
    rich(el(box, "p", "io-callout__body"), text.body);

    /* Снимаем только то, что могли оставить открытым: остальное уходит
       вместе со строкой, которую убирает платформа (С5). */
    return closeTip;
  };
}
