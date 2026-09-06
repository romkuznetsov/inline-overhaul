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
  "visual.tagWheel.fillColor": "--text-highlight-bg",
  "visual.tagWheel.scroller.fillColor": "--background-primary",
  "visual.tagWheel.scroller.textColor": "--text-normal",
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

function readVariable(variable: string): string {
  if (reader) return String(reader(variable) || "");
  const g = globalThis as unknown as {
    getComputedStyle?: (el: unknown) => { getPropertyValue: (n: string) => string };
    document?: { body?: unknown };
  };
  if (typeof g.getComputedStyle !== "function" || !g.document || !g.document.body) return "";
  try {
    return String(g.getComputedStyle(g.document.body).getPropertyValue(variable) || "");
  } catch (_err) {
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
