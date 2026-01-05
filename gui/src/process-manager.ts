import { spawn, ChildProcess, exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { BrowserWindow } from 'electron'

export class ProcessManager {
    private process: ChildProcess | null = null
    private window: BrowserWindow | null = null

    constructor(mainWindow: BrowserWindow) {
        this.window = mainWindow
    }

    public start(exePath: string, args: string[]): { success: boolean; message?: string } {
        if (this.process) {
            return { success: false, message: 'Process already running' }
        }

        if (!fs.existsSync(exePath)) {
            return { success: false, message: `Executable not found at ${exePath}` }
        }

        try {
            console.log('Launching:', exePath, args)
            // Set CWD to project root (../ from bin/) so 'lists/' args work
            const projectRoot = path.dirname(path.dirname(exePath))
            this.process = spawn(exePath, args, {
                windowsHide: true,
                cwd: projectRoot
            })

            this.process.stdout?.on('data', (data) => {
                this.window?.webContents.send('log-output', data.toString())
            })

            this.process.stderr?.on('data', (data) => {
                this.window?.webContents.send('log-output', data.toString())
            })

            this.process.on('error', (err) => {
                console.error('Failed to start process:', err)
                this.window?.webContents.send('log-output', `FATAL ERROR: ${err.message}`)
                this.process = null
                this.window?.webContents.send('process-status', 'stopped')
            })

            this.process.on('close', (code) => {
                console.log(`Zapret process exited with code ${code}`)
                this.process = null
                this.window?.webContents.send('process-status', 'stopped')
            })

            return { success: true }
        } catch (e: any) {
            return { success: false, message: e.message }
        }
    }

    public stop(): { success: boolean } {
        if (this.process) {
            this.process.kill()
            this.process = null
            // Status update handled by 'close' event
        }
        return { success: true }
    }

    /**
     * Force stop all winws processes and unload WinDivert driver
     * Required before updating WinDivert files
     */
    public async forceStopAll(): Promise<{ success: boolean }> {
        // First stop our managed process
        this.stop()

        // Wait a bit for process to terminate
        await new Promise(r => setTimeout(r, 500))

        // Kill any remaining winws.exe processes
        await this.runCommand('taskkill /F /IM winws.exe')

        // Wait for process to fully terminate
        await new Promise(r => setTimeout(r, 1000))

        // Stop and delete WinDivert driver service if loaded
        await this.runCommand('sc stop WinDivert')
        await new Promise(r => setTimeout(r, 500))
        await this.runCommand('sc delete WinDivert')

        // Also try WinDivert14 (different versions use different names)
        await this.runCommand('sc stop WinDivert14')
        await new Promise(r => setTimeout(r, 500))
        await this.runCommand('sc delete WinDivert14')

        // Wait for driver to fully unload
        await new Promise(r => setTimeout(r, 1000))

        return { success: true }
    }

    private runCommand(cmd: string): Promise<void> {
        return new Promise((resolve) => {
            exec(cmd, (error) => {
                if (error) {
                    console.log(`Command "${cmd}" finished with error (may be expected):`, error.message)
                }
                resolve()
            })
        })
    }

    public isRunning(): boolean {
        return !!this.process
    }
}
