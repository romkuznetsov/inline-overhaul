/**
 * Справочник команд — `renderCommandReference` (PRD 10.5, К-1–К-4).
 *
 * Список собирается из плагина (`listOwnCommands`), а не выписывается: набор
 * зависит от Fields, Binder и модулей. Описания — из прототипа (`COMMAND_TEXTS`).
 * ID команды в UI не показывается (К-1). Колонка хоткея — приватное API,
 * единственное исключение (К-2, 7.2): всё в `hotkeys.ts` проверено и обёрнуто.
 * Порядок областей — из прототипа (Р8), не по вкладкам; расхождение — в 10.5.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, btn, tipBelow, type El } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { COMMAND_TEXTS } from "../schema/custom_texts.ts";
import { commandKey } from "../texts_custom.ts";
import { sayIn } from "../texts_blocks.ts";
import { canOpenHotkeys, hotkeyOf, openHotkeys, hotkeyQueryFor, pluginScope } from "./hotkeys.ts";

/** Одна команда в том виде, в каком её отдаёт плагин. */
export interface OwnCommand {
  id: string;
  name: string;
  /**
   * Имя без области (пункт 6, 2026-09-22): область уже в заголовке. Считает
   * `buildOwnCommandList` рядом с `commandShortName`. Поле обязательное нарочно —
   * запасное `|| name` молча вернуло бы прежний вид (У-237).
   */
  short: string;
  /** Область справочника: имя из прототипа. */
  area: string;
  /** Семья однотипных команд (`field-next`, `field-previous`, `binder-row`, `module-toggle`, как в `main.js`); пусто — одиночная. */
  family: string;
  /** Field команды без `_sub`: по нему команды одного Field собираются рядом (1.2.3.4.3). */
  group?: string;
  /** Команда дочернего Field: идёт сразу за родительской парой. */
  sub?: boolean;
  /** Подпись и тип Field для подзаголовка, `task (tag)` (2026-08-31); у дочернего — как у родителя. */
  groupLabel?: string;
  kind?: string;
}

interface CommandHost {
  listOwnCommands?: () => readonly OwnCommand[];
}

/** Строки прототипа, описывающие семью. Список закрытый: новую семью проверка заставит вписать. */
const FAMILY_BY_ROW: Readonly<Record<string, string>> = {
  "Status next": "field-next",
  "Status previous": "field-previous",
  "<your rows>": "binder-row",
  "Toggle <module> module": "module-toggle",
  /* Команда custom block — по одной на блок (PRD 10.13.260). */
  "tagWheel <block>": "tagwheel-custom",
};

/** Заголовки колонок и их подсказки, из каталога (10.13.47); тело — в слот под шапкой. */
const HEAD = [
  ["COL_COMMAND", "COL_COMMAND_TIP"],
  ["COL_DOES", "COL_DOES_TIP"],
  ["COL_HOTKEY", "COL_HOTKEY_TIP"],
] as const;

/** Строка справочника: текст прототипа, команда плагина и часть области. */
interface Row {
  row: { name: string; does: string };
  cmd: OwnCommand;
  band: "standard" | "user";
}

/** Слово типа — как на всей панели (`wikilink` → `link`, 7.3). Пустая подпись — подзаголовка нет. */
const KIND_WORD: Readonly<Record<string, string>> = {
  tag: "tag",
  wikilink: "link",
  link: "link",
  element: "element",
};

export function fieldHeading(cmd: OwnCommand | null): string {
  const label = String(cmd && cmd.groupLabel ? cmd.groupLabel : "").trim();
  if (!label) return "";
  const kind = KIND_WORD[String(cmd && cmd.kind ? cmd.kind : "").trim().toLowerCase()];
  return kind ? label + " (" + kind + ")" : label;
}

/**
 * Порядок в области из двух частей (10.5, 1.2.3.4.1–1.2.3.4.3): сначала
 * стандартные, потом из Fields; команды одного Field вместе, дочерний следом,
 * `next` раньше `previous`. Fields — в порядке конфига, не по алфавиту.
 */
function splitAndGroup(rows: readonly Row[]): readonly Row[] {
  const standard = rows.filter(r => r.band === "standard");
  const user = rows.filter(r => r.band === "user");

  /* Порядок Fields — порядок первого появления, а не алфавит. */
  const groups: string[] = [];
  for (const r of user) {
    const g = String(r.cmd && r.cmd.group ? r.cmd.group : "");
    if (!groups.includes(g)) groups.push(g);
  }
  const rank = (r: Row): number => {
    const g = String(r.cmd && r.cmd.group ? r.cmd.group : "");
    const sub = r.cmd && r.cmd.sub ? 1 : 0;
    const back = r.cmd && r.cmd.family === "field-previous" ? 1 : 0;
    return groups.indexOf(g) * 4 + sub * 2 + back;
  };
  /* Устойчивая сортировка: у строк с одинаковым весом порядок прежний. */
  const sorted = user
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (rank(a.r) - rank(b.r)) || (a.i - b.i))
    .map(x => x.r);

  return standard.concat(sorted);
}

export const commandReference: CustomRender = (host: El, ctx: SettingsCtx) => {
  const words = sayIn("command-list", ctx);
  const box = el(host, "div", "io-cmdblock");
  const platform = ctx.platform;

  /* Без платформы спрашивать команды не у кого: набор живёт в плагине. */
  if (!platform) return () => { box.empty(); };

  const plugin = platform.plugin as CommandHost & Record<string, unknown>;
  const canOpen = canOpenHotkeys(plugin);
  const showTips = Boolean(ctx.get("general.help.showTips"));
  const showIds = Boolean(ctx.get("advanced.showSettingIds"));
  let mounted: El | null = null;
  /* Снятие открытых подсказок: очистка блока убирает всё, что он завёл (С5). */
  let tipClosers: Array<() => void> = [];
  const dropTips = (): void => {
    for (const close of tipClosers) { try { close(); } catch { /* узла уже нет */ } }
    tipClosers = [];
  };

  const draw = (): void => {
    /* Скролл и фокус снимаются до подмены узла и возвращаются после (A8). */
    const keep = keepView(box);
    dropTips();
    const next = el(box, "div", "io-cmdblock__mount");
    try {
      fill(next);
    } catch (e) {
      next.remove();
      console.error("inline-overhaul: справочник команд не отрисовался", e);
      return;
    }
    if (mounted) mounted.remove();
    mounted = next;
    keep.restore();
  };

  const fill = (mount: El): void => {
    const commands = typeof plugin.listOwnCommands === "function"
      ? plugin.listOwnCommands()
      : [];

    const scroll = el(mount, "div", "io-scroll");
    const card = el(scroll, "div", "io-cmd");
    const inner = el(card, "div", "io-cmd__inner");

    const head = el(inner, "div", "io-cmd__head");
    const headTips = el(inner, "div", "io-tabletipslot");
    for (const [title, tipName] of HEAD) {
      const cell = el(head, "div", undefined);
      el(cell, "span", "io-tablehead__text", words(title));
      tipClosers.push(tipBelow({
        head: cell,
        host: headTips,
        text: words(tipName),
        label: words(title),
        id: "io-cmd-col-" + title.toLowerCase().replace(/_/g, "-") + "-tip",
        showTips, showIds,
      }));
    }

    /*
     * Кнопка заголовка `to hotkeys` (2026-09-20, пункт 12.3): запрос на все команды
     * заголовка, считается по настоящему списку. Цвет — по уровню заголовка.
     */
    const scope = pluginScope(plugin);
    const jump = (host: El, level: string, title: string, members: readonly OwnCommand[]): void => {
      if (!members.length) return;
      const query = hotkeyQueryFor(scope, members, commands);
      const go = btn(host, "io-tohk io-tohk--" + level, {
        text: words("TO_HOTKEYS"),
        label: words("TO_HOTKEYS_LABEL", title, query),
      });
      go.disabled = !canOpen;
      go.addEventListener("click", (() => {
        if (canOpen) openHotkeys(plugin, query);
      }) as never);
    };

    COMMAND_TEXTS.forEach((area, areaAt) => {
      const rows: Row[] = [];
      /* Объяснение — по ключу, выгрузка как запасной ответ (10.13.38, Я4). Имя команды не переводится (Я2): его показывает и палитра. */
      const say = (slot: string, fallback: string): string =>
        (ctx.t ? ctx.t(commandKey(areaAt, slot), fallback) : fallback);

      area.list.forEach((protoRow, rowAt) => {
        const does = say("list." + rowAt + ".does", protoRow.does);
        const family = FAMILY_BY_ROW[protoRow.name];
        if (!family) {
          /*
           * В прототипе имя без области, плагин регистрирует с областью (2026-09-20):
           * ищем по обеим формам, показываем палитровую (У-240).
           */
          const full = area.area + ": " + protoRow.name;
          const cmd = commands.find(c => c.area === area.area && c.name === full)
            || commands.find(c => c.name === full)
            || commands.find(c => c.area === area.area && c.name === protoRow.name)
            || commands.find(c => c.name === protoRow.name)
            || null;
          /* Команды нет — строки нет: справочник не обещает незарегистрированного (З8). */
          if (cmd) rows.push({ row: { name: cmd.name, does }, cmd, band: "standard" });
          return;
        }
        /* Семья без членов строки не даёт — без шаблонных строк прототипа (З8, 2026-09-05). */
        const members = commands.filter(c => c.family === family);
        if (!members.length) return;
        /* Custom block — стандартная, последней в своей части (2026-09-24): среди Fields читалась командой последнего Field. */
        const band = family === "tagwheel-custom" ? "standard" : "user";
        for (const cmd of members) {
          rows.push({ row: { name: cmd.name, does }, cmd, band });
        }
      });

      if (!rows.length) return;
      const areaTitle = say("area", area.area);
      const areaRow = el(inner, "div", "io-cmd__area");
      el(areaRow, "span", undefined, areaTitle);
      jump(areaRow, "area", areaTitle, rows.map(r => r.cmd));

      /* Две части там, где прототип дал подписи: стандартные выше (1.2.3.4.1, 1.2.3.4.2), Field с дочерним рядом (1.2.3.4.3). */
      const ordered = area.parts ? splitAndGroup(rows) : rows;
      let part = "";
      let field = "";

      for (const { row, cmd, band } of ordered) {
        if (area.parts && band && band !== part) {
          part = band;
          field = "";
          /* Подпись части — строка целиком: «?» в ней самой, тело сразу под ней (2026-09-08). */
          const user = band === "user";
          const sub = el(inner, "div", "io-cmd__sub");
          const text = user
            ? say("parts.user", area.parts.user)
            : say("parts.standard", area.parts.standard);
          el(sub, "span", undefined, text);
          /* Слот сразу за подписью: `tipBelow` дописывает в конец хозяина, иначе подсказка уйдёт под таблицу. */
          const slot = el(inner, "div", "io-tabletipslot");
          tipClosers.push(tipBelow({
            head: sub,
            host: slot,
            text: words(user ? "PART_USER_TIP" : "PART_STANDARD_TIP"),
            label: text,
            id: "io-cmd-part-" + (user ? "user" : "standard") + "-" + areaAt + "-tip",
            showTips, showIds,
          }));
          /* Кнопка последней: `margin-left: auto` уводит вправо и всё после неё, а «?» принадлежит подписи. */
          jump(sub, "part", text, ordered.filter(r => r.band === band).map(r => r.cmd));
        }
        /* Свой подзаголовок на каждый Field (2026-08-31): иначе границ Fields не видно. */
        if (area.parts) {
          const heading = fieldHeading(cmd);
          if (heading !== field) {
            field = heading;
            if (heading) {
              const head = el(inner, "div", "io-cmd__field");
              el(head, "span", undefined, heading);
              jump(head, "field", heading, ordered
                .filter(r => r.band === band && fieldHeading(r.cmd) === heading)
                .map(r => r.cmd));
            }
          }
        }
        const line = el(inner, "div", "io-cmd__row");
        /* Имя без области (пункт 6, 2026-09-22); полное — у кнопки хоткея и в запросе `Hotkeys` (У-240). */
        el(line, "div", "io-cmd__name", cmd.short);
        el(line, "div", "io-cmd__does", row.does);
        const cell = el(line, "div");

        const current = hotkeyOf(plugin, cmd.id);
        const hk = btn(cell, "io-hk" + (current ? "" : " io-hk--none"), {
          text: current || words("HOTKEY_NOT_SET"),
          label: words(current ? "HOTKEY_CHANGE" : "HOTKEY_ASSIGN", row.name),
          title: words("HOTKEY_OPEN"),
        });
        /* Приватного API нет — кнопке некуда вести, и она неактивна (К-2). */
        hk.disabled = !canOpen;
        hk.addEventListener("click", (() => {
          if (canOpen) openHotkeys(plugin, row.name);
        }) as never);
      }
    });
  };

  draw();

  /* Перерисовка по Fields, Binder и тумблерам модулей. Хоткей меняется в Obsidian без события — колонка обновится при следующем открытии. */
  const stop = ctx.watch([
    "pkm.fields.order",
    "editor.binder.rows",
    "features.navigation.enabled",
    "features.pkm.enabled",
    "features.visual.enabled",
    "features.transform.enabled",
  ], draw);

  return () => {
    stop();
    dropTips();
    box.empty();
  };
};
