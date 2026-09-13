import { app, shell, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerDownloadHandlers } from './download'
import { registerExtensionServer } from './extension'
import { registerSettingsHandlers } from './settings'
import { registerHistoryHandlers } from './history'

let tray: Tray | null = null
let quitting = false

function showWindow(mainWindow: BrowserWindow): void {
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function createTray(mainWindow: BrowserWindow): void {
  if (tray) return
  const image = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
  tray = new Tray(image)
  tray.setToolTip('Cheepli Download')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Cheepli Download', click: () => showWindow(mainWindow) },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => showWindow(mainWindow))
}

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('minimize', () => {
    mainWindow.hide()
  })

  mainWindow.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    mainWindow.hide()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  registerDownloadHandlers()
  registerSettingsHandlers()
  registerHistoryHandlers()
  registerExtensionServer()

  createTray(createWindow())

  app.on('before-quit', () => {
    quitting = true
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    const [window] = BrowserWindow.getAllWindows()
    if (window) {
      showWindow(window)
    } else {
      createTray(createWindow())
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
