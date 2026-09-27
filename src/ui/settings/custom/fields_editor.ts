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
import { el, rich, tipBelow, type El } from "./dom.ts";
import { inSettingsWindow } from "../settings_window.ts";
import { keepView } from "./keepview.ts";
import { createFieldsModel, type DeepState } from "./fields_model.ts";
import {
  renderFieldsEditor,
  FIELDS_HEIGHT_PATH,
  type FieldsViewState,
  type NewField,
} from "./fields_editor_view.ts";

/*
 * Помощники состояния дерева значений — **напрямую из модуля** (последний
 * пункт фазы 6, 2026-09-08).
 *
 * До этого их брал шов `fields_editor_legacy.js`: `globalThis`, `require` по
 * относительному пути и заглушка на случай отказа. Довод у шва был честный —
 * «у поиска есть откат на заглушку, и двух таких откатов быть не должно», —
 * но откат оказался лишним целиком: `globalThis.__inlineOrderDeepEditorState`
 * не ставил **никто**, а `require` стоял литералом и в бандле разрешался
 * всегда. То есть заглушка была недостижима, и её единственным делом было
 * прятать отказ загрузки, если бы он случился (У-90).
 */
import deepStateModule from "../../../core/order_deep_editor_state.js";
import linkRenameModule from "../../../features/link_value_rename.js";
import { sayIn } from "../texts_blocks.ts";
import { escapeScope } from "./char_picker.ts";

const deepState = deepStateModule as unknown as DeepState;

/** Цена переименования Value-ссылки — ответ `linkValueRenameImpact`. */
interface LinkRenameImpact {
  kind: "note" | "clash" | "none";
  oldTarget: string;
  newTarget: string;
  file?: unknown;
  newPath?: string;
  links: number;
  notes: number;
}
const linkRename = linkRenameModule as unknown as {
  linkValueRenameImpact: (app: unknown, oldToken: string, nextToken: string) => LinkRenameImpact | null;
};

/** Как окно спрашивает свой текст (10.13.47). */
type Say = (name: string, ...args: readonly (string | number)[]) => string;

/** Пути, на которых редактор перерисовывается целиком. */
const EDITOR_PATHS = [
  "features.pkm.enabled",
  "general.help.showTips",
  "advanced.showSettingIds",
  /* Высота таблицы: переключатель в шапке пишет её и ждёт пробуждения
     отсюда, а не зовёт перерисовку сам (У-22). Через тот же путь редактор
     узнаёт о восстановлении копии настроек. */
  FIELDS_HEIGHT_PATH,
] as const;

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
export function askNewFieldModal(
  Modal: ModalCtor,
  app: unknown,
  done: (answer: NewField | null) => void,
  say: Say,
  tips: { showTips: boolean; showIds: boolean },
): void {
  let answered = false;
  const finish = (answer: NewField | null): void => {
    if (answered) return;
    answered = true;
    done(answer);
  };

  class AddFieldModal extends Modal {
    dropTips: () => void = () => {};

    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      el(box, "h4", "io-dlg__title", say("NEW_FIELD_TITLE"));

      /*
       * «?» у полей окна — его ответ 2026-09-23 «да, тоже» на вопрос, нужны
       * ли они и здесь, как в окне Binder: «единая логика tip во всем
       * плагине». Та же форма, что у строки своего блока.
       */
      const tipClosers: Array<() => void> = [];
      const nameOf = (row: El, name: string, tip: string): El => {
        const info = el(row, "div", "io-item__info");
        const head = el(info, "div", "io-item__namerow");
        el(head, "div", "io-item__name", say(name));
        tipClosers.push(tipBelow({
          head, host: row, text: say(tip), label: say(name),
          id: "io-field-new-" + tip.toLowerCase().replace(/_/g, "-"),
          showTips: tips.showTips, showIds: tips.showIds,
        }));
        return info;
      };
      this.dropTips = () => { for (const close of tipClosers) close(); };

      const nameRow = el(box, "div", "io-item");
      const nameInfo = nameOf(nameRow, "NEW_FIELD_NAME", "NEW_FIELD_NAME_TIP");
      el(nameInfo, "div", "io-item__desc", say("NEW_FIELD_NAME_LABEL"));
      const name = el(nameRow, "div", "io-item__control").createEl("input", {
        cls: "io-text",
        type: "text",
        placeholder: say("NEW_FIELD_NAME_HINT"),
        attr: { "aria-label": say("NEW_FIELD_NAME_ARIA") },
      }) as El & { value: string };

      const typeRow = el(box, "div", "io-item");
      const typeInfo = nameOf(typeRow, "NEW_FIELD_TYPE", "NEW_FIELD_TYPE_TIP");
      el(typeInfo, "div", "io-item__desc", say("NEW_FIELD_TYPE_LABEL"));
      const type = el(typeRow, "div", "io-item__control").createEl("select", {
        cls: "io-select",
        attr: { "aria-label": say("NEW_FIELD_TYPE_ARIA") },
      }) as El & { value: string };
      for (const opt of [
        { value: "tag", name: "NEW_FIELD_TYPE_TAG" },
        { value: "wikilink", name: "NEW_FIELD_TYPE_LINK" },
        { value: "element", name: "NEW_FIELD_TYPE_ELEMENT" },
      ]) type.createEl("option", { text: say(opt.name), value: opt.value });
      type.value = "tag";

      /* Знак Element спрашивается сразу (BUGHUNT S4): без него tagWheel не
         открывается вовсе. Строка видна только у Element. */
      const markerRow = el(box, "div", "io-item");
      const markerInfo = nameOf(markerRow, "NEW_FIELD_MARKER", "NEW_FIELD_MARKER_TIP");
      el(markerInfo, "div", "io-item__desc", say("NEW_FIELD_MARKER_LABEL"));
      const marker = el(markerRow, "div", "io-item__control").createEl("input", {
        cls: "io-text",
        type: "text",
        placeholder: say("NEW_FIELD_MARKER_HINT"),
        attr: { "aria-label": say("NEW_FIELD_MARKER_ARIA") },
      }) as El & { value: string };
      const showMarker = (): void => { markerRow.hidden = type.value !== "element"; };
      showMarker();

      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button",
        { cls: "io-btn", text: say("CANCEL"), attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(null); this.close(); }) as never);
      const add = foot.createEl("button", {
        cls: "io-btn io-btn--cta",
        text: say("NEW_FIELD_ADD"),
        attr: { type: "button" },
      }) as El & { disabled: boolean };
      add.disabled = true;
      /* Кнопка молчит, пока имени нет (и знака у Element): завести нечем. */
      const ready = (): boolean => !!String(name.value || "").trim()
        && (type.value !== "element" || !!String(marker.value || "").trim());
      const sync = (): void => { add.disabled = !ready(); showMarker(); };
      name.addEventListener("input", sync as never);
      marker.addEventListener("input", sync as never);
      type.addEventListener("change", sync as never);
      const confirm = (): void => {
        if (!ready()) return;
        const value = String(name.value || "").trim();
        const kind = type.value as NewField["kind"];
        finish(kind === "element" ? { name: value, kind, marker: String(marker.value || "").trim() } : { name: value, kind });
        this.close();
      };
      add.addEventListener("click", confirm as never);
      /* Enter подтверждает, как кнопка (BUGHUNT S3). */
      const enterAdds = ((e: { key?: string; preventDefault?: () => void }) => {
        if (!e || e.key !== "Enter") return;
        if (typeof e.preventDefault === "function") e.preventDefault();
        confirm();
      }) as never;
      name.addEventListener("keydown", enterAdds);
      marker.addEventListener("keydown", enterAdds);
    }

    override onClose(): void {
      /* Закрытие мимо кнопок — это отказ, а не пустой ответ. */
      finish(null);
      this.dropTips();
      this.contentEl.empty();
    }
  }

  inSettingsWindow(() => new AddFieldModal(app).open());
}

/**
 * **Переименование Value-ссылки называет цену** — его пункт 2026-09-27 к тесту 7
 * цикла 97. Цену считает `linkValueRenameImpact` (платформа: кэш ссылок и
 * поиск заметки). Окна нет, когда ссылок на старое имя нет вовсе.
 *
 * Дорога одна: при «Rename note and links» сперва пишется Value, потом
 * переименовывается заметка — `fileManager.renameFile`, и ссылки переписывает
 * сам Obsidian. Следствие «Value идёт за заметкой» (F16) находит Value уже
 * переименованным и второй записи не делает.
 */
function askLinkValueRenameModal(
  Modal: ModalCtor,
  app: unknown,
  oldToken: string,
  nextToken: string,
  apply: () => void,
  revert: () => void,
  say: Say,
  notice: (text: string) => void,
): void {
  const impact = linkRename.linkValueRenameImpact(app, oldToken, nextToken) as LinkRenameImpact | null;
  if (!impact || !impact.links) { apply(); return; }
  const count = (n: number, one: string, many: string): string => say(n === 1 ? one : many, n);
  const links = count(impact.links, "LINK_RENAME_LINKS_ONE", "LINK_RENAME_LINKS_MANY");
  const notes = count(impact.notes, "LINK_RENAME_NOTES_ONE", "LINK_RENAME_NOTES_MANY");
  const words = [oldToken, impact.oldTarget, impact.newTarget, links, notes] as const;
  const vault = (app as { vault?: { getConfig?: (k: string) => unknown } }).vault;
  /* Проба: `getConfig` у vault внутренний, и «нет» — ответ, а не отказ. */
  const asksFirst = !!vault && typeof vault.getConfig === "function" && vault.getConfig("alwaysUpdateLinks") === false;

  let answered = false;
  const finish = (choice: "note" | "value" | null): void => {
    if (answered) return;
    answered = true;
    if (!choice) { revert(); return; }
    apply();
    if (choice !== "note" || !impact.file) return;
    const fm = (app as { fileManager?: { renameFile?: (f: unknown, p: string) => Promise<void> } }).fileManager;
    if (!fm || typeof fm.renameFile !== "function") return;
    fm.renameFile(impact.file, impact.newPath || "").catch((e: unknown) => {
      notice(say("LINK_RENAME_FAILED", String((e as { message?: string }) && (e as { message?: string }).message || e)));
    });
  };

  class LinkValueRenameModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      const kind = impact!.kind;
      el(box, "h4", "io-dlg__title", say(kind === "note" ? "LINK_RENAME_TITLE" : kind === "clash" ? "LINK_RENAME_CLASH_TITLE" : "LINK_RENAME_NONE_TITLE"));
      rich(el(box, "p", "io-item__desc"),
        say(kind === "note" ? "LINK_RENAME_NOTE_BODY" : kind === "clash" ? "LINK_RENAME_CLASH_BODY" : "LINK_RENAME_NONE_BODY", ...words));
      if (kind === "note") {
        const warn = el(box, "div", "io-dlg__warn");
        rich(el(warn, "p", "io-item__desc"), say("LINK_RENAME_NOTE_ONLY", ...words));
        if (asksFirst) rich(el(warn, "p", "io-item__desc"), say("LINK_RENAME_ASKS_FIRST"));
      }
      const foot = el(box, "div", "io-dlg__foot");
      const button = (text: string, cls: string, choice: "note" | "value" | null): void => {
        const b = foot.createEl("button", { cls, text, attr: { type: "button" } });
        b.addEventListener("click", (() => { finish(choice); this.close(); }) as never);
      };
      button(say("CANCEL"), "io-btn", null);
      if (kind === "note") {
        button(say("LINK_RENAME_VALUE"), "io-btn", "value");
        button(say("LINK_RENAME_BOTH"), "io-btn io-btn--cta", "note");
      } else {
        button(say("LINK_RENAME_VALUE_CTA"), "io-btn io-btn--cta", "value");
      }
    }

    override onClose(): void {
      /* Закрытие мимо кнопок — отказ: поле возвращается к прежнему Value. */
      finish(null);
      this.contentEl.empty();
    }
  }

  inSettingsWindow(() => new LinkValueRenameModal(app).open());
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
  say: Say,
  /* Окно удаления custom block — то же окно со своими словами (PRD 10.13.260). */
  words?: { title: string; body: string },
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
      el(box, "h4", "io-dlg__title", words ? words.title : say("DELETE_TITLE"));
      el(box, "p", "io-item__desc", words ? words.body : say("DELETE_BODY", fieldName));
      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button",
        { cls: "io-btn", text: say("CANCEL"), attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(false); this.close(); }) as never);
      const del = foot.createEl("button",
        { cls: "io-danger", text: say("DELETE_CONFIRM"), attr: { type: "button" } });
      del.addEventListener("click", (() => { finish(true); this.close(); }) as never);
    }

    override onClose(): void {
      finish(false);
      this.contentEl.empty();
    }
  }

  inSettingsWindow(() => new DeleteFieldModal(app).open());
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
  say: Say,
  /*
   * Имя custom block: окно то же, что у Field (PRD 10.13.260, пункт 1), но
   * цены у него нет — хоткей держится за `id` блока, а не за имя, и в
   * заметках блок своего имени не пишет.
   */
  block?: boolean,
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
      el(box, "h4", "io-dlg__title", say(block ? "RENAME_BLOCK_TITLE" : "RENAME_TITLE"));

      const row = el(box, "div", "io-item");
      const info = el(row, "div", "io-item__info");
      el(info, "div", "io-item__name", say("RENAME_LABEL"));
      el(info, "div", "io-item__desc", say(block ? "RENAME_BLOCK_HINT" : "RENAME_HINT"));
      const input = el(row, "div", "io-item__control").createEl("input", {
        cls: block ? "io-text" : "io-text io-text--mono",
        type: "text",
        value: current,
        attr: { "aria-label": say(block ? "RENAME_BLOCK_ARIA" : "RENAME_ARIA", current) },
      }) as El & { value: string };

      /* Цена названа до нажатия, а не после (З8 наоборот: это человеку). */
      if (!block) {
        const warn = el(box, "div", "io-dlg__warn");
        el(warn, "p", "io-item__desc", say("RENAME_WARNING"));
        const list = el(warn, "ul", "io-dlg__list");
        el(list, "li", "io-item__desc", say("RENAME_WARNING_NOTES"));
        el(list, "li", "io-item__desc", say("RENAME_WARNING_HOTKEY"));
      }

      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button",
        { cls: "io-btn", text: say("CANCEL"), attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(null); this.close(); }) as never);
      const go = foot.createEl("button", {
        cls: "io-btn io-btn--cta",
        text: say("RENAME_CONFIRM"),
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

  inSettingsWindow(() => new RenameFieldModal(app).open());
}

/* ---- блок --------------------------------------------------------------- */

const VIEW_STATE = new WeakMap<object, FieldsViewState>();

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

  /*
   * Выбранный Field — состояние вида, в конфиг не пишется (О0). Живёт у
   * платформы, а не у блока: пересборка вкладки (новый Field меняет список
   * `Left Block active Field` на той же вкладке) рисует блок заново, и
   * состояние в замыкании блока сбрасывало выбор к первому Field.
   */
  let state = VIEW_STATE.get(p);
  if (!state) { state = { selected: "" }; VIEW_STATE.set(p, state); }

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
        deepState,
      });
      const say = sayIn("field-editor", ctx);
      close = renderFieldsEditor(next, {
        model,
        ctx,
        state,
        enabled: Boolean(ctx.get("features.pkm.enabled")),
        showTips: Boolean(ctx.get("general.help.showTips")),
        showIds: Boolean(ctx.get("advanced.showSettingIds")),
        redraw: () => { draw(); },
        ...(() => {
          /* Над окном настроек — область приложения: там живут хоткеи. */
          const holdKeys = escapeScope(p.Scope, app, app && (app as { scope?: unknown }).scope);
          return holdKeys ? { holdKeys } : {};
        })(),
        notice,
        askNewField: done => askNewFieldModal(Modal, app, done, say, {
          showTips: Boolean(ctx.get("general.help.showTips")),
          showIds: Boolean(ctx.get("advanced.showSettingIds")),
        }),
        confirmDeleteField: (name, done) => confirmDeleteModal(Modal, app, name, done, say),
        askLinkValueRename: (oldToken, nextToken, apply, revert) =>
          askLinkValueRenameModal(Modal, app, oldToken, nextToken, apply, revert, say, notice),
        askRename: (name, done) => askRenameModal(Modal, app, name, done, say),
        askRenameBlock: (name, done) => askRenameModal(Modal, app, name, done, say, true),
        confirmDeleteBlock: (name, fields, done) => confirmDeleteModal(Modal, app, name, done, say, {
          title: say("DELETE_BLOCK_TITLE"),
          body: say("DELETE_BLOCK_BODY", name, fields.length, fields.join(", ")),
        }),
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
