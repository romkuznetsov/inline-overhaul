/**
 * Ступени расширенного `Ctrl+A` для режима `Custom` (задача заказчика З-3,
 * 2026-09-08).
 *
 * Заказчик: «при активации которого под опцией select-all-steps открывался бы
 * список с чекбоксами `word, line, tree, heading, note` (визуально это должно
 * выглядеть аналогично табличке `source-fields-head`)». Отсюда и вид, и место:
 * строка-заголовок `Steps to cycle through` рисуется схемой, а список — здесь,
 * теми же классами, что список Fields исходной строки.
 *
 * **Порядок ступеней задают не галочки.** Он один и объявлен в
 * `src/core/select_all_steps.js`: галочки выбирают ступени, а не их
 * последовательность. Его пример — `word`, `line`, `note` — идёт этим же
 * порядком.
 *
 * **Пусто — законное состояние.** Сняв все галочки, человек оставляет
 * `Ctrl/Cmd + A` клавишей Obsidian: одно нажатие, вся заметка. Это сказано
 * словами, а не молчанием (ПЗ2).
 *
 * **Каждое слово спрашивается у каталога**, а не берётся из константы: имя
 * ступени рисуется на экране, и литерал на этом месте не переводится (У-108).
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, type El } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { sayIn } from "../texts_blocks.ts";

/* Ступени и их порядок — одним объявлением на движок, нормализацию и панель
   (У-32). Второй список здесь разошёлся бы с движком молча. */
import stepsModule from "../../../core/select_all_steps.js";

interface StepsModule {
  SELECT_ALL_STEP_IDS: readonly string[];
  normalizeCustomSteps(raw: unknown): Record<string, boolean>;
}

const steps = stepsModule as unknown as StepsModule;

/** Путь ключа. Он же причина записи: по ней сверяются карты записей (М-4). */
export const CUSTOM_STEPS_PATH = "editor.selectAll.customSteps";

/** Тумблер всего раздела: при выключенном `Ctrl+A` галочкам нечего решать. */
const ENABLED_PATH = "editor.selectAll.enabled";

/**
 * Имена строк каталога по ступени: имя ступени и то, что она выделяет.
 *
 * Здесь стоят **имена ключей**, а не сами слова: слова живут в каталоге, и
 * спрашиваются они по этим именам.
 */
const STEP_KEYS: Readonly<Record<string, { name: string; about: string }>> = {
  word: { name: "STEP_WORD", about: "STEP_WORD_ABOUT" },
  line: { name: "STEP_LINE", about: "STEP_LINE_ABOUT" },
  tree: { name: "STEP_TREE", about: "STEP_TREE_ABOUT" },
  heading: { name: "STEP_HEADING", about: "STEP_HEADING_ABOUT" },
  note: { name: "STEP_NOTE", about: "STEP_NOTE_ABOUT" },
};

/** Отмеченные ступени из конфига, приведённые к пяти булевым. */
export function pickedSteps(ctx: SettingsCtx): Record<string, boolean> {
  return steps.normalizeCustomSteps(ctx.get(CUSTOM_STEPS_PATH));
}

export const selectAllCustom: CustomRender = (host: El, ctx: SettingsCtx) => {
  const say = sayIn("select-all-custom", ctx);
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
      console.error("inline-overhaul: список ступеней Ctrl+A не отрисовался", e);
      return;
    }
    if (mounted) mounted.remove();
    mounted = next;
    keep.restore();
  };

  const fill = (mount: El): void => {
    const picked = pickedSteps(ctx);
    const enabled = Boolean(ctx.get(ENABLED_PATH));

    const list = el(mount, "div", "io-keepfields__list");
    for (const id of steps.SELECT_ALL_STEP_IDS) {
      const keys = STEP_KEYS[id];
      if (!keys) continue;
      const name = say(keys.name);
      const row = el(list, "label", "io-keepfields__row");
      const input = row.createEl("input", {
        cls: "io-toggle io-toggle--check",
        type: "checkbox",
        attr: { "aria-label": say("STOP_AT", name) },
      }) as El & { checked: boolean; disabled: boolean };
      input.checked = picked[id] === true;
      input.disabled = !enabled;
      input.addEventListener("change", (() => {
        if (!enabled) return;
        /*
         * Пишется вся пятёрка, а не один ключ: ветка целиком принадлежит
         * этому блоку, и половинчатая запись оставила бы в конфиге форму,
         * которую нормализации пришлось бы достраивать на каждом патче.
         */
        const nextPicked = { ...pickedSteps(ctx), [id]: input.checked };
        void ctx.set(CUSTOM_STEPS_PATH, nextPicked);
        draw();
      }) as never);
      el(row, "span", "io-keepfields__name", name);
      el(row, "span", "io-keepfields__kind", say(keys.about));
    }

    /* Ни одной отмеченной — сказать, что это значит, а не молчать. */
    const anyPicked = steps.SELECT_ALL_STEP_IDS.some(id => picked[id] === true);
    if (!anyPicked) el(mount, "p", "io-preview__note", say("NOTHING_TICKED"));
  };

  draw();
  /*
   * Блок просыпается от хранилища (A9): галочку могли поменять сбросом группы
   * или восстановлением копии, и список обязан это показать без перехода по
   * вкладкам.
   */
  const stop = ctx.watch([CUSTOM_STEPS_PATH, ENABLED_PATH], draw);
  return () => {
    stop();
    box.empty();
  };
};
