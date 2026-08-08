---
type: note
category: process
date: 2026-03-29
project: PKM
tags:
  - baseline
  - process
---

# PKM Baseline Gate v1

## 1. Gate purpose

Gate защищает стабильный baseline перед любыми фичами (`freeRoam`, universal sub-toggle, custom fields, runtime refactor).

## 2. Mandatory artifacts

Перед входом в feature phase должны существовать и быть актуальными:

- `PKM_Baseline_Spec_v1.md`
- `PKM_Baseline_Golden_Matrix_v1.md`
- этот документ

## 3. Pass criteria

Feature branch считается `PASS`, только если:

- Все кейсы Golden Matrix пройдены в hotkey flow
- Все кейсы Golden Matrix пройдены в TagWheel flow
- Нет отличий по cursor behavior
- Нет отличий по spacing/separators
- Нет нарушений `Order`

## 4. Fail conditions

Любой пункт ниже = `FAIL`:

- Изменился expected output хотя бы одного baseline case
- Изменился expected cursor хотя бы одного baseline case
- TagWheel и hotkeys дают разный результат на одном кейсе
- Появились недопустимые separator формы (`||||`, потеря canonical spacing)

## 5. Breaking vs non-breaking

### Breaking change

Считается breaking, если меняется baseline behavior в matrix.

Требования:

- Явное подтверждение пользователя
- Обновление baseline версии (`v1 -> v1.1` или `v2`)
- Обновление matrix/spec/gate

### Non-breaking change

- Внутренний рефактор без изменения output/cursor baseline кейсов
- Добавление новой фичи с выключенным по умолчанию behavior, не влияющим на baseline

## 6. Baseline update procedure

1. Зафиксировать причину обновления baseline
2. Обновить `Spec`
3. Обновить `Golden Matrix`
4. Прогнать matrix
5. Добавить запись в `DEV_LOG.md`

## 7. Builder handoff packet (Phase 0 complete)

Builder получает ссылку на 3 документа выше и использует их как единственный reference для проверки регрессий.

## 8. Next phases (ordered)

1. Universal field model
2. Universal free-roam engine
3. Universal sub-toggle (tag-only v1)
4. Custom fields + any-field hotkey binding
5. Runtime cleanup (`internal runtime` as primary)

## 9. Compile/Startup gate (mandatory)

Перед handoff обязательно пройти compile/startup gate:

1. `node --check` для всех затронутых runtime-файлов.
2. `node tests/regression/bootstrap_loader_tests.js`.
3. Startup smoke в Obsidian: плагин включается без `Plugin failure`.

Любой fail в этих шагах блокирует `PASS` независимо от статуса Golden Matrix.
