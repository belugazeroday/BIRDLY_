import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  screen,
  shell,
  Tray,
  Menu,
  nativeImage,
} from 'electron'
import path from 'path'
import fs from 'fs'
import { setupIpcHandlers } from './ipcHandlers'
import { SettingsStore } from './settings'

const isDev = process.env.NODE_ENV === 'development'
const OVERLAY_INTERACTION_MS = 3000
const OVERLAY_HANDLE_HEIGHT_PX = 28
const START_INTERACTIVE = true

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let overlayVisible = true
let overlayInteractionEnabled = false
let overlayInteractionTimer: NodeJS.Timeout | null = null
let overlayCursorMonitor: NodeJS.Timeout | null = null
let persistOverlayBoundsTimer: NodeJS.Timeout | null = null
let settingsStore: SettingsStore | null = null
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
}

function getSettingsStore() {
  if (!settingsStore) {
    settingsStore = new SettingsStore()
  }
  return settingsStore
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getPreloadPath() {
  return path.join(__dirname, '../preload/preload.js')
}

function getRendererPageUrl(page: 'index' | 'overlay') {
  if (isDev) {
    return `http://localhost:5173/${page}.html`
  }

  return `file://${path.join(__dirname, '../../dist', `${page}.html`)}`
}

function scheduleOverlayBoundsPersistence() {
  if (persistOverlayBoundsTimer) {
    clearTimeout(persistOverlayBoundsTimer)
  }

  persistOverlayBoundsTimer = setTimeout(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return

    const [x, y] = overlayWindow.getPosition()
    const [width, height] = overlayWindow.getSize()
    getSettingsStore().save({
      overlayX: x,
      overlayY: y,
      overlayWidth: width,
      overlayHeight: height,
    })
  }, 120)
}

function broadcastOverlayInteractionState() {
  mainWindow?.webContents.send('widget-interaction-changed', overlayInteractionEnabled)
  overlayWindow?.webContents.send('widget-interaction-changed', overlayInteractionEnabled)
}

function setOverlayInteraction(enabled: boolean, durationMs = OVERLAY_INTERACTION_MS, focus = false) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return

  if (overlayInteractionTimer) {
    clearTimeout(overlayInteractionTimer)
    overlayInteractionTimer = null
  }

  overlayInteractionEnabled = enabled
  overlayWindow.setIgnoreMouseEvents(!enabled, { forward: true })
  overlayWindow.setFocusable(enabled)

  if (enabled) {
    overlayWindow.showInactive()
    if (focus) {
      overlayWindow.focus()
    }
    if (durationMs > 0) {
      overlayInteractionTimer = setTimeout(() => {
        setOverlayInteraction(false)
      }, durationMs)
    }
  } else {
    if (BrowserWindow.getFocusedWindow() === overlayWindow) {
      overlayWindow.blur()
    }
  }

  broadcastOverlayInteractionState()
}

function startOverlayCursorMonitor() {
  if (overlayCursorMonitor) return

  overlayCursorMonitor = setInterval(() => {
    if (
      !overlayWindow ||
      overlayWindow.isDestroyed() ||
      !overlayVisible ||
      overlayInteractionEnabled
    ) {
      return
    }

    const bounds = overlayWindow.getBounds()
    const cursor = screen.getCursorScreenPoint()
    const withinHorizontalBounds =
      cursor.x >= bounds.x && cursor.x <= bounds.x + bounds.width
    const withinHandleBounds =
      cursor.y >= bounds.y && cursor.y <= bounds.y + OVERLAY_HANDLE_HEIGHT_PX

    if (withinHorizontalBounds && withinHandleBounds) {
        setOverlayInteraction(true, 3500, false)
      }
    }, 120)
}

function stopOverlayCursorMonitor() {
  if (!overlayCursorMonitor) return
  clearInterval(overlayCursorMonitor)
  overlayCursorMonitor = null
}

// ─────────────────────────────────────────────
// MAIN WINDOW  (Dashboard / Settings / KB)
// ─────────────────────────────────────────────
function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    return mainWindow
  }

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    frame: false,
    vibrancy: 'sidebar',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
    },
    show: false,
    icon: path.join(__dirname, '../../assets/icon.png'),
  })

  const url = getRendererPageUrl('index')

  mainWindow.loadURL(url)
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  if (isDev) mainWindow.webContents.openDevTools()

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

// ─────────────────────────────────────────────
// STEALTH OVERLAY  (floating coaching widget)
// ─────────────────────────────────────────────
function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.showInactive()
    return overlayWindow
  }

  const { workArea } = screen.getPrimaryDisplay()
  const settings = getSettingsStore().get()
  const overlayWidth = Math.max(520, Math.round(settings.overlayWidth || 620))
  const overlayHeight = Math.max(420, Math.round(settings.overlayHeight || 520))
  const centeredX = Math.round(workArea.x + workArea.width / 2 - overlayWidth / 2)
  const centeredY = workArea.y + 36
  const startX = settings.overlayX >= 0
    ? clamp(settings.overlayX, workArea.x, workArea.x + workArea.width - overlayWidth)
    : centeredX
  const startY = settings.overlayY >= 0
    ? clamp(settings.overlayY, workArea.y, workArea.y + workArea.height - overlayHeight)
    : centeredY

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    minWidth: 520,
    minHeight: 420,
    x: startX,
    y: startY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: true,
    hasShadow: false,
    type: 'panel',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
    },
    show: true,
  })

  overlayWindow.setContentProtection(true)
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1)
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWindow.setIgnoreMouseEvents(!START_INTERACTIVE, { forward: true })
  overlayWindow.setFocusable(START_INTERACTIVE)
  overlayInteractionEnabled = START_INTERACTIVE

  const url = getRendererPageUrl('overlay')

  overlayWindow.loadURL(url)
  overlayWindow.once('ready-to-show', () => {
    overlayWindow?.showInactive()
    if (START_INTERACTIVE) {
      setOverlayInteraction(true, 0, false)
    } else {
      broadcastOverlayInteractionState()
    }
  })

  overlayWindow.on('move', scheduleOverlayBoundsPersistence)
  overlayWindow.on('resize', scheduleOverlayBoundsPersistence)
  overlayWindow.on('closed', () => {
    stopOverlayCursorMonitor()
    overlayInteractionEnabled = false
    overlayWindow = null
  })

  return overlayWindow
}

// ─────────────────────────────────────────────
// SYSTEM TRAY
// ─────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '../../assets/icon.png')
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty()

  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Birdly',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Show / Hide Dashboard',
      click: () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow?.show()
          mainWindow?.focus()
        }
      },
    },
    {
      label: 'Toggle Overlay (Ctrl/Cmd+Shift+B)',
      click: () => {
        toggleOverlay()
      },
    },
    {
      label: 'Unlock Widget (Ctrl/Cmd+\\)',
      click: () => {
        setOverlayInteraction(true, OVERLAY_INTERACTION_MS, true)
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ])

  tray.setToolTip('Birdly – AI Performance Coach')
  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// ─────────────────────────────────────────────
// OVERLAY VISIBILITY TOGGLE
// ─────────────────────────────────────────────
function toggleOverlay() {
  if (!overlayWindow) return

  overlayVisible = !overlayVisible
  if (overlayVisible) {
    overlayWindow.showInactive()
  } else {
    setOverlayInteraction(false)
    overlayWindow.hide()
  }

  mainWindow?.webContents.send('overlay-visibility-changed', overlayVisible)
  overlayWindow?.webContents.send('overlay-visibility-changed', overlayVisible)
}

ipcMain.on(
  'toggle-widget-interaction',
  (_e, payload?: { enabled?: boolean; durationMs?: number; focus?: boolean }) => {
    if (!overlayWindow) return

    if (payload?.enabled === false) {
      setOverlayInteraction(false)
      return
    }

    setOverlayInteraction(
      true,
      payload?.durationMs ?? OVERLAY_INTERACTION_MS,
      Boolean(payload?.focus)
    )
  }
)

ipcMain.on('overlay-set-interactive', (_e, interactive: boolean) => {
  setOverlayInteraction(interactive, OVERLAY_INTERACTION_MS, interactive)
})

ipcMain.on('overlay-move', (_e, x: number, y: number) => {
  overlayWindow?.setPosition(Math.round(x), Math.round(y))
  scheduleOverlayBoundsPersistence()
})

ipcMain.on('overlay-resize', (_e, w: number, h: number) => {
  overlayWindow?.setSize(Math.round(w), Math.round(h))
  scheduleOverlayBoundsPersistence()
})

ipcMain.on('open-main-window', () => {
  if (!mainWindow) {
    createMainWindow()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
})

// ─────────────────────────────────────────────
// APP LIFECYCLE
// ─────────────────────────────────────────────
app.whenReady().then(async () => {
  getSettingsStore()
  createMainWindow()
  createOverlayWindow()
  createTray()
  if (!START_INTERACTIVE) {
    startOverlayCursorMonitor()
  }

  const visibilityHotkey =
    process.platform === 'darwin' ? 'Command+Shift+B' : 'Control+Shift+B'
  const interactionHotkey =
    process.platform === 'darwin' ? 'Command+\\' : 'Control+\\'

  globalShortcut.register(visibilityHotkey, toggleOverlay)
  globalShortcut.register(interactionHotkey, () => {
    setOverlayInteraction(true, OVERLAY_INTERACTION_MS, true)
  })

  setupIpcHandlers(mainWindow, overlayWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }

  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow()
  } else {
    overlayWindow.showInactive()
    if (START_INTERACTIVE) {
      setOverlayInteraction(true, 0, false)
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopOverlayCursorMonitor()
})

app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})
