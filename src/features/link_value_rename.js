"use strict";

/**
 * Value-ссылка идёт за переименованной заметкой (`В-238`, BUGHUNT F16):
 * Obsidian переписывает ссылки в заметках, а Value живёт в настройках.
 * Адрес Value — как в ссылке: с папкой — путь без `.md`, без папки — имя
 * (узнаётся, только если заметка была в корне). Новое пишется той же формой.
 * Заодно: `allowedParentValues`, `visual.tags.byTag` (ключ `[[адрес]]`),
 * `checkboxByFieldValue`; вид ссылки — `wikilinkLineToken` общего дома.
 */

const __sharedUtils = require("../core/shared_utils.js");

function isObj(x) { return __sharedUtils.isObj(x); }

/** `папка/имя.md` → `папка/имя`; корень — просто `имя`. */
function targetOfPath(path) {
  return String(path || "").replace(/\\/g, "/").replace(/\.md$/i, "");
}

function nameOf(target) {
  const t = String(target || "");
  const at = t.lastIndexOf("/");
  return at < 0 ? t : t.slice(at + 1);
}

/** Новый адрес Value, если это Value переименованной заметки; иначе `null`. */
function renamedToken(token, oldTarget, newTarget) {
  const t = String(token || "").trim();
  if (!t) return null;
  if (t.includes("/")) return t === oldTarget ? newTarget : null;
  if (oldTarget.includes("/") || t !== oldTarget) return null;
  return newTarget.includes("/") ? newTarget : nameOf(newTarget);
}

/**
 * Патч настроек для переименования, или `null` — переименовывать нечего.
 * `oldPath` и `newPath` — пути файлов, как их отдаёт событие `rename` vault.
 */
function planLinkValueRename(cfg, oldPath, newPath) {
  if (!/\.md$/i.test(String(oldPath || "")) || !/\.md$/i.test(String(newPath || ""))) return null;
  const oldTarget = targetOfPath(oldPath);
  const newTarget = targetOfPath(newPath);
  if (!oldTarget || !newTarget || oldTarget === newTarget) return null;
  const links = isObj(cfg && cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.links) ? cfg.pkm.fields.links : null;
  const fields = links && Array.isArray(links.fields) ? links.fields : [];
  const map = {};
  const nextFields = fields.map((f) => {
    if (!isObj(f) || !String(f.source || "").startsWith("wikilinks:")) return f;
    const values = Array.isArray(f.values) ? f.values : [];
    let touched = false;
    const nextValues = values.map((v) => {
      const token = isObj(v) ? v.token : v;
      const next = renamedToken(token, oldTarget, newTarget);
      if (next === null) return v;
      touched = true;
      map[String(token).trim()] = next;
      return isObj(v) ? Object.assign({}, v, { token: next }) : next;
    });
    return touched ? Object.assign({}, f, { values: nextValues }) : f;
  });
  const renamed = Object.keys(map);
  if (!renamed.length) return null;
  /* Родитель у дочерних Value — тем же адресом. */
  const finalFields = nextFields.map((f) => {
    if (!isObj(f) || !Array.isArray(f.values)) return f;
    let touched = false;
    const values = f.values.map((v) => {
      if (!isObj(v) || !Array.isArray(v.allowedParentValues)) return v;
      const parents = v.allowedParentValues.map((p) => (Object.prototype.hasOwnProperty.call(map, String(p)) ? map[String(p)] : p));
      if (parents.every((p, i) => p === v.allowedParentValues[i])) return v;
      touched = true;
      return Object.assign({}, v, { allowedParentValues: parents });
    });
    return touched ? Object.assign({}, f, { values }) : f;
  });
  const patch = { pkm: { fields: { links: { fields: finalFields } } } };
  /* Вид в строке: ключ `[[адрес]]`, прежний уходит надгробием. */
  const byTag = isObj(cfg.visual && cfg.visual.tags && cfg.visual.tags.byTag) ? cfg.visual.tags.byTag : {};
  const byTagPatch = {};
  for (const oldTok of renamed) {
    const oldKey = "[[" + oldTok + "]]";
    if (!Object.prototype.hasOwnProperty.call(byTag, oldKey)) continue;
    byTagPatch["[[" + map[oldTok] + "]]"] = byTag[oldKey];
    byTagPatch[oldKey] = null;
  }
  if (Object.keys(byTagPatch).length) patch.visual = { tags: { byTag: byTagPatch } };
  /* Чекбокс Value — тем же адресом. */
  const boxes = isObj(cfg.pkm && cfg.pkm.prefixRules && cfg.pkm.prefixRules.checkboxByFieldValue) ? cfg.pkm.prefixRules.checkboxByFieldValue : {};
  const boxPatch = {};
  for (const fid of Object.keys(boxes)) {
    const row = boxes[fid];
    if (!isObj(row)) continue;
    for (const oldTok of renamed) {
      if (!Object.prototype.hasOwnProperty.call(row, oldTok)) continue;
      boxPatch[fid] = Object.assign(boxPatch[fid] || {}, { [map[oldTok]]: row[oldTok], [oldTok]: null });
    }
  }
  if (Object.keys(boxPatch).length) patch.pkm.prefixRules = { checkboxByFieldValue: boxPatch };
  return { patch, renamed: map };
}

/** Подписка на переименование заметок: звавший — загрузка плагина. */
function followNoteRenames(plugin) {
  const vault = plugin && plugin.app && plugin.app.vault;
  if (!vault || typeof vault.on !== "function" || typeof plugin.registerEvent !== "function") return;
  plugin.registerEvent(vault.on("rename", (file, oldPath) => {
    try {
      const plan = planLinkValueRename(plugin.getConfig(), oldPath, file && file.path);
      if (plan) plugin.setConfigPatch(plan.patch, "pkm:link-value-rename");
    } catch (e) {
      console.error("[inline-overhaul] link value rename", e);
    }
  }));
}

/** Адрес Value: `[[Archive/Old|Old]]`, `[[Old]]` и `Old` дают `Archive/Old` и `Old`. */
function valueTarget(token) {
  const t = String(token || "").trim();
  return __sharedUtils.wikilinkTargetOf(t) || t;
}

/**
 * Цена переименования Value-ссылки в панели (2026-09-27, тест 7 цикла 97);
 * считает платформа:
 * - `note` — есть заметка (`getFirstLinkpathDest`); переименовать в `newPath`,
 *   Obsidian перепишет `links` ссылок в `notes` заметках (`resolvedLinks`);
 * - `clash` — новое имя занято;
 * - `none` — заметки нет, ссылки неразрешённые (`unresolvedLinks`).
 * `null` — адрес не сменился (`Old` → `[[Old]]`).
 */
function linkValueRenameImpact(app, oldToken, newToken) {
  const oldTarget = valueTarget(oldToken);
  const newTarget = valueTarget(newToken);
  if (!oldTarget || !newTarget || oldTarget === newTarget) return null;
  const cache = app && app.metadataCache;
  const file = cache && typeof cache.getFirstLinkpathDest === "function" ? cache.getFirstLinkpathDest(oldTarget, "") : null;
  const count = (table, key) => {
    let links = 0;
    let notes = 0;
    for (const src of Object.keys(table || {})) {
      const n = Number((table[src] || {})[key] || 0);
      if (n > 0) { links += n; notes += 1; }
    }
    return { links, notes };
  };
  if (!file) {
    const c = count(cache && cache.unresolvedLinks, oldTarget);
    return { kind: "none", oldTarget, newTarget, links: c.links, notes: c.notes };
  }
  /* Новое имя без папки остаётся в папке заметки; с папкой — путь как написан. */
  const folder = file.parent && file.parent.path && file.parent.path !== "/" ? file.parent.path + "/" : "";
  const newPath = (newTarget.includes("/") ? newTarget : folder + newTarget) + ".md";
  const c = count(cache.resolvedLinks, file.path);
  const taken = app.vault && typeof app.vault.getAbstractFileByPath === "function" && app.vault.getAbstractFileByPath(newPath);
  return { kind: taken ? "clash" : "note", oldTarget, newTarget, file, newPath, links: c.links, notes: c.notes };
}

module.exports = { planLinkValueRename, followNoteRenames, linkValueRenameImpact };
