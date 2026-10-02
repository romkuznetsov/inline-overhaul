/**
 * Знак плагина в начале `General` (`В-198`): картинка `.io-brand` в
 * `styles.css` из `docs/brand/`. Декоративный — `aria-hidden`, своих слов нет.
 */

import type { CustomRender } from "../types.ts";
import { el } from "./dom.ts";

export const brandMark: CustomRender = host => {
  const mark = el(host, "div", "io-brand");
  mark.setAttribute("aria-hidden", "true");
  /* Подписок нет, и снимать нечего: строку вместе с узлом убирает платформа. */
  return () => {};
};
