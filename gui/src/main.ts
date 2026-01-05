import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, net, Notification, dialog } from 'electron'
import { exec } from 'child_process'
import path from 'node:path'
import os from 'os'
import fs from 'node:fs'
import { ProcessManager } from './process-manager'
import { PresetManager } from './preset-manager'
import { Updater } from './updater'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let tray: Tray | null = null
let processManager: ProcessManager | null = null
let presetManager: PresetManager | null = null
let updater: Updater | null = null
let isQuitting = false

// Set app name for Windows notifications
app.setAppUserModelId('Zapret GUI')

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// Path to winws.exe relative to project root (dev) or resources (prod)
const getWinwsPath = () => {
    let exePath = ''
    if (app.isPackaged) {
        exePath = path.join(process.resourcesPath, 'bin/winws.exe')
    } else {
        exePath = path.resolve(app.getAppPath(), '../bin/winws.exe')
    }

    // Debug: Check if file exists
    const fs = require('fs')
    if (!fs.existsSync(exePath)) {
        const fallback = path.resolve(__dirname, '../../bin/winws.exe')
        if (fs.existsSync(fallback)) return fallback
    }
    return exePath
}

// Root directory for .bat files
const getProjectRoot = () => {
    if (app.isPackaged) {
        return process.resourcesPath
    }
    return path.resolve(app.getAppPath(), '../')
}

// Check for Admin Privileges
const checkAdmin = () => {
    exec('net session', (err) => {
        if (err) {
            console.warn('WARNING: Not running as Administrator. Zapret requires Admin rights!')
            setTimeout(() => {
                win?.webContents.send('log-output', 'WARNING: App not running as Administrator! Start/Stop will likely fail.')
            }, 3000)
        } else {
            console.log('Running as Administrator.')
        }
    })
}

// Helper to get asset path (dev or prod)
const getAssetPath = (filename: string) => {
    // In production, assets are in process.resourcesPath or adjacent to the executable?
    // Vite puts public assets in 'dist'. main.js is in 'dist-electron'
    // So usually: path.join(__dirname, '../dist', filename)

    // Check DIST (Vite output)
    let p = path.join(process.env.VITE_PUBLIC || '', filename)

    // Fallback: Check resources root (common for electron-builder extraResources)
    const fs = require('fs')
    if (!fs.existsSync(p)) {
        p = path.join(process.resourcesPath, filename)
    }

    // Fallback: Check app root (dev)
    if (!fs.existsSync(p)) {
        p = path.join(app.getAppPath(), 'public', filename)
    }

    return p
}

const updateTrayIcon = (status: 'running' | 'stopped') => {
    if (!tray) return
    const filename = status === 'running' ? 'tray-running.png' : 'tray-stopped.png'
    const iconPath = getAssetPath(filename)
    console.log(`Loading tray icon from: ${iconPath} `) // Debug log
    const icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
        console.error(`Failed to load tray icon: ${filename} from ${iconPath} `)
    } else {
        tray.setImage(icon.resize({ width: 16, height: 16 }))
    }
}

function createTray() {
    const iconPath = getAssetPath('tray-stopped.png')
    const icon = nativeImage.createFromPath(iconPath)
    tray = new Tray(icon.resize({ width: 16, height: 16 }))

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => win?.show() },
        { type: 'separator' },
        {
            label: 'Quit', click: () => {
                isQuitting = true
                app.quit()
            }
        }
    ])

    tray.setToolTip('Zapret GUI')
    tray.setContextMenu(contextMenu)

    tray.on('double-click', () => {
        win?.show()
    })
}

function createWindow() {
    win = new BrowserWindow({
        width: 960,
        height: 720,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        frame: false,
        transparent: false, // Disabled to fix "invisible window" in production
        backgroundColor: '#0f172a', // Set default background to match theme
        show: false, // Don't show until ready
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: getAssetPath('zapret.png'),
    })

    // Initialize Managers
    processManager = new ProcessManager(win)
    presetManager = new PresetManager(getProjectRoot())

    // Initialize Updater
    const projectRoot = getProjectRoot()
    // Current version in package.json is 1.0.0, but that's GUI version. 
    // We'll pass a placeholder or try to read it. For now "0.0.0"
    updater = new Updater("0.0.0", projectRoot)
    updater.setLogCallback((msg) => {
        win?.webContents.send('log-output', msg)
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(process.env.DIST || '', 'index.html'))
    }

    // Handle minimize to tray
    win.on('minimize', (event: any) => {
        event.preventDefault()
        win?.hide()
    })

    // Handle close to tray
    win.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault()
            win?.hide()
            return false
        }
        return true
    })

    // Show window when ready to prevent white flash or invisible state
    win.once('ready-to-show', () => {
        win?.show()
    })

    // Check admin rights after window load
    win.webContents.on('did-finish-load', () => {
        checkAdmin()
    })
}

app.on('window-all-closed', () => {
    // Do not quit, background process might be running
    if (process.platform !== 'darwin') {
        // app.quit() // Disabled for tray support
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(() => {
    createWindow()
    createTray()
})


// --- IPC Handlers ---

ipcMain.handle('start-zapret', async (_event, args: string[]) => {
    if (!processManager) return { success: false, message: 'Manager not initialized' }
    const result = await processManager.start(getWinwsPath(), args)
    if (result.success) {
        updateTrayIcon('running')
    }
    return result
})

ipcMain.handle('stop-zapret', async () => {
    if (!processManager) return { success: true }
    const result = await processManager.stop()
    updateTrayIcon('stopped')
    return result
})

ipcMain.handle('get-presets', async () => {
    if (!presetManager) return []
    return presetManager.scanPresets()
})

ipcMain.handle('window-control', (_event, action) => {
    if (!win) return
    if (action === 'minimize') win.hide() // Minimize to tray
    if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize()
    if (action === 'close') {
        // Trigger the close event which is intercepted above
        win.close()
    }
})

ipcMain.handle('get-autostart', () => {
    return app.getLoginItemSettings().openAtLogin
})

ipcMain.handle('set-autostart', (_event, openAtLogin: boolean) => {
    app.setLoginItemSettings({
        openAtLogin,
        path: process.execPath,
        args: [
            '--process-start-args', `"--hidden"` // Optional: pass arg to start hidden
        ]
    })
    return true
})

ipcMain.handle('show-notification', (_event, { title, body }) => {
    const iconPath = getAssetPath('zapret.png')
    const icon = nativeImage.createFromPath(iconPath)
    new Notification({ title, body, icon: icon }).show()
})

ipcMain.handle('check-connectivity', async () => {
    return new Promise((resolve) => {
        // Define targets - GitHub is now critical for update checking
        const targets = [
            { id: 'discord', url: 'https://discord.com', critical: true },
            { id: 'youtube', url: 'https://www.youtube.com', critical: true },
            { id: 'google', url: 'https://www.google.com', critical: false }, // General check
            { id: 'github', url: 'https://github.com', critical: true }       // Critical for updates
        ]

        win?.webContents.send('log-output', `DEBUG: Starting Connectivity Check (${targets.length} targets)...`)

        let completed = 0
        const results: Record<string, boolean> = {}
        let success = false

        // Helper for individual check - now verifies actual content reception to catch TLS/UNSUP issues
        const checkTarget = (target: { id: string, url: string, critical: boolean }) => {
            const request = net.request(target.url)
            let receivedBytes = 0
            let checkCompleted = false

            const completeCheck = (isSuccess: boolean, reason: string) => {
                if (checkCompleted) return
                checkCompleted = true
                results[target.id] = isSuccess
                win?.webContents.send('log-output', `Check ${target.id}: ${reason}`)
                onCheckComplete()
            }

            const timer = setTimeout(() => {
                console.log(`Check timed out: ${target.id}`)
                request.abort()
                completeCheck(false, 'TIMEOUT')
            }, 8000) // Increased timeout for TLS handshake

            request.on('response', (response) => {
                const statusOk = response.statusCode >= 200 && response.statusCode < 400

                win?.webContents.send('log-output', `  → ${target.id}: HTTP ${response.statusCode} (${target.critical ? 'CRITICAL' : 'optional'})`)

                if (!statusOk) {
                    clearTimeout(timer)
                    completeCheck(false, `HTTP ${response.statusCode}`)
                    return
                }

                // Collect data to verify content is actually received (catches TLS UNSUP scenarios)
                response.on('data', (chunk) => {
                    receivedBytes += chunk.length
                })

                response.on('end', () => {
                    clearTimeout(timer)
                    // Require at least some content to be received (TLS working properly)
                    // If TLS is UNSUP, the connection may report OK but no/minimal data arrives
                    if (receivedBytes > 100) {
                        completeCheck(true, `✓ OK (${receivedBytes} bytes received)`)
                    } else {
                        completeCheck(false, `✗ UNSUP (only ${receivedBytes} bytes - TLS/DPI block?)`)
                    }
                })

                response.on('error', (err: Error) => {
                    clearTimeout(timer)
                    completeCheck(false, `✗ STREAM_ERROR: ${err.message}`)
                })
            })

            request.on('error', (error) => {
                clearTimeout(timer)
                console.error(`Check error ${target.id}: ${error.message}`)
                // Detect TLS-related errors specifically
                const isTlsError = error.message.includes('SSL') ||
                    error.message.includes('TLS') ||
                    error.message.includes('certificate') ||
                    error.message.includes('handshake')
                completeCheck(false, isTlsError ? `TLS_ERROR: ${error.message}` : `ERROR: ${error.message}`)
            })

            request.end()
        }

        const onCheckComplete = () => {
            completed++
            if (completed === targets.length) {
                // Logic: 
                // Critical services: Discord, YouTube, GitHub
                // Strategy is GOOD if AT LEAST 2 critical services work (to ensure DPI bypass is effective)
                // This catches UNSUP scenarios where only ping works but TLS fails

                const criticalSuccess = targets.filter(t => t.critical && results[t.id]).length
                const totalCritical = targets.filter(t => t.critical).length

                // Require at least 2 critical services to work (stricter check)
                const criticalOk = criticalSuccess >= 2

                if (criticalOk) {
                    success = true
                    win?.webContents.send('log-output', `Connectivity Decision: PASS (Critical: ${criticalSuccess}/${totalCritical})`)
                } else {
                    success = false
                    win?.webContents.send('log-output', `Connectivity Decision: FAIL (Critical: ${criticalSuccess}/${totalCritical} - need at least 2)`)
                }

                resolve({ success, details: results })
            }
        }

        // Start all checks
        targets.forEach(checkTarget)
    })
})

ipcMain.handle('check-updates', async () => {
    if (!updater) return { success: false, message: 'Updater not initialized' }
    try {
        const info = await updater.checkForUpdates()
        return { success: true, ...info }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
})

ipcMain.handle('install-update', async (_event, downloadUrl: string, version: string) => {
    if (!updater) return { success: false, message: 'Updater not initialized' }
    if (!processManager) return { success: false, message: 'Process Manager not initialized' }

    try {
        // 1. Force Stop Zapret and unload WinDivert driver
        await processManager.forceStopAll()

        // 2. Perform Update
        await updater.downloadAndInstall(downloadUrl, version)

        return { success: true }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
})

// Save logs to file
ipcMain.handle('save-logs', async (_event, logs: string[]) => {
    try {
        const result = await dialog.showSaveDialog({
            title: 'Сохранить логи',
            defaultPath: `zapret - logs - ${new Date().toISOString().slice(0, 10)}.txt`,
            filters: [
                { name: 'Text Files', extensions: ['txt'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        })

        if (result.canceled || !result.filePath) {
            return { success: false, message: 'Cancelled' }
        }

        const content = logs.join('\n')
        fs.writeFileSync(result.filePath, content, 'utf-8')
        return { success: true, path: result.filePath }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
})

// Run Diagnostics
ipcMain.handle('run-diagnostics', async () => {
    try {
        const batchPath = path.join(getProjectRoot(), 'diagnostics.bat')

        // Spawn a new console window running the batch file
        // cmd.exe /c start "" "path/to/script.bat"
        // 'start' command opens a new window
        const cmd = `start "" "${batchPath}"`

        exec(cmd, { cwd: getProjectRoot() }, (error) => {
            if (error) {
                console.error('Failed to launch diagnostics:', error)
                if (win) win.webContents.send('log-output', `Failed to open diagnostics: ${error.message} `)
            }
        })

        return { success: true, results: [] }
    } catch (error: any) {
        console.error('Error running diagnostics:', error)
        return { success: false, message: error.message }
    }
})

// Get Service Status
ipcMain.handle('get-service-status', async () => {
    return new Promise((resolve) => {
        exec('sc query zapret', { encoding: 'utf8' }, (error, stdout) => {
            if (error || !stdout.includes('zapret')) {
                resolve({ installed: false, running: false, strategy: null })
            } else {
                const running = stdout.includes('RUNNING')
                // Get strategy name from registry
                exec('reg query "HKLM\\System\\CurrentControlSet\\Services\\zapret" /v zapret-discord-youtube',
                    { encoding: 'utf8' },
                    (regError, regStdout) => {
                        let strategy = null
                        if (!regError && regStdout) {
                            const match = regStdout.match(/zapret-discord-youtube\s+REG_SZ\s+(.+)/i)
                            if (match) {
                                strategy = match[1].trim()
                            }
                        }
                        resolve({ installed: true, running, strategy })
                    }
                )
            }
        })
    })
})

// Install Service
ipcMain.handle('install-service', async (_event, args: string[]) => {
    const sendLog = (msg: string | { key: string, params?: any }) => {
        if (win) win.webContents.send('log-output', typeof msg === 'string' ? msg : JSON.stringify(msg))
    }

    try {
        const binPath = path.join(getProjectRoot(), 'bin', 'winws.exe')

        // Build args string
        const argsStr = args.map(arg => {
            if (arg.includes(' ') || arg.includes('=')) {
                return `"${arg}"`
            }
            return arg
        }).join(' ')

        sendLog({ key: 'serviceRemoveStarted' }) // Re-using remove started message for "Starting install..." mostly generic

        // Stop and delete existing service
        await new Promise<void>((resolve) => {
            exec('net stop zapret', () => {
                exec('sc delete zapret', () => {
                    setTimeout(resolve, 500)
                })
            })
        })

        // Create new service
        const createCmd = `sc create zapret binPath = "\\"${binPath} \\" ${argsStr}" DisplayName = "Zapret DPI Bypass" start = auto`

        await new Promise<void>((resolve, reject) => {
            exec(createCmd, { encoding: 'utf8' }, (error, stdout, stderr) => {
                if (error && !stdout.includes('SUCCESS')) {
                    sendLog({ key: 'serviceInstallFailed', params: { error: stderr || error.message } })
                    reject(new Error(stderr || error.message))
                } else {
                    // created
                    resolve()
                }
            })
        })

        // Set description
        await new Promise<void>((resolve) => {
            exec('sc description zapret "Zapret DPI bypass software"', () => resolve())
        })

        // Start service
        await new Promise<void>((resolve) => {
            exec('sc start zapret', { encoding: 'utf8' }, (error, stdout, stderr) => {
                if (error && !stdout.includes('RUNNING')) {
                    sendLog({ key: 'serviceInstallFailed', params: { error: stderr || error.message } })
                    resolve() // Don't reject, service is installed
                } else {
                    sendLog({ key: 'serviceStarted' })
                    resolve()
                }
            })
        })

        // Enable TCP timestamps
        exec('netsh interface tcp set global timestamps=enabled', () => { })

        sendLog({ key: 'serviceInstalled' })
        return { success: true }
    } catch (e: any) {
        sendLog({ key: 'ipsetError', params: { message: e.message } })
        return { success: false, message: e.message }
    }
})

// Remove Service
ipcMain.handle('remove-service', async () => {
    const sendLog = (msg: string | { key: string, params?: any }) => {
        if (win) win.webContents.send('log-output', typeof msg === 'string' ? msg : JSON.stringify(msg))
    }

    try {
        sendLog({ key: 'serviceRemoveStarted' })

        // Stop service
        await new Promise<void>((resolve) => {
            exec('net stop zapret', () => resolve())
        })

        // Kill any remaining winws.exe
        await new Promise<void>((resolve) => {
            exec('taskkill /F /IM winws.exe', () => resolve())
        })

        // Delete service
        await new Promise<void>((resolve) => {
            exec('sc delete zapret', { encoding: 'utf8' }, (error, stdout) => {
                if (error && !stdout.includes('SUCCESS')) {
                    // Service might not exist
                    sendLog({ key: 'serviceRemoveFailed' })
                    resolve()
                } else {
                    sendLog({ key: 'serviceRemoved' })
                    resolve()
                }
            })
        })

        // Clean up WinDivert
        await new Promise<void>((resolve) => {
            exec('net stop WinDivert', () => {
                exec('sc delete WinDivert', () => {
                    exec('net stop WinDivert14', () => {
                        exec('sc delete WinDivert14', () => resolve())
                    })
                })
            })
        })

        sendLog({ key: 'serviceRemoved' })
        return { success: true }
    } catch (e: any) {
        sendLog({ key: 'ipsetError', params: { message: e.message } })
        return { success: false, message: e.message }
    }
})

// Run Tests (test zapret.ps1)
ipcMain.handle('run-tests', async (_, params: { testType?: string, runMode?: string, selectedFiles?: string[] }) => {
    const sendLog = (msg: string) => {
        if (win) win.webContents.send('log-output', msg)
    }

    try {
        const scriptPath = path.join(getProjectRoot(), 'utils', 'test zapret.ps1')

        if (!fs.existsSync(scriptPath)) {
            sendLog('✗ Скрипт test zapret.ps1 не найден!')
            return { success: false, message: 'Script not found' }
        }

        sendLog('🧪 Запуск тестов конфигурации...')
        if (params && params.runMode) {
            sendLog(`📌 Режим: ${params.testType === 'dpi' ? 'DPI (Deep Packet Inspection)' : 'Standard (HTTP/Ping)'} `)
            sendLog(`📂 Конфигурации: ${params.runMode === 'all' ? 'Все' : `Выбрано ${params.selectedFiles?.length || 0}`} `)
            sendLog('⏳ Тесты выполняются автоматически...')
        } else {
            sendLog('📌 Откроется отдельное окно PowerShell для выбора параметров')
            sendLog('⏳ Следуйте инструкциям в окне PowerShell')
        }

        // Construct command with params
        let command = `start "" powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`

        if (params) {
            // Add automated params if provided
            if (params.testType) command += ` -TestTypeParam "${params.testType}"`
            if (params.runMode) command += ` -RunModeParam "${params.runMode}"`
            if (params.selectedFiles && params.selectedFiles.length > 0) {
                // Escape commas for PowerShell list passing if needed, but simple string with comma separation works due to script logic
                command += ` -SelectedFilesParam "${params.selectedFiles.join(',')}"`
            }
        }

        // Start in a new visible PowerShell window
        exec(command, {
            cwd: getProjectRoot()
        }, (error) => {
            if (error) {
                sendLog(`✗ Ошибка запуска: ${error.message} `)
            }
        })

        return { success: true }
    } catch (e: any) {
        sendLog(`✗ Ошибка: ${e.message} `)
        return { success: false, message: e.message }
    }
})

// Get Strategy Files (.bat)
ipcMain.handle('get-strategy-files', async () => {
    try {
        const root = getProjectRoot()
        const fs = require('fs')
        if (fs.existsSync(root)) {
            const files = fs.readdirSync(root)
                .filter((f: string) => f.startsWith('general') && f.endsWith('.bat'))
            return files
        }
        return []
    } catch (e) {
        return []
    }
})

// Game Filter Status
ipcMain.handle('get-game-filter-status', async () => {
    const flagFile = path.join(getProjectRoot(), 'utils', 'game_filter.enabled')
    const enabled = fs.existsSync(flagFile)
    return { enabled }
})

// Toggle Game Filter
ipcMain.handle('toggle-game-filter', async () => {
    const sendLog = (msg: string) => {
        if (win) win.webContents.send('log-output', msg)
    }

    const flagFile = path.join(getProjectRoot(), 'utils', 'game_filter.enabled')

    if (fs.existsSync(flagFile)) {
        fs.unlinkSync(flagFile)
        sendLog('🎮 Game Filter отключён')
        sendLog('⚠ Перезапустите Zapret для применения')
        return { enabled: false }
    } else {
        fs.writeFileSync(flagFile, 'ENABLED', 'utf-8')
        sendLog('🎮 Game Filter включён')
        sendLog('📌 Диапазон портов: 1024-65535')
        sendLog('⚠ Перезапустите Zapret для применения')
        return { enabled: true }
    }
})

// ipset Status
ipcMain.handle('get-ipset-status', async () => {
    const listFile = path.join(getProjectRoot(), 'lists', 'ipset-all.txt')

    if (!fs.existsSync(listFile)) {
        return { status: 'none' }
    }

    const content = fs.readFileSync(listFile, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())

    if (lines.length === 0) {
        return { status: 'any' }
    }

    if (content.includes('203.0.113.113/32')) {
        return { status: 'none' }
    }

    return { status: 'loaded' }
})

// Toggle ipset
ipcMain.handle('toggle-ipset', async () => {
    const sendLog = (msg: string | { key: string, params?: any }) => {
        if (win) win.webContents.send('log-output', typeof msg === 'string' ? msg : JSON.stringify(msg))
    }

    const listFile = path.join(getProjectRoot(), 'lists', 'ipset-all.txt')
    const backupFile = path.join(getProjectRoot(), 'lists', 'ipset-all.txt.backup')

    // Get current status
    let currentStatus = 'none'
    if (fs.existsSync(listFile)) {
        const content = fs.readFileSync(listFile, 'utf-8')
        const lines = content.split('\n').filter(l => l.trim())
        if (lines.length === 0) {
            currentStatus = 'any'
        } else if (content.includes('203.0.113.113/32')) {
            currentStatus = 'none'
        } else {
            currentStatus = 'loaded'
        }
    }

    try {
        if (currentStatus === 'loaded') {
            // Switch to none
            sendLog({ key: 'ipsetLoaded' })
            if (fs.existsSync(backupFile)) {
                fs.unlinkSync(backupFile)
            }
            if (fs.existsSync(listFile)) {
                fs.renameSync(listFile, backupFile)
            }
            fs.writeFileSync(listFile, '203.0.113.113/32\n', 'utf-8')
            sendLog({ key: 'ipsetDisabled' })
            return { status: 'none' }

        } else if (currentStatus === 'none') {
            // Switch to any
            sendLog({ key: 'ipsetNone' })
            fs.writeFileSync(listFile, '', 'utf-8')
            sendLog({ key: 'ipsetAll' })
            return { status: 'any' }

        } else {
            // Switch to loaded (restore from backup)
            sendLog({ key: 'ipsetAny' })
            if (fs.existsSync(backupFile)) {
                if (fs.existsSync(listFile)) {
                    fs.unlinkSync(listFile)
                }
                fs.renameSync(backupFile, listFile)
                sendLog({ key: 'ipsetRestored' })
                return { status: 'loaded' }
            } else {
                sendLog({ key: 'ipsetNoBackup' })
                return { status: 'any' }
            }
        }
    } catch (e: any) {
        sendLog({ key: 'ipsetError', params: { message: e.message } })
        return { status: currentStatus }
    }
})

// Open Network Settings
ipcMain.handle('open-network-settings', async () => {
    try {
        exec('control netconnections')
        return { success: true }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
})

// Get Network Adapters
ipcMain.handle('get-network-adapters', async () => {
    return new Promise((resolve) => {
        // PowerShell command:
        // 1. Set encoding to UTF8
        // 2. Get ALL adapters
        // 3. Get DNS for IPv4 AND IPv6
        const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-NetAdapter | ForEach-Object { $dns_v4 = (Get-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -AddressFamily IPv4).ServerAddresses; $dns_v6 = (Get-DnsClientServerAddress -InterfaceIndex $_.InterfaceIndex -AddressFamily IPv6).ServerAddresses; [PSCustomObject]@{ Name=$_.Name; Description=$_.InterfaceDescription; Index=$_.InterfaceIndex; DNS=$dns_v4; DNSv6=$dns_v6; Status=$_.Status } } | ConvertTo-Json -Compress"`

        exec(cmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error("Failed to get adapters:", error)
                console.error("Stderr:", stderr)
                resolve([])
                return
            }
            try {
                const adapters = JSON.parse(stdout || '[]')
                const result = Array.isArray(adapters) ? adapters : [adapters]
                console.log(`Found ${result.length} adapters`)
                resolve(result)
            } catch (e) {
                // console.error("Failed to parse adapter info. Raw stdout:", stdout) 
                // Too noisy
                resolve([])
            }
        })
    })
})

// Set DNS
ipcMain.handle('set-dns', async (_event, { adapterName, dns1, dns2, ipv6_1, ipv6_2, doh, mode }:
    { adapterName: string, dns1?: string, dns2?: string, ipv6_1?: string, ipv6_2?: string, doh?: boolean, mode: 'auto' | 'manual' }) => {

    // Create a temp log file to capture PowerShell output
    const logPath = path.join(os.tmpdir(), `zapret_dns_log_${Date.now()}.txt`)
    console.log(`Setting DNS for ${adapterName} (Logs: ${logPath})`)
    console.log(`v4: ${dns1}, ${dns2} | v6: ${ipv6_1}, ${ipv6_2} | DoH: ${doh}`)

    try {
        let psScript = ''
        const safeAdapterName = adapterName.replace(/'/g, "''")

        // Use Start-Transcript to capture ALL output (stdout/stderr) to a file
        psScript += `
        $ErrorActionPreference = 'Continue'
        Start-Transcript -Path '${logPath}' -Force
        
        Write-Output "Configuring adapter: ${safeAdapterName}"
        Write-Output "Mode: ${mode}"
        `

        if (mode === 'auto') {
            psScript += `Set-DnsClientServerAddress -InterfaceAlias '${safeAdapterName}' -ResetServerAddresses; Write-Output "Reset to DHCP."; `
        } else {
            // IPv4
            const addressesV4 = [dns1, dns2].filter(d => d && d.trim().length > 0).map(d => `'${d}'`).join(',')
            if (addressesV4.length > 0) {
                psScript += `Set-DnsClientServerAddress -InterfaceAlias '${safeAdapterName}' -ServerAddresses @(${addressesV4}); Write-Output "Set IPv4."; `
            }

            // IPv6
            // Basic validation: must contain ':' and no newlines
            const addressesV6 = [ipv6_1, ipv6_2]
                .filter(d => d && d.trim().length > 0 && d.includes(':'))
                .map(d => d!.trim().replace(/[\r\n]+/g, ''))

            if (addressesV6.length > 0) {

                // Ensure IPv6 protocol is enabled for this adapter
                psScript += `
                 Write-Output "Enabling IPv6..."
                 try {
                     $binding = Get-NetAdapterBinding -InterfaceAlias '${safeAdapterName}' -ComponentID ms_tcpip6
                    
                    # Force toggle to sync UI and Stack
                    Write-Output "Refreshing IPv6 stack (Disable/Enable)..."
                    Disable-NetAdapterBinding -InterfaceAlias '${safeAdapterName}' -ComponentID ms_tcpip6 -ErrorAction SilentlyContinue
                    Start-Sleep -Milliseconds 200
                    Enable-NetAdapterBinding -InterfaceAlias '${safeAdapterName}' -ComponentID ms_tcpip6
                    Write-Output "IPv6 Enabled. Waiting 2s for stack..."
                    Start-Sleep -Seconds 2
                    
                    # Double Check
                    $finalBinding = Get-NetAdapterBinding -InterfaceAlias '${safeAdapterName}' -ComponentID ms_tcpip6
                    if ($finalBinding.Enabled -ne $true) {
                         Write-Output "PowerShell failed to enable. Trying NETSH..."
                         netsh interface ipv6 set interface "${safeAdapterName}" admin=enabled
                         Start-Sleep -Seconds 1
                         
                         $finalCheck2 = Get-NetAdapterBinding -InterfaceAlias '${safeAdapterName}' -ComponentID ms_tcpip6
                         if ($finalCheck2.Enabled -ne $true) {
                            Write-Error "CRITICAL: IPv6 is STUCK disabled. Check driver/registry."
                         } else {
                            Write-Output "IPv6 Enabled via NETSH."
                         }
                    }
                 } catch {
                    Write-Error "Failed to refresh IPv6: $_"
                 }
                 `

                const v6String = addressesV6.map(d => `'${d}'`).join(',')

                // Pre-generate NETSH fallback commands (outside template to avoid syntax issues)
                const netshCommands = addressesV6.map((ip, index) => {
                    const action = index === 0 ? 'set' : 'add'
                    const validate = index === 0 ? '' : 'validate=no'
                    return `Write-Output "NETSH: Setting ${ip}..."; netsh interface ipv6 ${action} dns "${safeAdapterName}" static ${ip} ${validate}`
                }).join('\n')

                psScript += `
                Write-Output "Attempting Set-DnsClientServerAddress for IPv6..."
                try {
                   Set-DnsClientServerAddress -InterfaceAlias '${safeAdapterName}' -ServerAddresses @(${v6String}) -ErrorAction Continue
                } catch {
                   Write-Output "PowerShell Set API failed: $_"
                }
                
                # Check and Fallback
                $check = Get-DnsClientServerAddress -InterfaceAlias '${safeAdapterName}' -AddressFamily IPv6
                if ($check.ServerAddresses.Count -eq 0) {
                     Write-Output "PowerShell method failed to verify. Trying NETSH..."
                     ${netshCommands}
                     Write-Output "NETSH commands executed."
                } else {
                     Write-Output "IPv6 Applied successfully (Verified: $($check.ServerAddresses -join ', '))"
                }
                `
            }

            // DNS over HTTPS (DoH)
            if (doh) {
                // Only use IPv4 for DoH (IPv6 DoH requires ISP support which is uncommon)
                const cleanV4 = [dns1, dns2].filter(d => d && d.trim().length > 0).map(d => d!.trim())

                if (cleanV4.length > 0) {
                    psScript += `
                    Write-Output "Configuring DNS over HTTPS..."
                    
                    # DoH Template mapping function
                    function Get-DohTemplate {
                        param([string]$ip)
                        switch ($ip) {
                            # Google DNS
                            '8.8.8.8' { return 'https://dns.google/dns-query' }
                            '8.8.4.4' { return 'https://dns.google/dns-query' }
                            '2001:4860:4860::8888' { return 'https://dns.google/dns-query' }
                            '2001:4860:4860::8844' { return 'https://dns.google/dns-query' }
                            # Cloudflare DNS
                            '1.1.1.1' { return 'https://cloudflare-dns.com/dns-query' }
                            '1.0.0.1' { return 'https://cloudflare-dns.com/dns-query' }
                            '2606:4700:4700::1111' { return 'https://cloudflare-dns.com/dns-query' }
                            '2606:4700:4700::1001' { return 'https://cloudflare-dns.com/dns-query' }
                            # Quad9 DNS
                            '9.9.9.9' { return 'https://dns.quad9.net/dns-query' }
                            '149.112.112.112' { return 'https://dns.quad9.net/dns-query' }
                            '2620:fe::fe' { return 'https://dns.quad9.net/dns-query' }
                            '2620:fe::9' { return 'https://dns.quad9.net/dns-query' }
                            default { return 'https://dns.google/dns-query' }
                        }
                    }
                    
                    # Get adapter GUID
                    $adapter = Get-NetAdapter -Name '${safeAdapterName}' -ErrorAction SilentlyContinue
                    if ($adapter) {
                        $guid = $adapter.InterfaceGuid
                        Write-Output "Adapter GUID: $guid"
                    `

                    // Register DoH servers globally with correct templates (IPv4 only)
                    cleanV4.forEach(ip => {
                        psScript += `
                        # Register DoH template globally for ${ip}
                        try {
                            $template = Get-DohTemplate '${ip}'
                            Remove-DnsClientDohServerAddress -ServerAddress '${ip}' -ErrorAction SilentlyContinue
                            Add-DnsClientDohServerAddress -ServerAddress '${ip}' -DohTemplate $template -AutoUpgrade $true -AllowFallbackToUdp $true
                            Write-Output "Registered DoH server ${ip} with template: $template"
                        } catch {
                            Write-Warning "Failed to register DoH for ${ip}: $_"
                        }
                        `
                    })

                    // Now set per-interface registry with COMPLETE structure including DohTemplate
                    psScript += `
                        # Create complete DoH registry structure
                        $regBasePath = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Dnscache\\InterfaceSpecificParameters\\$guid"
                        
                        # Ensure base path exists
                        if (-not (Test-Path $regBasePath)) {
                            New-Item -Path $regBasePath -Force | Out-Null
                        }
                        
                        # Set EnableAutoDoh property (required!)
                        Set-ItemProperty -Path $regBasePath -Name 'EnableAutoDoh' -Value 2 -Type DWord -Force
                        Write-Output "Set EnableAutoDoh=2 for interface"
                        
                        # Create DohInterfaceSettings path
                        $dohSettingsPath = Join-Path $regBasePath 'DohInterfaceSettings'
                        if (-not (Test-Path $dohSettingsPath)) {
                            New-Item -Path $dohSettingsPath -Force | Out-Null
                        }
                        
                        # Create Doh subkey
                        $dohPath = Join-Path $dohSettingsPath 'Doh'
                        if (-not (Test-Path $dohPath)) {
                            New-Item -Path $dohPath -Force | Out-Null
                        }
                    `

                    // Set DoH for each IPv4 address
                    cleanV4.forEach(ip => {
                        psScript += `
                        # Configure DoH registry for ${ip}
                        $serverPath = Join-Path $dohPath '${ip}'
                        if (-not (Test-Path $serverPath)) {
                            New-Item -Path $serverPath -Force | Out-Null
                        }
                        
                        $template = Get-DohTemplate '${ip}'
                        
                        # DohFlags=1 means "automatic template" (use known template)
                        Set-ItemProperty -Path $serverPath -Name 'DohFlags' -Value 1 -Type QWord -Force
                        Set-ItemProperty -Path $serverPath -Name 'DohTemplate' -Value $template -Type String -Force
                        Write-Output "Set DohFlags=1 + DohTemplate for ${ip}"
                        `
                    })

                    psScript += `
                    } else {
                        Write-Warning "Could not find adapter"
                    }
                    
                    # Clear DNS cache
                    Write-Output "Clearing DNS cache..."
                    Clear-DnsClientCache
                    ipconfig /flushdns | Out-Null
                    
                    # Restart network adapter to force Windows to re-read DoH settings
                    Write-Output "Restarting network adapter to apply DoH..."
                    Disable-NetAdapter -Name '${safeAdapterName}' -Confirm:$false
                    Start-Sleep -Seconds 3
                    Enable-NetAdapter -Name '${safeAdapterName}' -Confirm:$false
                    Start-Sleep -Seconds 5
                    
                    # Final verification
                    Write-Output ""
                    Write-Output "========================================="
                    Write-Output "DoH Configuration Complete!"
                    Write-Output "========================================="
                    Write-Output ""
                    Write-Output "Registry settings applied:"
                    Write-Output "  - DohFlags = 2 (Manual Template)"
                    Write-Output "  - DohTemplate = [provider-specific URL]"
                    Write-Output ""
                    Write-Output "To verify DoH is working:"
                    Write-Output "  1. Open Wireshark with filter: udp.port == 53"
                    Write-Output "  2. Make DNS query: Resolve-DnsName google.com"
                    Write-Output "  3. If DoH works, NO packets should appear!"
                    Write-Output ""
                    `
                }
            }
        }

        psScript += `
        Stop-Transcript
        exit 0
        `

        // Write script to temp file
        const scriptPath = path.join(os.tmpdir(), `zapret_dns_script_${Date.now()}.ps1`)
        fs.writeFileSync(scriptPath, '\uFEFF' + psScript, { encoding: 'utf8' })

        // Execute with elevation
        const finalCmd = `powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '${scriptPath}'"`

        console.log(`Executing PowerShell script from: ${scriptPath}`)
        console.log(`Command: ${finalCmd}`)

        // Send initial log message to frontend
        const win = BrowserWindow.getAllWindows()[0]
        win?.webContents.send('log-output', `[DNS] Starting configuration for ${adapterName}...\n`)

        // Helper to read logs and cleanup
        const cleanup = () => {
            if (fs.existsSync(logPath)) {
                try {
                    const logs = fs.readFileSync(logPath, 'utf8')
                    console.log("DNS Logs captured:\n", logs)
                    win?.webContents.send('log-output', `[DNS] Execution Report: \n${logs}`)
                    fs.unlinkSync(logPath)
                } catch (err: any) {
                    console.error("Error reading log file:", err)
                    win?.webContents.send('log-output', `[DNS] Error reading log file: ${err.message}`)
                }
            } else {
                win?.webContents.send('log-output', `[DNS] Warning: No log file generated.Check logs manually.`)
            }

            // Cleanup script file
            if (fs.existsSync(scriptPath)) {
                // DEBUG: Keep file for user inspection
                // try { fs.unlinkSync(scriptPath) } catch { }
                console.log(`DEBUG: Script file kept at ${scriptPath}`)
            }
        }

        try {
            await new Promise<void>((resolve, _reject) => {
                exec(finalCmd, { encoding: 'utf8' }, (error, _stdout, _stderr) => {
                    if (error) {
                        console.error("DNS Change Exec Error:", error)
                        resolve()
                    } else {
                        resolve()
                    }
                })
            })
        } catch (e) {
            console.error("Exec Promise Error:", e)
        }

        cleanup()
        return { success: true }
    } catch (e: any) {
        console.error("DNS Handler Error:", e)
        return { success: false, message: e.message }
    }
})

// Autostart Status
ipcMain.handle('get-autostart-status', () => {
    return { enabled: app.getLoginItemSettings().openAtLogin }
})

// Toggle Autostart
ipcMain.handle('toggle-autostart', (_, enable: boolean) => {
    app.setLoginItemSettings({
        openAtLogin: enable,
        path: app.getPath('exe')
    })
    return { enabled: app.getLoginItemSettings().openAtLogin }
})
