import React from 'react'
import { Power, ChevronDown, RotateCw, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

interface ControlPanelProps {
    isRunning: boolean
    toggleProcess: () => void
    selectedPreset: any
    presets: any[]
    onSelectPreset: (preset: any) => void
    isAutoScanning: boolean
    runAutoScan: () => void
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ isRunning, toggleProcess, selectedPreset, presets, onSelectPreset, isAutoScanning, runAutoScan }) => {
    const [isOpen, setIsOpen] = React.useState(false)

    return (
        <div className="flex flex-col items-center gap-10 z-10 w-full max-w-sm animate-float">

            {/* Header / Status Hint */}
            <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                    {isRunning ? 'Protection Active' : 'System Ready'}
                </h2>
                <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
                    {isRunning ? 'Traffic is being filtered' : 'Select a strategy to start'}
                </p>
            </div>

            <div className="relative group flex items-center justify-center">

                {/* Main Power Button Container */}
                <div className="relative">
                    {/* Ring Glow Effect */}
                    <div className={clsx("absolute -inset-4 rounded-full blur-2xl opacity-20 transition-all duration-1000",
                        isRunning ? "bg-emerald-500 animate-pulse-glow" : "bg-cyan-500 group-hover:opacity-40"
                    )}></div>

                    <button
                        onClick={toggleProcess}
                        className={clsx("relative w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 border-[6px] shadow-2xl overflow-hidden group",
                            isRunning
                                ? "bg-slate-900 border-emerald-500/50 shadow-emerald-500/20"
                                : "bg-slate-900/80 border-slate-700 hover:border-cyan-500/50 hover:shadow-cyan-500/20"
                        )}
                    >
                        {/* Background sheen */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <Power className={clsx("w-12 h-12 transition-all duration-500 z-10",
                            isRunning
                                ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)] scale-110"
                                : "text-slate-500 group-hover:text-cyan-400 group-hover:scale-105"
                        )} />
                    </button>

                    {/* Status Badge (Small) */}
                    <div className={clsx("absolute bottom-0 right-2 w-8 h-8 rounded-full border-4 border-slate-900 flex items-center justify-center transition-all duration-300",
                        isRunning ? "bg-emerald-500 text-slate-900" : "bg-slate-700 text-slate-400"
                    )}>
                        {isRunning ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-slate-400" />}
                    </div>
                </div>

                {/* Auto Scan Button (Floating to the right) */}
                <div className="absolute left-[8.5rem] top-1/2 -translate-y-1/2">
                    <button
                        onClick={runAutoScan}
                        disabled={isRunning && !isAutoScanning}
                        className={clsx("flex items-center gap-3 px-4 py-2 rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm transition-all duration-300 group/scan disabled:opacity-30 disabled:cursor-not-allowed",
                            !isRunning && !isAutoScanning && "hover:bg-white/10 hover:border-cyan-500/30 hover:-translate-x-1"
                        )}
                    >
                        <div className={clsx("transition-transform duration-700", isAutoScanning && "animate-spin-slow")}>
                            <RotateCw className={clsx("w-4 h-4", isAutoScanning ? "text-cyan-400" : "text-slate-400 group-hover/scan:text-cyan-400")} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover/scan:text-cyan-100">
                            {isAutoScanning ? 'Scanning...' : 'Auto Fix'}
                        </span>
                    </button>
                </div>
            </div>

            {/* Preset Selector */}
            <div className="w-full relative px-4">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Strategy</label>
                    <span className="text-[10px] text-slate-600">{presets.length} Available</span>
                </div>

                {/* Dropdown Trigger */}
                <div
                    onClick={() => !isRunning && setIsOpen(!isOpen)}
                    className={clsx("glass-panel p-1 pr-4 flex items-center cursor-pointer transition-all duration-300",
                        isRunning ? "opacity-60 cursor-not-allowed grayscale-[0.5]" : "hover:bg-white/10 hover:border-cyan-500/30",
                        isOpen ? "rounded-b-none border-b-0" : ""
                    )}
                >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-white/5 mr-3">
                        <div className="text-xs font-bold text-cyan-500">#{presets.indexOf(selectedPreset) + 1}</div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-bold text-slate-200 truncate">{selectedPreset.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{selectedPreset.description}</div>
                    </div>
                    <ChevronDown className={clsx("w-4 h-4 text-slate-500 transition-transform duration-300", isOpen && "rotate-180 text-cyan-400")} />
                </div>

                {/* Dropdown Options */}
                {isOpen && (
                    <div className="absolute top-full left-4 right-4 glass-panel rounded-t-none border-t-0 bg-[#0f172a]/95 backdrop-blur-xl z-50 max-h-60 overflow-y-auto shadow-2xl animate-in slide-in-from-top-2 duration-200">
                        {presets.map((preset, idx) => (
                            <div
                                key={preset.id}
                                onClick={() => {
                                    onSelectPreset(preset)
                                    setIsOpen(false)
                                }}
                                className={clsx("px-4 py-3 cursor-pointer transition-all border-l-2 flex items-center gap-3 group/item",
                                    selectedPreset.id === preset.id
                                        ? "bg-cyan-500/10 border-cyan-500"
                                        : "border-transparent hover:bg-white/5 hover:border-slate-600"
                                )}
                            >
                                <span className={clsx("text-[10px] font-mono", selectedPreset.id === preset.id ? "text-cyan-400" : "text-slate-600")}>
                                    {(idx + 1).toString().padStart(2, '0')}
                                </span>
                                <div>
                                    <div className={clsx("text-sm font-bold transition-colors", selectedPreset.id === preset.id ? "text-cyan-100" : "text-slate-400 group-hover/item:text-slate-200")}>{preset.name}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
