'use client'

import type { Player, Level, Dialogue } from '@/lib/game-types'
import { useEffect, useState } from 'react'

interface GameUIProps {
  player: Player
  level: Level
  currentDialogue: Dialogue | null
  onAdvanceDialogue: () => void
  onSelectChoice?: (index: number) => void
  totalTapes: number
  memoriesCount: number
  detectionCount?: number
  codeInput?: string
  showKeypad?: boolean
  onSubmitCode?: (code: string) => void
  showInventory?: boolean
  onCloseInventory?: () => void
  activeValve?: string | null
  valveValues?: Record<string, number>
  onValveChange?: (valveId: string, value: number) => void
  onSubmitValves?: () => void
}

export function GameUI({ 
  player, 
  level, 
  currentDialogue, 
  onAdvanceDialogue, 
  onSelectChoice,
  totalTapes, 
  memoriesCount,
  detectionCount = 0,
  codeInput = '',
  showKeypad = false,
  onSubmitCode,
  showInventory = false,
  onCloseInventory,
  activeValve,
  valveValues = {},
  onValveChange,
  onSubmitValves,
}: GameUIProps) {
  const [typedText, setTypedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const isStealthLevel = level.hidingSpots.length > 0
  const isDarkLevel = Boolean(level.isDark && !level.lightsOn)
  const puzzle = level.puzzles[0]

  // Typewriter effect for dialogue
  useEffect(() => {
    if (currentDialogue) {
      setIsTyping(true)
      setTypedText('')
      let index = 0
      const text = currentDialogue.text
      
      const interval = setInterval(() => {
        if (index < text.length) {
          setTypedText(text.slice(0, index + 1))
          index++
        } else {
          setIsTyping(false)
          clearInterval(interval)
        }
      }, 30)
      
      return () => clearInterval(interval)
    }
  }, [currentDialogue])

  const statCards = [
    {
      label: 'HP',
      value: player.health,
      color: '#ef4444',
      glowClass: 'text-glow-red',
    },
    {
      label: 'SAN',
      value: player.sanity,
      color: '#a855f7',
      glowClass: 'text-glow-purple',
    },
    {
      label: 'STM',
      value: player.stamina,
      color: '#eab308',
      glowClass: 'text-glow-yellow',
    },
  ]

  return (
    <div className="absolute inset-0 pointer-events-none font-mono overflow-hidden">
      {/* HUD - Top Bar: System ID & Status */}
      <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-black/80 to-transparent flex items-center px-6 justify-between border-b border-red-900/20 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_#ef4444]" />
            <div className="text-red-600 text-[10px] font-bold tracking-[0.4em]">SYSTEM_REC</div>
          </div>
          <div className="h-3 w-[1px] bg-red-900/40" />
          <div className="text-gray-500 text-[9px] tracking-widest uppercase flex gap-2">
            <span>Kernel_v8.4.1</span>
            <span className="opacity-30">|</span>
            <span className="animate-pulse">{Math.random().toString(16).slice(2, 8).toUpperCase()}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <div className="text-gray-400 text-[10px] font-bold tracking-widest">00:{Math.floor(Date.now() / 60000 % 60).toString().padStart(2, '0')}:{Math.floor(Date.now() / 1000 % 60).toString().padStart(2, '0')}:{(Date.now() % 100).toString().padStart(2, '0')}</div>
            <div className="text-[7px] text-red-900 tracking-tighter uppercase font-bold">session_time_sync</div>
          </div>
          <div className="h-4 w-[1px] bg-red-900/20" />
          <div className="flex gap-1">
             {[...Array(4)].map((_, i) => (
               <div key={i} className="w-1.5 h-3 bg-red-950/40 flex flex-col justify-end">
                 <div className="bg-red-600/60 w-full" style={{ height: `${20 + Math.random() * 80}%` }} />
               </div>
             ))}
          </div>
        </div>
      </div>

      {/* HUD - Left Sidebar: Mission & Core Stats */}
      <div className="absolute top-16 left-6 flex flex-col gap-4 pointer-events-auto w-[240px]">
        {/* Mission Info Card */}
        <div className="glass-panel p-4 relative box-glow-red overflow-hidden border-l-2 border-red-600/50">
          <CornerBrackets />
          <div className="flex items-center justify-between mb-3">
            <div className="text-red-500 text-[9px] tracking-[0.2em] font-bold uppercase">Mission_Log</div>
            <div className="text-red-900 text-[8px]">0x42A</div>
          </div>
          
          <h2 className="text-gray-100 text-xs font-bold tracking-tight mb-1 uppercase">{level.name}</h2>
          <p className="text-gray-400 text-[9px] leading-relaxed uppercase tracking-wider">
            {level.objective}
          </p>

          <div className="mt-4 pt-3 border-t border-red-900/20 flex flex-col gap-2">
            {statCards.map((stat) => (
              <StatRow 
                key={stat.label} 
                label={stat.label} 
                value={stat.value} 
                color={stat.color} 
              />
            ))}
          </div>
        </div>

        {/* Inventory Brief Card */}
        <div className="glass-panel p-3 relative border-l-2 border-amber-600/30">
          <div className="text-amber-500 text-[8px] tracking-[0.3em] font-bold uppercase mb-2">Local_Buffer</div>
          <div className="flex items-center justify-between">
             <div className="flex items-end gap-1.5">
               <span className="text-xl font-bold text-gray-200">{player.tapes.toString().padStart(2, '0')}</span>
               <span className="text-[9px] text-gray-600 mb-1">VHS</span>
             </div>
             <div className="h-6 w-[1px] bg-gray-800" />
             <div className="flex items-end gap-1.5">
               <span className="text-xl font-bold text-gray-200">{player.inventory.length.toString().padStart(2, '0')}</span>
               <span className="text-[9px] text-gray-600 mb-1">OBJ</span>
             </div>
          </div>
        </div>
      </div>

      {/* HUD - Bottom Right: Dynamic Analysis Panel */}
      <div className="absolute bottom-6 right-6 w-[280px] pointer-events-auto">
        <div className="glass-panel p-4 relative box-glow-cyan border-r-2 border-cyan-600/50">
          <CornerBrackets color="rgba(8, 145, 178, 0.4)" />
          {puzzle && !puzzle.isSolved ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="text-cyan-400 text-[9px] tracking-[0.3em] font-bold uppercase">Signal_Analysis</div>
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-cyan-500 animate-ping" />
                  <div className="w-1 h-1 bg-cyan-900" />
                </div>
              </div>
              
              <div className="text-gray-100 text-xs font-bold mb-1 uppercase tracking-wider">{puzzle.name}</div>
              <div className="text-gray-400 text-[9px] leading-tight mb-4 italic uppercase tracking-tighter">{puzzle.hint}</div>
              
              {(puzzle.type === 'sequence' || puzzle.type === 'memory') && (
                <div className="grid grid-cols-5 gap-1.5">
                  {(puzzle.sequenceSwitches || puzzle.memorySequence || []).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 transition-all duration-500 ${
                        i < (puzzle.currentSequenceIndex || 0)
                          ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                          : 'bg-gray-900'
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center gap-2">
              <div className="text-[8px] text-gray-700 tracking-[0.6em] animate-pulse uppercase">standby_monitor</div>
              <div className="flex gap-0.5">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="w-1 h-2 bg-gray-900" style={{ height: `${2 + Math.sin(i + Date.now() * 0.01) * 4}px` }} />
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Detection Level - Re-integrated */}
        {isStealthLevel && (
          <div className="mt-4 glass-panel p-3 border-r-2 border-red-900/30">
            <div className="flex justify-between items-center">
              <span className="text-[8px] text-red-500/50 tracking-widest uppercase font-bold">prox_alert:</span>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map(i => (
                  <div 
                    key={i}
                    className={`h-2.5 w-1.5 transition-all duration-300 ${
                      i < (detectionCount * 1.5)
                        ? 'bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse' 
                        : 'bg-red-950/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogue box - Redesigned */}
      {currentDialogue && (
        <div 
          className="absolute bottom-32 left-1/2 -translate-x-1/2 w-[700px] max-w-[90vw] pointer-events-auto"
          onClick={() => {
            if (!isTyping && !currentDialogue.choices) {
              onAdvanceDialogue()
            } else if (isTyping) {
              setTypedText(currentDialogue.text)
              setIsTyping(false)
            }
          }}
        >
          <div className="glass-panel p-6 box-glow-red relative border-l-4 border-red-600">
            <div className="absolute -top-3 left-6 bg-red-600 px-3 py-0.5 text-white text-[10px] font-bold tracking-[0.3em] uppercase shadow-lg">
              {currentDialogue.speaker}
            </div>
            
            <div className="text-gray-100 text-lg leading-relaxed min-h-[50px] font-mono">
              {typedText}
              {isTyping && <span className="w-2 h-5 bg-red-500 inline-block align-middle ml-1 animate-pulse" />}
            </div>
            
            {!isTyping && currentDialogue.choices && (
              <div className="mt-6 grid grid-cols-1 gap-2">
                {currentDialogue.choices.map((choice, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectChoice?.(index)
                    }}
                    className="w-full text-left px-4 py-2.5 bg-red-950/20 border border-red-900/50 text-gray-300 hover:bg-red-900/40 hover:text-white hover:border-red-500 transition-all group"
                  >
                    <span className="text-red-500 mr-2 group-hover:animate-pulse">▶</span>
                    <span className="text-sm font-bold tracking-wide">{choice.text}</span>
                  </button>
                ))}
              </div>
            )}
            
            {!isTyping && !currentDialogue.choices && (
              <div className="text-right text-[10px] text-red-500/60 mt-4 tracking-[0.2em] animate-pulse uppercase">
                click_to_continue
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interaction Overlays (Modals) */}
      {(showKeypad || activeValve || showInventory) && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center pointer-events-auto z-50">
          <div className="relative p-8 glass-panel min-w-[400px] box-glow-red">
            <CornerBrackets />
            
            {showKeypad && (
              <div className="space-y-6">
                <div className="text-red-500 text-center tracking-[0.4em] font-bold uppercase">keypad_entry</div>
                <div className="bg-black/60 border-2 border-red-900/50 p-6 text-center">
                  <div className="text-4xl tracking-[1em] text-red-100 font-bold ml-[1em]">
                    {codeInput.padEnd(4, '_')}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 max-w-[300px] mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((key) => (
                    <button
                      key={key}
                      className="h-14 bg-red-950/20 border border-red-900/40 text-red-200 text-xl font-bold hover:bg-red-900/40 hover:border-red-500 transition-all"
                      onClick={() => {
                        if (key === 'OK' && codeInput.length === 4) onSubmitCode?.(codeInput)
                      }}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeValve && (
              <div className="space-y-8">
                <div className="text-cyan-400 text-center tracking-[0.4em] font-bold uppercase">valve_control_system</div>
                <div className="flex justify-center gap-8">
                  {level.switches.filter(s => s.type === 'valve').map((valve, index) => (
                    <div key={valve.id} className="text-center group">
                      <div className="text-[10px] text-gray-500 mb-4 tracking-widest uppercase">vlv_{index + 1}</div>
                      <div className="w-24 h-24 rounded-full border-4 border-cyan-900/50 flex items-center justify-center bg-black/60 relative group-hover:border-cyan-500 transition-all duration-500">
                        <div className="absolute inset-2 border border-cyan-900/20 rounded-full animate-spin-slow" />
                        <span className="text-4xl font-bold text-cyan-400 text-glow-cyan">{valveValues[valve.id] ?? 0}</span>
                      </div>
                      <div className="flex gap-2 mt-6">
                        <button onClick={() => onValveChange?.(valve.id, ((valveValues[valve.id] ?? 0) + 9) % 10)} className="flex-1 h-10 bg-cyan-950/20 border border-cyan-900/40 text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-500">-</button>
                        <button onClick={() => onValveChange?.(valve.id, ((valveValues[valve.id] ?? 0) + 1) % 10)} className="flex-1 h-10 bg-cyan-950/20 border border-cyan-900/40 text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-500">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={onSubmitValves} className="w-full h-14 bg-cyan-900/40 border-2 border-cyan-500 text-cyan-100 font-bold tracking-[0.3em] hover:bg-cyan-800/60 transition-all uppercase mt-4">execute_sequence</button>
              </div>
            )}

            {showInventory && (
              <div className="space-y-6">
                <div className="text-amber-500 text-center tracking-[0.4em] font-bold uppercase">inventory_manifest</div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {player.inventory.length === 0 ? (
                    <div className="text-gray-600 text-center py-12 text-[10px] tracking-widest uppercase">null_storage_content</div>
                  ) : (
                    player.inventory.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-gray-950/50 border border-gray-800 hover:border-amber-900/50 transition-all group">
                        <div className="text-3xl opacity-50 group-hover:opacity-100 transition-opacity">
                          {item.type === 'key' ? '🔑' : item.type === 'fuse' ? '🔌' : item.type === 'document' ? '📄' : '📼'}
                        </div>
                        <div className="flex-1">
                          <div className="text-gray-200 text-sm font-bold uppercase tracking-tight">{item.name}</div>
                          <div className="text-gray-500 text-[10px] leading-none mt-1 uppercase tracking-tighter">{item.description}</div>
                        </div>
                        <div className="text-[8px] text-gray-700 font-bold uppercase">id: {item.id.slice(0, 4)}</div>
                      </div>
                    ))
                  )}
                </div>
                <button onClick={onCloseInventory} className="w-full h-12 bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all font-bold tracking-[0.2em] uppercase">close_manifest</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Warning Effects */}
      {player.sanity < 30 && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-red-600 text-4xl font-bold opacity-20 animate-glitch text-glow-red uppercase tracking-[0.5em]">no_escape_from_the_cycle</div>
        </div>
      )}

      {player.health < 30 && (
        <div className="absolute inset-0 pointer-events-none box-glow-red animate-pulse" />
      )}
      
      {player.isHiding && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-950/40 backdrop-blur-sm border-2 border-green-500/50 px-6 py-2 animate-pulse flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-green-400 font-bold tracking-[0.4em] text-xs uppercase">hidden_state_active</span>
        </div>
      )}
    </div>
  )
}

function CornerBrackets({ color = 'rgba(239, 68, 68, 0.4)' }: { color?: string }) {
  return (
    <>
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: color }} />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: color }} />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: color }} />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: color }} />
    </>
  )
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  const safeValue = Math.max(0, Math.min(100, value))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-[8px] font-bold tracking-[0.1em] opacity-80" style={{ color }}>{label}</span>
        <span className="text-[8px] text-gray-500 font-bold">{Math.round(safeValue)}%</span>
      </div>
      <div className="h-1 bg-black/40 rounded-full overflow-hidden border border-white/5">
        <div 
          className="h-full transition-all duration-700 ease-out"
          style={{ 
            width: `${safeValue}%`, 
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}66`
          }}
        />
      </div>
    </div>
  )
}
