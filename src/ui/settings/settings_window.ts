/**
 * Окна и уведомления панели — в окне панели (BUGHUNT 2026-09-26, R2). В
 * Obsidian 1.13 настройки — отдельное окно, а `Modal` и `Notice` встают в
 * `activeWindow` (`app.js` 1.13.7), которым окно настроек не становится.
 * Окно панели — окно её узла; узел не в документе — главное окно.
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

/** `fn` с окном панели как активным; прежнее возвращается всегда. */
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
