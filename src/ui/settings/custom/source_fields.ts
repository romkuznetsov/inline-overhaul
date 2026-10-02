/**
 * `Which Fields stay on the line` — Values, остающиеся на строке после
 * `inline2note` (1.6.5.1, 2026-09-01). Контрол к давнему ключу, потерянному
 * при переносе (З2): `applySourceCleanupByFieldIds` убирает всё, кроме
 * перечисленных. Отмечено — остаётся, вопреки имени «cleanup» (З1). Пусто —
 * уходят все Values.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, btn, type El } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { realFields } from "./preview_data.ts";
import { BLOCK_TEXTS, sayIn } from "../texts_blocks.ts";

/** Путь ключа. Он же причина записи: по ней сверяются карты записей (М-4). */
export const KEEP_PATH = "transform.inline2note.sourceProcessing.cleanupFieldIds";

/* Пустые состояния (ПЗ2); слова в каталоге (10.13.47). */
const T = BLOCK_TEXTS["source-fields"];

export const NO_FIELDS = T.NO_FIELDS;
export const NONE_KEPT = T.NONE_KEPT;

/** Отмеченные Fields из конфига, без выдумок про их порядок. */
export function keptIds(ctx: SettingsCtx): readonly string[] {
  const raw = ctx.get(KEEP_PATH);
  if (!Array.isArray(raw)) return [];
  return raw.map(x => String(x || "").trim()).filter(Boolean);
}

export const sourceFields: CustomRender = (host: El, ctx: SettingsCtx) => {
  const say = sayIn("source-fields", ctx);
  const box = el(host, "div", "io-keepfields");
  let mounted: El | null = null;

  const draw = (): void => {
    /* Скролл и фокус снимаются до подмены узла и возвращаются после (A8). */
    const keep = keepView(box);
    const next = el(box, "div", "io-keepfields__mount");
    try {
      fill(next);
    } catch (e) {
      next.remove();
      console.error("inline-overhaul: список Fields исходной строки не отрисовался", e);
      return;
    }
    if (mounted) mounted.remove();
    mounted = next;
    keep.restore();
  };

  const fill = (mount: El): void => {
    /* Тем же чтением, что предпросмотры (П11). */
    const fields = realFields(ctx);
    const kept = new Set(keptIds(ctx));
    const enabled = Boolean(ctx.get("transform.inline2note.enabled"));

    if (!fields.length) {
      el(mount, "div", "io-side__empty", NO_FIELDS);
      return;
    }

    const list = el(mount, "div", "io-keepfields__list");
    for (const f of fields) {
      const row = el(list, "label", "io-keepfields__row");
      const input = row.createEl("input", {
        cls: "io-toggle io-toggle--check",
        type: "checkbox",
        attr: { "aria-label": say("KEEP_ONE", f.name || f.id) },
      }) as El & { checked: boolean; disabled: boolean };
      input.checked = kept.has(f.id);
      input.disabled = !enabled;
      input.addEventListener("change", (() => {
        if (!enabled) return;
        const now = new Set(keptIds(ctx));
        if (input.checked) now.add(f.id);
        else now.delete(f.id);
        /* В порядке Fields, не нажатий: одно множество — один конфиг (для сброса группы). */
        const ordered = fields.map(x => x.id).filter(id => now.has(id));
        void ctx.set(KEEP_PATH, ordered);
        draw();
      }) as never);
      el(row, "span", "io-keepfields__name", f.name || f.id);
      el(row, "span", "io-keepfields__kind", f.kind === "link" ? "link" : f.kind);
    }

    /* Ничего не отмечено — объяснить, что это значит. */
    if (!kept.size) el(mount, "p", "io-preview__note", NONE_KEPT);

    const actions = el(mount, "div", "io-rowactions");
    const all = btn(actions, "io-btn io-btn--sm", {
      text: say("KEEP_ALL"),
      label: say("KEEP_ALL_DESC"),
    });
    all.disabled = !enabled || kept.size === fields.length;
    all.addEventListener("click", (() => {
      if (!enabled) return;
      void ctx.set(KEEP_PATH, fields.map(f => f.id));
      draw();
    }) as never);
    const none = btn(actions, "io-btn io-btn--sm", {
      text: say("KEEP_NONE"),
      label: say("KEEP_NONE_DESC"),
    });
    none.disabled = !enabled || kept.size === 0;
    none.addEventListener("click", (() => {
      if (!enabled) return;
      void ctx.set(KEEP_PATH, []);
      draw();
    }) as never);
  };

  draw();
  /* И от Fields: заведённый на соседней вкладке появляется сразу (1.4.1.1.3). */
  const stop = ctx.watch([KEEP_PATH, "pkm.fields", "transform.inline2note.enabled"], draw);
  return () => {
    stop();
    box.empty();
  };
};
