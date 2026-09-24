"use strict";

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..", "..");
const dist = path.join(root, "dist");

/*
 * Заметки выпуска — **до** сборки: окно «что изменилось» читает их литеральным
 * `require`, и в бандл они попадают только отсюда. Разбор — в
 * `build/gen_release_notes.js`, там же сказано, почему текст не читается на
 * ходу.
 */
require("./gen_release_notes.js").writeReleaseNotes(root);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

esbuild.buildSync({
  /*
   * Точка входа — сам `main.js`. Раньше между ним и сборщиком стоял
   * `release_entry.js`: он собирал реестр плагин-локальных модулей, чтобы
   * мост находил модуль по пути внутри vault, не читая сам vault. Моста
   * больше нет, модули приезжают литеральным `require` (У-89), и реестр
   * вместе с ним ушёл.
   */
  entryPoints: [path.join(root, "src", "main.js")],
  bundle: true,
  outfile: path.join(dist, "main.js"),
  platform: "node",
  format: "cjs",
  target: "es2018",
  resolveExtensions: [".ts", ".js", ".json"],   // фаза 0: новый код на TS
  /* `@codemirror/language` — дерево разбора Obsidian: тег спрашивается у него
     (10.13.266). Obsidian отдаёт этот модуль плагинам так же, как два прежних. */
  external: ["obsidian", "@codemirror/view", "@codemirror/state", "@codemirror/language"],
  legalComments: "none",
  logLevel: "info",
});

fs.copyFileSync(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
const styles = path.join(root, "src", "styles.css");
if (fs.existsSync(styles)) fs.copyFileSync(styles, path.join(dist, "styles.css"));
