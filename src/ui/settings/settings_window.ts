/**
 * **Окна и уведомления панели — в окне панели** (BUGHUNT 2026-09-26, корень R2).
 *
 * В Obsidian 1.13 настройки по умолчанию открываются отдельным окном, а
 * `Modal` и `Notice` платформы ставят себя в `activeWindow` (`Modal.open`,
 * конструктор `Notice` в `app.js` 1.13.7). Окно настроек `activeWindow` не
 * становится, и «Add a Field», «Rename Field», «Delete Field», окно условия
 * Smart Rules, подтверждения и уведомления панели открывались в главном окне,
 * за настройками: человек видел «кнопка не работает», а второе нажатие давало
 * второе окно.
 *
 * Окно панели — то, в котором лежит её узел: он запоминается при отрисовке
 * вкладки. Узел не в документе (панель закрыта) — ответ «главное окно», то
 * есть поведение платформы как есть.
 */

type Root = { isConnected?: boolean; ownerDocument?: Document | null };
type Globals = { activeWindow?: Window; activeDocument?: Document };

let root: Root | null = null;

/** Узел вкладки настроек: по нему находится окно, в котором её видит человек. */
export function rememberSettingsRoot(el: Root | null): void {
  root = el;
}

/** Окно панели, если она открыта не в главном окне. */
export function settingsWindow(): Window | null {
  const doc = root && root.isConnected ? root.ownerDocument : null;
  return doc && doc.defaultView ? doc.defaultView : null;
}

/**
 * Выполнить `fn` так, будто окно панели — активное: окна и уведомления,
 * которые он заводит, встанут туда же. Прежнее активное окно возвращается в
 * любом случае.
 */
export function inSettingsWindow<T>(fn: () => T): T {
  const win = settingsWindow();
  const g = globalThis as unknown as Globals;
  if (!win || g.activeWindow === win) return fn();
  const prevWindow = g.activeWindow;
  const prevDocument = g.activeDocument;
  g.activeWindow = win;
  g.activeDocument = win.document;
  try {
    return fn();
  } finally {
    g.activeWindow = prevWindow;
    g.activeDocument = prevDocument;
  }
}
