/**
 * Субхедер внутри группы настроек (2026-09-04). Свой блок через `render`:
 * строку без `name`/`render`/`control`/`action` платформа не рисует (У-44).
 * Тексты — из прототипа через `gen:schema`. Свой «?» с пином в
 * `settings_layer_tests.ts`, Г20 его не касается (У-43).
 *
 * Сворачивается (2026-09-22) знаком `.io-fold`, общим с группами (У-32).
 * Прячутся соседи до следующего субхедера или заголовка группы: обёртка
 * отняла бы у платформы отрисовку строк.
 *
 * При `render` соседей ниже ещё нет, поэтому красильщик ждёт
 * `SettingsPane.paintSubheaders` (не `setTimeout` — У-212); микрозадача — для
 * живой панели, у платформы нет шва «дорисовала».
 */

import type { SettingsCtx } from "../types.ts";
import { btn, el, tipBelow, type El } from "./dom.ts";

/** Свёрнутые субхедеры — состояние взгляда: не в конфиге и не в отмене. */
const SHUT = new Set<string>();

/** Красильщики, ждущие, пока панель дорисуется. */
let pending: Array<() => void> = [];

/** Ключ субхедера: id подсказки в `Diagnostics`, ключ свёртки и проверки (У-32). */
export function subheaderId(label: string): string {
  return "io-tip-sub-" + String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Свёрнут ли субхедер. Нужно проверке: своего состояния у неё нет. */
export function isSubheaderShut(id: string): boolean {
  return SHUT.has(id);
}

/** Раскрыть все субхедеры. Нужно проверке: состояние живёт дольше панели. */
export function resetSubheaders(): void {
  SHUT.clear();
  pending = [];
}

/** Покрасить отрисованные с прошлого раза; отцеплённый узел — no-op. */
export function paintSubheaders(): void {
  const run = pending;
  pending = [];
  for (const paint of run) paint();
}

/** Строки раздела: до следующего субхедера или заголовка группы. */
function bodyOf(host: El): El[] {
  const parent = host.parentElement;
  const kids = parent ? parent.children : null;
  if (!kids || typeof kids.length !== "number") return [];
  const out: El[] = [];
  let seen = false;
  for (let i = 0; i < kids.length; i++) {
    const node = kids[i] as El;
    if (node === host) { seen = true; continue; }
    if (!seen) continue;
    const cls = node.classList;
    if (cls && typeof cls.contains === "function") {
      if (cls.contains("io-custom--sub")) break;
      if (cls.contains("setting-item-heading")) break;
    }
    out.push(node);
  }
  return out;
}

/** Микрозадача, если она есть. Нет — красит нажатие и `paintSubheaders`. */
function soon(fn: () => void): void {
  const g = globalThis as unknown as {
    queueMicrotask?: (f: () => void) => void;
    setTimeout?: (f: () => void, ms: number) => unknown;
  };
  if (typeof g.queueMicrotask === "function") { g.queueMicrotask(fn); return; }
  if (typeof g.setTimeout === "function") { g.setTimeout(fn, 0); return; }
  /* Только голая заглушка проверки: там красит `paintSubheaders`. */
}

export function subheader(label: string, tip?: string): (host: El, ctx: SettingsCtx) => () => void {
  return (host: El, ctx: SettingsCtx): (() => void) => {
    /* Подпись своим узлом в строке: «?» встаёт рядом, как у заголовка группы. */
    /* Пометка на вместилище прижимает субхедер к строкам под ним
       (2026-09-17); вторая отрисовка — прототип (правило 41). */
    if (host.classList) host.classList.add("io-custom--sub");
    const row = el(host, "div", "io-sub io-sub--group");
    const id = subheaderId(label);
    /* Знак до подписи; `order: -1` держит его слева и при позднем «?». */
    const mark = btn(row, "io-fold", { text: "", label: "" });
    el(row, "span", "io-sub__text", label);

    const paint = (): void => {
      const shut = SHUT.has(id);
      mark.textContent = shut ? "▸" : "▾";
      if (mark.classList && typeof mark.classList.add === "function") {
        if (shut) mark.classList.add("io-fold--shut");
        else mark.classList.remove("io-fold--shut");
      }
      mark.setAttribute("aria-expanded", shut ? "false" : "true");
      mark.setAttribute("aria-label", (shut ? "Expand " : "Collapse ") + label);
      for (const node of bodyOf(host)) {
        if (!node.classList || typeof node.classList.add !== "function") continue;
        if (shut) node.classList.add("io-subshut");
        else node.classList.remove("io-subshut");
      }
    };

    mark.addEventListener("click", (() => {
      if (SHUT.has(id)) SHUT.delete(id);
      else SHUT.add(id);
      paint();
    }) as never);

    paint();
    pending.push(paint);
    soon(paintSubheaders);

    /* Подсказка под строкой субхедера: внутри узкой строки она её разорвёт. */
    return tipBelow({
      head: row,
      host,
      text: String(tip || ""),
      label,
      id,
      showTips: Boolean(ctx.get("general.help.showTips")),
      showIds: Boolean(ctx.get("advanced.showSettingIds")),
    });
  };
}
