/**
 * Знак плагина в начале вкладки `General` (`В-198`, его выбор 2026-09-23).
 *
 * Сам знак — картинка в `styles.css` (`.io-brand`), готовый файл из
 * `docs/brand/`. Здесь только узел, на котором она стоит. Декоративный:
 * вкладку называет Obsidian, и программе чтения с экрана знак ничего не
 * добавляет, поэтому `aria-hidden` — и своих слов у блока нет.
 */

import type { CustomRender } from "../types.ts";
import { el } from "./dom.ts";

export const brandMark: CustomRender = host => {
  const mark = el(host, "div", "io-brand");
  mark.setAttribute("aria-hidden", "true");
  /* Подписок нет, и снимать нечего: строку вместе с узлом убирает платформа. */
  return () => {};
};
