/**
 * Полоса вкладок панели настроек (решение заказчика 2026-08-24, PRD 10.13.13).
 *
 * Живёт здесь, а не в `obsidian_tab.ts`, ровно по причине из `custom/dom.ts`:
 * пакет `obsidian` в Node не подключается вовсе (`"main": ""`), и всё, что его
 * импортирует, проверке недоступно — пин на такой файл остаётся пином по
 * исходнику. Полосе платформа не нужна: ей хватает узла и `findScrollHost`.
 *
 * **Почему полоса рисуется не в своей строке, а рядом с прокруткой.**
 * Заказчик трижды написал, что полоса уезжает при прокрутке. `position:
 * sticky` прилипает к краю только пока в виду **родитель** элемента, а
 * родитель строки настроек — список строк одной группы. Переставить узел
 * строки насовсем нельзя: он принадлежит платформе, и та возвращает его на
 * место дважды за отрисовку (`app.js` 1.13.7):
 *
 *   - `i6` заканчивает каждую группу вызовом
 *     `listEl.setChildrenInPlace(<узлы своих строк>)` — узел строки среди них,
 *     и он втягивается обратно в список группы;
 *   - `e6` заканчивает отрисовку вызовом
 *     `containerEl.setChildrenInPlace(<узлы групп>)` — всё, что положено прямо
 *     в прокрутку, из неё удаляется.
 *
 * Поэтому полоса — **свой** узел, и живёт он в родителе прокрутки: у платформы
 * это `.vertical-tab-content-container`, чьих детей она не переписывает, а на
 * переключении вкладки просто опустошает (`openTab`) — то есть уборка за нами
 * уже сделана. Родитель становится колонкой, полоса встаёт над прокруткой, и
 * уезжать ей больше некуда.
 *
 * Прокрутки не нашлось (проверки, дымовой прогон, незнакомая разметка) —
 * полоса рисуется в своей строке, как раньше.
 *
 * Полоса наша — значит и клавиатура наша (5.4): это `tablist`, между вкладками
 * ходят стрелками, в обход табуляции остаётся только активная.
 */

import { findScrollHost, type El, type ScrollProbe } from "./dom.ts";

/** Что полосе нужно знать: какие вкладки есть, какая открыта и как выбрать. */
export interface TabStripState<Id extends string = string> {
  tabs: ReadonlyArray<{ id: Id; label: string; desc?: string }>;
  active: Id;
  pick: (id: Id) => void;
}

/** Узел-хозяин полосы: родитель прокрутки. Всё необязательное проверяется. */
interface StripHost extends El {
  children?: ArrayLike<StripHost>;
  firstChild?: StripHost | null;
  parentElement?: StripHost | null;
  insertBefore?: (node: El, before: StripHost | null) => unknown;
  hasClass?: (cls: string) => boolean;
}

/** Событие клавиатуры в том виде, в каком его читает полоса. */
interface KeyEv {
  key: string;
  preventDefault: () => void;
}

export function tabStripRow<Id extends string>(state: TabStripState<Id>): {
  name: string;
  searchable: boolean;
  render: (setting: { settingEl: El }) => void;
} {
  return {
    name: "",
    searchable: false,
    render: (setting: { settingEl: El }) => {
      const row = setting.settingEl as StripHost;
      row.empty();
      row.classList.remove("io-tabsrow--parked");
      row.addClass("io-tabsrow");

      const scroll = findScrollHost(row as unknown as ScrollProbe) as unknown as StripHost | null;
      const outer = scroll && scroll.parentElement ? scroll.parentElement : null;

      /*
       * Куда рисуем. Свой узел рядом с прокруткой, если она нашлась; иначе
       * своя строка. Прежний экземпляр снимается: строка рисуется заново на
       * каждой отрисовке, и без уборки полосы копились бы.
       */
      let box: El = row;
      if (outer && typeof outer.createDiv === "function" && typeof outer.insertBefore === "function") {
        const kids = Array.from(outer.children || []);
        for (const old of kids) {
          if (old !== scroll && typeof old.hasClass === "function" && old.hasClass("io-tabsbar")) {
            old.remove();
          }
        }
        outer.addClass("io-tabshost");
        if (scroll) scroll.addClass("io-tabsscroll");
        const made = outer.createDiv({ cls: "io-tabsbar" });
        outer.insertBefore(made, outer.firstChild || null);
        box = made;
        /* Строка платформы остаётся пустой и скрытой: она нужна затем, чтобы
           полоса пересобиралась на каждой отрисовке. */
        row.addClass("io-tabsrow--parked");
      }

      const strip = box.createDiv({ cls: "io-tabs" });
      strip.setAttribute("role", "tablist");
      strip.setAttribute("aria-label", "Settings areas");

      state.tabs.forEach(tab => {
        const isActive = tab.id === state.active;
        const btn = strip.createEl("button", {
          cls: "io-tab" + (isActive ? " io-tab--active" : ""),
          text: tab.label,
        });
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
        btn.tabIndex = isActive ? 0 : -1;
        if (tab.desc) btn.setAttribute("aria-description", tab.desc);
        btn.addEventListener("click", (() => state.pick(tab.id)) as never);
      });

      /* Стрелки ходят по полосе, Home и End прыгают на края. */
      strip.addEventListener("keydown", ((ev: KeyEv) => {
        const at = state.tabs.findIndex(t => t.id === state.active);
        let next = -1;
        if (ev.key === "ArrowRight") next = (at + 1) % state.tabs.length;
        else if (ev.key === "ArrowLeft") next = (at - 1 + state.tabs.length) % state.tabs.length;
        else if (ev.key === "Home") next = 0;
        else if (ev.key === "End") next = state.tabs.length - 1;
        if (next < 0) return;
        ev.preventDefault();
        const tab = state.tabs[next];
        if (tab) state.pick(tab.id);
      }) as never);
    },
  };
}
