/**
 * Живые предпросмотры (PRD 10.3). Не редактируемы, рисуют текущие настройки на
 * выдуманной строке (П1); перерисовка точечно по путям (П2) — полная пересборка
 * отбирает у слайдера перетаскивание. П9: это не код редактора — в движок CM6
 * слою настроек ходить нельзя (З3); каждый говорит это в своём «?» (1.4.1.1.1, П10).
 */

import {
  PREVIEW_EMPTY_RIGHT,
  PREVIEW_EXAMPLE,
  PREVIEW_LINE_TEXT,
  PREVIEW_TEXTS,
} from "../schema/custom_texts.ts";
import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, rich, cssVar, tipBelow, type El } from "./dom.ts";
import {
  typeColor,
  typeInk,
  previewCustomBlocks,
  type PreviewChip,
  fieldsOn,
  previewFields,
  resolveSlots,
  valueAtDepth,
  valuePair,
  type PreviewField,
  type PreviewValue,
} from "./preview_data.ts";
import type { PreviewNode } from "../schema/custom_texts.ts";
import { FRAME_BY_NAME, SINGLE_KEYS, frameKey, previewKey } from "../texts_custom.ts";
/* Движок Transform: считает он, блок только рисует (У-4). */
import sourceEngine from "../../../features/transform_feature.js";
/* Правило «получает ли сторона полосу» (З-12) — у модуля слоя заметки, один дом (У-217). */
import visualsConfig from "../../../core/editor_visuals_config.js";
/* Соединение своей подписи с написанной — дом полосы и коробки скроллера (У-159). */
import wheelCore from "../../../pkm_v2/TagWheel/tagwheel_core.js";

const joinValueLabel = (wheelCore as unknown as {
  joinValueLabel(printed: string, written: string, mode: string): string;
}).joinValueLabel;

/** Значение настройки числом: панель отдаёт его как unknown. */
function num(ctx: SettingsCtx, path: string): number {
  const v = Number(ctx.get(path));
  return Number.isFinite(v) ? v : 0;
}

/**
 * Видимый текст по ключу каталога (10.13.38): у `kind: "custom"` нет `name`/`desc`.
 * `fallback` — текст из выгрузки прототипа, он же ответ без перевода (Я4).
 */
function askText(ctx: SettingsCtx, key: string, fallback: string): string {
  return ctx.t ? ctx.t(key, fallback) : fallback;
}

/** Строка панели по имени из `FRAME_TEXTS`; ключ строит `frameKey` (У-82). */
/**
 * Цвета панели tagWheel в предпросмотре: активная ячейка и коробка скроллера.
 * Один дом на предпросмотр строки и окно нового Field (Н-9 ревизии 2026-10-03:
 * копия окна не знала читаемого текста на своей заливке и запасного цвета ячейки).
 * Коробка красится своими цветами, как оверлей `tagwheel_scroller_overlay.js` (H2);
 * пусто — тема через `var(--io-wheel-bg, var(--background-primary))`.
 */
export function wheelColors(ctx: SettingsCtx): { activeText: string; scrollFill: string; scrollText: string } {
  const activeText = readText(ctx, "visual.tagWheel.activeTextColor", "") || readText(ctx, "visual.tagWheel.textColor", "");
  const scrollFill = readText(ctx, "visual.tagWheel.scroller.fillColor", "");
  /* Своя заливка без своего текста — читаемый текст, как в заметке. */
  const scrollText = readText(ctx, "visual.tagWheel.scroller.textColor", "")
    || (scrollFill ? String(visualsConfig.readableTextOn(scrollFill) || "") : "");
  return { activeText, scrollFill, scrollText };
}

export function frame(ctx: SettingsCtx, name: string): string {
  return askText(ctx, frameKey(name), FRAME_BY_NAME[name] || "");
}

/** Значение настройки строкой, с запасным вариантом на пустое место. */
function readText(ctx: SettingsCtx, path: string, fallback: string): string {
  const v = ctx.get(path);
  const s = v === undefined || v === null ? "" : String(v);
  return s || fallback;
}

/**
 * Разделители — из настроек, без запасного значения (У-186): умолчание объявлено
 * в схеме и в `DEFAULT_CONFIG`. Пустым не бывает — `normalizeConfigV2` прогоняет их
 * через `text(...)` на каждом патче; если всё же пусто — рисуется пусто.
 */
const SEP1_PATH = "pkm.lineFormat.separator1";
const SEP2_PATH = "pkm.lineFormat.separator2";

function sep(ctx: SettingsCtx, path: string): string {
  const v = ctx.get(path);
  return v === undefined || v === null ? "" : String(v);
}

/** Рамка: подпись, «?» и фраза «не редактор». Отдаёт и снятие подсказки (С5). */
function previewShell(host: El, ctx: SettingsCtx, id: string): { box: El; close: () => void } {
  const text = PREVIEW_TEXTS[id];
  const cap0 = text ? askText(ctx, previewKey(id, "cap"), text.cap) : "";
  const box = el(host, "div", "io-preview");
  const cap = el(box, "div", "io-preview__cap");
  el(cap, "span", undefined, cap0);
  const close = tipBelow({
    head: cap,
    host: box,
    text: text ? askText(ctx, previewKey(id, "tip"), text.tip) : "",
    label: cap0 || id,
    id: "io-tip-" + id,
    showTips: Boolean(ctx.get("general.help.showTips")),
    showIds: Boolean(ctx.get("advanced.showSettingIds")),
    /* Над картинкой (2026-09-17, как в прототипе); разбор — у `afterHead`. */
    afterHead: true,
  });
  /* Линии за подписью нет (2026-09-07): рамку рисует сам блок. */
  return { box, close };
}

/**
 * Оформление тегов — в CSS-переменные `--io-*`, геометрию строит стиль (Г1).
 * `blockFill: false` снимает подложку Block (панель TagWheel, 2026-09-22): она и
 * обособление панели на одном узле, и подложка выигрывала каскад (У-67).
 */
export function applyTagVars(node: El, ctx: SettingsCtx, opts?: { blockFill?: boolean; plainSize?: boolean }): void {
  cssVar(node, "--io-opacity-left", String(num(ctx, "visual.tags.opacityLeft") / 100));
  cssVar(node, "--io-opacity-right", String(num(ctx, "visual.tags.opacityRight") / 100));
  /* `plainSize`: кегль соседнего текста (`--io-text-size: 1em`) вместо слайдеров
     Block — слайдеры слушает только предпросмотр тегов (2026-09-24). */
  if (opts && opts.plainSize) {
    cssVar(node, "--io-text-scale-left", "1");
    cssVar(node, "--io-text-scale-right", "1");
    cssVar(node, "--io-text-size", "1em");
  } else {
    cssVar(node, "--io-text-scale-left", String(num(ctx, "visual.tags.textSizePctLeft") / 100));
    cssVar(node, "--io-text-scale-right", String(num(ctx, "visual.tags.textSizePctRight") / 100));
  }
  cssVar(node, "--io-bubble-x", String(num(ctx, "visual.tags.bubbleWidthPct") / 100));
  cssVar(node, "--io-bubble-y", String(num(ctx, "visual.tags.bubbleHeightPct") / 100));
  cssVar(node, "--io-empty-x", String(num(ctx, "visual.tags.emptyBubblePct") / 100));
  cssVar(node, "--io-corners", String((100 - num(ctx, "visual.tags.cornersPct")) / 100));
  /* Заливка Left/Right Block (З-7): пусто в цвете — «у темы», смысл на шве (У-60). */
  const bandColor = String(ctx.get("visual.tags.blockFill.color") || "").trim();
  cssVar(node, "--io-blockfill-color", bandColor || "var(--text-accent)");
  cssVar(node, "--io-blockfill-opacity", String(num(ctx, "visual.tags.blockFill.opacity") / 100));
  /* Цель и скобки ссылки «как написано» красятся врозь (`З-37`, `В-174`); пусто — у темы (У-60). */
  const linkTarget = String(ctx.get("visual.tags.linkAsWritten.targetColor") || "").trim();
  const linkBrackets = String(ctx.get("visual.tags.linkAsWritten.bracketsColor") || "").trim();
  cssVar(node, "--io-link-target", linkTarget || "var(--text-accent)");
  cssVar(node, "--io-link-brackets", linkBrackets || "var(--text-accent)");
  /*
   * Выход подложки за написанное (S7). Высота — доля свободного места (`padding: 3px 0`
   * у `.io-line`). Ширина — шкала с переломом (2026-09-09): 0 — по написанному,
   * 50 — до разделителя (`--io-line-gap`), 100 — включая его. Ширина разделителя —
   * в `ch`, не мерена: узел ещё не в документе (в заметке мерится). Иначе — второе
   * расходящееся объявление правила (У-32).
   */
  const bandRoomPx = 3;
  cssVar(node, "--io-blockfill-pady",
    String(Math.round(bandRoomPx * num(ctx, "visual.tags.blockFill.heightPct")) / 100) + "px");
  const bandPct = Math.max(0, Math.min(100, num(ctx, "visual.tags.blockFill.widthPct")));
  const bandNear = Math.min(1, bandPct / 50);
  const bandFar = Math.max(0, (bandPct - 50) / 50);
  const bandSepCh = sep(ctx, SEP1_PATH).length;
  cssVar(node, "--io-blockfill-padx",
    "calc(var(--io-line-gap) * " + bandNear + " + " + bandSepCh + "ch * " + bandFar + ")");
  if (!(opts && opts.blockFill === false) && ctx.get("visual.tags.blockFill.enabled") === true) {
    node.addClass("io-line--blockfill");
    /* Сторона — классом (З-12): при `both` два. Имена целиком, не собраны из кусков —
       иначе их не найти грепом (У-103). */
    const dir = ctx.get("visual.tags.blockFill.direction");
    if (visualsConfig.blockFillZoneWanted(dir, "left")) node.addClass("io-line--blockfill-left");
    if (visualsConfig.blockFillZoneWanted(dir, "right")) node.addClass("io-line--blockfill-right");
  }
}

/** Пути, от которых зависит вид тега: на них предпросмотр перерисовывается. */
const TAG_PATHS = [
  "visual.tags.opacityLeft",
  /* Заливка блоков (З-7) — сразу (У-24). */
  "visual.tags.blockFill",
  "visual.tags.opacityRight",
  "visual.tags.textSizePctLeft",
  "visual.tags.textSizePctRight",
  "visual.tags.bubbleWidthPct",
  "visual.tags.bubbleHeightPct",
  "visual.tags.emptyBubblePct",
  "visual.tags.cornersPct",
  "pkm.lineFormat.separator1",
  "pkm.lineFormat.separator2",
  /* Ветка `pkm.fields` целиком: `previewFields` читает её (1.4.1.1.3), листья не перечислить. */
  "pkm.fields",
  "visual.tags.byTag",
  /* Цвета ссылки «как написано» (`З-37`) — сразу (У-24). */
  "visual.tags.linkAsWritten",
] as const;

/**
 * Подпись пузыря — одна на отрисовку и живую колонку `Preview` (У-32). Пустой
 * пузырь подписан неразрывным пробелом, иначе схлопывается.
 */
export function bubbleLabel(v: PreviewValue, override?: string): string {
  if (v.shown === "empty") return " ";
  if (override !== undefined) return override;
  return v.shown === "custom" ? (v.custom || " ") : "#" + v.token;
}

/**
 * Пузырь Value; пустой держит высоту неразрывным пробелом. Экспорт — колонка
 * `Preview` таблицы Values рисует тем же кодом (П9).
 */
export function bubble(parent: El, v: PreviewValue, override?: string): El {
  const empty = v.shown === "empty";
  /* Без заливки — вид тега темы; `#FFFFFF` = прозрачно и в заливке, и в рамке (цикл 89).
     Правило одно на заметку и панель (`isClearColor`). */
  const filled = !!v.fill && !visualsConfig.isClearColor(v.fill);
  const b = el(parent, "span", "io-bubble" + (empty ? " io-bubble--empty" : "")
    + (filled ? " io-bubble--filled" : "") + (v.side ? " io-bubble--side" : ""), bubbleLabel(v, override));
  cssVar(b, "--io-bubble-bg", v.fill && visualsConfig.isClearColor(v.fill) ? "transparent" : v.fill);
  if (v.text) cssVar(b, "--io-bubble-fg", v.text);
  if (v.side) cssVar(b, "--io-bubble-side", visualsConfig.isClearColor(v.side) ? "transparent" : v.side);
  return b;
}

/** Value с подзначением: одним пузырём `#parent/child` или двумя — по `Child tag format` этого Field (10.13.309). */
function drawTagField(parent: El, f: PreviewField, ctx: SettingsCtx): void {
  const { parent: p, child } = valuePair(f);
  if (!p) return;
  if (!child) { bubble(parent, p); return; }
  const nested = ctx.get("pkm.fields.order.subNested") as Record<string, unknown> | undefined;
  if (nested && nested[f.id + "_sub"] === true) {
    bubble(parent, child, "#" + p.token + "/" + child.token);
  } else {
    bubble(parent, p);
    bubble(parent, child);
  }
}

/** Чип Field: короткое имя, если оно есть, и цвет своего вида. */
function fieldChip(parent: El, f: PreviewChip): El {
  const chip = el(parent, "span", "io-bubble", f.short || f.name);
  cssVar(chip, "--io-bubble-bg", typeColor(f.kind));
  cssVar(chip, "--io-bubble-fg", typeInk(f.kind));
  return chip;
}

/** Форма строки: чип на Field по порядку. `chipFor` — свой чип (так TagWheel вешает скроллер). */
function structuralLine(
  parent: El,
  ctx: SettingsCtx,
  fields: readonly PreviewField[],
  chipFor?: (side: El, f: PreviewField) => void,
  cls?: string,
  opts?: { blockFill?: boolean; plainSize?: boolean },
): El {
  const line = el(parent, "div", "io-line" + (cls ? " " + cls : ""));
  applyTagVars(line, ctx, opts);
  el(line, "span", "io-line__prefix", "- ");

  const put = (side: El, list: readonly PreviewField[]): void => {
    for (const f of list) {
      if (chipFor) chipFor(side, f);
      else fieldChip(side, f);
    }
  };

  const left = fieldsOn(fields, "left");
  if (left.length) put(el(line, "span", "io-line__side io-line__side--left"), left);
  el(line, "span", "io-line__sep", sep(ctx, SEP1_PATH));
  el(line, "span", "io-line__text", askText(ctx, SINGLE_KEYS.previewLine, PREVIEW_LINE_TEXT));
  el(line, "span", "io-line__sep", sep(ctx, SEP2_PATH));

  const right = fieldsOn(fields, "right");
  if (right.length) put(el(line, "span", "io-line__side io-line__side--right"), right);
  else el(line, "span", "io-line__hint", askText(ctx, SINGLE_KEYS.previewEmptyRight, PREVIEW_EMPTY_RIGHT));
  return line;
}

/** Пути, от которых зависит скроллер TagWheel. */
const WHEEL_PATHS = [
  "visual.tagWheel.scroller.enabled",
  "visual.tagWheel.scroller.direction",
  "visual.tagWheel.scroller.size",
  /* Цвета коробки скроллера — перерисовка на их изменение (У-24). */
  "visual.tagWheel.scroller.fillColor",
  "visual.tagWheel.scroller.textColor",
  "visual.tagWheel.showMarkers",
  "visual.tagWheel.fillColor",
  "visual.tagWheel.textColor",
  /* Перерисовка на эти пути (H2, PRD 10.13.22 Пр3; У-24). */
  "visual.tagWheel.activeTextColor",
  /* Цвет ячейки с выбранным значением (2026-09-17). */
  "visual.tagWheel.chosenValueColor",
  "visual.tagWheel.boldFieldNames",
  /* Подписи значений в коробке (2026-10-01). */
  "visual.tagWheel.valueNames",
  "visual.tagWheel.scroller.labels",
  "visual.tagWheel.highlightLine",
  "visual.tags.opacityLeft",
  "visual.tags.opacityRight",
  "pkm.lineFormat.separator1",
  "pkm.lineFormat.separator2",
  /* Ветка `pkm.fields` целиком: `previewFields` читает её (1.4.1.1.3), листья не перечислить. */
  "pkm.fields",
  "visual.tags.byTag",
] as const;

/**
 * Строка панели скроллера: 15px + 4px отступов. Число дублирует `styles.css`, где
 * высота задана явно: отданная теме, панель накроет пометки предпросмотра.
 */
const WHEEL_ROW = 21;
/** Рамка панели, её отступы и зазор до строки. */
const WHEEL_CHROME = 18;

/**
 * Предпросмотр TagWheel (П7): текущее в середине, вверх — следующие, вниз —
 * предыдущие, круг замкнут; направление держит тест вывода (Г20). Место под
 * панели — на подложке, не на рамке (П8), чтобы не задеть подсказку.
 */
export const wheelPreview: CustomRender = (host, ctx) => {
  const shell = previewShell(host, ctx, "wheel-preview");
  const stage = el(shell.box, "div", "io-wheelstage");
  /* Пометка — под подложкой: внутри её закрывает нижняя панель скроллера. */
  const foot = el(shell.box, "div", "io-preview__foot");

  const draw = (): void => {
    stage.empty();
    foot.empty();
    const { fields, example } = previewFields(ctx);

    const scroller = Boolean(ctx.get("visual.tagWheel.scroller.enabled"));
    const perSide = scroller ? num(ctx, "visual.tagWheel.scroller.size") : 0;
    const direction = readText(ctx, "visual.tagWheel.scroller.direction", "full");
    const markers = Boolean(ctx.get("visual.tagWheel.showMarkers"));

    const left = fieldsOn(fields, "left");
    /* Скроллер на втором Field слева: видны обе стороны панели и обычные чипы. */
    const shown = left[1] || left[0] || fields[0] || null;
    /* Одно объявление на активную ячейку и ячейку с выбранным значением (У-32). */
    const cellValues = (f: PreviewField | null): string[] => (!f
      ? []
      : f.kind === "element"
        ? [f.name]
        : f.values.filter(v => v.depth === 0).map(v => (markers ? "#" : "") + v.token));
    /* Круг как в заметке: пустое место первым (`tagwheel_rules_normalizer.js`), рисуется
       `-` (H1.4, 2026-10-02). */
    const real = cellValues(shown);
    const ringed = Boolean(shown && shown.kind !== "element" && real.length);
    const values = ringed ? ["-", ...real] : real;
    /* Своя подпись — только у `custom` с непустым текстом; иначе написанное, как в заметке
       (2026-10-01, У-188). */
    const valueNames = readText(ctx, "visual.tagWheel.valueNames", "default");
    const scrollLabels = readText(ctx, "visual.tagWheel.scroller.labels", "value");
    const top = (f: PreviewField | null): PreviewValue[] =>
      (!f || f.kind === "element" ? [] : f.values.filter(v => v.depth === 0));
    const printed = (v: PreviewValue): string => (v.shown === "custom" ? String(v.custom || "") : "");
    const labelled = (v: PreviewValue, mode: string): string =>
      joinValueLabel(printed(v), (markers ? "#" : "") + v.token, mode);
    const shownTop: (PreviewValue | undefined)[] = ringed ? [undefined, ...top(shown)] : top(shown);

    const n = values.length;
    /* Активное — настоящее Value, а не пустое место. */
    const at = (ringed ? 1 : 0) + (real.length > 2 ? Math.floor(real.length / 2) : 0);
    /* Круг короче коробки — заметка не повторяет его (`buildBranch`). */
    const rows = perSide && n ? Math.min(perSide, n) : 0;

    /* Вверх — следующие, вниз — предыдущие; оба круга замкнуты. */
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

    /* Цвета панели: два цвета текста и заливка (PRD 10.13.22 Пр2, H2) — на Fields, не только на коробку. */
    const fill = readText(ctx, "visual.tagWheel.fillColor", "");
    const text = readText(ctx, "visual.tagWheel.textColor", "");
    const { activeText, scrollFill, scrollText } = wheelColors(ctx);
    /* Пусто — красится как остальные неактивные. */
    const chosenText = readText(ctx, "visual.tagWheel.chosenValueColor", "") || text;
    const boldNames = Boolean(ctx.get("visual.tagWheel.boldFieldNames"));
    const lit = Boolean(ctx.get("visual.tagWheel.highlightLine"));

    const scrollerBox = (col: El, idx: readonly number[], where: string): void => {
      if (!idx.length) return;
      const p = el(col, "span", "io-wheelpanel io-wheelpanel--" + where);
      if (scrollFill) cssVar(p, "--io-wheel-bg", scrollFill);
      if (scrollText) cssVar(p, "--io-wheel-fg", scrollText);
      for (const i of idx) {
        const v = shownTop[i];
        el(p, "span", "io-wheelval", v ? labelled(v, scrollLabels) : values[i] as string);
      }
    };

    /* Обособление — на контейнере стороны: в заметке `==…==` обнимает панель целиком (Пр4). */
    const dressed = new Set<El>();
    const dressSide = (side: El): void => {
      if (dressed.has(side)) return;
      dressed.add(side);
      side.addClass("io-wheelline");
      if (!lit) return;
      side.addClass("io-wheelline--lit");
      if (fill) cssVar(side, "--io-wheel-lit", fill);
    };

    let plainCells = 0;
    structuralLine(stage, ctx, fields, (side, f) => {
      dressSide(side);
      const isShown = f === shown;
      const col = el(side, "span", "io-wheelcol");
      /* Ячейка — текст: активная (одна, Field человека) в квадратных скобках (Пр1, Пр5). */
      const label = f.short || f.name;
      /* Одна неактивная ячейка с выбранным значением (2026-09-17, У-113) — вторая, а не
         первая: первая остаётся именем поля, чтобы видеть переименование Field. */
      if (!isShown) plainCells += 1;
      let filled = "";
      if (!isShown && plainCells === 2) {
        /* Значение со своей подписью, если есть: иначе `tagWheel Value names` не показать. */
        const vals = top(f);
        const pick = vals.find(v => printed(v).trim()) || vals[0];
        filled = pick ? labelled(pick, valueNames) : String(cellValues(f)[0] || "");
      }
      /* `Bold Field names` — как в заметке, только при обособленной строке. */
      const named = !isShown && !filled && boldNames && lit;
      const cell = el(col, "span", "io-wheelcell" + (isShown ? " io-wheelcell--active" : "") + (named ? " io-wheelcell--name" : ""),
        isShown ? "[" + String(values[at] || label) + "]" : (filled || label));
      if (isShown) {
        if (activeText) cssVar(cell, "--io-wheel-cell-active", activeText);
      } else if (filled) {
        if (chosenText) cssVar(cell, "--io-wheel-cell", chosenText);
      } else if (text) {
        cssVar(cell, "--io-wheel-cell", text);
      }
      if (!isShown) return;
      scrollerBox(col, up, "up");
      scrollerBox(col, down, "down");
    /* Класс строки: прозрачность блока гасит чипы, но не коробку скроллера — CSS
       `opacity` предка потомком не отменить (B2, 2026-09-02). Заливки Block здесь нет
       нарочно (2026-09-22). */
    }, "io-line--wheel", { blockFill: false, plainSize: true });

    if (example) rich(el(foot, "p", "io-preview__note"), askText(ctx, SINGLE_KEYS.previewExample, PREVIEW_EXAMPLE));
  };

  draw();
  const unwatch = ctx.watch(WHEEL_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};

/* Подписи «почему полос нет» (1.5.3.2) живут в `FRAME_TEXTS` (10.13.46, У-32). */

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
  "visual.tagBars.lineGap",
  "visual.tagBars.joinTree",
  "visual.tagBars.drawWholeTree",
  "visual.tags.opacityLeft",
  "visual.tags.opacityRight",
  "pkm.lineFormat.separator1",
  /* Ветка `pkm.fields` целиком: `previewFields` читает её (1.4.1.1.3), листья не перечислить. */
  "pkm.fields",
  "visual.tags.byTag",
] as const;

/**
 * Предпросмотр Bars: полоса на всю высоту строки с Field и её поддерева (П4). Текст
 * строк не зависит от выбранного Field; скрывается один тег — того Field, и только
 * при выключенном `Show the Field's tag`. Полоса — абсолютный `::before` в жёлобе (П5);
 * дорожка 0 — самая левая, родителя (П6).
 */
export const barsPreview: CustomRender = (host, ctx) => {
  const text = PREVIEW_TEXTS["bars-preview"];
  const shell = previewShell(host, ctx, "bars-preview");
  const tree = el(shell.box, "div", "io-tree");

  /* Только реально выбранный Field, без подстановки из мокданных (1.5.3.2): пустой
     `fieldId` — ни одной полосы, как у движка. */
  const chosenField = (): string => readText(ctx, "visual.tagBars.fieldId", "");

  /** Места выдуманного дерева в порядке появления — места, а не id (П13). */
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

    /* Separator уходит, только когда перед текстом ничего не осталось; если там был
       заменённый полосой тег — решает настройка ниже. */
    const replaced = hideChosen && ids.includes(chosen);
    const sepHidden = !shown.length &&
      (!replaced || Boolean(ctx.get("visual.tagBars.hideSeparatorWhenOnlyStripToken")));
    if (!sepHidden) el(line, "span", "io-line__sep", sep(ctx, SEP1_PATH));
    el(line, "span", "io-line__text", node.text);
  };

  const drawNode = (
    parent: El, node: PreviewNode, depth: number,
    fields: readonly PreviewField[], slots: SlotMap,
  ): void => {
    const active = Boolean(ctx.get("visual.tagBars.active"));
    const cap = num(ctx, "visual.tagBars.stripesToShow");
    const chosen = chosenField();
    const v = carried(node, slots).includes(chosen)
      ? valueAtDepth(fields.find(f => f.id === chosen) || null, depth)
      : null;
    /*
     * Дорожка — глубина в дереве, не счётчик полос (B22, 2026-09-02), как `depthFromRoot`
     * в `priority_strip_engine.js` (П9). Выключенный тумблер поддерева (PRD 10.13.21 Б5) —
     * дорожка одна, полоса у строки одна.
     */
    const whole = ctx.get("visual.tagBars.drawWholeTree") !== false;
    const bar = active && v !== null && (whole ? depth < cap : true);

    const box = el(parent, "div", "io-node" + (bar ? " io-node--bar" : ""));
    if (bar && v) {
      cssVar(box, "--io-bar-color", v.fill);
      cssVar(box, "--io-lane", String(whole ? depth : 0));
      /* Зазор — из настройки (PRD 10.13.16). `Join Bars in a tree` не читается: полоса
         рисуется на поддереве целиком (П6), рвать нечего; тумблер держат проверки движка. */
      cssVar(box, "--io-bar-inset", num(ctx, "visual.tagBars.lineGap") + "px");
    }
    drawLine(box, node, depth, fields, slots);
    /* Дети внутри узла с полосой — она идёт по поддереву (П6); выключенный тумблер выносит их. */
    const kids = whole ? box : parent;
    for (const child of node.children) {
      drawNode(kids, child, depth + 1, fields, slots);
    }
  };

  const draw = (): void => {
    tree.empty();
    /* Полосы — только у Field типа tag (цвет Value); места дерева — на тегах (1.5.3.2, пункт 2). */
    const all = previewFields(ctx);
    const tags = all.fields.filter(f => f.kind === "tag");
    const fields = tags;
    const example = all.example;
    cssVar(tree, "--io-bar-thickness", num(ctx, "visual.tagBars.thickness") + "px");
    cssVar(tree, "--io-bar-gap", num(ctx, "visual.tagBars.childOffset") + "px");
    cssVar(tree, "--io-bar-distance", num(ctx, "visual.tagBars.spacing") + "px");
    const nodes = (text && text.tree) || [];
    const slots = resolveSlots(fields, treeSlots(nodes));
    for (const node of nodes) drawNode(tree, node, 0, fields, slots);
    /* Field не выбран — пустота объясняется человеку (З8 наоборот). */
    const chosen = chosenField();
    if (ctx.get("visual.tagBars.active") && !fields.some(f => f.id === chosen)) {
      rich(el(tree, "p", "io-preview__note"), !tags.length
        ? frame(ctx, "BARS_NO_TAG_FIELD")
        : frame(ctx, chosen ? "BARS_FIELD_GONE" : "BARS_NEED_FIELD"));
    }
    if (example) rich(el(tree, "p", "io-preview__note"), askText(ctx, SINGLE_KEYS.previewExample, PREVIEW_EXAMPLE));
  };

  draw();
  const unwatch = ctx.watch(BARS_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};

/* ---- предпросмотр строки (П3) ------------------------------------------ */

/** Пути, от которых зависит разбор строки. */
const LINE_PATHS = [
  "pkm.lineFormat.separator1",
  "pkm.lineFormat.separator2",
  "visual.tags.opacityLeft",
  "visual.tags.opacityRight",
  "visual.tags.bubbleWidthPct",
  "visual.tags.bubbleHeightPct",
  "visual.tags.cornersPct",
  /*
   * Fields и цвета их Values: предпросмотр читает их через `previewFields`,
   * а подписан на них не был — вторая половина дефекта 1.4.1.1.3. Ветка
   * целиком, а не отдельные пути: у Field меняется то имя, то сторона, то
   * список Values, и перечислить это по листьям значит однажды отстать.
   */
  "pkm.fields",
  "visual.tags.byTag",
] as const;

/**
 * Предпросмотр строки целиком (П3): `Prefix`, Left Block, `First Separator`, текст,
 * `Second Separator`, Right Block — Fields, не значения. Три ряда на одной сетке,
 * чтобы подписи стояли под своим; подписи Separator — `position: absolute`.
 */
export const linePreview: CustomRender = (host, ctx) => {
  const shell = previewShell(host, ctx, "line-preview");
  const holder = el(shell.box, "div", "io-struct");
  const foot = el(shell.box, "div", "io-preview__foot");

  const draw = (): void => {
    holder.empty();
    foot.empty();
    /* Полосы Block здесь нет (цикл 90). */
    applyTagVars(holder, ctx, { plainSize: true, blockFill: false });
    const { fields, example } = previewFields(ctx);

    const cell = (cls: string, fill?: (c: El) => void): El => {
      const c = el(holder, "div", "io-struct__cell " + cls);
      if (fill) fill(c);
      return c;
    };
    /* Подписи — над строкой, под ней custom block (его пункт «Новое» 2026-10-04). */
    /* Ряд первый — подписи Separator, каждая по центру своей колонки. */
    const sepName = (text: string): void => {
      el(el(holder, "div", "io-struct__sepname"), "span", undefined, text);
    };
    el(holder, "div");
    el(holder, "div");
    sepName(frame(ctx, "PREVIEW_SEPARATOR_1"));
    el(holder, "div");
    sepName(frame(ctx, "PREVIEW_SEPARATOR_2"));
    el(holder, "div");

    /* Ряд второй — имена Blocks над скобками и засечки над Separator. */
    const block = (text: string): void => {
      const w = el(holder, "div", "io-struct__block");
      el(w, "div", "io-struct__name", text);
      el(w, "div", "io-struct__bracket io-struct__bracket--top");
    };
    el(holder, "div");
    block(frame(ctx, "PREVIEW_LEFT_BLOCK"));
    el(holder, "div", "io-struct__tick");
    el(holder, "div");
    el(holder, "div", "io-struct__tick");
    block(frame(ctx, "PREVIEW_RIGHT_BLOCK"));

    /* Ряд третий — сама строка. */
    cell("io-struct__prefix", c => { el(c, "span", "io-line__prefix", "- "); });
    cell("io-struct__side io-line__side--left", c => {
      for (const f of fieldsOn(fields, "left")) fieldChip(c, f);
    });
    cell("io-struct__sep", c => {
      el(c, "span", "io-line__sep", sep(ctx, SEP1_PATH));
    });
    cell("io-struct__text", c => { el(c, "span", "io-line__text", askText(ctx, SINGLE_KEYS.previewLine, PREVIEW_LINE_TEXT)); });
    cell("io-struct__sep", c => {
      el(c, "span", "io-line__sep", sep(ctx, SEP2_PATH));
    });
    cell("io-struct__side io-line__side--right", c => {
      const right = fieldsOn(fields, "right");
      if (right.length) for (const f of right) fieldChip(c, f);
      else el(c, "span", "io-line__hint", frame(ctx, "PREVIEW_EMPTY_VALUE"));
    });

    /* Ряд четвёртый — стрелка от середины текста к custom block, каждый как Left/Right: чипы, скобка, имя. */
    const blocks = previewCustomBlocks(ctx);
    if (blocks.length) {
      const tree = el(el(holder, "div", "io-struct__custom"), "div", "io-struct__tree");
      for (const b of blocks) {
        const branch = el(tree, "div", "io-struct__branch");
        const chips = el(branch, "div", "io-struct__cell");
        if (b.fields.length) for (const f of b.fields) fieldChip(chips, f);
        else el(chips, "span", "io-line__hint", frame(ctx, "PREVIEW_EMPTY_VALUE"));
        const w = el(branch, "div", "io-struct__block");
        el(w, "div", "io-struct__bracket");
        el(w, "div", "io-struct__name", b.name);
      }
    }

    /* Пример помечается: иначе человек решит, что видит свои Fields (ПЗ2). */
    if (example) rich(el(foot, "p", "io-preview__note"), askText(ctx, SINGLE_KEYS.previewExample, PREVIEW_EXAMPLE));
  };

  draw();
  const unwatch = ctx.watch(LINE_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};

/** Места предпросмотра оформления: два Field слева, места, а не id (П13). */
const TAG_SLOTS = ["status", "priority"] as const;

/*
 * Ссылка «как написано» — три куска: скобка, цель, скобка (`З-37`); не разобралась —
 * одним куском. Вторая отрисовка — прототип (`renderWrittenLink`, правило 41).
 */
export function drawWrittenLink(host: El, text: string): El {
  const src = String(text || "");
  const m = /^(\[\[)([\s\S]*)(\]\])$/.exec(src);
  if (!m) return el(host, "span", "io-link", src);
  const box = el(host, "span", "io-link");
  el(box, "span", "io-link__mark", m[1]);
  el(box, "span", "io-link__target", m[2]);
  el(box, "span", "io-link__mark", m[3]);
  return box;
}

/** Пути предпросмотра цветов ссылок, обе пары. */
const LINK_PATHS = [
  "visual.tags.linkAsWritten",
  "visual.tags.hyperlink",
] as const;

/**
 * Цвета пары на узел ссылки. Пусто — у темы (У-60). Переменные те же, что у заметки
 * (У-32); у гиперссылки они объявляются на её узле — каскад отдаёт ближнему.
 */
function linkPreviewVars(node: El, ctx: SettingsCtx, targetPath: string, bracketsPath: string): void {
  const target = String(ctx.get(targetPath) || "").trim();
  const brackets = String(ctx.get(bracketsPath) || "").trim();
  cssVar(node, "--io-link-target", target || "var(--text-accent)");
  cssVar(node, "--io-link-brackets", brackets || "var(--text-accent)");
}

/**
 * Предпросмотр цветов ссылок (2026-09-22). Формы разбиты как в движке
 * (`scanHyperlinksInLine`, `editor_visuals_config.js`): у `[подпись](адрес)` разметка —
 * `[` и `](адрес)`, у голого адреса разметки нет. Вторая отрисовка — прототип
 * (`renderLinkPreview`, правило 41).
 */
export const linkPreview: CustomRender = (host, ctx) => {
  const text = PREVIEW_TEXTS["link-preview"];
  const shell = previewShell(host, ctx, "link-preview");
  const holder = el(shell.box, "div", "io-preview__body");

  const draw = (): void => {
    holder.empty();

    const wiki = el(holder, "div");
    linkPreviewVars(drawWrittenLink(wiki, askText(ctx, previewKey("link-preview", "wikilink"), text ? text.wikilink || "" : "")),
      ctx, "visual.tags.linkAsWritten.targetColor", "visual.tags.linkAsWritten.bracketsColor");

    const md = el(holder, "div");
    const mdBox = el(md, "span", "io-link");
    el(mdBox, "span", "io-link__mark", "[");
    el(mdBox, "span", "io-link__target", askText(ctx, previewKey("link-preview", "label"), text ? text.label || "" : ""));
    el(mdBox, "span", "io-link__mark", "](");
    /* Адрес — свой кусок, переменная на нём самом (2026-09-22, У-32). */
    const mdAddr = el(mdBox, "span", "io-link__mark", askText(ctx, previewKey("link-preview", "address"), text ? text.address || "" : ""));
    el(mdBox, "span", "io-link__mark", ")");
    linkPreviewVars(mdBox, ctx, "visual.tags.hyperlink.targetColor", "visual.tags.hyperlink.bracketsColor");
    linkPreviewVars(mdAddr, ctx, "visual.tags.hyperlink.targetColor", "visual.tags.hyperlink.addressColor");

    /* Голый адрес — адрес, а не подпись (2026-09-22). */
    const bare = el(holder, "div");
    const bareBox = el(bare, "span", "io-link");
    el(bareBox, "span", "io-link__mark", askText(ctx, previewKey("link-preview", "bare"), text ? text.bare || "" : ""));
    linkPreviewVars(bareBox, ctx, "visual.tags.hyperlink.targetColor", "visual.tags.hyperlink.addressColor");
  };

  draw();
  const unwatch = ctx.watch(LINK_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};

/** Предпросмотр тегов: два Value слева, текст, справа элемент и ссылка — без пузырей, но под прозрачностью стороны. */
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
    /* Места `status`/`priority` разрешает `resolveSlots`, а не поиск по id (П13). */
    const slots = resolveSlots(fields, TAG_SLOTS);
    for (const slot of TAG_SLOTS) {
      const f = slots.get(slot);
      if (f) drawTagField(left, f, ctx);
    }

    el(line, "span", "io-line__sep", sep(ctx, SEP1_PATH));
    el(line, "span", "io-line__text", text ? askText(ctx, previewKey("tag-preview", "line"), text.line || "") : "");
    el(line, "span", "io-line__sep", sep(ctx, SEP2_PATH));

    const right = el(line, "span", "io-line__side io-line__side--right");
    if (text && text.element) el(right, "span", "io-elem", askText(ctx, previewKey("tag-preview", "element"), text.element));
    if (text && text.link) drawWrittenLink(right, askText(ctx, previewKey("tag-preview", "link"), text.link));

    /* Пример помечается, иначе Fields примут за свои (ПЗ2). */
    if (example) rich(el(holder, "p", "io-preview__note"), askText(ctx, SINGLE_KEYS.previewExample, PREVIEW_EXAMPLE));
  };

  draw();
  const unwatch = ctx.watch(TAG_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};
/** Пути, от которых зависит строка под плавающей кнопкой. */
const FLOAT_PATHS = [
  "pkm.lineFormat.separator1",
  "pkm.lineFormat.separator2",
  /* Ветка `pkm.fields` целиком: `previewFields` читает её (1.4.1.1.3), листья не перечислить. */
  "pkm.fields",
  "visual.tags.byTag",
  /* Отступ кнопки — сразу со слайдером (У-24). */
  "transform.inline2note.floatingButtonGap",
] as const;

/** На кнопке одна стрелка и класс `io-flybtn`, как в заметке (2026-09-04, У-32). */
const FLOAT_LABEL = "\u2192";

/**
 * Где появляется плавающая кнопка Transform (10.3). В панели пока снят списком
 * `AWAITING_ENGINE` (`build/gen_schema.js`): кнопки в плагине нет,
 * `flyingButton.enabled` никто не читает (Ж2, З8); включается снятием строки
 * в фазе 5. Кнопка — `span`, не `<button>`: немой контрол запрещён (З8).
 */
export const floatingButton: CustomRender = (host, ctx) => {
  const shell = previewShell(host, ctx, "i2n-button-preview");
  const text = PREVIEW_TEXTS["i2n-button-preview"];
  const holder = el(shell.box, "div");

  const draw = (): void => {
    holder.empty();
    const row = el(holder, "div", "io-floatrow");
    const { fields } = previewFields(ctx);
    structuralLine(row, ctx, fields);
    const button = el(row, "span", "io-flybtn", FLOAT_LABEL);
    /* Та же переменная, что ставит декорация в заметке (У-32). */
    cssVar(button, "--io-flybtn-gap", num(ctx, "transform.inline2note.floatingButtonGap") + "px");
    el(holder, "p", "io-preview__note", text ? askText(ctx, previewKey("i2n-button-preview", "note"), text.note || "") : "");
  };

  draw();
  const unwatch = ctx.watch(FLOAT_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};

/* ---- предпросмотр `Source line` (10.13.10) ------------------------------ */

/** Написания Value в строке: тег `#todo`, ссылка `[[Proj]]`, элемент с меткой. */
function valueSpellings(
  fields: readonly PreviewField[],
): Map<string, { value: PreviewValue; kind: string }> {
  const out = new Map<string, { value: PreviewValue; kind: string }>();
  const put = (key: string, value: PreviewValue, kind: string): void => {
    const k = key.trim();
    if (k && !out.has(k)) out.set(k, { value, kind });
  };
  for (const f of fields) {
    for (const v of f.values) {
      if (!v.token) continue;
      put(v.token, v, f.kind);
      put("#" + v.token, v, f.kind);
      put("[[" + v.token + "]]", v, f.kind);
    }
  }
  return out;
}

/**
 * Строка теми же узлами, что остальные предпросмотры (B13, 2026-09-02). Разбор
 * намеренно грубый — раскраска результата движка по написанию, не второй разбор
 * правил; неузнанное остаётся текстом (П9).
 */
function drawSourceLine(
  row: El,
  ctx: SettingsCtx,
  line: string,
  known: Map<string, { value: PreviewValue; kind: string }>,
): void {
  applyTagVars(row, ctx);
  const sep1 = sep(ctx, SEP1_PATH);
  const sep2 = sep(ctx, SEP2_PATH);

  /* Префикс (буллит, номер, чекбокс) — своим узлом: видно, что с началом строки. */
  const prefix = /^(\s*(?:[-*+]|\d+\.)\s+(?:\[[^\]]?\]\s+)?)/.exec(line);
  let rest = line;
  if (prefix) {
    el(row, "span", "io-line__prefix", prefix[1] as string);
    rest = line.slice((prefix[1] as string).length);
  }

  /* Пробелы — текстовыми узлами, не зазором flex (B13, 2026-09-02): нарисованный текст
     совпадает с исходным посимвольно, это проверяемо. */
  for (const piece of rest.split(/(\s+)/)) {
    if (!piece) continue;
    if (/^\s+$/.test(piece)) {
      el(row, "span", "io-line__gap", piece);
      continue;
    }
    if (piece === sep1 || piece === sep2) {
      el(row, "span", "io-line__sep", piece);
      continue;
    }
    const hit = known.get(piece);
    if (hit && hit.kind === "tag") {
      /* Тег — пузырь тем же кодом (П9). */
      bubble(row, hit.value, piece.replace(/^#/, "") ? undefined : piece);
      continue;
    }
    if (hit) {
      /* Ссылка и элемент — текст, как в заметке; прозрачность — стилем. */
      el(row, "span", "io-line__side io-line__side--left", piece);
      continue;
    }
    el(row, "span", "io-line__text", piece);
  }
}

/** Пути, от которых зависит, что останется на строке. */
const SOURCE_PATHS = [
  "transform.inline2note.sourceProcessing.text",
  "transform.inline2note.sourceProcessing.keepWords",
  "transform.inline2note.sourceProcessing.cleanupFieldIds",
  "transform.inline2note.sourceProcessing.replaceWithLink",
  "transform.inline2note.sourceProcessing.token",
  "transform.inline2note.sourceProcessing.panel",
  "transform.inline2note.sublines",
  "pkm.fields",
  "pkm.lineFormat",
] as const;

/**
 * Что станет с исходной строкой после `Inline to note` (1.4.3.1.2). Считает движок —
 * `buildSourcePreviewTree` (`transform_feature.js`), блок только рисует (У-4).
 */
export const sourcePreview: CustomRender = (host, ctx) => {
  const shell = previewShell(host, ctx, "source-preview");
  const body = el(shell.box, "div", "io-srcprev");
  /* Подсказка у каждой половины (2026-09-08): «?» в подписи, тело — в слоте за ней. */
  let halfTips: Array<() => void> = [];
  const dropHalfTips = (): void => {
    for (const close of halfTips) { try { close(); } catch { /* узла уже нет */ } }
    halfTips = [];
  };

  const draw = (): void => {
    dropHalfTips();
    body.empty();
    const p = ctx.platform;
    const cfg = p ? p.getConfig() : null;
    const i2n = ((cfg as Record<string, Record<string, unknown>> | null)?.["transform"] as
      Record<string, unknown> | undefined)?.["inline2note"];
    const tree = cfg ? sourceEngine.buildSourcePreviewTree(i2n, cfg) : null;
    const before = tree && Array.isArray(tree.before) ? tree.before : [];
    const after = tree && Array.isArray(tree.after) ? tree.after : [];
    if (!before.length) {
      rich(el(body, "p", "io-preview__note"), frame(ctx, "PREVIEW_NO_FIELDS"));
      return;
    }
    const fields = previewFields(ctx).fields;
    const known = valueSpellings(fields);
    const half = (label: string, tip: string, lines: readonly string[]): void => {
      const cap = el(body, "div", "io-srcprev__cap");
      el(cap, "span", undefined, label);
      const slot = el(body, "div", "io-tabletipslot");
      halfTips.push(tipBelow({
        head: cap,
        host: slot,
        text: frame(ctx, tip),
        label,
        id: "io-srcprev-" + tip.replace(/^PREVIEW_/, "").toLowerCase().replace(/_tip$/, "") + "-tip",
        showTips: Boolean(ctx.get("general.help.showTips")),
        showIds: Boolean(ctx.get("advanced.showSettingIds")),
      }));
      const box = el(body, "div", "io-srcprev__lines");
      for (const line of lines) {
        const row = el(box, "div", "io-srcprev__line");
        /* Отступ — классом, не табуляцией: виден и мерится, как в дереве Bars. */
        if (/^\s/.test(line)) row.classList.add("io-srcprev__line--sub");
        drawSourceLine(row, ctx, line.replace(/^\s+/, ""), known);
      }
    };
    half(frame(ctx, "PREVIEW_BEFORE"), "PREVIEW_BEFORE_TIP", before);
    half(frame(ctx, "PREVIEW_AFTER"), "PREVIEW_AFTER_TIP", after);
  };

  draw();
  const unwatch = ctx.watch(SOURCE_PATHS, draw);
  return () => { unwatch(); dropHalfTips(); shell.close(); };
};

/* ---- предпросмотр каретки (10.13.33 Ц8) --------------------------------- */

const JUMP_FLASH_PATHS = [
  "visual.jumpFlash.enabled",
  "visual.jumpFlash.color",
  "visual.jumpFlash.radius",
  "visual.jumpFlash.fadeMs",
  /* Задержка — с тех пор, как круг мигает сам (2026-09-17). */
  "visual.jumpFlash.quietMs",
] as const;

/**
 * Подсветка места прыжка курсора (Н5, 2026-09-16). Гасит круг анимация, не таймер —
 * уезжает с узлом. Круг мигает сам по кругу (2026-09-17): `fadeMs` жизни, `quietMs`
 * тишины; при нуле — подряд. Таймер снимается при закрытии и перед перерисовкой и
 * не заводится на отцепленном узле.
 */
export const jumpFlashPreview: CustomRender = (host, ctx) => {
  const shell = previewShell(host, ctx, "jump-flash-preview");
  const text = PREVIEW_TEXTS["jump-flash-preview"];
  const holder = el(shell.box, "div");
  let timer = 0;
  const stop = (): void => {
    if (timer) { clearTimeout(timer); timer = 0; }
  };

  const draw = (): void => {
    stop();
    holder.empty();
    const row = el(holder, "div", "io-jumpline");
    const line = askText(ctx, SINGLE_KEYS.previewLine, PREVIEW_LINE_TEXT);
    el(row, "span", undefined, line);

    const color = readText(ctx, "visual.jumpFlash.color", "");
    cssVar(row, "--io-jump-radius", (num(ctx, "visual.jumpFlash.radius") || 18) + "px");
    cssVar(row, "--io-jump-fade", (num(ctx, "visual.jumpFlash.fadeMs") || 450) + "ms");
    /* Пусто — цвет темы, на шве (У-60): в `HexString` пустота не влезает. */
    cssVar(row, "--io-jump-color", color || "var(--interactive-accent)");

    let shown: El | null = null;
    const pulse = (): void => {
      /* Снятый перерисовкой узел (У-114). `isConnected` спрашивается: заглушка DOM его не
         знает, и «не знаю» читается как «на странице». */
      if ((row as { isConnected?: boolean }).isConnected === false) { timer = 0; return; }
      /* Прежний круг — по ссылке, не поиском классом (второе объявление). */
      if (shown) shown.remove();
      const spot = el(row, "span", "io-jumpflash");
      shown = spot;
      /* Круг — на конец написанного; место переменной, вид в стилях (Р7). */
      cssVar(spot, "--io-jump-x", "calc(8px + " + line.length + "ch)");
      const fade = num(ctx, "visual.jumpFlash.fadeMs") || 450;
      const quiet = num(ctx, "visual.jumpFlash.quietMs");
      const next = setTimeout(pulse, fade + quiet) as unknown as { unref?: () => void };
      /* В Node таймер без `unref` держит процесс — незакрытый в проверке предпросмотр
         подвесил бы прогон. В браузере `unref` нет. */
      if (typeof next.unref === "function") next.unref();
      timer = next as unknown as number;
    };
    pulse();

    /* Пустой <p> оставил бы отступ. */
    if (text && text.note) {
      el(holder, "p", "io-preview__note", askText(ctx, previewKey("jump-flash-preview", "note"), text.note));
    }
  };

  draw();
  const unwatch = ctx.watch(JUMP_FLASH_PATHS, draw);
  return () => { unwatch(); stop(); shell.close(); };
};

const CARET_PATHS = [
  "visual.caret.enabled",
  "visual.caret.color",
  "visual.caret.shapeEnabled",
  "visual.caret.width",
  "visual.caret.blinkSpeed",
] as const;

/** Толщина каретки, какой её рисует Obsidian, пока форму не задали. */
const CARET_THEME_WIDTH = 1.2;
/** Мерцание CodeMirror по умолчанию: `cursorBlinkRate` = 1200 мс. */
const CARET_THEME_BLINK = 1200;

/**
 * Скорость 1..10 в мс. 5 — нынешнее мерцание Obsidian, оно же умолчание. Ноль сюда
 * не доходит: «не мигает» снимает анимацию (0 в CSS — «мгновенно»). Формула одна и
 * для стилей заметки (У-32).
 */
export function caretBlinkMs(speed: number): number {
  const s = Number.isFinite(speed) ? Math.max(1, Math.min(10, speed)) : 5;
  return 2200 - s * 200;
}

/**
 * Каретка как в заметке (10.13.33 Ц8, 2026-09-05): цвет, толщина, скорость. П9: рисует
 * панель; мерцание тем же `steps(1)`, что у CodeMirror.
 */
export const caretPreview: CustomRender = (host, ctx) => {
  const shell = previewShell(host, ctx, "caret-preview");
  const text = PREVIEW_TEXTS["caret-preview"];
  const holder = el(shell.box, "div");

  const draw = (): void => {
    holder.empty();
    const row = el(holder, "div", "io-caretline");
    el(row, "span", undefined, askText(ctx, SINGLE_KEYS.previewLine, PREVIEW_LINE_TEXT) + " ");
    el(row, "span", "io-caret");

    const shaped = ctx.get("visual.caret.shapeEnabled") === true;
    const width = shaped ? (num(ctx, "visual.caret.width") || 2) : CARET_THEME_WIDTH;
    const speed = num(ctx, "visual.caret.blinkSpeed");
    /* Цвет — только при включённом тумблере цвета: половины группы независимы. */
    const color = ctx.get("visual.caret.enabled") === true
      ? readText(ctx, "visual.caret.color", "")
      : "";

    cssVar(row, "--io-caret-width", width + "px");
    /* Сдвиг на полтолщины — как у Obsidian, иначе толстая каретка съезжает вправо. */
    cssVar(row, "--io-caret-shift", (-width / 2) + "px");
    cssVar(row, "--io-caret-color", color || "var(--text-normal)");
    cssVar(row, "--io-caret-blink", (shaped ? caretBlinkMs(speed) : CARET_THEME_BLINK) + "ms");
    if (shaped && speed <= 0) row.classList.add("io-caretline--still");
    else row.classList.remove("io-caretline--still");

    el(holder, "p", "io-preview__note", text ? askText(ctx, previewKey("caret-preview", "note"), text.note || "") : "");
  };

  draw();
  const unwatch = ctx.watch(CARET_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};
