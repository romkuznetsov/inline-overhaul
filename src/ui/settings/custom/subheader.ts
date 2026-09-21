/**
 * Субхедер внутри группы настроек.
 *
 * Замечание заказчика 2026-09-04: группа `Move left and move right` держит два
 * разных дела — перенос выделенного текста и работу с самой строкой, — и на
 * глаз они слитые. Подпись делит группу пополам.
 *
 * Почему это свой блок, а не вид контрола. За субхедером нет ни настройки, ни
 * пути в конфиге, а строку без `name`, `render`, `control` и `action`
 * платформа не рисует вовсе (У-44). `render` — единственный способ положить в
 * группу узел, который ничем не управляет; заодно вёрстка остаётся нашей и
 * совпадает с прототипом (`.io-sub--group`).
 *
 * Подпись и подсказка приходят аргументами из прототипа через `gen:schema`,
 * руками не пишутся.
 *
 * **«?» у субхедера — не «?» у группы.** Гейт Г20 держит подсказку в строке
 * заголовка группы, а субхедер — свой блок внутри группы, и её правило его не
 * касается: у него свой пин (`settings_layer_tests.ts`, раздел про
 * субхедеры). Кнопка там нажимается по-настоящему — подделка, выбрасывающая
 * обработчик, доказывает размещение и молчит про нажатие (У-43).
 *
 * **Субхедер сворачивается — его пункт 1, 2026-09-22:** «субхедеры
 * io-tip-sub-line-view, io-tip-sub-tag-view и io-tip-sub-link-view
 * сворачиваемыми (треугольником). Если так сделать можно, хочу, чтобы все
 * субхедеры были сворачиваемыми». Знак тот же `.io-fold`, что у заголовка
 * группы и у разделов правой колонки Fields, и правило его вида объявлено
 * один раз (У-32).
 *
 * **Прячется не обёртка, а соседи.** Подпись и строки под ней лежат в группе
 * братьями: обернуть раздел в свой узел значило бы отнять у платформы
 * отрисовку строк. Конец раздела спрашивается у самой разметки — следующий
 * субхедер или заголовок группы, — а не задаётся списком.
 *
 * **Красится не при отрисовке: раздела ещё нет.** Платформа строит строки по
 * очереди, и в тот миг, когда зовут наш `render`, соседей ниже не существует.
 * Поэтому красильщик кладётся в общий список, а зовёт его тот, кто панель
 * собрал, — `SettingsPane.paintSubheaders`. Тот же приём стоит в прототипе, и
 * там он куплен уроком: `setTimeout` дал бы проверку, зелёную только в
 * браузере, — дымовой рендер такта не ждёт (У-212). Микрозадача рядом с ним
 * нужна живой панели: у платформы нет шва «я дорисовала», а нажатие по знаку
 * красит уже само по себе.
 */

import type { SettingsCtx } from "../types.ts";
import { btn, el, tipBelow, type El } from "./dom.ts";

/**
 * Свёрнутые субхедеры. Состояние взгляда, а не настройка: в конфиг не
 * пишется и в отмену не попадает — так же, как свёрнутые заголовки групп и
 * разделы правой колонки Fields.
 */
const SHUT = new Set<string>();

/** Красильщики, ждущие, пока панель дорисуется. */
let pending: Array<() => void> = [];

/**
 * Ключ субхедера. Один на все три дела: идентификатор подсказки, который
 * человек видит в `Advanced → Diagnostics`, ключ свёрнутого состояния и то,
 * чем его спрашивает проверка. Второе объявление разошлось бы молча (У-32).
 */
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

/**
 * Покрасить субхедеры, отрисованные с прошлого раза. Зовётся тем, кто панель
 * собрал; красильщик, чей узел уже отцеплен, не находит соседей и ничего не
 * делает.
 */
export function paintSubheaders(): void {
  const run = pending;
  pending = [];
  for (const paint of run) paint();
}

/**
 * Строки раздела: всё, что стоит за субхедером до следующего субхедера или до
 * заголовка группы.
 */
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
  /* Ни того ни другого не бывает нигде, кроме голой заглушки в проверке: там
     красит `paintSubheaders`, и это не отказ, а другой вход. */
}

export function subheader(label: string, tip?: string): (host: El, ctx: SettingsCtx) => () => void {
  return (host: El, ctx: SettingsCtx): (() => void) => {
    /*
     * Подпись лежит своим узлом внутри строки: «?» встаёт рядом с ней, а не
     * под ней, и строка остаётся одной строкой. Так же устроен заголовок
     * группы.
     */
    /* Субхедер прижимается к тому, что под ним: пометка на вместилище, а не
       общий отступ всех своих блоков (замечание заказчика 2026-09-17, «висят
       в воздухе»). Вторая отрисовка того же — прототип (правило 41). */
    if (host.classList) host.classList.add("io-custom--sub");
    const row = el(host, "div", "io-sub io-sub--group");
    const id = subheaderId(label);
    /* Знак стоит **до** подписи: он создаётся первым, а `order: -1` в стилях
       держит его слева и тогда, когда «?» приезжает последним. */
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

    /*
     * Подсказка открывается **под подписью**: строка подписи узкая, и
     * раскрытие внутри неё растолкало бы её пополам. `tipBelow` кладёт тело
     * последним ребёнком `host` — то есть под всей строкой субхедера.
     */
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
