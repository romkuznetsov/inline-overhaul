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

function runConfigRoundTripSuite() {
  var path = require('path')
  var helpersMod = require(path.join(__dirname, '..', '..', 'src', 'features', 'config_note_helpers.js'))
  var parserMod = require(path.join(__dirname, '..', '..', 'src', 'features', 'tagwheel_config_parser.js'))
  var codecMod = require(path.join(__dirname, '..', '..', 'src', 'features', 'tagwheel_config_codec.js'))

  function isObj(x) {
    return !!x && typeof x === 'object' && !Array.isArray(x)
  }

  function denormTagToken(token) {
    var value = String(token || '').trim()
    if (!value) return ''
    if (value.charAt(0) === '#') value = value.slice(1)
    return String(value || '').trim()
  }

  function isWikilinkToken(text) {
    var raw = String(text || '').trim()
    return /^\[\[[^\]]+\]\]$/.test(raw)
  }

  function parseWikilinkLineStrict(text, sectionName, lineNo, allowedFields) {
    var raw = String(text || '').trim()
    var m = raw.match(/^(\[\[[^\]]+\]\])(?:\s*-\s*([A-Za-z0-9_-]+))?$/)
    if (!m) throw new Error('Section #### ' + sectionName + ', line ' + lineNo + ': expected wikilink')
    var token = String(m[1] || '').trim()
    var allowed = Array.isArray(allowedFields)
      ? allowedFields.map(function(x) { return String(x || '').trim() }).filter(Boolean)
      : []
    if (!allowed.length) throw new Error('Section #### ' + sectionName + ', line ' + lineNo + ': no wikilink fields are configured')
    var fieldId = String(m[2] || '').trim()
    if (!fieldId) {
      if (allowed.length === 1) fieldId = allowed[0]
      else throw new Error('Section #### ' + sectionName + ', line ' + lineNo + ': field id is required for wikilink')
    }
    if (allowed.indexOf(fieldId) === -1) throw new Error('Section #### ' + sectionName + ', line ' + lineNo + ': unknown wikilink field ' + fieldId)
    return { token: token, fieldId: fieldId }
  }

  function extractFirstTagToken(text) {
    var raw = String(text || '')
    var m = raw.match(/#[^\s#]+/)
    return m ? String(m[0] || '').trim() : ''
  }

  function parseCheckboxAndTag(text) {
    var raw = String(text || '')
    var m = raw.match(/^\s*(?:[-*]\s*)?(\[[^\]]+\])\s+/)
    return {
      checkbox: m ? String(m[1] || '').trim() : '',
      tag: extractFirstTagToken(raw)
    }
  }

  function normalizePkmOrder(rawOrder) {
    var order = isObj(rawOrder) ? JSON.parse(JSON.stringify(rawOrder)) : {}
    if (!Array.isArray(order.left)) order.left = []
    if (!Array.isArray(order.right)) order.right = []
    if (!isObj(order.enabled)) order.enabled = {}
    if (!isObj(order.types)) order.types = {}
    if (!isObj(order.strictNames)) order.strictNames = {}
    return order
  }

  function getOrderStrictName(cfg, key) {
    var order = normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.order : null)
    var strict = String(order.strictNames[key] || '').trim()
    return strict || String(key || '')
  }

  var configHelpers = helpersMod.createConfigNoteHelpers({
    isObj: isObj,
    normalizePkmOrder: normalizePkmOrder,
    getOrderStrictName: getOrderStrictName,
    TAGWHEEL_PREFIX_RESOLVER_H3: 'PREFIX RESOLVER'
  })

  var codec = codecMod.createTagWheelConfigCodec({
    isObj: isObj,
    getOrderStrictName: getOrderStrictName,
    getFieldById: configHelpers.getFieldById,
    getLeftFields: configHelpers.getLeftFields,
    getRightFields: configHelpers.getRightFields,
    collectTagSections: configHelpers.collectTagSections,
    collectWikilinkFieldIds: configHelpers.collectWikilinkFieldIds,
    collectOrderedElementFields: configHelpers.collectOrderedElementFields,
    getPrefixRulesFromCfg: configHelpers.getPrefixRulesFromCfg,
    denormTagToken: denormTagToken,
    parseCustomPrefixResolverBlock: configHelpers.parseCustomPrefixResolverBlock,
    isWikilinkToken: isWikilinkToken,
    parseWikilinkLineStrict: parseWikilinkLineStrict,
    extractFirstTagToken: extractFirstTagToken,
    parseCheckboxAndTag: parseCheckboxAndTag,
    createTagWheelConfigParser: parserMod.createTagWheelConfigParser,
    TAGWHEEL_CONFIG_NOTE_DEFAULT_PATH: 'InlineOverhaul_Config.md',
    TAGWHEEL_CONFIG_TEMPLATE_DEFAULT_PATH: 'InlineOverhaul_Config_template.md',
    TAGWHEEL_TECHNICAL_BLOCK_MARKER: '<!-- INLINE_OVERHAUL:TECHNICAL_BLOCK -->',
    TAGWHEEL_TECH_MARKER_PREFIX: 'INLINE_OVERHAUL:TECH:',
    TAGWHEEL_IMPORTANT_LINE: '> [!IMPORTANT] TAGWHEEL',
    CFG_H1_SETTINGS: 'Settings',
    CFG_H2_TAGS: '`#TAGS/#SUBTAGS` + `WIKILINKS`',
    CFG_H2_DATES: 'DATES',
    CFG_H2_ELEMENTS: 'ELEMENTS',
    CFG_H2_ELEMENTS_COMBINED: 'DATE/TIME + ELEMENTS',
    TAGWHEEL_PREFIX_RESOLVER_H3: 'PREFIX RESOLVER',
    TAGWHEEL_PREFIX_RESOLVER_SECTION: 'PREFIX RESOLVER',
    TAGWHEEL_WIKILINK_SECTION: 'wikilink fields (from Order)'
  })

  var cfg = {
    pkm: {
      behavior: {
        order: {
          left: ['importance', 'category', 'category_sub', 'project', 'clients'],
          right: ['date_due', 'date_start', 'time', 'effort1'],
          enabled: { importance: true, category: true, category_sub: true, project: true, clients: true, date_due: true, date_start: true, time: true, effort1: true },
          types: { importance: 'tag', category: 'tag', category_sub: 'tag', project: 'tag', clients: 'tag', date_due: 'element', date_start: 'element', time: 'element', effort1: 'element' },
          strictNames: { importance: 'importance', category: 'category', category_sub: 'category_sub', project: 'project', clients: 'clients', date_due: 'date_due', date_start: 'date_start', time: 'time', effort1: 'effort1' },
          propertiesByField: { importance: 'importance', clients: 'client_prop', effort1: 'effort_prop' }
        },
        leftMode: {
          fields: [
            { id: 'priority', orderKey: 'importance', prefix: '#', values: [{ token: '' }, { token: '/1', yamlProperty: 'priority_override' }] },
            { id: 'category', orderKey: 'category', prefix: '#', values: [{ token: '' }, { token: 'area-alpha' }, { token: 'area-shared' }] },
            { id: 'category_sub', orderKey: 'category_sub', prefix: '#', dependsOn: 'category', values: [{ token: '' }, { token: 'area-alpha-child', allowedParentValues: ['area-alpha'] }, { token: 'area-shared-child', allowedParentValues: ['area-shared'] }] },
            { id: 'project', orderKey: 'project', source: 'projects', values: [{ token: '' }] },
            { id: 'clients', orderKey: 'clients', source: 'wikilinks:clients', dependsOn: 'category_sub', values: [{ token: '' }, { token: '[[Entity-Alpha]]' }, { token: '[[EntityBeta]]' }] }
          ]
        },
        rightMode: {
          fields: [
            { id: 'due', orderKey: 'date_due', kind: 'dateOffset', marker: '📅', values: [{ token: '' }] },
            { id: 'start', orderKey: 'date_start', kind: 'dateOffset', marker: '🛫', values: [{ token: '' }] },
            { id: 'timeNow', orderKey: 'time', kind: 'nowTime', marker: '🕒', values: [{ token: '' }] },
            { id: 'effortField', orderKey: 'effort1', kind: 'genericElement', marker: '⛏️', values: [{ token: '' }] }
          ]
        },
        prefixRules: {
          resolver: 'priority-first',
          priorityMode: 'by-section',
          fieldsOrderMode: 'manual',
          tagSubtagPriority: 'subtag-over-tag',
          priorityTargets: ['priority', 'category', 'category_sub'],
          priorityCheckboxes: ['[ ]'],
          checkboxByFieldValue: {}
        },
        dates: { fields: ['date_due', 'date_start', 'time'], byField: { date_due: { emoji: '📅' }, date_start: { emoji: '🛫' }, time: { emoji: '🕒' } } },
        elements: { fields: ['effort1'], byField: { effort1: { emoji: '⛏️', format: '000', increment: { mode: 'standard', incrementBy: 1 } } } },
        projects: {
          filterKeys: ['type', 'type_sub', 'category', 'category_sub', 'project'],
          defaults: ['[[LEGACY_DEFAULT]]'],
          byContext: {
            oldctx: { branch: ['[[LEGACY_BRANCH]]'], leaf: { oldsub: ['[[LEGACY_LEAF]]'] } }
          }
        }
      },
      taxonomy: {
        tagWheelConfig: {
          prefixResolver: {
            fieldsOrderRaw: ['type', 'client', 'client1', 'topic', 'clients', 'importance', 'category', 'project', 'date_due', 'time', 'date_start', 'effort', 'effort1']
          },
          wikilinkFields: ['project', 'clients'],
          wikilinks: {
            project: {
              bySection: {
                project: {
                  defaults: ['[[example]]'],
                  byParent: {}
                },
                category: {
                  defaults: ['[[HomeHub]]'],
                  byParent: {
                    '#area-alpha': { branch: ['[[Project Alpha]]'], leaf: { '#area-alpha-child': ['[[Project Alpha Child]]'] } }
                  }
                }
              }
            },
            clients: {
              bySection: {
                category: {
                  defaults: [],
                  byParent: {
                    '#area-shared': { branch: [], leaf: { '#area-shared-child': ['[[Entity Linked]]'] } }
                  }
                },
                clients: {
                  defaults: ['[[Entity-Alpha]]', '[[EntityBeta]]'],
                  byParent: {}
                }
              }
            }
          }
        }
      }
    }
  }

  var md1 = codec.buildTagWheelConfigMarkdown(cfg, 'minimal')
  assertTrue(md1.indexOf('- [[Project Alpha Child]] - project') !== -1, 'codec generate keeps mixed project wikilink in category section')
  assertTrue(md1.indexOf('- [[Entity Linked]] - clients') !== -1, 'codec generate keeps mixed wikilink-source field token in category section')
  var tagsSectionStart = md1.indexOf('### `#TAGS/#SUBTAGS` + `WIKILINKS`')
  var tagsSectionEnd = md1.indexOf('### `DATE/TIME + ELEMENTS`')
  var tagsSection = tagsSectionStart !== -1 && tagsSectionEnd !== -1 && tagsSectionEnd > tagsSectionStart
    ? md1.slice(tagsSectionStart, tagsSectionEnd)
    : ''
  assertTrue(tagsSection.indexOf('##### date_due') === -1, 'tags section does not include date fields')
  assertTrue(tagsSection.indexOf('##### date_start') === -1, 'tags section does not include start-date fields')
  assertTrue(tagsSection.indexOf('##### time') === -1, 'tags section does not include time fields')
  assertTrue(tagsSection.indexOf('##### effort') === -1, 'tags section does not include generic element fields')
  assertTrue(md1.indexOf('**Automatically** - by plugin settings "Order" (PKM -> Order). Left panel tags > right panel tags, priority decreases from up to down') !== -1, 'prefix resolver keeps full Automatically explanatory text')
  assertTrue(md1.indexOf('**Manually** - by your settings `Fields order` (go below to subheader `Order`)') !== -1, 'prefix resolver keeps full Manually explanatory text')
  assertTrue(md1.indexOf('yaml = `priority_override`') !== -1, 'codec generate emits token-level yaml override for tags')
  assertTrue(md1.indexOf('##### clients - link') !== -1 && md1.indexOf('- YAML: client_prop') !== -1, 'codec generate emits field-level yaml line for link sections')
  assertTrue(md1.indexOf('##### effort1') !== -1 && md1.indexOf('- YAML: effort_prop') !== -1, 'codec generate emits field-level yaml line for element sections')
  var typeSectionStart = md1.indexOf('##### type')
  var typeSectionEnd = md1.indexOf('##### category')
  var typeSection = typeSectionStart !== -1 && typeSectionEnd !== -1 && typeSectionEnd > typeSectionStart
    ? md1.slice(typeSectionStart, typeSectionEnd)
    : ''
  assertTrue(typeSection.indexOf(' - project') === -1, 'type section does not get source-derived project rows from compat fallback')
  var clientsSectionStart = md1.indexOf('##### clients')
  var clientsSectionEnd = md1.indexOf('#### PREFIX RESOLVER')
  var clientsSection = clientsSectionStart !== -1 && clientsSectionEnd !== -1 && clientsSectionEnd > clientsSectionStart
    ? md1.slice(clientsSectionStart, clientsSectionEnd)
    : ''
  assertTrue(clientsSection.indexOf('[[Entity-Alpha]] - clients') === -1, 'source field own section does not duplicate entries with field suffix')
  assertTrue(clientsSection.indexOf('[[EntityBeta]] - clients') === -1, 'source field own section does not duplicate secondary entry with field suffix')
  var projectSectionStart = md1.indexOf('##### project')
  var projectSectionEnd = md1.indexOf('##### client')
  var projectSection = projectSectionStart !== -1 && projectSectionEnd !== -1 && projectSectionEnd > projectSectionStart
    ? md1.slice(projectSectionStart, projectSectionEnd)
    : ''
  assertTrue(projectSection.indexOf('- [[example]]') !== -1, 'source-own project section keeps wikilink token without conversion to tag')
  assertTrue(projectSection.indexOf('- #example') === -1, 'source-own project section does not convert wikilink defaults into tag entries')
  var fieldsOrderStart = md1.indexOf('1.  **Fields Order:**')
  var fieldsOrderEnd = md1.indexOf('2. **Checkbox Order:**')
  var fieldsOrderSection = fieldsOrderStart !== -1 && fieldsOrderEnd !== -1 && fieldsOrderEnd > fieldsOrderStart
    ? md1.slice(fieldsOrderStart, fieldsOrderEnd)
    : ''
  assertTrue(fieldsOrderSection.indexOf('- date_due') !== -1, 'fields order keeps non-tag entries from canonical raw order list')
  assertTrue(fieldsOrderSection.indexOf('- effort1') !== -1, 'fields order keeps trailing raw order entries from canonical metadata')

  var parsed = codec.parseTagWheelConfigMarkdown(md1, cfg)
  var rebuiltWikilinks = {}
  var wikilinkFields = Array.isArray(parsed.wikilinkFields) ? parsed.wikilinkFields : []
  var i
  for (i = 0; i < wikilinkFields.length; i++) {
    rebuiltWikilinks[wikilinkFields[i]] = { bySection: {} }
  }
  var sectionNames = Object.keys(parsed.sections || {})
  for (i = 0; i < sectionNames.length; i++) {
    var sectionName = sectionNames[i]
    var sec = parsed.sections[sectionName]
    var wl = sec && sec.wikilinks && typeof sec.wikilinks === 'object' ? sec.wikilinks : {}
    var fieldIds = Object.keys(wl)
    var fi
    for (fi = 0; fi < fieldIds.length; fi++) {
      var fid = fieldIds[fi]
      if (!rebuiltWikilinks[fid]) rebuiltWikilinks[fid] = { bySection: {} }
      rebuiltWikilinks[fid].bySection[sectionName] = wl[fid]
    }
  }

  var cfg2 = JSON.parse(JSON.stringify(cfg))
  cfg2.pkm.behavior.projects = {
    filterKeys: ['category', 'category_sub'],
    defaults: ['[[STALE_SHOULD_NOT_RENDER]]'],
    byContext: { stale: { branch: ['[[STALE_BRANCH]]'], leaf: {} } }
  }
  cfg2.pkm.taxonomy.tagWheelConfig.wikilinks = rebuiltWikilinks
  var md2 = codec.buildTagWheelConfigMarkdown(cfg2, 'minimal')
  assertEq(md2, md1, 'codec round-trip generate/parse/generate is idempotent for mixed wikilink bindings')
  assertTrue(md2.indexOf('[[STALE_SHOULD_NOT_RENDER]]') === -1, 'codec prioritizes taxonomy bySection over stale projects fallback data')

  var cfg3 = JSON.parse(JSON.stringify(cfg))
  if (cfg3 && cfg3.pkm && cfg3.pkm.taxonomy && cfg3.pkm.taxonomy.tagWheelConfig && cfg3.pkm.taxonomy.tagWheelConfig.wikilinks && cfg3.pkm.taxonomy.tagWheelConfig.wikilinks.clients) {
    cfg3.pkm.taxonomy.tagWheelConfig.wikilinks.clients.bySection = {}
  }
  var clientsField3 = cfg3 && cfg3.pkm && cfg3.pkm.behavior && cfg3.pkm.behavior.leftMode && Array.isArray(cfg3.pkm.behavior.leftMode.fields)
    ? cfg3.pkm.behavior.leftMode.fields.filter(function (f) { return f && f.id === 'clients' })[0]
    : null
  if (clientsField3 && Array.isArray(clientsField3.values)) {
    clientsField3.values.push({
      token: '[[EntityGamma]]',
      __ioParentBinding: 's:#area-shared-child|p:#area-shared|f:category_sub',
      __ioParentFieldId: 'category_sub',
      allowedParentValues: ['area-shared', 'area-shared-child'],
      active: true
    })
  }
  var md3 = codec.buildTagWheelConfigMarkdown(cfg3, 'minimal')
  var categorySectionStart3 = md3.indexOf('##### category - tag')
  var categorySectionEnd3 = md3.indexOf('##### project - link')
  var categorySection3 = categorySectionStart3 !== -1 && categorySectionEnd3 !== -1 && categorySectionEnd3 > categorySectionStart3
    ? md3.slice(categorySectionStart3, categorySectionEnd3)
    : md3
  assertTrue(categorySection3.indexOf('[[EntityGamma]] - clients') !== -1, 'codec section-aware fallback keeps linked entity token in parent section when taxonomy bySection is absent')
  var clientsSectionMatch3 = md3.match(/##### clients - link[\s\S]*?(?=\n##### |\n#### PREFIX RESOLVER|$)/)
  var clientsSection3 = clientsSectionMatch3 ? clientsSectionMatch3[0] : md3
  var countIn = function (src, needle) {
    var idx = 0
    var cnt = 0
    while (true) {
      var pos = src.indexOf(needle, idx)
      if (pos === -1) break
      cnt += 1
      idx = pos + needle.length
    }
    return cnt
  }
  assertEq(String(countIn(clientsSection3, '[[EntityGamma]]')), '0', 'clients own section excludes bound entity token')
  assertEq(String(countIn(clientsSection3, '[[Entity-Alpha]]')), '1', 'clients own section keeps single deduped default token Entity-Alpha')
  assertEq(String(countIn(clientsSection3, '[[EntityBeta]]')), '1', 'clients own section keeps single deduped default token EntityBeta')
}

function runSharedOrderAlignmentSuite() {
  var path = require('path')
  var shared = require(path.join(__dirname, '..', '..', 'src', 'core', 'pkm_rules_runtime_helpers.js'))

  function isObj(x) {
    return !!x && typeof x === 'object' && !Array.isArray(x)
  }

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
      }
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

function runLeadFieldPolicySuite(core) {
  var rules = {
    behavior: {
      order: {
        left: ['importance', 'category', 'project'],
        right: ['date_due', 'time'],
        lead: { left: 'project', right: 'time' },
        active: { importance: 'yes', category: 'yes', project: 'yes', date_due: 'yes', time: 'yes' },
        enabled: { importance: true, category: true, project: true, date_due: true, time: true }
      }
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
  runConfigRoundTripSuite()
  runSharedOrderAlignmentSuite()
  runLeadFieldPolicySuite(core)
  console.log('TagWheel tests: OK')
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].indexOf('tagwheel_tests.js') !== -1) {
  runNode()
}
