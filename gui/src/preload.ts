import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    startZapret: (args: string[]) => ipcRenderer.invoke('start-zapret', args),
    stopZapret: () => ipcRenderer.invoke('stop-zapret'),
    windowControl: (action: 'minimize' | 'maximize' | 'close') => ipcRenderer.invoke('window-control', action),
    onLog: (callback: (data: string) => void) => ipcRenderer.on('log-output', (_, data) => {
        console.log('[Preload] log-output received:', data)
        callback(data)
    }),
    onStatusChange: (callback: (status: string) => void) => ipcRenderer.on('process-status', (_, status) => callback(status)),
    getPresets: () => ipcRenderer.invoke('get-presets'),
    checkConnectivity: () => ipcRenderer.invoke('check-connectivity'),
    showNotification: (title: string, body: string) => ipcRenderer.invoke('show-notification', { title, body }),
    getAutostart: () => ipcRenderer.invoke('get-autostart'),
    setAutostart: (enabled: boolean) => ipcRenderer.invoke('set-autostart', enabled),
    checkUpdates: () => ipcRenderer.invoke('check-updates'),
    installUpdate: (url: string, version: string) => ipcRenderer.invoke('install-update', url, version),
    saveLogs: (logs: string[]) => ipcRenderer.invoke('save-logs', logs),
    runDiagnostics: () => ipcRenderer.invoke('run-diagnostics'),
    installService: (args: string[]) => ipcRenderer.invoke('install-service', args),
    removeService: () => ipcRenderer.invoke('remove-service'),
    getServiceStatus: () => ipcRenderer.invoke('get-service-status'),
    runTests: (params?: { testType?: string, runMode?: string, selectedFiles?: string[] }) => ipcRenderer.invoke('run-tests', params),
    getStrategyFiles: () => ipcRenderer.invoke('get-strategy-files'),
    toggleGameFilter: () => ipcRenderer.invoke('toggle-game-filter'),
    getGameFilterStatus: () => ipcRenderer.invoke('get-game-filter-status'),
    toggleAutostart: (enable: boolean) => ipcRenderer.invoke('toggle-autostart', enable),
    getAutostartStatus: () => ipcRenderer.invoke('get-autostart-status'),
    toggleIpset: () => ipcRenderer.invoke('toggle-ipset'),
    getIpsetStatus: () => ipcRenderer.invoke('get-ipset-status'),
    openNetworkSettings: () => ipcRenderer.invoke('open-network-settings'),
    getNetworkAdapters: () => ipcRenderer.invoke('get-network-adapters'),
    setDns: (params: { adapterName: string, dns1?: string, dns2?: string, ipv6_1?: string, ipv6_2?: string, doh?: boolean, mode: 'auto' | 'manual' }) => ipcRenderer.invoke('set-dns', params),
    removeListeners: () => {
        ipcRenderer.removeAllListeners('log-output')
        ipcRenderer.removeAllListeners('process-status')
    }
})
