/**
 * Видимые тексты своих блоков — второй кусок каталога (PRD 10.13.47, В-67).
 *
 * Первый кусок увёз в каталог всё, что панель берёт из схемы, плюс коллауты,
 * предпросмотры, справочник команд и окна кнопок. За ним осталась половина
 * вкладки `Tags & PKM`: редактор Fields, Smart Rules, Binder, свои теги и
 * списки порядка — блоки, у которых вся вёрстка своя и потому весь текст тоже
 * свой. Заказчик решил 2026-09-06: брать.
 *
 * **Устройство то же, что у окон** (`texts_dialogs.ts`), и это не совпадение,
 * а правило: у текста один дом, ключ строит одна функция, и её зовут оба
 * конца (У-82).
 *
 *   * таблица по владельцу — владелец здесь **сам блок**, и называется он тем
 *     же id, что стоит у записи `kind: "custom"` в схеме;
 *   * ключ — `block.<владелец>.<имя>`;
 *   * строки, которые собираются по ходу, пишутся с `{0}`: по-русски то, что
 *     по-английски стоит в конце, встаёт в начало, и склейка через `+` этого
 *     не переживает.
 *
 * **Место в файле каталога** — там, где блок стоит в схеме: `blockEntries`
 * в `texts_custom.ts` дописывает эти строки к строке своего блока.
 */

/** Строки, которые рисует один блок. Порядок — порядок чтения на экране. */
export const BLOCK_TEXTS = {
  /* ---- редактор Fields: сам блок, его окна, проверки имён -------------- */
  "field-editor": {
    /* Левая колонка: список Fields. */
    /*
     * Смысл двух подписей сторон живёт здесь, а не у них самих: колонка
     * списка шириной 188 точек, и тело подсказки встало бы в неё столбиком по
     * два слова (У-105). Знака «?» у `Left Block` и `Right Block` поэтому нет,
     * и это объявленное исключение, а не забывчивость — заказ заказчика
     * 2026-09-08 был «tip у всех элементов».
     */
    LIST_TIP: "The two halves are the Blocks of a line: everything in <b>Left Block</b> is written before your text, everything in <b>Right Block</b> after it. Drag a Field across the line to change which Block it is written in, or step it with the arrows on the right — at the edge of a Block they cross the line too",
    EMPTY_SIDE: "nothing on this side",
    SIDE_LEFT: "Left Block",
    SIDE_RIGHT: "Right Block",
    /* Родная подсказка Obsidian у подписи стороны: одна подсказка на узел, и
       только `aria-label` (У-21). */
    SIDE_LEFT_ABOUT: "Everything in Left Block is written before your text on the line",
    SIDE_RIGHT_ABOUT: "Everything in Right Block is written after your text on the line",
    TYPE_TAG: "Tag",
    TYPE_LINK: "Link",
    TYPE_ELEMENT: "Emoji",
    ADD_FIELD: "Add Field",
    ADD_FIELD_LABEL: "Add a Field",
    NO_FIELD_PICKED: "add a Field on the left to set it up here",
    LIST_ARIA: "the Fields list",
    COLUMN_ARIA: "this column",
    /* Подписи строк, собранные вокруг имени Field. */
    SHOW_FIELD: "Show the Field {0}",
    RENAME_FIELD: "Rename the Field {0}",
    DELETE_FIELD: "Delete the Field {0}",
    DRAG_FIELD: "Drag {0} to reorder it, or across the line to change side",
    DRAG_CHILD_FIELD: "Drag {0} — it moves with {1}",
    MOVE_FIELD_UP: "Move {0} up, and across the line at the top",
    MOVE_FIELD_DOWN: "Move {0} down, and across the line at the bottom",
    /* Правая колонка: шапка и разделы. */
    DETAIL_TIP: "Everything about the Field picked on the left. Its name in TagWheel, the Values it offers, how it behaves on a line, and which note property it goes into. Nothing here touches the other Fields — pick another one on the left and the whole column changes",
    SHORT_NAME_NAME: "Name in TagWheel",
    SHORT_NAME_DESC: "A shorter name for the TagWheel row, where there is little room",
    SHORT_NAME_TIP: "TagWheel puts every Field side by side, so a long name crowds its neighbours. Writing <b>Status</b> as <b>Stat</b> keeps that row readable. Your notes keep the full name",
    /* Раздел Behavior. */
    BEHAVIOR_HEAD: "Behavior",
    BEHAVIOR_HEAD_TIP: "Three things about how this Field acts, and none about what it writes. <b>Active</b> turns its commands on and off without deleting the Field. <b>Prefix behavior</b> decides whether a Value may change the marker at the start of the line — a checkbox, for instance. <b>Child Field</b> ties this Field to another one, so it comes into play only once that one is on the line",
    ACTIVE_NAME: "Active",
    ACTIVE_DESC: "Whether this Field is offered, and where",
    ACTIVE_TIP: "<b>No</b> switches the Field off everywhere: TagWheel does not show it and its commands do nothing. <b>Commands only</b> keeps the commands working and takes the Field out of TagWheel",
    ACTIVE_YES: "Yes",
    ACTIVE_NO: "No",
    ACTIVE_COMMANDS_ONLY: "Commands only",
    ACTIVE_FOR: "Active, for {0}",
    BEHAVIOR_NAME: "Prefix behavior",
    BEHAVIOR_DESC: "How this Field affects the line Prefix",
    BEHAVIOR_STRICT: "Strict",
    BEHAVIOR_INSERT_ONLY: "Insert only",
    BEHAVIOR_FREE: "Free",
    BEHAVIOR_TIP: "<b>Strict</b> writes the Value in its own Block and changes the line Prefix. <b>Insert only</b> writes the Value in its own Block and does not change the line Prefix. <b>Free</b> inserts the Value where the cursor is now",
    BEHAVIOR_FOR: "Behavior for {0}",
    CHILD_NAME: "Child Field",
    CHILD_DESC: "Show the child Field in TagWheel once a parent Value is picked",
    CHILD_TIP: "A child Field is a second Field that only makes sense under this one: its Values are the ones marked child in the table below. Switched off, TagWheel does not offer it even when its Values are set up",
    CHILD_YES: "Yes",
    CHILD_NO: "No",
    CHILD_OF: "Child Field of {0}",
    PREREQ_NAME: "Prerequisite Field",
    PREREQ_DESC: "Show this Field only after another Field has a Value",
    PREREQ_TIP: "A Field with a prerequisite stays out of TagWheel, out of its commands and out of the line until the Field it waits for has a Value. Picking a different Value in that Field clears this one",
    PREREQ_YES: "Yes",
    PREREQ_NO: "No",
    PREREQ_PICK_NAME: "Choose prerequisite Field",
    PREREQ_PICK_DESC: "Which Field this one waits for",
    PREREQ_PICK_TIP: "A Link or an Emoji Field can wait for any other Field, a Tag Field only for another Tag Field. Two Tag Fields tied this way are also kept next to each other in the line",
    PREREQ_NOT_CHOSEN: "Not chosen",
    PREREQ_VALUE_NAME: "Prerequisite Value",
    PREREQ_VALUE_DESC: "Which Value of that Field this one waits for",
    PREREQ_VALUE_TIP: "Left at <code>Any Value</code> this Field appears as soon as the prerequisite Field has a Value of any kind. Name one, and it waits for that Value alone",
    PREREQ_ANY_VALUE: "Any Value",
    /* Раздел Values. */
    VALUES_TIP: "The <code>next</code> and <code>previous</code> commands walk this list in order. A child Value follows its parent: it sits in the same Block and takes the parent’s <code>Behavior</code>",
    ELEMENT_VALUE_TIP: "An element Field holds one Value, not a list: a date, a time, a counter. The rows below say what it prints — the emoji in front and the format of the value itself — and how the <code>next</code> and <code>previous</code> commands move it along",
    VALUES_EMPTY: "no Values yet — add the first one below",
    LEVEL_TIP: "change Value to be parent or child by pressing arrows. Child Values are only active when Parent Value is present",
    VALUE_LINK_TIP: "The link this Value writes. It may be written as <code>[[link]]</code> or as <code>link</code> — both are read the same way",
    VALUE_TAG_TIP: "The text of the Value. A tag may be written with <code>#</code> or without it — both are read the same way",
    VALUE_PREFIX_TIP: "The checkbox this Value puts in front of the line, such as <code>[ ]</code> or <code>[x]</code>. Empty leaves the usual list marker",
    VALUE_SHOWN_TIP: "How the Value looks in the line: <b>default</b> prints the Value, <b>empty</b> prints its color and nothing else, <b>custom</b> prints the text you give",
    /*
     * Три подсказки, заведённые 2026-09-08 по заказу заказчика: «добавь tip ко
     * всем элементам, у которых еще нет, чтобы было универсально (например,
     * fill, text, preview и т.д.)».
     *
     * Прежний довод — «у них подпись и есть объяснение» — не выдержал: `Text`
     * читается как текст значения, а это цвет надписи, и предупреждение о
     * контрасте живёт в `Preview`, о чём по одному слову не догадаться.
     */
    VALUE_FILL_TIP: "The color of the bubble drawn behind this Value in the line. Untouched it comes from your theme, and the round arrow at the end of the row puts it back there",
    VALUE_TEXT_TIP: "The color of the writing inside that bubble — not the text of the Value, which is the <code>Value</code> column. If the two colors read badly together, <code>Preview</code> says so",
    VALUE_PREVIEW_TIP: "This Value drawn the way the editor will draw it, with both colors and the <code>Show</code> choice already applied. Nothing here is a setting: it is the row showing what the columns to its left have built. A warning sign appears when the two colors are too close to read, with the contrast it measured",
    SHOWN_DEFAULT: "default",
    SHOWN_EMPTY: "empty",
    SHOWN_CUSTOM: "custom",
    VALUE_DRAG: "Drag {0} to reorder it",
    VALUE_MAKE_PARENT: "Make {0} a top-level Value",
    VALUE_MAKE_CHILD: "Make {0} a child Value",
    VALUE_PREFIX_NO: "no",
    VALUE_PREFIX_FOR: "Prefix for {0}",
    /*
     * `VALUE_PREFIX_HINT` снята 2026-09-08 при разборе долга A46. Слово в
     * слово то же, что `ERR_PREFIX_TOKEN` ниже, — и на экране показывается
     * именно `ERR_PREFIX_TOKEN`, сообщением при негодном вводе. У этой строки
     * места на экране не было ни одного дня: она попадала в файл языка, и
     * человек переводил то, чего не увидит (У-71).
     */
    VALUE_SHOWN_FOR: "Show, for {0}",
    VALUE_CUSTOM_PLACEHOLDER: "printed instead",
    VALUE_CUSTOM_FOR: "Custom text for {0}",
    VALUE_FILL_COLOR: "Fill color",
    VALUE_RESET_COLORS: "Reset the colors of {0} back to the colors of the theme",
    VALUE_REMOVE: "Remove {0}",
    NEW_VALUE_LINK_HINT: "[[wikilink]] / wikilink",
    NEW_VALUE_TAG_HINT: "#tag / tag",
    NEW_VALUE_FOR: "New Value for {0}",
    ADD_VALUE: "Add Value",
    ADD_VALUE_TO: "Add a Value to {0}",
    /* Раздел эмодзи-элемента. */
    ELEMENT_EMOJI_NAME: "Emoji-prefix",
    ELEMENT_EMOJI_DESC: "The character that stands in front of the Value in the line",
    ELEMENT_EMOJI_TIP: "This is how the Field is recognised: the plugin reads <code>📅 2026-08-27</code> as this Field only because <code>📅</code> stands in front. Give it a character no other Field uses, or the two will be taken for one",
    ELEMENT_EMOJI_HINT: "one character or emoji",
    ELEMENT_FORMAT_NAME: "Value format",
    ELEMENT_FORMAT_DESC: "The shape of the Value: a date, a time or a number",
    ELEMENT_FORMAT_HINT: "YYYY-MM-DD / HHmm / 1",
    ELEMENT_FORMAT_TIP: "Spell out the shape you want to see in the line. A date or a time is built from <code>YYYY</code> (year), <code>MM</code> (month), <code>DD</code> (day), <code>HH</code> (hour), <code>mm</code> (minute), <code>ss</code> (second), with any separators between them: <code>YYYY-MM-DD</code> writes <code>2026-08-27</code>, <code>DD.MM</code> writes <code>27.08</code>, <code>HHmm</code> writes <code>1435</code>. Digits alone make a counter, and the number of digits is the width it keeps: <code>1</code> counts <code>1</code>, <code>2</code>, <code>3</code>, while <code>001</code> counts <code>001</code>, <code>002</code>. Anything else is taken as plain text and never steps",
    ELEMENT_STEP_NAME: "Steps by",
    ELEMENT_STEP_DESC: "What should happen with the Value when you use <code>next</code> or <code>previous</code> command",
    ELEMENT_STEP_TIP: "<b>Fixed step</b> adds the same amount on every press: a day to a date, one to a counter. <b>Command</b> throws the old Value away and writes a fresh one — the time of the press, or a random string for an id. <b>Custom step</b> walks a list of steps you write yourself, and can end the cycle by removing the Value from the line",
    STEP_FIXED: "Fixed step",
    STEP_COMMAND: "Command",
    STEP_CUSTOM: "Custom step",
    ELEMENT_STEP_FOR: "Steps by, for {0}",
    ELEMENT_AMOUNT_NAME: "Amount",
    ELEMENT_AMOUNT_DESC: "How much one press adds to the Value",
    ELEMENT_AMOUNT_TIP: "<code>next</code> adds this much, <code>previous</code> takes the same back. What one unit means comes from <code>Value format</code>: with <code>YYYY-MM-DD</code> it is a day, with <code>HHmm</code> a minute, with a counter just one",
    ELEMENT_AMOUNT_FOR: "Amount for {0}",
    ELEMENT_COMMAND_NAME: "Command",
    ELEMENT_COMMAND_DESC: "What the press writes into the Value instead of stepping it",
    ELEMENT_COMMAND_TIP: "<code>The current date and time</code> writes the moment of the press in the shape set by <code>Value format</code>. The random ones fill the Value with numbers or letters, which is what an id needs",
    COMMAND_NOW: "The current date and time",
    COMMAND_RANDOM_NUMBERS: "Random numbers",
    COMMAND_RANDOM_CHARS: "Random characters",
    ELEMENT_COMMAND_FOR: "Command for {0}",
    ELEMENT_STEPS_NAME: "Steps",
    ELEMENT_STEPS_DESC: "One step per line, in the order the presses walk them",
    ELEMENT_STEPS_TIP: "A line is a number, and a number in brackets after it says how many presses stay on that step: <code>1 (3)</code> moves by one for three presses. <code>END</code> ends the cycle and removes the Value",
    ELEMENT_STEPS_FOR: "Steps for {0}",
    /* Раздел YAML. */
    YAML_HEAD: "YAML property",
    YAML_HEAD_TIP: "<code>Inline to note</code> on the Transform tab turns a line into a note, and every Field can be written into a property of that note — the same properties you see at the top of a note in Obsidian. This is where you say which property a Field goes to. Start typing and it offers the ones your vault already uses. Leave it empty and the Field is simply not copied",
    YAML_NAME: "Property",
    YAML_DESC: "If you use inline2note, to which YAML property this Field should go",
    YAML_TIP: "The properties are the ones Obsidian shows at the top of a note. Start typing and the box offers the names your vault already uses; you can also type a name that does not exist yet, and it appears the first time a note is written with it. Leave the box empty and this Field is simply not copied into the note. Two Fields may point at the same property — then <code>Property type</code> below decides whether it holds a list or a single Value",
    YAML_HINT: "select Property",
    YAML_FOR: "YAML property for {0}",
    YAML_CLEAR: "Clear the property of {0}",
    YAML_KIND_NAME: "Property type",
    YAML_KIND_DESC: "Whether the property holds one Value or a list",
    YAML_KIND_TIP: "<b>Auto</b> works it out for you: a list when more than one Field writes to the same property, a single Value otherwise. Set it by hand only when Auto guesses wrong",
    YAML_NOT_WRITTEN: "not written",
    YAML_KIND_AUTO: "Auto",
    YAML_KIND_ONE: "One Value",
    YAML_KIND_LIST: "A list",
    YAML_FORM_NAME: "How to show Value in YAML",
    YAML_FORM_DESC: "How the Value is written into the property",
    YAML_FORM_TIP: "<b>Raw</b> copies the Value exactly as it appears in your line, hash and all. <b>Clean</b> strips the decoration — no <code>#</code> on a tag, no emoji on a date, no <code>[[ ]]</code> around a link — which is what you want if you plan to search or sort by the property. The rule belongs to the Field and applies to every one of its Values",
    YAML_FORM_RAW: "Raw",
    YAML_FORM_CLEAN: "Clean",
    YAML_TAGS_WARNING: "A tags property does not take links: Obsidian will flag the value in the note",
    YAML_PREVIEW_NAME: "Preview",
    YAML_PREVIEW_DESC: "How this Value will look like in YAML",
    YAML_PREVIEW_TIP: "It follows the three choices above and updates as you change them, and it shows what <b>this</b> Field writes. Two Fields can share one property name — then the note gets both of them in the same list, while each Field shows only its own part here",
    /*
     * Окна редактора.
     *
     * Три строки заведены 2026-09-08, при разборе долга A46: подписи `Name` и
     * `Type` и кнопка `Cancel` стояли в окнах литералами, а в каталоге их не
     * было вовсе. То есть человек не мог их перевести даже теоретически — не
     * «перевод не доезжает», а «строки нет».
     */
    NEW_FIELD_TITLE: "Add a Field",
    NEW_FIELD_NAME: "Name",
    NEW_FIELD_TYPE: "Type",
    CANCEL: "Cancel",
    NEW_FIELD_NAME_LABEL: "What this Field is called here and in the config note",
    NEW_FIELD_NAME_HINT: "Priority",
    NEW_FIELD_NAME_ARIA: "Name of the new Field",
    NEW_FIELD_TYPE_LABEL: "What the Field writes into the line",
    NEW_FIELD_TYPE_ARIA: "Type of the new Field",
    NEW_FIELD_TYPE_TAG: "Tag",
    NEW_FIELD_TYPE_LINK: "Link",
    NEW_FIELD_TYPE_ELEMENT: "Element",
    NEW_FIELD_ADD: "Add",
    NEW_FIELD_FAILED: "The Field was not added",
    DELETE_TITLE: "Delete Field",
    DELETE_BODY: "Deleting {0} removes its Values, their colors and its note property",
    DELETE_CONFIRM: "Delete",
    RENAME_TITLE: "Rename Field",
    RENAME_LABEL: "New name",
    RENAME_HINT: "Lowercase letters, digits, spaces, hyphens and underscores",
    RENAME_ARIA: "New name for the Field {0}",
    RENAME_WARNING: "Two things will not follow the new name:",
    RENAME_WARNING_NOTES: "lines you have already written keep the old tag — the plugin does not edit your notes",
    RENAME_WARNING_HOTKEY: "a hotkey given to this Field’s commands comes loose: Obsidian keeps hotkeys by command id, and the id is built from the name",
    RENAME_CONFIRM: "Rename",
    /* Проверки имён и значений: их человек читает на месте ошибки. */
    ERR_NAME_CHARS: "A Field name can only use lowercase letters, digits, spaces, hyphens and underscores",
    ERR_NAME_SUB: "Names ending in _sub are kept for child Fields",
    ERR_NAME_TAKEN: "A Field with this name already exists",
    ERR_CHILD_TAKEN: "The child Field for this name already exists",
    ERR_NO_FIELD: "No Field named {0}",
    ERR_YAML_FORM: "A Value is written either raw or clean, nothing else",
    ERR_NOT_SAVED: "This Field is not saved yet",
    ERR_SELF_PREREQ: "A Field cannot wait for itself",
    ERR_TAG_PREREQ: "A Tag Field can only wait for another Tag Field",
    ERR_LINK_NO_FIELD: "Cannot tell which Field this link Value belongs to",
    ERR_LINK_NO_TARGET: "Cannot tell which Field this link Value would go to",
    ERR_LINK_UNNAMED_FIELD: "The Field for this link has no name",
    ERR_LINK_NEEDS_NAME: "A link needs a name",
    ERR_PREFIX_TOKEN: "A Prefix checkbox looks like [ ] or [I]",
  },

  /* ---- Smart Rules ----------------------------------------------------- */
  "smart-rules-list": {
    KIND_TAG: "Tag",
    KIND_ELEMENT: "Element",
    KIND_LINK: "Link",
    KIND_FIELD: "Field",
    RULE_NAME_HINT: "Name this rule (optional)",
    RULE_FALLBACK_NAME: "Rule {0}",
    RULES_EMPTY: "no rules yet — the default template is used for every line",
    ADD_RULE: "Add rule",
    /* Кнопка отказа в окне выбора условия. Заведена 2026-09-08: стояла
       литералом, и в каталоге её не было вовсе (долг A46). */
    CANCEL: "Cancel",
    MATCH_ANY: "any",
    MATCH_OR: "or",
    MATCH_AND: "and",
    WHEN_THE_LINE_HAS: "when the line has",
    USE_TEMPLATE: "Use template",
    MOVE_TO_FOLDER: "Move to folder",
    TEMPLATE_NONE: "None",
    FOLDER_DEFAULT: "Default",
    FOLDER_NEAR_NOTE: "Near current note",
    FOLDER_OTHER: "Another folder…",
    FOLDER_HINT: "type or pick a folder",
    ANY_VALUE_SUFFIX: "{0} — any Value",
    ANY_VALUE_TAKEN: "{0} — any Value is already in this rule",
    USE_ANY_VALUE_OF: "Use any Value of {0}",
    NO_FIELDS_YET: "no Fields yet — set one up on the Tags & PKM tab",
    NO_KIND_FIELDS_YET: "no {0} Fields yet — set one up on the Tags & PKM tab",
    VALUES_EMPTY: "no Values yet",
    USE_VALUE: "Use {0}",
    CONDITION_TIP: "Pick one of the Values your Fields already offer. A rule looks for any of the Values listed under one Field type, and for all of the types you have filled in",
    ADD_CONDITION: "Add a {0}",
    RULE_NAME_ARIA: "Name of {0}",
    RULE_TEMPLATE_ARIA: "Template for {0}",
    RULE_FOLDER_ARIA: "{0} path for {1}",
    RULE_DRAG: "{0} to reorder it",
    RULE_STOP: "Stop using {0}",
    RULE_REMOVE: "Remove {0}",
    CONDITION_REMOVE: "Remove {0}",
    /* ---- `Advanced settings` у правила (З-5) ------------------------------
       Слова повторяют `Note content`, и это не копия текста, а вторая его
       точка на экране: у правила свои строки и свои ключи каталога, а
       переводятся они врозь. Читаются они здесь и нигде больше. */
    RULE_ADVANCED: "Advanced settings",
    RULE_ADVANCED_ARIA: "Advanced settings for {0}",
    RULE_ADVANCED_DEFAULT: "Default",
    RULE_ADVANCED_CUSTOM: "Set for this rule",
    PL_ROW_ARIA: "{0} for {1}",
    PL_POSITION: "Where to put the text",
    PL_POSITION_BEGINNING: "At the beginning",
    PL_POSITION_END: "At the end",
    PL_POSITION_HEADER: "At custom header",
    PL_TARGET_HEADER: "Type name of header",
    PL_TARGET_HEADER_HINT: "# Header name",
    PL_FALLBACK: "If header not found",
    PL_HEADER_MODE: "Line above the text",
    PL_HEADER_MODE_CUSTOM: "Fixed text",
    PL_HEADER_MODE_DATETIME: "Date and time",
    PL_HEADER_MODE_NONE: "Nothing",
    PL_HEADER_LEVEL: "Line above is header",
    PL_HEADER_LEVEL_PLAIN: "No (plain text)",
    PL_HEADER_TEXT: "Text of the line above",
    PL_DATETIME: "Date format",
  },

  /* ---- Binder ---------------------------------------------------------- */
  "binder-table": {
    COL_INSERTS: "Inserts",
    COL_COMMAND_NAME: "Command name",
    COL_DESCRIPTION: "Description",
    COL_HOTKEY: "Hotkey",
    /* Подсказки колонок, заведены 2026-09-08 (заказ «tip у всех элементов»).
       Раскрываются в слот под шапкой, во всю ширину таблицы: ячейка шапки тут
       шириной в шесть десятков точек. */
    COL_INSERTS_TIP: "The text this command drops in at the cursor. It is fixed when the row is made: the command is built from the text, so changing it afterwards would leave your hotkey inserting something else",
    COL_COMMAND_NAME_TIP: "How the command is called in the command palette and on Obsidian's <code>Hotkeys</code> screen. The plugin name goes in front of it by itself, so there is no need to repeat it here",
    COL_DESCRIPTION_TIP: "A note to yourself about what the row is for. It is the one column here you can change later, and nothing outside this table reads it",
    COL_HOTKEY_TIP: "The keys assigned to this command right now. Press the cell and Obsidian's own <code>Hotkeys</code> screen opens at this command — this plugin assigns no keys by itself",
    HOTKEY_CHANGE: "Change the hotkey for {0}",
    HOTKEY_ASSIGN: "Assign the hotkey for {0}",
    NEW_INSERTS_HINT: "→",
    NEW_NAME_HINT: "Arrow",
    NEW_CANCEL: "Cancel",
    ADD_COMMAND: "Add command",
    HOTKEY_NOT_SET: "not set",
    BUILT_IN: "Built in",
    COMMAND_PREFIX: "Binder: {0}",
    NEW_TITLE: "Add a Binder command",
    NEW_NOTE: "The command is made from the row, so the text it inserts cannot be changed afterwards",
    NEW_INSERTS_LABEL: "Inserts",
    NEW_INSERTS_DESC: "The text this command drops in at the cursor",
    NEW_NAME_LABEL: "Command name",
    NEW_NAME_DESC: "What to call it in Obsidian's list of hotkeys",
    NEW_DESC_LABEL: "Description",
    NEW_DESC_DESC: "A note to yourself about what the row is for",
    NEW_FIELD_ARIA: "{0} of the new command",
    NEW_ADD: "Add",
    ROW_ARIA: "this row",
    ROW_DRAG: "{0} to reorder it",
    ROW_DESC_ARIA: "Description for {0}",
    /*
     * `ROW_HOTKEY_ARIA` снята 2026-09-08 при разборе долга A46. Она собирала
     * подпись кнопки хоткея из двух половин — «{0} the hotkey for {1}», — а
     * подпись давно приходит целой строкой: `HOTKEY_CHANGE` или
     * `HOTKEY_ASSIGN`. Строка пережила свой предмет и попадала в файл языка,
     * где человек переводил то, чего на экране нет (У-71).
     */
    ROW_REMOVE: "Remove {0}",
    ERR_TEXT_TAKEN: "A row with this text to insert already exists",
    ERR_NAME_TAKEN: "A row with this command name already exists",
  },

  /* ---- свои теги ------------------------------------------------------- */
  "user-tag-list": {
    HEAD_TAG: "Tag",
    HEAD_SHOW: "Show",
    HEAD_FILL: "Fill",
    HEAD_TEXT: "Text",
    HEAD_PREVIEW: "Preview",
    TEXT_COLOR: "Text color",
    TAG_TIP: "The tag as it is written in a line. With <code>#</code> or without it — both are read the same way",
    SHOWN_TIP: "How the tag looks in the line: <b>default</b> prints the tag, <b>empty</b> prints its color and nothing else",
    FILL_TIP: "The color of the bubble behind the tag",
    TEXT_TIP: "The color of the writing on the bubble",
    /* Пятая колонка была единственной без подсказки (заказ заказчика
       2026-09-08). Чип предпросмотра у своего тега свой, как в таблице
       Values, и предупреждение о контрасте показывает он же. */
    PREVIEW_TIP: "The tag drawn the way the editor will draw it, with both colors and the <code>Show</code> choice applied. A warning sign appears when the two colors are too close to read, with the contrast it measured",
    ADD_TAG: "Add tag",
    NEW_TAG_HINT: "#tag",
    NEW_TAG_ARIA: "New tag to color",
    EMPTY: "no tags of your own yet — add one below",
    SHOWN_DEFAULT: "default",
    SHOWN_EMPTY: "empty",
    ROW_ARIA: "Tag {0}",
    SHOWN_FOR: "Show, for {0}",
    FILL_COLOR: "Fill color",
    RESET_COLORS: "Reset the colors of {0} back to the colors of the theme",
    REMOVE: "Remove {0}",
  },

  /* ---- списки порядка: Fields и Prefix ---------------------------------- */
  "field-order-list": {
    NO_PREFIX: "no Prefix (plain text)",
    ADD_PREFIX: "Add Prefix",
    DRAG_HINT: "Drag a row, or use the arrows, to change the order",
    FIELDS_TIP: "The Field nearest the top wins a conflict. Drag a row, or use the arrows",
    PREFIX_TIP: "The Prefix nearest the top wins, whichever Field produced it. Drag a row, or use the arrows",
    FIELDS_EMPTY: "no Fields yet — set them up under Fields above",
    PREFIX_EMPTY: "no Prefixes listed yet",
    ROW_DRAG: "{0} to reorder it",
    MOVE_UP: "Move {0} up",
    MOVE_DOWN: "Move {0} down",
    REMOVE: "Remove {0}",
    PREFIX_ROW: "Prefix {0}",
  },

  /* ---- таблицы того, что делают клавиши --------------------------------- */
  "left-right-order": {
    MOVE_LEFT: "Move left",
    MOVE_RIGHT: "Move right",
    /* Подсказки двух подписей, 2026-09-08 (заказ «tip у всех элементов»).
       Тело раскрывается ПОД парой колонок: колонка тут от 268 точек, и прозе
       в ней тесно — та же беда, что у подсказок шириной с имя настройки. */
    MOVE_LEFT_TIP: "What the key does depends on the line, and the list is read top down: the first line that matches wins. This is a description of the command, not a setting — each of the three jobs is switched on and off by its own row further down",
    MOVE_RIGHT_TIP: "The mirror of <code>Move left</code>, read the same way. Whether the last line applies at all is decided by <code>Cycle in both directions</code> below: switch it off and <code>Move right</code> only ever changes the indent",
    WHEN_SELECTED: "part of a line is selected",
    THEN_MOVE_TEXT: "move that text",
    WHEN_INDENTED: "the line is indented",
    THEN_UNINDENT: "remove one indent level",
    THEN_INDENT: "add one indent level",
    WHEN_NO_INDENT: "no indent",
    THEN_CYCLE_BACK: "cycle the prefix backwards",
    THEN_CYCLE_ON: "cycle the prefix forwards",
  },

  /* ---- что остаётся на строке ------------------------------------------- */
  "source-fields": {
    NO_FIELDS: "no Fields yet — set them up under Tags & PKM",
    NONE_KEPT: "nothing is kept: every Value leaves the line",
    KEEP_ONE: "Keep the Values of {0} on the line",
    KEEP_ALL: "Keep all",
    KEEP_ALL_DESC: "Keep the Values of every Field on the line",
    KEEP_NONE: "Keep none",
    KEEP_NONE_DESC: "Let every Value leave the line",
  },

  /* ---- ступени расширенного `Ctrl+A`: режим `Custom` (З-3) ------------- */
  "select-all-custom": {
    /* Имена ступеней — слова Obsidian и обычного языка, поэтому со
       строчной (Р9). Заказчик и просил их именно так: `word, line, tree,
       heading, note`. */
    STEP_WORD: "word",
    STEP_WORD_ABOUT: "the word nearest the cursor",
    STEP_LINE: "line",
    STEP_LINE_ABOUT: "the line you are on",
    STEP_TREE: "tree",
    STEP_TREE_ABOUT: "the line and everything indented under it",
    STEP_HEADING: "heading",
    STEP_HEADING_ABOUT: "everything under the nearest heading",
    STEP_NOTE: "note",
    STEP_NOTE_ABOUT: "the whole note",
    /* Пустой список объясняет себя, а не молчит (ПЗ2). */
    NOTHING_TICKED: "nothing ticked: Ctrl/Cmd + A stays Obsidian’s own",
    STOP_AT: "Stop at the {0} while cycling",
  },

  /* ---- справочник команд ------------------------------------------------ */
  "command-list": {
    COL_COMMAND: "Command",
    COL_DOES: "Description",
    COL_HOTKEY: "Hotkey",
    /* Подсказки шапки и двух подписей частей, 2026-09-08. Шапка — в слот под
       ней; подпись части занимает строку целиком, и знак стоит в ней самой. */
    COL_COMMAND_TIP: "The name Obsidian knows this command by. It is the same name in the command palette and on the <code>Hotkeys</code> screen, and it is never translated: Obsidian takes it from its own register, and two lists of one command would not agree",
    COL_DOES_TIP: "What the command does, in one line. This column is the one thing in the table a language file can change — the names beside it cannot",
    COL_HOTKEY_TIP: "The keys assigned right now, or <code>not set</code>. Press the cell to open Obsidian's own <code>Hotkeys</code> screen at this command; this plugin assigns no keys by itself",
    PART_STANDARD_TIP: "Commands that are always there, whatever you have set up: they come with the plugin, and their names do not change",
    PART_USER_TIP: "Commands built from your Fields. Every Field gets a <code>next</code> and a <code>previous</code>, a child Field gets its own pair under the same heading, and the order is the order of your Fields — not the alphabet. Add, rename or remove a Field and this part changes with it",
    HOTKEY_CHANGE: "Change the hotkey for {0}",
    HOTKEY_ASSIGN: "Assign the hotkey for {0}",
    HOTKEY_NOT_SET: "not set",
    HOTKEY_OPEN: "Open Obsidian's Hotkeys settings at this command",
  },
} as const;

/** Кто владеет строкой: id своего блока в схеме. */
export type BlockOwner = keyof typeof BLOCK_TEXTS;

/** Ключ каталога для текста блока. Одна функция на оба конца (У-82). */
export function blockKey(owner: string, name: string): string {
  return "block." + owner + "." + name.toLowerCase().replace(/_/g, "-");
}

/** Английская ветка каталога для одного блока — в порядке чтения. */
export function blockTextEntries(owner: string): ReadonlyArray<{ key: string; text: string }> {
  const table = (BLOCK_TEXTS as Readonly<Record<string, Readonly<Record<string, string>>>>)[owner];
  if (!table) return [];
  return Object.entries(table).map(([name, text]) => ({ key: blockKey(owner, name), text }));
}

/** То же самое, когда имя приходит строкой: у `say` его знать неоткуда. */
export const BLOCK_BY_NAME: Readonly<Record<string, Readonly<Record<string, string>>>> =
  BLOCK_TEXTS as unknown as Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Что блоку нужно от панели, чтобы спросить свой текст. */
interface HasT {
  t?: (key: string, fallback: string) => string;
}

/**
 * Как блок спрашивает свой текст: `const say = sayIn("field-editor", ctx)`,
 * дальше `say("ADD_FIELD")` и `say("SHOW_FIELD", name)`.
 */
export function sayIn(owner: BlockOwner, ctx: HasT): (name: string, ...args: readonly (string | number)[]) => string {
  const table = BLOCK_BY_NAME[owner] || {};
  return (name: string, ...args: readonly (string | number)[]): string => {
    const english = table[name] || "";
    const said = ctx && typeof ctx.t === "function" ? ctx.t(blockKey(owner, name), english) : english;
    return args.length ? said.replace(/\{(\d+)\}/g, (whole, n) => {
      const value = args[Number(n)];
      return value === undefined ? whole : String(value);
    }) : said;
  };
}
