/**
 * Описание настройки для платформы (PRD 5.3 П-4, П-10, Ст11): `desc` принимает
 * DocumentFragment — описание с <code>/<b> и «?» подсказки.
 *
 * Прежних имён здесь нет: поиск по ним — `aliases` из `searchTerms` в
 * `to_definitions.ts`; шов `previouslyCalled` снят 2026-09-08 (У-64).
 *
 * Фрагменты кешируются по id: getSettingDefinitions вызывается часто (П-11).
 */

import type { NamedDef } from "./types.ts";

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

/** Нарисовать мини-разметку в узел. Экспорт — для вводной и подсказки группы: один разбор (У-32). */
export function paintRich(host: DocLike, text: string): void {
  for (const part of richParts(text)) {
    if (part.tag === "text") host.createSpan({ text: part.text });
    else host.createEl(part.tag, { text: part.text, cls: part.tag === "code" ? "io-code" : "" });
  }
}

const paint = paintRich;

export interface DescribeOptions {
  /** Тумблер `Show tips` из группы Help. */
  showTips: boolean;
  /** Тумблер `Show option IDs in tips` с вкладки Advanced (10.13.5): иначе id настройки негде увидеть (раздел 12). */
  showIds?: boolean;
  /** Значение контрола по пути: `id = значение` в подписи (цикл 121). */
  valueOf?: (path: string) => unknown;
}

/**
 * Подпись id с нынешним значением — его пункт цикла 121: «чтобы в tip было
 * `show-setting-ids = on`». Списки и пустое — одним id: значение не напечатать.
 */
export function idLine(id: string, value: unknown): string {
  if (typeof value === "boolean") return id + " = " + (value ? "on" : "off");
  if (typeof value === "number") return id + " = " + String(value);
  if (typeof value === "string") return id + " = " + (value === "" ? "\"\"" : value);
  return id;
}

export class Describer {
  private host: FragmentHost;
  private cache = new Map<string, { key: string; frag: DocLike }>();

  constructor(host: FragmentHost) {
    this.host = host;
  }

  /** Ключ кеша: если тексты и режимы не менялись, фрагмент тот же. */
  private cacheKey(it: NamedDef, o: DescribeOptions): string {
    return [
      it.desc || "",
      it.tip || "",
      (it.searchTerms || []).join("|"),
      o.showTips ? "1" : "0",
      o.showIds ? "1" : "0",
      this.idText(it, o),
    ].join(" ");
  }

  private idText(it: NamedDef, o: DescribeOptions): string {
    const path = (it as { path?: unknown }).path;
    return typeof path === "string" && o.valueOf ? idLine(it.id, o.valueOf(path)) : it.id;
  }

  describe(it: NamedDef, o: DescribeOptions): string | DocLike | undefined {
    /* Подпись id живёт в подсказке, поэтому и появляется вместе с подсказками. */
    const showId = Boolean(o.showTips && o.showIds && it.id);
    const hasSomething = it.desc
      || (o.showTips && it.tip)
      || showId
      || (it.searchTerms && it.searchTerms.length);
    if (!hasSomething) return undefined;

    const key = this.cacheKey(it, o);
    const hit = this.cache.get(it.id);
    if (hit && hit.key === key) return hit.frag;

    const frag = this.host.createFragment();
    if (it.desc) paint(frag, it.desc);

    /* Подсказка свёрнута: details/summary — без скриптов и с клавиатуры. */
    if ((o.showTips && it.tip) || showId) {
      const box = frag.createEl("details", { cls: "io-tip" });
      /*
       * Обработчиков внутри `desc` не бывает: платформа описание клонирует
       * (`sg(e) = e.cloneNode(true)` в `app.js`), а `cloneNode` слушателей не переносит.
       * Строк с действием больше нет (C9). Отвечающее на нажатие живёт в своих узлах.
       */
      box.createEl("summary", { text: "?", cls: "io-tip__mark" });
      const body = box.createEl("div", { cls: "io-tip__body" });
      if (o.showTips && it.tip) paint(body, it.tip);
      /* Id — последней строкой; ради него подсказка появляется и у настройки без своей. */
      if (showId) {
        /* Путь — в атрибуте: описание клонируется, и значение при раскрытии
           освежает `SettingsPane.freshenTipValue` (запись определений не пересобирает). */
        const path = (it as { path?: unknown }).path;
        body.createEl("div", {
          text: this.idText(it, o), cls: "io-tip__id",
          attr: typeof path === "string" ? { "data-io-path": path, "data-io-id": it.id } : {},
        });
      }
    }

    this.cache.set(it.id, { key, frag });
    return frag;
  }

  /** Сбросить кеш: язык или режим подсказок сменились целиком. */
  clear(): void {
    this.cache.clear();
  }
}
