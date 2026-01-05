import fs from 'node:fs'
import path from 'node:path'

export interface Preset {
    id: string
    name: string
    description: string
    args: string[]
}

export class PresetManager {
    private rootDir: string

    constructor(rootDir: string) {
        this.rootDir = rootDir
    }

    public async scanPresets(): Promise<Preset[]> {
        const presets: Preset[] = []

        try {
            const files = fs.readdirSync(this.rootDir)
            const batFiles = files.filter(f => f.endsWith('.bat') && !f.includes('service') && !f.includes('blockcheck'))

            for (const file of batFiles) {
                const filePath = path.join(this.rootDir, file)
                const content = fs.readFileSync(filePath, 'utf-8')
                const preset = this.parseBatFile(file, content)
                if (preset) {
                    presets.push(preset)
                }
            }
        } catch (error) {
            console.error('Failed to scan presets:', error)
        }

        return presets
    }

    private parseBatFile(filename: string, content: string): Preset | null {
        // 1. Normalize content: remove CR, join multi-line commands (ending with ^)
        const normalized = content
            .replace(/\r/g, '')
            .split('\n')
            .reduce((acc, line) => {
                const trimmed = line.trim()
                if (acc.length > 0 && acc[acc.length - 1].endsWith('^')) {
                    acc[acc.length - 1] = acc[acc.length - 1].slice(0, -1) + trimmed
                } else {
                    acc.push(trimmed)
                }
                return acc
            }, [] as string[])
            .join(' ')

        // 2. Find the winws.exe execution line
        const match = normalized.match(/winws\.exe"\s+(.+)/i)
        if (!match) return null

        const rawArgs = match[1]

        // 3. Tokenize arguments, handling quotes
        const args: string[] = []
        let currentArg = ''
        let inQuote = false

        for (let i = 0; i < rawArgs.length; i++) {
            const char = rawArgs[i]
            if (char === '"') {
                inQuote = !inQuote
                // Keep keeping quotes might be necessary for paths, 
                // but child_process.spawn usually handles unquoted paths better if passed as array.
                // For now, let's STRIP quotes if they wrap the whole argument, but logic here is simple splitting.
                // Actually, simple split by space is not enough due to quotes.
                // Let's implement simple parser.
            }

            if (char === ' ' && !inQuote) {
                if (currentArg.length > 0) {
                    args.push(this.cleanArg(currentArg))
                    currentArg = ''
                }
            } else {
                currentArg += char
            }
        }
        if (currentArg.length > 0) args.push(this.cleanArg(currentArg))

        // 4. Generate metadata
        const name = filename.replace('.bat', '').replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

        return {
            id: filename,
            name: name,
            description: `Imported from ${filename}`,
            args: args
        }
    }

    private cleanArg(arg: string): string {
        // Replace %BIN% and %LISTS% variables
        // in .bat: %~dp0bin\ -> bin/
        let cleaned = arg
            .replace(/%BIN%/g, 'bin/')
            .replace(/%LISTS%/g, 'lists/')
            .replace(/%GameFilter%/g, '12') // Default to port 12 (disabled state)
            .replace(/"/g, '') // remove quotes for spawn args

        // Handle list-general.txt -> lists/list-general.txt (if prefix missing)
        // But the bat file usually has %LISTS% prefix.

        return cleaned
    }
}
