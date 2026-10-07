/**
 * Цвет темы вместо чёрного в поле выбора цвета (PRD 10.13.23, H4).
 *
 * Поле цвета API принимает только `HexString` и пустое рисует чёрным. Пустое
 * значение остаётся пустым (10.13.15 Н2), а полю отдаётся резолвнутый цвет темы
 * как `defaultValue` (решение 2026-09-04). Здесь же названо, какой переменной
 * красит слой в заметке — одно объявление на оба конца (У-32). Без DOM — пусто.
 */

import { toHexColor } from "./contrast.ts";

/** Настройка → переменная темы, которой красит сама Obsidian, пока цвет не задан. */
export const THEME_COLOR_VARS: Readonly<Record<string, string>> = {
  /* Свои переменные `styles.css`: в тёмной теме у них другие пары (H1.5). */
  "visual.tagWheel.textColor": "--io-tw-text",
  "visual.tagWheel.activeTextColor": "--io-tw-active",
  "visual.tagWheel.chosenValueColor": "--io-tw-text",
  "visual.tagWheel.fillColor": "--io-tw-fill-theme",
  "visual.tagWheel.scroller.fillColor": "--background-primary",
  "visual.tagWheel.scroller.textColor": "--text-normal",
  /* Каждая пара — у того, кто рисует при незаданном цвете (2026-09-22, тест 6). */
  /* Полоса Block: `buildBlockFillStyleCss` пишет `var(--text-accent)`. */
  "visual.tags.blockFill.color": "--text-accent",
  /*
   * Пусто → наши правила ставят `inherit`, красит Obsidian: имя — `--link-color`
   * (`app.css` 1.13.7, строка 2424), скобки — `--text-faint` (`span.cm-formatting-link`, 13465).
   */
  "visual.tags.linkAsWritten.targetColor": "--link-color",
  "visual.tags.linkAsWritten.bracketsColor": "--text-faint",
  /*
   * У гиперссылки переменные другие (`app.css` 1.13.7): подпись и адрес —
   * `--link-external-color` (13359, 13448: `.cm-link .cm-underline`, `span.cm-url`),
   * скобки — `--text-faint` (13465).
   */
  "visual.tags.hyperlink.targetColor": "--link-external-color",
  "visual.tags.hyperlink.bracketsColor": "--text-faint",
  /* Адрес в `(…)` — `span.cm-url`, `--link-external-color` (`app.css` 1.13.7, 13448), не цвет скобок. */
  "visual.tags.hyperlink.addressColor": "--link-external-color",
  /* Каретка: `.io-caret` в стилях берёт `var(--text-normal)`. */
  "visual.caret.color": "--text-normal",
  /* Перенесённые строки: `.io-moved-line` берёт `var(--text-selection)`. */
  "navigation.moveLine.highlightColor": "--text-selection",
  /* Круг при прыжке: `.io-jumpflash` берёт `var(--interactive-accent)`. */
  "visual.jumpFlash.color": "--interactive-accent",
  /* Пусто — декорация не пишет `color`, строка цвета текста. */
  "transform.inline2note.sourceProcessing.visual.color": "--text-normal",
  /* Отмеченная строка (`done-dim`) — тот же случай: пусто — цвет текста. */
  "pkm.behavior.doneMarker.visual.color": "--text-normal",
};

/** Переменная темы для настройки; пусто — у настройки её нет. */
export function themeVarFor(path: string): string {
  return Object.prototype.hasOwnProperty.call(THEME_COLOR_VARS, path)
    ? String(THEME_COLOR_VARS[path])
    : "";
}

/** Чем читается тема. В окне это `getComputedStyle`, в проверках — подделка. */
export interface ThemeReader {
  (variable: string): string;
}

let reader: ThemeReader | null = null;

/** Подмена чтения темы — для проверки, где `getComputedStyle` недостижим. */
export function setThemeReader(next: ThemeReader | null): void {
  reader = next;
}

/**
 * Значение переменной, разобранное браузером через узел: тема пишет `hsl(calc…)`,
 * `white`, `rgba(...)`, а наш разбор знает лишь `#rgb`/`#rrggbb`/`rgb(...)`
 * (Minimal: 7 из 8 не разбирались, `scroller-fill`). Необъявленная переменная —
 * пусто: иначе узел унаследовал бы цвет родителя.
 */
function readVariable(variable: string): string {
  if (reader) return String(reader(variable) || "");
  const g = globalThis as unknown as {
    getComputedStyle?: (el: unknown) => { getPropertyValue: (n: string) => string; color?: string };
    document?: {
      body?: { appendChild?: (n: unknown) => unknown };
      createElement?: (tag: string) => {
        style: { setProperty: (n: string, v: string) => void };
        remove?: () => void;
      };
    };
  };
  const doc = g.document;
  const body = doc && doc.body;
  if (typeof g.getComputedStyle !== "function" || !doc || !body) return "";
  try {
    const raw = String(g.getComputedStyle(body).getPropertyValue(variable) || "").trim();
    if (!raw) return "";
    if (typeof doc.createElement !== "function" || typeof body.appendChild !== "function") return raw;
    /* Узел добавляется и снимается в одном вызове, до кадра — на экран не попадает. */
    const probe = doc.createElement("span");
    probe.style.setProperty("color", "var(" + variable + ")");
    body.appendChild(probe);
    const solved = String((g.getComputedStyle(probe) || {}).color || "").trim();
    if (typeof probe.remove === "function") probe.remove();
    return solved || raw;
  } catch (_err) {
    /* Проба: узла, стилей или тела может не быть — «нет» здесь ответ, поле обходится прежним. */
    return "";
  }
}

/** Цвет темы в `#rrggbb` для поля цвета; пусто — нет переменной или тему не прочесть. */
export function themeColorFor(path: string): string {
  const variable = themeVarFor(path);
  if (!variable) return "";
  return toHexColor(readVariable(variable));
}
