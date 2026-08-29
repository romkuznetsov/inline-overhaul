/**
 * `Color your Tags` — цвета тегов, не принадлежащих ни одному Field.
 *
 * Блок возвращён решением заказчика (PRD 10.11а, разбор фазы 3b) и размещён своей
 * группой на вкладке Visual решением 2026-08-29. В старой панели он жил внутри
 * доски Order за двумя тумблерами вида, которых в новой панели нет (Ф15): к
 * Fields эти цвета отношения не имеют, а без блока ветка конфига стала бы
 * недостижимой, и старую панель нельзя было бы удалить.
 *
 * Путь версии 1 — `pkm.behavior.tagVisuals.userTags.<#tag>`, и он живой с обеих
 * сторон: пишет сюда же старая панель, читает `tagwheel_config_codec.js`, а
 * `tagwheel_config_parser.js` заводит отсюда теги из заметки конфигурации.
 * Таблица 8.1 ведёт ветку в `visual.tags.userTags` — это работа фазы 2.
 *
 * Строка устроена как строка таблицы Values (решение заказчика): те же
 * контролы и те же подписи, чтобы человек не учил их дважды. Отличий два, и
 * оба от конфига, а не от вкуса:
 *
 *   * показ у своего тега бывает только `default` или `empty` — `custom`
 *     конфиг для этой ветки не хранит, и показывать его значило бы показывать
 *     контрол, который не работает (З8);
 *   * отдельного чипа предпросмотра нет: имя тега и есть предпросмотр — оно
 *     нарисовано выбранными цветами тем же `bubble`, которым рисуют
 *     предпросмотры (П9).
 */

import type { CustomRender, SettingsCtx, ValueVisibility } from "../types.ts";
import { el, btn, textInput, selectInput, cssVarValue, type El, type ElInput } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { applyTagVars, bubble } from "./previews.ts";
import { contrastRatio, contrastWarning, CONTRAST_FLOOR } from "./contrast.ts";

/* ---- тексты: сняты с прототипа (Приложение B) --------------------------- */

export const HEAD = ["Tag", "Fill", "Text", "Show", ""] as const;
export const ADD_TAG = "Add tag";
export const ADD_PLACEHOLDER = "#tag";
export const ADD_LABEL = "New tag to color";
/** Список пуст: приглашение, а не пустое место (ПЗ2). */
export const EMPTY_LIST = "no tags of your own yet — add one below";

/**
 * Показ своего тега. Третьего значения (`custom`) в этой ветке конфига нет:
 * `visibility` здесь принимает только эти два.
 */
const SHOWN_OPTIONS = [
  { value: "default", label: "default" },
  { value: "empty", label: "empty" },
] as const;

/* ---- чтение и запись ---------------------------------------------------- */

/** Один свой тег так, как его читает вёрстка. */
export interface UserTagRow {
  token: string;
  fillColor: string;
  textColor: string;
  visibility: "default" | "empty";
}

interface TagPlugin {
  getConfig: () => unknown;
  setConfigPatch: (patch: unknown, reason: string) => void;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeHex(value: unknown): string {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "";
  return /^#[0-9a-f]{6}$/.test(s) ? s : "";
}

function normalizeShown(value: unknown): "default" | "empty" {
  return String(value || "default").trim().toLowerCase() === "empty" ? "empty" : "default";
}

/** Ветка своих тегов в конфиге версии 1. */
function userTagsOf(cfg: unknown): Record<string, unknown> {
  const behavior = asObject(asObject(asObject(cfg)["pkm"])["behavior"]);
  return asObject(asObject(behavior["tagVisuals"])["userTags"]);
}

/**
 * Токен в том виде, в каком его хранит конфиг: с решёткой. Пустой ответ
 * означает «это не тег» — такие ключи в ветке встречаются, и рантайм их тоже
 * отбрасывает (`tagwheel_config_codec.js`).
 */
function tokenOf(raw: string): string {
  const s = String(raw || "").trim();
  const withHash = s.charAt(0) === "#" ? s : "#" + s.replace(/^#+/, "");
  return /^#\S+$/.test(withHash) ? withHash : "";
}

export interface UserTagsModel {
  listTags(): UserTagRow[];
  setVisual(token: string, patch: Partial<UserTagRow>, reason: string): void;
  remove(token: string): void;
  add(raw: string): void;
}

export function createUserTagsModel(plugin: TagPlugin): UserTagsModel {
  /**
   * Строка пишется целиком, а не по одному полю: недостающие берутся из
   * текущей. Так это работало в старой панели, и от этого зависит, что
   * оказывается в конфиге.
   */
  const write = (token: string, next: Omit<UserTagRow, "token">, reason: string): void => {
    plugin.setConfigPatch(
      { pkm: { behavior: { tagVisuals: { userTags: { [token]: next } } } } },
      reason,
    );
  };

  return {
    listTags() {
      const map = userTagsOf(plugin.getConfig());
      const out: UserTagRow[] = [];
      for (const key of Object.keys(map)) {
        const token = tokenOf(key);
        /* Ключ не тег — не наш: чужие ключи мы не рисуем и не трогаем. */
        if (!token || token !== key.trim()) continue;
        const row = asObject(map[key]);
        out.push({
          token,
          fillColor: normalizeHex(row["fillColor"]),
          textColor: normalizeHex(row["textColor"]),
          visibility: normalizeShown(row["visibility"]),
        });
      }
      return out;
    },

    setVisual(token, patch, reason) {
      const tok = tokenOf(token);
      if (!tok) return;
      const current = asObject(userTagsOf(plugin.getConfig())[tok]);
      const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(patch, key);
      write(tok, {
        fillColor: has("fillColor") ? normalizeHex(patch.fillColor) : normalizeHex(current["fillColor"]),
        textColor: has("textColor") ? normalizeHex(patch.textColor) : normalizeHex(current["textColor"]),
        visibility: has("visibility") ? normalizeShown(patch.visibility) : normalizeShown(current["visibility"]),
      }, reason);
    },

    remove(token) {
      const tok = tokenOf(token);
      if (!tok) return;
      /*
       * Надгробие: `deepMerge` сливает объекты, и ключ уходит только по
       * `null`. Записать пустую строку значило бы оставить тег в конфиге без
       * цветов — он бы вернулся в список на следующей перерисовке.
       */
      plugin.setConfigPatch(
        { pkm: { behavior: { tagVisuals: { userTags: { [tok]: null } } } } },
        "pkm:visuals:user-tags:delete",
      );
    },

    add(raw) {
      const tok = tokenOf(raw);
      if (!tok) return;
      /* Уже есть — второй записью не портим цвета первого. */
      if (Object.prototype.hasOwnProperty.call(userTagsOf(plugin.getConfig()), tok)) return;
      write(tok, { fillColor: "", textColor: "", visibility: "default" },
        "pkm:visuals:user-tags:add");
    },
  };
}

/* ---- вёрстка ------------------------------------------------------------ */

export interface UserTagsViewOpts {
  rows: readonly UserTagRow[];
  ctx: SettingsCtx;
  enabled: boolean;
  onVisual: (row: UserTagRow, patch: Partial<UserTagRow>, reason: string) => void;
  onRemove: (row: UserTagRow) => void;
  onAdd: (raw: string) => void;
}

/** Цвета темы: незаданный цвет — это цвет темы, а не отсутствие цвета. */
function themePair(node: El): { fill: string; text: string } {
  return {
    fill: cssVarValue(node, "--interactive-accent"),
    text: cssVarValue(node, "--text-on-accent"),
  };
}

export function renderUserTags(host: El, o: UserTagsViewOpts): void {
  const card = el(host, "div", "io-card io-usertags");
  const head = el(card, "div", "io-tablehead");
  for (const cap of HEAD) el(head, "div", undefined, cap);

  const theme = themePair(card);

  if (!o.rows.length) el(card, "div", "io-side__empty", EMPTY_LIST);

  for (const row of o.rows) {
    const line = el(card, "div", "io-tablerow");

    /* Имя тега и есть предпросмотр: оно нарисовано выбранными цветами. */
    const cell = el(line, "div", "io-vals__prev");
    applyTagVars(cell, o.ctx);
    bubble(cell, {
      token: row.token.replace(/^#/, ""),
      fill: row.fillColor,
      text: row.textColor,
      shown: row.visibility === "empty" ? "empty" : "value",
      custom: "",
      depth: 0,
    });
    /* У пустого тега текста нет, читать нечего (Н18). */
    if (row.visibility !== "empty") {
      const ratio = contrastRatio(row.fillColor || theme.fill, row.textColor || theme.text);
      if (ratio < CONTRAST_FLOOR) {
        const warn = el(cell, "span", "io-warn", "⚠");
        /* Одна подсказка на узел — и только `aria-label`. */
        warn.setAttribute("aria-label", contrastWarning(ratio));
      }
    }

    const color = (key: "fillColor" | "textColor", label: string, reason: string): void => {
      const wrap = el(line, "div");
      const input = wrap.createEl("input", {
        cls: "io-colin",
        type: "color",
        value: (key === "fillColor" ? row.fillColor : row.textColor) || "#ffffff",
        attr: { "aria-label": label + " for " + row.token },
      }) as ElInput;
      input.disabled = !o.enabled;
      input.addEventListener("change", (() => {
        if (!o.enabled) return;
        o.onVisual(row, { [key]: input.value }, reason);
      }) as never);
    };
    color("fillColor", "Fill color", "pkm:visuals:user-tags:fill");
    color("textColor", "Text color", "pkm:visuals:user-tags:text");

    const shown = selectInput(el(line, "div", "io-showncell"), "io-select", {
      options: SHOWN_OPTIONS,
      value: row.visibility,
      label: "Show, for " + row.token,
    });
    shown.disabled = !o.enabled;
    shown.addEventListener("change", (() => {
      if (!o.enabled) return;
      o.onVisual(row, { visibility: shown.value as UserTagRow["visibility"] },
        "pkm:visuals:user-tags:visibility");
    }) as never);

    const tools = el(line, "div", "io-valtools");
    /*
     * Обратно к цвету темы. Пикер такого сказать не умеет — у него всегда
     * какой-то цвет, — и без этой кнопки выбранный однажды цвет оставался бы
     * у тега навсегда и при смене темы не подстраивался. Одна кнопка на оба
     * цвета и перед удалением: так же сделано в таблице Values.
     */
    if (row.fillColor || row.textColor) {
      const back = btn(tools, "io-icon", {
        text: "↺",
        label: "Reset the colors of " + row.token + " back to the colors of the theme",
      });
      back.disabled = !o.enabled;
      back.addEventListener("click", (() => {
        if (!o.enabled) return;
        o.onVisual(row, { fillColor: "", textColor: "" }, "pkm:visuals:user-tags:color-reset");
      }) as never);
    }
    /* Удаление красное: единственная кнопка строки, которая уносит данные. */
    const del = btn(tools, "io-icon io-icon--danger", {
      text: "✕",
      label: "Remove " + row.token,
    });
    del.disabled = !o.enabled;
    del.addEventListener("click", (() => {
      if (!o.enabled) return;
      o.onRemove(row);
    }) as never);
  }

  const foot = el(card, "div", "io-tablefoot");
  /* Решётка не обязательна: тег читается одинаково с ней и без неё. */
  const add = textInput(foot, "io-text io-text--mono", {
    value: "",
    placeholder: ADD_PLACEHOLDER,
    label: ADD_LABEL,
  });
  add.disabled = !o.enabled;
  const go = btn(foot, "io-btn io-btn--sm io-btn--cta", { text: ADD_TAG, label: ADD_TAG });
  go.disabled = !o.enabled;
  go.addEventListener("click", (() => {
    if (!o.enabled) return;
    o.onAdd(add.value);
  }) as never);
}

/* ---- блок --------------------------------------------------------------- */

/** Пути, от которых зависит вид пузыря: те же, что у предпросмотров тегов. */
const TAG_PATHS = [
  "features.visual.enabled",
  "visual.tags.opacityLeft",
  "visual.tags.opacityRight",
  "visual.tags.textSizePct",
  "visual.tags.bubbleWidthPct",
  "visual.tags.bubbleHeightPct",
  "visual.tags.cornersPct",
] as const;

export const userTagColors: CustomRender = (host: El, ctx: SettingsCtx) => {
  const p = ctx.platform;
  const box = el(host, "div", "io-usertagsblock");

  /* Без платформы показывать нечего: теги лежат в конфиге. */
  if (!p) return () => { box.empty(); };

  let mounted: El | null = null;

  const draw = (): void => {
    /* Скролл и фокус снимаются до подмены узла и возвращаются после (A8). */
    const keep = keepView(box);
    const next = el(box, "div", "io-usertagsblock__mount");
    try {
      const model = createUserTagsModel(p.plugin as never);
      /*
       * Запись и перерисовка. Перерисовка в `finally`: исключение из
       * `setConfigPatch` не должно оставлять на экране прежнее.
       */
      const commit = (write: () => void): void => {
        try { write(); }
        catch (e) { console.error("inline-overhaul: запись цвета своего тега не удалась", e); }
        finally { draw(); }
      };

      renderUserTags(next, {
        rows: model.listTags(),
        ctx,
        enabled: Boolean(ctx.get("features.visual.enabled")),
        onVisual: (row, patch, reason) =>
          commit(() => { model.setVisual(row.token, patch, reason); }),
        onRemove: row => commit(() => { model.remove(row.token); }),
        onAdd: raw => commit(() => { model.add(raw); }),
      });
    } catch (e) {
      /* Неудачная попытка выбрасывается целиком, а на экране остаётся то, что
         работало: так же устроены остальные свои блоки. */
      next.remove();
      console.error("inline-overhaul: цвета своих тегов не отрисовались", e);
      return;
    }
    if (mounted) mounted.remove();
    mounted = next;
    keep.restore();
  };

  draw();
  const unwatch = ctx.watch(TAG_PATHS, draw);
  return () => {
    unwatch();
    mounted = null;
    box.empty();
  };
};

/** Тип видимости Value рядом: он же лежит в общей схеме. */
export type { ValueVisibility };
