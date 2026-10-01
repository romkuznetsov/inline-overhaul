/**
 * **Окно `Add a Field`: главное сразу и живой предпросмотр** — его заказ
 * 2026-09-27 («при создании field для каждого вида type давать сразу настроить
 * ключевые настройки… в этой форме должен быть live preview… как будет
 * выглядеть field в tagwheel панели и в строке»).
 *
 * **Цикл 98, его замечания к тесту 3** (2026-09-28) переложили окно:
 * - предпросмотр — **внизу, рядом с кнопками**, и в нём две половины рядом:
 *   tagWheel (имя Field — постоянная ячейка, под ней скроллер со всеми Values,
 *   по которому сам ходит курсор, как командой `next`) и строка, где Value
 *   меняется вместе с курсором. Строка одной формы в обеих половинах: его
 *   разделители и место по Block, у custom block — внутри текста;
 * - у **Tag** — цвет заливки и цвет текста, у **Link** — одна строка
 *   добавления с подсказкой заметок vault (подсказку рисует платформа) и
 *   `Use as MOC`; «все заметки папки» снято — он не понял, зачем оно;
 * - у **Element** — знак (заглушка нейтральна: `📅` в поле читался как уже
 *   выбранный), вид значения `Date and time` / `Counter` / `Random`, у даты —
 *   что показывать (дата, время, оба) и что делает нажатие (шаг или момент),
 *   и шаг. «List» прежнего окна писал шаги-числа, а предпросмотр показывал их
 *   словами — снят до режима списка у Element (его пункт в «Новое пишите
 *   сюда», отдельная работа);
 * - у всех — свойство YAML (`io-field-yaml-property` правой колонки).
 *
 * Здесь только вёрстка и черновик: запись — `configureNewField` модели, окно
 * платформы — `fields_editor.ts`. Вёрстка рисуется на заглушке DOM, поэтому
 * платформа приходит швами (`noteExists`, `ctx.platform`).
 */

import type { El, ElButton, ElInput } from "./dom.ts";
import { el, btn, cssVar, rich, textInput, themePair, tipBelow } from "./dom.ts";
import type { NewFieldSetup, FieldSide } from "./fields_model.ts";
import type { FieldKind, SettingsCtx } from "../types.ts";
import { applyTagVars, bubble, drawWrittenLink } from "./previews.ts";
import { attachPicker, PICK_ALL } from "./char_picker.ts";
import { toHexColor } from "./contrast.ts";
import { propertyPicker, vaultProperties } from "./yaml_property.ts";
import { attachRowDrag, type DragHold } from "./row_drag.ts";
import sharedUtils from "../../../core/shared_utils.js";

type Say = (name: string, ...args: readonly (string | number)[]) => string;

/** Ответ окна: то, что заводит `addField`, и то, что донастраивает модель. */
export interface NewFieldAnswer {
  name: string;
  kind: FieldKind;
  marker?: string;
  setup: NewFieldSetup;
}

export interface NewFieldFormOpts {
  say: Say;
  ctx: SettingsCtx;
  showTips: boolean;
  showIds: boolean;
  /** Свои блоки: кнопка Block на каждый. */
  blocks: ReadonlyArray<{ id: string; name: string }>;
  /** Ошибка имени тем же правилом, что у заведения; пусто — имя законно. */
  checkName: (name: string) => string;
  /** Пути заметок vault для подсказки Link; нет платформы — пусто. */
  notes?: () => readonly string[];
  noteExists?: (target: string) => boolean;
  /** Это написание уже у другого Field (`В-209`); нет шва — не спрашиваем. */
  valueTaken?: (token: string, kind: FieldKind) => boolean;
  holdKeys?: (onEscape: () => void) => () => void;
  done: (answer: NewFieldAnswer | null) => void;
}

/** Что пишет Element; `list` — свои Values со своим знаком каждое (`В-247`). */
export type ElementValue = "datetime" | "counter" | "random" | "list";
/** Что показывает дата. */
export type DateShows = "date" | "time" | "datetime";

/** Формат по тому, что показывает дата. Порядок — порядок кнопок. */
export const DATE_SHOWS: ReadonlyArray<{ id: DateShows; name: string; format: string }> = [
  { id: "date", name: "NF_SHOWS_DATE", format: "YYYY-MM-DD" },
  { id: "time", name: "NF_SHOWS_TIME", format: "HH:mm" },
  { id: "datetime", name: "NF_SHOWS_BOTH", format: "YYYY-MM-DD HH:mm" },
];

const TYPES: ReadonlyArray<{ kind: FieldKind; name: string; desc: string }> = [
  { kind: "tag", name: "NEW_FIELD_TYPE_TAG", desc: "NF_TYPE_TAG_DESC" },
  { kind: "wikilink", name: "NEW_FIELD_TYPE_LINK", desc: "NF_TYPE_LINK_DESC" },
  { kind: "element", name: "NEW_FIELD_TYPE_ELEMENT", desc: "NF_TYPE_ELEMENT_DESC" },
];

/** Черновик окна. Одно состояние на всё: вёрстка и предпросмотр читают его. */
export interface NewFieldDraft {
  kind: FieldKind;
  name: string;
  side: FieldSide;
  /** Block выбран руками — смена типа его больше не трогает. */
  sideChosen: boolean;
  values: Array<{ token: string; fill?: string; text?: string }>;
  marker: string;
  value: ElementValue;
  shows: DateShows;
  /** Нажатие у даты: шаг от сегодня или момент нажатия. */
  press: "step" | "now";
  step: number;
  random: "randomN" | "randomE";
  format: string;
  /** Link: писать ли ссылки на новые заметки в заметки его Values. */
  moc: boolean;
  property: string;
}

/** Block по умолчанию: тег слева, ссылка и Element справа — как у стартового набора. */
const defaultSide = (kind: FieldKind): FieldSide => (kind === "tag" ? "left" : "right");

export function freshDraft(): NewFieldDraft {
  return {
    kind: "tag", name: "", side: "left", sideChosen: false, values: [], marker: "",
    value: "datetime", shows: "date", press: "step", step: 1, random: "randomN", format: "YYYY-MM-DD",
    moc: true, property: "",
  };
}

/** Адрес Value так, как его пишет строка: без решётки и без скобок ссылки. */
function bare(token: string, kind: FieldKind): string {
  const t = String(token || "").trim();
  if (kind === "tag") return t.replace(/^#+/, "");
  return sharedUtils.wikilinkTargetOf(t) || t;
}

/**
 * Ссылка так, как её запишет Field: подпись после `|` остаётся
 * (`normalizeToken` её хранит; BUGHUNT A14 — чип показывал `[[Alias Target]]`).
 */
function linkText(token: string): string {
  const t = String(token || "").trim();
  return t.startsWith("[[") && t.endsWith("]]") ? t : "[[" + t + "]]";
}

/** Готово ли к `Add`: имя и знак Element — без них Field не работает. */
export function draftProblem(d: NewFieldDraft, checkName: (n: string) => string, say: Say,
  taken?: (token: string, kind: FieldKind) => boolean): string {
  if (!d.name.trim()) return say("NF_NEED_NAME");
  const bad = checkName(d.name);
  if (bad) return bad;
  if (d.kind === "element" && d.value !== "list" && !d.marker.trim()) return say("NF_NEED_EMOJI");
  /* Value тега и списка — одно слово: строку делят по пробелам (BUGHUNT 2026-09-30, A4, A5). */
  if (d.kind === "tag" && d.values.some(v => /\s/.test(bare(v.token, "tag")))) return say("ERR_VALUE_SPACE");
  if (d.kind === "element" && d.value === "list" && d.values.some(v => /\s/.test(v.token.trim()))) return say("ERR_LIST_VALUE_SPACE");
  /* Занятое другим Field при создании молча выпадало (BUGHUNT A13). */
  if (taken && d.kind !== "element" && d.values.some(v => taken(v.token, d.kind))) return say("ERR_VALUE_TAKEN");
  return "";
}

/** Шаг нажатия: целое от единицы. */
const stepOf = (d: NewFieldDraft): number => Math.max(1, Math.trunc(Number(d.step) || 1));

/** Ответ окна из черновика. */
export function answerOf(d: NewFieldDraft): NewFieldAnswer {
  const setup: NewFieldSetup = { side: d.side };
  if (d.kind === "element" && d.value === "list") {
    setup.element = { mode: "list", format: "", list: d.values.map(v => v.token.trim()).filter(Boolean) };
  } else if (d.kind === "element") {
    const format = d.format.trim() || (d.value === "counter" ? "1" : d.value === "random" ? "0000" : "YYYY-MM-DD");
    setup.element = d.value === "random"
      ? { mode: "command", command: d.random, format }
      : d.value === "datetime" && d.press === "now"
        ? { mode: "command", command: "now", format }
        : { mode: "increment", incrementBy: stepOf(d), format };
  } else if (d.values.length) {
    setup.values = d.values.map(v => {
      const out: { token: string; fill?: string; text?: string } = { token: v.token };
      if (v.fill) out.fill = v.fill;
      if (v.text) out.text = v.text;
      return out;
    });
  }
  if (d.kind === "wikilink" && !d.moc) setup.moc = false;
  if (d.property.trim()) setup.property = d.property.trim();
  const out: NewFieldAnswer = { name: d.name.trim(), kind: d.kind, setup };
  if (d.kind === "element" && d.value !== "list") out.marker = d.marker.trim();
  return out;
}

/* ---- значения для предпросмотра ----------------------------------------- */

/**
 * Единица шага даты — самая мелкая в формате, как у движка: `mm` — минуты,
 * `HH` — часы, `DD` — дни. Регистр различает минуты и месяц.
 */
function unitOf(format: string): "minute" | "hour" | "day" | "month" | "year" {
  if (/mm/.test(format)) return "minute";
  if (/HH/.test(format)) return "hour";
  if (/DD/.test(format)) return "day";
  if (/MM/.test(format)) return "month";
  return "year";
}

function addUnit(now: Date, unit: ReturnType<typeof unitOf>, n: number): Date {
  const at = new Date(now.getTime());
  if (unit === "minute") at.setMinutes(at.getMinutes() + n);
  else if (unit === "hour") at.setHours(at.getHours() + n);
  else if (unit === "day") at.setDate(at.getDate() + n);
  else if (unit === "month") at.setMonth(at.getMonth() + n);
  else at.setFullYear(at.getFullYear() + n);
  return at;
}

/** Сколько значений Element показывает скроллер: сегодня и четыре шага вперёд. */
const SERIES = 5;

/**
 * Values Field так, как их увидит скроллер: у Tag и Link — его список, у
 * Element — ряд шагов от сегодня (у момента нажатия он один, у случайного —
 * три примера). `now` — снаружи: проверка задаёт своё время (правило 76).
 */
export function previewValues(d: NewFieldDraft, now: Date): Array<{ text: string; fill?: string; color?: string }> {
  if (d.kind === "tag") return d.values.map(v => ({ text: "#" + bare(v.token, "tag"), ...(v.fill ? { fill: v.fill } : {}), ...(v.text ? { color: v.text } : {}) }));
  if (d.kind === "wikilink") return d.values.map(v => ({ text: linkText(v.token) }));
  /* Element-список: Value пишется как есть, знак в нём самом. */
  if (d.value === "list") return d.values.map(v => ({ text: v.token.trim() }));
  const fmt = d.format.trim();
  if (d.value === "random") {
    return [0, 1, 2].map(() => ({ text: d.marker + String(sharedUtils.renderCommandValueByFormat(fmt || "0000", d.random, now)) }));
  }
  if (d.value === "counter") {
    const digits = /^\d+$/.test(fmt) ? fmt : "1";
    return Array.from({ length: SERIES }, (_, k) => ({
      text: d.marker + String(Number(digits) + k * stepOf(d)).padStart(digits.length, "0"),
    }));
  }
  const mask = fmt || "YYYY-MM-DD";
  if (d.press === "now") return [{ text: d.marker + String(sharedUtils.formatDateByMask(now, mask)) }];
  const unit = unitOf(mask);
  return Array.from({ length: SERIES }, (_, k) => ({
    text: d.marker + String(sharedUtils.formatDateByMask(addUnit(now, unit, k * stepOf(d)), mask)),
  }));
}

/** Сколько строк скроллера видно разом: окно вокруг курсора, как у настоящего. */
const WHEEL_WINDOW = 5;

/**
 * **Предпросмотр: tagWheel и строка рядом** (его замечание к тесту 3 цикла
 * 98). В обеих половинах строка одной формы — `имя :: lorem ipsum` у Left,
 * `lorem ipsum :: имя` у Right, Field внутри текста у custom block, — и
 * разделители его. Слева на месте Field стоит ячейка с его именем, под ней
 * скроллер со всеми Values; справа на том же месте — Value, на котором стоит
 * курсор скроллера. `at` — номер этого Value: окно двигает его само.
 *
 * Классы и переменные — предпросмотров панели (`io-wheel*`, `io-line`,
 * `applyTagVars`): вид берётся из его настроек оформления (У-32).
 */
export function drawNewFieldPreview(host: El, ctx: SettingsCtx, d: NewFieldDraft, say: Say, now: Date, at = 0,
  values: ReadonlyArray<{ text: string; fill?: string; color?: string }> = previewValues(d, now)): void {
  host.empty();
  const name = d.name.trim() || say("NEW_FIELD_NAME_HINT");
  const n = values.length;
  const cur = n ? values[((at % n) + n) % n] : undefined;
  const custom = String(d.side).startsWith("custom:");
  const left = d.side === "left";
  const sep1 = String(ctx.get("pkm.lineFormat.separator1") ?? "");
  const sep2 = String(ctx.get("pkm.lineFormat.separator2") ?? "");
  const sample = say("NF_SAMPLE_TEXT");

  /* Строка одной формы: `slot` рисует то, что стоит на месте Field. */
  const shape = (line: El, slot: (side: El) => void): void => {
    if (custom) {
      const words = sample.split(" ");
      el(line, "span", "io-line__text", (words[0] || "") + " ");
      slot(el(line, "span", "io-line__side io-line__side--right"));
      el(line, "span", "io-line__text", " " + words.slice(1).join(" "));
      return;
    }
    if (left) {
      slot(el(line, "span", "io-line__side io-line__side--left"));
      el(line, "span", "io-line__sep", sep1);
      el(line, "span", "io-line__text", sample);
      return;
    }
    el(line, "span", "io-line__text", sample);
    el(line, "span", "io-line__sep", sep2);
    slot(el(line, "span", "io-line__side io-line__side--right"));
  };

  /* tagWheel: ячейка — имя Field, скроллер — все его Values, курсор на `cur`. */
  const wheelPane = el(host, "div", "io-nf__pane io-nf__pane--wheel");
  el(wheelPane, "div", "io-nf__plabel", "tagWheel");
  const shown = Math.min(n, WHEEL_WINDOW);
  cssVar(wheelPane, "--io-nf-rows", String(Math.max(1, shown)));
  const wline = el(wheelPane, "div", "io-line io-line--wheel io-nf__pline");
  applyTagVars(wline, ctx, { blockFill: false, plainSize: true });
  const activeText = String(ctx.get("visual.tagWheel.activeTextColor") ?? "");
  const scrollFill = String(ctx.get("visual.tagWheel.scroller.fillColor") ?? "");
  const scrollText = String(ctx.get("visual.tagWheel.scroller.textColor") ?? "");
  shape(wline, side => {
    side.addClass("io-wheelline");
    const col = el(side, "span", "io-wheelcol");
    const cell = el(col, "span", "io-wheelcell io-wheelcell--active", "[" + name + "]");
    if (activeText) cssVar(cell, "--io-wheel-cell-active", activeText);
    const panel = el(col, "span", "io-wheelpanel io-wheelpanel--down");
    if (scrollFill) cssVar(panel, "--io-wheel-bg", scrollFill);
    if (scrollText) cssVar(panel, "--io-wheel-fg", scrollText);
    if (!n) { el(panel, "span", "io-wheelval io-nf__pempty", say("NF_PREVIEW_NO_VALUES")); return; }
    const pos = ((at % n) + n) % n;
    const from = Math.max(0, Math.min(pos - Math.floor(WHEEL_WINDOW / 2), n - WHEEL_WINDOW));
    for (let i = from; i < from + shown; i++) {
      const v = values[i] as { text: string };
      const text = d.kind === "wikilink" ? (bare(v.text, "wikilink").split("/").pop() || v.text) : v.text;
      el(panel, "span", "io-wheelval" + (i === pos ? " io-wheelval--on" : ""), text);
    }
  });

  /* Строка: на месте Field — Value под курсором, в своих цветах. */
  const linePane = el(host, "div", "io-nf__pane");
  el(linePane, "div", "io-nf__plabel", say("NF_PREVIEW_LINE"));
  const line = el(linePane, "div", "io-line io-nf__pline");
  /* Без заливки Block: полоса над одним Value читалась как его рамка (его
     замечание к тесту 3 цикла 99). */
  applyTagVars(line, ctx, { blockFill: false });
  shape(line, side => {
    if (!cur) { el(side, "span", "io-nf__pempty", say("NF_PREVIEW_VALUE")); return; }
    if (d.kind === "tag") {
      bubble(side, { token: bare(cur.text, "tag"), fill: cur.fill || "", ...(cur.color ? { text: cur.color } : {}), shown: "value", depth: 0 });
    } else if (d.kind === "wikilink") drawWrittenLink(side, cur.text);
    else el(side, "span", "io-nf__pelem", cur.text);
  });
}

/* ---- вёрстка окна -------------------------------------------------------- */

/**
 * Выбор на нажатии, а не на отпускании: раскрытая выбиралка знака сворачивается
 * по уходу фокуса, форма под курсором съезжает, и отпускание приходится на
 * другой узел — `click` не рождается (стенд `new-field`, 2026-09-28). `click`
 * остаётся клавиатуре: `Enter` и пробел нажатия мыши не дают.
 */
function onPress(node: El, fn: () => void): void {
  let pressed = false;
  node.addEventListener("pointerdown", (() => { pressed = true; fn(); }) as never);
  node.addEventListener("click", (() => { if (pressed) { pressed = false; return; } fn(); }) as never);
}

/** Ряд кнопок-переключателей: одна нажата. Узлы — свои, `aria-pressed` у каждой. */
function segmented(host: El, options: ReadonlyArray<{ value: string; label: string }>, value: string,
  label: string, pick: (v: string) => void): void {
  const seg = el(host, "div", "io-seg");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", label);
  for (const o of options) {
    const b = btn(seg, "io-seg__btn" + (o.value === value ? " io-seg__btn--on" : ""), { text: o.label });
    b.setAttribute("aria-pressed", o.value === value ? "true" : "false");
    onPress(b, () => pick(o.value));
  }
}

/** Как часто курсор скроллера шагает сам. */
const TICK_MS = 1400;

/** Подсказка платформы в том виде, в каком она нужна полю заметок. */
/** Прямоугольник, которым платформа ставит список (координаты его контейнера). */
interface SuggestRect { top: number; bottom: number; left: number; right: number }
interface SuggestBox {
  offsetParent: SuggestBox | null;
  scrollTop: number;
  clientHeight: number;
  style: { setProperty(name: string, value: string): void };
  classList: { add(cls: string): void };
  doc?: { documentElement: SuggestBox };
}
interface NoteSuggest { setValue(v: string): void; close(): void; limit: number; suggestEl: SuggestBox; reposition(rect: SuggestRect): void }
type NoteSuggestCtor = new (app: unknown, input: unknown) => NoteSuggest;

/**
 * Подсказка заметок — родная подсказка Obsidian, как у свойства YAML: пустое
 * поле показывает все заметки, набранное их фильтрует, выбор сразу встаёт
 * в Values (его замечание к тесту 3 цикла 98). Набранное без выбора
 * работает по-прежнему — Enter или `Add Value`. Одна на окно `Add a Field` и
 * поле `Add Value` у Link в правой колонке (его замечание к тесту 1 цикла 100).
 * Нет платформы (заглушка DOM) — подсказки нет, поле обычное.
 */
export function attachNoteSuggest(input: ElInput, o: {
  platform: SettingsCtx["platform"]; app: unknown; notes: (() => readonly string[]) | undefined; pick: (target: string) => void;
}): void {
  const platform = o.platform;
  if (!platform || typeof platform.AbstractInputSuggest !== "function" || !o.notes) return;
  const notes = o.notes().map(p => p.replace(/\.md$/i, ""));
  try {
    const Base = platform.AbstractInputSuggest as NoteSuggestCtor;
    class NoteSuggestImpl extends Base {
      getSuggestions(query: string): string[] {
        const q = String(query || "").trim().toLowerCase();
        /* ponytail: первые 200 совпадений — дальше список всё равно фильтруют набором. */
        return notes.filter(p => !q || p.toLowerCase().includes(q)).slice(0, 200);
      }
      renderSuggestion(p: string, node: El): void {
        const cut = p.lastIndexOf("/");
        el(node, "span", "io-suggest__name", cut < 0 ? p : p.slice(cut + 1));
        if (cut >= 0) el(node, "span", "io-suggest__type", p.slice(0, cut));
      }
      selectSuggestion(p: string): void {
        this.setValue("");
        this.close();
        o.pick(p);
      }
      /*
       * Список — всегда под полем (его замечание к тесту 1 цикла 101: «прыгает —
       * то сверху, то снизу»). Платформа ставит его вниз, только если он
       * помещается целиком, иначе наверх (`dm` в `app.js` 1.13.7), а высота
       * меняется с каждой буквой. Здесь низ закреплён, высота — до края окна,
       * по тем же отступам, что у платформы: 5 от поля, 10 от края.
       */
      override reposition(rect: SuggestRect): void {
        super.reposition(rect);
        const box = this.suggestEl;
        const host = box.offsetParent || (box.doc ? box.doc.documentElement : null);
        if (!host) return;
        const floor = host.scrollTop + host.clientHeight - 10;
        /* Место — переменными: инлайновый стиль своему коду каталог запрещает
           (Г1), а класс перебивает инлайн платформы (`.io-suggest--below`). */
        box.classList.add("io-suggest--below");
        box.style.setProperty("--io-suggest-top", String(rect.bottom + 5) + "px");
        box.style.setProperty("--io-suggest-max", String(Math.max(80, floor - rect.bottom - 5)) + "px");
      }
    }
    new NoteSuggestImpl(o.app, input).limit = 200;
  } catch (e) {
    /* Класс платформы мог смениться формой: поле остаётся рабочим, подсказки нет (З8). */
    console.error("inline-overhaul: подсказка заметок не подключилась", e);
  }
}

/**
 * Нарисовать форму в `box`. Возвращает уборку: подсказки, выбиралка знака и
 * шаг скроллера обязаны уйти вместе с окном.
 */
export function renderNewFieldForm(box: El, o: NewFieldFormOpts, now: () => Date = () => new Date()): () => void {
  const say = o.say;
  const d = freshDraft();
  let closers: Array<() => void> = [];
  const closeAll = (): void => { closers.forEach(fn => fn()); closers = []; };
  let finished = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  const stopTimer = (): void => { if (timer !== null) { clearInterval(timer); timer = null; } };
  const finish = (answer: NewFieldAnswer | null): void => {
    if (finished) return;
    finished = true;
    stopTimer();
    o.done(answer);
  };

  box.empty();
  box.addClass("io-dlg", "io-nf");
  el(box, "h4", "io-dlg__title", say("NEW_FIELD_TITLE"));
  const body = el(box, "div", "io-nf__body");
  /* Низ окна: предпросмотр во всю ширину, под ним кнопки — его слово «должен
     быть внизу, на уровне с кнопками Add field». */
  const bottom = el(box, "div", "io-nf__bottom");
  const previewBox = el(bottom, "div", "io-preview io-nf__preview");
  const previewCap = el(previewBox, "div", "io-preview__cap io-nf__pcap");
  el(previewCap, "span", undefined, say("NF_PREVIEW"));
  const preview = el(previewBox, "div", "io-nf__pbody");
  /* Щелчок по подписи сворачивает предпросмотр (его замечание к тесту 3 цикла 99). */
  previewCap.setAttribute("role", "button");
  previewCap.setAttribute("tabindex", "0");
  previewCap.setAttribute("aria-expanded", "true");
  const togglePreview = (): void => {
    const open = preview.classList.contains("io-nf__pbody--closed");
    if (open) preview.classList.remove("io-nf__pbody--closed");
    else preview.classList.add("io-nf__pbody--closed");
    previewCap.setAttribute("aria-expanded", open ? "true" : "false");
  };
  previewCap.addEventListener("click", togglePreview as never);
  previewCap.addEventListener("keydown", ((e: { key?: string; preventDefault?: () => void }) => {
    if (!e || (e.key !== "Enter" && e.key !== " ")) return;
    if (typeof e.preventDefault === "function") e.preventDefault();
    togglePreview();
  }) as never);
  const foot = el(bottom, "div", "io-dlg__foot io-nf__foot");
  const problem = el(foot, "span", "io-nf__problem");
  const cancel = btn(foot, "io-btn", { text: say("CANCEL") });
  const add = btn(foot, "io-btn io-btn--cta", { text: say("NEW_FIELD_ADD") }) as ElButton;

  /* Курсор скроллера: шагает сам, пока окно открыто. Ряд значений считается
     на правке, а не на шаге — у `Random` иначе примеры менялись бы на ходу. */
  let tick = 0;
  let series = previewValues(d, now());
  const paint = (): void => drawNewFieldPreview(preview, o.ctx, d, say, now(), tick, series);
  const refresh = (): void => {
    series = previewValues(d, now());
    paint();
    const why = draftProblem(d, o.checkName, say, o.valueTaken);
    add.disabled = !!why;
    /* Ошибку имени видно сразу — но не пустоту, пока человек ещё не начал. */
    problem.textContent = d.name.trim() ? why : "";
  };
  const g = globalThis as { matchMedia?: (q: string) => { matches: boolean } };
  /* Проба: `matchMedia` может не быть; «нет» — ответ, и тогда курсор шагает. */
  const still = typeof g.matchMedia === "function" && g.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!still) {
    timer = setInterval(() => { tick += 1; if (series.length > 1) paint(); }, TICK_MS);
    /* В Node шаг не держит процесс: окно на заглушке рисуют проверки. */
    const t = timer as unknown as { unref?: () => void };
    if (typeof t.unref === "function") t.unref();
  }

  const confirm = (): void => {
    if (draftProblem(d, o.checkName, say, o.valueTaken)) return;
    finish(answerOf(d));
  };
  cancel.addEventListener("click", (() => finish(null)) as never);
  add.addEventListener("click", confirm as never);

  const item = (host: El, name: string, desc: string, tip?: string, stack?: boolean): El => itemRow(host, name, desc, tip, stack).control;
  /* `stack` — переключатель во всю ширину под подписью: в ряд он мнёт описание. */
  const itemRow = (host: El, name: string, desc: string, tip?: string, stack?: boolean): { control: El; row: El } => {
    const row = el(host, "div", "io-item" + (stack ? " io-item--stack" : ""));
    const info = el(row, "div", "io-item__info");
    const head = el(info, "div", "io-item__namerow");
    el(head, "div", "io-item__name", say(name));
    if (tip) {
      closers.push(tipBelow({
        head, host: row, text: say(tip), label: say(name),
        id: "io-nf-" + name.toLowerCase().replace(/_/g, "-"), showTips: o.showTips, showIds: o.showIds,
      }));
    }
    rich(el(info, "div", "io-item__desc"), say(desc));
    return { control: el(row, "div", "io-item__control"), row };
  };

  /* Поле имени живёт через перерисовку тела: смена типа не должна уносить набранное. */
  let nameInput: ElInput | null = null;
  const platform = o.ctx.platform;
  const app = platform ? (platform.plugin as { app?: unknown } | undefined)?.app : undefined;

  const draw = (): void => {
    closeAll();
    body.empty();

    /* Тип — первым: от него зависит всё остальное. */
    const types = el(body, "div", "io-nf__types");
    types.setAttribute("role", "radiogroup");
    types.setAttribute("aria-label", say("NEW_FIELD_TYPE"));
    const sampleOf = (k: FieldKind): string =>
      (k === "tag" ? "#todo" : k === "wikilink" ? "[[Project]]" : "📅" + String(sharedUtils.formatDateByMask(now(), "YYYY-MM-DD")));
    for (const t of TYPES) {
      const on = t.kind === d.kind;
      const card = btn(types, "io-nf__type" + (on ? " io-nf__type--on" : ""), {});
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", on ? "true" : "false");
      el(card, "span", "io-nf__sample", sampleOf(t.kind));
      el(card, "span", "io-nf__typename", say(t.name));
      el(card, "span", "io-nf__typedesc", say(t.desc));
      onPress(card, () => {
        if (d.kind === t.kind) return;
        d.kind = t.kind;
        d.values = [];
        tick = 0;
        if (!d.sideChosen) d.side = defaultSide(t.kind);
        draw();
      });
    }

    const nameCtl = item(body, "NEW_FIELD_NAME", "NEW_FIELD_NAME_LABEL", "NEW_FIELD_NAME_TIP");
    nameInput = textInput(nameCtl, "io-text", { value: d.name, placeholder: say("NEW_FIELD_NAME_HINT"), label: say("NEW_FIELD_NAME_ARIA"), needed: true });
    nameInput.addEventListener("input", (() => { d.name = String(nameInput!.value || ""); refresh(); }) as never);
    nameInput.addEventListener("keydown", ((e: { key?: string; preventDefault?: () => void }) => {
      if (!e || e.key !== "Enter") return;
      if (typeof e.preventDefault === "function") e.preventDefault();
      confirm();
    }) as never);

    const sideCtl = item(body, "NF_BLOCK", "NF_BLOCK_DESC", "NF_BLOCK_TIP", true);
    segmented(sideCtl, [
      { value: "left", label: say("NF_BLOCK_LEFT") },
      { value: "right", label: say("NF_BLOCK_RIGHT") },
      ...o.blocks.map(b => ({ value: "custom:" + b.id, label: b.name })),
    ], d.side, say("NF_BLOCK"), v => { d.side = v as FieldSide; d.sideChosen = true; draw(); });

    if (d.kind === "element") {
      el(body, "div", "io-sub io-nf__sub", say(d.value === "list" ? "NF_VALUES_HEAD" : "NF_VALUE_HEAD"));
      drawElement();
    } else drawValues();

    /* Свойство YAML — у каждого типа (его замечание к тесту 3 цикла 98). */
    const yaml = item(body, "YAML_HEAD", "YAML_DESC", "YAML_HEAD_TIP");
    propertyPicker(yaml, {
      value: d.property,
      label: d.name.trim() || say("NEW_FIELD_NAME_HINT"),
      placeholder: say("YAML_HINT"),
      say,
      props: vaultProperties(app),
      suggest: platform && platform.AbstractInputSuggest ? { ctor: platform.AbstractInputSuggest, app } : undefined,
      enabled: true,
      write: v => { d.property = String(v || ""); },
    });
    refresh();
  };

  const drawValues = (): void => {
    const isLink = d.kind === "wikilink";
    /* Element-список (`В-247`): Values как есть, без цвета и без решётки. */
    const isList = d.kind === "element";
    /* Values — строкой окна, как остальные контролы: тот же шрифт подписи и
       свой «?» (его замечание к тесту 3 цикла 99). */
    const valuesCtl = item(body, "NF_VALUES_HEAD", isLink ? "NF_VALUES_DESC_LINK" : isList ? "NF_VALUES_DESC_LIST" : "NF_VALUES_DESC_TAG", "NF_VALUES_TIP", true);
    /* Строка добавления — под фишками, а не рядом (его замечание к тесту 2 цикла 100). */
    valuesCtl.addClass("io-nf__values");
    const chips = el(valuesCtl, "div", "io-nf__chips");
    const theme = themePair(box);
    const held: DragHold = { taken: null };
    d.values.forEach((v, i) => {
      const chip = el(chips, "span", "io-nf__chip");
      /* Ручка первой, перед точками цвета: порядок фишек — порядок Values и
         в предпросмотре, и в Field (его замечание к тесту 3 цикла 99). */
      attachRowDrag({
        row: chip, index: i, label: say("NF_VALUE_DRAG", v.token), enabled: true, held,
        onMove: (from, to) => {
          const [moved] = d.values.splice(from, 1);
          if (moved) d.values.splice(to, 0, moved);
          draw();
        },
      });
      /* Цвет заливки и цвет текста — двумя точками в самой фишке (его
         замечание: «рядом цвет текста, по аналогии минималистично»), и имя
         в фишке рисуется этими цветами; пока свой не выбран — цвет темы. */
      let label: El | null = null;
      const paintChip = (): void => {
        if (!label) return;
        cssVar(label, "--io-nf-chip-bg", v.fill || "transparent");
        cssVar(label, "--io-nf-chip-fg", v.text || "inherit");
      };
      if (!isLink && !isList) {
        const dot = (cls: string, aria: string, chosen: string | undefined, theme: string, set: (c: string) => void): void => {
          const node = chip.createEl("input", {
            cls: "io-nf__dot " + cls + (chosen ? "" : " io-nf__dot--unset"), type: "color", value: chosen || theme,
            attr: { "aria-label": aria, title: aria },
          }) as ElInput;
          node.addEventListener("input", (() => { set(node.value); node.classList.remove("io-nf__dot--unset"); paintChip(); refresh(); }) as never);
        };
        dot("io-nf__dot--fill", say("NF_VALUE_COLOR", v.token), v.fill, toHexColor(theme.fill) || toHexColor(theme.text), c => { v.fill = c; });
        dot("io-nf__dot--text", say("NF_VALUE_TEXT_COLOR", v.token), v.text, toHexColor(theme.text), c => { v.text = c; });
      }
      label = el(chip, "span", "io-nf__chiptext" + (isLink || isList ? "" : " io-nf__chiptext--tag"),
        isLink ? linkText(v.token) : isList ? v.token.trim() : "#" + bare(v.token, "tag"));
      paintChip();
      /* Есть заметка — молчим: `note` у каждой ссылки он назвал лишним (тест 3
         цикла 99). Говорится только то, чего не видно, — заметки ещё нет. */
      if (isLink && o.noteExists && !o.noteExists(bare(v.token, "wikilink"))) {
        el(chip, "span", "io-nf__note", say("NF_NOTE_NONE"));
      }
      const x = btn(chip, "io-nf__x", { text: "✕", label: say("NF_VALUE_REMOVE", v.token) });
      x.addEventListener("click", (() => { d.values.splice(i, 1); draw(); }) as never);
    });
    if (!d.values.length) el(chips, "span", "io-nf__chipshint", say(isLink ? "NF_VALUES_EMPTY_LINK" : isList ? "NF_VALUES_EMPTY_LIST" : "NF_VALUES_EMPTY_TAG"));

    const addRow = el(valuesCtl, "div", "io-nf__addrow");
    const input = textInput(addRow, "io-text io-text--mono", {
      value: "", placeholder: say(isLink ? "NEW_VALUE_LINK_HINT" : isList ? "NEW_VALUE_LIST_HINT" : "NEW_VALUE_TAG_HINT"), label: say("NF_VALUE_ARIA"),
    });
    valueInput = input;
    const push = (raw: string): boolean => {
      const t = String(raw || "").trim();
      if (!t) return false;
      if (d.values.some(v => (isList ? v.token.trim() === t : bare(v.token, d.kind) === bare(t, d.kind)))) return false;
      d.values.push({ token: t });
      return true;
    };
    const addOne = (): void => { if (push(input.value)) { draw(); focusValue(); } };
    input.addEventListener("keydown", ((e: { key?: string; preventDefault?: () => void }) => {
      if (!e || e.key !== "Enter") return;
      if (typeof e.preventDefault === "function") e.preventDefault();
      addOne();
    }) as never);
    btn(addRow, "io-btn io-btn--sm", { text: say("ADD_VALUE") }).addEventListener("click", addOne as never);
    /* После выбора из подсказки фокус в поле не возвращается: платформа
       открыла бы список снова поверх формы (стенд `new-field`, снимок). */
    if (isLink) attachNoteSuggest(input, { platform, app, notes: o.notes, pick: t => { if (push(t)) draw(); } });
    /* Эмодзи набирать неудобно — у поля Value списка выбиралка Binder (символ, эмодзи, рожица; тест 4 цикла 104); знак встаёт в поле, слово человек допечатывает. */
    if (isList) {
      const picker = attachPicker(input, addRow, {
        kinds: PICK_ALL, say,
        ...(o.holdKeys ? { holdKeys: o.holdKeys } : {}),
        onPick: char => { input.value = String(input.value || "") + char; focusValue(); },
      });
      closers.push(picker.close);
    }
    if (isLink) {
      const moc = item(body, "MOC_NAME", "MOC_DESC", "MOC_TIP", true);
      segmented(moc, [{ value: "yes", label: say("MOC_YES") }, { value: "no", label: say("MOC_NO") }],
        d.moc ? "yes" : "no", say("MOC_NAME"), v => { d.moc = v === "yes"; draw(); });
    }
  };

  /* Поле нового Value: после добавления фокус возвращается в него. */
  let valueInput: ElInput | null = null;
  const focusValue = (): void => {
    const field = valueInput as unknown as { focus?: () => void } | null;
    if (field && typeof field.focus === "function") field.focus();
  };

  const drawElement = (): void => {
    /* У списка знак стоит в каждом Value, и строк знака и формата нет (`В-247`). */
    const listMode = d.value === "list";
    if (!listMode) {
    const emoji = itemRow(body, "NEW_FIELD_MARKER", "NEW_FIELD_MARKER_LABEL", "NEW_FIELD_MARKER_TIP");
    const marker = textInput(emoji.control, "io-text", {
      value: d.marker, placeholder: say("NEW_FIELD_MARKER_HINT"), label: say("NEW_FIELD_MARKER_ARIA"), needed: true,
    });
    marker.addEventListener("input", (() => { d.marker = String(marker.value || ""); refresh(); }) as never);
    const picker = attachPicker(marker, emoji.row, {
      kinds: ["emoji"], say,
      ...(o.holdKeys ? { holdKeys: o.holdKeys } : {}),
      onPick: char => { d.marker = char; marker.value = char; refresh(); },
    });
    closers.push(picker.close);
    }

    const kindCtl = item(body, "NF_WRITES", "NF_WRITES_DESC", "NF_WRITES_TIP", true);
    segmented(kindCtl, [
      { value: "datetime", label: say("NF_WRITES_DATETIME") },
      { value: "counter", label: say("NF_WRITES_COUNTER") },
      { value: "random", label: say("NF_WRITES_RANDOM") },
      { value: "list", label: say("NF_WRITES_LIST") },
    ], d.value, say("NF_WRITES"), v => {
      if (v === d.value) return;
      /* Values списка к шагу даты не относятся, и наоборот. */
      d.values = [];
      d.value = v as ElementValue;
      d.format = v === "counter" ? "1" : v === "random" ? "0000" : (DATE_SHOWS.find(s => s.id === d.shows) || DATE_SHOWS[0]!).format;
      d.press = v === "datetime" && d.shows !== "date" ? "now" : "step";
      tick = 0;
      draw();
    });

    if (listMode) { drawValues(); return; }
    if (d.value === "datetime") {
      const shows = item(body, "NF_SHOWS", "NF_SHOWS_DESC", "NF_SHOWS_TIP", true);
      segmented(shows, DATE_SHOWS.map(s => ({ value: s.id, label: say(s.name) })), d.shows, say("NF_SHOWS"), v => {
        const s = DATE_SHOWS.find(x => x.id === v);
        if (!s) return;
        d.shows = s.id;
        d.format = s.format;
        /* Время по умолчанию пишет момент нажатия, дата шагает — как было. */
        d.press = s.id === "date" ? "step" : "now";
        draw();
      });
      const press = item(body, "NF_PRESS", "NF_PRESS_DESC", "NF_PRESS_TIP", true);
      segmented(press, [
        { value: "step", label: say("NF_PRESS_STEP") },
        { value: "now", label: say("NF_PRESS_NOW") },
      ], d.press, say("NF_PRESS"), v => { d.press = v === "now" ? "now" : "step"; tick = 0; draw(); });
    }
    if (d.value === "random") {
      const kind = item(body, "NF_RANDOM", "NF_RANDOM_DESC", "NF_RANDOM_TIP", true);
      segmented(kind, [
        { value: "randomN", label: say("COMMAND_RANDOM_NUMBERS") },
        { value: "randomE", label: say("COMMAND_RANDOM_CHARS") },
      ], d.random, say("NF_RANDOM"), v => { d.random = v === "randomE" ? "randomE" : "randomN"; draw(); });
    }

    const fmtCtl = item(body, "ELEMENT_FORMAT_NAME",
      d.value === "counter" ? "NF_FORMAT_COUNTER_DESC" : d.value === "random" ? "NF_FORMAT_RANDOM_DESC" : "NF_FORMAT_DESC", "ELEMENT_FORMAT_TIP");
    const fmt = textInput(fmtCtl, "io-text io-text--mono", { value: d.format, label: say("ELEMENT_FORMAT_NAME") });
    fmt.addEventListener("input", (() => { d.format = String(fmt.value || ""); refresh(); }) as never);

    /* Шаг — у всего, что шагает (его замечание: «не хватает настройки шага инкремента»). */
    if (d.value === "counter" || (d.value === "datetime" && d.press === "step")) {
      /* Единица — от формата, а не от выбора `Shows`: формат человек правит сам,
         и подпись «дней» над форматом минут вводила бы в заблуждение (его
         замечание к тесту 3 цикла 99). */
      const desc = d.value === "counter" ? "NF_STEP_DESC_COUNT" : "NF_STEP_DESC_UNIT";
      const stepCtl = item(body, "ELEMENT_AMOUNT_NAME", desc, "ELEMENT_AMOUNT_TIP");
      const step = stepCtl.createEl("input", {
        cls: "io-text io-num", type: "number", value: String(stepOf(d)),
        attr: { "aria-label": say("ELEMENT_AMOUNT_NAME"), min: "1", step: "1" },
      }) as ElInput;
      step.addEventListener("input", (() => { d.step = Number(step.value) || 1; refresh(); }) as never);
    }
  };

  draw();
  /* Фокус — в имя: окно открыли, чтобы назвать Field. */
  const nameField = nameInput as unknown as { focus?: () => void } | null;
  if (nameField && typeof nameField.focus === "function") nameField.focus();

  return () => { closeAll(); finish(null); };
}
