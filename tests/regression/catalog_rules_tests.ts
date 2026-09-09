/**
 * Правила каталога Obsidian против нынешнего состояния (У-87).
 *
 * **Долг закрыт 2026-09-09.** Раздел 5 `docs/OBSIDIAN_CATALOG_RULES.md`
 * объявлял этот файл 2026-09-08 утром и весь день читался как состояние, а
 * файла не было — ровно тот признак, ради которого написан У-87: гейт,
 * объявленный в документе, может не существовать в коде. Документ теперь
 * описывает состояние, потому что состояние появилось.
 *
 * **Что здесь проверяется.** Сплошной обход рантайма, по утверждению на
 * измеримое правило каталога. Обход, а не список файлов: предмет заводится в
 * любом файле, и рукописный список отстанет от первого же нового модуля
 * (У-111).
 *
 * **Два вида утверждений, и у каждого свой положительный контроль.**
 *
 *   * **Запрет** — «таких мест ноль». Ноль верхнюю границу выполняет лучше
 *     всех, поэтому у запрета контроль не на числе, а **на самом образце**: он
 *     прогоняется по нарочно составленной строке и обязан в ней найтись. Иначе
 *     сломанный образец читался бы как «нарушений нет» (У-88).
 *   * **Бюджет** — «не больше, чем сейчас». Число здесь не цель, а планка:
 *     новое место роняет проверку, разобранное обязано уронить планку тем же
 *     коммитом. Контроль — число **больше нуля**: бюджет, померивший пустоту,
 *     не проверяет ничего.
 *
 * **Числа взяты замером, а не из документа.** Таблица Р7 называла 182
 * инлайновых стиля; 115 из них лежали в мёртвой панели настроек Transform,
 * снятой в тот же день ревизией, и замер даёт 67.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.join(import.meta.dirname, "..", "..");

/** Что рантаймом не является: набор, инструменты, сборка, документы. */
const SKIP = new Set([
  "node_modules", ".git", "dist", "docs", "tests", "tools", "build", "test-vault",
]);

function runtimeFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) { walk(full); continue; }
      if (/\.(js|ts)$/.test(name)) out.push(full);
    }
  };
  walk(repoRoot);
  return out;
}

/**
 * Код без объяснений.
 *
 * Правило каталога — про то, что **исполняется**. Слово `innerHTML` в
 * комментарии, объясняющем, почему его тут нет, нарушением не является, и
 * первая версия такой проверки в этом проекте на своём же объяснении и
 * краснела.
 */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter(line => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

interface Rule {
  /** Как правило называется в разговоре с заказчиком. */
  readonly what: string;
  readonly rx: RegExp;
  /**
   * `0` — запрет; число больше нуля — бюджет «не больше, чем сейчас».
   */
  readonly ceiling: number;
  /** Строка, в которой образец **обязан** найтись: контроль запрета. */
  readonly control: string;
  /** Почему бюджет именно такой: без этого он переживёт свою причину. */
  readonly why: string;
}

const RULES: readonly Rule[] = [
  {
    what: "разметка строкой (innerHTML и родня)",
    rx: /\.(innerHTML|outerHTML|insertAdjacentHTML)\b/g,
    ceiling: 0,
    control: 'node.innerHTML = "<b>";',
    why: "Р1 закрыт 2026-09-08: оверлей скроллера собирает узлы, а не строку",
  },
  {
    what: "исполнение кода из строки",
    rx: /(?:new\s+Function\s*\(|\beval\s*\()/g,
    ceiling: 0,
    control: "const f = new Function(src);",
    why: "A1: модули подключаются литеральным require, и заглушек на их месте нет",
  },
  {
    what: "запись в чужую заметку через vault.modify",
    rx: /\bvault\.modify\s*\(/g,
    ceiling: 0,
    control: "await app.vault.modify(file, text);",
    why: "Р8 закрыт 2026-09-08: запись идёт одним ходом vault.process",
  },
  {
    what: "оформление строкой атрибута",
    rx: /setAttribute\(\s*["']style["']/g,
    ceiling: 0,
    control: 'el.setAttribute("style", "color: red");',
    why: "такого в проекте не было ни разу; правило держит планку на нуле",
  },
  {
    what: "innerText вместо textContent",
    rx: /\.innerText\b/g,
    ceiling: 0,
    control: "el.innerText = name;",
    why: "innerText заставляет платформу считать вёрстку; textContent — нет",
  },
  {
    what: "слушатель на document мимо registerDomEvent",
    rx: /document\.addEventListener\s*\(/g,
    ceiling: 0,
    control: 'document.addEventListener("keydown", onKey);',
    why: "таких мест нет; слушатели живут на своих узлах и снимаются с ними",
  },
  {
    what: "слушатель на window мимо registerDomEvent",
    rx: /window\.addEventListener\s*\(/g,
    ceiling: 1,
    control: 'window.addEventListener("resize", onResize);',
    why: "Б3: одно место в панели TagWheel под З3, и снимает его выгрузка "
      + "(тридцать третье исключение). Разобрано и оставлено нарочно",
  },
  {
    what: "печать в консоль журналом разработчика",
    rx: /\bconsole\.log\s*\(/g,
    ceiling: 8,
    control: "console.log(line);",
    why: "Р2: разбор 2026-09-08 назвал все места законными — окно отладки "
      + "полос (`strip_debug_api.js`) и одна печать в панели TagWheel",
  },
  {
    what: "activeLeaf вместо активного редактора",
    rx: /\bactiveLeaf\b/g,
    ceiling: 6,
    control: "const view = ws.activeLeaf.view;",
    why: "Р6: пять мест, все под З3, плюс запасной путь в панели TagWheel. "
      + "Правка ждёт разрешения заказчика (У-9)",
  },
  {
    what: "чтение заметки через vault.read",
    rx: /\bvault\.read\s*\(/g,
    ceiling: 6,
    control: "const text = await app.vault.read(file);",
    why: "чтение перед записью — законное; каталог требует cachedRead только "
      + "там, где читают для показа",
  },
];

/**
 * Инлайновое оформление — правило Р7, и у него **две** планки, а не одна.
 *
 * Разбор «величина или оформление» сделан 2026-09-09, и он и есть половина
 * работы, которую назвал документ. Признак механический: что стоит справа от
 * знака равенства. Литерал в кавычках — оформление, и оно переносится в класс.
 * Шаблон, переменная, арифметика — вычисленная величина: значение известно
 * только во время отрисовки, и в класс оно не переносится вовсе.
 *
 * Планка у оформления затем и стоит, чтобы **опускаться**: 48 мест названы
 * пофайлово в `docs/OBSIDIAN_CATALOG_RULES.md`, Р7.
 */
const STYLE_LOOK_CEILING = 0;
const STYLE_VALUE_CEILING = 4;

/**
 * Строки, на которых разбор **обязан** сработать: контроль на известном примере.
 *
 * Он понадобился, как только планка оформления дошла до нуля. Прежде контролем
 * служило «в рантайме есть хотя бы одно оформление и хотя бы одна величина», и
 * это верно ровно до тех пор, пока перенос не закончен: с нулём такое
 * утверждение стало бы требовать нарушения, чтобы проверка себе верила
 * (У-88, У-119 — контроль ставится на примере, ответ на который известен).
 */
const STYLE_LOOK_CONTROL = 'root.style.padding = "4px 0";';
const STYLE_VALUE_CONTROL = "target.root.style.left = String(Math.round(left)) + \"px\";";

function main(): void {
  const files = runtimeFiles();
  /*
   * Положительный контроль на сам обход. Он идёт первым: обход, нашедший
   * десяток файлов вместо сотни, сделает зелёными все утверждения ниже, и
   * каждое из них будет зелено по верной причине.
   */
  assert.ok(files.length > 100,
    "файлов рантайма найдено " + files.length + ", а их сотня с лишним — "
    + "обход сломан, и все утверждения ниже мерят пустоту");

  const bodies = files.map(f => ({
    rel: path.relative(repoRoot, f).replace(/\\/g, "/"),
    code: codeOnly(fs.readFileSync(f, "utf8")),
  }));

  for (const rule of RULES) {
    /* Контроль образца: он обязан находить то, для чего написан. */
    assert.ok(new RegExp(rule.rx.source).test(rule.control),
      "образец правила «" + rule.what + "» не находит даже свой пример — "
      + "сломан он, а не рантайм");

    const where: string[] = [];
    let found = 0;
    for (const body of bodies) {
      const hits = (body.code.match(new RegExp(rule.rx.source, "g")) || []).length;
      if (!hits) continue;
      found += hits;
      where.push(body.rel + ":" + hits);
    }

    assert.ok(found <= rule.ceiling,
      "правило каталога «" + rule.what + "»: мест " + found
      + ", а планка " + rule.ceiling + " (" + rule.why + ")\n  " + where.join("\n  "));

    /*
     * И обратная сторона у бюджета: планка выше нуля обязана быть занята.
     * Опустела — значит разобрано, и планку надо опустить тем же коммитом,
     * иначе она разрешает вернуть то, чего уже нет.
     */
    if (rule.ceiling > 0) {
      assert.ok(found > 0,
        "правило каталога «" + rule.what + "»: планка " + rule.ceiling
        + ", а мест ноль — бюджет мерит пустоту, опустите планку");
      assert.equal(found, rule.ceiling,
        "правило каталога «" + rule.what + "»: мест стало " + found
        + " при планке " + rule.ceiling + " — разобранное обязано уронить "
        + "планку тем же коммитом");
    }
  }

  /* ---- Р7: оформление и величина ---------------------------------------- */

  /** Что стоит справа от знака равенства: литерал целиком — оформление. */
  const classify = (line: string): "look" | "value" | null => {
    const m = line.match(/\.style\.([A-Za-z][\w]*)\s*=\s*(.+?);?\s*$/);
    if (!m) return null;
    return /^(["'])(?:(?!\1)[^\\]|\\.)*\1$/.test(String(m[2]).trim()) ? "look" : "value";
  };

  /* Контроль **до первого вывода** (У-119): разбор обязан узнавать оба вида на
     примере, ответ на который известен. */
  assert.equal(classify(STYLE_LOOK_CONTROL), "look",
    "разбор Р7 не узнаёт оформление даже в своём примере — сломан он, а не рантайм");
  assert.equal(classify(STYLE_VALUE_CONTROL), "value",
    "разбор Р7 не узнаёт вычисленную величину в своём примере — то же самое");

  let look = 0;
  let value = 0;
  const lookWhere: string[] = [];
  for (const body of bodies) {
    body.code.split("\n").forEach(line => {
      const kind = classify(line);
      if (kind === "look") {
        look += 1;
        lookWhere.push(body.rel + ": " + line.trim());
      } else if (kind === "value") {
        value += 1;
      }
    });
  }

  assert.equal(look, STYLE_LOOK_CEILING,
    "инлайнового оформления стало " + look + " при планке " + STYLE_LOOK_CEILING
    + ": новое роняет проверку, перенесённое в класс обязано уронить планку\n  "
    + lookWhere.join("\n  "));
  assert.ok(value <= STYLE_VALUE_CEILING,
    "вычисленных величин в стилях " + value + ", а планка " + STYLE_VALUE_CEILING
    + " — новая величина обязана быть названа в Р7");

  console.log("  ok  правил каталога проверено " + RULES.length
    + ", файлов рантайма " + files.length
    + ", инлайнового оформления " + look + ", вычисленных величин " + value);
}

main();
console.log("Obsidian catalog rules tests: OK");
