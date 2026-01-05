
import { net } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import AdmZip from 'adm-zip'
import os from 'node:os'
import https from 'node:https'

export interface UpdateInfo {
    available: boolean
    version: string
    downloadUrl: string
    changelog: string
    currentVersion: string | null
}

const GITHUB_API_URL = 'https://api.github.com/repos/Flowseal/zapret-discord-youtube/releases/latest'

export class Updater {
    private projectRoot: string
    private tempDir: string
    private versionFilePath: string
    private logCallback: ((msg: string) => void) | null = null

    constructor(_currentVersion: string, projectRoot: string) {
        this.projectRoot = projectRoot
        this.tempDir = path.join(os.tmpdir(), 'zapret-update')
        this.versionFilePath = path.join(projectRoot, 'bin', 'zapret_version.txt')
    }

    public setLogCallback(callback: (msg: string) => void): void {
        this.logCallback = callback
    }

    private log(msg: string): void {
        console.log(`[Updater] ${msg}`)
        this.logCallback?.(`[Updater] ${msg}`)
    }

    private getInstalledVersion(): string | null {
        try {
            if (fs.existsSync(this.versionFilePath)) {
                return fs.readFileSync(this.versionFilePath, 'utf-8').trim()
            }
        } catch {
            // Ignore read errors
        }
        return null
    }

    private saveInstalledVersion(version: string): void {
        try {
            const dir = path.dirname(this.versionFilePath)
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }
            fs.writeFileSync(this.versionFilePath, version, 'utf-8')
        } catch (e) {
            console.error('Failed to save version info:', e)
        }
    }

    public async checkForUpdates(): Promise<UpdateInfo> {
        return new Promise((resolve, reject) => {
            const request = net.request({
                url: GITHUB_API_URL,
                headers: { 'User-Agent': 'Zapret-GUI-Updater' }
            })
            request.on('response', (response) => {
                let body = ''
                response.on('data', (chunk) => {
                    body += chunk.toString()
                })
                response.on('end', () => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to check for updates: ${response.statusCode}`))
                        return
                    }
                    try {
                        const data = JSON.parse(body)
                        const latestVersion = data.tag_name
                        const installedVersion = this.getInstalledVersion()

                        // Compare versions - update available if different or no version stored
                        const isUpdateAvailable = !installedVersion || installedVersion !== latestVersion

                        // Find the ZIP file in assets
                        const zipAsset = data.assets?.find((a: any) => a.name.endsWith('.zip'))
                        if (!zipAsset) {
                            reject(new Error('No ZIP file found in release assets'))
                            return
                        }

                        // Get changelog from release body
                        const changelog = data.body || 'No changelog provided'

                        resolve({
                            available: isUpdateAvailable,
                            version: latestVersion,
                            downloadUrl: zipAsset.browser_download_url,
                            changelog: changelog,
                            currentVersion: installedVersion
                        })
                    } catch (e) {
                        reject(e)
                    }
                })
            })
            request.on('error', (err) => {
                reject(err)
            })
            request.end()
        })
    }

    public async downloadAndInstall(url: string, version: string): Promise<void> {
        this.log(`Starting update to version ${version}`)
        this.log(`Project root: ${this.projectRoot}`)

        // 1. Download
        if (fs.existsSync(this.tempDir)) {
            fs.rmSync(this.tempDir, { recursive: true, force: true })
        }
        fs.mkdirSync(this.tempDir)

        const zipPath = path.join(this.tempDir, 'update.zip')
        this.log(`Downloading from: ${url}`)
        await this.downloadFile(url, zipPath)
        this.log(`Downloaded to: ${zipPath}`)

        // 2. Extract
        this.log('Extracting ZIP...')
        const zip = new AdmZip(zipPath)
        zip.extractAllTo(this.tempDir, true)

        // 3. Find extracted content - list all files for debugging
        const extractedItems = fs.readdirSync(this.tempDir)
        this.log(`Extracted items: ${extractedItems.join(', ')}`)

        // The Flowseal ZIP structure: files are inside a folder like "zapret-discord-youtube-1.9.2"
        let sourceRoot = this.tempDir

        // Find the root folder (should be a directory, not update.zip)
        const rootFolder = extractedItems.find(item => {
            const itemPath = path.join(this.tempDir, item)
            return fs.statSync(itemPath).isDirectory()
        })

        if (rootFolder) {
            sourceRoot = path.join(this.tempDir, rootFolder)
            this.log(`Found root folder: ${rootFolder}`)
        }

        // Check for bin folder
        const sourceBinPath = path.join(sourceRoot, 'bin')
        const sourceListsPath = path.join(sourceRoot, 'lists')

        this.log(`Looking for bin at: ${sourceBinPath}`)
        this.log(`Bin exists: ${fs.existsSync(sourceBinPath)}`)

        if (!fs.existsSync(sourceBinPath)) {
            // List contents of sourceRoot
            const rootContents = fs.readdirSync(sourceRoot)
            this.log(`Contents of ${sourceRoot}: ${rootContents.join(', ')}`)
            throw new Error(`Could not find bin folder in update. Path checked: ${sourceBinPath}`)
        }

        // 4. Copy bin files
        const destBinPath = path.join(this.projectRoot, 'bin')
        this.log(`Copying bin files: ${sourceBinPath} -> ${destBinPath}`)

        const binFiles = fs.readdirSync(sourceBinPath)
        this.log(`Bin files to copy: ${binFiles.join(', ')}`)

        this.copyFolderRecursive(sourceBinPath, destBinPath)
        this.log('Bin files copied successfully')

        // 5. Copy lists files
        if (fs.existsSync(sourceListsPath)) {
            const destListsPath = path.join(this.projectRoot, 'lists')
            this.log(`Copying lists files: ${sourceListsPath} -> ${destListsPath}`)
            this.copyFolderRecursive(sourceListsPath, destListsPath)
        }

        // 6. Copy .bat files
        const batFiles = fs.readdirSync(sourceRoot).filter(f => f.endsWith('.bat'))
        this.log(`BAT files to copy: ${batFiles.join(', ')}`)
        for (const batFile of batFiles) {
            const src = path.join(sourceRoot, batFile)
            const dest = path.join(this.projectRoot, batFile)
            if (fs.statSync(src).isFile()) {
                try {
                    fs.copyFileSync(src, dest)
                    this.log(`Copied: ${batFile}`)
                } catch (e) {
                    console.error(`Failed to copy ${batFile}:`, e)
                }
            }
        }

        // 7. Save installed version
        this.saveInstalledVersion(version)
        this.log(`Version ${version} saved`)

        // Cleanup
        fs.rmSync(this.tempDir, { recursive: true, force: true })
        this.log('Update completed successfully!')
    }

    private failedFiles: string[] = []

    private copyFolderRecursive(src: string, dest: string): void {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true })
        }

        const entries = fs.readdirSync(src, { withFileTypes: true })
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name)
            const destPath = path.join(dest, entry.name)

            if (entry.isDirectory()) {
                this.copyFolderRecursive(srcPath, destPath)
            } else {
                try {
                    if (fs.existsSync(destPath)) {
                        fs.unlinkSync(destPath)
                    }
                    fs.copyFileSync(srcPath, destPath)
                    this.log(`  Copied: ${entry.name}`)
                } catch (e: any) {
                    console.error(`Failed to copy ${entry.name}:`, e)
                    this.failedFiles.push(entry.name)

                    // Critical files that must be updated
                    const criticalFiles = ['winws.exe', 'WinDivert.dll', 'WinDivert64.sys']
                    if (criticalFiles.includes(entry.name)) {
                        throw new Error(`Cannot update ${entry.name}: ${e.code === 'EPERM' ? 'File is locked. Please stop zapret first!' : e.message}`)
                    }
                    // Non-critical files - log and continue
                }
            }
        }
    }

    private downloadFile(url: string, dest: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest)
            const request = https.get(url, { headers: { 'User-Agent': 'Zapret-GUI-Updater' } }, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Follow redirect
                    file.close()
                    this.downloadFile(response.headers.location!, dest).then(resolve).catch(reject)
                    return
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Download failed: ${response.statusCode}`))
                    return
                }

                response.pipe(file)
                file.on('finish', () => {
                    file.close()
                    resolve()
                })
            })

            request.on('error', (err) => {
                fs.unlink(dest, () => { })
                reject(err)
            })
        })
    }
}
