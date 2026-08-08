module.exports = async function(input) {
  var NoticeRef = globalThis.Notice

  function notice(msg) {
    if (typeof NoticeRef === 'function') new NoticeRef(msg)
    else console.log('[triggerwheel] ' + msg)
  }

  function resolveApp(x) {
    if (x && x.vault && x.workspace) return x
    if (x && x.app && x.app.vault && x.app.workspace) return x.app
    if (globalThis.app && globalThis.app.vault && globalThis.app.workspace) return globalThis.app
    return null
  }

  async function loadVaultModule(app_, vaultPath, forceReload) {
    if (!globalThis.__pkmModuleCache) globalThis.__pkmModuleCache = new Map()
    if (forceReload) globalThis.__pkmModuleCache.delete(vaultPath)
    if (globalThis.__pkmModuleCache.has(vaultPath)) return globalThis.__pkmModuleCache.get(vaultPath)

    var af = app_.vault.getAbstractFileByPath(vaultPath)
    if (!af && app_ && app_.vault && app_.vault.adapter && typeof app_.vault.adapter.read === 'function') {
      try {
        var _codeDirect = await app_.vault.adapter.read(vaultPath)
        var _moduleDirect = { exports: {} }
        var _fnDirect = new Function('module', 'exports', 'app', 'Notice', _codeDirect + '\n;return module.exports;')
        var _outDirect = _fnDirect(_moduleDirect, _moduleDirect.exports, app_, globalThis.Notice)
        globalThis.__pkmModuleCache.set(vaultPath, _outDirect)
        return _outDirect
      } catch (_) {}
    }
    if (!af) throw new Error('Module not found in vault: ' + vaultPath)
    var code = await app_.vault.read(af)

    var module = { exports: {} }
    var fn = new Function('module', 'exports', 'app', 'Notice', code + '\n;return module.exports;')
    var out = fn(module, module.exports, app_, globalThis.Notice)

    globalThis.__pkmModuleCache.set(vaultPath, out)
    return out
  }

  function getEditor(app_) {
    var leaf = app_ && app_.workspace ? app_.workspace.activeLeaf : null
    var view = leaf && leaf.view ? leaf.view : null

    if (view && view.editor) return view.editor
    if (view && view.currentMode && view.currentMode.editor) return view.currentMode.editor

    if (app_ && app_.workspace && app_.workspace.activeEditor && app_.workspace.activeEditor.editor) {
      return app_.workspace.activeEditor.editor
    }
    return null
  }

  function cleanup(state) {
    if (!state) return
    if (state.keyHandler) window.removeEventListener('keydown', state.keyHandler, true)
    state.active = false
  }

  function applySelection(state, core) {
    var out = core.buildOutput(state.session)
    var spacer = /^\s/.test(state.rightPart || '') ? '' : ' '
    var finalLine = state.leftPart + out + spacer + state.rightPart

    state.editor.setLine(state.lineNumber, state.originalLine)
    state.editor.setLine(state.lineNumber, finalLine)
    state.editor.setCursor({ line: state.lineNumber, ch: state.leftPart.length + out.length + spacer.length })
    cleanup(state)
  }

  function cancelSelection(state) {
    state.editor.setLine(state.lineNumber, state.originalLine)
    state.editor.setCursor({ line: state.lineNumber, ch: state.cursorCh })
    cleanup(state)
  }

  function buildPreviewLine(state, core) {
    var control = core.renderControlLine(state.rules, state.session, state.parsedLine)
    return state.leftPart + ' ==' + control + '== ' + state.rightPart
  }

  var app_ = resolveApp(input)
  if (!app_) {
    notice('TriggerWheel: app context not found')
    return
  }

  var editor = getEditor(app_)
  if (!editor) {
    notice('TriggerWheel: нет активного редактора')
    return
  }

  if (!window.__triggerWheelState) window.__triggerWheelState = { active: false }
  var activeState = window.__triggerWheelState

  if (activeState.active) {
    applySelection(activeState, activeState.core)
    return
  }

  try {
    var core = await loadVaultModule(app_, 'tests/TriggerWheel/triggerwheel_core.js', true)
    var rulesFile = app_.vault.getAbstractFileByPath('tests/fixtures/InlineOverhaul_Generated_RULES_TagWheel.md')
    if (!rulesFile) {
      notice('TriggerWheel: synthetic rules fixture not found')
      return
    }

    var rulesMd = await app_.vault.read(rulesFile)
    var rules = core.parseRulesFromMarkdown(rulesMd)
    core.validateRules(rules)

    var cursor = editor.getCursor()
    var lineNumber = cursor.line
    var originalLine = String(editor.getLine(lineNumber) || '')
    var cursorCh = Number(cursor.ch || 0)
    if (cursorCh < 0) cursorCh = 0
    if (cursorCh > originalLine.length) cursorCh = originalLine.length
    var parsedLine = core.parseLine(originalLine)
    var leftPart = originalLine.slice(0, cursorCh)
    var rightPart = originalLine.slice(cursorCh)

    var session = core.makeInitialState()

    var state = {
      active: true,
      core: core,
      editor: editor,
      rules: rules,
      lineNumber: lineNumber,
      originalLine: originalLine,
      cursorCh: cursorCh,
      leftPart: leftPart,
      rightPart: rightPart,
      parsedLine: parsedLine,
      session: session,
      keyHandler: null
    }

    state.keyHandler = function(e) {
      if (!state.active) return

      var keymap = state.rules.behavior && state.rules.behavior.keymap ? state.rules.behavior.keymap : {}
      var handled = false

      if (e.key === (keymap.nextField || 'ArrowRight')) {
        state.core.nextField(state.session, 1)
        handled = true
      } else if (e.key === (keymap.prevField || 'ArrowLeft')) {
        state.core.nextField(state.session, -1)
        handled = true
      } else if (e.key === (keymap.valueUp || 'ArrowUp')) {
        state.core.cycleValue(state.rules, state.session, 1)
        handled = true
      } else if (e.key === (keymap.valueDown || 'ArrowDown')) {
        state.core.cycleValue(state.rules, state.session, -1)
        handled = true
      } else if (e.key === (keymap.switchField || 'Tab')) {
        state.core.nextField(state.session, 1)
        handled = true
      } else if (e.key === (keymap.apply || 'Enter')) {
        applySelection(state, state.core)
        handled = true
      } else if (e.key === (keymap.cancel || 'Escape')) {
        cancelSelection(state)
        handled = true
      }

      if (handled) {
        if (state.active) {
          var preview = buildPreviewLine(state, state.core)
          state.editor.setLine(state.lineNumber, preview)
          state.editor.setCursor({ line: state.lineNumber, ch: preview.length })
        }
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.__triggerWheelState = state
    window.addEventListener('keydown', state.keyHandler, true)

    var initialPreview = buildPreviewLine(state, core)
    editor.setLine(lineNumber, initialPreview)
    editor.setCursor({ line: lineNumber, ch: initialPreview.length })
    notice('TriggerWheel: режим активирован')
  } catch (e) {
    notice('TriggerWheel error: ' + (e.message || e))
    console.error(e)
  }
}
