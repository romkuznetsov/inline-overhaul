function assertEq(actual, expected, name) {
  if (actual !== expected) throw new Error(name + ': expected `' + expected + '`, got `' + actual + '`')
}

function assertTrue(v, name) {
  if (!v) throw new Error(name + ': expected truthy value')
}

function runSuite(core, rules) {
  ;(function testCategoriesAvailable() {
    var cats = core.getCategoryValues(rules)
    assertTrue(cats.indexOf('✏️ TEXT') !== -1, 'TEXT category exists')
    assertTrue(cats.indexOf('🔍 ANALYSIS') !== -1, 'ANALYSIS category exists')
  })()

  ;(function testUnfilteredShowsAllTriggers() {
    var s = core.makeInitialState()
    var triggers = core.getTriggerValues(rules, s)
    assertTrue(triggers.indexOf('+') !== -1, '+ visible without category')
    assertTrue(triggers.indexOf('==') !== -1, '== visible without category')
  })()

  ;(function testFilteredByCategory() {
    var s = core.makeInitialState()
    s.selected.category = '📋 SUMMARY'
    var triggers = core.getTriggerValues(rules, s)
    assertTrue(triggers.indexOf('=') !== -1, '= visible in SUMMARY')
    assertEq(triggers.indexOf('+') !== -1, false, '+ hidden in SUMMARY')
  })()

  ;(function testHydrateAndApply() {
    var s = core.makeInitialState()
    var p = core.parseLine('  `+`')
    core.hydrateFromParsedLine(rules, s, p)
    assertEq(s.selected.trigger, '+', 'hydrated trigger')
    assertEq(s.selected.category, '✏️ TEXT', 'hydrated category')
    assertEq(core.buildOutput(s), '`+`', 'build output in backticks')
  })()
}

function runNode() {
  var fs = require('fs')
  var path = require('path')
  var core = require(path.join(__dirname, 'triggerwheel_core.js'))
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
  if (!rulesPath) throw new Error('TriggerWheel rules file not found in local vault candidates')
  var md = fs.readFileSync(rulesPath, 'utf8')
  var rules = core.parseRulesFromMarkdown(md)
  core.validateRules(rules)
  runSuite(core, rules)
  console.log('TriggerWheel tests: OK')
}

if (typeof module !== 'undefined' && module.exports && typeof process !== 'undefined') {
  runNode()
}
