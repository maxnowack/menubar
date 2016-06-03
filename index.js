var path = require('path')
var events = require('events')
var fs = require('fs')

var electron = require('electron')
var app = electron.app
var Tray = electron.Tray
var BrowserWindow = electron.BrowserWindow

var extend = require('extend')
var Positioner = require('electron-positioner')

module.exports = function create (opts) {
  if (typeof opts === 'undefined') opts = {dir: app.getAppPath()}
  if (typeof opts === 'string') opts = {dir: opts}
  if (!opts.dir) opts.dir = app.getAppPath()
  if (!(path.isAbsolute(opts.dir))) opts.dir = path.resolve(opts.dir)
  if (!opts.index) opts.index = 'file://' + path.join(opts.dir, 'index.html')
  if (!opts.windowPosition) opts.windowPosition = (process.platform === 'win32') ? 'trayBottomCenter' : 'trayCenter'
  if (typeof opts.showDockIcon === 'undefined') opts.showDockIcon = false

  // set width/height on opts to be usable before the window is created
  opts.width = opts.width || 400
  opts.height = opts.height || 400
  opts.tooltip = opts.tooltip || ''

  app.on('ready', appReady)

  var menubar = new events.EventEmitter()
  menubar.app = app

  // Set / get options
  menubar.setOption = function (opt, val) {
    opts[opt] = val
  }

  menubar.getOption = function (opt) {
    return opts[opt]
  }

  return menubar

  function appReady () {
    if (app.dock && !opts.showDockIcon) app.dock.hide()

    var iconPath = opts.icon || path.join(opts.dir, 'IconTemplate.png')
    if (!fs.existsSync(iconPath)) iconPath = path.join(__dirname, 'example', 'IconTemplate.png') // default cat icon

    var defaultClickEvent = opts.showOnRightClick ? 'right-click' : 'click'

    menubar.tray = opts.tray || new Tray(iconPath)
    menubar.tray.on(defaultClickEvent, clicked)
    menubar.tray.on('double-click', clicked)
    menubar.tray.setToolTip(opts.tooltip)

    menubar.showWindow = opts.showWindow || showWindow
    menubar.hideWindow = opts.hideWindow || hideWindow
    menubar.createWindow = createWindow
    menubar.positionWindow = positionWindow

    if (opts.preloadWindow) {
      menubar.createWindow()
    }

    menubar.emit('ready')

    function clicked (e, bounds) {
      if (e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return menubar.hideWindow()
      if (menubar.window && menubar.window.isVisible()) return menubar.hideWindow()
      menubar.cachedBounds = bounds || menubar.cachedBounds
      menubar.showWindow(menubar.cachedBounds)
    }

    function createWindow () {
      menubar.emit('create-window')
      var defaults = {
        show: false,
        frame: false
      }

      var winOpts = extend(defaults, opts)
      menubar.window = new BrowserWindow(winOpts)

      menubar.positioner = new Positioner(menubar.window)

      if (!opts.alwaysOnTop) {
        menubar.window.on('blur', menubar.hideWindow)
      } else {
        menubar.window.on('blur', emitBlur)
      }

      if (opts.showOnAllWorkspaces !== false) {
        menubar.window.setVisibleOnAllWorkspaces(true)
      }

      menubar.window.on('close', windowClear)
      menubar.window.loadURL(opts.index)
      menubar.emit('after-create-window')
    }

    function positionWindow(trayPos) {
      if (trayPos && trayPos.x !== 0) {
        // Cache the bounds
        menubar.cachedBounds = trayPos
      } else if (menubar.cachedBounds) {
        // Cached value will be used if showWindow is called without bounds data
        trayPos = menubar.cachedBounds
      }

      // Default the window to the right if `trayPos` bounds are undefined or null.
      var noBoundsPosition = null
      if ((trayPos === undefined || trayPos.x === 0) && opts.windowPosition.substr(0, 4) === 'tray') {
        noBoundsPosition = (process.platform === 'win32') ? 'bottomRight' : 'topRight'
      }

      var position = menubar.positioner.calculate(noBoundsPosition || opts.windowPosition, trayPos)

      var x = (opts.x !== undefined) ? opts.x : position.x
      var y = (opts.y !== undefined) ? opts.y : position.y

      menubar.window.setPosition(x, y)
    }

    function showWindow (trayPos) {
      if (!menubar.window) {
        menubar.createWindow()
      }

      menubar.emit('show')
      menubar.positionWindow(trayPos)
      menubar.window.show()
      menubar.emit('after-show')
      return
    }

    function hideWindow () {
      if (!menubar.window) return
      menubar.emit('hide')
      menubar.window.hide()
      menubar.emit('after-hide')
    }

    function windowClear () {
      delete menubar.window
      menubar.emit('after-close')
    }

    function emitBlur () {
      menubar.emit('focus-lost')
    }
  }
}
