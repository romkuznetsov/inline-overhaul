"use strict";
/**
 * Знаки выбиралки (`char_picker.ts`): эмодзи и символы по рубрикам.
 *
 * Его слово 2026-09-23 (тест 1 заметки): «чтобы было столько же эмодзи,
 * сколько есть в эмодзи windows 11», символов — «больше популярных», и
 * рубрики — «текстовые названия сепараторов, под которыми будут элементы».
 *
 * **Эмодзи — весь `emoji-test.txt` версии 15.0**, группами Unicode (они же
 * разделы панели эмодзи Windows 11): полностью заданные, без оттенков кожи
 * (Windows выбирает их отдельно) и без флагов стран — шрифт Windows рисует их
 * двумя буквами. Версия 15.0, а не новее: знак, которого нет в шрифте,
 * рисуется пустым квадратом или распадается на два.
 *
 * **Символы — рубрики ниже**, имя каждого из `UnicodeData.txt` той же версии;
 * там, где имя уже стояло в выбиралке, оно прежнее (`KEEP`): его пункт 9.4 —
 * «при `→` должно быть `Arrow right`», — а имя становится именем команды
 * Binder.
 *
 * Пишет `src/ui/settings/custom/pick_data.ts` и объявление `PICK_EMOJI` в
 * прототипе (выбиралка знака Field рисуется и там; равенство держит
 * `char_picker_tests.ts`). Запуск: `node tools/build/gen_pick_data.js`, нужен
 * доступ к unicode.org.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "src", "ui", "settings", "custom", "pick_data.ts");
const PROTO = path.join(ROOT, "docs", "prototype", "settings_prototype.html");
const EMOJI_URL = "https://unicode.org/Public/emoji/15.0/emoji-test.txt";
const UCD_URL = "https://unicode.org/Public/15.0.0/ucd/UnicodeData.txt";

const SYMBOLS = [
  ["Arrows", "→ ← ↑ ↓ ↔ ↕ ↗ ↘ ↙ ↖ ⇒ ⇐ ⇑ ⇓ ⇔ ⇕ ⟶ ⟵ ⟷ ⟹ ⟸ ⟺ ➜ ➔ ➝ ➞ ➤ ↦ ↤ ↠ ↞ ⇢ ⇠ ⇡ ⇣ ↩ ↪ ⤴ ⤵ ⤷ ⤶ ↻ ↺ ⇄ ⇆ ⇅ ⇵ ⇥ ⇤"],
  ["Triangles and pointers", "▶ ◀ ▲ ▼ ▷ ◁ △ ▽ ► ◄ ▸ ◂ ▴ ▾ ‣"],
  ["Bullets and dots", "• · ∙ ◦ ○ ● ◉ ◎ ⦿ ⁃ ‧ ∘"],
  ["Shapes", "■ □ ▪ ▫ ◆ ◇ ◈ ❖ ▰ ▱ ◢ ◣ ◤ ◥ ⬟ ⬠ ⬡ ⬢ ◯ ▬ ▭ ▮ ▯"],
  ["Stars and flowers", "★ ☆ ✦ ✧ ✩ ✪ ✫ ✬ ✭ ✮ ✯ ✰ ⁂ ※ ✱ ✲ ✴ ✵ ✶ ✷ ✸ ✹ ✺ ❂ ❉ ❊ ❋ ✿ ❀ ❁ ♡ ❣"],
  ["Checks and crosses", "✓ ✔ ✗ ✘ ☐ ☑ ☒ ⊠ ⊡ ✕ ✖ ⨯"],
  ["Math", "+ − ± ∓ × ÷ ⋅ = ≠ ≈ ≃ ≅ ≡ ≢ < > ≤ ≥ ≪ ≫ ∞ √ ∛ ∑ ∏ ∫ ∂ ∆ ∇ ∈ ∉ ∋ ⊂ ⊃ ⊆ ⊇ ∪ ∩ ∅ ∀ ∃ ∄ ¬ ∧ ∨ ⊕ ⊗ ∴ ∵ ∝ ° ′ ″ ‰ ‱ %"],
  ["Fractions and indices", "½ ⅓ ⅔ ¼ ¾ ⅕ ⅛ ⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁺ ⁻ ⁿ ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉"],
  ["Greek", "α β γ δ ε ζ η θ λ μ π σ τ φ χ ψ ω Γ Δ Θ Λ Π Σ Φ Ψ Ω"],
  ["Currency", "$ € £ ¥ ₽ ₸ ₴ ₹ ₩ ₪ ₺ ₿ ¢ ₱ ₫ ₼ ₾ ₣"],
  ["Punctuation and typography", "— – ‒ ‑ … « » ‹ › „ “ ” ‚ ‘ ’ ¿ ¡ ‼ ⁇ ⁈ ⁉ § ¶ † ‡ ‖ ¦ © ® ™ ℗ № ℃ ℉ ℮ ⁄"],
  ["Keyboard", "⌘ ⌥ ⇧ ⌃ ⎋ ⏎ ↵ ⌫ ⌦ ⇪ ␣ ⏏"],
  ["Music and games", "♩ ♪ ♫ ♬ ♭ ♮ ♯ ♠ ♣ ♥ ♦ ♤ ♧ ♢ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅"],
  ["Weather and things", "☀ ☁ ☂ ☃ ☄ ☎ ☏ ✉ ✎ ✏ ✐ ✂ ⚐ ⚑ ⚙ ⚛ ☯ ☮ ♻ ⌛ ⌚ ⚠ ☢ ☣ ⚕ ⚖ ⚓ ⚔ ♀ ♂ ⚤"],
  ["Box drawing", "─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ ═ ║ ╔ ╗ ╚ ╝ ░ ▒ ▓ █ ▀ ▄ ▌ ▐"],
];

/* Имена, которые уже стояли в выбиралке: они же имена команд Binder. */
const KEEP = {
  "→": "Arrow right", "←": "Arrow left", "↑": "Arrow up", "↓": "Arrow down",
  "↔": "Arrow left right", "↕": "Arrow up down", "⇒": "Double arrow right", "⇐": "Double arrow left",
  "⇔": "Double arrow left right", "↗": "Arrow up right", "↘": "Arrow down right", "↩": "Return arrow",
  "⟶": "Long arrow right", "➜": "Heavy arrow right", "▶": "Triangle right", "◀": "Triangle left",
  "▲": "Triangle up", "▼": "Triangle down", "•": "Bullet", "·": "Middle dot",
  "○": "White circle mark", "●": "Black circle mark", "◆": "Diamond", "◇": "White diamond",
  "■": "Black square", "□": "White square", "★": "Black star", "☆": "White star",
  "✓": "Tick", "✗": "Ballot x", "±": "Plus minus", "×": "Multiplication",
  "÷": "Division", "≈": "Almost equal", "≠": "Not equal", "≤": "Less or equal",
  "≥": "Greater or equal", "∞": "Infinity", "√": "Square root", "∑": "Sum",
  "∆": "Delta", "π": "Pi", "°": "Degree", "‰": "Per mille",
  "№": "Numero", "§": "Section", "¶": "Pilcrow", "†": "Dagger",
  "©": "Copyright", "®": "Registered", "™": "Trademark", "€": "Euro",
  "£": "Pound", "¥": "Yen", "₽": "Ruble", "₸": "Tenge",
  "—": "Em dash", "–": "En dash", "…": "Ellipsis", "«": "Left guillemet",
  "»": "Right guillemet", "„": "Low quote", "“": "Left quote", "”": "Right quote",
  "♠": "Spade", "♣": "Club", "♥": "Heart suit", "♦": "Diamond suit",
  "♪": "Note", "☐": "Ballot box", "☑": "Ballot box checked", "☒": "Ballot box x",
  "⌘": "Command key", "⌥": "Option key", "⇧": "Shift key", "⏎": "Enter key",
};

const sentence = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

async function get(url) {
  const r = await globalThis.fetch(url);
  if (!r.ok) throw new Error(url + ": " + r.status);
  return r.text();
}

function emojiGroups(text) {
  const groups = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const g = /^# group: (.+)$/.exec(line);
    if (g) { cur = { title: g[1].trim(), items: [] }; groups.push(cur); continue; }
    const m = /^([0-9A-F ]+?)\s*; fully-qualified\s*# (\S+) E\d+\.\d+ (.+)$/.exec(line);
    if (!m || !cur) continue;
    const cps = m[1].trim().split(/\s+/).map(h => parseInt(h, 16));
    if (cps.some(c => c >= 0x1f3fb && c <= 0x1f3ff)) continue;
    if (cps.some(c => (c >= 0x1f1e6 && c <= 0x1f1ff) || (c >= 0xe0020 && c <= 0xe007f))) continue;
    cur.items.push([String.fromCodePoint(...cps), sentence(m[3].trim())]);
  }
  return groups.filter(g => g.title !== "Component" && g.items.length);
}

function symbolGroups(ucd) {
  const names = new Map();
  for (const line of ucd.split("\n")) {
    const f = line.split(";");
    if (f.length > 1 && !f[1].startsWith("<")) names.set(parseInt(f[0], 16), f[1]);
  }
  const seen = new Set();
  return SYMBOLS.map(([title, chars]) => ({
    title,
    items: chars.split(" ").map(ch => {
      if (seen.has(ch)) throw new Error("символ дважды: " + ch);
      seen.add(ch);
      const n = KEEP[ch] || names.get(ch.codePointAt(0));
      if (!n || [...ch].length !== 1) throw new Error("нет имени у " + ch);
      return [ch, KEEP[ch] || sentence(n)];
    }),
  }));
}

const lit = groups => "[\n" + groups.map(g => "  { title: " + JSON.stringify(g.title) + ", items: [\n"
  + g.items.map(([c, n]) => "    [" + JSON.stringify(c) + ", " + JSON.stringify(n) + "],").join("\n")
  + "\n  ] },").join("\n") + "\n]";

(async () => {
  const emoji = emojiGroups(await get(EMOJI_URL));
  /* Знак, который сам по себе уже эмодзи (`⌛`, `⌚`), живёт во вкладке
     эмодзи: дважды один знак выбиралка не показывает. */
  const emojiChars = new Set(emoji.flatMap(g => g.items.map(([c]) => c)));
  const symbols = symbolGroups(await get(UCD_URL))
    .map(g => ({ title: g.title, items: g.items.filter(([c]) => !emojiChars.has(c)) }));
  const kept = Object.keys(KEEP).filter(ch => !symbols.some(g => g.items.some(([c]) => c === ch)));
  if (kept.length) throw new Error("прежние символы выпали из рубрик: " + kept.join(" "));
  /* Имя — ещё и имя команды Binder, и двух одинаковых быть не должно. У
     символа и его эмодзи-двойника (`∞` и `♾️`, `©` и `©️`) имя одно; символ
     его сохраняет, эмодзи получает приписку. */
  const symbolNames = new Set(symbols.flatMap(g => g.items.map(([, n]) => n.toLowerCase())));
  for (const g of emoji) g.items = g.items.map(([c, n]) => [c, symbolNames.has(n.toLowerCase()) ? n + " emoji" : n]);

  const ts = [
    "/**",
    " * ВНИМАНИЕ: файл сгенерирован `node tools/build/gen_pick_data.js`.",
    " * Руками не правится: правится генератор, затем он же запускается снова.",
    " */",
    "",
    "export interface PickGroup {",
    "  /** Рубрика: строка над знаками. Пусто — рубрики нет. */",
    "  readonly title: string;",
    "  readonly items: readonly (readonly [string, string])[];",
    "}",
    "",
    "export const EMOJI_GROUPS: readonly PickGroup[] = " + lit(emoji) + ";",
    "",
    "export const SYMBOL_GROUPS: readonly PickGroup[] = " + lit(symbols) + ";",
    "",
  ].join("\n");
  fs.writeFileSync(OUT, ts);

  const proto = fs.readFileSync(PROTO, "utf8");
  const re = /const PICK_EMOJI = \[[\s\S]*?\n\];/;
  if (!re.test(proto)) throw new Error("в прототипе нет объявления PICK_EMOJI");
  const body = "const PICK_EMOJI = [\n" + emoji.map(g => "  [" + JSON.stringify(g.title) + ", ["
    + g.items.map(([c, n]) => "[" + JSON.stringify(c) + "," + JSON.stringify(n) + "]").join(", ") + "]],").join("\n") + "\n];";
  fs.writeFileSync(PROTO, proto.replace(re, () => body));

  const count = gs => gs.reduce((a, g) => a + g.items.length, 0);
  console.log("эмодзи: " + count(emoji) + " в " + emoji.length + " рубриках; символов: "
    + count(symbols) + " в " + symbols.length + " рубриках");
})().catch(e => { console.error(e.message || e); process.exit(1); });
