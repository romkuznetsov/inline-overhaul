# PRD: Inline Overhaul — переработка слоя настроек и архитектуры UI

**Версия:** 1.1
**Дата:** 2026-08-24
**Базовый коммит:** `a018bb0`
**Исполнитель:** LLM-агент с доступом на запись в репозиторий
**Заказчик:** автор плагина
**Согласованный прототип:** `docs/prototype/settings_prototype.html` — согласован заказчиком 2026-08-24, нормативный источник структуры и текстов панели

### Что изменилось в версии 1.1

Версия 1.0 описывала намерение. Версия 1.1 описывает согласованное решение: интерактивный прототип панели прошёл шестнадцать кругов правок и принят заказчиком. Разделы, которые он определяет, переписаны по нему, а не по замыслу.

| Раздел | Что стало |
|---|---|
| 2 | Добавлены решения Р8–Р12: прототип нормативен, регистр сущностей, точки, седьмая вкладка, возврат Floating button |
| 5.2 | Схема приведена к форме, которая уже работает в прототипе: предикаты с `deps`, `tip`, `seeAlso`, `kind: 'buttons'` |
| 6 | Семь вкладок вместо шести, 33 группы; списки сгенерированы из прототипа |
| 7 | Правила текстов дополнены: заглавные у сущностей плагина, без точки в конце, ссылки через `<code>`, длинные объяснения в `tip` |
| 9 | Вместо описи «было → стало» — сверка старой описи с прототипом, сгенерированная скриптом |
| 10 | 21 свой блок вместо четырёх редакторов, с требованиями по каждому |
| 12 | Гейты Г13–Г21 и требования к заглушке DOM: каждый написан по уже случившейся ошибке |
| Приложение B | Полная опись целевого состояния, сгенерированная из прототипа |

---

## 0. Как читать этот документ

Документ самодостаточен: исполнителю не нужно догадываться о намерениях. Правила приоритета при любом противоречии:

1. Раздел 3 «Запреты» — сильнее всего остального.
2. Раздел 2 «Зафиксированные решения» — принято заказчиком, не пересматривается.
3. **Согласованный прототип** `docs/prototype/settings_prototype.html` — источник истины по структуре панели, текстам и поведению своих блоков. Открывается в браузере, работает без сборки. Расхождение реализации с прототипом — дефект реализации, а не вариант.
4. Разделы 5–10 — спецификация того, чего в прототипе не видно: типы, миграция, порядок работ.
5. Приложение B — опись целевого состояния, сгенерированная из прототипа. Руками не правится: правится прототип, затем опись перегенерируется.
6. Раздел 12 «Гейты» — механическая проверка готовности фазы.

Если спецификация чего-то не покрывает, а решение меняет наблюдаемое поведение плагина — **остановиться и спросить**, а не выбирать самостоятельно. Если решение не меняет поведение (имя переменной, порядок строк) — выбирать самому и не спрашивать.

Все строки интерфейса — на английском. Документ и комментарии в коде — на русском там, где так уже принято в репозитории.

---

## 1. Контекст и проблема

Inline Overhaul — desktop-плагин Obsidian: навигация по строкам, инлайновые PKM-поля и теги, TagWheel, визуальное оформление тегов, преобразование инлайн-элементов в заметки. Публичная бета `0.1.0-beta.1`, распространяется через BRAT.

Панель настроек содержит **101 настройку** плюс четыре самописных редактора (Order board, Field details/Deep Editor, Binder, Smart rules). Она выросла органически и сейчас является главным ограничителем: автор не может ей пользоваться, и она непригодна для внешних пользователей.

Три корневые причины (подтверждены чтением кода, ссылки — в разделе 4):

1. **Нет модели настроек.** Каждая настройка — это ~15 строк императивного кода в файле `src/ui/settings_sections_renderer.js` (6819 строк). Нет описания «что за настройка, где живёт, от чего зависит», поэтому нет ни группировки, ни поиска, ни условной видимости, ни проверки соответствия UI и конфига.
2. **Панель полностью перерисовывается на каждое изменение.** Отсюда потеря фокуса и скролла, дрожание слайдеров, засорение undo-стека и, как компенсация, слой постобработки DOM, который «доводит» вёрстку после каждого рендера.
3. **Нет CSS.** Всё оформление — 1318 присваиваний `.style.` и захардкоженные hex-цвета, поэтому панель не подчиняется темам и выглядит чужеродно внутри Obsidian.

Тексты настроек описывают реализацию, а не результат: в описаниях фигурируют ID команд, имена файлов исходников, undo-стек, debounce и термины, которые нигде не определены.

---

## 2. Зафиксированные решения

Решения приняты заказчиком в интервью. Не пересматриваются.

| № | Решение | Следствия для работ |
|---|---|---|
| Р1 | **BRAT сейчас, подача в Obsidian community позже** | Гайдлайны Obsidian — обязательные требования, но блокеры review выделены в отдельную фазу 6 и не блокируют фазы 1–5. |
| Р2 | **Своя декларативная схема поверх `Setting`**, нативный `getSettingDefinitions()` не используется | `minAppVersion` остаётся `1.5.0`. Схема пишется в форме, близкой к нативной (см. 5.2), чтобы позже можно было заменить только рендерер. |
| Р3 | **Ломать совместимость можно**, миграция обязательна | Схема конфига переезжает на v2 с миграцией `schemaVersion 1 → 2`. ID команд переименовываются в kebab-case. |
| Р4 | **TypeScript постепенно** | Новый и переписываемый код — на TS. Существующие движки (`pkm_v2/`, `navigation_runtime.js`, `src/core/*`) не конвертируются. |
| Р5 | **Навигация в два уровня**: вкладки по модулям + группы-заголовки внутри вкладки | Подвкладки (Visual, PKM, Hotkeys) и тумблеры видимости удаляются. Вкладок семь, см. 6.1. |
| Р6 | **Терминология — гибрид** | Имена фич сохраняются как бренд (TagWheel, Binder, Transform). Внутренние механизмы переименовываются (Order, Strip, Prefix Resolver, free roam, zone). Полная таблица — 7.3. |
| Р7 | **Служебные контролы убираются** | `Flush Settings Now`, `Execution Backend`, `Undo last settings change` и оба placeholder-контрола удаляются из UI. Undo остаётся только командой. Исключение по `Flying button` — см. Р12. |
| Р8 | **Прототип нормативен** | `docs/prototype/settings_prototype.html` согласован 2026-08-24. Структура вкладок и групп, все видимые тексты, поведение своих блоков и живых предпросмотров берутся из него. Изменение любого из этих пунктов требует изменения прототипа, а не только кода. |
| Р9 | **Сущности плагина — имена собственные** | `Field`, `Value`, `Bar`, `Prefix`, `Separator`, `Block`, `TagWheel`, `Binder`, `Transform`, `Smart Rules` пишутся с заглавной в любом месте фразы, чтобы читатель видел сущность плагина, а не обычное слово. Слова Obsidian и обычного языка — со строчной. Список — 7.3, проверка — Г17. |
| Р10 | **Точка в конце видимой строки не ставится** | Ни в `desc`, ни в `intro`, ни в подписях, ни в последнем предложении `tip`. Внутри абзаца точки между предложениями остаются. Проверка — Г18. |
| Р11 | **Седьмая вкладка `Keyboard`** | Из `General` выделены Binder, расширенный select all и справочник команд. `General` остаётся о том, что включено и с чего начать. |
| Р12 | **`Floating button` возвращается** | В прототипе это рабочая настройка, а не placeholder. Реализация требует декораций редактора CM6 и делается в фазе 5; до этого настройки в схеме нет (10.10). |

---

## 3. Границы работ и запреты

### 3.1 В границах

- Слой настроек целиком: схема, рендерер, вёрстка, тексты, структура.
- `ConfigStore`: undo, сохранение, оповещение подписчиков.
- Схема конфига и миграция.
- Инфраструктура: TS, ESLint, тесты, CI, `styles.css`.
- Фаза 6: удаление динамической загрузки модулей, разбор `main.js`, приведение манифеста и команд к гайдлайнам.

### 3.2 Вне границ

- Логика навигации, PKM-рантайма, TagWheel, Transform. Меняется только то, как эти функции **настраиваются**, не то, как они работают.
- Новые пользовательские функции. Ни одна не добавляется.
- Мобильная поддержка. `isDesktopOnly` остаётся `true`.
- Локализация интерфейса. Строки остаются английскими, но выносятся из кода в один модуль, чтобы локализация стала возможной позже.

### 3.3 Запреты

- **З1.** Не менять значения, которые пишутся в конфиг. Переименовываются только видимые подписи. Пример: значения `off` / `minimal` / `full` у режима размещения поля сохраняются, метки становятся `Strict` / `Insert only` / `Free`.
- **З2.** Не удалять и не «упрощать» ни одну настройку, кроме перечисленных в Р7 и в разделе 9 со статусом `DELETE`. Если настройка кажется лишней — оставить и пометить в отчёте.
- **З3.** Не трогать файлы `pkm_v2/**`, `navigation_runtime.js`, `pkm_runtime_v2.js`, `src/core/pkm_*`, `src/core/status_*`, `src/core/token_graph_unified.js`, `src/core/line_pipeline.js` — кроме случаев, когда меняется путь чтения настройки из конфига (фаза 2).
- **З4.** Не добавлять зависимости, кроме `typescript`, `eslint` и плагинов ESLint. Никаких UI-фреймворков, никаких рантайм-библиотек.
- **З5.** Не использовать `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `new Function`, `eval` в новом коде.
- **З6.** Не задавать цвета литералами. Только CSS-переменные Obsidian.
- **З7.** Не ставить хоткеи по умолчанию (`Command.hotkeys`) ни одной команде.
- **З8.** Не переносить в UI сообщения, адресованные разработчику. Если контрол не работает в текущем релизе — он не показывается.

---

## 4. Подтверждённые дефекты текущего состояния

Ссылки — на файлы в этом репозитории на коммите `a018bb0`.

### 4.1 Архитектура

| ID | Дефект | Где | Почему это важно |
|---|---|---|---|
| A1 | Динамическая загрузка JS из vault через `new Function(code)` | `src/core/vault_module_bridge.js:82`, `main.js:1628`, `main.js:1676` | Отказ на review community plugins. В релизе путь мёртв: реестр забандленных модулей в `vault_module_bridge.js:39-43` срабатывает первым и всегда. |
| A2 | ~1600 строк загрузчиков и fallback'ов | `main.js:157-1765` | На каждый из 50 модулей — `hasValidX` / `loadXSafe` / `createXFallback`. Плюс отдельные файлы `*_fallback.js`. Двойное сопровождение, гарантированный дрейф. |
| A3 | `main.js` — 5405 строк без слоя домена | `main.js` | В одном файле загрузчики, `DEFAULT_CONFIG`, миграции, 4 CM6-виджета, класс плагина, класс настроек. |
| A4 | Схема конфига не соответствует UI | `main.js:2494` пустой `visual`, реальные визуальные настройки в `main.js:2456` под `pkm.behavior.tagVisuals` | «Где настройка в меню» не выводится из «где она в конфиге». Мешает поиску, экспорту и проверкам. |
| A5 | Мёртвые ветки конфига | `visual.displayModes`, `visual.colors`, `transform.inline2fleet`, `pkm.executionBackend` | Пустые объекты и поле с единственным значением. |
| A6 | undo-стек засоряется | `src/core/config_store.js:52`, `main.js:5040`, `main.js:1768` | Снимок пушится на любое изменение, включая переключение вкладки и каждый шаг слайдера. При лимите 20 «Undo» откатывает переключение вкладки. |
| A7 | Лишняя запись на старте | `src/core/config_store.js:22-26` | `saveData` вызывается безусловно при каждом запуске. |
| A8 | Полный ре-рендер панели на каждое изменение | `main.js:5152` → `main.js:5199` | `containerEl.empty()` и пересборка дерева из рендерера в 6819 строк. Фокус и скролл не восстанавливаются: ни `activeElement`, ни `scrollTop` в коде нет. |
| A9 | Слайдеры пишут конфиг в `onChange` | `src/ui/settings_sections_renderer.js:763` и аналогично 20+ раз | Запись и ре-рендер на каждый шаг протяжки. |
| A10 | Постобработка DOM вместо CSS | `src/ui/settings_sections_renderer.js:170-210`, `:212-330` | Заголовки опознаются **по текстовому содержимому** из захардкоженного `Set`; «карточки» — по подстроке в `el.style.border`; `textContent === "Order Main Table"`. Любая правка текста ломает вёрстку. |
| A11 | Нет `styles.css` | — | 1274 присваивания `.style.` в рендерере, 44 в `main.js`. Захардкоженные цвета: `:361`, `:366`, `:503`, `:1429`, `:1454`, `:1527`, `:3664`, `:4489`, `:4931`. |
| A12 | Нет типов, линтера, CI, единой команды тестов | `package.json` | Есть только `test:version` и `test:release`; остальные тесты запускаются вручную по файлу. |
| A13 | `main.js` и `dist/main.js` закоммичены; нет LICENSE; `authorUrl` пустой; нет `fundingUrl` | `manifest.json`, корень репозитория | Требования к публикации. |

### 4.2 Структура меню

| ID | Дефект | Где |
|---|---|---|
| M1 | Три уровня самодельной навигации: 7 вкладок → подвкладки → тумблеры видимости | `main.js:1783-1802`, `src/ui/settings_sections_renderer.js:2081`, `:2398`, `:2427` |
| M2 | Все кнопки вкладок — `mod-cta`, неактивность передаётся только `opacity: 0.8` | `:2340`, `:2088`, `:2398`, `:2427` |
| M3 | Заголовок с названием плагина запрещён гайдлайном; к тому же единственное место, где имя пишется слитно | `:2358` |
| M4 | Сырые `h3`–`h6` в 12 местах, вложенность непоследовательна (`h5` и `h4` вперемешку) | `:1687`, `:1744`, `:1769`, `:1816`, `:1870` |
| M5 | Тумблеры видимости вместо структуры; `orderShowInfoTips` выключает **сами описания** | `:2592`, `:2601`, `:2610`, `:446`; `setDesc(showInfoTips ? "…" : "")` в `:5819`, `:5835`, `:5924`, `:5943`; дефолт `false` в `main.js:2513` |
| M6 | Вкладка Hotkeys дублирует нативные Hotkeys и сама это признаёт подсказкой | `:2106`, колонка Command ID в `:2124-2127` |
| M7 | Enhanced Ctrl+A спрятан на вкладке Hotkeys → Global, **без заголовка секции** (`includeSubheader: false`), хотя README помещает его в General | `:2322` |
| M8 | Служебные механизмы в UI | `:1559`, `:1998`, `:1629`, `:1651` |
| M9 | Незавершённое видно в релизе | `:1963`, `:1971`, `src/features/transform_feature.js:1989` |
| M10 | «Scroller size» — текстовое поле с диапазоном в описании вместо слайдера | `:592` |

### 4.3 Тексты

| ID | Дефект | Примеры |
|---|---|---|
| T1 | Смешанный регистр: Title Case и sentence case вперемешку | `Show Color Settings`, `Opacity Left`, `Enable Move Line`, `Flush Settings Now`, `Log Path` против `Scroller direction`, `Center cursor` |
| T2 | Описания про реализацию | `Command IDs: inlineOverhaul_Navigation_MoveUp / …` (`:1690`, `:1748`, `:1819`, `:1873`); `Plugin writes <path>.new.*` (`:1600`); `Rollback one step from settings undo stack` (`:1999`); `Force rewrite generated rules markdown from plugin JSON` (`:1653`); `Single format for both TagWheel and status_tags commands` (`:6708`) |
| T3 | Неопределённые термины | `zone`, `technical zone`, `free roam`, `Order`, `Strip`, `rails`, `Prefix Resolver`, `subtag`, `separator1`, `text_end`. Худший случай — `:1253`: три неопределённых термина в одном предложении |
| T4 | Диапазоны и единицы в тексте описания вместо контрола | `(0..100%)`, `(80%..140%)`, `(1..20)`, `(1..12)`, `(2..20 px)`, `(8..48 px)` — `:594`, `:755`, `:877`, `:943`, `:1009`, `:1075`, `:1280`, `:1315`, `:1350`, `:1385` |
| T5 | Описания-повторы имени | `Enable/disable navigation functionality globally` ×4 (`:1989`); `Round <-> Square` (`:1138`) |
| T6 | Имена команд дублируют префикс плагина | `name: "Navigation: Move Up"` (`src/features/command_registry.js:89`) → в палитре «Inline Overhaul: Navigation: Move Up» |
| T7 | ID команд не в kebab-case | `inlineOverhaul_Navigation_MoveUp` |
| T8 | Приватное API | `plugin.app.setting.open()` / `openTabById` — `src/features/command_registry.js:51-52` |

---

## 5. Целевая архитектура слоя настроек

### 5.1 Файлы

Новый слой — в `src/ui/settings/`. Старые файлы удаляются в конце фазы 3.

```
src/ui/settings/
  types.ts            типы схемы (5.2)
  schema/
    index.ts          сборка всех групп в один массив, проверка уникальности id
    general.ts        группы вкладки General
    keyboard.ts       Binder, select all, справочник команд (Р11)
    navigation.ts
    pkm.ts
    visual.ts
    transform.ts
    advanced.ts
  strings.ts          все видимые строки одним объектом (задел под локализацию)
  render.ts           рендерер схемы (5.3)
  bindings.ts         реестр path → подписчики, точечное обновление (5.3)
  tabs.ts             панель вкладок (5.4)
  custom/
    fields_editor.ts  редактор Fields: список Block и правая колонка (10.2)
    previews.ts       живые предпросмотры строки, тегов, Bars, TagWheel (10.3)
    binder.ts         таблица Binder (10.4)
    command_ref.ts    справочник команд (10.5)
    dispatch_tables.ts разбор Move left / Move right (10.6)
    order_lists.ts    порядок Prefix и приоритеты (10.7)
    smart_rules.ts    правила Transform (10.8)
    yaml_mapping.ts   свойства заметки (10.9)
    callouts.ts       вводные коллауты вкладок (10.1)
  settings_tab.ts     класс PluginSettingTab

styles.css            вся вёрстка панели
```

Удаляются в фазе 3: `src/ui/settings_sections_renderer.js`, `src/ui/settings_sections_fallback.js`, `src/ui/settings_tab_router.js`, `src/ui/settings_tab_router_fallback.js`, и рендер-функции настроек из `src/features/transform_feature.js` (`renderTransformSettings`, `renderSmartRulesSection` — переезжают в `custom/smart_rules.ts` и `schema/transform.ts`).

### 5.2 Схема настроек

Форма схемы зафиксирована согласованным прототипом (`docs/prototype/settings_prototype.html`): там она уже работает на 33 группах и 91 настройке, включая условную видимость, точечное обновление и поиск. Реализация повторяет её один в один, отличаясь только типами.

```ts
export type TabId =
  | 'general' | 'keyboard' | 'navigation' | 'pkm' | 'visual' | 'transform' | 'advanced';

/** Контекст, который рендерер передаёт каждому контролу и предикату. */
export interface SettingsCtx {
  cfg: Readonly<Config>;                   // текущий снимок конфига
  get<T>(path: string): T;                 // чтение по dot-path
  set(path: string, value: unknown, opts?: SetOpts): void;
  run(action: ActionId): Promise<void>;     // кнопки-действия, см. 5.6
  app: App;
  plugin: InlineOverhaulPlugin;
}

export interface SetOpts {
  /** Несколько записей с одним ключом внутри 400 мс склеиваются в одну запись undo. */
  coalesceKey?: string;
  /** false — не попадает в undo-стек. По умолчанию true. */
  undoable?: boolean;
}

/**
 * Предикат — это не просто функция: он обязан объявить пути, от которых
 * зависит. Без `deps` точечное обновление (Р-4) не знает, какие строки
 * перерисовать при изменении пути, и вырождается в полный ре-рендер.
 */
export interface Predicate {
  deps: readonly string[];
  test: (ctx: SettingsCtx) => boolean;
}

interface Base {
  id: string;                              // уникален глобально, kebab-case
  name: string;
  /** Одно предложение: что изменится для пользователя. Без точки в конце (Ст3). */
  desc?: string;
  /** Второй уровень объяснения, раскрывается по «?». Разрешены абзацы и <code>. */
  tip?: string;
  /** Дополнительные слова для поиска: старое имя, внутренний термин. */
  searchTerms?: readonly string[];
  /** Ссылка на связанную настройку: «см. также». Переводит фокус и раскрывает её. */
  seeAlso?: { id: string; label: string };
  visible?: Predicate;
  disabled?: Predicate;
}

interface Bound extends Base { path: string; }

export type SettingDef =
  | (Bound & { kind: 'toggle';   default: boolean })
  | (Bound & { kind: 'dropdown'; options: ReadonlyArray<{ value: string; label: string }>; default: string })
  | (Bound & { kind: 'slider';   min: number; max: number; step: number; unit?: string; default: number })
  | (Bound & { kind: 'number';   min?: number; max?: number; default: number })
  | (Bound & { kind: 'text';     placeholder?: string; wide?: true; default: string })
  | (Bound & { kind: 'textarea'; placeholder?: string; rows?: number; default: string })
  | (Bound & { kind: 'color';    allowReset?: true; default: string })
  | (Base  & { kind: 'buttons';  buttons: ReadonlyArray<{ label: string; action: ActionId; cta?: true; warning?: true }> })
  | (Base  & { kind: 'custom';   render: (el: HTMLElement, ctx: SettingsCtx) => (() => void) });

export interface SettingsGroup {
  id: string;
  tab: TabId;
  order: number;                           // шаг 100, см. 6.2
  heading: string;
  /** Одно предложение над группой. Обязательно там, где группа вводит термин. */
  intro?: string;
  /** Длинное объяснение группы. Всё, что не влезает в intro, уходит сюда, а не в desc. */
  tip?: string;
  visible?: Predicate;
  items: readonly SettingDef[];
}
```

Требования к схеме:

- **С1.** `default` в схеме — единственный источник значения по умолчанию. `DEFAULT_CONFIG` строится **из схемы** функцией `buildDefaultConfig(schema)`, а не пишется руками. Это устраняет класс ошибок «в UI одно значение по умолчанию, в конфиге другое».
- **С2.** Все `id` уникальны; проверяется гейтом Г6.
- **С3.** Все `path` существуют в типе `Config`; проверяется типами TS и гейтом Г7.
- **С4.** У каждой настройки, чьё имя менялось, в `searchTerms` лежит старое имя. Пользователь, знавший «Opacity Left», находит её поиском. Сверка старых имён с новыми — раздел 9.
- **С5.** `kind: 'custom'` возвращает функцию очистки. Рендерер обязан её вызвать при уходе с вкладки.
- **С6.** У каждого предиката непустой `deps`, и каждый путь из `deps` есть в схеме. Проверяется гейтом Г7.
- **С7.** `seeAlso.id` указывает на существующий `id`. Проверяется гейтом Г6.
- **С8.** `kind: 'buttons'` — одна строка настроек с одной или несколькими кнопками. Отдельного `kind: 'button'` нет: он порождал по строке на кнопку там, где кнопки логически парные (`Open` + `Apply`).
- **С9.** `tip` — не дубль `desc`, а следующий уровень: зачем это нужно, что будет в крайних случаях, чем отличается от соседней настройки. Правила текста — 7.1.
- **С10.** Группа не содержит больше 12 настроек, не считая `custom` (Г11). Если больше — делится на две группы.

### 5.3 Рендерер и правила обновления

Главное требование фазы 1: **панель не перерисовывается целиком при изменении настройки.**

- **Р-1.** `PluginSettingTab.display()` вызывается только при открытии панели и при переключении вкладки.
- **Р-2.** `SettingsTab` **не подписывается** на `store` ради полной перерисовки. Существующая подписка `main.js:5152` удаляется.
- **Р-3.** `bindings.ts` держит реестр `Map<path, Binding[]>`, где `Binding` умеет три вещи: `refreshValue()`, `refreshVisibility()`, `refreshDisabled()`.
- **Р-4.** После `ctx.set(path, value)` рендерер:
  1. обновляет значение у остальных контролов, привязанных к тому же `path` (кроме источника изменения);
  2. пересчитывает `visible` и `disabled` **только** у тех настроек и групп, чьи предикаты объявили зависимость от изменённого пути.
- **Р-5.** Зависимости предикатов объявляются явно. Предикат — не произвольная функция от `cfg`, а пара: `{ deps: string[]; test: (ctx) => boolean }`. Это позволяет строить реестр без анализа кода. Тип из 5.2 уточняется соответственно:
  ```ts
  type Predicate = { deps: readonly string[]; test: (ctx: SettingsCtx) => boolean };
  visible?: Predicate;
  disabled?: Predicate;
  ```
- **Р-6.** Слайдеры: `onChange` только обновляет живой предпросмотр и подпись значения; запись в конфиг — на завершении жеста (`change` у `input[type=range]`, то есть отпускание мыши) и на `blur` у парного числового поля. Запись идёт с `coalesceKey` равным `id` настройки.
- **Р-7.** Текстовые поля: запись на `blur` и на `Enter`, а не на каждый символ. Для полей, где нужна живая реакция (например, разделители), запись на `input` с `coalesceKey` и задержкой 400 мс.
- **Р-8.** Скрытая настройка (`visible.test === false`) удаляется из DOM, а не прячется через `display: none`, и исключается из поиска.
- **Р-9.** Отключённая настройка (`disabled.test === true`) остаётся в DOM, получает класс `io-setting--disabled` и `aria-disabled="true"`, контрол получает `setDisabled(true)`.

### 5.4 Вкладки

- Вкладки рисуются как одна строка кнопок в контейнере `.io-tabs`. Кнопки — **обычные** `button` с классами `io-tab` и `io-tab--active`. Класс `mod-cta` **не используется** (М2).
- Активная вкладка отличается фоном и цветом текста через переменные темы, не через `opacity`.
- Клавиатура: вкладки — это `role="tablist"`, кнопки — `role="tab"` с `aria-selected`, переключение стрелками влево/вправо, `tabindex` только у активной.
- Активная вкладка хранится **вне настроек**: `plugin.viewState.activeTab`, запись через `store.setViewState()` (см. 5.5). В undo не попадает, ре-рендер настроек не вызывает.
- Вкладок семь (6.1); `General`, `Keyboard` и `Advanced` не выключаются тумблером модуля.
- Подвкладок нет. `VISUAL_SUB_TABS`, `HOTKEYS_SUB_TABS`, `cfg.ui.visualSubTab`, `cfg.ui.hotkeysSubTab`, `cfg.ui.pkmSubTab` удаляются.

### 5.5 ConfigStore

Изменения в `src/core/config_store.js` (конвертируется в `src/core/config_store.ts`):

- **CS1.** `update(mutator, reason, opts?: { undoable?: boolean; coalesceKey?: string })`.
- **CS2.** При `undoable: false` снимок в undo-стек не пушится.
- **CS3.** При заданном `coalesceKey`: если предыдущая запись в undo-стеке имеет тот же ключ и сделана менее 400 мс назад, она **не** дублируется — новое состояние заменяет вершину. Это устраняет A6 для слайдеров.
- **CS4.** Новый метод `setViewState(patch)`: пишет в отдельную секцию `viewState` файла `data.json`, не пушит undo, не вызывает `emit`, сохраняется с той же задержкой.
- **CS5.** `init()` вызывает `saveData` только если миграция изменила объект. Сравнение — по `JSON.stringify` до и после миграции (A7).
- **CS6.** `emit(reason, changedPaths: string[])` — подписчики получают список изменённых путей.
- **CS7.** `flushNow()` остаётся в API (нужен в `onunload`), но из UI не вызывается (Р7).
- **CS8.** Метод `undo()` остаётся, вызывается только командой.

### 5.6 Действия кнопок

Кнопки в схеме не содержат кода — только `action: ActionId`. Реестр действий — в `src/ui/settings/actions.ts`:

| ActionId | Что делает | Откуда взято |
|---|---|---|
| `regenerate-rules` | Перезаписывает сгенерированный файл правил | `:1651` |
| `open-config-note` | Открывает или создаёт конфиг-заметку | `:5833` |
| `apply-config-note` | Применяет конфиг-заметку к настройкам | `:5833` |
| `open-config-template` | Открывает заметку-шаблон | `:1666` |
| `add-binder-row` | Добавляет строку Binder | `:2307` |
| `add-smart-rule` | Добавляет правило Transform | `transform_feature.js:1775` |

Требование: каждое действие возвращает `Promise`, кнопка на время выполнения получает `setDisabled(true)`, результат сообщается через `Notice`. Текст `Notice` — без префикса `InlineOverhaul:` (Obsidian и так показывает источник); формулировка — что произошло, а не что вызвано.

### 5.7 CSS

- Создаётся `styles.css` в корне; `build/release.js` его уже копирует (`build/release.js:26-27`), менять билд не нужно.
- Все классы с префиксом `io-`.
- Все цвета — из переменных Obsidian: `--text-normal`, `--text-muted`, `--text-accent`, `--background-primary`, `--background-secondary`, `--background-modifier-border`, `--background-modifier-error`, `--interactive-accent`, `--interactive-accent-hover`, `--text-on-accent`.
- Функции `normalizeSettingsTypography` и `normalizeSettingsVisualSystem` удаляются целиком (A10). Ничего эквивалентного в JS не появляется.
- Заголовки групп — через `new Setting(el).setName(heading).setHeading()`. Ни одного `createEl("hN")` в слое настроек (M4).
- Заголовок с названием плагина удаляется (M3).
- Предпросмотры (образцы тега, полоски иерархии) верстаются классами и CSS-переменными, значение которых прокидывается через `el.style.setProperty('--io-preview-opacity', …)`. Это единственное разрешённое использование `.style` в новом слое: установка кастомного CSS-свойства для параметрического предпросмотра.

---

## 6. Целевая структура меню

### 6.1 Вкладки

Семь вкладок. Порядок — слева направо в панели, он же порядок в таблице.

| # | id | Заголовок | Тумблер модуля | Групп | Настроек | Своих блоков |
|---|----|-----------|----------------|-------|----------|--------------|
| 1 | `general` | General | — | 3 | 6 | 1 |
| 2 | `keyboard` | Keyboard | — | 4 | 5 | 3 |
| 3 | `navigation` | Navigation | `features.navigation.enabled` | 5 | 20 | 3 |
| 4 | `pkm` | Tags & PKM | `features.pkm.enabled` | 7 | 15 | 5 |
| 5 | `visual` | Visual | `features.visual.enabled` | 4 | 22 | 4 |
| 6 | `transform` | Transform | `features.transform.enabled` | 7 | 18 | 4 |
| 7 | `advanced` | Advanced | — | 3 | 5 | 1 |

### 6.2 Группы

Порядок групп внутри вкладки задаётся полем `order` с шагом 100. Группа `*-intro` с `order` меньше 100 — вводный коллаут вкладки, у неё нет настроек, только свой блок (см. 10.1).

**General:** `general-intro` (10) → `help` (100) → `modules` (200)

**Keyboard:** `keyboard-intro` (50) → `select-all` (100) → `binder` (200) → `command-reference` (300)

**Navigation:** `nav-intro` (50) → `move-lines` (100) → `left-right` (200) → `heading-jumps` (300) → `in-line` (400)

**Tags & PKM:** `pkm-intro` (50) → `fields` (100) → `line-format` (200) → `writing-rules` (300) → `placement-modes` (400) → `prefix-priority` (500) → `config-note` (600)

**Visual:** `visual-intro` (50) → `tag-appearance` (100) → `tag-bars` (200) → `tagwheel` (300)

**Transform:** `transform-intro` (50) → `inline-to-note` (100) → `naming` (200) → `note-properties` (250) → `note-content` (300) → `source-line` (400) → `smart-rules` (500)

**Advanced:** `advanced-intro` (50) → `generated-files` (100) → `diagnostics` (200)

Заголовки групп и их вводные фразы — Приложение B. Заголовок ставится через `setHeading()`, не через `createEl('h3')` (Г3).

### 6.3 Поведение выключенного модуля

Сейчас выключенный модуль показывает баннер «Module disabled. Settings are read-only.» (`:2381`) и оставляет все контролы отключёнными.

Целевое поведение: вкладка выключенного модуля показывает **только** одну строку — тумблер включения модуля с описанием того, что модуль делает. Остальные группы скрыты через `visible` с зависимостью от `features.<module>.enabled`. Так пользователь не листает сотню серых контролов.

Тумблер модуля дублируется: он есть и в General → Modules, и первой строкой на вкладке модуля. Вкладки `General`, `Keyboard` и `Advanced` тумблера модуля не имеют: они не выключаются. Обе привязаны к одному `path`, синхронизация обеспечивается Р-4.

---

## 7. Правила текстов

### 7.1 Стиль

Все тексты интерфейса уже написаны и согласованы в прототипе. Правила ниже — то, по чему они написаны; они нужны, чтобы новые строки не разошлись со старыми, и чтобы линтер (Г10) знал, что проверять.

- **Ст1.** Sentence case: заглавная только у первого слова, у имён собственных и у сущностей плагина (Ст10). `Move lines`, не `Move Lines`.
- **Ст2.** Имя настройки — до пяти слов, называет то, чем управляет, а не действие над реализацией. Не начинать с `Enable` там, где есть группа: `Enable Move Line` → `Move lines`.
- **Ст3.** Описание — одно предложение до 140 символов, отвечает на «что изменится для меня», а не «что делает код». **Точки в конце нет** (Р10).
- **Ст4.** В описаниях запрещены: ID команд, имена файлов исходников, слова `debounce`, `undo stack`, `runtime`, `backend`, `sprint`, `token` в значении «внутренняя единица разбора», имена внутренних модулей.
- **Ст5.** Диапазоны, шаги и единицы не пишутся в описании — их показывает контрол. Слайдер обязан показывать текущее значение с единицей (`setDynamicTooltip()` плюс подпись рядом).
- **Ст6.** Не описывать `On:`/`Off:` оба состояния, если поведение симметрично. Описывать включённое состояние; про выключенное — только если оно неочевидно, и тогда одним предложением, начинающимся с `Off:`.
- **Ст7.** Описание не повторяет имя другими словами. Если сказать нечего — описания нет.
- **Ст8.** Термин, введённый группой, объясняется в `intro` этой группы один раз, а не в каждом описании.
- **Ст9.** Кнопка называется действием (`Open`, `Apply`, `Regenerate`), а не существительным.
- **Ст10.** **Сущности плагина — имена собственные и пишутся с заглавной** в любом месте фразы: `Field`, `Value`, `Bar`, `Prefix`, `Separator`, `Block`, `Left Block`, `Right Block`, `TagWheel`, `Binder`, `Transform`, `Smart Rules`, `Tag Bars`. Так читатель видит, что речь о конкретной сущности Inline Overhaul, а не об абстрактном слове. Слова, которые принадлежат Obsidian или обычному языку, остаются со строчной: `line`, `note`, `tag`, `template`, `heading`, `command`, `hotkey`, `vault`, `property`. Полный список — 7.3.
  Из правила есть одно исключение: внутри `<code>` регистр не наш, там стоит буквальное значение (`||`, `- [x]`, `#todo`), и трогать его нельзя.
- **Ст11.** **Ссылка на команду, хоткей, настройку, значение или разделитель оформляется как `<code>`**, а не обычным текстом. `Press <code>Ctrl/Cmd + A</code>`, `see <code>Smart Rules</code> below`, `use <code>::</code>`. Без разметки пользователь не отличает название настройки от слова в предложении. Разметка допускается в `intro`, `desc`, `tip` и текстах своих блоков; в `name` — нет.
- **Ст12.** Длинное объяснение живёт в `tip`, а не в `desc` и не в `intro`. Если объяснение не влезает в одно предложение — оно целиком переезжает в `tip`, а `desc` пишется заново коротким. `intro` группы — тоже одно предложение; всё остальное про группу идёт в её `tip`.
- **Ст13.** Текст не ссылается на контрол, которого нет. При удалении или переименовании настройки проверяются все `<code>`-ссылки на неё (гейт Г19).
- **Ст14.** Числа и единицы в подписях вариантов не сокращаются до внутренних значений: `line-tree-note` → `Line, tree, then note`.

### 7.2 Имена и ID команд

- Имя команды не содержит ни имени плагина, ни имени модуля: `Navigation: Move Up` → `Move line up` (T6). Obsidian сам покажет «Inline Overhaul: Move line up».
- ID — kebab-case без префикса плагина: `inlineOverhaul_Navigation_MoveUp` → `move-line-up` (T7). Obsidian сам добавит `inline-overhaul:`.
- Полная таблица переименования команд — фаза 6 раздела 11. В фазах 1–5 ID не меняются.
- `plugin.app.setting.open()` заменить нельзя без приватного API; команда `Open settings` **удаляется** (T8). Пользователь открывает настройки штатно. Если заказчик захочет её сохранить — оставить с комментарием о приватном API.

### 7.3 Терминология (Р6, Р9)

Значения в конфиге не меняются (З1). Меняются только подписи.

**Сущности плагина — с заглавной (Ст10).** Это закрытый список: если слова здесь нет, оно пишется со строчной.

| Сущность | Что означает в UI |
|---|---|
| `Field` | один слот строки: тег, ссылка или элемент. Три типа, других нет: `tag`, `link` (wikilink), `element` (эмодзи-элемент вроде даты) |
| `Value` | одно из значений Field. Значения хранятся без имени Field |
| `Left Block` / `Right Block` | Fields перед вашим текстом и Fields после него. Сторона задаётся перетаскиванием Field через линию в редакторе Fields, отдельного контрола `Position` нет |
| `Block` | Field вместе со своими дочерними Fields: они всегда на одной стороне и двигаются вместе |
| `Bar` / `Tag Bars` | цветная полоска на полях редактора, показывающая Value строки и всего, что под ней вложено |
| `Prefix` | начало строки: маркер списка, чекбокс, решётки заголовка |
| `Separator` | два маркера, отделяющие ваш текст от Fields по краям строки |
| `TagWheel` | панель со всеми Fields над строкой, управляется стрелками |
| `Binder` | пользовательские команды вставки |
| `Transform` | превращение строки в отдельную заметку |
| `Smart Rules` | правила выбора шаблона по виду строки |

**Переименования внутренних терминов.**

| Внутренний термин | В UI | Комментарий |
|---|---|---|
| TagWheel | TagWheel | Бренд, сохраняется |
| Binder | Binder (custom insert commands) | Бренд с расшифровкой в заголовке группы |
| Transform / Inline2Note | Transform / Inline to note | Сохраняется |
| Order | Fields | Отдельного понятия «порядок» в UI нет: порядок задаётся перетаскиванием в списке Fields |
| Deep Editor | правая колонка редактора Fields | Отдельного имени не имеет |
| Strip | Tag Bars | Путь в конфиге — `visual.tagBars.*` (было `visual.hierarchyBars.*` в PRD 1.0) |
| rails / stripes | Bars | |
| Prefix Resolver | Prefix priority | |
| zone | Left Block / Right Block | Понятие «segment» не вводится: у строки есть текст и два Block по краям |
| technical zone | — | Не вводится |
| free roam (off / minimal / full) | Placement modes: `Strict` / `Insert only` / `Free` | Значения `off`/`minimal`/`full` в конфиге сохраняются |
| separator1 / separator2 | First Separator / Second Separator | |
| subtag | child Value | Значения `separate`/`combined` сохраняются |
| text_end | End of the text | Значение `text_end` сохраняется |
| status_tags | — | Из UI убрать полностью |
| payload | Transferred text | |
| processed token | Processed marker | |
| Flying button | Floating button | Возвращается как рабочая настройка, см. Р12 |
| Active Rules Path | — | Убрано из UI, путь остаётся внутренним |
| YAML note format | — | Убрано: заменено правилом `Raw` / `Clean` у каждого Value |

## 8. Схема конфига v2 и миграция

### 8.1 Целевая форма

Принцип: **путь в конфиге повторяет путь в меню.** `<tab>.<group-area>.<setting>`.

```
schemaVersion: 2

features.navigation.enabled
features.pkm.enabled
features.visual.enabled
features.transform.enabled

editor.selectAll.enabled                 ← globalFunctions.enhancedSelectAll.enabled
editor.selectAll.mode                    ← globalFunctions.enhancedSelectAll.mode
editor.selectAll.useDelay                ← globalFunctions.enhancedSelectAll.useMultiPressDelay
editor.selectAll.delayMs                 ← globalFunctions.enhancedSelectAll.delayMs
editor.selectAll.clearOnLast             ← globalFunctions.enhancedSelectAll.clearSelectionOnLastPress
editor.binder.rows[]                     ← ui.binderRows

navigation.moveLine.*                    без изменений
navigation.moveSelection.*               без изменений
navigation.jumpToHeader.*                без изменений
navigation.navigateInline.*              без изменений

pkm.fields.order                         ← pkm.behavior.order
pkm.fields.taxonomy                      ← pkm.taxonomy
pkm.fields.elements                      ← pkm.behavior.elements
pkm.lineFormat.separator1                ← pkm.behavior.io.separator1
pkm.lineFormat.separator2                ← pkm.behavior.io.separator2
pkm.behavior.childTagFormat              ← pkm.behavior.subtagFormat
pkm.behavior.cycleEndBehavior            без изменений
pkm.behavior.cursorPolicy                без изменений
pkm.placement.keepPrefixInsertOnly       ← pkm.behavior.freeRoam.minimalSeparator
pkm.placement.bulletInStrict             ← pkm.behavior.freeRoam.offPrefix
pkm.placement.fieldPrefixInsertOnly      ← pkm.behavior.freeRoam.minimalPrefix
pkm.placement.freeInsertPosition         ← pkm.behavior.freeRoam.fullPlacement
pkm.prefixPriority.decideBy              ← (см. 8.3)
pkm.prefixPriority.fieldOrderSource      ← (см. 8.3)
pkm.prefixPriority.parentOrChild         ← (см. 8.3)
pkm.configNote.path                      ← pkm.tagWheelConfigPath
pkm.configNote.templatePath              ← pkm.tagWheelConfigTemplatePath
pkm.configNote.detail                    ← pkm.configExportMode

visual.tags.opacityLeft                  ← pkm.behavior.tagVisuals.opacity.left
visual.tags.opacityRight                 ← pkm.behavior.tagVisuals.opacity.right
visual.tags.textSizePct                  ← pkm.behavior.tagVisuals.tagTextSizePct
visual.tags.bubbleWidthPct               ← pkm.behavior.tagVisuals.tagBubbleWidthPct
visual.tags.bubbleHeightPct              ← pkm.behavior.tagVisuals.tagBubbleHeightPct
visual.tags.emptyBubblePct               ← pkm.behavior.tagVisuals.emptyBubbleSizePct
visual.tags.cornersPct                   ← pkm.behavior.tagVisuals.tagShapePct
visual.tags.byField                      ← pkm.behavior.tagVisuals.byField
visual.tags.byTag                        ← pkm.behavior.tagVisuals.byTag
visual.tags.userTags                     ← pkm.behavior.tagVisuals.userTags
visual.tagBars.*                         ← pkm.behavior.tagVisuals.strip.*
visual.tagWheel.showMarkers              ← pkm.behavior.colors.tagwheelHeader.showPrefix
visual.tagWheel.textColor                ← pkm.behavior.colors.tagwheelHeader.defaultTextColor
visual.tagWheel.fillColor                ← pkm.behavior.colors.tagwheelHeader.fillColor
visual.tagWheel.scroller.enabled         ← pkm.behavior.tagWheelScroller.enabled
visual.tagWheel.scroller.direction       ← pkm.behavior.tagWheelScroller.direction
visual.tagWheel.scroller.size            ← pkm.behavior.tagWheelScroller.size

transform.inline2note.*                  без изменений

advanced.generatedRulesPath              ← pkm.generatedRulesPath
advanced.devMode.enabled                 ← devMode.enabled
advanced.devMode.aiLog                   ← devMode.generateAiLog
advanced.devMode.logPath                 ← devMode.logPath
advanced.devMode.traceTagVisualLine      ← devMode.traceTagVisualLine

backups.tagWheelConfigApplies            без изменений

viewState.activeTab                      новое, вне undo
viewState.fieldOrder.expanded            ← ui.orderShow* и внутреннее состояние редактора
```

**Удаляются:** `visual.displayModes`, `visual.colors` (пустые, A5), `transform.inline2fleet` (A5), `pkm.executionBackend` (A5, Р7), `ui.activeSettingsTab`, `ui.visualSubTab`, `ui.hotkeysSubTab`, `ui.pkmSubTab`, `ui.orderShowInfoTips`, `ui.orderShowDeepEditor`, `ui.orderShowColorSettings`, `ui.orderActiveCommandsCollapsed`, `rules` и `meta` — **только если** поиск по репозиторию подтвердит, что они нигде не читаются; иначе оставить и сообщить.

### 8.2 Требования к миграции

- **МГ1.** Файл `src/core/config_migration.ts`, функция `migrate(raw): Config`. Идемпотентна: `migrate(migrate(x)) === migrate(x)`.
- **МГ2.** Ветка `1 → 2` переносит каждое поле из таблицы 8.1 и удаляет источник. Отсутствующее поле берётся из `buildDefaultConfig(schema)`.
- **МГ3.** Неизвестные ключи **сохраняются** в `_unmigrated` и логируются в консоль один раз при загрузке. Ничего не теряется молча.
- **МГ4.** Перед первой записью v2 плагин сохраняет копию исходного `data.json` в `data.backup.v1.json` через `plugin.saveData`-независимый путь (`app.vault.adapter.write` в папке плагина). Одноразово: если файл есть — не перезаписывать.
- **МГ5.** Тест `tests/regression/config_migration_v1_v2_tests.js` с фикстурой — реальным `data.json` v1, содержащим все ветки из `DEFAULT_CONFIG` (`main.js:2381-2521`) и непустые `pkm.behavior.order`, `tagVisuals.byTag`, `binderRows`. Проверяется: каждый путь из 8.1 перенесён; ни одно значение не изменилось; удалённые ветки отсутствуют; идемпотентность.

### 8.3 Открытый пункт по Prefix priority

Три настройки на `:6181`, `:6195`, `:6209` в текущем коде **не пишут в конфиг через `setConfigPatch`** — путь хранения нужно установить чтением окружающего кода. Исполнителю: найти фактический путь, зафиксировать его в этом разделе перед началом фазы 2 и только затем мигрировать. Если окажется, что настройки не персистятся вообще — это дефект, сообщить заказчику отдельно, не «исправлять» молча.

---

## 9. Инвентаризация и сверка с прототипом

Полная опись целевого состояния — **Приложение B**: 33 группы, 91 настройка, 21 свой блок, с точным текстом `name`, `desc`, `tip`, вариантами, диапазонами, зависимостями и путями. Приложение генерируется из прототипа скриптом `tests/prototype/dump_schema.js` и правится только через прототип: руками его не редактируют.

Этот раздел отвечает на другой вопрос — **куда девалась каждая настройка версии 1**. Ключ сверки — путь в конфиге; там, где в описи PRD 1.0 пути не было, сверка идёт по старому имени из `searchTerms`. Таблица сгенерирована `tests/prototype/reconcile.js`, её можно перепроверить в любой момент.

Итог сверки: **93** строки старой описи, из них **84** перенесены, **4** удалены по решению Р7, **5** сознательно сняты или переехали в свой блок. Новых путей, которых в PRD 1.0 не было, — **3**.

Колонка «v1» — файл и строка на коммите `a018bb0`; `R` = `src/ui/settings_sections_renderer.js`, `T` = `src/features/transform_feature.js`.

Как читать итог:

- **перенесено** — настройка есть в прототипе, путь совпадает или переименован по 7.3;
- **перенесено (по searchTerms)** — путь в старой описи отсутствовал, соответствие установлено по старому имени, которое лежит в `searchTerms` новой настройки;
- **снято** — настройки в панели больше нет, и это решение, а не потеря; причина в последней колонке;
- **удалено** — решение Р7, контрол убран из UI.

Требование: **И1.** Каждая строка со статусом «перенесено» обязана находиться поиском по старому имени. Проверяется гейтом: для каждой пары «старое имя → id» поиск по старому имени возвращает эту настройку.

**И2.** Ни одна строка не может появиться в состоянии «нет соответствия». Если после изменения прототипа сверка выдаёт такую строку — это ошибка: либо в прототипе потеряна настройка, либо решение о её снятии не записано.

| итог | v1 | было | путь | стало в прототипе |
|------|----|------|------|--------------------|
| перенесено | R:1987 | `<dynamic> module` / `Enable/disable … globally` | `features.navigation.enabled` | Navigation (`module-navigation`, Modules) |
| перенесено | R:1987 | — | `features.pkm.enabled` | Tags & PKM (`module-pkm`, Modules) |
| перенесено | R:1987 | — | `features.visual.enabled` | Visual (`module-visual`, Modules) |
| перенесено | R:1987 | — | `features.transform.enabled` | Transform (`module-transform`, Modules) |
| перенесено | R:2020 | `Enhanced Mod+A` | `editor.selectAll.enabled` | Expanded select all (`select-all-enabled`, Expanded select all) |
| перенесено | R:2029 | `Select-all mode` | `editor.selectAll.mode` | Selection steps (`select-all-steps`, Expanded select all) |
| перенесено | R:2043 | `Use multi-press delay` | `editor.selectAll.useDelay` | Count presses by timer (`select-all-timer`, Expanded select all) |
| перенесено | R:2053 | `Multi-press delay` | `editor.selectAll.delayMs` | Time between presses (`select-all-delay`, Expanded select all) |
| перенесено | R:2066 | `Last press clears selection` | `editor.selectAll.clearOnLast` | One more press clears it (`select-all-clear`, Expanded select all) |
| перенесено | R:1688 | `Enable Move Line` / `Command IDs: …` | `navigation.moveLine.enabled` | Move lines (`move-lines-enabled`, Moving lines) |
| перенесено | R:1698 | `No-selection mode` | `navigation.moveLine.noSelectionMode` | Moving behavior (`move-lines-no-selection`, Moving lines) |
| перенесено | R:1709 | `Header mode` | `navigation.moveLine.headerMode` | Moving headers (`move-lines-heading`, Moving lines) |
| перенесено | R:1720 | `Cross-section allowed` | `navigation.moveLine.crossSectionAllowed` | Cross heading boundaries (`move-lines-cross`, Moving lines) |
| перенесено | R:1730 | `Highlight moved lines` | `navigation.moveLine.highlightMovedLines` | Select after moving (`move-lines-select`, Moving lines) |
| перенесено | R:1746 | `Enable inline text move` / `Command IDs: …` | `navigation.moveSelection.inlineEnabled` | Move selected text (`move-text-enabled`, Move left and move right) |
| перенесено | R:1754 | `Inline move mode` | `navigation.moveSelection.inlineMoveMode` | Movement step (`move-text-step`, Move left and move right) |
| перенесено | R:1771 | `Enable PrefixCycler` | `navigation.moveSelection.prefixCyclerEnabled` | Cycle line Prefixes (`prefix-cycle-enabled`, Move left and move right) |
| перенесено | R:1791 | `On cycle end` | `navigation.moveSelection.onCycleEnd` | After the last one (`prefix-cycle-end`, Move left and move right) |
| перенесено | R:1802 | `Indent fallback` | `navigation.moveSelection.indentFallbackEnabled` | Change the indent (`indent-fallback`, Move left and move right) |
| перенесено | R:1817 | `Enable Jump To Header` / `Command IDs: …` | `navigation.jumpToHeader.enabled` | Jump between headings (`heading-jumps-enabled`, Jumping between headings) |
| перенесено | R:1825 | `Center cursor` | `navigation.jumpToHeader.centerCursor` | Center the target (`heading-jumps-center`, Jumping between headings) |
| перенесено | R:1833 | `Jump mode` | `navigation.jumpToHeader.jumpMode` | Jump target (`heading-jumps-mode`, Jumping between headings) |
| перенесено | R:1845 | `Edge behavior` | `navigation.jumpToHeader.edgeMode` | Where in the section (`heading-jumps-edge`, Jumping between headings) |
| перенесено | R:1858 | `Jump cursor position` | `navigation.jumpToHeader.jumpCursorPosition` | Cursor on arrival (`heading-jumps-cursor`, Jumping between headings) |
| перенесено | R:1871 | `Enable Navigate Inline` / `Command IDs: …` | `navigation.navigateInline.enabled` | Move cursor inside a line (`in-line-enabled`, Moving inside a line) |
| перенесено | R:1879 | `Step mode` | `navigation.navigateInline.stepMode` | Step size (`in-line-step`, Moving inside a line) |
| перенесено | R:1891 | `Allow crossing separators` | `navigation.navigateInline.boundaryJump` | Continue past a Separator (`in-line-cross`, Moving inside a line) |
| перенесено | R:1899 | `On boundary` | `navigation.navigateInline.onBoundary` | At the far end (`in-line-boundary`, Moving inside a line) |
| перенесено | R:5922 | `Separator 1` (описание за тумблером подсказок) | `pkm.lineFormat.separator1` | First Separator (`separator-1`, Separators) |
| перенесено | R:5941 | `Separator 2` | `pkm.lineFormat.separator2` | Second Separator (`separator-2`, Separators) |
| перенесено | R:6707 | `Subtag format` / `… status_tags commands` | `pkm.behavior.childTagFormat` | Child tag format (`child-tag-format`, Writing rules) |
| перенесено | R:6720 | `Line prefix after end of cycle` | `pkm.behavior.cycleEndBehavior` | When a line empties out (`cycle-end-behavior`, Writing rules) |
| перенесено | R:6733 | `Cursor behavior` | `pkm.behavior.cursorPolicy` | Cursor after an action (`cursor-policy`, Writing rules) |
| перенесено | R:6748 | `Minimal mode separators` | `pkm.placement.keepPrefixInsertOnly` | Insert only: keep the Prefix (`placement-keep-prefix`, Placement modes) |
| перенесено | R:6761 | `OFF mode prefix` (описание в 3 строки) | `pkm.placement.bulletInStrict` | Strict: add a bullet (`placement-bullet-strict`, Placement modes) |
| перенесено | R:6774 | `Minimal mode prefix` | `pkm.placement.fieldPrefixInsertOnly` | Insert only: use Field Prefix (`placement-field-prefix`, Placement modes) |
| перенесено | R:6787 | `Full mode: where to input element if cursor inside text?` | `pkm.placement.freeInsertPosition` | Free: insert position (`placement-free-position`, Placement modes) |
| перенесено | R:6181 | `Main checkbox priority` | `pkm.prefixPriority.decideBy` | Decide by (`prefix-priority-decide`, Prefix priority) |
| перенесено | R:6195 | `Fields order mode` | `pkm.prefixPriority.fieldOrderSource` | Field order source (`prefix-priority-source`, Prefix priority) |
| перенесено | R:6209 | `Tag/Subtag priority` | `pkm.prefixPriority.parentOrChild` | Parent or child wins (`prefix-priority-parent`, Prefix priority) |
| перенесено | R:5817 | `Config Export Mode` | `pkm.configNote.detail` | How much detail (`config-note-detail`, Config note) |
| перенесено | R:5833 | `TagWheel Note Editor` | `pkm.configNote.path` | Where to keep it (`config-note-path`, Config note) |
| перенесено | R:753 | `Opacity Left` | `visual.tags.opacityLeft` | Opacity before the text (`tags-opacity-left`, Tag appearance) |
| перенесено | R:814 | `Opacity Right` | `visual.tags.opacityRight` | Opacity after the text (`tags-opacity-right`, Tag appearance) |
| перенесено | R:875 | `Tag text size` | `visual.tags.textSizePct` | Text size (`tags-text-size`, Tag appearance) |
| перенесено | R:941 | `Tag bubble size - width` | `visual.tags.bubbleWidthPct` | Bubble width (`tags-bubble-width`, Tag appearance) |
| перенесено | R:1007 | `Tag bubble size - height` | `visual.tags.bubbleHeightPct` | Bubble height (`tags-bubble-height`, Tag appearance) |
| перенесено | R:1073 | `Empty bubble size` | `visual.tags.emptyBubblePct` | Empty bubble width (`tags-empty-bubble`, Tag appearance) |
| перенесено | R:1136 | `Tag shape` / `Round <-> Square` | `visual.tags.cornersPct` | Bubble corners (`tags-corners`, Tag appearance) |
| перенесено | R:1206 | `Activate strip` | `visual.tagBars.active` | Tag Bars (`bars-active`, Tag Bars) |
| перенесено | R:1216 | `Strip field` | `visual.tagBars.fieldId` | Which Field draws Bars (`bars-field`, Tag Bars) |
| перенесено | R:1232 | `Strip tag visibility` | `visual.tagBars.tagVisibility` | Show the Field's tag (`bars-show-tag`, Tag Bars) |
| перенесено | R:1251 | `Hide separator?` | `visual.tagBars.hideSeparatorWhenOnlyStripToken` | Hide the leftover marker (`bars-hide-separator`, Tag Bars) |
| перенесено | R:1262 | `Strip mode` | `visual.tagBars.mode` | Bar arrangement (`bars-mode`, Tag Bars) |
| перенесено | R:1278 | `Stripes to show` | `visual.tagBars.stripesToShow` | Number of Bars (`bars-count`, Tag Bars) |
| перенесено | R:1313 | `Strip thickness` | `visual.tagBars.thickness` | Bar thickness (`bars-thickness`, Tag Bars) |
| перенесено | R:1348 | `Parent/child strip distance` | `visual.tagBars.childOffset` | Space between Bars (`bars-gap`, Tag Bars) |
| перенесено | R:1383 | `Strip spacing` | `visual.tagBars.spacing` | Distance from the text (`bars-distance`, Tag Bars) |
| перенесено | R:686 | `Show prefix` | `visual.tagWheel.showMarkers` | Show tag markers (`panel-markers`, TagWheel) |
| перенесено | R:498 | `<dynamic>` цвет текста | `visual.tagWheel.textColor` | Text color (`panel-text-color`, TagWheel) |
| перенесено | R:498 | `<dynamic>` цвет фона | `visual.tagWheel.fillColor` | Background (`panel-background`, TagWheel) |
| перенесено | R:561 | `TagWheel Scroller` | `visual.tagWheel.scroller.enabled` | Scroller (`scroller-enabled`, TagWheel) |
| перенесено | R:573 | `Scroller direction` | `visual.tagWheel.scroller.direction` | Opens (`scroller-direction`, TagWheel) |
| перенесено | R:592 | `Scroller size` / `(1..20)` | `visual.tagWheel.scroller.size` | Values per side (`scroller-size`, TagWheel) |
| перенесено | T:1796 | `Inline2Note enabled` | `transform.inline2note.enabled` | Inline to note (`i2n-enabled`, Inline to note) |
| перенесено | T:1806 | `Templates folder` | `transform.inline2note.templatesFolder` | Templates folder (`i2n-templates-folder`, Inline to note) |
| перенесено | T:1820 | `Output folder for new notes` | `transform.inline2note.outputFolder` | New notes folder (`i2n-output-folder`, Inline to note) |
| перенесено | T:1835 | `Default template` | `transform.inline2note.defaultTemplate` | Default template (`i2n-default-template`, Inline to note) |
| перенесено | T:1850 | `Note name mode` | `transform.inline2note.noteName.mode` | Note name (`naming-mode`, Naming) |
| перенесено | T:1863 | `Explicit name delimiters` | `transform.inline2note.noteName.delimiters` | Name brackets (`naming-delimiters`, Naming) |
| перенесено | T:1876 | `Auto title word count` | `transform.inline2note.noteName.wordCount` | Words to use instead (`naming-word-count`, Naming) |
| перенесено | T:1890 | `Name collision mode` | `transform.inline2note.nameCollision.mode` | If the name is taken (`naming-collision`, Naming) |
| перенесено | T:1904 | `Where to place inline text?` | `transform.inline2note.placement.position` | Where to put the text (`content-position`, Note content) |
| перенесено | T:1917 | `Inserted block header` | `transform.inline2note.placement.headerMode` | Line above the text (`content-header-mode`, Note content) |
| перенесено | T:1930 | `Custom header text` | `transform.inline2note.placement.customHeader` | What it says (`content-header-text`, Note content) |
| перенесено | T:1941 | `Datetime header format` | `transform.inline2note.placement.datetimeFormat` | Date format (`content-datetime`, Note content) |
| перенесено | T:1976 | `Sublines behavior` | `transform.inline2note.sublines` | Lines indented under it (`content-sublines`, Note content) |
| перенесено | T:1966 | `Open transformed note` | `transform.inline2note.openTarget` | Open the note afterwards (`content-open`, Note content) |
| перенесено | T:1997 | `Replace payload with note link` | `transform.inline2note.sourceProcessing.replaceWithLink` | Leave a link behind (`source-link`, Source line) |
| перенесено | T:2007 | `Processed token` | `transform.inline2note.sourceProcessing.token` | Mark the line as done (`source-marker`, Source line) |
| перенесено | T:2018 | `Processed token panel` | `transform.inline2note.sourceProcessing.panel` | Where the mark goes (`source-marker-position`, Source line) |
| перенесено | R:1577 | `Enable Dev Mode` | `advanced.devMode.enabled` | Developer logging (`dev-mode`, Diagnostics) |
| перенесено | R:1587 | `Generate log for AI?` | `advanced.devMode.aiLog` | Machine-readable log (`dev-ai-log`, Diagnostics) |
| перенесено | R:1598 | `Log Path` / `Plugin writes <path>.new.* …` | `advanced.devMode.logPath` | Log file (`dev-log-path`, Diagnostics) |
| снято | R:1779 | `Prefix Cycle Order` (длинное описание) | `navigation.moveSelection.cycleOrder` | переехало в свой блок renderCycleOrder, path сохраняется |
| снято | R:1666 | `Open Detailed Template` (был в Advanced) | `кнопка Open` | остаётся кнопкой без path в группе Note content |
| снято | T:1953 | `YAML note format` | `transform.inline2note.yamlFormat` | снято сознательно: заменено правилом Raw / Clean у каждого Value (10.9, Я3) |
| снято | R:1636 | `Active Rules Path` | `advanced.generatedRulesPath` | снято из UI сознательно: путь остаётся внутренним (10.12, Э4) |
| снято | R:1651 | `Regenerate Rules Now` / `Force rewrite … from plugin JSON` | `кнопка` | остаётся кнопкой без path в группе Generated files |
| удалено | R:1997 | `Undo last settings change` | `DELETE` (Р7; остаётся командой) | — |
| удалено | T:1989 | `Flying button` / `Beta limitation: …` | `DELETE` (Р7, З8) | — |
| удалено | R:1628 | `Execution Backend` | `DELETE` (Р7, единственное значение) | — |
| удалено | R:1558 | `Flush Settings Now` | `DELETE` (Р7) | — |

### Пути, которых не было в описи v1.0 (3)

| путь | настройка | группа |
|------|-----------|--------|
| `ui.showTips` | Show tips (`show-tips`) | Help |
| `navigation.moveSelection.rightCycles` | Cycle in both directions (`right-cycles`) | Move left and move right |
| `transform.inline2note.floatingButton` | Floating button (`i2n-floating`) | Inline to note |

---

## 10. Самописные блоки

В прототипе 21 запись `kind: 'custom'` и 12 рендереров. Все они подчиняются общим правилам: без инлайн-стилей, без хардкода цветов, без полного ре-рендера панели, с функцией очистки (С5). Ниже — что каждый блок обязан делать. Точные тексты — Приложение B, точная геометрия — прототип.

Общее требование ко всем блокам: **О0.** Блок не хранит своё состояние в конфиге, если это состояние не настройка. Свёрнутость секции, выбранный Field в редакторе, открытая подсказка — это `viewState` в памяти, оно не пишется в `data.json`.

### 10.1 Вводный коллаут вкладки — `renderTabCallout`

Записи: `general-callout`, `keyboard-callout`, `nav-callout`, `pkm-callout`, `visual-callout`, `transform-callout`, `advanced-callout`.

- **К1.** Первый блок каждой вкладки: одна фраза о том, что вкладка делает, абзац о том, чего она не делает без спроса, и кнопка перехода на связанную настройку или в руководство.
- **К2.** Всё длинное объяснение вкладки — в `tip` коллаута, не в тексте (Ст12).
- **К3.** Кнопка коллаута ведёт либо на `id` настройки внутри панели (переводит фокус и раскрывает подсказку), либо запускает действие из 5.6.

### 10.2 Редактор Fields — `renderFieldEditor`

Запись `field-editor`, группа `fields`. Это самый большой блок; он заменяет `renderPkmOrderBoardSection` (~3400 строк) и Deep Editor.

Две колонки под общей шапкой-таблицей: слева `Fields`, справа `Values` (для Field типа `element` — `Element`).

- **Ф1.** Левая колонка — список Fields, разделённый пунктирной линией на `Left Block` и `Right Block`. Сторона Field определяется тем, в какой половине он лежит.
- **Ф2.** Перенос Field между сторонами и изменение порядка — **только перетаскиванием**, и только за ручку `⠿`. Кнопок-стрелок нет (решение заказчика). Ручка, а не строка, несёт `draggable`: строка содержит поля ввода, и браузер отдал бы нажатие им.
- **Ф3.** Дочерний Field двигается вместе с родителем и не может оказаться на другой стороне. Перетаскивание берёт Block целиком (терминология — 7.3).
- **Ф4.** Тип Field показан чипом с цветом типа: `tag` — `#c2683f`, `link` — `#3b82c4`, `element` — `#7a9e3b`. Цвет типа не совпадает с акцентом темы: акцент занят основными действиями.
- **Ф5.** Кнопка `Add Field` — нейтральная, не акцентная: добавление Field не главное действие на странице.
- **Ф6.** Правая колонка — выбранный Field: короткое имя, тип, удаление (красное, с подтверждением), таблица Values, режим `Behavior`, таблица команд Field, для `element` — строка формата и маркера.
- **Ф7.** Таблица Values, колонки в этом порядке: ручка, `Level`, `Value`, `Prefix`, `Show`, `Fill`, `Text`, `Preview`, удаление. Для Field типа `link` колонок цвета нет: у ссылки нет своего цвета, остаются `Value` и `Prefix`.
- **Ф8.** `Level` — одна кнопка со стрелкой: делает Value дочерним или возвращает на верхний уровень. Дочерняя строка подкрашена фоном, а не отступом.
- **Ф9.** `Show` = `default` / `empty` / `custom`. `empty` рисует цвет без текста; ширина этого маркера — отдельная настройка в группе `tag-appearance`, на неё стоит `seeAlso`.
- **Ф10.** Порядок Values задаёт порядок цикла команд `next` и `previous`. Это сказано в `tip` таблицы, а не в описании каждой строки.
- **Ф11.** Таблица команд Field: три колонки — команда, что делает, хоткей. Хоткей открывает настройки Obsidian на нужной команде (5.6).
- **Ф12.** Перенос кода — это перенос, а не переписывание: поведение черновиков, история, диалог конфликта и удаление Field сохраняются. Перед переносом снять поведение тестом `order_deep_editor_state_tests.js`, расширив его; после переноса тест проходит без правок.
- **Ф13.** Существующий debounce черновиков (`scheduleOrderDeepCommit`) сохраняется; записи идут с `coalesceKey`.
- **Ф14.** Опознание элементов по `textContent` (`"Order Main Table"`, `"Order Settings"`) удаляется; вместо него стабильные классы.
- **Ф15.** Тумблеры `Show Info & Tips` / `Show DeepEditor` / `Show Color Settings` удаляются. Описания и подсказки показываются всегда.
- **Ф16.** 17 путей конфига, которые пишет этот редактор (`pkm.behavior.elements.byField.*`, `pkm.behavior.leftMode.*`, `visual.tags.byTag.*`, `visual.tags.userTags.*`), описываются в `types.ts` явным типом, а не `Record<string, unknown>`. Фактический набор ключей выписать чтением кода до фазы 2.
- **Ф17.** Доступность: перетаскивание — единственный способ переупорядочивания, клавиатурного пути нет. Это осознанное решение заказчика. Если при подаче в community review это будет замечено, добавляется команда `Move Field up` / `Move Field down` с фокусом на строке, а не кнопки в списке.

### 10.3 Живые предпросмотры — `renderLinePreview`, `renderTagPreview`, `renderBarsPreview`, `renderWheelPreview`

- **П1.** Предпросмотр показывает результат текущих настроек на выдуманной строке, а не на заметке пользователя. Он не редактируем.
- **П2.** Предпросмотр перерисовывается точечно, по `bind(path)`, на тех же путях, что и настройки группы. Полного ре-рендера панели он не вызывает.
- **П3.** `renderLinePreview` показывает строку целиком: `Prefix`, Left Block, `First Separator`, текст, `Second Separator`, Right Block. Показываются Fields, а не значения одного Field.
- **П4.** `renderBarsPreview` показывает дерево из вложенных строк. Требование заказчика: **текст строк не зависит от того, какой Field выбран в `Which Field draws Bars`.** Строка всегда несёт все свои теги; переключение Field меняет только полосы. Скрывается ровно один тег — тот, чей Field рисует Bar, и только если выключено `Show the Field's tag`.
- **П5.** Полоса не занимает места в потоке: она рисуется абсолютным `::before` в отведённом жёлобе, а текст отодвинут на все полосы сразу. Изменение `Number of Bars` или толщины не сдвигает текст.
- **П6.** Дорожка полосы считается от левого края: дорожка 0 — самая левая, ребёнок получает следующую. Инвертировать нельзя: родитель должен быть слева от ребёнка.
- **П7.** `renderWheelPreview` показывает панель над строкой и скроллер значений: текущее значение в середине, вверх — предыдущие, вниз — следующие, список замкнут. Направление проверяется тестом вывода, а не чтением кода (Г20).
- **П8.** Панель предпросмотра не выходит за границы блока: скроллер позиционируется от центра строки, а высота блока учитывает выпуски вверх и вниз через CSS-переменные.

### 10.4 Binder — `renderBinder`

- **Б1.** Переезжает в `src/ui/settings/custom/binder.ts`, группа `binder` вкладки Keyboard.
- **Б2.** Колонка `Command ID` и подпись `inlineOverhaul_Binder_*` убираются из таблицы (M6). ID остаётся внутренним.
- **Б3.** Подсказки `Bind commands via Obsidian Settings -> Hotkeys` и `Only Description is editable…` переезжают в `intro` и `tip` группы.
- **Б4.** Сетка таблицы переносится в CSS.
- **Б5.** Строка `binder-system-smart-bracket` остаётся системной и неудаляемой.
- **Б6.** Порядок строк меняется перетаскиванием за ручку.
- **Б7.** `Math.random()` и `Date.now()` в генерации `rowId` сохраняются как есть.

### 10.5 Справочник команд — `renderCommandReference`

Запись `command-list`, группа `command-reference`.

- **К-1.** Все команды плагина одной таблицей: имя, что делает, хоткей. Ни одного ID команды в UI.
- **К-2.** Колонка хоткея показывает назначенный хоткей или прочерк и открывает настройки Obsidian на этой команде. Использование `app.hotkeyManager` и `app.setting` — приватное API: обязателен feature-detect и `try/catch` с тихим отказом (кнопка становится неактивной, панель не падает).
- **К-3.** Плагин не назначает хоткеев по умолчанию.
- **К-4.** Строки сгруппированы по модулям в том же порядке, что вкладки.

### 10.6 Разбор `Move left` / `Move right` — `renderLeftRightOrder`

Запись `left-right-order`, группа `left-right`.

- **Д1.** Две таблицы: что делает `Move left` и что делает `Move right` в зависимости от того, что выделено и где стоит курсор. Это документация поведения, а не настройка.
- **Д2.** Таблицы обязаны совпадать с фактическим поведением `navigation_runtime.js:511-553`. Поведение асимметрично, и это не опечатка: `Move left` циклирует Prefix всегда, когда отступ нулевой; `Move right` — только если строка ещё не элемент списка, иначе увеличивает отступ.
- **Д3.** Если реализация меняется, таблица меняется вместе с ней в том же коммите.

### 10.7 Порядок Prefix — `renderCycleOrder`, `renderFieldOrderList`, `renderPrefixOrderList`

- **Ц1.** `renderCycleOrder` — перетаскиваемый список Prefix, по которому идёт цикл. Пустая строка в списке означает «обычная строка без Prefix» и подписана словами, а не оставлена пустой.
- **Ц2.** `renderFieldOrderList` и `renderPrefixOrderList` — два списка группы `prefix-priority`. Виден тот, который выбран в `Decide by`; второй скрыт через `visible`, а не выключен.
- **Ц3.** Оба списка переупорядочиваются перетаскиванием за ручку.
- **Ц4.** До фазы 2 установить фактом, сохраняются ли эти три настройки в конфиг (8.3). Не «исправлять» молча.

### 10.8 Smart Rules — `renderSmartRules`

Запись `smart-rules-list`, группа `smart-rules`.

- **С-1.** Переезжает в `src/ui/settings/custom/smart_rules.ts`.
- **С-2.** `createEl("h4", { text: "SmartTransform rules" })` удаляется — заголовок даёт группа.
- **С-3.** У правила есть своё имя, которое задаёт пользователь. Пустое имя показывается как `Rule N`.
- **С-4.** Правило — это карточка, а не серый прямоугольник: условия по типам Fields внутри, шаблон снизу.
- **С-5.** Значение к условию добавляется кнопкой `+` в строке типа, которая открывает диалог выбора: Field, затем Value. Ввода «через запятую» и подсказки `Press Enter to add` нет.
- **С-6.** Порядок правил меняется перетаскиванием; порядок значим — правила читаются сверху вниз, срабатывает первое подходящее. Это сказано в `tip` группы.
- **С-7.** Внутри одного типа Field условия сейчас соединяются как ИЛИ, между типами — как И (`transform_feature.js:369-398`). UI обязан это показывать словами. Требование заказчика на И внутри типа — отдельная работа в фазе 5 раздела 11, пункт 5.2.

### 10.9 Свойства заметки — `renderYamlMapping`

Запись `yaml-mapping`, группа `note-properties`.

- **Я1.** Таблица: Field → имя свойства заметки → пример того, что будет записано. Пример считается из текущих настроек и пересчитывается при любом изменении, включая правило `Raw` / `Clean` и `Cardinality`.
- **Я2.** Пример показывает именно строку YAML, включая форму списка, когда свойство собирает несколько Fields.
- **Я3.** Правило значения задаётся у каждого Value: `Raw` пишет так, как в строке (`#todo`, `[[Note]]`, `📅 2026-08-24`), `Clean` — только само значение. Глобальной настройки формата больше нет.
- **Я4.** Типы свойств в vault читаются через `app.metadataTypeManager`, если он доступен; при отказе таблица работает без него и не показывает тип.

### 10.10 Floating button — `renderFloatingButton`

Запись `i2n-button-preview`, группа `inline-to-note`.

- **Ж1.** Предпросмотр кнопки, которая появляется у строки и превращает её в заметку. Настройка возвращается в UI (Р12), в отличие от решения Р7 для placeholder-версии.
- **Ж2.** Реализация требует декораций редактора CM6; это отдельная задача фазы 5. Пока она не сделана, настройка в UI не показывается: лучше её отсутствие, чем тумблер, который ничего не делает.

### 10.11 Цветовые пикеры

`addTagwheelHeaderColorSetting` и `renderColorsSection` переводятся на `kind: 'color'` из схемы. Хардкод `#111111` / `#ffffff` заменяется на переменные темы. Кнопка сброса — `allowReset: true`.

### 10.12 Конфиг-заметка и экспорт

Группа `config-note`, кнопки `Open` и `Apply`.

- **Э1.** Заметка работает в обе стороны: экспорт настроек в заметку и применение заметки к настройкам. Это одновременно резервная копия, способ перенести настройки в другой vault и удобный редактор для длинных списков Values.
- **Э2.** Перед применением показывается, что изменится. Применение — действие с подтверждением (5.6).
- **Э3.** Путь заметки — настройка `pkm.configNote.path`.
- **Э4.** Эта заметка не то же самое, что сгенерированный служебный файл из группы `generated-files`: первая для человека, второй перезаписывается плагином. Разница объясняется в `tip` обеих групп.

## 11. Фазы и критерии приёмки

Каждая фаза — отдельный коммит (или серия), проходящая свои гейты из раздела 12. Фаза не начинается, пока предыдущая не принята.

### Фаза 0 — инфраструктура

Без изменений поведения.

1. `typescript` и `eslint` в `devDependencies`; `tsconfig.json` со `strict: true`, `allowJs: true`, `checkJs: false`.
2. `build/release.js` собирает `.ts` (esbuild умеет из коробки; добавить `.ts` в `resolveExtensions`).
3. `package.json`: `test` запускает все файлы из `tests/regression/*_tests.js` и `tests/**/*_tests.js`; `lint`; `typecheck`.
4. `.github/workflows/ci.yml`: `npm ci && npm run lint && npm run typecheck && npm test && npm run build`.
5. Пустой `styles.css` с комментарием-заголовком.
6. `LICENSE` (MIT, если заказчик не укажет иное — спросить).

**Приёмка:** CI зелёный; `npm run build` даёт работоспособный `dist/main.js`; `node --check dist/main.js` проходит.

### Фаза 1 — каркас настроек

Схема, рендерер, `ConfigStore`. Содержание настроек **не меняется**: те же 101 имя, те же описания, те же пути конфига v1.

1. `types.ts`, `render.ts`, `bindings.ts`, `tabs.ts`, `settings_tab.ts` по разделам 5.2–5.5.
2. Все 101 настройка версии 1 описана в `schema/*.ts` с ещё старыми именами и описаниями: фаза 1 переносит содержимое в схему, не меняя текстов. К целевым 91 настройке и текстам Приложения B панель приводят фазы 3 и 4.
3. Самописные редакторы подключены как `kind: 'custom'` вызовом существующего кода (перенос — фаза 3).
4. `ConfigStore` по 5.5.
5. Подписка `main.js:5152` удалена.
6. `normalizeSettingsTypography` и `normalizeSettingsVisualSystem` удалены; `styles.css` наполнен.
7. `buildDefaultConfig(schema)` заменяет ручной `DEFAULT_CONFIG` для всех полей, представленных в схеме. Поля, которых в схеме нет (`taxonomy`, `order`, `byTag`, `backups`), остаются в отдельном `NON_SCHEMA_DEFAULTS`.

**Приёмка:**
- Все настройки на месте, значения читаются и пишутся правильно.
- Перетаскивание слайдера не вызывает `display()`; проверяется тестом с моком.
- После перетаскивания слайдера в undo-стеке **одна** запись.
- Ввод в текстовое поле не теряет фокус.
- Переключение вкладки не пишет в undo-стек.
- Гейты Г1–Г6.

### Фаза 2 — схема конфига v2

1. `types.ts`: тип `Config` v2 по 8.1.
2. `config_migration.ts`: ветка `1 → 2` по 8.2.
3. Все `path` в схеме переведены на v2.
4. Все чтения конфига в движках (`pkm_v2/**`, `navigation_runtime.js`, `src/core/**`, `src/features/**`) переведены на новые пути. Это единственное разрешённое касание файлов из З3.
5. Пункт 8.3 закрыт: путь Prefix priority установлен и зафиксирован в этом документе.
6. Пункт 10.2 закрыт: ключи Field details выписаны в тип.
7. Мёртвые ветки удалены.

**Приёмка:** тест миграции (МГ5) зелёный; ручная проверка на реальном `data.json` заказчика — все настройки на месте после обновления; `data.backup.v1.json` создан.

### Фаза 3 — структура меню

1. Шесть вкладок по 6.1, группы по 6.2.
2. Подвкладки и `cfg.ui.*SubTab` удалены.
3. Тумблеры видимости удалены (9.9); их роль берут сворачиваемые секции и `viewState`.
4. Кнопки вкладок без `mod-cta`, с `role="tab"` и клавиатурой (5.4).
5. Заголовок с названием плагина удалён.
6. Ни одного `createEl("hN")` в слое настроек.
7. Поведение выключенного модуля по 6.3.
8. Самописные редакторы физически перенесены в `custom/` (раздел 10); старые файлы рендерера удалены.
9. Enhanced Ctrl+A и Binder — в General (M7).

**Приёмка:** гейты Г1–Г9; ручной проход по всем шести вкладкам с выключенными и включёнными модулями.

### Фаза 4 — тексты

1. Все имена, описания и метки вариантов — по таблицам раздела 9.
2. `intro` у каждой группы, где раздел 9 его задаёт.
3. `searchTerms` со старыми именами (С4).
4. Все строки — в `strings.ts`.
5. Служебные контролы удалены (Р7).
6. Тексты `Notice` приведены к 5.6.
7. Слайдеры показывают значение с единицей.

**Приёмка:** гейт Г10 (линтер текстов); ревью заказчиком.

### Фаза 5 — команды, документация и отложенная работа движка

**5.1 Команды и документация.**

1. Имена команд по 7.2 (ID пока не меняются).
2. `README.md` и `instructions.md` приведены в соответствие: в частности, исправлено размещение Enhanced Ctrl+A (M7), удалены упоминания удалённых контролов.
3. Глоссарий терминов из 7.3 добавлен в `instructions.md`.
4. `showcase.md` и гифки: перечислить те, что разошлись с новым UI, и сообщить заказчику. **Гифки не перезаписывать** — это его материал.

**5.2 Отложенная работа движка.**

Прототип согласован раньше, чем часть движка научилась делать то, что он показывает. Эти четыре задачи — не UI, а поведение, и они делаются в фазе 5, после того как панель уже работает.

1. **`Cycle in both directions`** (`navigation.moveSelection.rightCycles`) — новая настройка. Сейчас `Move right` циклирует Prefix только на строке, которая ещё не элемент списка (`navigation_runtime.js:511-553`), и это асимметрия по отношению к `Move left`. Настройка включает симметричное поведение. Таблица 10.6 обновляется в том же коммите.
2. **И внутри одного типа Field в Smart Rules.** Сейчас внутри типа условия соединяются как ИЛИ (`transform_feature.js:369-398`). Заказчик хочет возможность И. Требования: значение по умолчанию не меняет поведение существующих правил; форма конфига получает признак соединения у каждого блока условий; UI показывает выбор словами, а не значком.
3. **Floating button** (`transform.inline2note.floatingButton`) — требует декораций редактора CM6. Настройка появляется в схеме вместе с реализацией; до этого её в панели нет. Показывать тумблер, который ничего не делает, хуже, чем не показывать настройку.
4. **Типы свойств заметки через `app.metadataTypeManager`** для таблицы 10.9. API недокументированное: feature-detect и `try/catch`, при отказе таблица работает без колонки типа.

Критерии приёмки фазы 5 (в дополнение к существующим): каждая из четырёх задач либо сделана и покрыта тестом вывода (Г20), либо снята заказчиком письменно, и тогда соответствующая настройка удаляется из схемы, а не остаётся неработающей.

**Приёмка фазы 5:** ревью заказчиком, плюс тесты вывода (Г20) на каждую сделанную задачу 5.2.

### Фаза 6 — блокеры community review

Выполняется перед подачей, не раньше.

1. Удалить `src/core/vault_module_bridge.js`, все `new Function` (A1), все `hasValidX` / `loadXSafe` / `createXFallback` и файлы `*_fallback.js` (A2). Заменить на статические импорты. Удалить `build/release_entry.js` и его реестр; точка входа — `main.ts`.
2. Разобрать `main.js` (A3): `main.ts` содержит только `onload`, `onunload` и регистрацию. CM6-виджеты — в `src/ui/editor/`, конфиг — в `src/core/`.
3. ID команд в kebab-case (T7) с картой старых ID для документации.
4. Убрать `main.js` и `dist/` из репозитория, оставить только в релизах (A13). Обновить `.gitignore` и инструкции сборки.
5. `manifest.json`: заполнить или убрать `authorUrl`, добавить `fundingUrl`, если заказчик хочет.
6. Решить судьбу `plugin.app.setting.open()` (T8).

**Приёмка:** `grep` на `new Function|eval(` по `src/` и `main.ts` — пусто; `main.ts` меньше 300 строк; чек-лист гайдлайнов Obsidian пройден.

---

## 12. Автоматические гейты

Добавить как `npm run gate` — скрипт `tests/gates/settings_layer_gates.js`, падающий с внятным сообщением. Пути: `SETTINGS = src/ui/settings/**`, плюс `styles.css`.

Гейты Г13–Г21 не выдуманы: каждый из них написан по ошибке, которая уже случилась при работе над прототипом и была найдена не глазами. Работающие версии лежат в `tests/prototype/` и переносятся на реальный код как есть.

| ID | Проверка | Ожидание | С фазы |
|---|---|---|---|
| Г1 | `.style.` в `SETTINGS` | Только `setProperty('--io-*')`, иначе 0 | 1 |
| Г2 | Литералы цвета `#rgb`/`#rrggbb`/`rgb(`/`hsl(` в `SETTINGS` | 0 | 1 |
| Г3 | `createEl("h1".."h6")` в `SETTINGS` | 0 | 1 |
| Г4 | `innerHTML`/`outerHTML`/`insertAdjacentHTML` в `SETTINGS` | 0 | 1 |
| Г5 | `new Function`/`eval(` в `SETTINGS` | 0 | 1 |
| Г6 | Уникальность `id` во всей схеме; каждый `seeAlso.id` существует | Дублей нет, битых ссылок нет | 1 |
| Г7 | Каждый `path` есть в `buildDefaultConfig`; у каждого предиката непустой `deps`, и каждый путь из `deps` есть в схеме | Все | 1 |
| Г8 | `mod-cta` в `SETTINGS` | 0 | 3 |
| Г9 | `cfg.ui.` в `SETTINGS` | 0 | 3 |
| Г10 | Линтер текстов, см. ниже | 0 нарушений | 4 |
| Г11 | Ни одна группа не содержит больше 12 настроек, не считая `custom` | Иначе разбить | 3 |
| Г12 | У каждой группы есть `intro`, кроме вводных коллаутов `*-intro` | Все | 4 |
| Г13 | **Одна функция определена один раз.** Две одноимённые функции в файле — файл разбирается, гейт молчит, а работает вторая | Дублей нет | 1 |
| Г14 | **Каждый `render:` из схемы и каждый вызываемый помощник определён.** Гейт подставляет заглушки рендереров, чтобы вычислить схему, и без этой проверки удалённый рендерер проходит незамеченным | Все | 1 |
| Г15 | **Один селектор объявлен не больше двух раз** в `styles.css`. Блоки внутри `@media` из подсчёта исключаются: переопределение под размер экрана — это не наслоение | Иначе собрать в одно правило | 1 |
| Г16 | **Дымовой тест:** рендер каждой вкладки, переключение каждого тумблера модуля, открытие каждой подсказки, каждого своего блока и каждого диалога на заглушке DOM | Ни одного исключения | 1 |
| Г17 | **Сущности с заглавной в обе стороны:** заглавные из списка 7.3 разрешены в `name`, и они же обязательны — сущность со строчной в `name`, `desc`, `tip` или `intro` считается нарушением. Внутри `<code>` не проверяется | 0 нарушений | 4 |
| Г18 | `desc` не заканчивается точкой (Р10) | 0 нарушений | 4 |
| Г19 | Каждая `<code>`-ссылка на настройку или команду соответствует существующему имени из схемы | 0 битых ссылок | 4 |
| Г20 | **Проверка по выводу:** предпросмотры рендерятся на заглушке DOM, и проверяется результат — порядок значений в скроллере TagWheel, набор полос на каждой строке, вычисленное значение YAML, текст строки при переключении `Which Field draws Bars` | Совпадает с ожиданием | 3 |
| Г21 | Ни один текст не оканчивается двойным пробелом, не содержит `  ` внутри и не начинается с пробела | 0 | 4 |

**Линтер текстов (Г10)** — правила, каждое с указанием нарушившего `id`:

1. `name` в sentence case: второе и последующие слова с заглавной допускаются только из списка имён собственных и сущностей 7.3.
2. `name` — не больше 5 слов.
3. `desc`, если есть, — не больше 140 символов и **без точки в конце**.
4. `desc` не содержит: `inlineOverhaul_`, `Command ID`, `debounce`, `undo stack`, `runtime`, `backend`, `sprint`, `status_tags`, `.js`, `free roam`, `zone`, `Segment`, `Marker priority`.
5. `desc` не содержит диапазонов вида `(0..100`, `..%)`, ` px)`.
6. `desc` не начинается с `Enable/disable`.
7. `desc` не равен `name` и не является его перестановкой.
8. Метка варианта dropdown — sentence case, не содержит `_`.
9. Текст кнопки — одно-два слова, глагол в начале.
10. Сущность плагина написана с заглавной (Г17), кроме содержимого `<code>`.

**Требования к заглушке DOM для Г16 и Г20.** Заглушка обязана вести себя как настоящий DOM в двух местах, иначе тест зелёный, а проверка ничего не проверяет:

- запись `textContent = ""` **очищает детей**. Иначе каждый ре-рендер добавляет в дерево ещё одну копию панели, и проверка читает самую старую (найдено на прототипе: 11 копий дерева на одной вкладке);
- `style.setProperty` **запоминает значение**, и `getPropertyValue` его возвращает. Иначе все CSS-переменные читаются как пустые и любая проверка геометрии или цвета проходит на пустых строках.

## 13. Риски

| Риск | Вероятность | Что делать |
|---|---|---|
| Перенос Order board (~3400 строк) ломает поведение черновиков и историю | Высокая | Фаза 3 переносит код **без изменения логики**. Перед переносом — снять поведение тестом `order_deep_editor_state_tests.js`, расширив его; после переноса тест должен пройти без правок. |
| Миграция v1→v2 теряет пользовательские данные | Средняя, ущерб высокий | МГ3 (`_unmigrated`), МГ4 (резервная копия), МГ5 (тест на полной фикстуре). Заказчик проверяет на своём vault до релиза. |
| Пути конфига в движках найдены не все | Средняя | Перед фазой 2 составить полный список чтений: `grep -rn "behavior\.\|tagVisuals\|freeRoam\|globalFunctions" ` по `pkm_v2/ navigation_runtime.js src/`. Список приложить к коммиту фазы 2. |
| Prefix priority не персистится (8.3) | Неизвестна | Установить фактом до фазы 2. Не «исправлять» молча. |
| Точечное обновление (Р-4) сложнее полного ре-рендера и даст свои баги | Средняя | Явные `deps` у предикатов (Р-5) вместо магии. Тест: изменение пути обновляет ровно ожидаемый набор строк. |
| Расхождение гифок в `showcase.md` с новым UI | Высокая | Фаза 5 пункт 4: только перечислить, не трогать. |
| Дрейф между схемой и типом `Config` при работе на JS | — | Снят решением Р4: слой настроек на TS, `path` проверяется типом. |

---

## 14. Что считается выполненным

Работа завершена, когда:

1. Все шесть фаз приняты по своим критериям.
2. `npm run lint && npm run typecheck && npm test && npm run gate && npm run build` проходит локально и в CI.
3. Панель настроек: **семь вкладок**, 33 группы, заголовки через `setHeading()`, ни одного инлайн-стиля, ни одного хардкоженного цвета, ни одной подвкладки, ни одного тумблера видимости.
4. Перетаскивание любого слайдера: панель не перерисовывается, в undo-стеке одна запись.
5. Панель совпадает с согласованным прототипом по структуре и текстам: 91 настройка и 21 свой блок, тексты — из Приложения B. Расхождение с прототипом — дефект реализации, а не вариант.
6. Сверка раздела 9 не содержит ни одной строки «нет соответствия»: все 84 перенесённые настройки на месте и находятся поиском по старому имени, все 9 снятых сняты по записанному решению.
7. Обновление с v1: настройки заказчика сохранены, `data.backup.v1.json` создан.
8. Ни одна строка UI не содержит внутренних терминов, ID команд или имён файлов исходников; ни одна не заканчивается точкой; все сущности плагина — с заглавной.
9. `README.md`, `instructions.md` и глоссарий соответствуют интерфейсу.

---

## Приложение A. Открытые вопросы к заказчику

Задать до начала соответствующей фазы, не решать самостоятельно.

1. **Лицензия** (фаза 0): MIT, Apache-2.0 или иное?
2. **Prefix priority** (фаза 2): если подтвердится, что три настройки не сохраняются — считать это дефектом и починить в рамках этого PRD, или вынести отдельно?
3. **Команда `Open settings`** (фаза 6): удалить или оставить на приватном API?
4. **`fundingUrl`** (фаза 6): нужен?
5. **Руководство** (фаза 5): кнопка `Open the guide` в группе `help` открывает заметку в vault. Кто пишет её содержимое — заказчик или исполнитель по плану из прототипа?
6. **Клавиатура в списке Fields** (фаза 3): перетаскивание — единственный способ переупорядочивания (Ф17). Добавлять ли команды `Move Field up` / `Move Field down` сразу, или дождаться замечания на community review?

### Закрытые вопросы

| Вопрос | Ответ |
|---|---|
| Порядок вкладок: `General` первой или в конец? | `General` первой, за ней `Keyboard`; `Advanced` последней |
| Термин для `Strip`: `Hierarchy bars` устраивает? | Нет. Принято `Tag Bars`, путь `visual.tagBars.*` |
| Регистр в названиях | Сущности плагина — с заглавной (Р9, Ст10) |
| Точка в конце описаний | Не ставится (Р10) |
| Число вкладок | Семь: `Keyboard` выделена из `General` |
| Контрол `Position` у Field | Убран: сторона задаётся перетаскиванием через линию |
| Глобальный формат значений YAML | Убран: правило `Raw` / `Clean` задаётся у каждого Value |

---

## Приложение B. Опись целевого состояния

Сгенерировано из `docs/prototype/settings_prototype.html` командой:

```
node tests/prototype/dump_schema.js docs/prototype/settings_prototype.html out.md
```

Руками не правится. При изменении прототипа опись перегенерируется, и её diff показывает, что именно изменилось в текстах.

### Вкладки и группы (снято с прототипа)

| # | Вкладка | Тумблер модуля | Групп | Настроек | Своих блоков |
|---|---------|----------------|-------|----------|--------------|
| 1 | General | — | 3 | 6 | 1 |
| 2 | Keyboard | — | 4 | 5 | 3 |
| 3 | Navigation | `features.navigation.enabled` | 5 | 20 | 3 |
| 4 | Tags & PKM | `features.pkm.enabled` | 7 | 15 | 5 |
| 5 | Visual | `features.visual.enabled` | 4 | 22 | 4 |
| 6 | Transform | `features.transform.enabled` | 7 | 18 | 4 |
| 7 | Advanced | — | 3 | 5 | 1 |

### Группы по порядку


**General** (`general`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 10 | `general-intro` | Before you start | — | — | — |
| 100 | `help` | Help | Where to start, and how much hand-holding you want along the way | — | — |
| 200 | `modules` | Modules | Four separate things live in this plugin. Turn off the ones you do not want and they stop adding commands and stop touching your notes | — | — |

**Keyboard** (`keyboard`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `keyboard-intro` | Before you start | — | — | — |
| 100 | `select-all` | Expanded select all | <code>Ctrl/Cmd + A</code> selects the whole note in one go. This setting changes how it works: the first press selects the line you are on, and every further press widens the selection | — | — |
| 200 | `binder` | Binder (custom insert commands) | For text you type over and over. Put it in a row here, give that row a key, and one press drops it in wherever your cursor is | да | — |
| 300 | `command-reference` | Command reference | Everything this plugin can do, in one list. None of it has a key until you give it one — click in the <code>Hotkey</code> column to do that | да | — |

**Navigation** (`navigation`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `nav-intro` | Before you start | — | — | — |
| 100 | `move-lines` | Moving lines | Reorder a note without cutting and pasting: pick up a line and walk it up or down | да | — |
| 200 | `left-right` | Move left and move right | Two keys, one for left and one for right, and between them they do three jobs: nudge a piece of text along a line, change the marker at the start of a line, or change how far the line is indented. Which one you get depends on what is selected — the two lists below spell it out | — | — |
| 300 | `heading-jumps` | Jumping between headings | Skip through a long note by its headings instead of scrolling | — | — |
| 400 | `in-line` | Moving inside a line | A line can hold tags before your text and dates after it. These keys walk the cursor between those parts without leaving the line | — | — |

**Tags & PKM** (`pkm`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `pkm-intro` | Before you start | — | — | — |
| 100 | `fields` | Fields | A Field is one slot a line can hold: a tag, a link to another note, or an element such as a date. Set out the slots you want, the Values each one offers, and where on the line they go | да | — |
| 200 | `line-format` | Separators | Two markers of your choosing carve out the middle of a line. Whatever you write goes between them; the Fields sit outside. Which Fields land on which side is set under <code>Fields</code>, by dragging one across the line | да | — |
| 300 | `writing-rules` | Writing rules | The small habits: how a tag is written when it has a Value underneath it, what is left when you clear a line, and where the cursor waits for you afterwards | — | — |
| 400 | `placement-modes` | Placement modes | Every Field has a <code>Behavior</code> mode: <code>Strict</code>, <code>Insert only</code> or <code>Free</code>. These options define how exactly those modes work | да | — |
| 500 | `prefix-priority` | Prefix priority | Some Values want to change the start of the line — a checkbox from Status, an exclamation mark from Priority. When two of them ask at once, only one can win. These rules decide who | — | — |
| 600 | `config-note` | Config note | Your whole setup, written out as an ordinary note you can read, edit and keep. Generate it to save a copy of where you are now; apply it to put a copy back | да | — |

**Visual** (`visual`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `visual-intro` | Before you start | — | — | — |
| 100 | `tag-appearance` | Tag appearance | How a tagged line looks while you write. Tags are drawn as small coloured bubbles; links and dates stay ordinary text. Nothing here changes a single character in your file | — | — |
| 200 | `tag-bars` | Tag Bars | A coloured Bar in the margin, so you can see at a glance what a whole block of lines is about without reading their tags. The Bar runs down the side of the line and everything nested under it | — | — |
| 300 | `tagwheel` | TagWheel | TagWheel opens over the line and lays your Fields out across it, with the Values of the Field you are on running down | да | — |

**Transform** (`transform`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `transform-intro` | Before you start | — | — | — |
| 100 | `inline-to-note` | Inline to note | You write a thought on one line. Press the key, and that line becomes a note of its own — or gets added to a note you already have. The line stays where it was, with a link to the new note in its place if you want one | да | — |
| 200 | `naming` | Naming | The new note needs a name. This block defines how to choose a name of a new note | да | `transform.inline2note.enabled` |
| 250 | `note-properties` | Note properties | Copy what you tagged on the line into the properties of the new note | да | `transform.inline2note.enabled` |
| 300 | `note-content` | Note content | What the note looks like inside: where your text goes, and what sits above it | — | `transform.inline2note.enabled` |
| 400 | `source-line` | Source line | What happens to the line you pressed on, once the note is safely written | — | `transform.inline2note.enabled` |
| 500 | `smart-rules` | Smart Rules | Different kinds of line deserve different notes. A rule spots a kind of line and picks the template for it | да | `transform.inline2note.enabled` |

**Advanced** (`advanced`)

| order | id | Заголовок | Intro | Tip | Видимость зависит от |
|-------|----|-----------|-------|-----|----------------------|
| 50 | `advanced-intro` | Before you start | — | — | — |
| 100 | `generated-files` | Generated files | The plugin keeps its own compiled copy of your setup inside the vault. You never need to touch it, but it can be rebuilt from here if it ever falls out of step | да | — |
| 200 | `diagnostics` | Diagnostics | If something misbehaves, a log helps work out why. Be aware the log is saved into your vault and will contain the text of the lines you were working on | — | — |

### Полная опись настроек


#### Before you start — `advanced-intro` (вкладка `advanced`)

- **`advanced-callout`** — свой блок, рендерер `renderTabCallout`

#### Generated files — `generated-files` (вкладка `advanced`)

_Intro:_ The plugin keeps its own compiled copy of your setup inside the vault. You never need to touch it, but it can be rebuilt from here if it ever falls out of step

_Tip:_ It is not the same thing as the config note on the Tags & PKM tab. That one is for you to read and edit; this one is written for the plugin and is overwritten on every change, so editing it by hand has no lasting effect

- **Template note** — `config-template`, `buttons`
  - desc: A reference note showing every block the config note understands
  - tip: Open this when you want to write a config note by hand and need to know what the blocks are called
  - кнопки: `open-config-template` Open
  - старые названия для поиска: «Open Detailed Template»
- **Regenerate** — `regenerate-rules`, `buttons`
  - desc: Rewrite the file from your current Field setup
  - tip: Use this if a command stops recognising a Field you know you configured. It usually means the file and the settings have drifted apart
  - кнопки: `regenerate-rules` Regenerate
  - старые названия для поиска: «Regenerate Rules Now»

#### Diagnostics — `diagnostics` (вкладка `advanced`)

_Intro:_ If something misbehaves, a log helps work out why. Be aware the log is saved into your vault and will contain the text of the lines you were working on

- **Developer logging** — `dev-mode`, `toggle`, path `advanced.devMode.enabled`, default `false`
  - desc: Record what the plugin did, to help track down a problem
  - tip: Leave this off day to day. Turn it on, reproduce the problem once, then turn it off and attach the log to a bug report after checking what is in it
  - старые названия для поиска: «Enable Dev Mode»
- **Machine-readable log** — `dev-ai-log`, `toggle`, path `advanced.devMode.aiLog`, default `true`
  - desc: Also keep a second, denser log meant for tools rather than people
  - tip: Only worth turning on if someone has asked you for it. The plain log is the one you can read yourself
  - видна если: `advanced.devMode.enabled`
  - старые названия для поиска: «Generate log for AI?»
- **Log file** — `dev-log-path`, `text`, path `advanced.devMode.logPath`, default `InlineOverhaul_DevLog`
  - desc: Where in your vault the logs are put
  - tip: They are ordinary notes, so they show up in search and in your graph. Keep them in a folder you exclude if that bothers you
  - видна если: `advanced.devMode.enabled`
  - старые названия для поиска: «Log Path»

#### Before you start — `general-intro` (вкладка `general`)

- **`general-callout`** — свой блок, рендерер `renderTabCallout`

#### Help — `help` (вкладка `general`)

_Intro:_ Where to start, and how much hand-holding you want along the way

- **Guide** — `howto`, `buttons`
  - desc: Worked examples of the things people set up first
  - tip: Opens a note in your vault with the practical side: which commands are worth a key, how to lay out your first few Fields, what TagWheel feels like once it is set up, and a couple of complete setups you can copy. It is an ordinary note, so you can scribble your own notes in it
  - кнопки: `open-howto` Open the guide
- **Show tips** — `show-tips`, `toggle`, path `ui.showTips`, default `true`
  - desc: Put a ? beside anything that needs more explanation
  - tip: Click a ? and a short explanation opens underneath, usually with an example. Turn this off once you no longer need them: the one-line descriptions stay either way

#### Modules — `modules` (вкладка `general`)

_Intro:_ Four separate things live in this plugin. Turn off the ones you do not want and they stop adding commands and stop touching your notes

- **Navigation** — `module-navigation`, `toggle`, path `features.navigation.enabled`, default `true`
  - desc: Move lines, text and the cursor without reaching for the mouse
  - tip: Nothing here writes anything new. It only moves text you have already written — a line up, a word along, the cursor across. Safe to leave on
- **Tags & PKM** — `module-pkm`, `toggle`, path `features.pkm.enabled`, default `true`
  - desc: Set up your PKM tags, wikilinks and emoji elements, and insert them inline with one key
  - tip: This is the part that puts tags and dates onto a line for you, and steps them forward with a keypress. Turning it off changes nothing you have already written — those keys simply stop working
- **Visual** — `module-visual`, `toggle`, path `features.visual.enabled`, default `true`
  - desc: Customize and beautify your inline text with tag colors, Bars and much more
  - tip: Appearance only. Your notes contain exactly the same text either way — this decides how it looks on screen. Anyone opening the file elsewhere sees the plain text
- **Transform** — `module-transform`, `toggle`, path `features.transform.enabled`, default `true`
  - desc: Turn an inline entry into a note, with templates, YAML properties, rules and more
  - tip: Leaving this on does not let anything happen yet. Making notes needs one more switch, on the Transform tab, because it is the one thing here that writes new files

#### Before you start — `keyboard-intro` (вкладка `keyboard`)

- **`keyboard-callout`** — свой блок, рендерер `renderTabCallout`

#### Expanded select all — `select-all` (вкладка `keyboard`)

_Intro:_ <code>Ctrl/Cmd + A</code> selects the whole note in one go. This setting changes how it works: the first press selects the line you are on, and every further press widens the selection

- **Expanded select all** — `select-all-enabled`, `toggle`, path `editor.selectAll.enabled`, default `false`
  - desc: Change what <code>Ctrl/Cmd + A</code> does: take the line first, then widen
  - tip: On a task list the first press takes just the task you are on, the second the task and its tree, and the last the whole note. Press <code>Ctrl/Cmd + A</code> once more with the last option below on, and the cursor goes back where it started
  - старые названия для поиска: «Enhanced Mod+A»
- **Selection steps** — `select-all-steps`, `dropdown`, path `editor.selectAll.mode`, default `line-note`
  - desc: How much more gets picked up on each press
  - tip: <b>Tree</b> means the line plus everything indented under it. <b>Heading</b> means everything under the nearest heading. Pick the shortest sequence you will actually use — every extra step is one more press before you reach the whole note
  - варианты: `line-note` Line, then note · `line-tree-note` Line, tree, then note · `line-tree-header-note` Line, tree, heading, then note
  - выключена если: `editor.selectAll.enabled`
  - старые названия для поиска: «Select-all mode»
- **Count presses by timer** — `select-all-timer`, `toggle`, path `editor.selectAll.useDelay`, default `false`
  - desc: Decide the next step by how quickly you press, rather than by what is selected
  - tip: Off is the forgiving setting: pause as long as you like, and the next press still widens the selection. On, pausing longer than the time below means you start again from the line — handy if you often select something, walk away, and come back
  - выключена если: `editor.selectAll.enabled`
  - старые названия для поиска: «Use multi-press delay»
- **Time between presses** — `select-all-delay`, `slider`, path `editor.selectAll.delayMs`, default `700`
  - desc: How long you can pause and still be in the middle of a sequence
  - tip: Only used when the timer above is on. Around three quarters of a second suits most people; raise it if you keep losing your place
  - диапазон: 250–2000, шаг 50, ед. ms
  - видна если: `editor.selectAll.useDelay`
  - выключена если: `editor.selectAll.enabled`
  - старые названия для поиска: «Multi-press delay»
- **One more press clears it** — `select-all-clear`, `toggle`, path `editor.selectAll.clearOnLast`, default `false`
  - desc: After the last step, pressing again drops the selection and returns the cursor
  - tip: Lets you get out of a selection with the same key you got into it, instead of clicking somewhere to deselect
  - выключена если: `editor.selectAll.enabled`
  - старые названия для поиска: «Last press clears selection»

#### Binder (custom insert commands) — `binder` (вкладка `keyboard`)

_Intro:_ For text you type over and over. Put it in a row here, give that row a key, and one press drops it in wherever your cursor is

_Tip:_ The <code>Hotkey</code> column shows the key a row has now; click it to go and set one. Only the description can be changed afterwards — to change the text a row inserts, delete the row and add it again, because the command is created from the row and disappears with it

- **`binder-table`** — свой блок, рендерер `renderBinder`

#### Command reference — `command-reference` (вкладка `keyboard`)

_Intro:_ Everything this plugin can do, in one list. None of it has a key until you give it one — click in the <code>Hotkey</code> column to do that

_Tip:_ In Obsidian’s own hotkey list these all appear under <b>Inline Overhaul</b>, so typing that in its search box brings up the whole set at once. TagWheel is the exception: once it is open you steer it with the arrow keys, so it needs only the one command that opens it

- **`command-list`** — свой блок, рендерер `renderCommandReference`

#### Before you start — `nav-intro` (вкладка `navigation`)

- **`nav-callout`** — свой блок, рендерер `renderTabCallout`

#### Moving lines — `move-lines` (вкладка `navigation`)

_Intro:_ Reorder a note without cutting and pasting: pick up a line and walk it up or down

_Tip:_ When a line has other lines indented beneath it, the whole bundle is called its <b>tree</b>. That word turns up in a few places here. The setting below is where you decide whether the bundle travels with the line or stays behind

- **Move lines** — `move-lines-enabled`, `toggle`, path `navigation.moveLine.enabled`, default `true`
  - desc: Let the keys pick up a line and move it
  - старые названия для поиска: «Enable Move Line»
- **Moving behavior** — `move-lines-no-selection`, `dropdown`, path `navigation.moveLine.noSelectionMode`, default `line-only`
  - desc: Whether the tree under the line travels with it
  - tip: Say a line has three lines indented under it. <b>The line only</b> lifts that one line out and leaves the three where they are, so the order changes around them. <b>The whole tree</b> keeps the four together and moves them as one block
  - варианты: `line-only` The line only · `with-children` The whole tree
  - выключена если: `navigation.moveLine.enabled`
  - старые названия для поиска: «No-selection mode»
- **Moving headers** — `move-lines-heading`, `dropdown`, path `navigation.moveLine.headerMode`, default `move-as-line`
  - desc: If you are moving a header, this decides whether the whole section moves or just the header line
  - tip: With <b>heading with its section</b>, one press swaps two whole sections of a note, content and all. With <b>heading only</b> the heading text moves on its own and the paragraphs under it stay put, which is what you want when you are only renaming the running order
  - варианты: `move-as-line` Heading only · `move-with-section` Heading with its section
  - выключена если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Header mode»
- **Cross heading boundaries** — `move-lines-cross`, `toggle`, path `navigation.moveLine.crossSectionAllowed`, default `true`
  - desc: Let a line travel past a heading into the part of the note below it
  - tip: Leave it on and a line keeps going wherever you push it. Turn it off and it stops at the heading, which is what you want in a note where each heading has to keep its own contents
  - выключена если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Cross-section allowed»
- **Select after moving** — `move-lines-select`, `toggle`, path `navigation.moveLine.highlightMovedLines`, default `false`
  - desc: Keep the lines highlighted once they land, so you can see what moved
  - tip: Useful when you move a tree of several lines and want to be sure the whole thing came along
  - выключена если: `navigation.moveLine.enabled`
  - старые названия для поиска: «Highlight moved lines»

#### Move left and move right — `left-right` (вкладка `navigation`)

_Intro:_ Two keys, one for left and one for right, and between them they do three jobs: nudge a piece of text along a line, change the marker at the start of a line, or change how far the line is indented. Which one you get depends on what is selected — the two lists below spell it out

- **`left-right-order`** — свой блок, рендерер `renderLeftRightOrder`
- **Move selected text** — `move-text-enabled`, `toggle`, path `navigation.moveSelection.inlineEnabled`, default `true`
  - desc: Slide a highlighted phrase along its line
  - tip: Highlight two words in the middle of a sentence and press <code>Move right</code>: they trade places with the word after them, and stay highlighted, so you can keep pressing until they are where you want
  - старые названия для поиска: «Enable inline text move»
- **Movement step** — `move-text-step`, `dropdown`, path `navigation.moveSelection.inlineMoveMode`, default `auto`
  - desc: How far the highlighted text goes on each press
  - tip: <b>Automatic</b> reads what you highlighted: part of a word moves letter by letter, a whole word hops over whole words. Pick one of the others if you would rather it always behave the same way
  - варианты: `auto` Automatic · `char` One character · `word` Whole word · `disabled` Off
  - выключена если: `navigation.moveSelection.inlineEnabled`
  - старые названия для поиска: «Inline move mode»
- **Cycle line Prefixes** — `prefix-cycle-enabled`, `toggle`, path `navigation.moveSelection.prefixCyclerEnabled`, default `true`
  - desc: Turn a line into a heading, a bullet, a numbered item or plain text, one press at a time
  - tip: <code>Move right</code> walks down the list below, <code>Move left</code> walks back up, and an empty row in it means plain text with no Prefix at all. <code>Move left</code> cycles whenever the line has no indent; <code>Move right</code> only cycles when the line is not already a list item, because on a list item it indents instead
  - старые названия для поиска: «Enable PrefixCycler»
- **`cycle-order`** — свой блок, рендерер `renderCycleOrder`
- **Cycle in both directions** — `right-cycles`, `toggle`, path `navigation.moveSelection.rightCycles`, default `true`
  - desc: Off: <code>Move right</code> only ever indents, and cycling becomes a <code>Move left</code> job
  - tip: On a plain line <code>Move right</code> walks down the list and <code>Move left</code> walks back up. Switch this off and the two keys split the work: <code>Move left</code> changes the marker, <code>Move right</code> only ever indents. Some people find that easier to keep in their head
  - выключена если: `navigation.moveSelection.prefixCyclerEnabled`
- **After the last one** — `prefix-cycle-end`, `dropdown`, path `navigation.moveSelection.onCycleEnd`, default `indent`
  - desc: What happens when you reach the bottom of the list below
  - tip: <b>Start over</b> loops back to the top, so you can keep pressing until you find what you want. <b>Increase indent</b> stops cycling and starts pushing the line to the right instead
  - варианты: `indent` Increase indent · `wrap` Start over
  - выключена если: `navigation.moveSelection.prefixCyclerEnabled`
  - старые названия для поиска: «On cycle end»
- **Change the indent** — `indent-fallback`, `toggle`, path `navigation.moveSelection.indentFallbackEnabled`, default `true`
  - desc: When neither of the two jobs above applies, move the line right or left instead
  - tip: On, the keys always do something. Off, they sit quiet unless there is text to move or a marker to change — pick that if you indent with Tab and would rather these keys never touched it
  - старые названия для поиска: «Indent fallback»

#### Jumping between headings — `heading-jumps` (вкладка `navigation`)

_Intro:_ Skip through a long note by its headings instead of scrolling

- **Jump between headings** — `heading-jumps-enabled`, `toggle`, path `navigation.jumpToHeader.enabled`, default `true`
  - desc: Turn on the <code>Jump back</code> and <code>Jump next</code> commands
  - старые названия для поиска: «Enable Jump To Header»
- **Center the target** — `heading-jumps-center`, `toggle`, path `navigation.jumpToHeader.centerCursor`, default `true`
  - desc: After a jump, scroll the note so the line you landed on sits mid-screen
  - tip: Without it you often arrive at the very bottom of the window, with the section you jumped to still off screen below — so you have to scroll anyway. With it on, you can read straight away
  - выключена если: `navigation.jumpToHeader.enabled`
- **Jump target** — `heading-jumps-mode`, `dropdown`, path `navigation.jumpToHeader.jumpMode`, default `edge`
  - desc: Hop between headings, or crawl line by line
  - tip: <b>Heading to heading</b> is for finding your way around a long note. <b>Line by line</b> turns the same keys into a slow walk through the text, which some people prefer to the arrow keys
  - варианты: `edge` Heading to heading · `line` Line by line
  - выключена если: `navigation.jumpToHeader.enabled`
  - старые названия для поиска: «Jump mode»
- **Where in the section** — `heading-jumps-edge`, `dropdown`, path `navigation.jumpToHeader.edgeMode`, default `start-end`
  - desc: Land at the start of the part you jump to, or at its end
  - tip: <b>Alternate</b> means one press takes you to the start, the next to the end, so you can reach both without changing the setting
  - варианты: `start-end` Alternate start and end · `start` Start only · `end` End only
  - видна если: `navigation.jumpToHeader.jumpMode`
  - выключена если: `navigation.jumpToHeader.enabled`
  - старые названия для поиска: «Edge behavior»
- **Cursor on arrival** — `heading-jumps-cursor`, `dropdown`, path `navigation.jumpToHeader.jumpCursorPosition`, default `start`
  - desc: Where on that line the cursor ends up
  - tip: <b>End of your text</b> puts the cursor after the last word you wrote but before the tags and dates at the end of the line, so you can carry on typing without having to step back over them
  - варианты: `start` Line start · `end` Line end · `section-end` End of your text
  - выключена если: `navigation.jumpToHeader.enabled`
  - см. также: `separator-2` — Where your text ends is set by the second Separator
  - старые названия для поиска: «Jump cursor position»

#### Moving inside a line — `in-line` (вкладка `navigation`)

_Intro:_ A line can hold tags before your text and dates after it. These keys walk the cursor between those parts without leaving the line

- **Move cursor inside a line** — `in-line-enabled`, `toggle`, path `navigation.navigateInline.enabled`, default `true`
  - desc: Let the keys walk the cursor along the line
  - старые названия для поиска: «Enable Navigate Inline»
- **Step size** — `in-line-step`, `dropdown`, path `navigation.navigateInline.stepMode`, default `word`
  - desc: How big a hop the cursor makes each time
  - tip: <b>Word</b> is the everyday choice. <b>Sentence</b> suits long paragraphs. <b>Straight to the start or end</b> skips the middle entirely and lands at one end of your text
  - варианты: `word` Word · `sentence` Sentence · `begin-end` Straight to the start or end
  - выключена если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «Step mode»
- **Continue past a Separator** — `in-line-cross`, `toggle`, path `navigation.navigateInline.boundaryJump`, default `false`
  - desc: Let the cursor leave your text and walk into the tags at either end
  - tip: Off is the safer setting while you are writing: the cursor stays in your sentence and cannot wander into the tags. Turn it on when you want to reach a tag with the same keys instead of the mouse
  - выключена если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «Allow crossing Separators»
- **At the far end** — `in-line-boundary`, `dropdown`, path `navigation.navigateInline.onBoundary`, default `wrap`
  - desc: What to do when there is nowhere further to go
  - tip: Say the cursor is on the last word before the closing Separator and you press again. <b>Stay put</b> does nothing. <b>Wrap</b> sends it back to the first word of the same stretch. <b>Next line</b> leaves the line entirely
  - варианты: `stay` Stay put · `wrap` Wrap to the other end · `next-line` Go to the next line
  - выключена если: `navigation.navigateInline.enabled`
  - старые названия для поиска: «On boundary»

#### Before you start — `pkm-intro` (вкладка `pkm`)

- **`pkm-callout`** — свой блок, рендерер `renderTabCallout`

#### Fields — `fields` (вкладка `pkm`)

_Intro:_ A Field is one slot a line can hold: a tag, a link to another note, or an element such as a date. Set out the slots you want, the Values each one offers, and where on the line they go

_Tip:_ A <b>Field</b> is one slot on a line. There are three kinds of Field: <b>tag</b>, <b>link</b> (wikilink), and <b>emoji-element</b> — such as a date or a time. Each Field automatically gets two <b>cycle commands</b>, <code>next</code> and <code>previous</code>, which insert the Value and cycle it back or forth — it is worth a hotkey for the ones you use often, so a <code>#todo</code> tag is one keypress away. <b>TagWheel</b> opens all of your Fields over the line at once, so you can pick with the arrow keys instead of remembering which key does what

- **`line-preview`** — свой блок, рендерер `renderLinePreview`
- **`field-editor`** — свой блок, рендерер `renderFieldEditor`

#### Separators — `line-format` (вкладка `pkm`)

_Intro:_ Two markers of your choosing carve out the middle of a line. Whatever you write goes between them; the Fields sit outside. Which Fields land on which side is set under <code>Fields</code>, by dragging one across the line

_Tip:_ Choose these carefully and then leave them alone. Lines you have already written keep their old Separator, so changing it later means the plugin no longer recognises them. Use two or more characters that Markdown does not already claim: <code>||</code> and <code>::</code> are good, <code>==</code> is not, because Obsidian reads it as a highlight

- **First Separator** — `separator-1`, `text`, path `pkm.lineFormat.separator1`, default `||`
  - desc: Goes between the tags at the front and the start of your sentence
  - tip: Pick something you would never type on purpose in a sentence. Two pipe characters are the default for exactly that reason — nobody writes them by accident
- **Second Separator** — `separator-2`, `text`, path `pkm.lineFormat.separator2`, default `||`
  - desc: Goes at the end of your sentence, before the dates and links
  - tip: It can be exactly the same as the first one. Which is which is decided by where it sits on the line, not by what it looks like

#### Writing rules — `writing-rules` (вкладка `pkm`)

_Intro:_ The small habits: how a tag is written when it has a Value underneath it, what is left when you clear a line, and where the cursor waits for you afterwards

- **Child tag format** — `child-tag-format`, `dropdown`, path `pkm.behavior.childTagFormat`, default `separate`
  - desc: When a Value sits under another one, whether they are written as two tags or one
  - tip: Say <code>doing</code> has <code>review</code> under it. Two separate tags give you <code>#doing #review</code>, and searching for <code>#doing</code> finds the line. One combined tag gives <code>#doing/review</code>, which keeps the pair together in Obsidian’s tag list but means a search for the parent needs a slash. Every preview on the Visual tab follows whichever you pick
  - варианты: `separate` Separate tags (#doing #review) · `combined` One tag (#doing/review)
  - см. также: `tag-preview` — See it in the tag appearance preview
  - старые названия для поиска: «Subtag format»
- **When a line empties out** — `cycle-end-behavior`, `dropdown`, path `pkm.behavior.cycleEndBehavior`, default `keep-bullet`
  - desc: What is left behind when cycling removes the last Value
  - tip: Step a Field back past its first Value and the tag comes off the line. If that was the only thing on it, you are left with <code>- </code> and nothing else. Keep the bullet leaves it as a list item ready for typing; clear the line leaves a blank line
  - варианты: `keep-bullet` Keep the list bullet · `clear-prefix` Clear the line
  - старые названия для поиска: «Line Prefix after end of cycle»
- **Cursor after an action** — `cursor-policy`, `dropdown`, path `pkm.behavior.cursorPolicy`, default `text_end`
  - desc: Where the cursor waits once a tag or date has been set
  - tip: Almost always what you want is <b>end of your text</b>: the cursor lands right where you stopped writing, in front of the tags, so you can carry straight on. The other two put it somewhere you will usually have to move it from
  - варианты: `text_end` End of your text (recommended) · `current_position` Leave it where it was · `line_end` End of the line
  - старые названия для поиска: «Cursor behavior»

#### Placement modes — `placement-modes` (вкладка `pkm`)

_Intro:_ Every Field has a <code>Behavior</code> mode: <code>Strict</code>, <code>Insert only</code> or <code>Free</code>. These options define how exactly those modes work

_Tip:_ You choose the mode for each Field over in <code>Fields</code>. What you set here is the fine print of each mode — mainly whether it is allowed to change the very start of the line, the part that makes it a bullet or a checkbox

- **Strict: add a bullet** — `placement-bullet-strict`, `toggle`, path `pkm.placement.bulletInStrict`, default `false`
  - desc: Start the line with a bullet when the Field has nothing of its own to put there
  - tip: Headings are always left alone. This only decides what happens to a plain line: on, it becomes a list item; off, it stays as it is
  - см. также: `field-editor` — Each Field's Behavior is set under Fields
  - старые названия для поиска: «OFF mode Prefix»
- **Insert only: keep the Prefix** — `placement-keep-prefix`, `toggle`, path `pkm.placement.keepPrefixInsertOnly`, default `true`
  - desc: Put the Value where it belongs and do not touch the start of the line
  - старые названия для поиска: «Minimal mode Separators»
- **Insert only: use Field Prefix** — `placement-field-prefix`, `toggle`, path `pkm.placement.fieldPrefixInsertOnly`, default `true`
  - desc: Allow a Value to change the start of the line after all, if it has its own
  - tip: Some Values carry their own opening, like <code>- [x]</code> for done. On, choosing that Value ticks the checkbox for you. Off, the line keeps whatever it started with and only the tag changes
  - старые названия для поиска: «Minimal mode Prefix»
- **Free: insert position** — `placement-free-position`, `dropdown`, path `pkm.placement.freeInsertPosition`, default `smart`
  - desc: Which end of the line a Value goes to when the cursor is mid-sentence
  - варианты: `smart` Whichever side is closer · `left` Always left · `right` Always right
  - старые названия для поиска: «Full mode»

#### Prefix priority — `prefix-priority` (вкладка `pkm`)

_Intro:_ Some Values want to change the start of the line — a checkbox from Status, an exclamation mark from Priority. When two of them ask at once, only one can win. These rules decide who

- **Decide by** — `prefix-priority-decide`, `dropdown`, path `pkm.prefixPriority.decideBy`, default `by-section`
  - desc: Settle it by the order of your Fields, or by a list of openings you rank yourself
  - tip: <b>Field order</b> is the simple answer: whichever Field comes first in your list gets its way. <b>Prefix order</b> is for when you care about the openings themselves — say an urgent mark should always beat a tick, no matter which Field asked for it
  - варианты: `by-section` Field order · `by-checkbox-list` Prefix order
  - старые названия для поиска: «Main checkbox priority», «Prefix Resolver»
- **Field order source** — `prefix-priority-source`, `dropdown`, path `pkm.prefixPriority.fieldOrderSource`, default `auto`
  - desc: Use the order your Fields are already in, or arrange a separate one
  - варианты: `auto` By Fields order · `manual` Manual order
  - видна если: `pkm.prefixPriority.decideBy`
  - старые названия для поиска: «Fields order mode»
- **`field-order-list`** — свой блок, рендерер `renderFieldOrderList`
- **`prefix-order-list`** — свой блок, рендерер `renderPrefixOrderList`
- **Parent or child wins** — `prefix-priority-parent`, `dropdown`, path `pkm.prefixPriority.parentOrChild`, default `tag-over-subtag`
  - desc: When a tag and its child Value both carry a Prefix
  - варианты: `tag-over-subtag` Parent tag · `subtag-over-tag` Child tag
  - старые названия для поиска: «Tag/Subtag priority»

#### Config note — `config-note` (вкладка `pkm`)

_Intro:_ Your whole setup, written out as an ordinary note you can read, edit and keep. Generate it to save a copy of where you are now; apply it to put a copy back

_Tip:_ It works both ways, and that makes it useful twice over. As a <b>backup</b>: generate it before you start rearranging, and you can always get back. As a <b>way to move</b>: copy the note into another vault, press apply there, and that vault has your setup. As an <b>editor</b>: for a long list of Values it is far quicker to type in the note than to click through the table above — press apply when you are done

- **Where to keep it** — `config-note-path`, `text`, path `pkm.configNote.path`, default `InlineOverhaul_Config.md`
  - desc: The note that Generate writes and Apply reads
  - tip: Put it wherever you keep your own notes about your setup. If you sync your vault, this travels with it, which is the simplest way to carry your setup between machines
- **How much detail** — `config-note-detail`, `dropdown`, path `pkm.configNote.detail`, default `detailed`
  - desc: Whether the generated note explains itself or just lists the settings
  - tip: <b>Detailed</b> adds comments describing each block, which helps if you are going to edit it by hand. <b>Minimal</b> is easier to read as a backup and easier to compare between two versions
  - варианты: `detailed` Detailed · `minimal` Minimal
  - старые названия для поиска: «Config Export Mode»
- **Generate and apply** — `config-note-actions`, `buttons`
  - desc: Write your setup out to the note, or read it back in
  - tip: <b>Generate</b> overwrites the note with your settings as they are right now, so it is always a fresh copy rather than something that can go stale. <b>Apply</b> goes the other way and replaces your settings with what the note says — the previous setup is kept aside first, so a mistake is recoverable
  - кнопки: `generate-config-note` Generate · `apply-config-note` Apply
  - старые названия для поиска: «TagWheel Note Editor»

#### Before you start — `transform-intro` (вкладка `transform`)

- **`transform-callout`** — свой блок, рендерер `renderTabCallout`

#### Inline to note — `inline-to-note` (вкладка `transform`)

_Intro:_ You write a thought on one line. Press the key, and that line becomes a note of its own — or gets added to a note you already have. The line stays where it was, with a link to the new note in its place if you want one

_Tip:_ One keypress does three things in a row: it works out which note to use, it puts your text into that note, and it tidies up the line you pressed on. The groups below follow that order, so you can read down the page and see the whole journey. Nothing runs until <code>Inline to note</code> just below is switched on

- **Inline to note** — `i2n-enabled`, `toggle`, path `transform.inline2note.enabled`, default `true`
  - desc: Allow this to create notes and add to notes you already have
  - tip: This is the switch that lets the plugin write to your vault. Everything else on this tab only decides how. Make a backup and try it on a note you do not mind breaking: one keypress can add a note, change a note, and edit the line you were on
  - старые названия для поиска: «Inline2Note enabled»
- **Templates folder** — `i2n-templates-folder`, `text`, path `transform.inline2note.templatesFolder`, default `Templates`
  - desc: The folder your note templates live in
  - tip: A template is an ordinary note that a new note starts out as a copy of. Whatever you keep in this folder shows up in the lists below
  - видна если: `transform.inline2note.enabled`
- **New notes folder** — `i2n-output-folder`, `text`, path `transform.inline2note.outputFolder`, default `""`
  - desc: Where to put the notes this creates. Leave it empty to keep them next to the note you are in
  - видна если: `transform.inline2note.enabled`
  - старые названия для поиска: «Output folder for new notes»
- **Floating button** — `i2n-floating`, `toggle`, path `transform.inline2note.floatingButton`, default `false`
  - desc: Put a small button at the end of the line you are on
  - tip: Click it and the line turns into a note, the same as pressing the key would. The button is only drawn on screen — it is never saved into your note, so nothing changes if you open the file elsewhere
  - видна если: `transform.inline2note.enabled`
  - см. также: `i2n-button-preview` — See where it appears
  - старые названия для поиска: «Flying button»
- **`i2n-button-preview`** — свой блок, рендерер `renderFloatingButton`
- **Default template** — `i2n-default-template`, `dropdown`, path `transform.inline2note.defaultTemplate`, default `task.md`
  - desc: The template on creation of new note when no special rules apply (see <code>Smart Rules</code> below)
  - tip: You can set up rules further down that pick a different template for certain lines. This one is used for everything else
  - варианты: `` None · `task.md` task.md · `meeting.md` meeting.md
  - видна если: `transform.inline2note.enabled`

#### Naming — `naming` (вкладка `transform`)

_Intro:_ The new note needs a name. This block defines how to choose a name of a new note

_Tip:_ Three ways of finding one are tried in turn, and the first that works wins: the text between your chosen brackets, then a heading on the line, then simply the first few words

- **Note name** — `naming-mode`, `dropdown`, path `transform.inline2note.noteName.mode`, default `auto`
  - desc: Take the name from the line, or stop and ask you for it
  - tip: <b>Ask me</b> opens a small box with the suggested name already filled in, so you can accept it or type your own
  - варианты: `auto` From the line · `manual` Ask me
  - старые названия для поиска: «Note name mode»
- **Name brackets** — `naming-delimiters`, `text`, path `transform.inline2note.noteName.delimiters`, default `()`
  - desc: Two characters. Whatever you put between them becomes the name
  - tip: Put <code>()</code> here, write the line <code>- call (Anna about the contract) || text</code>, and you get a note called <b>Anna about the contract</b>. Leave this box empty and the name comes from the heading or the first words instead
  - старые названия для поиска: «Explicit name delimiters»
- **Words to use instead** — `naming-word-count`, `number`, path `transform.inline2note.noteName.wordCount`, default `5`
  - desc: How many of the first words to use when there are no brackets
  - tip: Set this to 3 and the line <code>- draft the settings prototype today</code> becomes a note called <b>draft the settings</b>. Too few and the names all look alike; too many and they get unwieldy
  - диапазон: 1–20, шаг 1
  - старые названия для поиска: «Auto title word count»
- **If the name is taken** — `naming-collision`, `dropdown`, path `transform.inline2note.nameCollision.mode`, default `new_note`
  - desc: What to do when you already have a note with that name
  - tip: <b>Create a second note</b> adds a number to the name and never touches what you already wrote — the safe choice. <b>Add to the existing one</b> is what you want for a running log. <b>Replace what is in it</b> throws the old contents away, and this plugin cannot give them back
  - варианты: `new_note` Create a second note · `add_to_note` Add to the existing one · `overwrite` Replace what is in it
  - старые названия для поиска: «Name collision mode»

#### Note properties — `note-properties` (вкладка `transform`)

_Intro:_ Copy what you tagged on the line into the properties of the new note

_Tip:_ Obsidian shows properties at the top of every note. Fill this in once and a line you tagged while writing arrives in its new note with those boxes already filled — no retyping. Two Fields can share one property name, and then both Values go into the same list

- **`yaml-mapping`** — свой блок, рендерер `renderYamlMapping`

#### Note content — `note-content` (вкладка `transform`)

_Intro:_ What the note looks like inside: where your text goes, and what sits above it

- **Where to put the text** — `content-position`, `dropdown`, path `transform.inline2note.placement.position`, default `beginning`
  - desc: At the top of the note, or after whatever is already there
  - tip: If you are adding to a note over and over — a diary, a log of calls — pick <b>at the end</b> so the entries stay in the order you wrote them. For a brand new note it makes no difference
  - варианты: `beginning` At the beginning · `end` At the end
  - старые названия для поиска: «Where to place inline text?»
- **Line above the text** — `content-header-mode`, `dropdown`, path `transform.inline2note.placement.headerMode`, default `custom`
  - desc: Something to put above your text so entries stay apart
  - tip: Useful when a note collects many entries: a date, or a word like <code>## Captured</code>, keeps them from running together
  - варианты: `custom` Fixed text · `datetime` Date and time · `none` Nothing
  - старые названия для поиска: «Inserted block header»
- **What it says** — `content-header-text`, `text`, path `transform.inline2note.placement.customHeader`, default `## Captured`
  - desc: Typed into the note exactly as you write it here
  - tip: Start it with <code>##</code> and Obsidian treats it as a heading you can fold. Without the hashes it is just a line of text
  - видна если: `transform.inline2note.placement.headerMode`
- **Date format** — `content-datetime`, `text`, path `transform.inline2note.placement.datetimeFormat`, default `## YYYY-MM-DD HH:mm`
  - desc: Today’s date, written the way you set out here
  - tip: <code>YYYY</code> is the year, <code>MM</code> the month, <code>DD</code> the day, and <code>HH mm ss</code> the time. Anything else you type is kept as it is, so <code>## YYYY-MM-DD</code> gives you a heading like <b>## 2026-08-21</b>, and adding a third hash makes it a smaller heading
  - видна если: `transform.inline2note.placement.headerMode`
  - старые названия для поиска: «Datetime header format»
- **Lines indented under it** — `content-sublines`, `dropdown`, path `transform.inline2note.sublines`, default `stay`
  - desc: Leave them where they are, or take them into the note too
  - tip: Say the line has three sub-points under it. <b>Take them along</b> moves all four into the note and leaves the place they came from empty. <b>Leave them</b> moves only the line you pressed on
  - варианты: `stay` Leave them · `remove` Take them along
  - старые названия для поиска: «Sublines behavior»
- **Open the note afterwards** — `content-open`, `toggle`, path `transform.inline2note.openTarget`, default `true`
  - desc: Jump straight to the note once it is written
  - tip: Handy while you are still setting this up, so you can see what came out. Turn it off once you trust it and you can keep writing without losing your place
  - старые названия для поиска: «Open transformed note»

#### Source line — `source-line` (вкладка `transform`)

_Intro:_ What happens to the line you pressed on, once the note is safely written

- **Leave a link behind** — `source-link`, `toggle`, path `transform.inline2note.sourceProcessing.replaceWithLink`, default `true`
  - desc: Put a link to the new note where your text used to be
  - tip: On, the line becomes a tidy pointer: click the link and you are in the note. Off, the text stays where it is — which means you can press again by mistake and get a second note. The marker below is the usual way to guard against that
  - старые названия для поиска: «Replace payload with note link»
- **Mark the line as done** — `source-marker`, `text`, path `transform.inline2note.sourceProcessing.token`, default `""`
  - desc: A word or tag added to the line so you can see it has been handled
  - tip: Type something like <code>#moved</code>. Afterwards you can search for it to find everything you have filed, or hide those lines from a list of things still to do. Leave the box empty and nothing is added
  - старые названия для поиска: «Processed token»
- **Where the mark goes** — `source-marker-position`, `dropdown`, path `transform.inline2note.sourceProcessing.panel`, default `right`
  - desc: Before your text, or after it
  - варианты: `left` Left, before the text · `right` Right, after the text
  - видна если: `transform.inline2note.sourceProcessing.token`
  - старые названия для поиска: «Processed token panel»

#### Smart Rules — `smart-rules` (вкладка `transform`)

_Intro:_ Different kinds of line deserve different notes. A rule spots a kind of line and picks the template for it

_Tip:_ Rules are read from the top, the first one that fits is used, and anything that fits none of them gets the default template. So put your narrow rules above your broad ones, or the broad one will answer first. Drag a rule by its handle to change which one is tried first

- **`smart-rules-list`** — свой блок, рендерер `renderSmartRules`

#### Before you start — `visual-intro` (вкладка `visual`)

- **`visual-callout`** — свой блок, рендерер `renderTabCallout`

#### Tag appearance — `tag-appearance` (вкладка `visual`)

_Intro:_ How a tagged line looks while you write. Tags are drawn as small coloured bubbles; links and dates stay ordinary text. Nothing here changes a single character in your file

- **`tag-preview`** — свой блок, рендерер `renderTagPreview`
- **Opacity before the text** — `tags-opacity-left`, `slider`, path `visual.tags.opacityLeft`, default `100`
  - desc: Dims everything written before your text, tags and elements alike
  - диапазон: 0–100, шаг 1, ед. %
  - см. также: `field-editor` — Tag colors are set per Value under Fields
  - старые названия для поиска: «Opacity Left»
- **Opacity after the text** — `tags-opacity-right`, `slider`, path `visual.tags.opacityRight`, default `100`
  - desc: Dims everything written after your text, tags and elements alike
  - диапазон: 0–100, шаг 1, ед. %
  - старые названия для поиска: «Opacity Right»
- **Text size** — `tags-text-size`, `slider`, path `visual.tags.textSizePct`, default `100`
  - desc: How big the writing inside a bubble is, next to the rest of your note
  - tip: Below 100 the tags step back and your sentence leads. Above 100 they compete with it. Most people end up a little under 100
  - диапазон: 80–140, шаг 5, ед. %
  - старые названия для поиска: «Tag text size»
- **Bubble width** — `tags-bubble-width`, `slider`, path `visual.tags.bubbleWidthPct`, default `100`
  - desc: How much breathing room there is either side of the word
  - диапазон: 80–140, шаг 5, ед. %
  - старые названия для поиска: «Tag bubble size - width»
- **Bubble height** — `tags-bubble-height`, `slider`, path `visual.tags.bubbleHeightPct`, default `100`
  - desc: How tall the bubble is around the word
  - tip: Keep this modest: a tall bubble pushes the lines of your note apart and the page starts to feel airy in a way that is hard to read
  - диапазон: 80–140, шаг 5, ед. %
  - старые названия для поиска: «Tag bubble size - height»
- **Empty bubble width** — `tags-empty-bubble`, `slider`, path `visual.tags.emptyBubblePct`, default `100`
  - desc: Width of a bubble whose <code>Show</code> is set to <code>empty</code>
  - tip: Under <code>Fields</code> a Value can be set to <code>empty</code>, which draws its color but no text — a marker instead of a word. This is how wide that marker gets
  - диапазон: 50–180, шаг 5, ед. %
  - см. также: `field-editor` — Set a Value to empty under Fields
  - старые названия для поиска: «Empty bubble size»
- **Bubble corners** — `tags-corners`, `slider`, path `visual.tags.cornersPct`, default `0`
  - desc: Slide from fully rounded to completely square
  - диапазон: 0–100, шаг 1
  - старые названия для поиска: «Tag shape»

#### Tag Bars — `tag-bars` (вкладка `visual`)

_Intro:_ A coloured Bar in the margin, so you can see at a glance what a whole block of lines is about without reading their tags. The Bar runs down the side of the line and everything nested under it

- **`bars-preview`** — свой блок, рендерер `renderBarsPreview`
- **Tag Bars** — `bars-active`, `toggle`, path `visual.tagBars.active`, default `true`
  - desc: Draw the Bars
  - старые названия для поиска: «Activate strip», «Strip», «Hierarchy Bars», «Level Bars»
- **Which Field draws Bars** — `bars-field`, `dropdown`, path `visual.tagBars.fieldId`, default `status`
  - desc: Bars are drawn for one Field only. Lines without a Value for it get none
  - tip: Pick the one thing you scan a page for — usually how far along something is, or how urgent it is. Switch between the two in the preview above and you will see the Bars change shape, not just colour, because different lines carry different Fields
  - варианты: `status` Status · `priority` Priority
  - видна если: `visual.tagBars.active`
  - см. также: `field-editor` — Bar colors are the Value colors under Fields
  - старые названия для поиска: «Strip Field»
- **Number of Bars** — `bars-count`, `slider`, path `visual.tagBars.stripesToShow`, default `2`
  - desc: How far down the nesting to keep drawing them
  - tip: At 1 only the parent line gets a Bar, however deep the tree goes. At 2 a child with a Value of its own gets a second Bar beside the first. At 3 a grandchild gets a third. A line with no Value never gets one
  - диапазон: 1–3, шаг 1
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Stripes to show»
- **Show the Field's tag** — `bars-show-tag`, `toggle`, path `visual.tagBars.tagVisibility`, default `true`
  - desc: Keep the tag on the line, or let the Bar speak for it
  - tip: With the Bar already showing you the Value by color, the tag itself is often redundant. Hiding it buys back room on the line; the text stays in your note and stays searchable
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip tag visibility»
- **Hide the leftover marker** — `bars-hide-separator`, `toggle`, path `visual.tagBars.hideSeparatorWhenOnlyStripToken`, default `false`
  - desc: Tidy away a Separator that has nothing left beside it
  - tip: If the hidden tag was the only thing in front of your text, the line is left starting with a bare Separator and nothing before it. This clears that up
  - видна если: `visual.tagBars.active, visual.tagBars.tagVisibility`
  - старые названия для поиска: «Hide Separator?»
- **Bar arrangement** — `bars-mode`, `dropdown`, path `visual.tagBars.mode`, default `default`
  - desc: Which lane each level of the tree draws its Bar in
  - tip: Bars are drawn in lanes, one per level, left to right. With <b>parent keeps the outer lane</b> the top line of a tree always owns the leftmost lane, its child the next one in, and so on — so a lane always means the same depth, and you can read nesting by counting from the left. With <b>lanes rotate</b> each new level takes the next lane round in turn, which keeps deep trees narrower but means a lane no longer tells you the depth
  - варианты: `default` Parent keeps the outer lane · `crossing` Lanes rotate
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip mode»
- **Bar thickness** — `bars-thickness`, `slider`, path `visual.tagBars.thickness`, default `3`
  - desc: How wide each Bar is
  - диапазон: 1–12, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip thickness»
- **Space between Bars** — `bars-gap`, `slider`, path `visual.tagBars.childOffset`, default `11`
  - desc: The gap between one level and the next
  - диапазон: 2–20, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Parent/child strip distance»
- **Distance from the text** — `bars-distance`, `slider`, path `visual.tagBars.spacing`, default `14`
  - desc: How far the Bars sit from where your line begins
  - диапазон: 8–48, шаг 1, ед. px
  - видна если: `visual.tagBars.active`
  - старые названия для поиска: «Strip spacing»

#### TagWheel — `tagwheel` (вкладка `visual`)

_Intro:_ TagWheel opens over the line and lays your Fields out across it, with the Values of the Field you are on running down

_Tip:_ Steer it with the arrow keys: left and right move between Fields, up and down between that Field’s Values. <code>Tab</code> jumps across to the Fields on the other side of your text, and <code>Escape</code> closes it without changing anything

- **`wheel-preview`** — свой блок, рендерер `renderWheelPreview`
- **Show tag markers** — `panel-markers`, `toggle`, path `visual.tagWheel.showMarkers`, default `true`
  - desc: Show the hash and emoji in the picker, or just the words
  - tip: A column of words reads faster than a column of words with hashes in front. What actually goes into your note is the same either way
  - старые названия для поиска: «Show Prefix»
- **Text color** — `panel-text-color`, `color`, path `visual.tagWheel.textColor`, default `#5d5b6b`
  - desc: The colour of the Values you are not on
- **Background** — `panel-background`, `color`, path `visual.tagWheel.fillColor`, default `#f1e596`
  - desc: The colour behind the picker
  - tip: Pick something solid enough to read against your note, since the picker is drawn on top of your text
- **Scroller** — `scroller-enabled`, `toggle`, path `visual.tagWheel.scroller.enabled`, default `true`
  - desc: Show the next and previous Values around the current one, in a box you can style
  - tip: Off, you see only where you are and step blindly. On, you see what is coming, which makes a long list much quicker to work through
  - старые названия для поиска: «TagWheel Scroller»
- **Opens** — `scroller-direction`, `dropdown`, path `visual.tagWheel.scroller.direction`, default `full`
  - desc: Which way the Values unroll from the Field you are on
  - варианты: `up` Upwards · `down` Downwards · `full` Both ways
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller direction»
- **Values per side** — `scroller-size`, `slider`, path `visual.tagWheel.scroller.size`, default `3`
  - desc: How many neighbouring Values stay visible around the current one
  - диапазон: 1–20, шаг 1
  - видна если: `visual.tagWheel.scroller.enabled`
  - старые названия для поиска: «Scroller size»

### Все пути состояния

| path | kind | default |
|------|------|---------|
| `advanced.devMode.aiLog` | toggle | `true` |
| `advanced.devMode.enabled` | toggle | `false` |
| `advanced.devMode.logPath` | text | `InlineOverhaul_DevLog` |
| `editor.selectAll.clearOnLast` | toggle | `false` |
| `editor.selectAll.delayMs` | slider | `700` |
| `editor.selectAll.enabled` | toggle | `false` |
| `editor.selectAll.mode` | dropdown | `line-note` |
| `editor.selectAll.useDelay` | toggle | `false` |
| `features.navigation.enabled` | toggle | `true` |
| `features.pkm.enabled` | toggle | `true` |
| `features.transform.enabled` | toggle | `true` |
| `features.visual.enabled` | toggle | `true` |
| `navigation.jumpToHeader.centerCursor` | toggle | `true` |
| `navigation.jumpToHeader.edgeMode` | dropdown | `start-end` |
| `navigation.jumpToHeader.enabled` | toggle | `true` |
| `navigation.jumpToHeader.jumpCursorPosition` | dropdown | `start` |
| `navigation.jumpToHeader.jumpMode` | dropdown | `edge` |
| `navigation.moveLine.crossSectionAllowed` | toggle | `true` |
| `navigation.moveLine.enabled` | toggle | `true` |
| `navigation.moveLine.headerMode` | dropdown | `move-as-line` |
| `navigation.moveLine.highlightMovedLines` | toggle | `false` |
| `navigation.moveLine.noSelectionMode` | dropdown | `line-only` |
| `navigation.moveSelection.indentFallbackEnabled` | toggle | `true` |
| `navigation.moveSelection.inlineEnabled` | toggle | `true` |
| `navigation.moveSelection.inlineMoveMode` | dropdown | `auto` |
| `navigation.moveSelection.onCycleEnd` | dropdown | `indent` |
| `navigation.moveSelection.prefixCyclerEnabled` | toggle | `true` |
| `navigation.moveSelection.rightCycles` | toggle | `true` |
| `navigation.navigateInline.boundaryJump` | toggle | `false` |
| `navigation.navigateInline.enabled` | toggle | `true` |
| `navigation.navigateInline.onBoundary` | dropdown | `wrap` |
| `navigation.navigateInline.stepMode` | dropdown | `word` |
| `pkm.behavior.childTagFormat` | dropdown | `separate` |
| `pkm.behavior.cursorPolicy` | dropdown | `text_end` |
| `pkm.behavior.cycleEndBehavior` | dropdown | `keep-bullet` |
| `pkm.configNote.detail` | dropdown | `detailed` |
| `pkm.configNote.path` | text | `InlineOverhaul_Config.md` |
| `pkm.lineFormat.separator1` | text | `||` |
| `pkm.lineFormat.separator2` | text | `||` |
| `pkm.placement.bulletInStrict` | toggle | `false` |
| `pkm.placement.fieldPrefixInsertOnly` | toggle | `true` |
| `pkm.placement.freeInsertPosition` | dropdown | `smart` |
| `pkm.placement.keepPrefixInsertOnly` | toggle | `true` |
| `pkm.prefixPriority.decideBy` | dropdown | `by-section` |
| `pkm.prefixPriority.fieldOrderSource` | dropdown | `auto` |
| `pkm.prefixPriority.parentOrChild` | dropdown | `tag-over-subtag` |
| `transform.inline2note.defaultTemplate` | dropdown | `task.md` |
| `transform.inline2note.enabled` | toggle | `true` |
| `transform.inline2note.floatingButton` | toggle | `false` |
| `transform.inline2note.nameCollision.mode` | dropdown | `new_note` |
| `transform.inline2note.noteName.delimiters` | text | `()` |
| `transform.inline2note.noteName.mode` | dropdown | `auto` |
| `transform.inline2note.noteName.wordCount` | number | `5` |
| `transform.inline2note.openTarget` | toggle | `true` |
| `transform.inline2note.outputFolder` | text | `""` |
| `transform.inline2note.placement.customHeader` | text | `## Captured` |
| `transform.inline2note.placement.datetimeFormat` | text | `## YYYY-MM-DD HH:mm` |
| `transform.inline2note.placement.headerMode` | dropdown | `custom` |
| `transform.inline2note.placement.position` | dropdown | `beginning` |
| `transform.inline2note.sourceProcessing.panel` | dropdown | `right` |
| `transform.inline2note.sourceProcessing.replaceWithLink` | toggle | `true` |
| `transform.inline2note.sourceProcessing.token` | text | `""` |
| `transform.inline2note.sublines` | dropdown | `stay` |
| `transform.inline2note.templatesFolder` | text | `Templates` |
| `ui.showTips` | toggle | `true` |
| `visual.tagBars.active` | toggle | `true` |
| `visual.tagBars.childOffset` | slider | `11` |
| `visual.tagBars.fieldId` | dropdown | `status` |
| `visual.tagBars.hideSeparatorWhenOnlyStripToken` | toggle | `false` |
| `visual.tagBars.mode` | dropdown | `default` |
| `visual.tagBars.spacing` | slider | `14` |
| `visual.tagBars.stripesToShow` | slider | `2` |
| `visual.tagBars.tagVisibility` | toggle | `true` |
| `visual.tagBars.thickness` | slider | `3` |
| `visual.tags.bubbleHeightPct` | slider | `100` |
| `visual.tags.bubbleWidthPct` | slider | `100` |
| `visual.tags.cornersPct` | slider | `0` |
| `visual.tags.emptyBubblePct` | slider | `100` |
| `visual.tags.opacityLeft` | slider | `100` |
| `visual.tags.opacityRight` | slider | `100` |
| `visual.tags.textSizePct` | slider | `100` |
| `visual.tagWheel.fillColor` | color | `#f1e596` |
| `visual.tagWheel.scroller.direction` | dropdown | `full` |
| `visual.tagWheel.scroller.enabled` | toggle | `true` |
| `visual.tagWheel.scroller.size` | slider | `3` |
| `visual.tagWheel.showMarkers` | toggle | `true` |
| `visual.tagWheel.textColor` | color | `#5d5b6b` |
