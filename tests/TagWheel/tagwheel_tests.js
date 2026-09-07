function assertEq(actual, expected, name) {
  if (actual !== expected) {
    throw new Error(name + ': expected `' + expected + '`, got `' + actual + '`')
  }
}

function assertTrue(value, name) {
  if (!value) throw new Error(name + ': expected truthy value')
}

function assertArrayEq(actual, expected, name) {
  var a = JSON.stringify(actual)
  var e = JSON.stringify(expected)
  if (a !== e) {
    throw new Error(name + ': expected ' + e + ', got ' + a)
  }
}

function runSuite(core, rules, finalize) {
  ;(function testParseLineNormal() {
    var p = core.parseLine('- [ ] #todo #unmanaged :: Task text :: 📅2026-03-12', rules)
    assertEq(p.text, 'Task text', 'parse line text')
    assertEq(p.dates, '📅2026-03-12', 'parse line dates')
  })()

  ;(function testParseLineNoTextDuplicationForRightPayload() {
    var p = core.parseLine('- 11 :: 📅2026-03-12', rules)
    assertEq(p.text, '11', 'parse line keeps single left text token')
    assertEq(p.dates, '📅2026-03-12', 'parse line detects right payload token after separator')
  })()

  ;(function testParseLineUsesRuntimeMarkerForSingleSeparatorRightPayload() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.io) localRules.io = {}
    localRules.io.separator1 = '::'
    localRules.io.separator2 = '::'
    if (!localRules.behavior) localRules.behavior = {}
    if (!localRules.behavior.dateRuntimeConfig) localRules.behavior.dateRuntimeConfig = {}
    if (!localRules.behavior.dateRuntimeConfig.dates) localRules.behavior.dateRuntimeConfig.dates = {}
    if (!localRules.behavior.dateRuntimeConfig.dates.byField) localRules.behavior.dateRuntimeConfig.dates.byField = {}
    var rightFields = Array.isArray(localRules.rightMode && localRules.rightMode.fields) ? localRules.rightMode.fields : []
    var dueField = null
    var i
    for (i = 0; i < rightFields.length; i++) {
      var f = rightFields[i]
      if (!f || f.kind !== 'dateOffset') continue
      dueField = f
      break
    }
    if (!dueField) throw new Error('fixture must contain right dateOffset field')
    dueField.marker = ''
    var runtimeEmoji = '📅'
    localRules.behavior.dateRuntimeConfig.dates.byField[dueField.id] = { emoji: runtimeEmoji, format: 'YYYY-MM-DD' }

    var p = core.parseLine('111 :: ' + runtimeEmoji + '2026-04-28', localRules)
    assertEq(p.text, '111', 'single-separator parse keeps plain text slot without duplication')
    assertEq(p.dates, runtimeEmoji + '2026-04-28', 'single-separator parse routes runtime-marker token to right payload')

    var s = core.makeInitialState(localRules, 'right')
    s.mode = 'right'
    core.hydrateStateFromParsedLine(localRules, s, p)
    core.sanitizeState(localRules, s)
    s.activeFieldId = dueField.id
    var control = core.renderControlLine(localRules, s, p)
    assertTrue(control.indexOf('111 :: ') === 0, 'single-separator reopen preserves text slot placement without duplication')
  })()

  ;(function testParseLineKeepsMarkerPayloadWithSpacesInRightSegment() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort: {
          activeMode: 'yes',
          emoji: '➕',
          format: 'YYYY-MM-DD HH-mm-ss',
          increment: { mode: 'command', incrementBy: 1, command: 'now', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      { id: 'effort', orderKey: 'effort', kind: 'genericElement', marker: '➕', placeholder: 'effort', enabled: true, values: [{ id: '', token: '', order: 0, active: true }] }
    ]
    var line = '- [ ] #todo :: ➕2026-05-04 12-53-03'
    var p = core.parseLine(line, localRules)
    assertEq(p.text, '', 'spaced marker payload does not leak into text segment')
    assertEq(p.dates, '➕2026-05-04 12-53-03', 'spaced marker payload stays in right segment')
  })()

  ;(function testRightPayloadKeepsSeparatorInvariantForPlainSource() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.io) localRules.io = {}
    localRules.io.separator1 = '::'
    localRules.io.separator2 = '::'
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort: {
          activeMode: 'yes',
          emoji: '➕',
          format: 'YYYY-MM-DD HH-mm-ss',
          increment: { mode: 'command', incrementBy: 1, command: 'now', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      { id: 'effort', orderKey: 'effort', kind: 'genericElement', marker: '➕', placeholder: 'effort', enabled: true, values: [{ id: '', token: '', order: 0, active: true }] }
    ]
    var p = core.parseLine('- 11 :: ➕2026-05-04 13-21-17', localRules)
    assertEq(p.text, '11', 'plain source keeps single text slot token')
    assertEq(p.dates, '➕2026-05-04 13-21-17', 'plain source keeps marker datetime payload in right slot')
    var out = core.assembleFinalLine(
      { indent: '', prefix: '- ', text: p.text, dates: p.dates },
      [],
      localRules
    )
    assertEq(out, '- 11 :: ➕2026-05-04 13-21-17', 'assemble final line preserves separator/right payload invariant without text duplication')
  })()

  ;(function testChildDisabledWithoutParent() {
    var s = core.makeInitialState(rules, 'left')
    var mode = rules.leftMode
    var modalField = mode.fields.filter(function(f) { return f.id === 'modal' })[0]
    assertEq(core.isFieldEnabled(mode, s, modalField), false, 'modal disabled without parent')
  })()

  ;(function testChildEnabledWithParent() {
    var s = core.makeInitialState(rules, 'left')
    var mode = rules.leftMode
    s.selected.type = 'note'
    var modalField = mode.fields.filter(function(f) { return f.id === 'modal' })[0]
    assertEq(core.isFieldEnabled(mode, s, modalField), true, 'modal enabled with parent')
    var values = core.getAllowedValues(mode, s, modalField, rules)
    var ids = values.map(function(v) { return v.id })
    assertTrue(ids.indexOf('note-child') !== -1, 'log allowed for note')
    assertEq(ids.indexOf('unmanaged') !== -1, false, 'unmanaged value blocked for note')
  })()

  ;(function testOutputTagFormat() {
    var s = core.makeInitialState(rules, 'left')
    s.selected.type = 'note'
    s.selected.modal = 'note-child'
    var tags = core.buildTags(rules.leftMode, s, rules)
    assertArrayEq(tags, ['#note', '#note-child'], 'output #parent #child')
  })()

  ;(function testTypeCheckboxMap() {
    var s = core.makeInitialState(rules, 'left')
    s.selected.type = 'idea'
    var parsed = { bulletToken: '-', checkboxToken: '', indent: '', text: '', dates: '' }
    var prefix = core.buildPrefix(parsed, rules, s, { prefixShared: finalize })
    assertEq(prefix, '- [I] ', 'type -> checkbox mapping')
  })()

  ;(function testHydratePriority() {
    var p = core.parseLine('- [ ] #/3 #todo :: text', rules)
    var s = core.makeInitialState(rules, 'left')
    core.hydrateStateFromParsedLine(rules, s, p)
    core.sanitizeState(rules, s)
    assertEq(s.selected.priority, '#/3', 'priority restored on re-activate')
  })()

  ;(function testHydrateLastTokenWinsForSameField() {
    var p = core.parseLine('- [ ] #/3 #todo #/1 :: text', rules)
    var s = core.makeInitialState(rules, 'left')
    core.hydrateStateFromParsedLine(rules, s, p)
    core.sanitizeState(rules, s)
    assertEq(s.selected.priority, '#/1', 'hydrate uses last token occurrence for same field')
  })()

  ;(function testCycleParentClearsDependentSubSelection() {
    var s = core.makeInitialState(rules, 'left')
    s.selected.type = 'idea'
    s.selected.modal = 'idea-child'
    s.activeFieldId = 'type'
    core.cycleValue(rules, s, 1)
    assertEq(s.selected.type, 'note', 'parent tag cycles to next value')
    assertEq(s.selected.modal, '', 'dependent subtag is cleared when parent changes')
  })()

  ;(function testProjectOutputWikilink() {
    var s = core.makeInitialState(rules, 'left')
    s.selected.context = 'area-beta'
    s.selected.nestedContext = 'area-beta-child'
    s.selected.project = 'Project Beta Child'
    var tags = core.buildTags(rules.leftMode, s, rules)
    assertTrue(tags.indexOf('[[Project Beta Child]]') !== -1, 'project is rendered as wikilink')
  })()

  ;(function testAssembleLine() {
    var line = core.assembleFinalLine(
      {
        indent: '',
        prefix: '- [ ] ',
        text: 'Write docs',
        dates: '📅2026-03-12'
      },
      ['#/2', '#todo', '#unmanaged', '[[ops]]'],
      rules
    )
    assertEq(line, '- [ ] #/2 #todo #unmanaged [[ops]] :: Write docs :: 📅2026-03-12', 'assemble final line')
  })()

  ;(function testForceSeparatorEmptyText() {
    var line = core.assembleFinalLine(
      { indent: '', prefix: '- [ ] ', text: '', dates: '' },
      ['#todo'],
      rules,
      { forceSeparatorWhenTags: true }
    )
    assertEq(line, '- [ ] #todo ::', 'separator added for empty text line')
  })()

  ;(function testRightNowToggle() {
    var s = core.makeInitialState(rules, 'right')
    s.mode = 'right'
    s.__nowHHmm = '10:30'
    var mode = rules.rightMode
    s.activeField = mode.fields.findIndex(function(f) { return f.id === 'timeNow' })
    core.cycleValue(rules, s, 1)
    assertEq(s.selected.timeNow, '10:30', 'right now set from session')
    core.cycleValue(rules, s, -1)
    assertEq(s.selected.timeNow, '10:25', 'right now down decrements by configured step')
  })()

  ;(function testGenericElementTokenlessIncrementByFormat() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort: {
          activeMode: 'yes',
          format: '1',
          increment: { mode: 'standard', incrementBy: 1, command: 'now', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      {
        id: 'effort',
        kind: 'genericElement',
        marker: '➕',
        placeholder: 'effort',
        enabled: true,
        values: [{ id: '', token: '', order: 0, active: true }]
      }
    ]
    var s = core.makeInitialState(localRules, 'right')
    s.mode = 'right'
    s.activeField = 0
    s.activeFieldId = 'effort'
    core.cycleValue(localRules, s, 1)
    assertEq(core.buildRightDates(localRules, s)[0], '➕1', 'generic element starts from format baseline')
    core.cycleValue(localRules, s, 1)
    assertEq(core.buildRightDates(localRules, s)[0], '➕2', 'generic element increments tokenless format by step')
  })()

  ;(function testGenericElementDateTokensIncrementSmallestUnit() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort: {
          activeMode: 'yes',
          format: 'YYYY',
          increment: { mode: 'standard', incrementBy: 1, command: 'now', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      {
        id: 'effort',
        kind: 'genericElement',
        marker: '➕',
        placeholder: 'effort',
        enabled: true,
        values: [{ id: '', token: '', order: 0, active: true }]
      }
    ]
    var s = core.makeInitialState(localRules, 'right')
    s.mode = 'right'
    s.activeField = 0
    s.activeFieldId = 'effort'
    s.__todayIso = '2026-04-11'
    core.cycleValue(localRules, s, 1)
    assertEq(core.buildRightDates(localRules, s)[0], '➕2026', 'generic YYYY initializes from current year')
    core.cycleValue(localRules, s, 1)
    assertEq(core.buildRightDates(localRules, s)[0], '➕2027', 'generic YYYY increments year by one')
  })()

  ;(function testGenericElementCommandNowWithDateTimeMask() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort: {
          activeMode: 'yes',
          format: 'YYYY-MM-DD HH:mm',
          increment: { mode: 'command', incrementBy: 1, command: 'now', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      {
        id: 'effort',
        kind: 'genericElement',
        marker: '➕',
        placeholder: 'effort',
        enabled: true,
        values: [{ id: '', token: '', order: 0, active: true }]
      }
    ]
    var s = core.makeInitialState(localRules, 'right')
    s.mode = 'right'
    s.activeField = 0
    s.activeFieldId = 'effort'
    core.cycleValue(localRules, s, 1)
    var out = core.buildRightDates(localRules, s)[0] || ''
    assertTrue(/^➕\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(out), 'generic command(now) uses datetime mask for first value')
  })()

  ;(function testGenericElementCommandNowWithNumericMask() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort: {
          activeMode: 'yes',
          format: '111',
          increment: { mode: 'command', incrementBy: 1, command: 'now', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      {
        id: 'effort',
        kind: 'genericElement',
        marker: '➕',
        placeholder: 'effort',
        enabled: true,
        values: [{ id: '', token: '', order: 0, active: true }]
      }
    ]
    var s = core.makeInitialState(localRules, 'right')
    s.mode = 'right'
    s.activeField = 0
    s.activeFieldId = 'effort'
    core.cycleValue(localRules, s, 1)
    var out = core.buildRightDates(localRules, s)[0] || ''
    assertTrue(/^➕\d{3}$/.test(out), 'generic command(now) with tokenless numeric mask emits numeric value of same length')
  })()

  ;(function testGenericElementCommandRandomN() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort: {
          activeMode: 'yes',
          format: '111',
          increment: { mode: 'command', incrementBy: 1, command: 'randomN', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      {
        id: 'effort',
        kind: 'genericElement',
        marker: '➕',
        placeholder: 'effort',
        enabled: true,
        values: [{ id: '', token: '', order: 0, active: true }]
      }
    ]
    var s = core.makeInitialState(localRules, 'right')
    s.mode = 'right'
    s.activeField = 0
    s.activeFieldId = 'effort'
    core.cycleValue(localRules, s, 1)
    var out1 = core.buildRightDates(localRules, s)[0] || ''
    var out2 = out1
    var tries = 0
    while (out2 === out1 && tries < 6) {
      core.cycleValue(localRules, s, 1)
      out2 = core.buildRightDates(localRules, s)[0] || ''
      tries += 1
    }
    assertTrue(/^➕\d{3}$/.test(out1), 'generic command(randomN) first output matches numeric mask')
    assertTrue(/^➕\d{3}$/.test(out2), 'generic command(randomN) second output matches numeric mask')
    assertTrue(out1 !== out2, 'generic command(randomN) changes output between presses')
  })()

  ;(function testGenericElementCommandRandomE() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort: {
          activeMode: 'yes',
          format: '111',
          increment: { mode: 'command', incrementBy: 1, command: 'randomE', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      {
        id: 'effort',
        kind: 'genericElement',
        marker: '➕',
        placeholder: 'effort',
        enabled: true,
        values: [{ id: '', token: '', order: 0, active: true }]
      }
    ]
    var s = core.makeInitialState(localRules, 'right')
    s.mode = 'right'
    s.activeField = 0
    s.activeFieldId = 'effort'
    core.cycleValue(localRules, s, 1)
    var out = core.buildRightDates(localRules, s)[0] || ''
    assertTrue(/^➕[A-Za-z0-9#><\-_]{3}$/.test(out), 'generic command(randomE) emits 3 allowed symbols')
  })()

  ;(function testGenericElementCommandRandomEHydratesSelectionOnReopen() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort: {
          activeMode: 'yes',
          format: '111',
          increment: { mode: 'command', incrementBy: 1, command: 'randomE', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      {
        id: 'effort',
        kind: 'genericElement',
        marker: '➕',
        placeholder: 'effort',
        enabled: true,
        values: [{ id: '', token: '', order: 0, active: true }]
      }
    ]
    var s1 = core.makeInitialState(localRules, 'right')
    s1.mode = 'right'
    s1.activeField = 0
    s1.activeFieldId = 'effort'
    core.cycleValue(localRules, s1, 1)
    var token = core.buildRightDates(localRules, s1)[0] || ''
    assertTrue(/^➕[A-Za-z0-9#><\-_]{3}$/.test(token), 'randomE token generated before reopen')
    var p = core.parseLine('- [ ] #todo :: text :: ' + token, localRules)
    var s2 = core.makeInitialState(localRules, 'right')
    s2.mode = 'right'
    core.hydrateStateFromParsedLine(localRules, s2, p)
    core.sanitizeState(localRules, s2)
    var reopened = core.getDisplayTokenByFieldId(localRules, s2, 'effort') || ''
    assertEq(reopened, token, 'randomE token is restored as selected on reopen')
  })()

  ;(function testGenericElementCommandNowHydratesSelectionOnReopen() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort: {
          activeMode: 'yes',
          format: '111',
          increment: { mode: 'command', incrementBy: 1, command: 'now', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      {
        id: 'effort',
        kind: 'genericElement',
        marker: '➕',
        placeholder: 'effort',
        enabled: true,
        values: [{ id: '', token: '', order: 0, active: true }]
      }
    ]
    var s1 = core.makeInitialState(localRules, 'right')
    s1.mode = 'right'
    s1.activeField = 0
    s1.activeFieldId = 'effort'
    core.cycleValue(localRules, s1, 1)
    var token = core.buildRightDates(localRules, s1)[0] || ''
    assertTrue(/^➕\d{3}$/.test(token), 'now token generated before reopen')
    var p = core.parseLine('- [ ] #todo :: text :: ' + token, localRules)
    var s2 = core.makeInitialState(localRules, 'right')
    s2.mode = 'right'
    core.hydrateStateFromParsedLine(localRules, s2, p)
    core.sanitizeState(localRules, s2)
    var reopened = core.getDisplayTokenByFieldId(localRules, s2, 'effort') || ''
    assertEq(reopened, token, 'now token is restored as selected on reopen')
  })()

  ;(function testGenericElementWithoutMarkerPersistsOnApply() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        test1: {
          activeMode: 'yes',
          format: 'YYYY',
          increment: { mode: 'standard', incrementBy: 1, command: 'now', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      {
        id: 'test1',
        kind: 'genericElement',
        marker: '',
        placeholder: 'test1',
        enabled: true,
        values: [{ id: '', token: '', order: 0, active: true }]
      }
    ]
    var s = core.makeInitialState(localRules, 'right')
    s.mode = 'right'
    s.activeField = 0
    s.activeFieldId = 'test1'
    s.__todayIso = '2026-04-11'
    core.cycleValue(localRules, s, 1)
    var out = core.buildRightDates(localRules, s)[0] || ''
    assertEq(out, '2026', 'generic element without marker is emitted as plain token')
  })()

  ;(function testGenericElementTokenlessHydrateKeepsRenderedValueOnReopen() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.io) localRules.io = {}
    localRules.io.separator1 = '::'
    localRules.io.separator2 = '::'
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort1: {
          activeMode: 'yes',
          emoji: '🎚️',
          format: '111111',
          increment: { mode: 'standard', incrementBy: 111111, command: 'now', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      {
        id: 'effort1',
        orderKey: 'effort1',
        kind: 'genericElement',
        marker: '🎚️',
        placeholder: 'effort1',
        enabled: true,
        values: [{ id: '', token: '', order: 0, active: true }]
      }
    ]
    var p = core.parseLine('111 :: 🎚️111111', localRules)
    var s = core.makeInitialState(localRules, 'right')
    s.mode = 'right'
    core.hydrateStateFromParsedLine(localRules, s, p)
    core.sanitizeState(localRules, s)
    var out = core.buildRightDates(localRules, s)[0] || ''
    assertEq(out, '🎚️111111', 'tokenless generic reopen keeps same rendered value without implicit increment')
  })()

  ;(function testGenericElementUsesRuntimeEmojiWhenFieldMarkerMissing() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.dateRuntimeConfig = {
      byField: {
        effort: {
          activeMode: 'yes',
          emoji: '📅',
          format: '1',
          increment: { mode: 'standard', incrementBy: 1, command: 'now', custom: [], customRaw: [] }
        }
      },
      canonical: { date_due: 'date_due', date_start: 'date_start', time: 'time' }
    }
    localRules.rightMode.fields = [
      {
        id: 'effort',
        orderKey: 'effort',
        kind: 'genericElement',
        marker: '',
        placeholder: 'effort',
        enabled: true,
        values: [{ id: '', token: '', order: 0, active: true }]
      }
    ]
    var s = core.makeInitialState(localRules, 'right')
    s.mode = 'right'
    s.activeField = 0
    s.activeFieldId = 'effort'
    s.selected.effort = '1'
    var out = core.buildRightDates(localRules, s)[0] || ''
    assertEq(out, '📅2', 'generic element uses runtime-config emoji marker when field marker is empty')
  })()

  ;(function testProjectValuesFollowSourceByContextCatalog() {
    var localRules = JSON.parse(JSON.stringify(rules))
    var i
    for (i = 0; i < localRules.leftMode.fields.length; i++) {
      var f = localRules.leftMode.fields[i]
      if (!f || f.id !== 'project') continue
      f.source = 'projects'
      f.values = [
        { id: '', token: '', allowedParentValues: null },
        { id: '#example', token: '#example', allowedParentValues: null }
      ]
    }
    localRules.projects = {
      items: [
        { id: 'Stale Project', token: 'Stale Project' }
      ],
      byContext: {
        'area-beta': {
          branch: ['Project Beta'],
          leaf: {
            'area-beta-child': ['Project Beta Child']
          }
        }
      },
      defaults: ['[[EntityAlpha]]']
    }
    var mode = localRules.leftMode
    var state = core.makeInitialState(localRules, 'left')
    state.selected.context = 'area-beta'
    state.selected.nestedContext = 'area-beta-child'
    var projectField = null
    for (i = 0; i < mode.fields.length; i++) {
      if (mode.fields[i] && mode.fields[i].id === 'project') {
        projectField = mode.fields[i]
        break
      }
    }
    var allowed = core.getAllowedValues(mode, state, projectField, localRules)
    var ids = allowed.map(function(v) { return String(v && v.id || '') })
    assertTrue(ids.indexOf('Project Beta Child') !== -1, 'project includes byContext leaf value from source catalog')
    assertEq(ids.indexOf('#example') !== -1, false, 'project does not use static field.values seed as active source catalog')
    assertEq(ids.indexOf('Stale Project') !== -1, false, 'project does not leak stale items when byContext source is available')
  })()

  ;(function testProjectValuesFollowDynamicFilterKeys() {
    var localRules = JSON.parse(JSON.stringify(rules))
    var i
    for (i = 0; i < localRules.leftMode.fields.length; i++) {
      var f = localRules.leftMode.fields[i]
      if (!f || f.id !== 'project') continue
      f.source = 'projects'
      f.values = [{ id: '', token: '', allowedParentValues: null }]
    }
    localRules.projects = {
      filterKeys: ['type', 'type_sub', 'project', 'category', 'category_sub'],
      byContext: {
        'area-alpha': {
          branch: ['Project Alpha'],
          leaf: {
            'area-alpha-child': ['Project Alpha Child'],
            'area-alpha-sibling': ['Project Alpha Sibling']
          }
        },
        'area-shared': {
          branch: ['Project Shared'],
          leaf: {
            'area-shared-child': ['Project Shared Child']
          }
        }
      },
      defaults: []
    }
    var mode = localRules.leftMode
    var state = core.makeInitialState(localRules, 'left')
    state.selected.type = 'todo'
    state.selected.category = 'area-alpha'
    state.selected.category_sub = 'area-alpha-child'
    var projectField = null
    for (i = 0; i < mode.fields.length; i++) {
      if (mode.fields[i] && mode.fields[i].id === 'project') {
        projectField = mode.fields[i]
        break
      }
    }
    var allowed = core.getAllowedValues(mode, state, projectField, localRules)
    var ids = allowed.map(function(v) { return String(v && v.id || '') })
    assertTrue(ids.indexOf('Project Alpha Child') !== -1, 'project includes leaf value by dynamic filter keys')
    assertEq(ids.indexOf('Project Alpha Sibling') !== -1, false, 'project keeps nested leaf scope when second filter key is selected')
    assertEq(ids.indexOf('Project Shared Child') !== -1, false, 'project excludes foreign branch leaf by dynamic filter keys')

    state.selected.category_sub = ''
    var allowedParentOnly = core.getAllowedValues(mode, state, projectField, localRules)
    var parentOnlyIds = allowedParentOnly.map(function(v) { return String(v && v.id || '') })
    assertTrue(parentOnlyIds.indexOf('Project Alpha Child') !== -1, 'project includes child leaf when only parent filter key is selected')
    assertTrue(parentOnlyIds.indexOf('Project Alpha Sibling') !== -1, 'project includes sibling leaves when nested filter key is empty')
  })()

  ;(function testRightPanelShowsDependentFieldWhenParentMovedRight() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.order = {
      left: ['importance', 'category', 'project'],
      right: ['type', 'type_sub', 'date_due', 'date_start', 'time'],
      active: {
        importance: 'yes', type: 'yes', type_sub: 'yes', category: 'yes', category_sub: 'yes', project: 'yes',
        date_due: 'yes', date_start: 'yes', time: 'yes'
      }
    }

    function setFieldMeta(mode, fieldId, orderKey, panel) {
      var i
      for (i = 0; i < mode.fields.length; i++) {
        var f = mode.fields[i]
        if (!f || f.id !== fieldId) continue
        f.orderKey = orderKey
        f.panel = panel
      }
    }

    setFieldMeta(localRules.leftMode, 'priority', 'importance', 'left')
    setFieldMeta(localRules.leftMode, 'type', 'type', 'right')
    setFieldMeta(localRules.leftMode, 'modal', 'type_sub', 'right')
    setFieldMeta(localRules.leftMode, 'context', 'category', 'left')
    setFieldMeta(localRules.leftMode, 'nestedContext', 'category_sub', 'left')
    setFieldMeta(localRules.leftMode, 'project', 'project', 'left')

    var s = core.makeInitialState(localRules, 'right')
    s.mode = 'right'
    s.selected.type = 'note'
    var seq = core.getNavigableFieldSequence(localRules, s)
    assertTrue(seq.indexOf('type') !== -1, 'right panel sequence includes parent type when moved right')
    assertTrue(seq.indexOf('modal') !== -1, 'right panel sequence includes dependent modal when parent selected')
  })()

  ;(function testUnifiedGroupBuilderContractForLeftAndRightPanels() {
    function makeRulesWithTypePanel(typePanel) {
      var localRules = JSON.parse(JSON.stringify(rules))
      if (!localRules.behavior) localRules.behavior = {}
      localRules.behavior.order = {
        left: typePanel === 'left' ? ['importance', 'type', 'type_sub', 'category', 'project'] : ['importance', 'category', 'project'],
        right: typePanel === 'right' ? ['type', 'type_sub', 'time', 'date_start', 'date_due'] : ['time', 'date_start', 'date_due'],
        active: {
          importance: 'yes', type: 'yes', type_sub: 'yes', category: 'yes', category_sub: 'yes', project: 'yes',
          date_due: 'yes', date_start: 'yes', time: 'yes'
        }
      }
      function setFieldMeta(mode, fieldId, orderKey, panel) {
        var i
        for (i = 0; i < mode.fields.length; i++) {
          var f = mode.fields[i]
          if (!f || f.id !== fieldId) continue
          f.orderKey = orderKey
          f.panel = panel
        }
      }
      setFieldMeta(localRules.leftMode, 'priority', 'importance', 'left')
      setFieldMeta(localRules.leftMode, 'type', 'type', typePanel)
      setFieldMeta(localRules.leftMode, 'modal', 'type_sub', typePanel)
      setFieldMeta(localRules.leftMode, 'context', 'category', 'left')
      setFieldMeta(localRules.leftMode, 'nestedContext', 'category_sub', 'left')
      setFieldMeta(localRules.leftMode, 'project', 'project', 'left')
      return localRules
    }

    var leftRules = makeRulesWithTypePanel('left')
    var leftState = core.makeInitialState(leftRules, 'left')
    leftState.mode = 'left'
    leftState.selected.type = 'note'
    var leftSeq = core.getNavigableFieldSequence(leftRules, leftState)
    assertTrue(leftSeq.indexOf('type') !== -1, 'left panel sequence includes parent type')
    assertTrue(leftSeq.indexOf('modal') !== -1, 'left panel sequence includes dependent modal')
    assertTrue(leftSeq.indexOf('type') < leftSeq.indexOf('modal'), 'left panel keeps parent before dependent child')

    var rightRules = makeRulesWithTypePanel('right')
    var rightState = core.makeInitialState(rightRules, 'right')
    rightState.mode = 'right'
    rightState.selected.type = 'note'
    var rightSeq = core.getNavigableFieldSequence(rightRules, rightState)
    assertTrue(rightSeq.indexOf('type') !== -1, 'right panel sequence includes parent type')
    assertTrue(rightSeq.indexOf('modal') !== -1, 'right panel sequence includes dependent modal')
    assertTrue(rightSeq.indexOf('type') < rightSeq.indexOf('modal'), 'right panel keeps parent before dependent child')
  })()

  ;(function testBuildTagsSupportsCustomTaxonomyOrderKeys() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.inlineLayout || typeof localRules.inlineLayout !== 'object') localRules.inlineLayout = {}
    localRules.inlineLayout.techOrder = ['importance', 'topic', 'otherTags']
    if (!localRules.behavior) localRules.behavior = {}
    if (!localRules.behavior.order) localRules.behavior.order = {}
    localRules.behavior.order.left = ['importance', 'topic', 'topic_sub', 'project']
    localRules.behavior.order.right = ['time', 'date_start', 'date_due']

    function setFieldMeta(mode, fieldId, orderKey, panel) {
      var i
      for (i = 0; i < mode.fields.length; i++) {
        var f = mode.fields[i]
        if (!f || f.id !== fieldId) continue
        f.orderKey = orderKey
        f.panel = panel
      }
    }

    setFieldMeta(localRules.leftMode, 'priority', 'importance', 'left')
    setFieldMeta(localRules.leftMode, 'type', 'topic', 'left')
    setFieldMeta(localRules.leftMode, 'modal', 'topic_sub', 'left')
    setFieldMeta(localRules.leftMode, 'project', 'project', 'left')

    var s = core.makeInitialState(localRules, 'left')
    s.selected.priority = '#/2'
    s.selected.type = 'note'
    s.selected.modal = 'note-child'

    var tags = core.buildTags(localRules.leftMode, s, localRules)
    assertTrue(tags.indexOf('#/2') !== -1, 'custom taxonomy keeps importance token')
    assertTrue(tags.indexOf('#note') !== -1, 'custom taxonomy resolves parent token via custom order key')
    assertTrue(tags.indexOf('#note-child') !== -1, 'custom taxonomy resolves child token via custom order key')

    var parsed = core.parseLine('- [ ] #note #note-child :: text', localRules)
    s.selected.type = 'idea'
    s.selected.modal = 'idea-child'
    var tagsAfterParentSwitch = core.buildTags(localRules.leftMode, s, localRules, parsed)
    assertTrue(tagsAfterParentSwitch.indexOf('#idea-child') !== -1, 'custom taxonomy keeps selected child after parent switch')
    assertTrue(tagsAfterParentSwitch.indexOf('#note-child') === -1, 'custom taxonomy removes stale unmanaged child token from previous parent')
  })()

  ;(function testBuildTagsSupportsCustomCombinedTaxonomyOrderKeys() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.inlineLayout || typeof localRules.inlineLayout !== 'object') localRules.inlineLayout = {}
    localRules.inlineLayout.techOrder = ['topic', 'otherTags']
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.subtagFormat = 'combined'
    if (!localRules.behavior.order) localRules.behavior.order = {}
    localRules.behavior.order.left = ['topic', 'topic_sub', 'project']
    localRules.behavior.order.right = ['time', 'date_start', 'date_due']

    function setFieldMeta(mode, fieldId, orderKey, panel) {
      var i
      for (i = 0; i < mode.fields.length; i++) {
        var f = mode.fields[i]
        if (!f || f.id !== fieldId) continue
        f.orderKey = orderKey
        f.panel = panel
      }
    }

    setFieldMeta(localRules.leftMode, 'type', 'topic', 'left')
    setFieldMeta(localRules.leftMode, 'modal', 'topic_sub', 'left')

    var s = core.makeInitialState(localRules, 'left')
    s.selected.type = 'note'
    s.selected.modal = 'note-child'

    var tags = core.buildTags(localRules.leftMode, s, localRules)
    assertTrue(tags.indexOf('#note/note-child') !== -1, 'custom combined taxonomy emits combined token')
    assertTrue(tags.indexOf('#note') === -1, 'custom combined taxonomy suppresses standalone parent token')
    assertTrue(tags.indexOf('#note-child') === -1, 'custom combined taxonomy suppresses standalone child token')
  })()

  ;(function testHydrateStateFromCustomCombinedToken() {
    var localRules = JSON.parse(JSON.stringify(rules))
    if (!localRules.inlineLayout || typeof localRules.inlineLayout !== 'object') localRules.inlineLayout = {}
    localRules.inlineLayout.techOrder = ['topic', 'otherTags']
    if (!localRules.behavior) localRules.behavior = {}
    localRules.behavior.subtagFormat = 'combined'
    if (!localRules.behavior.order) localRules.behavior.order = {}
    localRules.behavior.order.left = ['topic', 'topic_sub', 'project']
    localRules.behavior.order.right = ['time', 'date_start', 'date_due']

    function setFieldMeta(mode, fieldId, orderKey, panel) {
      var i
      for (i = 0; i < mode.fields.length; i++) {
        var f = mode.fields[i]
        if (!f || f.id !== fieldId) continue
        f.orderKey = orderKey
        f.panel = panel
      }
    }

    setFieldMeta(localRules.leftMode, 'type', 'topic', 'left')
    setFieldMeta(localRules.leftMode, 'modal', 'topic_sub', 'left')

    var parsed = core.parseLine('- [ ] #note/note-child :: Task combined custom', localRules)
    var s = core.makeInitialState(localRules, 'left')
    core.hydrateStateFromParsedLine(localRules, s, parsed)
    core.sanitizeState(localRules, s)
    assertEq(s.selected.type, 'note', 'custom combined hydrate restores parent selection')
    assertEq(s.selected.modal, 'note-child', 'custom combined hydrate restores child selection')
  })()

  ;(function testBuildTagsOutputsWikilinkForWikilinkSourceFields() {
    var localRules = JSON.parse(JSON.stringify(rules))
    var i
    for (i = 0; i < localRules.leftMode.fields.length; i++) {
      var f = localRules.leftMode.fields[i]
      if (!f || f.id !== 'project') continue
      f.source = 'wikilinks:clients'
      f.outputMode = 'wikilink'
      f.values = [
        { id: '', token: '' },
        { id: 'EntityAlpha', token: 'EntityAlpha', link: 'EntityAlpha' }
      ]
    }
    var s = core.makeInitialState(localRules, 'left')
    s.selected.project = 'EntityAlpha'
    var tags = core.buildTags(localRules.leftMode, s, localRules)
    assertTrue(tags.indexOf('[[EntityAlpha]]') !== -1, 'wikilink source field emits wikilink token')
    assertTrue(tags.indexOf('#EntityAlpha') === -1, 'wikilink source field does not fallback to tag token')
  })()

  ;(function testProjectSelectionReplacesOldProjectToken() {
    var localRules = JSON.parse(JSON.stringify(rules))
    var i
    for (i = 0; i < localRules.leftMode.fields.length; i++) {
      var f = localRules.leftMode.fields[i]
      if (!f || f.id !== 'project') continue
      f.source = 'projects'
      f.values = [{ id: '', token: '', allowedParentValues: null }]
    }
    localRules.projects = {
      filterKeys: ['category', 'category_sub'],
      byContext: {
        'area-alpha': {
          branch: [],
          leaf: {
            'area-alpha-child': ['Project Alpha Child', 'Project Alpha Alternate']
          }
        }
      },
      defaults: []
    }
    var s = core.makeInitialState(localRules, 'left')
    s.selected.category = 'area-alpha'
    s.selected.category_sub = 'area-alpha-child'
    s.selected.project = 'Project Alpha Alternate'
    var parsedLine = { tags: ['[[Project Alpha Child]]', '#area-alpha', '#area-alpha-child'] }
    var tags = core.buildTags(localRules.leftMode, s, localRules, parsedLine)
    assertTrue(tags.indexOf('[[Project Alpha Alternate]]') !== -1, 'new project wikilink is rendered')
    assertEq(tags.indexOf('[[Project Alpha Child]]') !== -1, false, 'previous project wikilink is removed from managed token set')
  })()

  ;(function testUnifiedOffHeadingPrefixImmutabilityContract() {
    assertTrue(finalize && typeof finalize.applyModePrefixImmutability === 'function', 'shared finalizer exposes applyModePrefixImmutability')
    var out = finalize.applyModePrefixImmutability('## 111', '- #/1 || 111', { preserveOff: true })
    assertEq(out, '## #/1 || 111', 'shared off-mode heading prefix immutability keeps heading prefix')
  })()

  ;(function testUnifiedSeparatorTopologyNoDuplicateTail() {
    assertTrue(finalize && typeof finalize.normalizeSeparatorTopology === 'function', 'shared finalizer exposes normalizeSeparatorTopology')
    var out = finalize.normalizeSeparatorTopology('- [ ] #todo :: :: ', { io: { separator1: '::', separator2: '::' } })
    assertEq(out, '- [ ] #todo :: ', 'shared separator topology collapses duplicated trailing separator')
  })()
}

/* Круговой обход конфиг-заметки (был `runConfigRoundTripSuite`) снят
   2026-09-03 вместе с заметкой: кодека и разборщика в плагине больше нет
   (PRD 10.12, решение В-28). */

function runSharedOrderAlignmentSuite() {
  var path = require('path')
  var shared = require(path.join(__dirname, '..', '..', 'src', 'core', 'pkm_rules_runtime_helpers.js'))

  function isObj(x) {
    return !!x && typeof x === 'object' && !Array.isArray(x)
  }

  /* Это объект ПРАВИЛ, а не конфиг: форма документа правил TagWheel вместе с
     конфигом не менялась (см. `rules_markdown_builder.js`). */
  var rules = {
    behavior: {
      order: {
        left: ['importance', 'type', 'clients', 'category', 'category_sub', 'project'],
        right: ['date_due', 'clients', 'effort1', 'child_orphan'],
        active: { importance: 'yes', type: 'yes', clients: 'yes', category: 'yes', category_sub: 'yes', project: 'yes', date_due: 'yes', effort1: 'yes', child_orphan: 'yes' },
        enabled: { importance: true, type: true, clients: true, category: true, category_sub: true, project: true, date_due: true, effort1: true, child_orphan: true },
        labels: {},
        strictNames: {},
        types: { importance: 'tag', type: 'tag', clients: 'tag', category: 'tag', category_sub: 'tag', project: 'tag', date_due: 'element', effort1: 'element', child_orphan: 'tag' }
      },
    },
    inlineLayout: { techOrder: ['otherTags'] },
    leftMode: {
      fields: [
        { id: 'importance', orderKey: 'importance', prefix: '#', values: [{ id: '', token: '' }, { id: 'p1', token: '#/1' }] },
        { id: 'type', orderKey: 'type', prefix: '#', values: [{ id: '', token: '' }, { id: 'todo', token: 'todo' }] },
        { id: 'clients', orderKey: 'clients', source: 'wikilinks:clients', dependsOn: 'category_sub', values: [{ id: '', token: '' }] },
        { id: 'category', orderKey: 'category', prefix: '#', values: [{ id: '', token: '' }, { id: 'alpha', token: 'area-alpha' }] },
        { id: 'category_sub', orderKey: 'category_sub', dependsOn: 'category', prefix: '#', values: [{ id: '', token: '' }, { id: 'alpha-child', token: 'area-alpha-child', allowedParentValues: ['alpha'] }] },
        { id: 'project', orderKey: 'project', source: 'projects', values: [{ id: '', token: '' }] }
      ]
    },
    rightMode: {
      fields: [
        { id: 'due', orderKey: 'date_due', kind: 'dateOffset', marker: '📅', values: [{ id: '', token: '' }] },
        { id: 'effort1', orderKey: 'effort1', kind: 'genericElement', marker: '⛏️', values: [{ id: '', token: '' }] },
        { id: 'child_orphan', orderKey: 'child_orphan', dependsOn: 'missing_parent', prefix: '#', values: [{ id: '', token: '' }, { id: 'v1', token: 'orphan-child' }] }
      ]
    },
    projects: {
      byContext: {
        'area-alpha': {
          leaf: {
            'area-alpha-child': ['Project Alpha Child']
          }
        }
      },
      defaults: [],
      items: [],
      rules: [],
      catalog: []
    },
    'wikilinks:clients': {
      defaults: ['[[EntityAlpha]]', '[[Entity-Alpha]]']
    }
  }

  var orderCfg = shared.parseOrderConfig(rules.behavior.order)
  shared.applyOrderToRules(rules, orderCfg, { isObj: isObj })
  var orphanChild = (rules.rightMode.fields || []).filter(function (f) { return f && f.id === 'child_orphan' })[0] || null
  assertTrue(!!orphanChild, 'shared order alignment keeps orphan child field in model on right panel')
  assertEq(String(orphanChild.enabled), 'false', 'shared order alignment excludes orphan child from runtime when parent is missing in same panel')
  assertEq(String(orphanChild.dependsOn || ''), '', 'shared order alignment clears broken dependsOn link for runtime safety')

  var toggledRules = JSON.parse(JSON.stringify(rules))
  if (!toggledRules.behavior) toggledRules.behavior = {}
  if (!toggledRules.behavior.order) toggledRules.behavior.order = {}
  if (!toggledRules.behavior.order.active) toggledRules.behavior.order.active = {}
  toggledRules.behavior.order.active.category_sub = 'no'
  var toggledCfg = shared.parseOrderConfig(toggledRules.behavior.order)
  shared.applyOrderToRules(toggledRules, toggledCfg, { isObj: isObj })
  var leftSub = (toggledRules.leftMode.fields || []).filter(function (f) { return f && f.id === 'category_sub' })[0] || null
  assertTrue(!!leftSub, 'sub field stays in model when subtags are turned off')
  assertEq(String(leftSub.enabled), 'false', 'sub field is disabled for runtime when subtags are off')

  var techOrder = Array.isArray(rules.inlineLayout && rules.inlineLayout.techOrder) ? rules.inlineLayout.techOrder : []
  assertTrue(techOrder.indexOf('project') !== -1, 'shared order alignment keeps project slot in techOrder')
  assertTrue(techOrder.indexOf('otherTags') !== -1, 'shared order alignment keeps otherTags slot for unknown tags')
  assertTrue(techOrder.indexOf('project') < techOrder.indexOf('otherTags'), 'project follows explicit order before otherTags catch-all slot')

  var tokenToKey = shared.buildTagTokenKeyMap(rules, shared.getDefaultTagTokenKeyMapOptions())
  assertEq(tokenToKey['#/1'], 'importance', 'shared token map preserves prefixed priority token without duplicate prefix injection')
  assertEq(tokenToKey['[[Project Alpha Child]]'], 'project', 'shared token map resolves source-catalog wikilink to project order key without field seed constants')
  assertEq(tokenToKey['[[EntityAlpha]]'], 'clients', 'shared token map keeps first entity identity in wikilink-source field')
  assertEq(tokenToKey['[[Entity-Alpha]]'], 'clients', 'shared token map keeps distinct entity identity in wikilink-source field')

  var markers = shared.getDateMarkersFromRules(rules)
  var statusOpts = shared.getStatusMixedReorderOptions(markers)
  var tagwheelOpts = shared.getTagWheelMixedReorderOptions(markers)
  var inputSeg = '[[Project Alpha Child]] #area-alpha #area-alpha-child'
  var statusSeg = shared.reorderSegmentTokensByOrder(inputSeg, orderCfg, 'left', tokenToKey, statusOpts)
  var tagwheelSeg = shared.reorderSegmentTokensByOrder(inputSeg, orderCfg, 'left', tokenToKey, tagwheelOpts)
  assertEq(statusSeg, '#area-alpha #area-alpha-child [[Project Alpha Child]]', 'status mixed reorder follows explicit left order for source-derived project token')
  assertEq(tagwheelSeg, statusSeg, 'tagwheel mixed reorder is identical to status mixed reorder for same order config')

  var inputRightSeg = '[[Entity-Alpha]] ⛏️001 📅2026-04-27'
  var statusRightSeg = shared.reorderSegmentTokensByOrder(inputRightSeg, orderCfg, 'right', tokenToKey, statusOpts)
  var tagwheelRightSeg = shared.reorderSegmentTokensByOrder(inputRightSeg, orderCfg, 'right', tokenToKey, tagwheelOpts)
  assertEq(statusRightSeg, '📅2026-04-27 [[Entity-Alpha]] ⛏️001', 'status mixed reorder follows explicit right order for due->clients->effort1')
  assertEq(tagwheelRightSeg, statusRightSeg, 'tagwheel mixed reorder matches status mixed reorder for right-panel order path')

  var lookalikeSeg = shared.reorderSegmentTokensByOrder('[[EntityAlpha]] [[Entity-Alpha]]', orderCfg, 'left', tokenToKey, statusOpts)
  assertTrue(/\[\[EntityAlpha\]\]/.test(lookalikeSeg), 'mixed reorder keeps first entity token without normalization drift')
  assertTrue(/\[\[Entity-Alpha\]\]/.test(lookalikeSeg), 'mixed reorder keeps distinct entity token without normalization drift')
}

/**
 * И-4: Field типа link встаёт на своё место в Order.
 *
 * Форма правил взята с конфига заказчика, и в ней всё дело. Field `Project` —
 * ссылка, поэтому `rules_markdown_builder` кладёт его в корзину `rightMode`
 * (это корзина `pkm.fields.links`, а вовсе не «правая панель»), а сторону
 * решает Order, и там ссылка стоит **второй слева**.
 *
 * До правки `buildTagTokenKeyMap` читал только `leftMode`: токен `[[test1]]`
 * оставался для перестановки незнакомым, а незнакомые дописываются после всех
 * упорядоченных — ссылка уезжала в конец блока при любом Order.
 *
 * Ожидание выписано строкой отдельно от данных, из которых строится результат
 * (У-5), и при расхождении печатается то, что получилось (У-8).
 */
function runLinkFieldOrderSuite() {
  var path = require('path')
  var shared = require(path.join(__dirname, '..', '..', 'src', 'core', 'pkm_rules_runtime_helpers.js'))

  /* Это объект ПРАВИЛ, а не конфиг. */
  var rules = {
    behavior: {
      order: {
        left: ['Importance', 'Project', 'type'],
        right: ['date_due'],
        active: { Importance: 'yes', Project: 'yes', type: 'yes', date_due: 'yes' },
        enabled: { Importance: true, Project: true, type: true, date_due: true },
        types: { Importance: 'tag', Project: 'wikilink', type: 'tag', date_due: 'element' }
      }
    },
    io: { separator1: '||', separator2: '||' },
    leftMode: {
      fields: [
        { id: 'Importance', prefix: '#', values: [
          { token: '#/1', active: true },
          { token: '#/2', active: true }
        ] },
        { id: 'type', prefix: '#', values: [
          { token: '#todo', active: true },
          { token: '#note', active: true }
        ] }
      ]
    },
    rightMode: {
      fields: [
        { id: 'date_due', kind: 'genericElement', marker: '📅', values: [''] },
        { id: 'Project', prefix: '#', source: 'wikilinks:Project', values: [
          { token: 'test1', active: true },
          { token: 'todo', active: true }
        ] }
      ]
    }
  }

  var orderCfg = shared.parseOrderConfig(rules.behavior.order)
  var tokenToKey = shared.buildTagTokenKeyMap(rules, shared.getDefaultTagTokenKeyMapOptions())

  assertEq(tokenToKey['[[test1]]'], 'Project', 'карта токенов знает ссылку из корзины links')
  assertEq(tokenToKey['#/1'], 'Importance', 'карта токенов по корзине тегов не изменилась')
  /* Значение `todo` у ссылки даёт тег-форму `#todo`, уже занятую Field type.
     Правая корзина не перетирает занятое: иначе починка порядка ссылок сломала
     бы порядок тегов, и молча. */
  assertEq(tokenToKey['#todo'], 'type', 'токен, поделённый тегом и ссылкой, остаётся за тегом')

  var markers = shared.getDateMarkersFromRules(rules)
  var input = '#/1 #todo [[test1]]'
  var want = '#/1 [[test1]] #todo'

  var wheelGot = shared.reorderSegmentTokensByOrder(
    input, orderCfg, 'left', tokenToKey, shared.getTagWheelMixedReorderOptions(markers))
  if (wheelGot !== want) console.log('  TagWheel слева: ' + wheelGot)
  assertEq(wheelGot, want, 'ссылка встаёт на своё место в Order, а не в конец блока')

  var statusGot = shared.reorderSegmentTokensByOrder(
    input, orderCfg, 'left', tokenToKey, shared.getStatusMixedReorderOptions(markers))
  if (statusGot !== want) console.log('  хоткеи слева: ' + statusGot)
  assertEq(statusGot, want, 'хоткеи переставляют ссылку так же, как TagWheel')

  /* Ссылка, которой в Order нет вовсе, по-прежнему уходит в конец: правка
     добавляет знание о ссылках, а не меняет судьбу незнакомых токенов. */
  var unknownGot = shared.reorderSegmentTokensByOrder(
    '#/1 [[nobody]] #todo', orderCfg, 'left', tokenToKey, shared.getTagWheelMixedReorderOptions(markers))
  assertEq(unknownGot, '#/1 #todo [[nobody]]', 'незнакомая ссылка остаётся в конце блока')
}

/**
 * Т-14: эмодзи-элемент из двух слов не разрывается вставкой других Fields.
 *
 * Заказчик прислал (свободное замечание, 2026-09-02):
 *
 *   исходная строка   `- || 📅2026-09-02 20:43`
 *   результат         `- || 📅2026-09-02 #work #AK 20:44`
 *
 * Причина была в разборе: `split(/\s+/)` делил элемент на `📅2026-09-02` и
 * `20:43`. Первая половина узнавалась по метке и вставала на своё место в
 * Order, вторая не узнавалась никем и уходила в корзину неизвестных, а
 * корзина печатается последней — новые теги оказывались между половинами.
 *
 * Двенадцатое исключение к З3, разрешение заказчика 2026-09-02.
 *
 * Здесь же сторожится второе объявление правила хвоста (У-32): та же функция
 * живёт в `main.js` для отрисовки, свести их в один модуль нечем — `main.js`
 * грузит этот файл мостом vault, а не через `require`.
 */
function runElementTokenSuite() {
  var path = require('path')
  var fs = require('fs')
  var shared = require(path.join(__dirname, '..', '..', 'src', 'core', 'pkm_rules_runtime_helpers.js'))

  var rules = {
    behavior: {
      order: {
        left: ['Importance', 'type'],
        right: ['date_due', 'Category'],
        active: { Importance: 'yes', type: 'yes', date_due: 'yes', Category: 'yes' },
        enabled: { Importance: true, type: true, date_due: true, Category: true },
        types: { Importance: 'tag', type: 'tag', date_due: 'element', Category: 'tag' }
      },
      elements: { byField: { date_due: { emoji: '📅', format: 'YYYY-MM-DD hh:mm' } } }
    },
    io: { separator1: '||', separator2: '||' },
    leftMode: {
      fields: [
        { id: 'Importance', prefix: '#', orderKey: 'Importance', values: [{ token: '#/1', active: true }] },
        { id: 'type', prefix: '#', orderKey: 'type', values: [{ token: '#todo', active: true }] },
        { id: 'Category', prefix: '#', orderKey: 'Category', values: [
          { token: '#work', active: true },
          { token: '#AK', active: true }
        ] }
      ]
    },
    rightMode: {
      fields: [
        { id: 'date_due', kind: 'genericElement', marker: '📅', orderKey: 'date_due', values: [''] }
      ]
    }
  }

  var markers = shared.getDateMarkersFromRules(rules)
  assertEq(markers.tailByMarker['📅'], '\\d{4}-\\d{2}-\\d{2}[ ]\\d{2}:\\d{2}',
    'хвост метки выведен из формата поля')

  var orderCfg = shared.parseOrderConfig(rules.behavior.order)
  var tokenToKey = shared.buildTagTokenKeyMap(rules, shared.getDefaultTagTokenKeyMapOptions())
  var opts = shared.getTagWheelMixedReorderOptions(markers)

  /* Разбор: элемент со временем — ОДИН токен. */
  assertArrayEq(shared.tokenizeSegmentBody('📅2026-09-02 20:43 #work', markers),
    ['📅2026-09-02 20:43', '#work'],
    'элемент из двух слов разбирается одним токеном')

  /* И перестановка его больше не разрывает — случай заказчика. */
  assertEq(
    shared.reorderSegmentTokensByOrder('📅2026-09-02 20:43 #work #AK', orderCfg, 'right', tokenToKey, opts),
    '📅2026-09-02 20:43 #work #AK',
    'вставленные теги встают ПОСЛЕ элемента, а не внутрь него')

  /* Обратная сторона: элемент в одно слово работает как раньше. */
  var oneWord = JSON.parse(JSON.stringify(rules))
  oneWord.behavior.elements.byField.date_due.format = 'YYYY-MM-DD'
  var m1 = shared.getDateMarkersFromRules(oneWord)
  assertArrayEq(shared.tokenizeSegmentBody('📅2026-09-02 #work', m1),
    ['📅2026-09-02', '#work'],
    'элемент в одно слово остаётся одним токеном и без хвоста с пробелом')

  /* И порядок по Order при этом соблюдается: элемент впереди своего тега. */
  assertEq(
    shared.reorderSegmentTokensByOrder('#work 📅2026-09-02 20:43 #AK', orderCfg, 'right', tokenToKey, opts),
    '📅2026-09-02 20:43 #work #AK',
    'элемент встаёт на своё место в Order, а не в конец')

  /*
   * Второе объявление правила хвоста не разошлось с первым. Сверяются обе
   * функции на наборе форматов; `main.js` читается как текст и исполняется
   * своим же загрузчиком — тем же, которым его берут остальные проверки.
   */
  var mainSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')
  var at = mainSrc.indexOf('function elementTailPatternFromFormat(format) {')
  if (at < 0) throw new Error('в main.js нет elementTailPatternFromFormat: правило переехало, сверить нечем')
  var end = mainSrc.indexOf('\n}\n', at)
  var body = mainSrc.slice(at, end + 3)
  /* `escapeRegExp` в `main.js` называется иначе, чем здесь; для сверки хватает
     той же семантики. */
  var fromMain = new Function('escapeRegExp', body + '\nreturn elementTailPatternFromFormat;')(
    function (t) { return String(t || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') })

  var formats = ['YYYY-MM-DD hh:mm', 'YYYY-MM-DD', 'hh:mm', 'DD.MM.YYYY', 'YYYY/MM/DD hh:mm:ss', '', 'YY']
  for (var fi = 0; fi < formats.length; fi++) {
    var f = formats[fi]
    assertEq(shared.elementTailPatternFromFormat(f), fromMain(f),
      'правило хвоста совпадает с тем, что в main.js, для формата "' + f + '"')
  }
  console.log('  ok Т-14: элемент из двух слов не разрывается, правило хвоста одно')
}

/**
 * Правая часть строки переживает TagWheel (замечание заказчика 2026-09-07).
 *
 * **Что было.** Строка `- 11 :: 📅2026-09-07 11:34`, выбрать значение в левом
 * Block — и получалось `- [ ] #todo :: 11`. Правой части не оставалось.
 * Команда `Field next` на той же строке её сохраняла: два хода отвечали на один
 * вопрос по-разному.
 *
 * **Две причины, и обе здесь.**
 *
 *   1. Граф токенов резал строку по пробелу и видел `📅2026-09-07` — без
 *      времени. Отбор значения верит графу, и в сессию приезжала половина.
 *   2. Значение элемента хранится смещением от «сегодня». Смещение ищется
 *      перебором **вперёд**, поэтому запись со временем в прошлом не выражается
 *      им никогда — и в сессию не попадало ничего.
 *
 * **Спрашивается то, что видит человек:** правая часть, собранная заново из
 * сессии, равна той, что была на строке. Ожидание выписано отдельно от того,
 * из чего строится результат (У-5).
 *
 * Оба пути отбора гоняются по очереди: с поднятой прослойкой строки и без неё.
 * Ветки разные, и до правки половину из них не проходил никто.
 */
function runRightPayloadSurvivesSuite() {
  var path = require('path')
  var core = require(path.join(__dirname, '..', '..', 'pkm_v2', 'TagWheel', 'tagwheel_core.js'))
  var tokenGraph = require(path.join(__dirname, '..', '..', 'src', 'core', 'token_graph_unified.js'))
  var linePipeline = require(path.join(__dirname, '..', '..', 'src', 'core', 'line_pipeline.js'))

  function rulesWithFormat(format) {
    return {
      behavior: {
        order: {
          left: ['type'],
          right: ['date_due'],
          active: { type: 'yes', date_due: 'yes' },
          enabled: { type: true, date_due: true },
          types: { type: 'tag', date_due: 'element' }
        },
        elements: { byField: { date_due: { emoji: '📅', format: format } } },
        dateRuntimeConfig: {
          byField: { date_due: { emoji: '📅', format: format, increment: { mode: 'standard', incrementBy: 1 } } },
          canonical: {}
        },
        prefixRules: {}
      },
      io: { separator1: '::', separator2: '::' },
      leftMode: {
        fields: [
          { id: 'type', prefix: '#', orderKey: 'type', values: [{ id: 'todo', token: '#todo', active: true }] }
        ]
      },
      rightMode: {
        fields: [
          { id: 'date_due', kind: 'genericElement', marker: '📅', orderKey: 'date_due', values: [{ id: '', token: '' }] }
        ]
      }
    }
  }

  /* Граф токенов: элемент со временем — один токен, а не два. */
  var facts = tokenGraph.buildTokenFactsFromLine(':: 📅2026-09-07 11:34', rulesWithFormat('YYYY-MM-DD hh:mm'))
  assertEq(facts.length, 1, 'граф видит один токен, а не половину даты и обрывок времени')
  assertEq(facts[0].raw, '📅2026-09-07 11:34', 'токен графа — значение целиком')

  /* Положительный контроль: у формата без пробела ответ прежний. */
  var factsShort = tokenGraph.buildTokenFactsFromLine(':: 📅2026-09-07', rulesWithFormat('YYYY-MM-DD'))
  assertEq(factsShort.length, 1, 'формат без пробела: по-прежнему один токен')
  assertEq(factsShort[0].raw, '📅2026-09-07', 'и значение то же')

  /* И два разных токена по-прежнему два: иначе проверка была бы зелёной от
     того, что всё склеилось в один. */
  var factsTwo = tokenGraph.buildTokenFactsFromLine(':: 📅2026-09-07 11:34 #work', rulesWithFormat('YYYY-MM-DD hh:mm'))
  assertEq(factsTwo.length, 2, 'элемент и тег за ним — два токена')
  assertEq(factsTwo[1].raw, '#work', 'тег после элемента остался собой')

  /* Круг: что стояло на строке, то и собирается обратно. */
  function roundTrip(rules, line) {
    var parsed = core.parseLine(line, rules)
    var state = core.makeInitialState(rules, 'left')
    state.mode = 'left'
    state.__nowHHmm = '12:00'
    state.__todayIso = '2026-09-07'
    core.hydrateStateFromParsedLine(rules, state, parsed)
    core.sanitizeState(rules, state)
    return core.buildRightDates(rules, state).join(' ')
  }

  var withPipeline = globalThis.__inlineLinePipeline
  var pass
  for (pass = 0; pass < 2; pass++) {
    var how = pass === 0 ? 'через прослойку строки' : 'без прослойки строки'
    globalThis.__inlineLinePipeline = pass === 0 ? linePipeline : undefined

    /* Время в прошлом относительно «сейчас»: смещением не выражается никогда. */
    assertEq(roundTrip(rulesWithFormat('YYYY-MM-DD hh:mm'), '- 11 :: 📅2000-01-02 03:04'),
      '📅2000-01-02 03:04',
      'запись, которую смещением не выразить, возвращается собой (' + how + ')')

    /* Положительный контроль: то, что смещением выражается, тоже цело. */
    assertEq(roundTrip(rulesWithFormat('YYYY-MM-DD'), '- 11 :: 📅2026-09-07'),
      '📅2026-09-07',
      'сегодняшняя дата возвращается той же (' + how + ')')

    /* И пустая правая часть остаётся пустой: не «возвращается» ниоткуда. */
    assertEq(roundTrip(rulesWithFormat('YYYY-MM-DD hh:mm'), '- 11'), '',
      'правой части не было — и не появилось (' + how + ')')
  }
  globalThis.__inlineLinePipeline = withPipeline

  console.log('  ok правая часть строки переживает сборку заново, обоими путями отбора')
}

/**
 * И-2.1 / PRD 10.13.6: подсветка строки, пока открыт TagWheel.
 *
 * Обёртку в `==` движок ставил всегда — при `rules.ui.activePanel.useHighlight`,
 * — но записать это значение было некому: ветки `pkm.behavior.ui` нет в
 * умолчаниях, и блок `tagwheel-ui` уезжал в заметку правил пустым. Заказчик
 * решил 2026-09-01 вернуть подсветку тумблером (В-15).
 *
 * Здесь закреплены обе половины: строитель документа правил кладёт значение,
 * а движок по нему рисует. Между ними стоит ловушка — `showMarkers` внутри
 * `activePanel` это не тумблер `Show tag markers`, а обёртки `{TW}` вокруг
 * строки, — и она закреплена отдельно.
 */
function runPanelHighlightSuite(core) {
  var path = require('path')
  var builderMod = require(path.join(__dirname, '..', '..', 'src', 'features', 'rules_markdown_builder.js'))
  var builder = builderMod.createRulesMarkdownBuilder({})

  var offUi = builder.buildRulesShapeFromConfig({ visual: { tagWheel: {} } }).ui
  var onUi = builder.buildRulesShapeFromConfig({ visual: { tagWheel: { highlightLine: true } } }).ui
  assertEq(offUi.activePanel.useHighlight, false, 'выключенная настройка не включает подсветку')
  assertEq(onUi.activePanel.useHighlight, true, 'включённая настройка доезжает до документа правил')
  assertEq(onUi.activePanel.enabled, true, 'блок панели включён, иначе движок не смотрит на него вовсе')

  var markersUi = builder.buildRulesShapeFromConfig({
    visual: { tagWheel: { showMarkers: true, highlightLine: true } }
  }).ui
  assertEq(markersUi.activePanel.showMarkers, undefined,
    'тумблер Show tag markers не превращается в текстовые обёртки вокруг строки')

  /* Правила минимальные: нужен один Field с одним значением и разделители. */
  var rules = {
    io: { separator1: '||', separator2: '||' },
    behavior: { order: { left: ['type'], right: [], active: { type: 'yes' }, enabled: { type: true } } },
    leftMode: { fields: [{ id: 'type', prefix: '#', placeholder: 'type', values: [
      { id: '', token: '' },
      { id: '#todo', token: '#todo', active: true }
    ] }] },
    rightMode: { fields: [] }
  }
  var state = core.makeInitialState(rules, 'left')
  state.selected = { type: '#todo' }
  var parsed = { indent: '', text: '111', tags: [], dates: '' }

  var plain = core.renderControlLine(rules, state, parsed)
  assertTrue(plain.indexOf('==') === -1, 'без настройки строка панели ничем не обёрнута')

  rules.ui = onUi
  var painted = core.renderControlLine(rules, state, parsed)
  if (painted.indexOf('==') === -1) console.log('  строка панели: ' + painted)
  assertTrue(/^==.*==\s*\|\|\s*111$/.test(painted), 'с настройкой панель обёрнута в == и текст остаётся за разделителем')

  rules.ui = offUi
  assertEq(core.renderControlLine(rules, state, parsed), plain,
    'выключенная настройка возвращает ту же строку, что и отсутствие ветки')
}

function runLeadFieldPolicySuite(core) {
  /* Это объект ПРАВИЛ, а не конфиг: форма документа правил TagWheel вместе с
     конфигом не менялась (см. `rules_markdown_builder.js`). */
  var rules = {
    behavior: {
      order: {
        left: ['importance', 'category', 'project'],
        right: ['date_due', 'time'],
        lead: { left: 'project', right: 'time' },
        active: { importance: 'yes', category: 'yes', project: 'yes', date_due: 'yes', time: 'yes' },
        enabled: { importance: true, category: true, project: true, date_due: true, time: true }
      },
    },
    leftMode: {
      fields: [
        { id: 'importance', orderKey: 'importance', values: [{ token: '' }, { token: '/1' }] },
        { id: 'category', orderKey: 'category', values: [{ token: '' }, { token: 'life' }] },
        { id: 'project', orderKey: 'project', source: 'projects', values: [{ token: '' }] }
      ]
    },
    rightMode: {
      fields: [
        { id: 'due', orderKey: 'date_due', kind: 'dateOffset', marker: '📅', values: [{ token: '' }] },
        { id: 'timeNow', orderKey: 'time', kind: 'nowTime', marker: '🕒', values: [{ token: '' }] }
      ]
    }
  }
  var state = { selected: {}, cycleByField: {} }

  var leftLeadIdx = core.resolveInitialActiveField(rules, state, 'left')
  assertEq(rules.leftMode.fields[leftLeadIdx].id, 'project', 'lead policy picks configured left lead field by order key')

  var rightLeadIdx = core.resolveInitialActiveField(rules, state, 'right')
  assertEq(rules.rightMode.fields[rightLeadIdx].id, 'timeNow', 'lead policy picks configured right lead field by order key')

  rules.behavior.order.lead.left = ''
  var leftDefaultIdx = core.resolveInitialActiveField(rules, state, 'left')
  assertEq(rules.leftMode.fields[leftDefaultIdx].id, 'importance', 'empty lead keeps existing first-enabled fallback behavior')

  rules.behavior.order.lead.left = 'missing_key'
  var leftInvalidIdx = core.resolveInitialActiveField(rules, state, 'left')
  assertEq(rules.leftMode.fields[leftInvalidIdx].id, 'importance', 'invalid lead key falls back to existing first-enabled behavior')

  rules.behavior.order.lead.right = 'time'
  rules.behavior.order.active.time = 'hotkey_only'
  var rightHotkeyOnlyIdx = core.resolveInitialActiveField(rules, state, 'right')
  assertEq(rules.rightMode.fields[rightHotkeyOnlyIdx].id, 'due', 'hotkey_only lead field falls back to first enabled field in TagWheel')
}

/*
 * Короткое имя Field (`Name in TagWheel`, оно же `labels`) достаётся и
 * дочернему Field: своего у него нет, и заказчик не захотел заводить второе
 * поле именования — дочка берёт имя родителя и добавляет `_sub`. До правки
 * 2026-09-04 она показывалась как `sub` при родителе `Imp`.
 *
 * Конфиг здесь **прогоняется через `parseOrderConfig`**, как его прогоняет
 * TagWheel, а не отдаётся `applyOrderToRules` руками (У-38). Первая версия
 * этой проверки отдавала руками и была зелёной, а на конфиге заказчика правка
 * не работала: `parseOrderConfig` досыпает в `labels` сам ключ для каждого
 * встреченного Field, и ветка вывода имени дочки была недостижима — заказчик
 * видел `Category_sub` вместо `Cat_sub` (D12).
 */
/**
 * Край Block: что делает стрелка, когда следующего Field на этой стороне нет
 * (10.13.35, заказ заказчика 2026-09-05).
 *
 * Проверяется решение, а не запись: `planFieldStep` — чистая функция, и ей не
 * нужна ни открытая панель, ни Obsidian. Заказчик описал четыре границы, и
 * все четыре проверяются поимённо: обещание «зеркально» — самое лёгкое место,
 * где правка сходится в одну сторону и расходится в другую.
 */
function runEdgeModeSuite() {
  var path = require('path')
  var tagwheel = require(path.join(__dirname, '..', '..', 'pkm_v2', 'TagWheel', 'tagwheel.js'))
  var plan = tagwheel.planFieldStep
  var left = ['importance', 'type']
  var right = ['project', 'due']

  /* Прежнее поведение — умолчание, и оно обязано остаться прежним. */
  var stayRight = plan({ ids: left, otherIds: right, activeFieldId: 'type', mode: 'left', dir: 1, edgeMode: 'stay' })
  assertEq(stayRight.mode, 'left', 'stay: сторона меняться не должна')
  assertEq(stayRight.activeFieldId, 'importance', 'stay: с последнего вправо — на первый своей стороны')
  assertEq(stayRight.crossed, false, 'stay: перехода не было')

  var stayLeft = plan({ ids: left, otherIds: right, activeFieldId: 'importance', mode: 'left', dir: -1, edgeMode: 'stay' })
  assertEq(stayLeft.activeFieldId, 'type', 'stay: с первого влево — на последний своей стороны')

  /* Отсутствие настройки читается как прежнее поведение, а не как ошибка. */
  var noMode = plan({ ids: left, otherIds: right, activeFieldId: 'type', mode: 'left', dir: 1 })
  assertEq(noMode.mode, 'left', 'без настройки поведение обязано остаться прежним')

  /* Четыре границы заказчика, слово в слово из его записи. */
  var l2r = plan({ ids: left, otherIds: right, activeFieldId: 'type', mode: 'left', dir: 1, edgeMode: 'next-block' })
  assertEq(l2r.mode, 'right', 'с крайнего правого левой панели вправо — в правую')
  assertEq(l2r.activeFieldId, 'project', '…и на крайний левый её Field')
  assertEq(l2r.crossed, true, 'переход обязан быть назван переходом')

  var l2rBack = plan({ ids: left, otherIds: right, activeFieldId: 'importance', mode: 'left', dir: -1, edgeMode: 'next-block' })
  assertEq(l2rBack.mode, 'right', 'с крайнего левого левой панели влево — в правую')
  assertEq(l2rBack.activeFieldId, 'due', '…и на крайний правый её Field')

  var r2l = plan({ ids: right, otherIds: left, activeFieldId: 'due', mode: 'right', dir: 1, edgeMode: 'next-block' })
  assertEq(r2l.mode, 'left', 'зеркально: с крайнего правого правой панели вправо — в левую')
  assertEq(r2l.activeFieldId, 'importance', '…и на крайний левый её Field')

  var r2lBack = plan({ ids: right, otherIds: left, activeFieldId: 'project', mode: 'right', dir: -1, edgeMode: 'next-block' })
  assertEq(r2lBack.mode, 'left', 'зеркально: с крайнего левого правой панели влево — в левую')
  assertEq(r2lBack.activeFieldId, 'type', '…и на крайний правый её Field')

  /* Внутри стороны переход не при чём: шаг обычный. */
  var inside = plan({ ids: left, otherIds: right, activeFieldId: 'importance', mode: 'left', dir: 1, edgeMode: 'next-block' })
  assertEq(inside.mode, 'left', 'шаг внутри стороны не обязан менять сторону')
  assertEq(inside.activeFieldId, 'type', 'шаг внутри стороны идёт по своему списку')
  assertEq(inside.crossed, false, 'шаг внутри стороны переходом не является')

  /*
   * Соседняя сторона пуста — уходить некуда. Кольцо замыкается на своей, а не
   * молча ничего не делает: тихий отказ неотличим от дефекта (У-41).
   */
  var noOther = plan({ ids: left, otherIds: [], activeFieldId: 'type', mode: 'left', dir: 1, edgeMode: 'next-block' })
  assertEq(noOther.mode, 'left', 'уходить некуда — сторона остаётся своей')
  assertEq(noOther.activeFieldId, 'importance', 'уходить некуда — кольцо замыкается на своей стороне')

  assertEq(plan({ ids: [], otherIds: right, mode: 'left', dir: 1, edgeMode: 'next-block' }), null,
    'пустая сторона обязана вернуть null, а не выдумать Field')

  assertEq(tagwheel.normalizeEdgeMode('NEXT-BLOCK'), 'next-block', 'значение читается без учёта регистра')
  assertEq(tagwheel.normalizeEdgeMode('что угодно'), 'stay', 'неизвестное значение читается как прежнее поведение')
}

function runChildFieldShortNameSuite() {
  var path = require('path')
  var shared = require(path.join(__dirname, '..', '..', 'src', 'core', 'pkm_rules_runtime_helpers.js'))

  function build(labels) {
    var rules = {
      behavior: { order: {} },
      inlineLayout: { techOrder: ['otherTags'] },
      ui: {},
      leftMode: {
        fields: [
          { id: 'importance', orderKey: 'importance', prefix: '#', placeholder: 'importance', values: [{ id: '', token: '' }, { id: 'p1', token: '#/1' }] },
          { id: 'importance_sub', orderKey: 'importance_sub', dependsOn: 'importance', prefix: '#', placeholder: 'sub', values: [{ id: '', token: '' }, { id: 'p1a', token: '#/1a', allowedParentValues: ['p1'] }] },
          { id: 'category', orderKey: 'category', prefix: '#', placeholder: 'category', values: [{ id: '', token: '' }, { id: 'alpha', token: 'area-alpha' }] },
          { id: 'category_sub', orderKey: 'category_sub', dependsOn: 'category', prefix: '#', placeholder: 'sub', values: [{ id: '', token: '' }, { id: 'alpha-child', token: 'area-alpha-child', allowedParentValues: ['alpha'] }] }
        ]
      },
      rightMode: { fields: [] }
    }
    var orderCfg = shared.parseOrderConfig(JSON.stringify({
      left: ['importance', 'importance_sub', 'category', 'category_sub'],
      right: [],
      active: { importance: 'yes', importance_sub: 'yes', category: 'yes', category_sub: 'yes' },
      enabled: { importance: true, importance_sub: true, category: true, category_sub: true },
      labels: labels,
      strictNames: { importance: 'importance', importance_sub: 'importance_sub', category: 'category', category_sub: 'category_sub' },
      types: { importance: 'tag', importance_sub: 'tag', category: 'tag', category_sub: 'tag' }
    }), function (k) { return String(k || '').trim() })
    shared.applyOrderToRules(rules, orderCfg)
    var byId = {}
    var i
    for (i = 0; i < rules.leftMode.fields.length; i++) byId[rules.leftMode.fields[i].id] = rules.leftMode.fields[i]
    var groups = {}
    var list = (rules.ui && rules.ui.leftGroups) || []
    for (i = 0; i < list.length; i++) groups[list[i].id] = list[i].placeholder
    return { byId: byId, groups: groups }
  }

  var short = build({ importance: 'Imp', category: 'Cat' })
  assertEq(short.byId.importance.placeholder, 'Imp', 'parent field keeps its own short name')
  assertEq(short.byId.importance_sub.placeholder, 'Imp_sub', 'child field takes the parent short name with _sub')
  assertEq(short.byId.category_sub.placeholder, 'Cat_sub', 'child short name is derived per parent, not globally')
  assertEq(short.groups.importance_subGroup, 'Imp_sub', 'TagWheel group of a child field shows the derived short name')
  assertEq(short.groups.category_subGroup, 'Cat_sub', 'TagWheel group of the second child field shows its own parent name')

  /* Короткого имени у родителя нет — дочке нечего наследовать, всё как было. */
  var plain = build({})
  assertEq(plain.byId.importance.placeholder, 'importance', 'without a short name the parent keeps the rules placeholder')
  assertEq(plain.byId.importance_sub.placeholder, 'sub', 'without a parent short name the child keeps the rules placeholder')

  /* Своё короткое имя дочки, если его когда-нибудь начнут задавать, сильнее выведенного. */
  var own = build({ importance: 'Imp', importance_sub: 'Level' })
  assertEq(own.byId.importance_sub.placeholder, 'Level', 'an explicit child short name wins over the derived one')

  /*
   * Подпись, равная ключу, именем не является: её досыпает `parseOrderConfig`
   * каждому Field. Это и был дефект D12.
   */
  var echoed = build({ importance: 'Imp', importance_sub: 'importance_sub', category: 'category' })
  assertEq(echoed.byId.importance_sub.placeholder, 'Imp_sub', 'a label equal to the key is not an own short name')
  assertEq(echoed.groups.importance_subGroup, 'Imp_sub', 'the TagWheel group ignores the echoed key too')
  assertEq(echoed.byId.category_sub.placeholder, 'sub', 'an echoed parent label leaves the child with the rules placeholder')
}

function runNode() {
  var fs = require('fs')
  var path = require('path')
  var core = require(path.join(__dirname, '..', '..', 'pkm_v2', 'TagWheel', 'tagwheel_core.js'))
  var finalize = require(path.join(__dirname, '..', '..', 'src', 'core', 'pkm_line_finalize_unified.js'))
  var rulesCandidates = [
    path.join(__dirname, '..', 'fixtures', 'InlineOverhaul_Generated_RULES_TagWheel.md')
  ]
  var rulesPath = ''
  var i
  for (i = 0; i < rulesCandidates.length; i++) {
    if (fs.existsSync(rulesCandidates[i])) {
      rulesPath = rulesCandidates[i]
      break
    }
  }
  if (!rulesPath) throw new Error('TagWheel rules file not found in local vault candidates')

  var md = fs.readFileSync(rulesPath, 'utf8')
  var rules = core.parseRulesFromMarkdown(md)
  if (!rules.behavior) rules.behavior = {}
  if (!rules.behavior.prefixRules) rules.behavior.prefixRules = {}
  if (!rules.behavior.prefixRules.checkboxByFieldValue) rules.behavior.prefixRules.checkboxByFieldValue = {}
  if (!rules.behavior.prefixRules.checkboxByFieldValue.type) {
    var typeMap = rules.behavior.typeCheckboxByValue && typeof rules.behavior.typeCheckboxByValue === 'object'
      ? rules.behavior.typeCheckboxByValue
      : {}
    rules.behavior.prefixRules.checkboxByFieldValue.type = Object.assign({}, typeMap)
  }
  core.validateRules(rules)
  runSuite(core, rules, finalize)
  runSharedOrderAlignmentSuite()
  runLeadFieldPolicySuite(core)
  runLinkFieldOrderSuite()
  runPanelHighlightSuite(core)
  runElementTokenSuite()
  runRightPayloadSurvivesSuite()
  runChildFieldShortNameSuite()
  runEdgeModeSuite()
  console.log('TagWheel tests: OK')
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].indexOf('tagwheel_tests.js') !== -1) {
  runNode()
}
