"use strict";

/*
 * Где взять редактор, в котором человек сейчас стоит. Одно объявление на весь
 * плагин.
 *
 * Было пять: точка входа, макро-рантайм, TagWheel и два движка статуса — и все
 * пять отвечали по-разному. Четыре из них спрашивали `workspace.activeLeaf`
 * **первым**, а каталог Obsidian требует `getActiveViewOfType` (П1, П8): у
 * активной панели вид может быть не заметкой вовсе, и тогда команда либо
 * молчит, либо правит не тот редактор.
 *
 * Порядок здесь — от точного к запасному:
 *   1. `getActiveViewOfType(MarkdownView)` — то, что просит каталог;
 *   2. `workspace.activeEditor` — документированный путь без конструктора;
 *   3. `workspace.activeLeaf` — последняя попытка, и это единственное место во
 *      всём рантайме, где она осталась. Снимать её нельзя: движки жили на ней
 *      с первого дня, и случай «вид заметки открыт, а платформа его активным
 *      не пометила» через неё и работал.
 *
 * **Конструктор вида.** Точка входа берёт его `require("obsidian").MarkdownView`
 * и передаёт сюда. Движкам `obsidian` не подключить — они же грузятся и
 * проверками вне Obsidian, — поэтому им остаётся проба у реестра плагинов:
 * приватный путь, которого может не быть, и «нет» здесь ответ, а не отказ.
 */

function workspaceOf(app) {
  return app && app.workspace && typeof app.workspace === "object" ? app.workspace : null;
}

function editorOfView(view) {
  if (!view) return null;
  if (view.editor) return view.editor;
  if (view.currentMode && view.currentMode.editor) return view.currentMode.editor;
  return null;
}

/*
 * Проба: у платформы спрашивается конструктор вида заметки через реестр
 * плагинов. API приватное, его может не быть, и тогда ответ «нет» — работа
 * идёт дальше по второму пути.
 */
function markdownViewCtorFrom(app) {
  try {
    const plugins = app && app.plugins && app.plugins.plugins ? app.plugins.plugins : null;
    const md = plugins ? plugins.markdown : null;
    return md && md.constructor ? md.constructor : null;
  } catch (_) {
    /* проба: реестра плагинов может не быть вовсе */
    return null;
  }
}

function activeEditorFrom(app, viewCtor) {
  const ws = workspaceOf(app);
  if (!ws) return null;

  const ctor = viewCtor || markdownViewCtorFrom(app);
  if (ctor && typeof ws.getActiveViewOfType === "function") {
    let byType = null;
    try {
      byType = ws.getActiveViewOfType(ctor);
    } catch (_) {
      /* проба: платформа вправе не знать этого конструктора */
      byType = null;
    }
    const fromType = editorOfView(byType);
    if (fromType) return fromType;
  }

  if (ws.activeEditor && ws.activeEditor.editor) return ws.activeEditor.editor;

  const leaf = ws.activeLeaf;
  const fromLeaf = editorOfView(leaf && leaf.view ? leaf.view : null);
  if (fromLeaf) return fromLeaf;

  return null;
}

module.exports = {
  activeEditorFrom,
  markdownViewCtorFrom,
};
