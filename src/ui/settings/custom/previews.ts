/**
 * Живые предпросмотры (PRD 10.3).
 *
 * Предпросмотр не редактируем и показывает результат текущих настроек на
 * выдуманной строке (П1). Перерисовывается точечно, по путям, от которых
 * зависит, а не полной пересборкой панели (П2): пересборка на каждом шаге
 * слайдера отбирает у слайдера перетаскивание.
 *
 * П9 честно: это не тот код, которым рисует редактор. Виджеты редактора
 * живут в движке CM6, куда слою настроек ходить нельзя (З3), поэтому каждый
 * предпросмотр говорит о себе одной фразой — `PREVIEW_NOTE` из прототипа.
 */

import {
  PREVIEW_EMPTY_RIGHT,
  PREVIEW_EXAMPLE,
  PREVIEW_LINE_TEXT,
  PREVIEW_NOTE,
  PREVIEW_TEXTS,
} from "../schema/custom_texts.ts";
import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, rich, cssVar, tipBelow, type El } from "./dom.ts";
import {
  fieldColor,
  fieldsOn,
  previewFields,
  resolveSlots,
  valueAtDepth,
  valuePair,
  type PreviewField,
  type PreviewValue,
} from "./preview_data.ts";
import type { PreviewNode } from "../schema/custom_texts.ts";

/** Значение настройки числом: панель отдаёт его как unknown. */
function num(ctx: SettingsCtx, path: string): number {
  const v = Number(ctx.get(path));
  return Number.isFinite(v) ? v : 0;
}

/** Значение настройки строкой, с запасным вариантом на пустое место. */
function str(ctx: SettingsCtx, path: string, fallback: string): string {
  const v = ctx.get(path);
  const s = v === undefined || v === null ? "" : String(v);
  return s || fallback;
}

/**
 * Рамка предпросмотра: подпись, «?» с подсказкой и фраза о том, что это не
 * редактор. Возвращает и рамку, и снятие подсказки — очистка блока обязана
 * убрать за собой всё (С5).
 */
function previewShell(host: El, ctx: SettingsCtx, id: string): { box: El; close: () => void } {
  const text = PREVIEW_TEXTS[id];
  const box = el(host, "div", "io-preview");
  const cap = el(box, "div", "io-preview__cap");
  el(cap, "span", undefined, text ? text.cap : "");
  const close = tipBelow({
    head: cap,
    host: box,
    text: text ? text.tip : "",
    label: text ? text.cap : id,
    id: "io-tip-" + id,
    showTips: Boolean(ctx.get("general.help.showTips")),
  });
  el(cap, "span", "io-preview__rule");
  el(box, "p", "io-preview__note io-preview__note--top", PREVIEW_NOTE);
  return { box, close };
}

/**
 * Оформление тегов из настроек уезжает в CSS-переменные: проценты считаются
 * один раз здесь, а геометрию строит стиль. Так предпросмотр не задаёт ни
 * одного свойства кроме `--io-*` (Г1).
 */
export function applyTagVars(node: El, ctx: SettingsCtx): void {
  cssVar(node, "--io-opacity-left", String(num(ctx, "visual.tags.opacityLeft") / 100));
  cssVar(node, "--io-opacity-right", String(num(ctx, "visual.tags.opacityRight") / 100));
  cssVar(node, "--io-text-scale", String(num(ctx, "visual.tags.textSizePct") / 100));
  cssVar(node, "--io-bubble-x", String(num(ctx, "visual.tags.bubbleWidthPct") / 100));
  cssVar(node, "--io-bubble-y", String(num(ctx, "visual.tags.bubbleHeightPct") / 100));
  cssVar(node, "--io-empty-x", String(num(ctx, "visual.tags.emptyBubblePct") / 100));
  cssVar(node, "--io-corners", String((100 - num(ctx, "visual.tags.cornersPct")) / 100));
}

/** Пути, от которых зависит вид тега: на них предпросмотр перерисовывается. */
const TAG_PATHS = [
  "visual.tags.opacityLeft",
  "visual.tags.opacityRight",
  "visual.tags.textSizePct",
  "visual.tags.bubbleWidthPct",
  "visual.tags.bubbleHeightPct",
  "visual.tags.emptyBubblePct",
  "visual.tags.cornersPct",
  "pkm.behavior.childTagFormat",
  "pkm.lineFormat.separator1",
  "pkm.lineFormat.separator2",
] as const;

/**
 * Пузырь Value. Пустой пузырь остаётся пузырём: он держит высоту строки
 * неразрывным пробелом, а цвет прячет сам символ — иначе строка при показе
 * `empty` подпрыгивает.
 *
 * Экспортируется, потому что колонка `Preview` в таблице Values обязана
 * рисовать Value ровно тем же кодом, что и предпросмотры (П9). Иначе
 * предпросмотр и редактор однажды разойдутся, и никто этого не заметит.
 */
export function bubble(parent: El, v: PreviewValue, override?: string): El {
  const empty = v.shown === "empty";
  const label = empty
    ? " "
    : override !== undefined
      ? override
      : v.shown === "custom"
        ? (v.custom || " ")
        : "#" + v.token;
  const b = el(parent, "span", "io-bubble" + (empty ? " io-bubble--empty" : ""), label);
  cssVar(b, "--io-bubble-bg", v.fill);
  if (v.text) cssVar(b, "--io-bubble-fg", v.text);
  return b;
}

/**
 * Value с подзначением: одним пузырём `#parent/child` или двумя рядом —
 * так, как решает `Child tag format`.
 */
function tagField(parent: El, f: PreviewField, ctx: SettingsCtx): void {
  const { parent: p, child } = valuePair(f);
  if (!p) return;
  if (!child) { bubble(parent, p); return; }
  if (ctx.get("pkm.behavior.childTagFormat") === "combined") {
    bubble(parent, child, "#" + p.token + "/" + child.token);
  } else {
    bubble(parent, p);
    bubble(parent, child);
  }
}

/** Чип Field: короткое имя, если оно есть, и цвет своего вида. */
function fieldChip(parent: El, f: PreviewField): El {
  const chip = el(parent, "span", "io-bubble", f.short || f.name);
  cssVar(chip, "--io-bubble-bg", fieldColor(f));
  return chip;
}

/**
 * Форма строки: по чипу на Field, в порядке записи. `chipFor` позволяет
 * блоку нарисовать свой чип — так TagWheel вешает скроллер на тот Field, на
 * котором стоит.
 */
function structuralLine(
  parent: El,
  ctx: SettingsCtx,
  fields: readonly PreviewField[],
  chipFor?: (side: El, f: PreviewField) => void,
): El {
  const line = el(parent, "div", "io-line");
  applyTagVars(line, ctx);
  el(line, "span", "io-line__prefix", "- ");

  const put = (side: El, list: readonly PreviewField[]): void => {
    for (const f of list) {
      if (chipFor) chipFor(side, f);
      else fieldChip(side, f);
    }
  };

  const left = fieldsOn(fields, "left");
  if (left.length) put(el(line, "span", "io-line__side io-line__side--left"), left);
  el(line, "span", "io-line__sep", str(ctx, "pkm.lineFormat.separator1", "||"));
  el(line, "span", "io-line__text", PREVIEW_LINE_TEXT);
  el(line, "span", "io-line__sep", str(ctx, "pkm.lineFormat.separator2", "||"));

  const right = fieldsOn(fields, "right");
  if (right.length) put(el(line, "span", "io-line__side io-line__side--right"), right);
  else el(line, "span", "io-line__hint", PREVIEW_EMPTY_RIGHT);
  return line;
}

/** Пути, от которых зависит скроллер TagWheel. */
const WHEEL_PATHS = [
  "visual.tagWheel.scroller.enabled",
  "visual.tagWheel.scroller.direction",
  "visual.tagWheel.scroller.size",
  "visual.tagWheel.showMarkers",
  "visual.tagWheel.fillColor",
  "visual.tagWheel.textColor",
  "visual.tags.opacityLeft",
  "visual.tags.opacityRight",
  "pkm.lineFormat.separator1",
  "pkm.lineFormat.separator2",
] as const;

/**
 * Строка панели скроллера: 15px высоты плюс 4px отступов. Число живёт и здесь,
 * и в `styles.css` — иначе место под панель считать нечем. Поэтому высота
 * строки там задана явно: если её отдать теме, панель окажется выше
 * зарезервированного места и накроет пометки предпросмотра.
 */
const WHEEL_ROW = 21;
/** Рамка панели, её отступы и зазор до строки. */
const WHEEL_CHROME = 18;

/**
 * Предпросмотр TagWheel (П7). Панель стоит над строкой и под ней: текущее
 * значение в середине, **вверх — следующие**, вниз — предыдущие, список
 * замкнут. Направление проверяется тестом вывода, а не чтением кода (Г20):
 * перевернуть его местами — ошибка, которую глазами не видно.
 *
 * П8: место под панели резервируется на подложке, а не на рамке блока —
 * тогда подсказка, открытая под подписью, ни с чем не сталкивается.
 */
export const wheelPreview: CustomRender = (host, ctx) => {
  const shell = previewShell(host, ctx, "wheel-preview");
  const stage = el(shell.box, "div", "io-wheelstage");
  /* Пометка о примере живёт под подложкой, а не в ней: внутри подложки она
     оказывается под нижней панелью скроллера, и та её закрывает. */
  const foot = el(shell.box, "div", "io-preview__foot");

  const draw = (): void => {
    stage.empty();
    foot.empty();
    const { fields, example } = previewFields(ctx);

    const scroller = Boolean(ctx.get("visual.tagWheel.scroller.enabled"));
    const perSide = scroller ? num(ctx, "visual.tagWheel.scroller.size") : 0;
    const direction = str(ctx, "visual.tagWheel.scroller.direction", "full");
    const markers = Boolean(ctx.get("visual.tagWheel.showMarkers"));

    const left = fieldsOn(fields, "left");
    /* Скроллер садится на второй Field слева: так обе стороны панели видно,
       и видно, что остальные Fields остаются обычными чипами. */
    const shown = left[1] || left[0] || fields[0] || null;
    const values = !shown
      ? []
      : shown.kind === "element"
        ? [shown.name]
        : shown.values.filter(v => v.depth === 0).map(v => (markers ? "#" : "") + v.token);

    const n = values.length;
    const at = n > 2 ? Math.floor(n / 2) : 0;
    const rows = perSide && n ? perSide : 0;

    /* Вверх встречаются следующие значения, вниз — предыдущие, оба круга
       замкнуты, поэтому панель всегда полная. */
    const upIdx: number[] = [];
    const downIdx: number[] = [];
    for (let k = rows; k >= 1; k--) upIdx.push((at + k) % n);
    for (let k = 1; k <= rows; k++) downIdx.push(((at - k) % n + n) % n);
    const up = direction === "down" ? [] : upIdx;
    const down = direction === "up" ? [] : downIdx;

    const room = (rows: number): string =>
      (rows ? rows * WHEEL_ROW + WHEEL_CHROME : 0) + "px";
    cssVar(shell.box, "--io-wheel-up", room(up.length));
    cssVar(shell.box, "--io-wheel-down", room(down.length));

    const panel = (col: El, idx: readonly number[], where: string): void => {
      if (!idx.length) return;
      const p = el(col, "span", "io-wheelpanel io-wheelpanel--" + where);
      const fill = str(ctx, "visual.tagWheel.fillColor", "");
      const text = str(ctx, "visual.tagWheel.textColor", "");
      if (fill) cssVar(p, "--io-wheel-bg", fill);
      if (text) cssVar(p, "--io-wheel-fg", text);
      for (const i of idx) el(p, "span", "io-wheelval", values[i] as string);
    };

    structuralLine(stage, ctx, fields, (side, f) => {
      const isShown = f === shown;
      const col = el(side, "span", "io-wheelcol");
      const chip = el(col, "span", "io-bubble" + (isShown ? " io-bubble--current" : ""),
        isShown ? (values[at] as string) : (f.short || f.name));
      cssVar(chip, "--io-bubble-bg", fieldColor(f));
      if (!isShown) return;
      panel(col, up, "up");
      panel(col, down, "down");
    });

    if (example) rich(el(foot, "p", "io-preview__note"), PREVIEW_EXAMPLE);
  };

  draw();
  const unwatch = ctx.watch(WHEEL_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};

/** Пути, от которых зависят полосы. */
const BARS_PATHS = [
  "visual.tagBars.active",
  "visual.tagBars.tagVisibility",
  "visual.tagBars.fieldId",
  "visual.tagBars.hideSeparatorWhenOnlyStripToken",
  "visual.tagBars.stripesToShow",
  "visual.tagBars.thickness",
  "visual.tagBars.childOffset",
  "visual.tagBars.spacing",
  "visual.tags.opacityLeft",
  "visual.tags.opacityRight",
  "pkm.lineFormat.separator1",
] as const;

/**
 * Предпросмотр Bars. Полоса принадлежит строке, которая несёт Field, и идёт
 * во всю высоту этой строки и всего вложенного под неё (П4). Требование
 * заказчика: **текст строк не зависит от того, какой Field рисует полосы** —
 * строка всегда несёт свои теги, переключение Field меняет только полосы.
 * Скрывается ровно один тег, тот, чей Field рисует полосу, и только если
 * выключено `Show the Field's tag`.
 *
 * Полоса не занимает места в потоке (П5): её рисует абсолютный `::before` в
 * отведённом жёлобе, а текст отодвинут сразу на все дорожки. Дорожка 0 —
 * самая левая и принадлежит родителю (П6): ребёнок всегда правее той строки,
 * от которой он висит.
 */
export const barsPreview: CustomRender = (host, ctx) => {
  const text = PREVIEW_TEXTS["bars-preview"];
  const shell = previewShell(host, ctx, "bars-preview");
  const tree = el(shell.box, "div", "io-tree");

  const chosenField = (): string => str(ctx, "visual.tagBars.fieldId", "status");

  /**
   * Места, которые называет выдуманное дерево, — в порядке первого появления.
   * Имена в дереве это места, а не id (П13): у человека Fields свои, а дерево
   * одно и то же.
   */
  const treeSlots = (nodes: readonly PreviewNode[]): string[] => {
    const out: string[] = [];
    const walk = (list: readonly PreviewNode[]): void => {
      for (const node of list) {
        for (const name of node.fields) if (!out.includes(name)) out.push(name);
        walk(node.children);
      }
    };
    walk(nodes);
    return out;
  };

  /** Field, который несёт строка на этом месте. */
  type SlotMap = Map<string, PreviewField>;

  /** Id Fields, которые несёт строка: места разрешены заранее. */
  const carried = (node: PreviewNode, slots: SlotMap): string[] => {
    const out: string[] = [];
    for (const name of node.fields) {
      const f = slots.get(name);
      if (f && !out.includes(f.id)) out.push(f.id);
    }
    return out;
  };

  const drawLine = (
    parent: El, node: PreviewNode, depth: number,
    fields: readonly PreviewField[], slots: SlotMap,
  ): void => {
    const line = el(parent, "div", "io-line");
    applyTagVars(line, ctx);
    cssVar(line, "--io-depth", String(depth));
    el(line, "span", "io-line__prefix", "- ");

    const active = Boolean(ctx.get("visual.tagBars.active"));
    const chosen = chosenField();
    const hideChosen = active && !ctx.get("visual.tagBars.tagVisibility");

    const shown: PreviewValue[] = [];
    const ids = carried(node, slots);
    for (const id of ids) {
      if (id === chosen && hideChosen) continue;
      const v = valueAtDepth(fields.find(f => f.id === id) || null, depth);
      if (v) shown.push(v);
    }
    if (shown.length) {
      const side = el(line, "span", "io-line__side io-line__side--left");
      for (const v of shown) bubble(side, v);
    }

    /* Separator уходит только тогда, когда перед текстом не осталось ничего.
       Если единственный тег там был тем, кого заменила полоса, судьбу
       Separator решает настройка ниже. */
    const replaced = hideChosen && ids.includes(chosen);
    const sepHidden = !shown.length &&
      (!replaced || Boolean(ctx.get("visual.tagBars.hideSeparatorWhenOnlyStripToken")));
    if (!sepHidden) el(line, "span", "io-line__sep", str(ctx, "pkm.lineFormat.separator1", "||"));
    el(line, "span", "io-line__text", node.text);
  };

  const drawNode = (
    parent: El, node: PreviewNode, depth: number, lane: number,
    fields: readonly PreviewField[], slots: SlotMap,
  ): void => {
    const active = Boolean(ctx.get("visual.tagBars.active"));
    const cap = num(ctx, "visual.tagBars.stripesToShow");
    const chosen = chosenField();
    const v = carried(node, slots).includes(chosen)
      ? valueAtDepth(fields.find(f => f.id === chosen) || null, depth)
      : null;
    const bar = active && v !== null && lane < cap;

    const box = el(parent, "div", "io-node" + (bar ? " io-node--bar" : ""));
    if (bar && v) {
      cssVar(box, "--io-bar-color", v.fill);
      cssVar(box, "--io-lane", String(lane));
    }
    drawLine(box, node, depth, fields, slots);
    for (const child of node.children) {
      drawNode(box, child, depth + 1, bar ? lane + 1 : lane, fields, slots);
    }
  };

  const draw = (): void => {
    tree.empty();
    const { fields, example } = previewFields(ctx);
    cssVar(tree, "--io-bar-thickness", num(ctx, "visual.tagBars.thickness") + "px");
    cssVar(tree, "--io-bar-gap", num(ctx, "visual.tagBars.childOffset") + "px");
    cssVar(tree, "--io-bar-distance", num(ctx, "visual.tagBars.spacing") + "px");
    const nodes = (text && text.tree) || [];
    const slots = resolveSlots(fields, treeSlots(nodes));
    for (const node of nodes) drawNode(tree, node, 0, 0, fields, slots);
    if (example) rich(el(tree, "p", "io-preview__note"), PREVIEW_EXAMPLE);
  };

  draw();
  const unwatch = ctx.watch(BARS_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};

/**
 * Места, которые показывает предпросмотр оформления: два Field слева. Имена
 * взяты из примерного набора и работают как места, а не как id (П13).
 */
const TAG_SLOTS = ["status", "priority"] as const;

/**
 * Предпросмотр оформления тегов. Показывает то, что настраивает группа: два
 * Value слева, текст, и справа элемент со ссылкой — они не теги и пузырей не
 * получают, но прозрачность гасит сторону целиком, вместе с ними.
 */
export const tagPreview: CustomRender = (host, ctx) => {
  const text = PREVIEW_TEXTS["tag-preview"];
  const shell = previewShell(host, ctx, "tag-preview");
  const holder = el(shell.box, "div", "io-preview__body");

  const draw = (): void => {
    holder.empty();
    const { fields, example } = previewFields(ctx);

    const line = el(holder, "div", "io-line");
    applyTagVars(line, ctx);
    el(line, "span", "io-line__prefix", "- ");

    const left = el(line, "span", "io-line__side io-line__side--left");
    /*
     * Два места слева, а не два id: у человека Fields свои, и `status` с
     * `priority` — это имена мест из примерного набора (П13). Разрешает их
     * `resolveSlots`, а не поиск по id.
     */
    const slots = resolveSlots(fields, TAG_SLOTS);
    for (const slot of TAG_SLOTS) {
      const f = slots.get(slot);
      if (f) tagField(left, f, ctx);
    }

    el(line, "span", "io-line__sep", str(ctx, "pkm.lineFormat.separator1", "||"));
    el(line, "span", "io-line__text", text ? text.line || "" : "");
    el(line, "span", "io-line__sep", str(ctx, "pkm.lineFormat.separator2", "||"));

    const right = el(line, "span", "io-line__side io-line__side--right");
    if (text && text.element) el(right, "span", "io-elem", text.element);
    if (text && text.link) el(right, "span", "io-link", text.link);

    /* Пример помечается, иначе человек с настроенными Fields решит, что
       панель показывает его собственные (ПЗ2). */
    if (example) rich(el(holder, "p", "io-preview__note"), PREVIEW_EXAMPLE);
  };

  draw();
  const unwatch = ctx.watch(TAG_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};
