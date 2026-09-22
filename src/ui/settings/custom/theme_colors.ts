/**
 * Цвет темы вместо чёрного в поле выбора цвета (PRD 10.13.23, замечание H4).
 *
 * **Зачем модуль.** Поле выбора цвета декларативного API принимает только
 * `HexString` (`SettingColorControl` в типах пакета `obsidian`); пустая строка
 * для него не цвет, и площадка рисует её чёрным. Отсюда «при восстановлении
 * цветов по умолчанию в tagwheel все цвета — черные»: чёрное человек видит в
 * панели, а не в заметке — в заметке при пустом значении слой красит цветом
 * темы.
 *
 * Решение заказчика 2026-09-04, вечер: **брать переменные темы Obsidian**, а не
 * коды цвета. В значении переменной не положить — контрол её не примет, —
 * поэтому пустое значение остаётся пустым (второго смысла у пустоты в панели
 * быть не должно, 10.13.15 Н2), а полю отдаётся **резолвнутый** цвет темы
 * запасным значением (`defaultValue`).
 *
 * **Одно объявление на два конца.** Здесь названо, какой переменной красится
 * каждая настройка; тем же именем красит и слой оформления в заметке. Второе
 * объявление разошлось бы с этим на первой правке (У-32), и разошлось бы
 * молча: поле показывало бы одно, строка — другое.
 *
 * Чтение темы вынесено швом. Без DOM (в проверках) читать нечего, и модуль
 * отдаёт пустую строку — то есть поведение остаётся прежним, а не выдуманным.
 */

import { toHexColor } from "./contrast.ts";

/**
 * Настройка → переменная темы, которой она красится, пока цвет не задан.
 *
 * Пары взяты у самой Obsidian, а не собраны на глаз: `--text-highlight-bg`
 * это ровно то, чем Obsidian красит `==…==`, и панель TagWheel обособлена
 * именно им. Заказчик просил «серый текст, акцентный активный, фоновая
 * заливка» — это они и есть, только именами темы, а не кодами.
 */
export const THEME_COLOR_VARS: Readonly<Record<string, string>> = {
  "visual.tagWheel.textColor": "--text-muted",
  "visual.tagWheel.activeTextColor": "--text-accent",
  "visual.tagWheel.chosenValueColor": "--text-muted",
  "visual.tagWheel.fillColor": "--text-highlight-bg",
  "visual.tagWheel.scroller.fillColor": "--background-primary",
  "visual.tagWheel.scroller.textColor": "--text-normal",
  /*
   * Остальные шесть полей цвета жили без переменной, и поле показывало им
   * чёрное — его замечание к тесту 6, 2026-09-22: «мне не нравится, что при
   * восстановлении цвета по умолчанию цвет становится hex #000000 — я хочу,
   * чтобы он становился дефолтным цветом obsidian (для кавычек — серый, для
   * ссылки — стальной)».
   *
   * Каждая пара взята **у того, кто рисует, когда цвет не задан**, а не
   * подобрана: иначе поле обещало бы одно, а строка показывала другое.
   */
  /* Полоса Block: `buildBlockFillStyleCss` пишет `var(--text-accent)`. */
  "visual.tags.blockFill.color": "--text-accent",
  /*
   * Имя внутри `[[…]]` и сами скобки. Наши правила при пустом значении ставят
   * `inherit`, то есть отдают цвет тому, кто красил ссылку до нас, — а это
   * сама Obsidian: `--link-color` у имени (`app.css` 1.13.7, строка 2424:
   * `--link-color: var(--text-accent)`) и `--text-faint` у скобок
   * (`span.cm-formatting-link`, строка 13465). Ровно те «стальной» и «серый»,
   * которые он и назвал.
   */
  "visual.tags.linkAsWritten.targetColor": "--link-color",
  "visual.tags.linkAsWritten.bracketsColor": "--text-faint",
  /*
   * Та же пара у гиперссылки, и переменные у неё **другие** — прочитаны в
   * `app.css` 1.13.7, а не подобраны по сходству. Подпись `[текста](адреса)` и
   * голый адрес рисует `--link-external-color` (строки 13359 и 13448:
   * `.cm-link .cm-underline` и `span.cm-url`), квадратные скобки —
   * `--text-faint` (`span.cm-formatting-link`, строка 13465). Внешняя ссылка и
   * wikilink у Obsidian разного цвета, и поле, обещающее цвет соседа,
   * показывало бы не то, что нарисует строка.
   */
  "visual.tags.hyperlink.targetColor": "--link-external-color",
  "visual.tags.hyperlink.bracketsColor": "--text-faint",
  /* Каретка: `.io-caret` в стилях берёт `var(--text-normal)`. */
  "visual.caret.color": "--text-normal",
  /* Круг при прыжке: `.io-jumpflash` берёт `var(--interactive-accent)`. */
  "visual.jumpFlash.color": "--interactive-accent",
  /*
   * Перенесённая строка: при пустом значении декорация не пишет `color`
   * вовсе, и строка остаётся обычного цвета текста.
   */
  "transform.inline2note.sourceProcessing.visual.color": "--text-normal",
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

/**
 * Подменить чтение темы. Нужно ровно одному месту — проверке: `getComputedStyle`
 * из неё недостижим, и без подмены тут проверялась бы пустота.
 */
export function setThemeReader(next: ThemeReader | null): void {
  reader = next;
}

/**
 * Значение переменной темы, **разобранное браузером**, а не прочитанное как
 * текст.
 *
 * `getPropertyValue` у своей переменной отдаёт не цвет, а то, что написано в
 * теме, — и у его `Minimal` там `hsl( 0, calc(0% - 20%), calc(96% - 50%) )`,
 * `white`, `rgba(...)`. Наш разбор цвета знает `#rgb`, `#rrggbb` и `rgb(...)`
 * и на остальном честно отвечает «не разобрал» — то есть `defaultValue` у
 * поля цвета оставалось пустым, и кнопка Obsidian «восстановить значение по
 * умолчанию» ставила пустое, а поле рисовало его **чёрным**. Он пришёл с этим
 * дважды, и вторым разом назвал `scroller-fill` — у которого переменная темы
 * была с самого начала.
 *
 * Измерено на его теме: из восьми переменных семь приходят в форме, которую
 * наш разбор не понимает, а через узел все восемь дают `rgb(...)`.
 *
 * Поэтому значение пропускается через настоящий узел: браузер считает
 * `var(...)`, `calc(...)`, `hsl(...)` и `color-mix(...)` сам, и разбирать нам
 * остаётся одну форму — ту, которую он и отдаёт.
 *
 * **Пустая переменная остаётся пустой.** `color: var(--нет-такой)` — это
 * недействительное объявление, и узел унаследовал бы цвет родителя; поэтому
 * сперва спрашивается, объявлена ли переменная вообще.
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
    /*
     * Узел живёт внутри одного вызова: его добавляют, спрашивают и снимают,
     * не отдав кадр, — то есть на экран он не попадает и прятать его нечем.
     * Пустой `span` без текста места не занимает.
     */
    const probe = doc.createElement("span");
    probe.style.setProperty("color", "var(" + variable + ")");
    body.appendChild(probe);
    const solved = String((g.getComputedStyle(probe) || {}).color || "").trim();
    if (typeof probe.remove === "function") probe.remove();
    return solved || raw;
  } catch (_err) {
    /* Проба: узла, стилей или тела может не быть — «нет» здесь ответ, а не
       отказ, и поле обходится тем, что было. */
    return "";
  }
}

/**
 * Цвет темы для настройки в форме `#rrggbb` — то единственное, что понимает
 * поле выбора цвета. Пусто, если у настройки нет переменной или тему прочесть
 * нечем: тогда поле обходится тем, что было, а не выдуманным цветом.
 */
export function themeColorFor(path: string): string {
  const variable = themeVarFor(path);
  if (!variable) return "";
  return toHexColor(readVariable(variable));
}
