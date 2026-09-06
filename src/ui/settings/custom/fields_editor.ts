/**
 * Редактор Fields в новой панели (PRD 10.2, фаза 3b пункт 4).
 *
 * Здесь только подключение: вёрстка лежит в `fields_editor_view.ts`, записи —
 * в `fields_model.ts`, а этот файл сводит их с платформой. Разделение не
 * ради красоты: вёрстка обязана рисоваться на заглушке DOM (гейт Г16), а
 * `Modal` и `Notice` заглушке недоступны, поэтому окна открываются отсюда и
 * приходят в блок обратными вызовами.
 *
 * Старая доска (`fields_editor_legacy.js`) отсюда больше не зовётся: её
 * держит только старая панель, до её удаления в фазе 3c. Записи у обеих
 * общие — модель одна, — и разойтись им не на чем.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, type El } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { createFieldsModel, type DeepState } from "./fields_model.ts";
import {
  renderFieldsEditor,
  type FieldsViewState,
  type NewField,
} from "./fields_editor_view.ts";

/*
 * Помощники состояния дерева значений. Берутся у перенесённой доски, а не
 * ищутся заново: у поиска есть откат на заглушку, и два таких отката
 * разошлись бы молча.
 */
import legacy from "./fields_editor_legacy.js";

interface LegacyModule {
  getOrderDeepEditorState: () => DeepState;
}

const helpers = legacy as unknown as LegacyModule;

/** Пути, на которых редактор перерисовывается целиком. */
const EDITOR_PATHS = ["features.pkm.enabled", "general.help.showTips", "advanced.showSettingIds"] as const;

/* ---- окна платформы ---------------------------------------------------- */

interface ModalCtor {
  new (app: unknown): {
    contentEl: El;
    open(): void;
    close(): void;
    onOpen?(): void;
    onClose?(): void;
  };
}

/**
 * Окно «Add a Field»: имя и тип (решение заказчика 2026-08-27, PRD 10.2 Ф5).
 * Тип выбирается один раз — он решает, что Field пишет в строку, — и после
 * создания не меняется, поэтому спросить его надо здесь.
 */
function askNewFieldModal(
  Modal: ModalCtor,
  app: unknown,
  done: (answer: NewField | null) => void,
): void {
  let answered = false;
  const finish = (answer: NewField | null): void => {
    if (answered) return;
    answered = true;
    done(answer);
  };

  class AddFieldModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      el(box, "h4", undefined, "Add a Field");

      const nameRow = el(box, "div", "io-item");
      const nameInfo = el(nameRow, "div", "io-item__info");
      el(nameInfo, "div", "io-item__name", "Name");
      el(nameInfo, "div", "io-item__desc", "What this Field is called here and in the config note");
      const name = el(nameRow, "div", "io-item__control").createEl("input", {
        cls: "io-text",
        type: "text",
        placeholder: "Priority",
        attr: { "aria-label": "Name of the new Field" },
      }) as El & { value: string };

      const typeRow = el(box, "div", "io-item");
      const typeInfo = el(typeRow, "div", "io-item__info");
      el(typeInfo, "div", "io-item__name", "Type");
      el(typeInfo, "div", "io-item__desc", "What the Field writes into the line");
      const type = el(typeRow, "div", "io-item__control").createEl("select", {
        cls: "io-select",
        attr: { "aria-label": "Type of the new Field" },
      }) as El & { value: string };
      for (const opt of [
        { value: "tag", label: "Tag" },
        { value: "wikilink", label: "Link" },
        { value: "element", label: "Element" },
      ]) type.createEl("option", { text: opt.label, value: opt.value });
      type.value = "tag";

      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button", { cls: "io-btn", text: "Cancel", attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(null); this.close(); }) as never);
      const add = foot.createEl("button", {
        cls: "io-btn io-btn--cta",
        text: "Add",
        attr: { type: "button" },
      }) as El & { disabled: boolean };
      add.disabled = true;
      /* Кнопка молчит, пока имени нет: Field без имени завести нечем. */
      name.addEventListener("input", (() => {
        add.disabled = !String(name.value || "").trim();
      }) as never);
      add.addEventListener("click", (() => {
        const value = String(name.value || "").trim();
        if (!value) return;
        finish({ name: value, kind: type.value as NewField["kind"] });
        this.close();
      }) as never);
    }

    override onClose(): void {
      /* Закрытие мимо кнопок — это отказ, а не пустой ответ. */
      finish(null);
      this.contentEl.empty();
    }
  }

  new AddFieldModal(app).open();
}

/**
 * Подтверждение удаления Field. Удаление уносит с собой Values, цвета и
 * свойство заметки, и переспросить дешевле, чем восстанавливать.
 */
function confirmDeleteModal(
  Modal: ModalCtor,
  app: unknown,
  fieldName: string,
  done: (yes: boolean) => void,
): void {
  let answered = false;
  const finish = (yes: boolean): void => {
    if (answered) return;
    answered = true;
    done(yes);
  };

  class DeleteFieldModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      el(box, "h4", undefined, "Delete Field");
      el(box, "p", "io-item__desc",
        "Deleting " + fieldName + " removes its Values, their colors and its note property");
      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button", { cls: "io-btn", text: "Cancel", attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(false); this.close(); }) as never);
      const del = foot.createEl("button", { cls: "io-danger", text: "Delete", attr: { type: "button" } });
      del.addEventListener("click", (() => { finish(true); this.close(); }) as never);
    }

    override onClose(): void {
      finish(false);
      this.contentEl.empty();
    }
  }

  new DeleteFieldModal(app).open();
}

/**
 * Окно «Rename Field»: новое имя и цена, которую за него платят.
 *
 * Решение заказчика 2026-08-31 по замечанию 1.4.1.2.2: переименовывать
 * системное имя можно, но молча — нельзя. Имя стоит в ваших заметках и в
 * идентификаторах команд Field, и после переименования старый тег в заметках
 * остаётся, а назначенный хоткей отвязывается: Obsidian держит хоткей за
 * идентификатором, а тот собран из имени.
 *
 * Поэтому окно не спрашивает «уверены?» — оно **перечисляет последствия**.
 */
function askRenameModal(
  Modal: ModalCtor,
  app: unknown,
  current: string,
  done: (next: string | null) => void,
): void {
  let answered = false;
  const finish = (next: string | null): void => {
    if (answered) return;
    answered = true;
    done(next);
  };

  class RenameFieldModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      el(box, "h4", undefined, "Rename Field");

      const row = el(box, "div", "io-item");
      const info = el(row, "div", "io-item__info");
      el(info, "div", "io-item__name", "New name");
      el(info, "div", "io-item__desc",
        "Lowercase letters, digits, spaces, hyphens and underscores");
      const input = el(row, "div", "io-item__control").createEl("input", {
        cls: "io-text io-text--mono",
        type: "text",
        value: current,
        attr: { "aria-label": "New name for the Field " + current },
      }) as El & { value: string };

      /* Цена названа до нажатия, а не после (З8 наоборот: это человеку). */
      const warn = el(box, "div", "io-dlg__warn");
      el(warn, "p", "io-item__desc",
        "Two things will not follow the new name:");
      const list = el(warn, "ul", "io-dlg__list");
      el(list, "li", "io-item__desc",
        "lines you have already written keep the old tag \u2014 the plugin does not edit your notes");
      el(list, "li", "io-item__desc",
        "a hotkey given to this Field\u2019s commands comes loose: Obsidian keeps hotkeys by command id, and the id is built from the name");

      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button", { cls: "io-btn", text: "Cancel", attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(null); this.close(); }) as never);
      const go = foot.createEl("button", {
        cls: "io-btn io-btn--cta",
        text: "Rename",
        attr: { type: "button" },
      }) as El & { disabled: boolean };
      const same = (): boolean =>
        !String(input.value || "").trim() || String(input.value || "").trim() === current;
      go.disabled = same();
      input.addEventListener("input", (() => { go.disabled = same(); }) as never);
      go.addEventListener("click", (() => {
        if (same()) return;
        finish(String(input.value || "").trim());
        this.close();
      }) as never);
    }

    override onClose(): void {
      finish(null);
      this.contentEl.empty();
    }
  }

  new RenameFieldModal(app).open();
}

/* ---- блок --------------------------------------------------------------- */

export const fieldsEditor: CustomRender = (host: El, ctx: SettingsCtx) => {
  const p = ctx.platform;
  const box = el(host, "div", "io-fieldsblock");

  /*
   * Без платформы блок не рисуется, и это не пользовательская ситуация:
   * платформу передаёт либо плагин, либо проверка. Молча оставить пустое
   * место хуже, чем не показать блок вовсе.
   */
  if (!p) return () => { box.empty(); };

  const Modal = p.Modal as ModalCtor;
  const app = (p.plugin as { app?: unknown }).app;
  const notice = (text: string): void => {
    const N = p.Notice as new (message: string) => unknown;
    try { new N(text); } catch { console.error("inline-overhaul: " + text); }
  };

  /** Выбранный Field — состояние вида, в конфиг не пишется (О0). */
  const state: FieldsViewState = { selected: "" };

  /*
   * Перерисовка идёт подменой узла, а не очисткой на месте. Причина из
   * практики: заказчик выключил модуль, отрисовка не удалась, и редактор
   * исчез до перезапуска Obsidian. Теперь неудачная попытка выбрасывается
   * целиком, а на экране остаётся то, что работало.
   */
  let mounted: El | null = null;
  let closeMounted: (() => void) | null = null;
  const draw = (): void => {
    /*
     * Скролл и фокус снимаются ДО подмены узла и возвращаются после неё
     * (дефект A8). Каждый контрол редактора зовёт `redraw`, и без этого
     * панель прыгала к началу на любое нажатие, а поле ввода теряло каретку
     * (замечание заказчика 2026-08-27).
     */
    const keep = keepView(box);
    const next = el(box, "div", "io-fieldsblock__mount");
    let close: () => void;
    try {
      /*
       * Модель собирается на каждой отрисовке: она снимает конфиг, а конфиг
       * между отрисовками меняется — и её же записями тоже.
       */
      const model = createFieldsModel({
        plugin: p.plugin as never,
        normalizePkmOrder: p.normalizePkmOrder as never,
        pkmOrderFields: p.pkmOrderFields,
        cfg: p.getConfig() as never,
        deepState: helpers.getOrderDeepEditorState(),
      });
      close = renderFieldsEditor(next, {
        model,
        ctx,
        state,
        enabled: Boolean(ctx.get("features.pkm.enabled")),
        showTips: Boolean(ctx.get("general.help.showTips")),
        showIds: Boolean(ctx.get("advanced.showSettingIds")),
        redraw: () => { draw(); },
        notice,
        askNewField: done => askNewFieldModal(Modal, app, done),
        confirmDeleteField: (name, done) => confirmDeleteModal(Modal, app, name, done),
        askRename: (name, done) => askRenameModal(Modal, app, name, done),
      });
    } catch (e) {
      next.remove();
      console.error("inline-overhaul: редактор Fields не отрисовался", e);
      return;
    }
    if (closeMounted) closeMounted();
    if (mounted) mounted.remove();
    mounted = next;
    closeMounted = close;
    /* Только теперь: пока в дереве стоят оба поддерева, высота больше
       настоящей, и возвращённая прокрутка была бы не той. */
    keep.restore();
  };

  draw();
  const unwatch = ctx.watch(EDITOR_PATHS, draw);
  return () => {
    unwatch();
    if (closeMounted) closeMounted();
    closeMounted = null;
    mounted = null;
    box.empty();
  };
};
