---
type: note
category: rules
date: 2026-03-29
project: PKM
tags:
  - baseline
  - pkm
---

# PKM Baseline Spec v1

Этот документ фиксирует baseline-поведение после стабилизации `inline-overhaul` (internal runtime v2) и используется как контракт для всех следующих изменений.

## 1. Scope

- Плагин: корень репозитория Inline Overhaul
- Макросы: `status_tags`, `status_date`
- Интерактив: `TagWheel` apply
- Режим: parity между hotkeys и TagWheel

## 2. Core invariants

- `Order` является единственным источником порядка токенов
- Итоговая строка для одинаковых input/settings/action должна совпадать для hotkey и TagWheel
- Hotkey `importance` маршрутизируется через generic action `status_tags + cycle_field:importance` (single runtime path)
- `subtagFormat` поддерживает `separate` и `combined`
- Правило курсора общее для всех макросов и TagWheel
- Bootstrap-лоадер PKM-макросов общий: `src/core/pkm_macro_runtime_shared.js`
- Reusable bootstrap вызов для макросов централизован в `src/core/pkm_macro_runtime_entry.js` (`bootstrapMacroRuntime`)
- Макросы используют единый глобальный bootstrap getter `__inlineGetPkmMacroRuntime`; локальные pair-loaders в macro-файлах отсутствуют
- Ключи runtime settings и default rules path централизованы в `src/core/pkm_option_keys.js`
- `status_tags`, `status_date` и `tagwheel` синхронизируют runtime key bindings из `pkm_option_keys` при старте macro entry
- PKM domain registry централизован в `src/core/pkm_domain_registry.js` как слой нормализации/резолва `orderKey/fieldId`; расширенная semantic-карта доменов допускается только через data-driven расширение shared core
- Runtime принимает только generic actions (`cycle_field:*`, `field_inc/field_dec:*`) и normalized order keys; legacy action aliases удалены из runtime-path
- `pkm_runtime_v2` работает как единый dispatcher (`runCommand`) без legacy cycle/parser path-вариантов
- Общая status runtime orchestration-обвязка для `status_tags` и `status_date` централизована в `src/core/status_runtime_common.js`
- Loader fallback diagnostics доступны в контролируемом режиме через `globalThis.__inlineDebugLoaders === true`
- TagWheel `left/right` panel group rendering использует единый runtime order/dependency builder для обеих panel (без left-only manual ветки и без runtime-источника `ui.rightGroups`)

## 3. Cursor policy contract

Поддерживаются 3 опции:

- `text_end`
- `current_position`
- `line_end`

Совместимость:

- legacy value `legacy` мигрируется в `current_position`

### 3.1 text_end

- Если есть `separator2`, курсор ставится в конец text-slot перед правой зоной
- Если text-slot пустой в формате `left ||  || right`, курсор ставится в начало text-slot
- Если `separator2` отсутствует, курсор ставится в конец строки
- Принятое правило пользователя: `... || (cursor)` (вариант 1)

### 3.2 current_position

- Курсор сохраняет ближайшую позицию после трансформации строки (diff-based remap)

### 3.3 line_end

- Курсор ставится в конец итоговой строки после любой трансформации

## 4. Separator and spacing invariants

- Канон разделителей:
  - `left || text || right`
  - `left ||  || right` при пустом text-slot и наличии right payload
- Для checkbox empty-right форм сохраняется `- [ ]  || ...` (двойной пробел между checkbox и `||`)
- Не допускаются спонтанные формы `||(cursor)||` без канонических пробелов

## 5. Order and token classification invariants

- Смешанные сегменты сортируются строго по `Order` в пределах своей panel
- Поле отображается только в одной panel согласно `Order.left/right`; дубли left/right запрещены
- Поля вне `Order.left/right` не рендерятся в TagWheel panels (strict-order, без fallback-догрузки)
- Перемещение поля между panels в Order не должно откатываться нормализатором; выбранная panel сохраняется
- Для tag-полей с `*_sub`: parent и sub перемещаются между panels вместе и остаются соседними
- `[[...]]` классифицируется по `wikilink` field id из `Order/leftMode` (без фиксированного semantic field name)
- Combined токены `#parent/sub` классифицируются по parent field key из `Order` (без фиксированной привязки к `type/category`)
- Для `subtagFormat=separate` sub-токены не должны переезжать в другую panel после apply/reorder

## 6. Cycle-end behavior invariants

- Поддерживаются значения:
  - `keep-bullet`
  - `clear-prefix`
- Alias значения с `clear`/`empty` нормализуются в `clear-prefix`
- Для `clear-prefix` пустые prefix-only результаты очищаются до пустой строки

## 7. TagWheel parity invariants

- `TagWheel apply` после hydrate/sanitize должен сохранять те же payload-принципы, что и hotkeys
- Left payload перед `sep1` не должен терять tag/date токены при parse/hydrate
- В `separate` режиме sub-токены должны применяться одинаково в left/right panel
- Порядок полей в left panel берется строго из `Order.left` (без переупорядочивания через `techOrder` fallback)
- Команды `increase/decrease` должны работать для всех custom типов полей из Order: `tag`, `wikilink` (`link`) и `element`
- Для `cycle_field:*` в `freeRoam=minimal` + `minimalSeparator=false` итоговая строка нормализуется в single-pass контракт: без `separator1/2`, с сохранением исходного list/checkbox prefix и без source-dependent drift
- После cycle/reorder dependent-пары (`parent -> sub` по `dependsOn`) остаются соседними в итоговом payload (стабильная adjacency для hotkey и TagWheel путей)
- Для TagWheel apply-path minimal-normalization не блокируется наличием selected off-mode токенов; в mixed `off + minimal` режиме сохраняются существующие токены и удаляется separator drift

## 8. Dev-mode observability invariants

- Доступны только 3 настройки: `dev_mode`, `log_size`, `log_path`
- `log_size="for AI"` -> подробный `.ndjson`; `log_size="for Human"` -> компактный `.md`
- Логирование сессионное: активный файл `<log_path>.new.<ext>`, предыдущий `<log_path>.old.<ext>`
- На старте новой сессии old удаляется, new переименовывается в old, затем создается новый new
- Каждая PKM-команда пишет минимум события: `pkm.run.start`, `pkm.run.result`, `pkm.run.error`
- Логи должны содержать контекст для агентной отладки: command, action type, direction, line before/after, duration
- Логирование не должно влиять на runtime поведение макросов (fail-safe, без throw при ошибке записи)

## 9. Baseline pass criteria

Baseline считается пройденным, если:

- Полный список кейсов из `PKM_Baseline_Golden_Matrix_v1.md` проходит без расхождений
- Нет различий между hotkeys и TagWheel по тем же сценариям
- Нет регрессий курсора и spacing

## 10. Change policy summary

- Любое изменение output line/cursor в baseline кейсах считается breaking
- Breaking change разрешен только при явном обновлении baseline версии (v1 -> v1.1/v2)

## 11. Generic-fields migration contract (Iteration D)

- Любой новый field в `Order` должен работать через generic command routing:
  - `tag/wikilink` -> `cycle_field:<orderKey>`
  - `element` -> `field_inc:<orderKey>` / `field_dec:<orderKey>`
- UI/Config note слой не должен резервировать semantic names (`type/category/project/...`); разрешены только технические ограничения (`*_sub`, валидный `name_strict` формат)
- Legacy ids/actions не допускаются в runtime/modules; используются только canonical order keys и generic action contracts
- Зависимость parent/sub определяется через `dependsOn` и normalized order metadata, не через literal canonical names
- UI actions в Settings могут показывать ограниченный preset значений, но runtime обязан принимать и корректно обрабатывать generic actions вида `cycle_field:<orderKey>` для любого валидного поля
