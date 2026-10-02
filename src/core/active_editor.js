// @ts-check
"use strict";

/*
 * Активный редактор — одно объявление на плагин. Порядок от точного к
 * запасному (каталог Obsidian, П1, П8):
 *   1. `getActiveViewOfType(MarkdownView)`;
 *   2. `workspace.activeEditor`;
 *   3. `workspace.activeLeaf` — не снимать: ловит вид заметки, который
 *      платформа не пометила активным.
 */

/**
 * Рабочее место Obsidian, если оно объект. `any` — сюда приходит и подделка
 * из проверок.
 *
 * @param {any} app
 * @returns {any}
 */
function workspaceOf(app) {
  return app && app.workspace && typeof app.workspace === "object" ? app.workspace : null;
}

/**
 * Редактор у вида заметки: прямой или через нынешний режим.
 *
 * @param {any} view вид заметки платформы либо его подделка в проверке
 * @returns {any} редактор или `null`
 */
function editorOfView(view) {
  if (!view) return null;
  if (view.editor) return view.editor;
  if (view.currentMode && view.currentMode.editor) return view.currentMode.editor;
  return null;
}

/**
 * Редактор заметки, в которой человек сейчас стоит.
 *
 * @param {any} app
 * @param {any} [viewCtor] конструктор вида: точка входа передаёт
 *   `require("obsidian").MarkdownView`, движкам его взять неоткуда
 * @returns {any} редактор или `null`
 */
function activeEditorFrom(app, viewCtor) {
  const ws = workspaceOf(app);
  if (!ws) return null;

  /* Конструктор вида — только от точки входа; у движков его нет (Г-6). */
  const ctor = viewCtor || null;
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
};
