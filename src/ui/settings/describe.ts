/**
 * Описание настройки для платформы (PRD 5.3 П-4, П-10, Ст11).
 *
 * `desc` у определения принимает DocumentFragment, поэтому здесь собирается
 * всё, что читателю нужно видеть под именем настройки:
 *   - само описание, со ссылками в <code> и выделением в <b>;
 *   - «?», раскрывающий подсказку, если подсказки включены;
 *   - строка «Previously called …» для переименованных настроек: отдельного
 *     поля ключевых слов у платформы нет, а поиск идёт по видимому тексту.
 *
 * Фрагменты кешируются по id: getSettingDefinitions вызывается часто (П-11).
 */

import type { SettingDef } from "./types.ts";

/** Минимум от DOM, чтобы модуль собирался и тестировался без браузера. */
export interface FragmentHost {
  createFragment(): DocLike;
}
export interface DocLike {
  appendChild(node: unknown): unknown;
  createEl(tag: string, o?: { text?: string; cls?: string; attr?: Record<string, string> }): DocLike;
  createSpan(o?: { text?: string; cls?: string }): DocLike;
  textContent: string;
}

/** Разбор нашей мини-разметки: <code>, <b>, остальное — текст. */
export function richParts(text: string): Array<{ tag: "text" | "code" | "b"; text: string }> {
  const out: Array<{ tag: "text" | "code" | "b"; text: string }> = [];
  const re = /<(code|b)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ tag: "text", text: text.slice(last, m.index) });
    out.push({ tag: m[1] as "code" | "b", text: m[2] as string });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ tag: "text", text: text.slice(last) });
  return out;
}

function paint(host: DocLike, text: string): void {
  for (const part of richParts(text)) {
    if (part.tag === "text") host.createSpan({ text: part.text });
    else host.createEl(part.tag, { text: part.text, cls: part.tag === "code" ? "io-code" : "" });
  }
}

export interface DescribeOptions {
  /** Тумблер `Show tips` из группы Help. */
  showTips: boolean;
  /** Тексты для строки о переименовании. */
  previouslyCalled?: (names: readonly string[]) => string;
}

const DEFAULT_PREVIOUSLY = (names: readonly string[]) =>
  "Previously called " + names.join(", ");

export class Describer {
  private host: FragmentHost;
  private cache = new Map<string, { key: string; frag: DocLike }>();

  constructor(host: FragmentHost) {
    this.host = host;
  }

  /** Ключ кеша: если тексты и режим подсказок не менялись, фрагмент тот же. */
  private cacheKey(it: SettingDef, o: DescribeOptions): string {
    return [it.desc || "", it.tip || "", (it.searchTerms || []).join("|"), o.showTips ? "1" : "0"].join(" ");
  }

  describe(it: SettingDef, o: DescribeOptions): string | DocLike | undefined {
    const hasSomething = it.desc || (o.showTips && it.tip) || (it.searchTerms && it.searchTerms.length);
    if (!hasSomething) return undefined;

    const key = this.cacheKey(it, o);
    const hit = this.cache.get(it.id);
    if (hit && hit.key === key) return hit.frag;

    const frag = this.host.createFragment();
    if (it.desc) paint(frag, it.desc);

    /*
     * Подсказка свёрнута, пока её не открыли: details и summary дают это
     * без скриптов, работают с клавиатуры и не превращают описание в стену
     * текста. Первый вариант приклеивал tip к desc, и панель стала нечитаемой.
     */
    if (o.showTips && it.tip) {
      const box = frag.createEl("details", { cls: "io-tip" });
      box.createEl("summary", { text: "?", cls: "io-tip__mark" });
      paint(box.createEl("div", { cls: "io-tip__body" }), it.tip);
    }

    this.cache.set(it.id, { key, frag });
    return frag;
  }

  /** Сбросить кеш: язык или режим подсказок сменились целиком. */
  clear(): void {
    this.cache.clear();
  }
}
