/**
 * Знак плагина в начале `General` (`В-198`): картинка `.io-brand` в
 * `styles.css` из `docs/brand/`, под ней строка README (его ответ цикла 134).
 */

import type { CustomRender } from "../types.ts";
import { el } from "./dom.ts";
import { sayIn } from "../texts_blocks.ts";

export const brandMark: CustomRender = (host, ctx) => {
  const mark = el(host, "div", "io-brand");
  mark.setAttribute("aria-hidden", "true");
  el(host, "div", "io-brand__tagline").textContent = sayIn("brand-mark", ctx)("TAGLINE");
  /* Подписок нет, и снимать нечего: строку вместе с узлом убирает платформа. */
  return () => {};
};
