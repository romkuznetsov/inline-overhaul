# Rules fixture: the shape the owner's vault actually has

Вторая фикстура правил, и заведена она нарочно: у первой
(`InlineOverhaul_Generated_RULES_TagWheel.md`) три формы совпадают с теми, на
которых дефект неразличим (У-147).

**Чем эта отличается, и почему каждое отличие куплено замечанием:**

| Форма | Первая фикстура | Здесь | Что это ловит |
|---|---|---|---|
| разделители | `::` и `::` — совпадают | `\|\|` и `::` | правило, верное при совпадающих разделителях и неверное при разных |
| элемент | поле зовут `due`, ключ Order — `date_due` | имя поля равно ключу Order | плагин пишет правила так, и только так элемент виден в Block по Order |
| значение важности | `#/1` | `#/1` — та же форма | косая черта **сразу за приставкой**: родителя в таком токене нет |
| формат элемента | `YYYY-MM-DD` — одно слово | `YYYY-MM-DD hh:mm` — два | значение из двух слов: вторую половину теряли (10.13.71) |
| предусловие | только у дочерних Field (`*_sub`) | у `Project` — своё место в Block **и** предусловие | Field, который панель прячет, а команда ставила: правило Н21 было объявлено в документе и на пути команд не спрошено ни разу |

Значения вымышленные и от vault не зависят.

```tagwheel-meta
{
  "schemaVersion": 2,
  "name": "OwnerShapeRulesFixture"
}
```

```tagwheel-io
{
  "separator1": "||",
  "separator2": "::"
}
```

```tagwheel-behavior
{
  "defaultMode": "left",
  "startModeInputKey": "startMode",
  "startSettingInputKey": "startSetting",
  "startSettings": {
    "default": "left",
    "profiles": {
      "left": { "startMode": "left" },
      "right": { "startMode": "right" }
    }
  },
  "forceSeparatorWhenTags": true,
  "skipDisabledFieldsOnNavigate": true,
  "subtagFormat": "separate",
  "prefixRules": {
    "resolver": "priority-first",
    "priorityTargets": ["Importance", "Category", "type"],
    "checkboxByFieldValue": {
      "type": {
        "#todo": "[ ]",
        "#note": "[N]"
      }
    },
    "priorityMode": "by-section",
    "fieldsOrderMode": "manual",
    "tagSubtagPriority": "subtag-over-tag"
  },
  "keymap": {
    "nextField": "ArrowRight",
    "prevField": "ArrowLeft",
    "valueUp": "ArrowUp",
    "valueDown": "ArrowDown",
    "switchMode": "Tab",
    "apply": "Enter",
    "cancel": "Escape"
  }
}
```

```tagwheel-ui
{
  "placeholderStyle": "code",
  "activePanel": {
    "enabled": true,
    "useHighlight": true,
    "showMarkers": false,
    "prefix": "{TW}",
    "suffix": "{/TW}"
  },
  "leftGroups": [],
  "rightGroups": []
}
```

```tagwheel-left-mode
{
  "fields": [
    {
      "id": "Category",
      "prefix": "#",
      "placeholder": "Cat",
      "values": ["", "#work", "#home"]
    },
    {
      "id": "Importance",
      "prefix": "",
      "placeholder": "Imp",
      "values": ["", "#/1", "#/2", "#/3"]
    },
    {
      "id": "type",
      "prefix": "",
      "placeholder": "Type",
      "values": ["", "#todo", "#note"]
    }
  ]
}
```

```tagwheel-right-mode
{
  "fields": [
    {
      "id": "date_due",
      "kind": "genericElement",
      "marker": "📅",
      "placeholder": "Due",
      "values": [""]
    },
    {
      "id": "Project",
      "prefix": "#",
      "source": "wikilinks:Project",
      "placeholder": "Project",
      "dependsOn": "Category",
      "enabledForParentValues": ["#work"],
      "values": [
        { "token": "alpha", "active": true },
        { "token": "beta", "active": true }
      ]
    }
  ]
}
```

```tagwheel-projects
{
  "output": "wikilink",
  "filterKeys": [],
  "includeDefaultsWhenFiltered": false,
  "defaults": [],
  "byContext": {},
  "items": [],
  "rules": [],
  "catalog": []
}
```

```tagwheel-wikilinks
{
  "fields": ["Project"],
  "byField": {
    "Project": {
      "bySection": {
        "Project": {
          "defaults": ["[[alpha]]", "[[beta]]"],
          "byParent": {}
        }
      }
    }
  }
}
```
