/**
 * Справочник команд — `renderCommandReference` (PRD 10.5, К-1–К-4).
 *
 * **Почему список собирается, а не выписывается.** К-1 просит все команды
 * плагина, а их набор зависит от данных: у каждого Field пара команд, у каждой
 * строки Binder своя, у каждого модуля тумблер. Выписанный список разошёлся бы
 * с реестром на первом же новом Field, и разошёлся бы молча — в таблице, к
 * которой человек приходит именно затем, чтобы узнать правду. Поэтому строки
 * приходит перечислить сам плагин (`listOwnCommands`), а описания берутся из
 * прототипа (`COMMAND_TEXTS`, генерируется).
 *
 * **Ни одного ID команды в UI** (К-1). Идентификатор нужен только менеджеру
 * хоткеев, и туда он уходит не глазами человека.
 *
 * **Колонка хоткея — приватное API, и это единственное разрешённое исключение**
 * (К-2, 7.2). `app.hotkeyManager` и `app.setting` не объявлены в
 * `obsidian.d.ts`: всё в `hotkeys.ts` проверяется на наличие и обёрнуто, а при
 * отказе кнопка становится неактивной и панель не падает.
 *
 * **Порядок областей — из прототипа, а не по вкладкам.** К-4 говорит «в том же
 * порядке, что вкладки», но сам прототип (Р8) идёт иначе: Navigation, Tags &
 * PKM, Config, Transform, Binder, General. Прототип нормативен, поэтому порядок
 * взят у него; расхождение записано в 10.5.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, btn, type El } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { COMMAND_TEXTS } from "../schema/custom_texts.ts";
import { commandKey } from "../texts_custom.ts";
import { sayIn } from "../texts_blocks.ts";
import { canOpenHotkeys, hotkeyOf, openHotkeys } from "./hotkeys.ts";

/** Одна команда в том виде, в каком её отдаёт плагин. */
export interface OwnCommand {
  id: string;
  name: string;
  /** Область справочника: имя из прототипа. */
  area: string;
  /**
   * Семья, если команда одна из многих одинаковых. Пусто — команда сама по
   * себе. Значения — те же, что в `main.js`: `field-next`, `field-previous`,
   * `binder-row`, `module-toggle`.
   */
  family: string;
  /**
   * Field, которому команда принадлежит, без приставки `_sub`: по нему
   * команды одного Field собираются рядом (1.2.3.4.3). Пусто у команд, не
   * созданных из Fields.
   */
  group?: string;
  /** Команда дочернего Field: идёт сразу за родительской парой. */
  sub?: boolean;
  /**
   * Подпись Field и его тип для подзаголовка: `task (tag)` (замечание
   * заказчика 2026-08-31). У дочернего Field они те же, что у родителя, —
   * поэтому его команды и стоят под тем же подзаголовком.
   */
  groupLabel?: string;
  kind?: string;
}

interface CommandHost {
  listOwnCommands?: () => readonly OwnCommand[];
}

/**
 * Строки прототипа, которые описывают семью, а не одну команду.
 *
 * Ключ — имя строки в прототипе, значение — семья. Список закрытый: появится
 * ещё одна семья, и проверка заставит вписать её сюда, а не оставит команды без
 * описания.
 */
const FAMILY_BY_ROW: Readonly<Record<string, string>> = {
  "Status next": "field-next",
  "Status previous": "field-previous",
  "<your rows>": "binder-row",
  "Toggle <module> module": "module-toggle",
};

/** Заголовки колонок. Сняты с прототипа, живут в каталоге (10.13.47). */
const HEAD = ["COL_COMMAND", "COL_DOES", "COL_HOTKEY"] as const;

/** Строка справочника: текст прототипа, команда плагина и часть области. */
interface Row {
  row: { name: string; does: string };
  cmd: OwnCommand;
  band: "standard" | "user";
}

/**
 * Подзаголовок Field: подпись и тип, `task (tag)`.
 *
 * Тип называется словом, которым его называет вся панель: `wikilink` внутри
 * конфига — это `link` на экране (7.3). Field без подписи не бывает, но
 * пустая строка здесь возможна у команд, выросших не из Fields, и тогда
 * подзаголовка нет вовсе.
 */
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
 * Порядок строк внутри области, у которой есть две части (10.5, замечания
 * заказчика 1.2.3.4.1–1.2.3.4.3).
 *
 * Сначала стандартные команды — те, что есть всегда, — потом созданные из
 * Fields. Во второй части команды одного Field идут вместе: сам Field, затем
 * его дочерний, и в каждой паре `next` раньше `previous`. Порядок самих
 * Fields не сортируется по алфавиту: он берётся из того, в каком порядке их
 * отдал плагин, а тот идёт по Order из конфига — по тому же порядку, в котором
 * Fields стоят в строке и в TagWheel.
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
  let mounted: El | null = null;

  const draw = (): void => {
    /* Скролл и фокус снимаются до подмены узла и возвращаются после (A8). */
    const keep = keepView(box);
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
    for (const title of HEAD) el(head, "div", undefined, words(title));

    COMMAND_TEXTS.forEach((area, areaAt) => {
      const rows: Row[] = [];
      /*
       * Объяснение команды спрашивается по ключу, а написанное в выгрузке
       * идёт ответом, когда перевода нет (10.13.38, Я4). **Имя команды не
       * переводится** (Я2): его показывает и палитра Obsidian, беря из
       * реестра команд, и два списка одной команды разошлись бы на экране.
       */
      const say = (slot: string, fallback: string): string =>
        (ctx.t ? ctx.t(commandKey(areaAt, slot), fallback) : fallback);

      area.list.forEach((protoRow, rowAt) => {
        const does = say("list." + rowAt + ".does", protoRow.does);
        const family = FAMILY_BY_ROW[protoRow.name];
        if (!family) {
          const cmd = commands.find(c => c.area === area.area && c.name === protoRow.name)
            || commands.find(c => c.name === protoRow.name)
            || null;
          /*
           * Команды нет — строки нет. Так справочник не обещает того, чего в
           * этой сборке не зарегистрировано (З8): например `Open settings`
           * исчезнет отсюда сама, когда её удалят в фазе 6.
           */
          if (cmd) rows.push({ row: { name: protoRow.name, does }, cmd, band: "standard" });
          return;
        }
        /*
         * Семья без единого члена не даёт строки вовсе.
         *
         * До 2026-09-05 на её месте стояла шаблонная строка прототипа —
         * `<your rows>` у Binder, `Status next` у Fields, — с подписью вместо
         * кнопки хоткея: считалось, что иначе человек не узнает, что команды
         * появятся. В свежем vault заказчик увидел `<your rows>` среди команд
         * и сказал: «убери её, должны быть только команды, которые есть в
         * Binder». Это то же З8: справочник называет то, что зарегистрировано,
         * и ничего сверх того.
         */
        const members = commands.filter(c => c.family === family);
        if (!members.length) return;
        for (const cmd of members) {
          rows.push({ row: { name: cmd.name, does }, cmd, band: "user" });
        }
      });

      if (!rows.length) return;
      el(inner, "div", "io-cmd__area", say("area", area.area));

      /*
       * Область делится на две части там, где прототип дал им подписи:
       * стандартные команды и созданные из Fields. Стандартные идут выше
       * (замечания заказчика 1.2.3.4.1 и 1.2.3.4.2); внутри второй части
       * команды одного Field стоят рядом, дочерние сразу за родительскими
       * (1.2.3.4.3) — порядок Fields при этом тот, что в конфиге.
       */
      const ordered = area.parts ? splitAndGroup(rows) : rows;
      let part = "";
      let field = "";

      for (const { row, cmd, band } of ordered) {
        if (area.parts && band && band !== part) {
          part = band;
          field = "";
          el(inner, "div", "io-cmd__sub", band === "user"
            ? say("parts.user", area.parts.user)
            : say("parts.standard", area.parts.standard));
        }
        /*
         * Свой подзаголовок на каждый Field (замечание заказчика 2026-08-31):
         * рядом стоящих пар мало, когда Fields много — по списку всё равно
         * не видно, где кончается один Field и начинается другой.
         */
        if (area.parts) {
          const heading = fieldHeading(cmd);
          if (heading !== field) {
            field = heading;
            if (heading) el(inner, "div", "io-cmd__field", heading);
          }
        }
        const line = el(inner, "div", "io-cmd__row");
        el(line, "div", "io-cmd__name", row.name);
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

  /*
   * Перерисовка по данным, из которых собран список: Fields дают команды полей,
   * строки Binder — свои, тумблеры модулей — свои. Хоткей при этом не наш: его
   * меняют в настройках Obsidian, и узнать об этом мы не можем — колонка
   * обновится на следующем открытии панели.
   */
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
    box.empty();
  };
};
