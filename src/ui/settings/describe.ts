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

/**
 * Нарисовать нашу мини-разметку в узел.
 *
 * Экспортируется затем, что теми же словами пишутся тексты, которые панель
 * рисует не через `desc`: вводная фраза группы и тело её подсказки. Второй
 * разбор той же разметки разошёлся бы с первым на первой правке (У-32).
 */
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
  /**
   * Тумблер `Show setting ids in tips` с вкладки Advanced (10.13.5).
   *
   * Заказчик называет настройки их id, а не описанием места на экране, и без
   * этой подписи id негде увидеть: отладочный показ id и путей у каждой строки
   * остался в прототипе и в панель не переносится (раздел 12).
   */
  showIds?: boolean;
  /** Тексты для строки о переименовании. */
  previouslyCalled?: (names: readonly string[]) => string;
}

/* Английское живёт в каталоге (10.13.47); сюда оно приходит швом. */
const DEFAULT_PREVIOUSLY = (names: readonly string[]) =>
  "Previously called " + names.join(", ");

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
    ].join(" ");
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

    /*
     * Подсказка свёрнута, пока её не открыли: details и summary дают это
     * без скриптов, работают с клавиатуры и не превращают описание в стену
     * текста. Первый вариант приклеивал tip к desc, и панель стала нечитаемой.
     */
    if ((o.showTips && it.tip) || showId) {
      const box = frag.createEl("details", { cls: "io-tip" });
      /*
       * Обработчика нажатия здесь нет, и его отсутствие — решение, а не
       * забывчивость.
       *
       * До 2026-09-02 на подсказку вешался `addEventListener` со
       * `stopPropagation`: у строки с действием платформа делает кликабельной
       * всю строку, и нажатие на «?» исполняло действие (C9). Правка была
       * бесполезна дважды. **Во-первых**, платформа описание
       * клонирует — `sg(e) = e.cloneNode(true)` в `app.js`, — а `cloneNode`
       * обработчики не переносит: в живом окне этого слушателя не было
       * никогда. **Во-вторых**, строк с действием у панели больше нет: по
       * тому же замечанию C9 все пять стали строками с настоящими кнопками
       * (`kind: "buttons"` → `render`), и перехватывать нечего.
       *
       * Отсюда правило для всего описания: **внутри `desc` не бывает
       * обработчиков.** Всё, что должно отвечать на нажатие, живёт там, где
       * узел принадлежит нам, — как тело подсказки группы.
       */
      box.createEl("summary", { text: "?", cls: "io-tip__mark" });
      const body = box.createEl("div", { cls: "io-tip__body" });
      if (o.showTips && it.tip) paint(body, it.tip);
      /*
       * Id идёт последней строкой подсказки — у настройки без своей подсказки
       * подсказка появляется ради него одного. Так его видно и там, где
       * объяснять нечего.
       */
      if (showId) body.createEl("div", { text: it.id, cls: "io-tip__id" });
    }

    this.cache.set(it.id, { key, frag });
    return frag;
  }

  /** Сбросить кеш: язык или режим подсказок сменились целиком. */
  clear(): void {
    this.cache.clear();
  }
}
