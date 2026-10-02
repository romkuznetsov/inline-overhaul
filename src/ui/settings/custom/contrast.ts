/**
 * Контраст «фон Value — текст» по WCAG 2.1 (PRD 10.13.3, Н15–Н19), без
 * библиотек (З4). Приблизительно: фон панели зависит от темы. Порог — значок,
 * а не запрет (Н17).
 */

/** Цвет в доли 0…1: `#rgb`, `#rrggbb`, `rgb(...)` — так отдаёт `getComputedStyle` цвет темы. */
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
 * `#rrggbb` для поля цвета — образец показывает цвет темы, а не белый (C31,
 * C39). Пусто, если не разобрался (на заглушке). Разбор цвета один (У-32).
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

/** Контраст от 1 до 21; неразобранный цвет — 21, «претензий нет». */
export function contrastRatio(bg: string, fg: string): number {
  const a = relativeLuminance(bg);
  const b = relativeLuminance(fg);
  if (a === null || b === null) return 21;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/** Порог (Н15, 2026-08-28): 3:1 WCAG для элементов интерфейса; 4.5 метил и читаемое белое на красном. */
export const CONTRAST_FLOOR = 3;

/** Подсказка значка с числом (Н16); слова из каталога (10.13.47), здесь подстановка. */
export function contrastWarning(ratio: number, pattern?: string): string {
  const said = pattern
    || "This Value may be hard to read: contrast {0}:1, aim for {1}:1";
  return said.replace("{0}", ratio.toFixed(1)).replace("{1}", String(CONTRAST_FLOOR));
}
