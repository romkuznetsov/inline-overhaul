/**
 * `Color your Tags` — цвета тегов, не принадлежащих ни одному Field.
 *
 * Блок возвращён решением заказчика (PRD 10.11а, разбор фазы 3b) и размещён своей
 * группой на вкладке Visual решением 2026-08-29. В старой панели он жил внутри
 * доски Order за двумя тумблерами вида, которых в новой панели нет (Ф15): к
 * Fields эти цвета отношения не имеют, а без блока ветка конфига стала бы
 * недостижимой, и старую панель нельзя было бы удалить.
 *
 * Путь — `visual.tags.userTags.<#tag>` (версия 2, PRD 8.1). До 2026-09-03 в
 * эту ветку писала ещё и конфиг-заметка; с её снятием (10.12) единственный
 * автор ветки — эта строка панели.
 *
 * Строка устроена как строка таблицы Values (решение заказчика): те же
 * контролы и те же подписи, чтобы человек не учил их дважды. Отличий два, и
 * оба от конфига, а не от вкуса:
 *
 *   * показ у своего тега бывает только `default` или `empty` — `custom`
 *     конфиг для этой ветки не хранит, и показывать его значило бы показывать
 *     контрол, который не работает (З8);
 *   * колонки `Level` и `Prefix` не нужны: у своего тега нет родителя, и
 *     маркер строки он не меняет — разбор ниже, у самой отрисовки.
 *
 * **Чип предпросмотра у него свой**, как в таблице Values: `bubble` рисует
 * тег выбранными цветами, а рядом встаёт значок контраста, если пара читается
 * плохо (П9). До 2026-09-08 здесь стояло обратное — «отдельного чипа
 * предпросмотра нет, имя тега и есть предпросмотр», — и это было верно ровно
 * до того дня, когда колонка `Preview` появилась. Объяснение, пережившее свой
 * предмет, врёт тише всего (У-71).
 */

import type { CustomRender, SettingsCtx, ValueVisibility } from "../types.ts";
import { el, btn, textInput, selectInput, tipBelow, cssVarValue, type El, type ElInput } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { applyTagVars, bubble, frame } from "./previews.ts";
import { contrastRatio, contrastWarning, CONTRAST_FLOOR, toHexColor } from "./contrast.ts";
import { BLOCK_TEXTS, sayIn } from "../texts_blocks.ts";

/* ---- тексты: сняты с прототипа (Приложение B) --------------------------- */

/* Порядок колонок — как в таблице Values, без `Level` и `Prefix` (1.5.2.2). */
export const HEAD = ["Tag", "Show", "Fill", "Text", "Preview", ""] as const;

/**
 * Имена строк каталога для подсказок колонок: слова живут в `texts_blocks.ts`
 * (10.13.47), здесь только адрес. Смысл тот же, что у одноимённых колонок
 * таблицы Values.
 */
const COLUMN_TIPS: Readonly<Record<string, string>> = {
  Tag: "TAG_TIP",
  Show: "SHOWN_TIP",
  Fill: "FILL_TIP",
  Text: "TEXT_TIP",
  /* `Preview` была единственной подписанной колонкой без подсказки — заказ
     заказчика 2026-09-08: «tip ко всем элементам, у которых еще нет». */
  Preview: "PREVIEW_TIP",
};

/*
 * Английское этих строк живёт в каталоге (10.13.47) — отсюда их читают
 * проверки, а панель спрашивает по ключу. Второго объявления нет (У-32).
 */
export const ADD_TAG = BLOCK_TEXTS["user-tag-list"].ADD_TAG;
export const ADD_LABEL = BLOCK_TEXTS["user-tag-list"].NEW_TAG_ARIA;
/** Список пуст: приглашение, а не пустое место (ПЗ2). */
export const EMPTY_LIST = BLOCK_TEXTS["user-tag-list"].EMPTY;

/**
 * Показ своего тега. Третьего значения (`custom`) в этой ветке конфига нет:
 * `visibility` здесь принимает только эти два.
 */
const SHOWN_OPTIONS = [
  { value: "default", name: "SHOWN_DEFAULT" },
  { value: "empty", name: "SHOWN_EMPTY" },
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

/** Ветка своих тегов: `visual.tags.userTags`. */
function userTagsOf(cfg: unknown): Record<string, unknown> {
  return asObject(asObject(asObject(asObject(cfg)["visual"])["tags"])["userTags"]);
}

/**
 * Токен в том виде, в каком его хранит конфиг: с решёткой. Пустой ответ
 * означает «это не тег» — такие ключи в ветке встречаются, и разрешение цвета
 * их тоже отбрасывает.
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
  /** Переименовать тег, сохранив его цвета (1.5.2.2). */
  rename(from: string, to: string): void;
}

export function createUserTagsModel(plugin: TagPlugin): UserTagsModel {
  /**
   * Строка пишется целиком, а не по одному полю: недостающие берутся из
   * текущей. Так это работало в старой панели, и от этого зависит, что
   * оказывается в конфиге.
   */
  const write = (token: string, next: Omit<UserTagRow, "token">, reason: string): void => {
    plugin.setConfigPatch(
      { visual: { tags: { userTags: { [token]: next } } } },
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
        { visual: { tags: { userTags: { [tok]: null } } } },
        "pkm:visuals:user-tags:delete",
      );
    },

    rename(from, to) {
      const was = tokenOf(from);
      const now = tokenOf(to);
      if (!was || !now || was === now) return;
      const map = userTagsOf(plugin.getConfig());
      /* Занятое имя не отбирается у того, кто его уже носит. */
      if (Object.prototype.hasOwnProperty.call(map, now)) return;
      const current = asObject(map[was]);
      /*
       * Одним патчем: новый ключ и надгробие старому. Двумя записями это
       * стало бы двумя шагами «отменить», и один из них оставлял бы тег
       * либо в двух местах, либо ни в одном.
       */
      plugin.setConfigPatch(
        { visual: { tags: { userTags: {
          [now]: {
            fillColor: normalizeHex(current["fillColor"]),
            textColor: normalizeHex(current["textColor"]),
            visibility: normalizeShown(current["visibility"]),
          },
          [was]: null,
        } } } },
        "pkm:visuals:user-tags:rename",
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
  /** Переименование тега: перенос ключа со всеми его цветами (1.5.2.2). */
  onRename: (row: UserTagRow, raw: string) => void;
  /** Показывать ли «?» у колонок: тумблер с вкладки General. */
  showTips: boolean;
  /** Тумблер `Show option IDs in tips`: подпись id в конце подсказки (A3, C52). */
  showIds?: boolean;
  /** Куда складывать снятие подсказок: их обязан убрать за собой блок (С5). */
  closers: Array<() => void>;
}

/** Цвета темы: незаданный цвет — это цвет темы, а не отсутствие цвета. */
function themePair(node: El): { fill: string; text: string } {
  return {
    fill: cssVarValue(node, "--interactive-accent"),
    text: cssVarValue(node, "--text-on-accent"),
  };
}

/**
 * Таблица своих тегов — **та же, что Values у Field типа tag**, за вычетом
 * колонок `Level` и `Prefix` (замечание заказчика 1.5.2.2). Прежняя своя
 * вёрстка ему не понравилась, и по делу: таблицу Values человек уже выучил, а
 * вторая, похожая, но другая, заставляла учить её заново.
 *
 * Чего в этой таблице нет и почему:
 *
 *   * `Level` — у своего тега нет родителя: он не принадлежит ни одному Field;
 *   * `Prefix` — маркер строки ставит Value Field, а свой тег его не меняет;
 *   * ручки перетаскивания — у Values порядок это порядок команд `next` и
 *     `previous`, а своим тегам порядок не нужен, и ручка, которая ничего не
 *     переставляет, хуже её отсутствия (З8).
 *
 * Имя тега правится на месте, как `Value` в таблице Values. Переименование —
 * это перенос ключа: старый уходит, новый приходит с теми же цветами, и обе
 * записи идут одним патчем, чтобы «отменить» возвращало тег целиком.
 */
export function renderUserTags(host: El, o: UserTagsViewOpts): void {
  const box = el(host, "div", "io-vals io-vals--tags");
  const scroll = el(box, "div", "io-scroll");
  const inner = el(scroll, "div", "io-vals__inner io-vals__inner--tags");

  const say = sayIn("user-tag-list", o.ctx);
  const head = el(inner, "div", "io-vals__head");
  const tipSlot = el(inner, "div", "io-vals__tipslot");
  for (const title of HEAD) {
    const cell = el(head, "div", "io-vals__col");
    el(cell, "span", "io-vals__coltext", title ? say("HEAD_" + title.toUpperCase()) : title);
    const name = COLUMN_TIPS[title];
    if (!name) continue;
    const tip = say(name);
    o.closers.push(tipBelow({
      head: cell,
      host: tipSlot,
      text: tip,
      label: title,
      id: "io-usertags-col-" + title.toLowerCase() + "-tip",
      showTips: o.showTips,
      showIds: o.showIds,
    }));
  }

  const theme = themePair(box);

  if (!o.rows.length) el(box, "div", "io-side__empty", say("EMPTY"));

  for (const row of o.rows) {
    const line = el(inner, "div", "io-vals__row");

    /* Имя тега: правится на месте, решётка не обязательна. */
    const name = textInput(el(line, "div"), "io-text io-text--mono", {
      value: row.token,
      placeholder: say("NEW_TAG_HINT"),
      label: say("ROW_ARIA", row.token),
    });
    name.disabled = !o.enabled;
    name.addEventListener("change", (() => {
      if (!o.enabled) return;
      o.onRename(row, name.value);
    }) as never);

    const shown = selectInput(el(line, "div", "io-showncell"), "io-select", {
      options: SHOWN_OPTIONS.map(x => ({ value: x.value, label: say(x.name) })),
      value: row.visibility,
      label: say("SHOWN_FOR", row.token),
    });
    shown.disabled = !o.enabled;
    shown.addEventListener("change", (() => {
      if (!o.enabled) return;
      o.onVisual(row, { visibility: shown.value as UserTagRow["visibility"] },
        "pkm:visuals:user-tags:visibility");
    }) as never);

    const color = (key: "fillColor" | "textColor", label: string, reason: string): void => {
      const wrap = el(line, "div");
      /* Пока своего цвета нет, в образце стоит цвет темы — тот, которым тема
         и рисует тег. Разбор общий с проверкой контраста (C31, C39). */
      const own = key === "fillColor" ? row.fillColor : row.textColor;
      const fromTheme = toHexColor(key === "fillColor" ? theme.fill : theme.text);
      const input = wrap.createEl("input", {
        cls: "io-colin",
        type: "color",
        value: own || fromTheme || "#ffffff",
        attr: { "aria-label": label + " for " + row.token },
      }) as ElInput;
      input.disabled = !o.enabled;
      input.addEventListener("change", (() => {
        if (!o.enabled) return;
        o.onVisual(row, { [key]: input.value }, reason);
      }) as never);
    };
    color("fillColor", say("FILL_COLOR"), "pkm:visuals:user-tags:fill");
    color("textColor", say("TEXT_COLOR"), "pkm:visuals:user-tags:text");

    /* Своя колонка предпросмотра — как в таблице Values. */
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
        const warn = el(cell, "span", "io-warn", "\u26A0");
        /* Одна подсказка на узел — и только `aria-label`. */
        warn.setAttribute("aria-label", contrastWarning(ratio, frame(o.ctx, "CONTRAST_WARNING")));
      }
    }

    const tools = el(line, "div", "io-valtools");
    /*
     * Обратно к цвету темы. Пикер такого сказать не умеет — у него всегда
     * какой-то цвет, — и без этой кнопки выбранный однажды цвет оставался бы
     * у тега навсегда и при смене темы не подстраивался.
     */
    if (row.fillColor || row.textColor) {
      const back = btn(tools, "io-icon", {
        text: "\u21BA",
        label: say("RESET_COLORS", row.token),
      });
      back.disabled = !o.enabled;
      back.addEventListener("click", (() => {
        if (!o.enabled) return;
        o.onVisual(row, { fillColor: "", textColor: "" }, "pkm:visuals:user-tags:color-reset");
      }) as never);
    }
    /* Удаление красное: единственная кнопка строки, которая уносит данные. */
    const del = btn(tools, "io-icon io-icon--danger", {
      text: "\u2715",
      label: say("REMOVE", row.token),
    });
    del.disabled = !o.enabled;
    del.addEventListener("click", (() => {
      if (!o.enabled) return;
      o.onRemove(row);
    }) as never);
  }

  const foot = el(box, "div", "io-rowactions");
  /* Решётка не обязательна: тег читается одинаково с ней и без неё. */
  const add = textInput(foot, "io-text io-text--mono", {
    value: "",
    placeholder: say("NEW_TAG_HINT"),
    label: say("NEW_TAG_ARIA"),
  });
  add.disabled = !o.enabled;
  const go = btn(foot, "io-btn io-btn--sm io-btn--cta",
    { text: say("ADD_TAG"), label: say("ADD_TAG") });
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
      /* Подсказки колонок снимаются вместе с узлом (С5). */
      const closers: Array<() => void> = [];
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
        onRename: (row, raw) => commit(() => { model.rename(row.token, raw); }),
        showTips: Boolean(ctx.get("general.help.showTips")),
        showIds: Boolean(ctx.get("advanced.showSettingIds")),
        closers,

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
