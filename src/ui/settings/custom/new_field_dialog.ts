/**
 * **Окно `Add a Field`: главное сразу и живой предпросмотр** — его заказ
 * 2026-09-27 («при создании field для каждого вида type давать сразу настроить
 * ключевые настройки… в этой форме должен быть live preview… как будет
 * выглядеть field в tagwheel панели и в строке»).
 *
 * Что считается главным — по одному вопросу на тип, остальное остаётся
 * тонкой настройкой правой колонки редактора:
 * - **Tag** — Values, каждое со своим цветом;
 * - **Link** — Values-заметки: подсказка из vault, отметка «заметка есть» и
 *   «все заметки папки» одной кнопкой — то, чего у тега нет;
 * - **Element** — знак, вид значения (дата, дата и время, время, счётчик,
 *   список) и его формат.
 * Всем трём — имя и Block: прежде новый Field вставал только в правый.
 *
 * Здесь только вёрстка и черновик: запись — `configureNewField` модели, окно
 * платформы — `fields_editor.ts`. Вёрстка рисуется на заглушке DOM, поэтому
 * платформа приходит швами (`notes`, `noteExists`, `folderNotes`).
 */

import type { El, ElButton, ElInput } from "./dom.ts";
import { el, btn, cssVar, rich, textInput, themePair, tipBelow } from "./dom.ts";
import type { NewFieldSetup, FieldSide } from "./fields_model.ts";
import type { FieldKind, SettingsCtx } from "../types.ts";
import { applyTagVars, bubble, drawWrittenLink } from "./previews.ts";
import { attachPicker } from "./char_picker.ts";
import { toHexColor } from "./contrast.ts";
import sharedUtils from "../../../core/shared_utils.js";

type Say = (name: string, ...args: readonly (string | number)[]) => string;
type Preset = NonNullable<NewFieldSetup["element"]>["preset"];

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
  folders?: () => readonly string[];
  noteExists?: (target: string) => boolean;
  /** Адреса заметок папки (путь без `.md`), прямые дети. */
  folderNotes?: (folder: string) => readonly string[];
  holdKeys?: (onEscape: () => void) => () => void;
  done: (answer: NewFieldAnswer | null) => void;
}

/** Вид значения Element: формат и то, чем шагает команда. Порядок — порядок кнопок. */
export const ELEMENT_PRESETS: ReadonlyArray<{ id: Preset; name: string; format: string }> = [
  { id: "date", name: "NF_PRESET_DATE", format: "YYYY-MM-DD" },
  { id: "datetime", name: "NF_PRESET_DATETIME", format: "YYYY-MM-DD HH:mm" },
  { id: "time", name: "NF_PRESET_TIME", format: "HH:mm" },
  { id: "counter", name: "NF_PRESET_COUNTER", format: "1" },
  { id: "list", name: "NF_PRESET_LIST", format: "" },
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
  values: Array<{ token: string; fill?: string }>;
  marker: string;
  preset: Preset;
  format: string;
  customRaw: string;
}

/** Block по умолчанию: тег слева, ссылка и Element справа — как у стартового набора. */
const defaultSide = (kind: FieldKind): FieldSide => (kind === "tag" ? "left" : "right");

export function freshDraft(): NewFieldDraft {
  return { kind: "tag", name: "", side: "left", sideChosen: false, values: [], marker: "", preset: "date", format: "YYYY-MM-DD", customRaw: "" };
}

/** Адрес Value так, как его пишет строка: без решётки и без скобок ссылки. */
function bare(token: string, kind: FieldKind): string {
  const t = String(token || "").trim();
  if (kind === "tag") return t.replace(/^#+/, "");
  return sharedUtils.wikilinkTargetOf(t) || t;
}

/** Готово ли к `Add`: имя, знак Element и шаги списка — без них Field не работает. */
export function draftProblem(d: NewFieldDraft, checkName: (n: string) => string, say: Say): string {
  if (!d.name.trim()) return say("NF_NEED_NAME");
  const bad = checkName(d.name);
  if (bad) return bad;
  if (d.kind === "element" && !d.marker.trim()) return say("NF_NEED_EMOJI");
  if (d.kind === "element" && d.preset === "list" && !d.customRaw.split("\n").some(s => s.trim())) return say("NF_NEED_STEPS");
  return "";
}

/** Ответ окна из черновика. */
export function answerOf(d: NewFieldDraft): NewFieldAnswer {
  const setup: NewFieldSetup = { side: d.side };
  if (d.kind === "element") {
    setup.element = { preset: d.preset, format: d.preset === "list" ? "" : d.format, customRaw: d.customRaw };
  } else if (d.values.length) {
    setup.values = d.values.map(v => (v.fill ? { token: v.token, fill: v.fill } : { token: v.token }));
  }
  const out: NewFieldAnswer = { name: d.name.trim(), kind: d.kind, setup };
  if (d.kind === "element") out.marker = d.marker.trim();
  return out;
}

/* ---- значение Element для предпросмотра --------------------------------- */

/** Шаг Element на `n` от сейчас: дата — дни, время — минуты, счётчик — единицы, список — шаги. */
function elementAt(d: NewFieldDraft, n: number, now: Date): string {
  if (d.preset === "list") {
    const steps = d.customRaw.split("\n").map(s => s.trim()).filter(Boolean);
    if (!steps.length) return "";
    return steps[((n % steps.length) + steps.length) % steps.length] as string;
  }
  if (d.preset === "counter") {
    const width = /^\d+$/.test(d.format) ? d.format.length : 1;
    const start = /^\d+$/.test(d.format) ? Number(d.format) : 1;
    return String(Math.max(0, start + n)).padStart(width, "0");
  }
  const at = new Date(now.getTime());
  if (d.preset === "date") at.setDate(at.getDate() + n);
  else at.setMinutes(at.getMinutes() + n);
  return String(sharedUtils.formatDateByMask(at, d.format || "YYYY-MM-DD"));
}

/**
 * **Предпросмотр: панель tagWheel и строка.** Классы и переменные — те же, что
 * у предпросмотров панели (`io-wheel*`, `io-line`, `applyTagVars`): вид берётся
 * из ваших настроек оформления, а не рисуется вторым правилом (У-32).
 * `now` — снаружи: проверка задаёт своё время (правило 76).
 */
export function drawNewFieldPreview(host: El, ctx: SettingsCtx, d: NewFieldDraft, say: Say, now: Date): void {
  host.empty();
  const name = d.name.trim() || say("NEW_FIELD_NAME_HINT");
  /* «Дата и время» и «Время» пишут момент нажатия: соседей у них нет. */
  const moment = d.kind === "element" && (d.preset === "datetime" || d.preset === "time");
  const values = d.kind === "element"
    ? (moment ? [0] : [-1, 0, 1]).map(n => d.marker + elementAt(d, n, now))
    : d.values.map(v => (d.kind === "tag" ? "#" + bare(v.token, "tag") : "[[" + bare(v.token, "wikilink") + "]]"));
  /* Панель пишет у ссылки имя заметки, а не её скобки: в ячейке `[Acme]`, не `[[[Acme]]]`. */
  const inWheel = (v: string): string => (d.kind === "wikilink" ? bare(v, "wikilink").split("/").pop() || v : v);
  /* У Element круг — вчера, сегодня, завтра; у Values — список по кругу. */
  const at = d.kind === "element" && !moment ? 1 : 0;
  const cur = values.length ? (values[at] as string) : "";
  const up = values.length > 1 ? [values[(at + 1) % values.length] as string] : [];
  const down = values.length > 2 || (d.kind === "element" && !moment) ? [values[(at - 1 + values.length) % values.length] as string] : [];
  const left = d.side === "left";
  const custom = String(d.side).startsWith("custom:");
  const sep1 = String(ctx.get("pkm.lineFormat.separator1") ?? "");
  const sep2 = String(ctx.get("pkm.lineFormat.separator2") ?? "");
  const sample = say("NF_SAMPLE_TEXT");

  /* tagWheel: ячейка этого Field активна, скроллер показывает соседей. */
  const wheelRow = el(host, "div", "io-nf__prow");
  el(wheelRow, "div", "io-nf__plabel", "tagWheel");
  const stage = el(wheelRow, "div", "io-wheelstage io-nf__pstage");
  cssVar(stage, "--io-wheel-up", up.length ? "39px" : "0px");
  cssVar(stage, "--io-wheel-down", down.length ? "39px" : "0px");
  const wline = el(stage, "div", "io-line io-line--wheel");
  applyTagVars(wline, ctx, { blockFill: false, plainSize: true });
  const wside = el(wline, "span", "io-line__side io-wheelline " + (left ? "io-line__side--left" : "io-line__side--right"));
  const col = el(wside, "span", "io-wheelcol");
  el(col, "span", "io-wheelcell io-wheelcell--active", "[" + (cur ? inWheel(cur) : name) + "]");
  const box = (list: readonly string[], where: string): void => {
    if (!list.length) return;
    const p = el(col, "span", "io-wheelpanel io-wheelpanel--" + where);
    for (const v of list) el(p, "span", "io-wheelval", inWheel(v));
  };
  box(up, "up");
  box(down, "down");

  /* Строка: Value встаёт в свой Block, ваши разделители — ваши. */
  const lineRow = el(host, "div", "io-nf__prow");
  el(lineRow, "div", "io-nf__plabel", say("NF_PREVIEW_LINE"));
  const line = el(lineRow, "div", "io-line io-nf__pline");
  applyTagVars(line, ctx);
  el(line, "span", "io-line__prefix", "- ");
  const drawValue = (parent: El): void => {
    if (!cur) { el(parent, "span", "io-nf__pempty", name); return; }
    if (d.kind === "tag") {
      const first = d.values[0];
      bubble(parent, { token: bare(cur, "tag"), fill: (first && first.fill) || "", shown: "value", depth: 0 });
    } else if (d.kind === "wikilink") drawWrittenLink(parent, cur);
    else el(parent, "span", "io-nf__pelem", cur);
  };
  if (custom) {
    const words = sample.split(" ");
    el(line, "span", "io-line__text", words[0] || "");
    drawValue(el(line, "span", "io-line__side io-line__side--right"));
    el(line, "span", "io-line__text", words.slice(1).join(" "));
    return;
  }
  if (left) {
    drawValue(el(line, "span", "io-line__side io-line__side--left"));
    el(line, "span", "io-line__sep", sep1);
    el(line, "span", "io-line__text", sample);
    return;
  }
  el(line, "span", "io-line__text", sample);
  el(line, "span", "io-line__sep", sep2);
  drawValue(el(line, "span", "io-line__side io-line__side--right"));
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

/**
 * Нарисовать форму в `box`. Возвращает уборку: подсказки и выбиралка знака
 * обязаны уйти вместе с окном.
 */
export function renderNewFieldForm(box: El, o: NewFieldFormOpts, now: () => Date = () => new Date()): () => void {
  const say = o.say;
  const d = freshDraft();
  let closers: Array<() => void> = [];
  const closeAll = (): void => { closers.forEach(fn => fn()); closers = []; };
  let finished = false;
  const finish = (answer: NewFieldAnswer | null): void => {
    if (finished) return;
    finished = true;
    o.done(answer);
  };

  box.empty();
  box.addClass("io-dlg", "io-nf");
  el(box, "h4", "io-dlg__title", say("NEW_FIELD_TITLE"));
  /* Две колонки: форма и предпросмотр рядом — картинка видна, пока
     заполняется форма; на узком окне колонки встают одна под другую. */
  const layout = el(box, "div", "io-nf__layout");
  const body = el(layout, "div", "io-nf__body");
  const side = el(layout, "div", "io-nf__side");
  const previewBox = el(side, "div", "io-preview io-nf__preview");
  const previewCap = el(previewBox, "div", "io-preview__cap");
  el(previewCap, "span", undefined, say("NF_PREVIEW"));
  const preview = el(previewBox, "div", "io-nf__pbody");
  const foot = el(box, "div", "io-dlg__foot");
  const problem = el(foot, "span", "io-nf__problem");
  const cancel = btn(foot, "io-btn", { text: say("CANCEL") });
  const add = btn(foot, "io-btn io-btn--cta", { text: say("NEW_FIELD_ADD") }) as ElButton;

  const refresh = (): void => {
    drawNewFieldPreview(preview, o.ctx, d, say, now());
    const why = draftProblem(d, o.checkName, say);
    add.disabled = !!why;
    /* Ошибку имени видно сразу — но не пустоту, пока человек ещё не начал. */
    problem.textContent = d.name.trim() ? why : "";
  };
  const confirm = (): void => {
    if (draftProblem(d, o.checkName, say)) return;
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
        if (!d.sideChosen) d.side = defaultSide(t.kind);
        draw();
      });
    }

    const nameCtl = item(body, "NEW_FIELD_NAME", "NEW_FIELD_NAME_LABEL", "NEW_FIELD_NAME_TIP");
    nameInput = textInput(nameCtl, "io-text", { value: d.name, placeholder: say("NEW_FIELD_NAME_HINT"), label: say("NEW_FIELD_NAME_ARIA") });
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

    el(body, "div", "io-sub io-nf__sub", say(d.kind === "element" ? "NF_VALUE_HEAD" : "NF_VALUES_HEAD"));
    if (d.kind === "element") drawElement(); else drawValues();
    refresh();
  };

  const drawValues = (): void => {
    const isLink = d.kind === "wikilink";
    const chips = el(body, "div", "io-nf__chips");
    const theme = themePair(box);
    d.values.forEach((v, i) => {
      const chip = el(chips, "span", "io-nf__chip");
      if (!isLink) {
        /* Цвет Value — точкой в самой фишке: цвет темы, пока не выбран свой. */
        const dot = chip.createEl("input", {
          cls: "io-nf__dot", type: "color",
          value: v.fill || toHexColor(theme.fill) || toHexColor(theme.text),
          attr: { "aria-label": say("NF_VALUE_COLOR", v.token) },
        }) as ElInput;
        dot.addEventListener("input", (() => { v.fill = dot.value; refresh(); }) as never);
      }
      el(chip, "span", "io-nf__chiptext", isLink ? "[[" + bare(v.token, "wikilink") + "]]" : "#" + bare(v.token, "tag"));
      if (isLink && o.noteExists) {
        const has = o.noteExists(bare(v.token, "wikilink"));
        el(chip, "span", "io-nf__note" + (has ? " io-nf__note--has" : ""), say(has ? "NF_NOTE_HAS" : "NF_NOTE_NONE"));
      }
      const x = btn(chip, "io-nf__x", { text: "✕", label: say("NF_VALUE_REMOVE", v.token) });
      x.addEventListener("click", (() => { d.values.splice(i, 1); draw(); }) as never);
    });
    if (!d.values.length) el(chips, "span", "io-nf__chipshint", say(isLink ? "NF_VALUES_EMPTY_LINK" : "NF_VALUES_EMPTY_TAG"));

    const addRow = el(body, "div", "io-nf__addrow");
    const input = textInput(addRow, "io-text io-text--mono", {
      value: "", placeholder: say(isLink ? "NEW_VALUE_LINK_HINT" : "NEW_VALUE_TAG_HINT"), label: say("NF_VALUE_ARIA"),
    });
    /* Подсказка заметок — встроенная `datalist` браузера, а не своя выпадашка. */
    if (isLink && o.notes) {
      const list = el(addRow, "datalist", undefined);
      list.setAttribute("id", "io-nf-notes");
      /* ponytail: первые 3000 заметок — дальше подсказку всё равно не листают. */
      for (const p of o.notes().slice(0, 3000)) list.createEl("option", { value: p.replace(/\.md$/i, "") });
      input.setAttribute("list", "io-nf-notes");
    }
    const push = (raw: string): boolean => {
      const t = String(raw || "").trim();
      if (!t) return false;
      if (d.values.some(v => bare(v.token, d.kind) === bare(t, d.kind))) return false;
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

    /* Своё у ссылки: все заметки папки одной кнопкой. */
    if (isLink && o.folderNotes && o.folders) {
      const folderRow = el(body, "div", "io-nf__addrow");
      const folder = textInput(folderRow, "io-text io-text--mono", { value: "", placeholder: say("NF_FOLDER_HINT"), label: say("NF_FOLDER_ARIA") });
      const flist = el(folderRow, "datalist", undefined);
      flist.setAttribute("id", "io-nf-folders");
      for (const f of o.folders()) flist.createEl("option", { value: f });
      folder.setAttribute("list", "io-nf-folders");
      const fill = btn(folderRow, "io-btn io-btn--sm", { text: say("NF_FOLDER_ADD") });
      fill.addEventListener("click", (() => {
        let n = 0;
        for (const t of o.folderNotes!(String(folder.value || "").trim())) if (push(t)) n++;
        if (n) draw();
      }) as never);
    }
  };

  let focusValue = (): void => {};

  const drawElement = (): void => {
    const emoji = itemRow(body, "NEW_FIELD_MARKER", "NEW_FIELD_MARKER_LABEL", "NEW_FIELD_MARKER_TIP");
    const emojiRow = emoji.row;
    const marker = textInput(emoji.control, "io-text", {
      value: d.marker, placeholder: say("NEW_FIELD_MARKER_HINT"), label: say("NEW_FIELD_MARKER_ARIA"), needed: true,
    });
    marker.addEventListener("input", (() => { d.marker = String(marker.value || ""); refresh(); }) as never);
    const picker = attachPicker(marker, emojiRow, {
      kinds: ["emoji"], say,
      ...(o.holdKeys ? { holdKeys: o.holdKeys } : {}),
      onPick: char => { d.marker = char; marker.value = char; refresh(); },
    });
    closers.push(picker.close);

    const kindCtl = item(body, "NF_PRESET", "NF_PRESET_DESC", "NF_PRESET_TIP", true);
    segmented(kindCtl, ELEMENT_PRESETS.map(p => ({ value: p.id, label: say(p.name) })), d.preset, say("NF_PRESET"), v => {
      const p = ELEMENT_PRESETS.find(x => x.id === v);
      if (!p) return;
      d.preset = p.id;
      d.format = p.format;
      draw();
    });

    if (d.preset === "list") {
      const stepsCtl = item(body, "ELEMENT_STEPS_NAME", "NF_STEPS_DESC");
      const area = stepsCtl.createEl("textarea", { cls: "io-textarea", attr: { "aria-label": say("ELEMENT_STEPS_NAME"), rows: "3" } }) as ElInput;
      area.value = d.customRaw;
      area.addEventListener("input", (() => { d.customRaw = String(area.value || ""); refresh(); }) as never);
    } else {
      const fmtCtl = item(body, "ELEMENT_FORMAT_NAME", d.preset === "counter" ? "NF_FORMAT_COUNTER_DESC" : "NF_FORMAT_DESC", "ELEMENT_FORMAT_TIP");
      const fmt = textInput(fmtCtl, "io-text io-text--mono", { value: d.format, label: say("ELEMENT_FORMAT_NAME") });
      fmt.addEventListener("input", (() => { d.format = String(fmt.value || ""); refresh(); }) as never);
    }
  };

  draw();
  /* Фокус — в имя: окно открыли, чтобы назвать Field. */
  focusValue = (): void => {
    const input = body.children && Array.from({ length: body.children.length }, (_, i) => body.children![i] as El)
      .find(n => n.classList.contains("io-nf__addrow"));
    const field = input && input.children ? (input.children[0] as unknown as { focus?: () => void }) : null;
    if (field && typeof field.focus === "function") field.focus();
  };
  const nameField = nameInput as unknown as { focus?: () => void } | null;
  if (nameField && typeof nameField.focus === "function") nameField.focus();

  return () => { closeAll(); finish(null); };
}
