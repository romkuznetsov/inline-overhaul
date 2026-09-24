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
 * предпросмотр говорит о себе одной фразой, и говорит её в своём «?»: на
 * экране отдельной серой строки над картинкой больше нет (замечание
 * заказчика 1.4.1.1.1, PRD 10.3 П10).
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
  fieldColor,
  typeInk,
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
/*
 * Правило «получает ли эта сторона полосу» (З-12) берётся у того же модуля,
 * которым живёт слой заметки: у правила вида два места отрисовки и один дом
 * (У-217). Своя копия здесь разошлась бы с заметкой первым же уточнением.
 */
import visualsConfig from "../../../core/editor_visuals_config.js";

/** Значение настройки числом: панель отдаёт его как unknown. */
function num(ctx: SettingsCtx, path: string): number {
  const v = Number(ctx.get(path));
  return Number.isFinite(v) ? v : 0;
}

/**
 * Видимый текст предпросмотра по ключу каталога (10.13.38).
 *
 * У записи `kind: "custom"` нет ни `name`, ни `desc`, и подстановка, идущая
 * по схеме, до её текстов не достаёт. Второй аргумент — то, что написано в
 * выгрузке из прототипа: он же и ответ, когда перевода нет (Я4).
 */
function askText(ctx: SettingsCtx, key: string, fallback: string): string {
  return ctx.t ? ctx.t(key, fallback) : fallback;
}

/**
 * Строка панели по имени из `FRAME_TEXTS`: пустые состояния и подписи
 * разбора строки. Ключ строит `frameKey` — литерала на его месте нет (У-82).
 */
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
 * **Разделители: из настроек, и запасного значения у них нет** (У-186).
 *
 * Десять мест писали рядом с чтением `"||"` — то самое умолчание, которое уже
 * объявлено дважды: в схеме (`separator-1`, `separator-2`) и у движка
 * (`DEFAULT_CONFIG` в `config_normalize.js`). Третья копия у места вызова —
 * это не запас, а ложь на экране: у человека с `::` предпросмотр рисовал бы
 * `||`, если бы значение до него не доехало.
 *
 * Пустым оно быть не может: `normalizeConfigV2` прогоняет `separator1` и
 * `separator2` через `text(...)` на **каждом** патче, а через неё проходит
 * любая запись в хранилище. Если значение всё же пусто — рисуется пусто, и
 * это честнее, чем показать разделитель, которого у человека нет.
 */
const SEP1_PATH = "pkm.lineFormat.separator1";
const SEP2_PATH = "pkm.lineFormat.separator2";

function sep(ctx: SettingsCtx, path: string): string {
  const v = ctx.get(path);
  return v === undefined || v === null ? "" : String(v);
}

/**
 * Рамка предпросмотра: подпись, «?» с подсказкой и фраза о том, что это не
 * редактор. Возвращает и рамку, и снятие подсказки — очистка блока обязана
 * убрать за собой всё (С5).
 */
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
    /* Над картинкой, а не под ней: его замечание 2026-09-17 и то, как это
       устроено в прототипе. Разбор — у самого `afterHead`. */
    afterHead: true,
  });
  /*
   * Линии за подписью здесь больше нет: «в настройках в каждом live preview в
   * строке хедера (live preview) после хедера есть горизонтальная линия —
   * убери её у всех live preview окон» (заказчик, 2026-09-07). Рамку
   * предпросмотра рисует сам блок, и вторая черта внутри неё делила его
   * надвое без нужды.
   */
  return { box, close };
}

/**
 * Оформление тегов из настроек уезжает в CSS-переменные: проценты считаются
 * один раз здесь, а геометрию строит стиль. Так предпросмотр не задаёт ни
 * одного свойства кроме `--io-*` (Г1).
 *
 * Третий аргумент — то, чего у строки быть не должно: `{ blockFill: false }`
 * оставляет переменные и снимает саму подложку Block. Нужен он одному
 * предпросмотру — панели: «в io-tip-wheel-preview сейчас видна фиолетовая
 * полоска tags-block-fill-color — это не правильно, поскольку в этом preview
 * мы смотрим на tagwheel panel» (его слово 2026-09-22). Полоса Block и
 * обособление панели ложились на **один и тот же узел**, и подложка выигрывала
 * каскад тремя классами против одного: цвет панели до экрана не доезжал
 * (У-67).
 */
export function applyTagVars(node: El, ctx: SettingsCtx, opts?: { blockFill?: boolean; plainSize?: boolean }): void {
  cssVar(node, "--io-opacity-left", String(num(ctx, "visual.tags.opacityLeft") / 100));
  cssVar(node, "--io-opacity-right", String(num(ctx, "visual.tags.opacityRight") / 100));
  /*
   * **Кегль Block слушают не все предпросмотры** (его слово 2026-09-24: «в
   * io-tip-wheel-preview и io-tip-line-preview размеры полей в left и right
   * block привязаны к контролам tags-text-size-left и tags-text-size-right…
   * размеры fields в leftight blocks были как у обычного текста. Т.е.
   * размер leftight block должен меняться только у io-tip-tag-preview»).
   * `plainSize` снимает оба слайдера и даёт полям кегль соседнего текста
   * строки: основа `--io-text-size` равна `1em`, а не 11.5 точки пузыря.
   */
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
  /*
   * Заливка Left и Right Block (З-7): цвет и густота приходят переменными,
   * сама подложка — классом. Пусто в цвете значит «взять у темы» — смысл
   * живёт на шве, а не в значении (У-60).
   */
  const bandColor = String(ctx.get("visual.tags.blockFill.color") || "").trim();
  cssVar(node, "--io-blockfill-color", bandColor || "var(--text-accent)");
  cssVar(node, "--io-blockfill-opacity", String(num(ctx, "visual.tags.blockFill.opacity") / 100));
  /*
   * Два цвета ссылки, показанной **как написано** (`З-37`, его ответ `В-174`):
   * цель и скобки красятся врозь. Пусто значит «взять у темы» — и запасное
   * значение то самое, чем ссылка красилась до этой пары (У-60).
   */
  const linkTarget = String(ctx.get("visual.tags.linkAsWritten.targetColor") || "").trim();
  const linkBrackets = String(ctx.get("visual.tags.linkAsWritten.bracketsColor") || "").trim();
  cssVar(node, "--io-link-target", linkTarget || "var(--text-accent)");
  cssVar(node, "--io-link-brackets", linkBrackets || "var(--text-accent)");
  /*
   * На сколько подложка выходит за написанное (S7). Высота — в точках. Ширина
   * — шкала с переломом на середине, и три её ориентира назвал заказчик
   * (2026-09-09): ноль — по написанному, пятьдесят — до разделителя, сотня —
   * включая разделитель. Первая половина шкалы тратится на промежуток —
   * здесь это промежуток флекса `--io-line-gap`, — вторая на сам разделитель.
   *
   * Ширина разделителя взята его длиной в знаках (`ch`), а не измерена:
   * предпросмотр собирается до того, как попадёт в документ, и мерить в нём
   * нечего. В заметке та же величина именно измеряется.
   *
   * Без этих строк предпросмотр показывал бы подложку **постоянного**
   * размера при любом положении ползунков — то есть был бы вторым,
   * расходящимся объявлением правила (У-32). Ровно этим он и был до
   * 2026-09-09, и заказчик увидел разницу между панелью и заметкой.
   */
  /*
   * Высота — доля свободного места. У строки предпросмотра это её собственное
   * поле сверху и снизу (`padding: 3px 0` у `.io-line`), у строки заметки —
   * остаток зрительной строки за написанным; сотня заполняет и то и другое.
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
    /*
     * Сторона называется классом (З-12): при `both` их два, при `left` и
     * `right` — один. Общий класс остаётся — им держится высота строки, а она
     * у обеих сторон одна.
     */
    /*
     * Имена классов написаны целиком, а не собраны из куска и зоны: имя класса
     * — такое же объявление правила (У-103), и собранное по частям не находит
     * ни греп, ни сверка двух отрисовок.
     */
    const dir = ctx.get("visual.tags.blockFill.direction");
    if (visualsConfig.blockFillZoneWanted(dir, "left")) node.addClass("io-line--blockfill-left");
    if (visualsConfig.blockFillZoneWanted(dir, "right")) node.addClass("io-line--blockfill-right");
  }
}

/** Пути, от которых зависит вид тега: на них предпросмотр перерисовывается. */
const TAG_PATHS = [
  "visual.tags.opacityLeft",
  /* Заливка блоков (З-7): предпросмотр обязан показывать её сразу (У-24). */
  "visual.tags.blockFill",
  "visual.tags.opacityRight",
  "visual.tags.textSizePctLeft",
  "visual.tags.textSizePctRight",
  "visual.tags.bubbleWidthPct",
  "visual.tags.bubbleHeightPct",
  "visual.tags.emptyBubblePct",
  "visual.tags.cornersPct",
  "pkm.behavior.childTagFormat",
  "pkm.lineFormat.separator1",
  "pkm.lineFormat.separator2",
  /*
   * Fields и цвета их Values: предпросмотр читает их через `previewFields`,
   * а подписан на них не был — вторая половина дефекта 1.4.1.1.3. Ветка
   * целиком, а не отдельные пути: у Field меняется то имя, то сторона, то
   * список Values, и перечислить это по листьям значит однажды отстать.
   */
  "pkm.fields",
  "visual.tags.byTag",
  /* Цвета ссылки, показанной как написано (`З-37`): предпросмотр обязан
     показывать их сразу, а не с первой правки соседней настройки (У-24). */
  "visual.tags.linkAsWritten",
] as const;

/**
 * Подпись пузыря. Вынесена отдельно затем, что зовут её двое: отрисовка ниже и
 * живое обновление колонки `Preview`, пока человек печатает свой текст. Две
 * копии этого правила разошлись бы молча (У-32), и разошлись бы на пустом
 * тексте: подпись пустого пузыря — **неразрывный** пробел, иначе пузырь
 * схлопывается в точку.
 */
export function bubbleLabel(v: PreviewValue, override?: string): string {
  if (v.shown === "empty") return " ";
  if (override !== undefined) return override;
  return v.shown === "custom" ? (v.custom || " ") : "#" + v.token;
}

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
  /* Без своей заливки — вид тега темы; `#FFFFFF` значит «прозрачно», и в
     заливке, и в рамке (`Side`) — его пункт цикла 89. Правило одно на
     заметку и панель (`isClearColor`). */
  const filled = !!v.fill && !visualsConfig.isClearColor(v.fill);
  const b = el(parent, "span", "io-bubble" + (empty ? " io-bubble--empty" : "")
    + (filled ? " io-bubble--filled" : "") + (v.side ? " io-bubble--side" : ""), bubbleLabel(v, override));
  cssVar(b, "--io-bubble-bg", v.fill && visualsConfig.isClearColor(v.fill) ? "transparent" : v.fill);
  if (v.text) cssVar(b, "--io-bubble-fg", v.text);
  if (v.side) cssVar(b, "--io-bubble-side", visualsConfig.isClearColor(v.side) ? "transparent" : v.side);
  return b;
}

/**
 * Value с подзначением: одним пузырём `#parent/child` или двумя рядом —
 * так, как решает `Child tag format`.
 */
function drawTagField(parent: El, f: PreviewField, ctx: SettingsCtx): void {
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
  cssVar(chip, "--io-bubble-fg", typeInk(f.kind));
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
  /*
   * Цвета коробки скроллера. Их тут тоже не было — та же половина дефекта,
   * что у цвета активного Field (У-24): предпросмотр не перерисовывался на их
   * изменение, и человек не увидел бы работу настройки, даже когда коробка
   * научилась их читать.
   */
  "visual.tagWheel.scroller.fillColor",
  "visual.tagWheel.scroller.textColor",
  "visual.tagWheel.showMarkers",
  "visual.tagWheel.fillColor",
  "visual.tagWheel.textColor",
  /*
   * Эти два пути тут не было, и предпросмотр не перерисовывался на их
   * изменение вовсе — то есть не показал бы работу настроек, даже если бы
   * умел их рисовать (замечание H2, PRD 10.13.22 Пр3; У-24).
   */
  "visual.tagWheel.activeTextColor",
  /* Цвет ячейки с выбранным значением — его заказ 2026-09-17. */
  "visual.tagWheel.chosenValueColor",
  "visual.tagWheel.highlightLine",
  "visual.tags.opacityLeft",
  "visual.tags.opacityRight",
  "pkm.lineFormat.separator1",
  "pkm.lineFormat.separator2",
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
    const direction = readText(ctx, "visual.tagWheel.scroller.direction", "full");
    const markers = Boolean(ctx.get("visual.tagWheel.showMarkers"));

    const left = fieldsOn(fields, "left");
    /* Скроллер садится на второй Field слева: так обе стороны панели видно,
       и видно, что остальные Fields остаются обычными чипами. */
    const shown = left[1] || left[0] || fields[0] || null;
    /* Что показывает ячейка этого Field — одно объявление на обе ячейки:
       активную и ту, у которой значение уже выбрано (У-32). */
    const cellValues = (f: PreviewField | null): string[] => (!f
      ? []
      : f.kind === "element"
        ? [f.name]
        : f.values.filter(v => v.depth === 0).map(v => (markers ? "#" : "") + v.token));
    const values = cellValues(shown);

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

    /*
     * Цвета панели: два цвета текста и заливка (PRD 10.13.22 Пр2).
     *
     * До 2026-09-04 предпросмотр применял их **только к коробке скроллера**, а
     * Fields рисовал чипами Value — цветом Field. То есть показывал не то, чем
     * управляют эти настройки: «io-tip-wheel-preview не показательная… я не
     * могу проверить в нем как работают настройки panel-active-color и
     * panel-text-color» (замечание H2).
     */
    const fill = readText(ctx, "visual.tagWheel.fillColor", "");
    const text = readText(ctx, "visual.tagWheel.textColor", "");
    const activeText = readText(ctx, "visual.tagWheel.activeTextColor", "") || text;
    /* Пусто — ячейка с выбранным значением красится как остальные
       неактивные: так сказано в самой строке панели. */
    const chosenText = readText(ctx, "visual.tagWheel.chosenValueColor", "") || text;
    const lit = Boolean(ctx.get("visual.tagWheel.highlightLine"));

    /*
     * Коробка скроллера — не панель, и цвета у неё свои: `Scroller background
     * color` и `Scroller text color`.
     *
     * Здесь стояли цвета панели, и заказчик увидел ровно это: «в
     * io-tip-wheel-preview panel-background меняет цвет и заливки tagwheel и
     * заливки scroller; заливка scroller должна быть как у scroller-fill»
     * (замечание к H2, 2026-09-04). В заметке коробку красит оверлей
     * (`tagwheel_scroller_overlay.js`) — и красит правильно, — а расходился с
     * ним только предпросмотр.
     *
     * Пусто — цвета темы: их подставляет запасное значение переменной в
     * стилях, `var(--io-wheel-bg, var(--background-primary))`.
     */
    const scrollFill = readText(ctx, "visual.tagWheel.scroller.fillColor", "");
    const scrollText = readText(ctx, "visual.tagWheel.scroller.textColor", "");

    const scrollerBox = (col: El, idx: readonly number[], where: string): void => {
      if (!idx.length) return;
      const p = el(col, "span", "io-wheelpanel io-wheelpanel--" + where);
      if (scrollFill) cssVar(p, "--io-wheel-bg", scrollFill);
      if (scrollText) cssVar(p, "--io-wheel-fg", scrollText);
      for (const i of idx) el(p, "span", "io-wheelval", values[i] as string);
    };

    /*
     * Обособление строки живёт на контейнере стороны, а не на каждой ячейке: в
     * заметке `==…==` обнимает панель целиком, и заливка у неё одна (Пр4).
     * Выключенный тумблер снимает её — красить нечего, и это ровно то, что
     * человек должен увидеть, переключая его.
     */
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
      /*
       * Ячейка панели — текст, как в заметке: активная в квадратных скобках,
       * остальные обычным словом. Активная ровно одна — тот Field, на котором
       * стоит человек (Пр1, Пр5).
       */
      const label = f.short || f.name;
      /*
       * **У одной неактивной ячейки значение уже выбрано** — его заказ
       * 2026-09-17: «в io-tip-wheel-preview сделай одно из значений
       * non-active field с выбранным value, чтобы было видно как работает
       * этот контрол». Без такой ячейки новый цвет проверять не на чем
       * (У-113).
       *
       * Ровно одна, и **вторая** по ходу, а не первая: полоса из одних
       * значений перестала бы показывать разницу между именем поля и
       * выбранным значением — ради неё контрол и заведён, — а первая
       * ячейка обязана остаться именем поля: по ней видно, что
       * переименование Field доезжает до предпросмотра.
       */
      if (!isShown) plainCells += 1;
      const own = !isShown && plainCells === 2 ? cellValues(f) : [];
      const filled = own.length ? String(own[0] || "") : "";
      const cell = el(col, "span", "io-wheelcell" + (isShown ? " io-wheelcell--active" : ""),
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
    /*
     * Класс на строке: в этом предпросмотре прозрачность блока гасит чипы, но
     * **не** коробку скроллера.
     *
     * Прозрачность объявлена у контейнера стороны, а коробка лежит внутри
     * него; CSS `opacity` у предка потомком не отменяется, поэтому яркость
     * коробки ехала за настройкой блока — «в io-tip-wheel-preview яркость
     * scroller ретушируется при изменении opacity» (B2, 2026-09-02). Коробка
     * показывает соседние значения, и гасить её нечему.
     *
     * Заливки Block здесь нет нарочно: этот предпросмотр показывает панель, и
     * полоса у строки одна — её обособление. Его слово 2026-09-22.
     */
    }, "io-line--wheel", { blockFill: false, plainSize: true });

    if (example) rich(el(foot, "p", "io-preview__note"), askText(ctx, SINGLE_KEYS.previewExample, PREVIEW_EXAMPLE));
  };

  draw();
  const unwatch = ctx.watch(WHEEL_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};

/**
 * Почему полос нет, когда они включены. Две разные причины, и обе — про
 * настройку выше, а не про поломку (замечание заказчика 1.5.3.2).
 */

/* Английское этих трёх строк живёт в `FRAME_TEXTS` (10.13.46); здесь их
   больше никто не читает, и второго дома у текста нет (У-32). */

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

  /*
   * Выбранный Field — только тот, что и правда выбран. Раньше на пустом
   * значении подставлялось имя `status` из мокданных прототипа, и предпросмотр
   * искал Field, которого у человека нет: полосы не рисовались никогда, а
   * почему — не было сказано (замечание заказчика 1.5.3.2). Движок ведёт себя
   * так же: пустой `fieldId` даёт пустой набор токенов и ни одной полосы.
   */
  const chosenField = (): string => readText(ctx, "visual.tagBars.fieldId", "");

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
     * Дорожка — это глубина строки в дереве, а не счётчик нарисованных полос.
     *
     * Здесь номер увеличивался только тогда, когда полосу нарисовал родитель.
     * Строка без значения Field дорожку не занимала, и внучатая строка вставала
     * на место дочерней: при трёх дорожках рисовались первая и вторая вместо
     * первой и третьей (замечание заказчика B22, 2026-09-02).
     *
     * Движок считает иначе — `depthFromRoot` в `priority_strip_engine.js`
     * растёт на каждый уровень независимо от того, есть ли у строки своё
     * значение. Предпросмотр обязан показывать то же (П9).
     */
    /*
     * Полоса по всему поддереву или только по своей строке (PRD 10.13.21 Б5).
     * Выключенный тумблер снимает наследование: дорожка одна на всех, и
     * ограничение по числу полос предмета не имеет — полоса у строки одна.
     */
    const whole = ctx.get("visual.tagBars.drawWholeTree") !== false;
    const bar = active && v !== null && (whole ? depth < cap : true);

    const box = el(parent, "div", "io-node" + (bar ? " io-node--bar" : ""));
    if (bar && v) {
      cssVar(box, "--io-bar-color", v.fill);
      cssVar(box, "--io-lane", String(whole ? depth : 0));
      /*
       * Зазор сверху и снизу полосы — из настройки, а не литералом
       * (PRD 10.13.16). Тумблер `Join Bars in a tree` здесь не читается, и
       * это не пропуск: в предпросмотре полоса рисуется на **поддереве**
       * целиком (П6) — один узел на родителя вместе со всеми его дочерними
       * строками, — поэтому рвать её внутри дерева нечему. В заметке полосу
       * рисует каждая строка своей пометкой, и там тумблер и работает; его
       * держат проверки движка и адаптера.
       */
      cssVar(box, "--io-bar-inset", num(ctx, "visual.tagBars.lineGap") + "px");
    }
    drawLine(box, node, depth, fields, slots);
    /*
     * Дочерние строки лежат **внутри** узла с полосой — потому она и идёт по
     * всему поддереву (П6). Выключенный тумблер выносит их наружу: узел
     * остаётся высотой в одну строку, и полоса не длиннее её.
     */
    const kids = whole ? box : parent;
    for (const child of node.children) {
      drawNode(kids, child, depth + 1, fields, slots);
    }
  };

  const draw = (): void => {
    tree.empty();
    /*
     * Полосы рисуются только по Field типа tag: цвет полосы — это цвет Value,
     * а он есть у тега и ни у ссылки, ни у элемента. Поэтому и места
     * выдуманного дерева раскладываются на **теги**, а не на первые Fields по
     * порядку: иначе в строке оказывалась дата или ссылка, для которой полосу
     * нарисовать нечем (замечание заказчика 1.5.3.2, пункт 2).
     */
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
    /*
     * Полосы включены, а Field не выбран — на экране пустое дерево, и человек
     * не знает, что настройка ждёт от него ещё один выбор. Пустота обязана
     * объясниться (З8 наоборот: сообщение человеку, а не разработчику).
     */
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

/**
 * Подписи под разбором строки. Сняты с прототипа: он показывает не значения, а
 * устройство строки, и подписи — часть этого объяснения.
 */

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
 * Предпросмотр строки целиком (П3): `Prefix`, Left Block, `First Separator`,
 * текст, `Second Separator`, Right Block. Показываются **Fields**, а не
 * значения одного Field — этим он и отличается от предпросмотра оформления.
 *
 * Три ряда на одной сетке, и это не украшение: строка, скобки под Blocks и
 * подписи Separator обязаны стоять друг под другом. Разложи их тремя
 * отдельными строками — и подпись разъедется с тем, что подписывает, на
 * первом же длинном имени Field. Подписи Separator вынуты из потока
 * (`position: absolute` в `styles.css`), чтобы длинное слово не расширило
 * узкую колонку.
 */
export const linePreview: CustomRender = (host, ctx) => {
  const shell = previewShell(host, ctx, "line-preview");
  const holder = el(shell.box, "div", "io-struct");
  const foot = el(shell.box, "div", "io-preview__foot");

  const draw = (): void => {
    holder.empty();
    foot.empty();
    applyTagVars(holder, ctx, { plainSize: true });
    const { fields, example } = previewFields(ctx);

    const cell = (cls: string, fill?: (c: El) => void): El => {
      const c = el(holder, "div", "io-struct__cell " + cls);
      if (fill) fill(c);
      return c;
    };
    /* Ряд первый — сама строка. */
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

    /* Ряд второй — скобки под Blocks и засечки под Separator. */
    const block = (text: string): void => {
      const w = el(holder, "div", "io-struct__block");
      el(w, "div", "io-struct__bracket");
      el(w, "div", "io-struct__name", text);
    };
    el(holder, "div");
    block(frame(ctx, "PREVIEW_LEFT_BLOCK"));
    el(holder, "div", "io-struct__tick");
    el(holder, "div");
    el(holder, "div", "io-struct__tick");
    block(frame(ctx, "PREVIEW_RIGHT_BLOCK"));

    /* Ряд третий — подписи Separator, каждая по центру своей колонки. */
    const sepName = (text: string): void => {
      el(el(holder, "div", "io-struct__sepname"), "span", undefined, text);
    };
    el(holder, "div");
    el(holder, "div");
    sepName(frame(ctx, "PREVIEW_SEPARATOR_1"));
    el(holder, "div");
    sepName(frame(ctx, "PREVIEW_SEPARATOR_2"));
    el(holder, "div");

    /* Пример помечается: иначе человек решит, что видит свои Fields (ПЗ2). */
    if (example) rich(el(foot, "p", "io-preview__note"), askText(ctx, SINGLE_KEYS.previewExample, PREVIEW_EXAMPLE));
  };

  draw();
  const unwatch = ctx.watch(LINE_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};

/**
 * Места, которые показывает предпросмотр оформления: два Field слева. Имена
 * взяты из примерного набора и работают как места, а не как id (П13).
 */
const TAG_SLOTS = ["status", "priority"] as const;

/*
 * Ссылка, показанная **как написано**, — три куска, а не один (`З-37`):
 * скобка, цель, скобка. Иначе второму цвету красить нечего. Не разобралась
 * на три — рисуется одним куском: своего разбора ссылки здесь нет, образец
 * спрашивает ровно то, что видно. Вторая отрисовка того же — прототип
 * (`renderWrittenLink`, правило 41).
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

/** Пути, от которых зависит предпросмотр цветов ссылок. Обе пары. */
const LINK_PATHS = [
  "visual.tags.linkAsWritten",
  "visual.tags.hyperlink",
] as const;

/**
 * Цвета одной пары на узел ссылки.
 *
 * Пустое значение значит «взять у темы», и запасное здесь то самое, каким
 * ссылка красилась до этих пар (У-60). Переменные те же, что у заметки:
 * второй набор имён на тот же вопрос разошёлся бы с первым молча (У-32), а
 * у гиперссылки переменные объявляются **на её узле** — каскад отдаёт
 * ближнему.
 */
function linkPreviewVars(node: El, ctx: SettingsCtx, targetPath: string, bracketsPath: string): void {
  const target = String(ctx.get(targetPath) || "").trim();
  const brackets = String(ctx.get(bracketsPath) || "").trim();
  cssVar(node, "--io-link-target", target || "var(--text-accent)");
  cssVar(node, "--io-link-brackets", brackets || "var(--text-accent)");
}

/**
 * Предпросмотр цветов ссылок — его слово 2026-09-22: «я просил тебя добавить
 * live preview в низ `io-tip-sub-link-view`, чтобы можно было видеть как
 * меняются цвета wikilinks и hyperlinks».
 *
 * Форм три, и разбиты они там же, где их разбивает движок
 * (`scanHyperlinksInLine` в `editor_visuals_config.js`): у `[подпись](адрес)`
 * разметка — это `[` и `](адрес)`, у голого адреса разметки нет вовсе, и
 * второй цвет до него не доходит. Вторая отрисовка того же — прототип
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
    /*
     * Адрес — свой кусок и свой цвет (его замечание 2026-09-22). Переменная
     * объявляется на нём самом: каскад отдаёт ближнему, и второго набора имён
     * на тот же вопрос заводить не надо (У-32).
     */
    const mdAddr = el(mdBox, "span", "io-link__mark", askText(ctx, previewKey("link-preview", "address"), text ? text.address || "" : ""));
    el(mdBox, "span", "io-link__mark", ")");
    linkPreviewVars(mdBox, ctx, "visual.tags.hyperlink.targetColor", "visual.tags.hyperlink.bracketsColor");
    linkPreviewVars(mdAddr, ctx, "visual.tags.hyperlink.targetColor", "visual.tags.hyperlink.addressColor");

    /* Голый адрес — адрес, а не подпись (его слово 2026-09-22, вечер). */
    const bare = el(holder, "div");
    const bareBox = el(bare, "span", "io-link");
    el(bareBox, "span", "io-link__mark", askText(ctx, previewKey("link-preview", "bare"), text ? text.bare || "" : ""));
    linkPreviewVars(bareBox, ctx, "visual.tags.hyperlink.targetColor", "visual.tags.hyperlink.addressColor");
  };

  draw();
  const unwatch = ctx.watch(LINK_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};

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
      if (f) drawTagField(left, f, ctx);
    }

    el(line, "span", "io-line__sep", sep(ctx, SEP1_PATH));
    el(line, "span", "io-line__text", text ? askText(ctx, previewKey("tag-preview", "line"), text.line || "") : "");
    el(line, "span", "io-line__sep", sep(ctx, SEP2_PATH));

    const right = el(line, "span", "io-line__side io-line__side--right");
    if (text && text.element) el(right, "span", "io-elem", askText(ctx, previewKey("tag-preview", "element"), text.element));
    if (text && text.link) drawWrittenLink(right, askText(ctx, previewKey("tag-preview", "link"), text.link));

    /* Пример помечается, иначе человек с настроенными Fields решит, что
       панель показывает его собственные (ПЗ2). */
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
  /*
   * Fields и цвета их Values: предпросмотр читает их через `previewFields`,
   * а подписан на них не был — вторая половина дефекта 1.4.1.1.3. Ветка
   * целиком, а не отдельные пути: у Field меняется то имя, то сторона, то
   * список Values, и перечислить это по листьям значит однажды отстать.
   */
  "pkm.fields",
  "visual.tags.byTag",
  /* Расстояние от текста до кнопки: предпросмотр обязан двигать её вместе со
     слайдером, иначе он показывает не то, чем управляют (У-24). */
  "transform.inline2note.floatingButtonGap",
] as const;

/**
 * Что написано на самой кнопке: одна стрелка, как в заметке.
 *
 * Было `\u2192 note`, и заказчик написал: «в io-tip-i2n-button-preview button
 * отображается как `-> note`, сделай чтобы было как в заметке (т.е. просто
 * стрелочка)» (2026-09-04). Кнопка теперь и рисуется тем же классом, что в
 * заметке (`io-flybtn`), — второй вид того же элемента разошёлся бы с первым
 * молча (У-32).
 */
const FLOAT_LABEL = "\u2192";

/**
 * Где появляется плавающая кнопка Transform (10.3). Показывает не настройку,
 * а место: строка, на которой стоит курсор, и кнопка в её конце.
 *
 * **В панели этого блока пока нет, и это намеренно.** Самой кнопки в плагине
 * нет: `flyingButton.enabled` нормализуется в `transform_feature.js` и больше
 * никем не читается, декорации CM6 не существует. Показывать её тумблер и
 * картинку значило бы обещать то, чего нет (Ж2, З8), поэтому и тумблер, и эта
 * запись сняты со схемы списком `AWAITING_ENGINE` в `build/gen_schema.js`.
 * Блок написан и закреплён проверкой заранее: он включается снятием одной
 * строки из того списка, когда кнопка появится в фазе 5.
 *
 * **Кнопка здесь — картинка, а не кнопка.** В прототипе на этом месте стоит
 * `<button>`, который ничего не делает: прототип и не должен ничего делать.
 * В панели нажимаемый контрол, который ничем не отвечает, запрещён (З8),
 * поэтому рисуется `span` с тем же видом. Вид блока прототипу соответствует,
 * поведение — правилам панели.
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
    /* Отступ — из слайдера, той же переменной, которой его ставит декорация
       строки в заметке: одно правило, одно место (У-32). */
    cssVar(button, "--io-flybtn-gap", num(ctx, "transform.inline2note.floatingButtonGap") + "px");
    el(holder, "p", "io-preview__note", text ? askText(ctx, previewKey("i2n-button-preview", "note"), text.note || "") : "");
  };

  draw();
  const unwatch = ctx.watch(FLOAT_PATHS, draw);
  return () => { unwatch(); shell.close(); };
};

/* ---- предпросмотр `Source line` (10.13.10) ------------------------------ */

/**
 * Написания Value, по которым его узнают в строке.
 *
 * Одно и то же значение стоит в строке по-разному: тег — `#todo`, ссылка —
 * `[[Proj]]`, элемент — уже со своей меткой. Карта собирается по всем трём
 * написаниям, чтобы предпросмотр узнал значение независимо от вида Field.
 */
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
 * Строка предпросмотра теми же узлами, что и остальные предпросмотры.
 *
 * Раньше строка кладась в узел **текстом**: ни пузырей, ни префикса, ни
 * разделителей — «все элементы в plain text, не красиво, должно быть как в
 * live preview у tag appearance» (замечание заказчика B13, 2026-09-02).
 *
 * Разбор здесь **свой и намеренно грубый**: строку уже посчитал движок, и
 * узнать в готовой строке её части можно только по написанию. Это не второй
 * разбор правил — правила остались у движка, — а раскраска его результата. То,
 * чего предпросмотр не узнал, остаётся текстом: соврать про часть строки хуже,
 * чем показать её как есть (П9, и «?» предпросмотра об этом говорит).
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

  /* Префикс — то, что стоит до первого значащего символа: буллит, номер,
     чекбокс. Он рисуется своим узлом, иначе в половинах «до» и «после» не
     видно, что с началом строки что-то произошло. */
  const prefix = /^(\s*(?:[-*+]|\d+\.)\s+(?:\[[^\]]?\]\s+)?)/.exec(line);
  let rest = line;
  if (prefix) {
    el(row, "span", "io-line__prefix", prefix[1] as string);
    rest = line.slice((prefix[1] as string).length);
  }

  /*
   * Пробелы сохраняются, а не выбрасываются (замечание B13, 2026-09-02).
   *
   * Первая версия резала строку `split(/\s+/)` и вставляла куски строчными
   * узлами подряд — на экране весь текст выглядел склеенным. Остальные
   * предпросмотры собирает `structuralLine`, где стороны это flex с зазором,
   * поэтому склеен был только этот.
   *
   * Пробел возвращается **текстовым узлом**, а не зазором flex: тогда текст
   * нарисованной строки совпадает с исходной посимвольно, и это можно
   * проверить, а не «посмотреть».
   */
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
      /* Тег — пузырь, тем же кодом, что и в остальных предпросмотрах (П9). */
      bubble(row, hit.value, piece.replace(/^#/, "") ? undefined : piece);
      continue;
    }
    if (hit) {
      /* Ссылка и элемент пузырём не рисуются: в заметке они остаются текстом,
         и прозрачность блока им достаётся стилем, а не подменой узла. */
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
 * Что станет с исходной строкой после `Inline to note` (замечание заказчика
 * 1.4.3.1.2).
 *
 * Считает **движок** — `buildSourcePreviewTree` из `transform_feature.js`, тот
 * же путь, что переносит строку по-настоящему. Свой разбор здесь разошёлся бы
 * с ним на первой правке (У-4), поэтому блок только рисует.
 *
 * До этого под настройками стояла строка «nothing is kept…», и она исчезала,
 * стоило отметить хоть один Field: человек видел подпись пустого случая и не
 * видел остальных.
 */
export const sourcePreview: CustomRender = (host, ctx) => {
  const shell = previewShell(host, ctx, "source-preview");
  const body = el(shell.box, "div", "io-srcprev");
  /*
   * Подсказка у каждой половины — заказ заказчика 2026-09-08: «добавь tip ко
   * всем элементам, у которых еще нет». Подпись половины занимает строку
   * целиком, поэтому «?» стоит в ней самой, а тело — в слоте сразу за ней.
   */
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
        /* Отступ рисуется классом, а не символом табуляции: так он виден и
           так же измеряется, как в дереве Bars. */
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
  /* Задержка попала сюда 2026-09-17 вместе с тем, что круг стал мигать сам:
     пока прыжок был один, менять от неё было нечего. */
  "visual.jumpFlash.quietMs",
] as const;

/**
 * Подсветка места, куда прыгнул курсор, — как она будет выглядеть (Н5).
 *
 * Его заказ 2026-09-16: «должен быть добавлен live preview с анимацией
 * подсветки при прыжке (по аналогии с caret-preview)».
 *
 * **Гасит круг анимация, а не таймер** — так же, как в самом слое редактора:
 * таймер пришлось бы снимать при выгрузке панели, а анимация уезжает вместе с
 * узлом.
 *
 * **Круг мигает сам, и это его слово 2026-09-17:** «не видно как работает
 * `jump-flash-delay`… сейчас само preview работает по клику на preview либо
 * при изменении настроек — сделай, чтобы оно работало циклично всегда».
 * Прежде задержку между прыжками было видно не на чем: её предмет — второй
 * прыжок следом за первым, а прыжок здесь был один.
 *
 * Круг живёт `fadeMs`, за ним `quietMs` тишины — оба срока из настроек, и
 * оба видны глазом. При нулевой тишине круги идут подряд, ровно как говорит
 * сама строка: «at `0` every jump gets its circle».
 *
 * **Таймер снимается при закрытии предпросмотра и перед каждой новой
 * отрисовкой**, и не заводится заново на узле, которого больше нет на
 * странице: иначе каждая перерисовка вкладки оставляла бы по кругу, тикающему
 * в отцепленном дереве.
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
    /* Пусто — цвет берётся у темы, и это живёт на шве, а не в значении
       (У-60): в `HexString` пустота не влезает. */
    cssVar(row, "--io-jump-color", color || "var(--interactive-accent)");

    let shown: El | null = null;
    const pulse = (): void => {
      /*
       * Узел, снятый со страницы перерисовкой, к ней уже не относится
       * (У-114): круг ему не нужен, и следующего такта тоже. Свойство
       * спрашивается у самого узла, а не предполагается: заглушка DOM его не
       * знает, и «не знаю» читается как «на странице» — там предпросмотр
       * закрывают вызовом, а не отцеплением.
       */
      if ((row as { isConnected?: boolean }).isConnected === false) { timer = 0; return; }
      /* Прежний круг снимается по ссылке, а не поиском в дереве: искать его
         классом значило бы завести второе объявление того, что мы сами
         только что положили. */
      if (shown) shown.remove();
      const spot = el(row, "span", "io-jumpflash");
      shown = spot;
      /* Круг встаёт на конец написанного — там же, где после прыжка каретка.
         Место едет переменной: вид живёт в листе стилей (правило каталога Р7). */
      cssVar(spot, "--io-jump-x", "calc(8px + " + line.length + "ch)");
      const fade = num(ctx, "visual.jumpFlash.fadeMs") || 450;
      const quiet = num(ctx, "visual.jumpFlash.quietMs");
      const next = setTimeout(pulse, fade + quiet) as unknown as { unref?: () => void };
      /*
       * В браузере у таймера нет `unref`, а в Node он держит процесс живым:
       * предпросмотр, отрисованный проверкой и не закрытый ею, подвесил бы
       * прогон навсегда. Спрашиваем у таймера, умеет ли он это, — не решаем
       * за него.
       */
      if (typeof next.unref === "function") next.unref();
      timer = next as unknown as number;
    };
    pulse();

    /* Абзаца под предпросмотром нет, когда сказать нечего: пустой <p>
       оставляет отступ, а строки в нём не видно. */
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
 * Скорость 1..10 в миллисекунды.
 *
 * Пятёрка — ровно то, чем Obsidian мерцает сейчас, поэтому она же умолчание
 * слайдера: включённый тумблер сам по себе мерцание не меняет, пока человек
 * не подвинул ползунок. Ноль сюда не доходит — он значит «не мигает вовсе»
 * и решается снятием анимации, а не длительностью (нулевая длительность в CSS
 * означает «мгновенно», а не «никогда»).
 *
 * Формула объявлена **здесь одним местом** и оттуда же попадает в блок стилей
 * заметки: два одинаковых пересчёта разошлись бы молча (У-32).
 */
export function caretBlinkMs(speed: number): number {
  const s = Number.isFinite(speed) ? Math.max(1, Math.min(10, speed)) : 5;
  return 2200 - s * 200;
}

/**
 * Каретка так, как она будет выглядеть в заметке (10.13.33 Ц8).
 *
 * Заказчик 2026-09-05: «добавь live preview в настройки, чтобы можно было
 * сразу понять как это будет выглядеть в строке». Показывает все три
 * настройки сразу — цвет, толщину и скорость, — и меняется под рукой: цвет и
 * толщина мгновенно, мерцание с началом нового круга анимации.
 *
 * П9 честно и здесь: рисует это панель, а не редактор. Мерцание сделано тем
 * же шагом, каким мерцает CodeMirror (`steps(1)`), поэтому картинка близка,
 * но каретка редактора живёт в его слое и сюда не доезжает.
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
    /* Цвет берётся только у включённого тумблера цвета: эти две половины
       группы друг другу не подчинены. */
    const color = ctx.get("visual.caret.enabled") === true
      ? readText(ctx, "visual.caret.color", "")
      : "";

    cssVar(row, "--io-caret-width", width + "px");
    /* Сдвиг равен половине толщины — тем же правилом, каким его ставит сам
       Obsidian: без него каретка съезжает вправо тем сильнее, чем толще. */
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
