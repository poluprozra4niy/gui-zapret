import { useState, useEffect, useRef } from 'react'
import { Power, Search, LogOut, Minus, X, Sun, Moon, Save, Settings, Home, FileText } from 'lucide-react'
import clsx from 'clsx'
import { translations } from './translations'

// Define types for global API
declare global {
    interface Window {
        electronAPI: {
            startZapret: (args: string[]) => Promise<{ success: boolean; message?: string }>
            stopZapret: () => Promise<{ success: boolean }>
            windowControl: (action: 'minimize' | 'maximize' | 'close') => void
            openNetworkSettings: () => Promise<void>
            onLog: (callback: (data: string | { key: string, params?: Record<string, any> }) => void) => void
            onStatusChange: (callback: (status: string) => void) => void
            getPresets: () => Promise<any[]>
            checkConnectivity: () => Promise<{ success: boolean; error?: string; status?: number; details?: Record<string, boolean> }>
            showNotification: (title: string, body: string) => Promise<void>
            getAutostart: () => Promise<boolean>
            setAutostart: (enabled: boolean) => Promise<boolean>
            checkUpdates: () => Promise<{ success: boolean; available?: boolean; version?: string; downloadUrl?: string; message?: string; changelog?: string; currentVersion?: string | null }>
            installUpdate: (url: string, version: string) => Promise<{ success: boolean; message?: string }>
            saveLogs: (logs: string[]) => Promise<{ success: boolean; path?: string; message?: string }>
            runDiagnostics: () => Promise<{ success: boolean; results: Array<{ name: string; status: 'ok' | 'warning' | 'error'; message: string }> }>
            installService: (args: string[]) => Promise<{ success: boolean; message?: string }>
            removeService: () => Promise<{ success: boolean; message?: string }>
            getServiceStatus: () => Promise<{ installed: boolean; running: boolean; strategy: string | null }>
            runTests: (params?: { testType?: string, runMode?: string, selectedFiles?: string[] }) => Promise<{ success: boolean; message?: string }>
            toggleGameFilter: () => Promise<{ enabled: boolean }>
            getGameFilterStatus: () => Promise<{ enabled: boolean }>
            toggleIpset: () => Promise<{ status: string }>
            getIpsetStatus: () => Promise<{ status: string }>
            toggleAutostart: (enable: boolean) => Promise<{ enabled: boolean }>
            getAutostartStatus: () => Promise<{ enabled: boolean }>
            getStrategyFiles: () => Promise<string[]>
            getNetworkAdapters: () => Promise<Array<{ Name: string, Description: string, Index: number, DNS: string[], DNSv6?: string[] }>>
            setDns: (params: { adapterName: string, dns1?: string, dns2?: string, ipv6_1?: string, ipv6_2?: string, doh?: boolean, mode: 'auto' | 'manual' }) => Promise<{ success: boolean; message?: string }>
            removeListeners: () => void
        }
    }
}

// Default Presets
const DEFAULT_PRESETS = [
    {
        id: 'general_builtin',
        name: 'General (Built-in)',
        description: 'Standard strategy, works for most providers.',
        args: [
            '--wf-tcp=80,443,2053,2083,2087,2096,8443',
            '--wf-udp=443,19294-19344,50000-50100',
            '--filter-udp=443', '--hostlist=lists/list-general.txt', '--dpi-desync=fake', '--dpi-desync-repeats=6', '--dpi-desync-fake-quic=bin/quic_initial_www_google_com.bin', '--new',
            '--filter-udp=19294-19344,50000-50100', '--filter-l7=discord,stun', '--dpi-desync=fake', '--dpi-desync-fake-discord=bin/quic_initial_www_google_com.bin', '--new',
            '--filter-tcp=443', '--hostlist=lists/list-google.txt', '--dpi-desync=multisplit', '--dpi-desync-split-seqovl=681', '--new',
            '--filter-tcp=80,443', '--hostlist=lists/list-general.txt', '--dpi-desync=multisplit', '--dpi-desync-split-seqovl=568'
        ]
    }
]

function App() {
    const [isRunning, setIsRunning] = useState(false)
    const [logs, setLogs] = useState<string[]>([])
    const [presets, setPresets] = useState(DEFAULT_PRESETS)
    const [selectedPreset, setSelectedPreset] = useState(DEFAULT_PRESETS[0])
    const [isAutoScanning, setIsAutoScanning] = useState(false)
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'downloading'>('idle')
    const scanningRef = useRef(false)
    const failureCountRef = useRef(0)
    const logsEndRef = useRef<HTMLDivElement>(null)
    const hasInitialized = useRef(false)
    const [activeTab, setActiveTab] = useState<'main' | 'advanced' | 'license'>('main')
    const [serviceStatus, setServiceStatus] = useState<{ installed: boolean; running: boolean; strategy: string | null }>({ installed: false, running: false, strategy: null })
    const [gameFilterEnabled, setGameFilterEnabled] = useState(false)
    const [ipsetStatus, setIpsetStatus] = useState('none')
    const [autostartEnabled, setAutostartEnabled] = useState(false)
    const [showTestDialog, setShowTestDialog] = useState(false)
    const [testParams, setTestParams] = useState({
        testType: 'standard',
        runMode: 'all',
        selectedFiles: [] as string[]
    })
    const [strategyFiles, setStrategyFiles] = useState<string[]>([])
    const [lang, setLang] = useState<'ru' | 'en'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('lang') as 'ru' | 'en') || 'ru'
        }
        return 'ru'
        return 'ru'
    })
    const [adapters, setAdapters] = useState<Array<{ Name: string, Description: string, Index: number, DNS: string[], DNSv6?: string[] }>>([])
    const [selectedAdapter, setSelectedAdapter] = useState<{ Name: string, Description: string, Index: number, DNS: string[], DNSv6?: string[] } | null>(null)
    const [dns1, setDns1] = useState('')
    const [dns2, setDns2] = useState('')

    const t = translations[lang]

    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
        }
        return 'dark'
    })

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark'
        setTheme(newTheme)
        localStorage.setItem('theme', newTheme)
    }

    const toggleLang = () => {
        const newLang = lang === 'ru' ? 'en' : 'ru'
        setLang(newLang)
        localStorage.setItem('lang', newLang)
    }

    const formatLog = (content: string | { key: string, params?: Record<string, any> }) => {
        const timestamp = () => new Date().toLocaleTimeString('ru-RU', { hour12: false })

        if (typeof content === 'string') {
            return `[${timestamp()}] ${content}`
        }

        const { key, params } = content
        // @ts-ignore
        let message = t.logs[key] || key

        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                message = message.replace(`{${k}}`, String(v))
            })
        }

        return `[${timestamp()}] ${message}`
    }

    const addLog = (content: string | { key: string, params?: Record<string, any> }) => {
        setLogs(prev => [...prev, formatLog(content)])
    }

    useEffect(() => {
        const loadPresets = async () => {
            try {
                const fetched = await window.electronAPI.getPresets()
                if (fetched && fetched.length > 0) {
                    setPresets([...DEFAULT_PRESETS, ...fetched])
                }
            } catch (e) {
                console.error("Failed to load presets", e)
            }
        }
        loadPresets()

        window.electronAPI.onLog((data) => {
            try {
                if (typeof data === 'string' && data.startsWith('{') && data.endsWith('}')) {
                    const parsed = JSON.parse(data)
                    addLog(parsed)
                } else {
                    addLog(data)
                }
            } catch {
                addLog(data)
            }
        })

        window.electronAPI.onStatusChange((status) => {
            if (status === 'stopped') setIsRunning(false)
        })

        // Auto-check for updates on startup (only once)
        if (!hasInitialized.current) {
            hasInitialized.current = true
            const autoCheckUpdates = async () => {
                addLog({ key: 'checkingUpdates' })

                try {
                    const result = await window.electronAPI.checkUpdates()
                    if (result.success) {
                        if (result.available && result.downloadUrl) {
                            addLog({ key: 'updateAvailable', params: { version: result.version } })
                        } else {
                            addLog({ key: 'updateLatest', params: { version: result.version } })
                        }
                    } else {
                        addLog({ key: 'updateError', params: { message: result.message } })
                    }
                } catch (e: any) {
                    addLog({ key: 'updateCheckFailed' })
                    console.error('Auto-update check failed', e)
                }
            }
            autoCheckUpdates()

            // Check service status on startup
            const checkServiceStatus = async () => {
                try {
                    const status = await window.electronAPI.getServiceStatus()
                    setServiceStatus(status)
                    if (status.installed) {
                        if (status.running) {
                            setIsRunning(true)
                            if (status.strategy) {
                                addLog({ key: 'serviceStartedStrategy', params: { strategy: status.strategy } })
                            } else {
                                addLog({ key: 'serviceStarted' })
                            }
                        } else {
                            addLog({ key: 'serviceNotRunning' })
                        }
                    }
                } catch (e) {
                    console.error('Service status check failed', e)
                }
            }
            checkServiceStatus()

            // Check Game Filter status
            window.electronAPI.getGameFilterStatus().then(res => {
                setGameFilterEnabled(res.enabled)
            }).catch(console.error)

            // Check IPSet status
            window.electronAPI.getIpsetStatus().then(res => {
                setIpsetStatus(res.status)
            }).catch(console.error)

            // Check Autostart status
            window.electronAPI.getAutostartStatus().then(res => {
                setAutostartEnabled(res.enabled)
            }).catch(console.error)

            // Load Presets
            window.electronAPI.getPresets().then(fetchedPresets => {
                if (fetchedPresets && fetchedPresets.length > 0) {
                    setPresets(fetchedPresets)
                    setSelectedPreset(fetchedPresets[0])
                }
            }).catch(console.error)
        }

        return () => {
            window.electronAPI.removeListeners()
        }
    }, [])

    // Periodic Connectivity Check (every 30s)
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null

        if (isRunning) {
            intervalId = setInterval(async () => {
                // Don't run if auto-scanning is active to avoid log spam/conflicts
                if (isAutoScanning) return

                const check = await window.electronAPI.checkConnectivity()

                if (check.success) {
                    failureCountRef.current = 0
                    // Quiet success log or just details? User asked to "display in logs"
                    if (check.details) {
                        const details = Object.entries(check.details)
                            .map(([k, v]) => `${k}: ${v ? 'OK' : 'FAIL'}`)
                            .join(', ')
                        setLogs(prev => [...prev, `[Auto-Check] ${details}`])
                    } else {
                        setLogs(prev => [...prev, `[Auto-Check] Connectivity OK`])
                    }
                } else {
                    failureCountRef.current += 1

                    if (check.details) {
                        const details = Object.entries(check.details)
                            .map(([k, v]) => `${k}: ${v ? 'OK' : 'FAIL'}`)
                            .join(', ')
                        setLogs(prev => [...prev, `[Auto-Check] WARNING: ${details} (Strike ${failureCountRef.current}/2)`])
                    } else {
                        setLogs(prev => [...prev, `[Auto-Check] FAIL: ${check.error || 'Unknown'} (Strike ${failureCountRef.current}/2)`])
                    }

                    if (failureCountRef.current >= 2) {
                        setLogs(prev => [...prev, `[Auto-Recovery] 🚨 Connectivity lost! Starting auto-scan...`])
                        failureCountRef.current = 0
                        runAutoScan()
                    }
                }

            }, 30000) // 30 seconds
        }

        return () => {
            if (intervalId) clearInterval(intervalId)
        }
    }, [isRunning, isAutoScanning])

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [logs])

    const startWithPreset = async (preset: any, clearLogs = true) => {
        if (clearLogs) setLogs([])
        const result = await window.electronAPI.startZapret(preset.args)
        if (result.success) {
            setIsRunning(true)
            return true
        } else {
            setLogs(prev => [...prev, `Error: ${result.message}`])
            return false
        }
    }

    const toggleProcess = async () => {
        if (isRunning) {
            await window.electronAPI.stopZapret()
            setIsRunning(false)
            setIsAutoScanning(false)
            scanningRef.current = false
        } else {
            await startWithPreset(selectedPreset, true)
        }
    }

    const runAutoScan = async () => {
        if (scanningRef.current) {
            scanningRef.current = false
            setIsAutoScanning(false)
            return
        }

        scanningRef.current = true
        setIsAutoScanning(true)

        if (isRunning) {
            await window.electronAPI.stopZapret()
            setIsRunning(false)
        }

        for (const preset of presets) {
            if (!scanningRef.current) break

            setLogs(prev => [...prev, `--- Testing: ${preset.name} ---`])
            setSelectedPreset(preset)

            const started = await startWithPreset(preset, false)
            if (!started) {
                setLogs(prev => [...prev, `Failed to start ${preset.name}. Skipping...`])
                continue
            }

            for (let i = 0; i < 20; i++) {
                if (!scanningRef.current) break
                await new Promise(r => setTimeout(r, 100))
            }

            if (!scanningRef.current) break

            const check = await window.electronAPI.checkConnectivity()

            if (check.success) {
                // Log details if available
                if (check.details) {
                    const details = Object.entries(check.details)
                        .map(([k, v]) => `${k}: ${v ? 'OK' : 'FAIL'}`)
                        .join(', ')
                    setLogs(prev => [...prev, `Response: ${details}`])
                }

                setLogs(prev => [...prev, `SUCCESS! Working strategy: ${preset.name}`])
                window.electronAPI.showNotification('Zapret', `Стратегия: ${preset.name}`)
                scanningRef.current = false
                setIsAutoScanning(false)
                return
            } else {
                if (check.details) {
                    const details = Object.entries(check.details)
                        .map(([k, v]) => `${k}: ${v ? 'OK' : 'FAIL'}`)
                        .join(', ')
                    setLogs(prev => [...prev, `FAILED: ${details}`])
                } else {
                    setLogs(prev => [...prev, `FAILED: ${check.error || 'Unknown'}`])
                }
                await window.electronAPI.stopZapret()
                setIsRunning(false)
                await new Promise(r => setTimeout(r, 1000))
            }
        }

        scanningRef.current = false
        setIsAutoScanning(false)
        setLogs(prev => [...prev, `Сканирование завершено. Рабочая стратегия не найдена.`])
    }

    const checkForUpdates = async () => {
        if (updateStatus !== 'idle') return
        setUpdateStatus('checking')
        setLogs(prev => [...prev, 'Проверка обновлений...'])

        try {
            const result = await window.electronAPI.checkUpdates()
            if (!result.success) {
                setLogs(prev => [...prev, `Ошибка: ${result.message}`])
                setUpdateStatus('idle')
                return
            }

            const currentVer = result.currentVersion || 'не установлена'
            setLogs(prev => [...prev, `Текущая версия: ${currentVer}`])
            setLogs(prev => [...prev, `Последняя версия: ${result.version}`])

            if (result.available && result.downloadUrl) {
                setLogs(prev => [...prev, `--- Changelog ---\n${result.changelog || 'Нет данных'}\n---`])

                const doUpdate = confirm(`Доступна новая версия ${result.version}!\n\nТекущая: ${currentVer}\n\nУстановить?`)
                if (doUpdate) {
                    setUpdateStatus('downloading')
                    setLogs(prev => [...prev, 'Загрузка и установка...'])
                    const install = await window.electronAPI.installUpdate(result.downloadUrl, result.version!)
                    if (install.success) {
                        setLogs(prev => [...prev, 'Обновление установлено!'])
                        alert('Обновление завершено! Перезапустите приложение.')
                    } else {
                        setLogs(prev => [...prev, `Ошибка: ${install.message}`])
                    }
                }
            } else {
                setLogs(prev => [...prev, 'У вас последняя версия.'])
            }
        } catch (e: any) {
            setLogs(prev => [...prev, `Ошибка: ${e}`])
        } finally {
            setUpdateStatus('idle')
        }
    }

    return (
        <div className={clsx(
            "flex flex-col h-screen font-sans select-none transition-colors duration-300",
            theme === 'dark'
                ? "bg-gradient-to-br from-[#0c1929] via-[#0f1f35] to-[#0a1525] text-white"
                : "bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 text-slate-900"
        )}>

            {/* Title Bar */}
            <div className={clsx(
                "h-10 flex items-center justify-between px-4 draggable border-b",
                theme === 'dark' ? "border-white/5" : "border-slate-300"
            )}>
                <div className={clsx("text-sm font-medium", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>{t.appTitle}</div>
                <div className="flex items-center gap-1 no-drag">
                    {/* Language Toggle */}
                    <button
                        onClick={toggleLang}
                        className={clsx(
                            "w-8 h-8 flex items-center justify-center rounded transition-colors text-xs font-bold",
                            theme === 'dark' ? "hover:bg-white/10 text-slate-400" : "hover:bg-black/10 text-slate-600"
                        )}
                        title="Switch Language"
                    >
                        {lang.toUpperCase()}
                    </button>

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className={clsx(
                            "w-8 h-8 flex items-center justify-center rounded transition-colors",
                            theme === 'dark' ? "hover:bg-white/10" : "hover:bg-black/10"
                        )}
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark'
                            ? <Sun className="w-4 h-4 text-yellow-400" />
                            : <Moon className="w-4 h-4 text-slate-600" />
                        }
                    </button>
                    <div className={clsx("w-px h-4 mx-1", theme === 'dark' ? "bg-white/10" : "bg-slate-400")} />
                    <button
                        onClick={() => window.electronAPI.windowControl('minimize')}
                        className={clsx(
                            "w-8 h-8 flex items-center justify-center rounded transition-colors",
                            theme === 'dark' ? "hover:bg-white/10" : "hover:bg-black/10"
                        )}
                    >
                        <Minus className={clsx("w-4 h-4", theme === 'dark' ? "text-slate-400" : "text-slate-600")} />
                    </button>
                    <button
                        onClick={() => window.electronAPI.windowControl('close')}
                        className="w-8 h-8 flex items-center justify-center hover:bg-red-500/80 rounded transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400 hover:text-white" />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center px-8 py-6 overflow-hidden">

                {/* Header */}
                <div className="text-center mb-4">
                    <h1 className="text-4xl font-black tracking-tight">
                        <span className={theme === 'dark' ? "text-white" : "text-slate-800"}>ⲍⲁⲡⲣⲉⲧ</span>
                    </h1>
                    <p className={clsx("text-sm tracking-wide", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>{t.subtitle}</p>
                </div>

                {/* Tab Switcher */}
                <div className={clsx(
                    "flex gap-1 p-1 rounded-xl mb-6",
                    theme === 'dark' ? "bg-slate-800/50" : "bg-slate-200"
                )}>
                    <button
                        onClick={() => setActiveTab('main')}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                            activeTab === 'main'
                                ? theme === 'dark'
                                    ? "bg-slate-700 text-cyan-400"
                                    : "bg-white text-cyan-600 shadow"
                                : theme === 'dark'
                                    ? "text-slate-400 hover:text-white"
                                    : "text-slate-600 hover:text-slate-900"
                        )}
                    >
                        <Home className="w-4 h-4" />
                        {t.tabs.main}
                    </button>
                    <button
                        onClick={() => setActiveTab('advanced')}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                            activeTab === 'advanced'
                                ? theme === 'dark'
                                    ? "bg-slate-700 text-cyan-400"
                                    : "bg-white text-cyan-600 shadow"
                                : theme === 'dark'
                                    ? "text-slate-400 hover:text-white"
                                    : "text-slate-600 hover:text-slate-900"
                        )}
                    >
                        <Settings className="w-4 h-4" />
                        {t.tabs.advanced}
                    </button>
                    <button
                        onClick={() => setActiveTab('license')}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                            activeTab === 'license'
                                ? theme === 'dark'
                                    ? "bg-slate-700 text-cyan-400"
                                    : "bg-white text-cyan-600 shadow"
                                : theme === 'dark'
                                    ? "text-slate-400 hover:text-white"
                                    : "text-slate-600 hover:text-slate-900"
                        )}
                    >
                        <FileText className="w-4 h-4" />
                        {t.tabs.license}
                    </button>
                </div>

                {/* Main Tab Content */}
                {activeTab === 'main' && (
                    <div className="flex-1 w-full max-w-4xl flex flex-col gap-8 items-center overflow-hidden main-content">
                        {/* Main Controls Row */}
                        <div className="flex items-center gap-12">

                            {/* Power Button with Toggle */}
                            <div className="flex flex-col items-center gap-3">
                                {/* Service Running Indicator */}
                                {serviceStatus.running && (
                                    <div className={clsx(
                                        "px-3 py-1 rounded-full text-xs font-bold",
                                        theme === 'dark' ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-600"
                                    )}>
                                        {t.status.serviceRunning}
                                    </div>
                                )}

                                {/* Strategy Selector */}
                                <div className="relative group">
                                    <select
                                        value={selectedPreset?.id}
                                        onChange={(e) => {
                                            const preset = presets.find(p => p.id === e.target.value)
                                            if (preset) setSelectedPreset(preset)
                                        }}
                                        disabled={serviceStatus.running || isRunning}
                                        className={clsx(
                                            "appearance-none pl-4 pr-8 py-2 rounded-full text-sm font-bold text-center cursor-pointer transition-all outline-none border",
                                            theme === 'dark'
                                                ? "bg-slate-800 border-slate-700 text-slate-200 hover:border-cyan-500/50 focus:border-cyan-500"
                                                : "bg-white border-slate-300 text-slate-700 hover:border-cyan-500/50 focus:border-cyan-500",
                                            (serviceStatus.running || isRunning) && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        {presets.map(preset => (
                                            <option key={preset.id} value={preset.id}>
                                                {preset.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className={clsx(
                                        "absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none",
                                        theme === 'dark' ? "text-slate-500" : "text-slate-400"
                                    )}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </div>

                                {/* Power Button */}
                                <button
                                    onClick={toggleProcess}
                                    className={clsx(
                                        "relative w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500",
                                        "border-4 shadow-2xl",
                                        "before:absolute before:inset-0 before:rounded-full before:border-[3px] before:border-dashed before:opacity-20",
                                        serviceStatus.running && "cursor-not-allowed",
                                        isRunning
                                            ? theme === 'dark'
                                                ? "bg-gradient-to-br from-slate-800 to-slate-900 border-cyan-500/50 shadow-cyan-500/20 before:border-cyan-400 before:animate-spin-slow"
                                                : "bg-gradient-to-br from-white to-slate-100 border-cyan-500 shadow-cyan-500/30 before:border-cyan-400 before:animate-spin-slow"
                                            : theme === 'dark'
                                                ? "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-600/50 hover:border-cyan-500/30"
                                                : "bg-gradient-to-br from-white to-slate-100 border-slate-400 hover:border-cyan-500/50"
                                    )}
                                >
                                    <div className={clsx(
                                        "absolute inset-2 rounded-full border",
                                        theme === 'dark'
                                            ? "bg-gradient-to-br from-slate-700/50 to-slate-800/80 border-slate-600/30"
                                            : "bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300"
                                    )} />
                                    <Power className={clsx(
                                        "w-14 h-14 z-10 transition-all duration-300",
                                        isRunning
                                            ? "text-cyan-500 drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]"
                                            : theme === 'dark' ? "text-slate-400" : "text-slate-500"
                                    )} />
                                </button>


                            </div>

                            {/* Side Buttons */}
                            <div className="flex flex-col gap-4">
                                {/* Find Strategies Button */}
                                <button
                                    onClick={runAutoScan}
                                    disabled={isAutoScanning}
                                    className={clsx(
                                        "flex items-center justify-center gap-3 px-8 py-4 rounded-xl transition-all duration-300",
                                        "border shadow-lg",
                                        theme === 'dark'
                                            ? "bg-gradient-to-r from-slate-700/80 to-slate-800/80 border-slate-600/50 hover:border-cyan-500/30 hover:shadow-cyan-500/10"
                                            : "bg-gradient-to-r from-white to-slate-100 border-slate-300 hover:border-cyan-500/50 hover:shadow-cyan-500/20",
                                        isAutoScanning && "animate-pulse"
                                    )}
                                >
                                    <Search className={clsx("w-5 h-5", isAutoScanning ? "text-cyan-500 animate-spin" : theme === 'dark' ? "text-slate-300" : "text-slate-600")} />
                                    <span className={clsx("font-bold text-sm tracking-wide", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                        {isAutoScanning ? t.status.scanning : t.status.findStrategies}
                                    </span>
                                </button>

                                {/* Update Button */}
                                <button
                                    onClick={checkForUpdates}
                                    disabled={updateStatus !== 'idle'}
                                    className={clsx(
                                        "flex items-center justify-center gap-3 px-8 py-4 rounded-xl transition-all duration-300",
                                        "border shadow-lg",
                                        theme === 'dark'
                                            ? "bg-gradient-to-r from-slate-700/80 to-slate-800/80 border-slate-600/50 hover:border-cyan-500/30 hover:shadow-cyan-500/10"
                                            : "bg-gradient-to-r from-white to-slate-100 border-slate-300 hover:border-cyan-500/50 hover:shadow-cyan-500/20",
                                        updateStatus !== 'idle' && "opacity-70"
                                    )}
                                >
                                    <LogOut className={clsx("w-5 h-5 rotate-180", updateStatus === 'checking' && "animate-spin", theme === 'dark' ? "text-slate-300" : "text-slate-600")} />
                                    <span className={clsx("font-bold text-sm tracking-wide", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                        {updateStatus === 'downloading' ? t.status.installing : updateStatus === 'checking' ? t.status.checking : t.status.update}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Debug Console */}
                        <div className={clsx(
                            "w-full max-w-3xl flex-1 flex flex-col rounded-xl border overflow-hidden",
                            theme === 'dark'
                                ? "border-slate-700/50 bg-slate-900/50"
                                : "border-slate-300 bg-white/80"
                        )}>
                            <div className={clsx(
                                "px-4 py-2 border-b flex items-center justify-between",
                                theme === 'dark' ? "border-slate-700/50" : "border-slate-200"
                            )}>
                                <div className="flex items-center gap-2">
                                    <div className={clsx("w-2 h-2 rounded-full", isRunning ? "bg-green-500 animate-pulse" : "bg-slate-400")} />
                                    <span className={clsx("text-xs font-bold tracking-widest uppercase", theme === 'dark' ? "text-slate-500" : "text-slate-600")}>{t.status.debugConsole}</span>
                                </div>
                                <button
                                    onClick={async () => {
                                        const result = await window.electronAPI.saveLogs(logs)
                                        if (result.success) {
                                            const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                            setLogs(prev => [...prev, `[${timestamp}] Логи сохранены: ${result.path}`])
                                        }
                                    }}
                                    disabled={logs.length === 0}
                                    className={clsx(
                                        "p-1.5 rounded transition-colors",
                                        theme === 'dark'
                                            ? "hover:bg-white/10 text-slate-500 hover:text-cyan-400"
                                            : "hover:bg-slate-200 text-slate-400 hover:text-cyan-600",
                                        logs.length === 0 && "opacity-30 cursor-not-allowed"
                                    )}
                                    title="Сохранить логи"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                            </div>
                            <div className={clsx(
                                "flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed space-y-1",
                                theme === 'dark' ? "text-cyan-300/80" : "text-slate-700"
                            )}>
                                {logs.length === 0 && (
                                    <span className={theme === 'dark' ? "text-slate-500 italic" : "text-slate-400 italic"}>{t.status.waiting}</span>
                                )}
                                {logs.map((log, i) => (
                                    <div key={i} className={clsx(
                                        "whitespace-pre-wrap px-2 py-0.5 rounded transition-colors",
                                        theme === 'dark' ? "hover:bg-white/5" : "hover:bg-slate-100"
                                    )}>
                                        {log}
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Advanced Tab Content */}
                {activeTab === 'advanced' && (
                    <div className="w-full max-w-2xl flex-1 flex flex-col gap-4 overflow-y-auto tab-content pr-4">
                        <h2 className={clsx(
                            "text-xl font-bold",
                            theme === 'dark' ? "text-white" : "text-slate-800"
                        )}>
                            {t.advanced.title}
                        </h2>

                        {/* Placeholder buttons for future features */}
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <button
                                onClick={async () => {
                                    setActiveTab('main')
                                    await window.electronAPI.runDiagnostics()
                                }}
                                className={clsx(
                                    "p-4 rounded-xl border text-left transition-all hover:scale-[1.02] stagger-item",
                                    theme === 'dark'
                                        ? "bg-slate-800/50 border-slate-700 hover:border-cyan-500/50"
                                        : "bg-white border-slate-300 hover:border-cyan-500"
                                )}
                            >
                                <div className={clsx("font-bold mb-1", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                    {t.advanced.diagnostics.title}
                                </div>
                                <div className={clsx("text-xs", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
                                    {t.advanced.diagnostics.desc}
                                </div>
                            </button>

                            <button
                                onClick={async () => {
                                    setActiveTab('main')
                                    const status = await window.electronAPI.getServiceStatus()
                                    if (status.installed) {
                                        if (confirm('Сервис уже установлен. Удалить?')) {
                                            await window.electronAPI.removeService()
                                        }
                                    } else {
                                        await window.electronAPI.installService(selectedPreset.args)
                                    }
                                }}
                                className={clsx(
                                    "p-4 rounded-xl border text-left transition-all hover:scale-[1.02] stagger-item",
                                    theme === 'dark'
                                        ? "bg-slate-800/50 border-slate-700 hover:border-cyan-500/50"
                                        : "bg-white border-slate-300 hover:border-cyan-500"
                                )}
                            >
                                <div className={clsx("font-bold mb-1", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                    {t.advanced.installService.title}
                                </div>
                                <div className={clsx("text-xs", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
                                    {t.advanced.installService.desc}
                                </div>
                            </button>

                            <button
                                onClick={async () => {
                                    setActiveTab('main')
                                    const status = await window.electronAPI.getServiceStatus()
                                    if (status.installed) {
                                        await window.electronAPI.removeService()
                                    } else {
                                        const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                                        setLogs(prev => [...prev, `[${timestamp}] ⚠ Сервис не установлен`])
                                    }
                                }}
                                className={clsx(
                                    "p-4 rounded-xl border text-left transition-all hover:scale-[1.02] stagger-item",
                                    theme === 'dark'
                                        ? "bg-slate-800/50 border-slate-700 hover:border-red-500/50"
                                        : "bg-white border-slate-300 hover:border-red-500"
                                )}
                            >
                                <div className={clsx("font-bold mb-1", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                    {t.advanced.removeService.title}
                                </div>
                                <div className={clsx("text-xs", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
                                    {t.advanced.removeService.desc}
                                </div>
                            </button>

                            <button
                                onClick={async () => {
                                    const files = await window.electronAPI.getStrategyFiles()
                                    setStrategyFiles(files)
                                    setShowTestDialog(true)
                                }}
                                className={clsx(
                                    "p-4 rounded-xl border text-left transition-all hover:scale-[1.02] stagger-item",
                                    theme === 'dark'
                                        ? "bg-slate-800/50 border-slate-700 hover:border-purple-500/50"
                                        : "bg-white border-slate-300 hover:border-purple-500"
                                )}
                            >
                                <div className={clsx("font-bold mb-1", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                    {t.advanced.runTests.title}
                                </div>
                                <div className={clsx("text-xs", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
                                    {t.advanced.runTests.desc}
                                </div>
                            </button>

                            <button
                                onClick={async () => {
                                    const res = await window.electronAPI.toggleGameFilter()
                                    setGameFilterEnabled(res.enabled)
                                }}
                                className={clsx(
                                    "p-4 rounded-xl border text-left transition-all hover:scale-[1.02] stagger-item",
                                    theme === 'dark'
                                        ? "bg-slate-800/50 border-slate-700 hover:border-yellow-500/50"
                                        : "bg-white border-slate-300 hover:border-yellow-500"
                                )}
                            >
                                <div className={clsx("font-bold mb-1", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                    {t.advanced.gameFilter.title}: {gameFilterEnabled ? 'ON' : 'OFF'}
                                </div>
                                <div className={clsx("text-xs", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
                                    {gameFilterEnabled ? t.advanced.gameFilter.on : t.advanced.gameFilter.off}
                                </div>
                            </button>

                            <button
                                onClick={async () => {
                                    const res = await window.electronAPI.toggleIpset()
                                    setIpsetStatus(res.status)
                                }}
                                className={clsx(
                                    "p-4 rounded-xl border text-left transition-all hover:scale-[1.02] stagger-item",
                                    theme === 'dark'
                                        ? "bg-slate-800/50 border-slate-700 hover:border-blue-500/50"
                                        : "bg-white border-slate-300 hover:border-blue-500"
                                )}
                            >
                                <div className={clsx("font-bold mb-1", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                    {t.advanced.ipset.title}: {ipsetStatus.toUpperCase()}
                                </div>
                                <div className={clsx("text-xs", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
                                    {ipsetStatus === 'loaded' ? t.advanced.ipset.loaded : ipsetStatus === 'none' ? t.advanced.ipset.none : t.advanced.ipset.any}
                                </div>
                            </button>

                            <button
                                onClick={async () => {
                                    const res = await window.electronAPI.toggleAutostart(!autostartEnabled)
                                    setAutostartEnabled(res.enabled)
                                }}
                                className={clsx(
                                    "p-4 rounded-xl border text-left transition-all hover:scale-[1.02] stagger-item",
                                    theme === 'dark'
                                        ? "bg-slate-800/50 border-slate-700 hover:border-emerald-500/50"
                                        : "bg-white border-slate-300 hover:border-emerald-500"
                                )}
                            >
                                <div className={clsx("font-bold mb-1", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                    {t.advanced.autostart.title}: {autostartEnabled ? 'ON' : 'OFF'}
                                </div>
                                <div className={clsx("text-xs", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
                                    {autostartEnabled ? t.advanced.autostart.on : t.advanced.autostart.off}
                                </div>
                            </button>

                            <button
                                onClick={() => window.electronAPI.openNetworkSettings()}
                                className={clsx(
                                    "p-4 rounded-xl border text-left transition-all hover:scale-[1.02] stagger-item",
                                    theme === 'dark'
                                        ? "bg-slate-800/50 border-slate-700 hover:border-cyan-500/50"
                                        : "bg-white border-slate-300 hover:border-cyan-500"
                                )}
                            >
                                <div className={clsx("font-bold mb-1", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                    {t.advanced.networkSettings.title}
                                </div>
                                <div className={clsx("text-xs", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
                                    {t.advanced.networkSettings.desc}
                                </div>
                            </button>
                        </div>

                        {/* DNS Manager Section */}
                        <div className={clsx("mt-4 p-4 rounded-xl border space-y-4 dns-panel",
                            theme === 'dark' ? "bg-slate-800/50 border-slate-700" : "bg-white border-slate-300"
                        )}>
                            <div className={clsx("font-bold text-lg", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                {t.advanced.dnsManager.title}
                            </div>

                            {/* Adapter Selector */}
                            <div className="space-y-1">
                                <label className={clsx("text-xs uppercase font-bold tracking-wider", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                                    {t.advanced.dnsManager.selectAdapter}
                                </label>
                                <select
                                    className={clsx(
                                        "w-full p-2 rounded text-sm outline-none border transition-all",
                                        theme === 'dark'
                                            ? "bg-slate-900 border-slate-700 text-white focus:border-cyan-500"
                                            : "bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-500"
                                    )}
                                    onChange={(e) => {
                                        const adapter = adapters.find(a => a.Name === e.target.value)
                                        if (adapter) {
                                            setSelectedAdapter(adapter)
                                            setDns1(adapter.DNS?.[0] || '')
                                            setDns2(adapter.DNS?.[1] || '')
                                        }
                                    }}
                                    onClick={async () => {
                                        // Refresh adapters on click
                                        const list = await window.electronAPI.getNetworkAdapters()
                                        setAdapters(list)
                                        if (selectedAdapter) {
                                            const updated = list.find(a => a.Name === selectedAdapter.Name)
                                            if (updated) {
                                                setSelectedAdapter(updated)
                                            }
                                        } else if (list.length > 0 && !selectedAdapter) {
                                            // Select first if none selected
                                            setSelectedAdapter(list[0])
                                            setDns1(list[0].DNS?.[0] || '')
                                            setDns2(list[0].DNS?.[1] || '')
                                        }
                                    }}
                                >
                                    {adapters.length === 0 && <option>Scanning...</option>}
                                    {adapters.map(a => (
                                        <option key={a.Index} value={a.Name}>
                                            {a.Name} ({a.Description})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Current DNS Display */}
                            {selectedAdapter && (
                                <div className="text-xs space-y-1">
                                    <span className={theme === 'dark' ? "text-slate-400" : "text-slate-500"}>{t.advanced.dnsManager.currentDns} </span>
                                    <span className="font-mono bg-white/10 px-1 rounded">
                                        {selectedAdapter.DNS?.join(', ') || 'Auto (DHCP)'}
                                    </span>
                                </div>
                            )}

                            {/* IPv4 Inputs */}
                            <div className="space-y-1">
                                <label className={clsx("text-xs font-bold", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                                    {t.advanced.dnsManager.dnsV4}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="8.8.8.8"
                                        value={dns1}
                                        onChange={e => setDns1(e.target.value)}
                                        className={clsx(
                                            "p-2 rounded text-sm outline-none border transition-all",
                                            theme === 'dark' ? "bg-slate-900 border-slate-700 text-white focus:border-cyan-500" : "bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-500"
                                        )}
                                    />
                                    <input
                                        type="text"
                                        placeholder="8.8.4.4"
                                        value={dns2}
                                        onChange={e => setDns2(e.target.value)}
                                        className={clsx(
                                            "p-2 rounded text-sm outline-none border transition-all",
                                            theme === 'dark' ? "bg-slate-900 border-slate-700 text-white focus:border-cyan-500" : "bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-500"
                                        )}
                                    />
                                </div>
                            </div>



                            {/* Buttons */}
                            <div className="flex gap-2">
                                <button
                                    onClick={async () => {
                                        if (!selectedAdapter) return
                                        const res = await window.electronAPI.setDns({
                                            adapterName: selectedAdapter.Name,
                                            dns1,
                                            dns2,
                                            doh: true,
                                            mode: 'manual'
                                        })
                                        if (res.success) {
                                            alert(t.advanced.dnsManager.success)
                                            // Refresh
                                            const list = await window.electronAPI.getNetworkAdapters()
                                            setAdapters(list)
                                            const updated = list.find(a => a.Name === selectedAdapter.Name)
                                            if (updated) setSelectedAdapter(updated)
                                        } else {
                                            alert(t.advanced.dnsManager.error + ": " + res.message)
                                        }
                                    }}
                                    className={clsx(
                                        "flex-1 p-2 rounded font-bold text-sm transition-colors",
                                        theme === 'dark' ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-cyan-500 hover:bg-cyan-400 text-white"
                                    )}
                                >
                                    {t.advanced.dnsManager.apply}
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!selectedAdapter) return
                                        const res = await window.electronAPI.setDns({
                                            adapterName: selectedAdapter.Name,
                                            mode: 'auto'
                                        })
                                        if (res.success) {
                                            alert(t.advanced.dnsManager.success)
                                            // Refresh
                                            const list = await window.electronAPI.getNetworkAdapters()
                                            setAdapters(list)
                                            const updated = list.find(a => a.Name === selectedAdapter.Name)
                                            if (updated) setSelectedAdapter(updated)
                                        } else {
                                            alert(t.advanced.dnsManager.error + ": " + res.message)
                                        }
                                    }}
                                    className={clsx(
                                        "flex-1 p-2 rounded font-bold text-sm transition-colors",
                                        theme === 'dark' ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-slate-200 hover:bg-slate-300 text-slate-600"
                                    )}
                                >
                                    {t.advanced.dnsManager.resetDns}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'license' && (
                    /* License Tab Content */
                    <div className="flex-1 w-full max-w-4xl overflow-hidden flex flex-col tab-content">
                        <div className={clsx(
                            "flex-1 p-6 rounded-2xl border shadow-inner overflow-y-auto whitespace-pre-wrap font-mono text-xs custom-scrollbar license-content",
                            theme === 'dark' ? "bg-black/30 border-white/5 text-slate-300" : "bg-white border-slate-200 text-slate-700"
                        )}>
                            {t.license.content}
                        </div>
                    </div>
                )}
            </div>

            {showTestDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className={clsx(
                        "w-full max-w-lg rounded-2xl border shadow-2xl p-6 max-h-[90vh] flex flex-col",
                        theme === 'dark' ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
                    )}>
                        <h3 className="text-xl font-bold mb-4">{t.testDialog.title}</h3>

                        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                            {/* Test Type */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold uppercase tracking-wider opacity-70">{t.testDialog.testType}</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setTestParams(p => ({ ...p, testType: 'standard' }))}
                                        className={clsx(
                                            "p-3 rounded-xl border text-left transition-all",
                                            testParams.testType === 'standard'
                                                ? "border-cyan-500 ring-1 ring-cyan-500 bg-cyan-500/10"
                                                : theme === 'dark' ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                                        )}
                                    >
                                        <div className="font-bold">{t.testDialog.standard}</div>
                                        <div className="text-xs opacity-70">{t.testDialog.standardDesc}</div>
                                    </button>
                                    <button
                                        onClick={() => setTestParams(p => ({ ...p, testType: 'dpi' }))}
                                        className={clsx(
                                            "p-3 rounded-xl border text-left transition-all",
                                            testParams.testType === 'dpi'
                                                ? "border-cyan-500 ring-1 ring-cyan-500 bg-cyan-500/10"
                                                : theme === 'dark' ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"
                                        )}
                                    >
                                        <div className="font-bold">{t.testDialog.dpi}</div>
                                        <div className="text-xs opacity-70">{t.testDialog.dpiDesc}</div>
                                    </button>
                                </div>
                            </div>

                            {/* Run Mode */}
                            <div className="space-y-2">
                                <label className="text-sm font-semibold uppercase tracking-wider opacity-70">{t.testDialog.runMode}</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={testParams.runMode === 'all'}
                                            onChange={() => setTestParams(p => ({ ...p, runMode: 'all' }))}
                                            className="w-4 h-4 text-cyan-500"
                                        />
                                        <span>{t.testDialog.allStrategies}</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={testParams.runMode === 'select'}
                                            onChange={() => setTestParams(p => ({ ...p, runMode: 'select' }))}
                                            className="w-4 h-4 text-cyan-500"
                                        />
                                        <span>{t.testDialog.selectManual}</span>
                                    </label>
                                </div>
                            </div>

                            {/* File Selection */}
                            {testParams.runMode === 'select' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold uppercase tracking-wider opacity-70">{t.testDialog.selectFiles}</label>
                                    <div className={clsx(
                                        "border rounded-xl p-2 max-h-48 overflow-y-auto space-y-1",
                                        theme === 'dark' ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50"
                                    )}>
                                        {strategyFiles.length === 0 ? (
                                            <div className="text-sm p-2 opacity-50">{t.testDialog.noStrategies}</div>
                                        ) : (
                                            strategyFiles.map(file => (
                                                <label key={file} className={clsx(
                                                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                                                    theme === 'dark' ? "hover:bg-white/5" : "hover:bg-slate-200"
                                                )}>
                                                    <input
                                                        type="checkbox"
                                                        checked={testParams.selectedFiles.includes(file)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setTestParams(p => ({ ...p, selectedFiles: [...p.selectedFiles, file] }))
                                                            } else {
                                                                setTestParams(p => ({ ...p, selectedFiles: p.selectedFiles.filter(f => f !== file) }))
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded text-cyan-500 bg-transparent border-slate-500"
                                                    />
                                                    <span className="text-sm font-mono">{file}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700/20">
                            <button
                                onClick={() => setShowTestDialog(false)}
                                className={clsx(
                                    "flex-1 py-2 rounded-lg font-medium transition-colors",
                                    theme === 'dark' ? "hover:bg-white/5" : "hover:bg-slate-100"
                                )}
                            >
                                {t.testDialog.cancel}
                            </button>
                            <button
                                onClick={async () => {
                                    setShowTestDialog(false)
                                    setActiveTab('main')
                                    await window.electronAPI.runTests(testParams)
                                }}
                                disabled={testParams.runMode === 'select' && testParams.selectedFiles.length === 0}
                                className={clsx(
                                    "flex-1 py-2 rounded-lg font-bold bg-cyan-500 text-white hover:bg-cyan-400 transition-all",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                            >
                                {t.testDialog.start}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


export default App
