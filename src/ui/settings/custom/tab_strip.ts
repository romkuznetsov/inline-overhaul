/**
 * Полоса вкладок панели настроек (2026-08-24, PRD 10.13.13). Не в
 * `obsidian_tab.ts`: пакет `obsidian` в Node не подключается (`custom/dom.ts`).
 *
 * Полоса — свой узел в родителе прокрутки (`.vertical-tab-content-container`):
 * `sticky` в строке уезжал с группой, а узел строки платформа возвращает на
 * место (`app.js` 1.13.7: `i6` — `listEl.setChildrenInPlace`, `e6` —
 * `containerEl.setChildrenInPlace`). Детей этого контейнера она не переписывает
 * и опустошает на `openTab`. Прокрутки нет — полоса в своей строке.
 *
 * Клавиатура (5.4): `tablist`, стрелки между вкладками, в табуляции — только активная.
 */

import { findScrollHost, type El, type ScrollProbe } from "./dom.ts";

/** Что полосе нужно знать: какие вкладки есть, какая открыта и как выбрать. */
export interface TabStripState<Id extends string = string> {
  tabs: ReadonlyArray<{ id: Id; label: string; desc?: string }>;
  active: Id;
  pick: (id: Id) => void;
  /** Подпись самой полосы для программы чтения с экрана (10.13.47). */
  label?: string;
}

/** Узел-хозяин полосы: родитель прокрутки. Всё необязательное проверяется. */
interface StripHost extends El {
  children?: ArrayLike<StripHost>;
  firstChild?: StripHost | null;
  parentElement?: StripHost | null;
  insertBefore?: (node: El, before: StripHost | null) => unknown;
  hasClass?: (cls: string) => boolean;
  scrollTop?: number;
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

      /* Свой узел у прокрутки, если нашлась, иначе строка. Прежний экземпляр снимается — отрисовка повторная. */
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
        /* Пустая скрытая строка платформы нужна, чтобы полоса пересобиралась на каждой отрисовке. */
        row.addClass("io-tabsrow--parked");
      }

      const strip = box.createDiv({ cls: "io-tabs" });
      strip.setAttribute("role", "tablist");
      strip.setAttribute("aria-label", state.label || "Settings areas");

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
        /* Щелчок по открытой вкладке — наверх её настроек (2026-09-28). */
        btn.addEventListener("click", (() => {
          if (isActive && scroll) scroll.scrollTop = 0;
          else state.pick(tab.id);
        }) as never);
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
