# Согласованный прототип панели настроек

**Файл:** `settings_prototype.html`
**Согласован заказчиком:** 2026-08-24
**Артефакт:** https://claude.ai/code/artifact/a212fb11-5cff-4aac-b8dd-377732331731
**SHA-256:** `6e21053546a970a07c1789b69ddebdc1172827f149a635ceb82b44050f3366d2`
**Размер:** 204 587 байт, 3 924 строки

## Что зафиксировано

Прототип — нормативный источник по структуре панели, всем видимым текстам и поведению своих блоков (PRD, решение Р8). Он открывается в браузере и работает без сборки: моковый vault, темы Obsidian, режим комментариев, показ id и путей конфига.

| | |
|---|---|
| Вкладок | 7 |
| Групп | 33 |
| Настроек | 91 |
| Своих блоков | 21 |
| С описанием | 91 |
| С подсказкой | 71 |

## Проверка

Все проверки запускаются из корня репозитория и должны проходить без правок:

```
node tests/prototype/gates.js       docs/prototype/settings_prototype.html
node tests/prototype/smoke.js       docs/prototype/settings_prototype.html
node tests/prototype/check_bars.js  docs/prototype/settings_prototype.html
node tests/prototype/check_wheel.js docs/prototype/settings_prototype.html
node tests/prototype/check_rules.js docs/prototype/settings_prototype.html
node tests/prototype/check_fields.js docs/prototype/settings_prototype.html
```

`gates.js` проверяет схему, тексты и CSS: уникальность id, наличие рендереров, отсутствие дублей функций и селекторов, регистр сущностей в обе стороны, отсутствие точки в конце описаний. `smoke.js` рендерит каждую вкладку, каждый блок и каждый диалог на заглушке DOM. Остальные читают результат рендера — порядок значений в скроллере TagWheel, полосы на каждой строке, вычисленные значения — а не исходный код.

## Как менять

Прототип правится **до** кода, не после. Порядок:

1. изменить `settings_prototype.html`;
2. прогнать проверки выше;
3. перегенерировать опись и сверку:

```
node tests/prototype/dump_schema.js docs/prototype/settings_prototype.html appendix_b.md
node tests/prototype/reconcile.js   docs/PRD_Settings_Overhaul_v1.md docs/prototype/settings_prototype.html reconcile.md
```

4. вклеить результат в Приложение B и раздел 9 PRD;
5. обновить SHA-256 и дату в этом файле.

Сверка (`reconcile.js`) не должна выдавать ни одной строки «нет соответствия»: такая строка означает, что настройка версии 1 потерялась, а решение о её снятии не записано.

## Решения последнего круга правок

- Точка в конце видимых строк не ставится; в абзаце точки между предложениями остаются.
- Сущности плагина — имена собственные: `Field`, `Value`, `Bar`, `Prefix`, `Separator`, `Left Block`, `Right Block`, `TagWheel`, `Binder`, `Transform`, `Smart Rules`. Слова Obsidian и обычного языка — со строчной.
- В редакторе Fields списки называются `Left Block` и `Right Block`, над колонками стоит шапка `Fields` / `Values`, перемещение — только перетаскиванием за ручку, без кнопок-стрелок.
- Цвет типа `tag` — `#c2683f`: акцент темы занят основными действиями, и тип поля не должен с ними спорить.
- В предпросмотре Tag Bars строка всегда несёт все свои теги; переключение `Which Field draws Bars` меняет только полосы.
- Путь конфига полос — `visual.tagBars.*`, id группы — `tag-bars`: путь повторяет название группы.
