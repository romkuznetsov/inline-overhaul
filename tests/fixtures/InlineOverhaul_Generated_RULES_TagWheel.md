# Synthetic TagWheel Rules Fixture

Minimal generated-rules fixture for automated tests. Values are fictional and vault-independent.

```tagwheel-meta
{
  "schemaVersion": 2,
  "name": "SyntheticTagWheelFixture"
}
```

```tagwheel-io
{
  "separator1": "::",
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
  "estimatedCycle": ["00:15", "00:30", "01:00"],
  "typeCheckboxByValue": {
    "todo": "[ ]",
    "note": "[N]",
    "idea": "[I]",
    "open": "[?]",
    "source": "[S]"
  },
  "prefixRules": {
    "resolver": "priority-first",
    "priorityTargets": [
      "priority",
      "context",
      "nestedContext",
      "type",
      "modal",
      "project",
      "client",
      "client_sub",
      "client1",
      "client1_sub"
    ],
    "checkboxByFieldValue": {
      "type": {
        "todo": "[ ]",
        "note": "[N]",
        "idea": "[I]",
        "open": "[?]",
        "source": "[S]"
      },
      "context": {
        "area-alpha": "[a]",
        "area-beta": "[b]",
        "area-gamma": "[c]"
      }
    },
    "priorityMode": "by-checkbox-list",
    "priorityCheckboxes": ["[ ]", "[a]", "[b]", "[c]", "[I]", "[N]", "[?]", "[S]"],
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
  "activationFocus": {
    "left": { "defaultFieldId": "priority" },
    "right": { "defaultFieldId": "timeNow" }
  },
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
      "id": "priority",
      "prefix": "",
      "values": ["", "#/1", "#/2", "#/3"]
    },
    {
      "id": "type",
      "prefix": "#",
      "values": ["", "todo", "idea", "note", "open", "source"]
    },
    {
      "id": "modal",
      "prefix": "#",
      "dependsOn": "type",
      "disabledForParentValues": ["todo", "open"],
      "values": [
        "",
        { "token": "idea-child", "allowedParentValues": ["idea"] },
        { "token": "note-child", "allowedParentValues": ["note"] }
      ]
    },
    {
      "id": "context",
      "prefix": "#",
      "values": ["", "area-alpha", "area-beta", "area-gamma"]
    },
    {
      "id": "nestedContext",
      "prefix": "#",
      "dependsOn": "context",
      "values": [
        "",
        { "token": "area-alpha-child", "allowedParentValues": ["area-alpha"] },
        { "token": "area-beta-child", "allowedParentValues": ["area-beta"] }
      ]
    },
    {
      "id": "project",
      "prefix": "#",
      "source": "projects"
    },
    {
      "id": "client",
      "prefix": "#",
      "values": ["", "tenant-alpha", "tenant-beta"]
    },
    {
      "id": "client_sub",
      "prefix": "#",
      "dependsOn": "client",
      "values": [
        "",
        { "token": "tenant-alpha-child", "allowedParentValues": ["tenant-alpha"] }
      ]
    },
    {
      "id": "client1",
      "prefix": "#",
      "values": ["", "account-alpha"]
    },
    {
      "id": "client1_sub",
      "prefix": "#",
      "dependsOn": "client1",
      "values": []
    },
    {
      "id": "topic",
      "prefix": "#",
      "values": ["", "topic-alpha", "topic-beta"]
    },
    {
      "id": "topic_sub",
      "prefix": "#",
      "dependsOn": "topic",
      "values": [
        "",
        { "token": "topic-alpha-child", "allowedParentValues": ["topic-alpha"] },
        { "token": "topic-beta-child", "allowedParentValues": ["topic-beta"] }
      ]
    },
    {
      "id": "clients",
      "source": "wikilinks:clients",
      "values": [
        { "token": "EntityAlpha", "active": true },
        { "token": "EntityBeta", "active": true }
      ]
    }
  ]
}
```

```tagwheel-right-mode
{
  "fields": [
    {
      "id": "timeNow",
      "kind": "nowTime",
      "marker": "🕒",
      "values": [""]
    },
    {
      "id": "estimated",
      "kind": "estimatedCycle",
      "marker": "⌛",
      "values": [""]
    },
    {
      "id": "start",
      "kind": "dateOffset",
      "marker": "🛫",
      "values": [""]
    },
    {
      "id": "due",
      "kind": "dateOffset",
      "marker": "📅",
      "values": [""]
    }
  ]
}
```

```triggerwheel-triggers
{
  "behavior": {
    "keymap": {
      "nextField": "ArrowRight",
      "prevField": "ArrowLeft",
      "valueUp": "ArrowUp",
      "valueDown": "ArrowDown",
      "switchField": "Tab",
      "apply": "Enter",
      "cancel": "Escape"
    }
  },
  "categories": ["✏️ TEXT", "🔍 ANALYSIS", "📋 SUMMARY"],
  "items": [
    { "trigger": "+", "category": "✏️ TEXT", "alias": "expand", "label": "`+` - expand" },
    { "trigger": "?", "category": "🔍 ANALYSIS", "alias": "analyze", "label": "`?` - analyze" },
    { "trigger": "=", "category": "📋 SUMMARY", "alias": "summarize", "label": "`=` - summarize" },
    { "trigger": "==", "category": "📋 SUMMARY", "alias": "summarize-deep", "label": "`==` - summarize-deep" }
  ]
}
```

```tagwheel-projects
{
  "output": "wikilink",
  "filterKeys": ["context", "nestedContext"],
  "includeDefaultsWhenFiltered": false,
  "defaults": ["[[Project Inbox]]"],
  "byContext": {
    "area-alpha": {
      "branch": ["[[Project Alpha]]"],
      "leaf": {
        "area-alpha-child": ["[[Project Alpha Child]]"]
      }
    },
    "area-beta": {
      "branch": ["[[Project Beta]]"],
      "leaf": {
        "area-beta-child": ["[[Project Beta Child]]"]
      }
    }
  }
}
```
