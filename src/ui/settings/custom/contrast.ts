/**
 * Контраст пары «фон Value — цвет текста» (PRD 10.13.3, Н15–Н19).
 *
 * Своя функция, а не библиотека: зависимостей у слоя настроек нет (З4), а
 * формула из WCAG 2.1 умещается в двадцать строк.
 *
 * Считается приблизительно и намеренно: чип Value стоит поверх фона панели,
 * который зависит от темы, и точного числа тут быть не может. Порог — повод
 * показать значок, а не запретить цвет (Н17).
 */

/**
 * Разбор цвета в три доли от нуля до единицы: `#rgb`, `#rrggbb` и `rgb(...)`.
 *
 * Форма `rgb(...)` нужна потому, что второй цвет пары часто приходит не от
 * человека, а из темы — через `getComputedStyle`, а тот отдаёт именно её.
 */
function channels(hex: string): [number, number, number] | null {
  const src = String(hex || "").trim().toLowerCase();
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(src);
  if (rgb) {
    const nums = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    if (nums.some(n => !Number.isFinite(n))) return null;
    return [
      Math.min(1, Math.max(0, nums[0] as number / 255)),
      Math.min(1, Math.max(0, nums[1] as number / 255)),
      Math.min(1, Math.max(0, nums[2] as number / 255)),
    ];
  }
  const v = src.replace(/^#/, "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(v)) return null;
  const parts = v.length === 3
    ? [v[0] as string, v[1] as string, v[2] as string].map(c => c + c)
    : [v.slice(0, 2), v.slice(2, 4), v.slice(4, 6)];
  return [
    parseInt(parts[0] as string, 16) / 255,
    parseInt(parts[1] as string, 16) / 255,
    parseInt(parts[2] as string, 16) / 255,
  ];
}

/**
 * Цвет в форме `#rrggbb` — то единственное, что понимает поле выбора цвета.
 *
 * Пусто, если разобрать не удалось: у заглушки DOM `getComputedStyle` нет, и
 * цвет темы там не прочтётся. Это не ошибка, и поле тогда обходится своим
 * запасным значением.
 *
 * Живёт здесь, а не рядом с полем: разбор цвета в панели один, и второй его
 * разбор разошёлся бы с этим на первой правке (У-32). Нужен для того, чтобы
 * образец заливки Value показывал **тот цвет, которым тема и рисует пузырь**,
 * а не белый (замечания заказчика C31 и C39, 2026-09-02).
 */
export function toHexColor(color: string): string {
  const rgb = channels(color);
  if (!rgb) return "";
  const byte = (x: number): string => {
    const n = Math.round(Math.min(1, Math.max(0, x)) * 255);
    return (n < 16 ? "0" : "") + n.toString(16);
  };
  return "#" + byte(rgb[0]) + byte(rgb[1]) + byte(rgb[2]);
}

/** Относительная яркость по WCAG 2.1. */
function relativeLuminance(hex: string): number | null {
  const rgb = channels(hex);
  if (!rgb) return null;
  const lin = rgb.map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * (lin[0] as number) + 0.7152 * (lin[1] as number) + 0.0722 * (lin[2] as number);
}

/**
 * Отношение контраста двух цветов: от 1 (неразличимы) до 21 (чёрное и белое).
 * Цвет, который не разобрался — не повод для предупреждения: возвращается 21,
 * то есть «претензий нет». Цвет из темы мы посчитать не можем, и пугать
 * человека значком из-за этого нельзя.
 */
export function contrastRatio(bg: string, fg: string): number {
  const a = relativeLuminance(bg);
  const b = relativeLuminance(fg);
  if (a === null || b === null) return 21;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Порог читаемости (Н15). 3:1 — порог WCAG 2.1 для крупного текста и элементов
 * интерфейса; решение заказчика 2026-08-28.
 *
 * Почему не 4.5:1, как для обычного текста: пузырь Value ближе к элементу
 * интерфейса, чем к абзацу, и на настоящих цветах заказчика 4.5 давал значок
 * всем трём значениям — включая то, которое читается (белое на красном,
 * 4.0:1). На 3:1 предупреждение остаётся там, где текст правда сливается.
 */
export const CONTRAST_FLOOR = 3;

/** Текст подсказки у значка. Число показывается: оно говорит, далеко ли до нормы (Н16). */
export function contrastWarning(ratio: number): string {
  return "This Value may be hard to read: contrast "
    + ratio.toFixed(1) + ":1, aim for " + CONTRAST_FLOOR + ":1";
}
