'use client'

import { Volume2, VolumeX, Mic, MicOff } from 'lucide-react'
import { useState } from 'react'

interface AudioControlsProps {
  isMuted: boolean
  onToggleMute: () => void
  onMasterVolume: (v: number) => void
  onMusicVolume: (v: number) => void
  onSFXVolume: (v: number) => void
}

export function AudioControls({
  isMuted,
  onToggleMute,
  onMasterVolume,
  onMusicVolume,
  onSFXVolume,
}: AudioControlsProps) {
  const [open, setOpen] = useState(false)
  const [narratorEnabled, setNarratorEnabled] = useState(true)

  return (
    <div className="fixed bottom-20 right-4 z-40 sm:bottom-6 font-mono">
      {/* Expandable panel */}
      {open && (
        <div className="mb-2 w-52 border border-red-500/20 bg-black/85 backdrop-blur-md p-4 shadow-[0_0_20px_rgba(127,29,29,0.3)]">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-red-500/50" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-red-500/50" />

          <div className="text-[9px] font-bold tracking-[0.3em] text-red-500/70 uppercase mb-4">
            audio_config
          </div>

          <div className="space-y-3">
            <VolumeSlider
              label="master"
              defaultValue={0.82}
              onChange={onMasterVolume}
            />
            <VolumeSlider
              label="música"
              defaultValue={0.65}
              onChange={onMusicVolume}
            />
            <VolumeSlider
              label="efectos"
              defaultValue={1}
              onChange={onSFXVolume}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-red-500/10">
            <button
              onClick={() => setNarratorEnabled(v => !v)}
              className="flex items-center gap-2 w-full text-left group"
            >
              {narratorEnabled
                ? <Mic className="h-3 w-3 text-cyan-400" />
                : <MicOff className="h-3 w-3 text-slate-600" />}
              <span className={`text-[9px] tracking-[0.2em] uppercase transition-colors ${
                narratorEnabled ? 'text-cyan-300' : 'text-slate-600'
              }`}>
                narrador_{narratorEnabled ? 'on' : 'off'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex h-8 w-8 items-center justify-center border border-red-500/20 bg-black/80 backdrop-blur-md text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-all"
          aria-label="Audio settings"
        >
          <span className="text-[10px] font-bold tracking-widest">
            {open ? '▾' : '♪'}
          </span>
        </button>

        <button
          onClick={onToggleMute}
          className={`flex h-8 w-8 items-center justify-center border bg-black/80 backdrop-blur-md transition-all ${
            isMuted
              ? 'border-slate-700/40 text-slate-600'
              : 'border-red-500/20 text-slate-400 hover:text-red-400 hover:border-red-500/50'
          }`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted
            ? <VolumeX className="h-3.5 w-3.5" />
            : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}

function VolumeSlider({
  label,
  defaultValue,
  onChange,
}: {
  label: string
  defaultValue: number
  onChange: (v: number) => void
}) {
  const [value, setValue] = useState(defaultValue)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setValue(v)
    onChange(v)
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[8px] uppercase tracking-[0.2em] text-slate-500">{label}</span>
        <span className="text-[8px] text-red-400/70 font-bold">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={handleChange}
        className="w-full h-1 appearance-none cursor-pointer bg-red-950/40 rounded-none
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:bg-red-500
          [&::-webkit-slider-thumb]:border
          [&::-webkit-slider-thumb]:border-red-300
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-3
          [&::-moz-range-thumb]:h-3
          [&::-moz-range-thumb]:bg-red-500
          [&::-moz-range-thumb]:border-none
          [&::-moz-range-thumb]:cursor-pointer"
        style={{
          background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${value * 100}%, #1f0a0a ${value * 100}%, #1f0a0a 100%)`,
        }}
      />
    </div>
  )
}