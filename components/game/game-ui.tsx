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

  return (
    <div className="absolute inset-0 pointer-events-none font-mono">
      {/* HUD - Top */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-3 pointer-events-none">
        {/* Level info */}
        <div className="pointer-events-auto w-[320px] max-w-[46vw] bg-black/55 border border-red-900/55 px-3 py-2 shadow-[0_0_22px_rgba(0,0,0,0.65)] backdrop-blur-[2px]">
          <div className="flex items-center gap-2">
            <div className="text-red-400 text-[10px] tracking-[0.24em]">NIVEL {level.id}</div>
            <div className="h-px flex-1 bg-red-950/80" />
          </div>
          <div className="text-gray-100 text-[13px] font-bold leading-tight">{level.name}</div>
          <div className="text-gray-400 text-[11px] mt-1 leading-tight max-h-[40px] overflow-hidden">{level.objective}</div>
          {isDarkLevel && player.hasFlashlight && (
            <div className="mt-2 flex items-center gap-2 text-[10px] text-amber-300/90">
              <span className="inline-block h-1.5 w-1.5 bg-amber-300 animate-pulse" />
              <span>Linterna danada: 7s oscuridad / 3s barrido.</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          <StatPill
            label="SALUD"
            value={player.health}
            color={player.health > 50 ? '#22c55e' : player.health > 25 ? '#eab308' : '#ef4444'}
          />
          <StatPill label="CORDURA" value={player.sanity} color="#a855f7" />
          <StatPill label="STAMINA" value={player.stamina} color="#facc15" />
        </div>
      </div>

      {/* HUD - Bottom */}
      <div className="absolute bottom-3 left-3 right-3 grid grid-cols-[auto_minmax(220px,1fr)_auto] items-end gap-2 pointer-events-none">
        {/* Tapes & Inventory */}
        <div className="pointer-events-auto flex gap-2">
          <div className="bg-black/55 border border-red-900/60 px-3 py-2 shadow-[0_0_18px_rgba(0,0,0,0.65)] backdrop-blur-[2px]">
            <div className="flex items-center gap-2">
              <div className="border border-red-900/50 px-1.5 py-0.5 text-[10px] text-red-300">VHS</div>
              <div>
                <div className="text-red-400 text-[10px] tracking-[0.22em]">CINTAS</div>
                <div className="text-gray-100 text-base leading-none">
                  {player.tapes}/{level.requiredTapes}
                  {player.tapes >= level.requiredTapes && !level.exitLocked && (
                    <span className="text-green-400 ml-2 text-xs">ABIERTA</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Inventory count */}
          {player.inventory.length > 0 && (
            <div className="bg-black/55 border border-amber-900/70 px-3 py-2 shadow-[0_0_18px_rgba(0,0,0,0.65)] backdrop-blur-[2px]">
              <div className="flex items-center gap-2">
                <div className="border border-amber-900/50 px-1.5 py-0.5 text-[10px] text-amber-300">I</div>
                <div>
                  <div className="text-amber-400 text-[10px] tracking-[0.22em]">INVENTARIO</div>
                  <div className="text-gray-100 text-base leading-none">{player.inventory.length} items</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detection Counter for Stealth Levels */}
        {isStealthLevel && (
          <div className="pointer-events-auto justify-self-center bg-black/55 border border-red-900/60 px-3 py-2 shadow-[0_0_18px_rgba(0,0,0,0.65)] backdrop-blur-[2px]">
            <div className="text-red-400 text-[10px] tracking-[0.22em] mb-1">DETECCIONES</div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  className={`h-3 w-3 border transition-all ${
                    i < detectionCount 
                      ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50' 
                      : 'bg-transparent border-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Puzzle Progress */}
        {puzzle && !puzzle.isSolved && (
          <div className="pointer-events-auto justify-self-center w-full max-w-[560px] bg-black/60 border border-cyan-900/70 px-3 py-2 shadow-[0_0_22px_rgba(0,0,0,0.72)] backdrop-blur-[2px]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-cyan-300 text-[12px] font-bold leading-tight">{puzzle.name}</div>
              {puzzle.id === 'fusebox_puzzle' && (
                <div className="text-amber-300 text-[10px] whitespace-nowrap">E para insertar</div>
              )}
            </div>
            <div className="text-gray-400 text-[11px] leading-tight">{puzzle.description}</div>
            {(puzzle.type === 'sequence' || puzzle.type === 'memory') && puzzle.sequenceSwitches && (
              <div className="flex gap-1 mt-1.5">
                {(puzzle.sequenceSwitches || puzzle.memorySequence || []).map((_, i) => (
                  <div 
                    key={i}
                    className={`h-3 w-3 transition-all ${
                      i < (puzzle.currentSequenceIndex || 0)
                        ? 'bg-green-500 shadow-lg shadow-green-500/50'
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            )}
            <div className="text-gray-500 text-[10px] mt-1 italic leading-tight max-h-[14px] overflow-hidden">{puzzle.hint}</div>
          </div>
        )}

        {/* Hiding Indicator */}
        {player.isHiding && (
          <div className="bg-green-900/90 border-2 border-green-500 px-4 py-2 font-mono animate-pulse">
            <span className="text-green-400 font-bold">ESCONDIDO</span>
            <div className="text-green-300 text-xs">Los enemigos no te ven</div>
          </div>
        )}

        {/* Controls */}
        <div className="pointer-events-auto bg-black/45 border border-slate-700/70 px-3 py-2 text-[10px] text-gray-400/85 shadow-[0_0_18px_rgba(0,0,0,0.65)] backdrop-blur-[2px]">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span>WASD</span><span>Mover</span>
            <span>SHIFT</span><span>Correr</span>
            <span>E</span><span>Interactuar</span>
            <span>I</span><span>Inventario</span>
            <span>ESC</span><span>Pausa</span>
          </div>
        </div>
      </div>

      {/* Dialogue box */}
      {currentDialogue && (
        <div 
          className="absolute bottom-32 left-1/2 -translate-x-1/2 w-[650px] max-w-[90vw] pointer-events-auto"
          onClick={() => {
            if (!isTyping && !currentDialogue.choices) {
              onAdvanceDialogue()
            } else if (isTyping) {
              setTypedText(currentDialogue.text)
              setIsTyping(false)
            }
          }}
        >
          <div className="bg-black/95 border-4 border-red-800 p-4 font-mono shadow-2xl shadow-red-900/50">
            {/* Speaker name */}
            <div className="absolute -top-4 left-4 bg-red-900 px-3 py-1 text-red-100 text-sm tracking-wider">
              {currentDialogue.speaker}
            </div>
            
            {/* Dialogue text */}
            <div className="pt-2 text-gray-200 text-lg leading-relaxed min-h-[60px]">
              {typedText}
              {isTyping && <span className="animate-pulse">▊</span>}
            </div>
            
            {/* Dialogue choices */}
            {!isTyping && currentDialogue.choices && (
              <div className="mt-4 space-y-2">
                {currentDialogue.choices.map((choice, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectChoice?.(index)
                    }}
                    className="w-full text-left px-4 py-2 bg-gray-900 border border-red-800 text-gray-200 hover:bg-red-900/50 hover:border-red-600 transition-all"
                  >
                    {index + 1}. {choice.text}
                  </button>
                ))}
              </div>
            )}
            
            {/* Continue prompt */}
            {!isTyping && !currentDialogue.choices && (
              <div className="text-right text-red-400 text-sm mt-2 animate-pulse">
                Presiona E o Enter para continuar
              </div>
            )}

            {/* VHS scan lines effect */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
              {Array.from({ length: 20 }).map((_, i) => (
                <div 
                  key={i}
                  className="h-[2px] bg-white/10"
                  style={{ marginTop: i * 4 }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Keypad Modal */}
      {showKeypad && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-auto">
          <div className="bg-gray-900 border-4 border-red-800 p-6 font-mono">
            <div className="text-red-500 text-lg mb-4 text-center">INTRODUCE EL CODIGO</div>
            
            {/* Code display */}
            <div className="bg-black border-2 border-green-800 p-3 mb-4">
              <div className="text-green-400 text-3xl tracking-widest text-center h-10">
                {codeInput.padEnd(4, '_').split('').join(' ')}
              </div>
            </div>
            
            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === 'OK' && codeInput.length === 4) {
                      onSubmitCode?.(codeInput)
                    } else if (key === 'C') {
                      // Clear handled by backspace in engine
                    } else if (typeof key === 'number' && codeInput.length < 4) {
                      // Numbers handled by keyboard
                    }
                  }}
                  className="w-12 h-12 bg-gray-800 border border-gray-600 text-gray-200 text-xl hover:bg-gray-700 transition-all"
                >
                  {key}
                </button>
              ))}
            </div>
            
            <div className="text-gray-500 text-xs text-center">
              Usa el teclado numerico o haz clic. ESC para salir.
            </div>
            
            {codeInput.length === 4 && (
              <button
                onClick={() => onSubmitCode?.(codeInput)}
                className="w-full mt-4 py-2 bg-green-800 border border-green-600 text-green-200 hover:bg-green-700"
              >
                CONFIRMAR
              </button>
            )}
          </div>
        </div>
      )}

      {/* Valve Modal */}
      {activeValve && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-auto">
          <div className="bg-gray-900 border-4 border-cyan-800 p-6 font-mono">
            <div className="text-cyan-500 text-lg mb-4 text-center">AJUSTA LAS VALVULAS</div>
            
            <div className="flex gap-6 mb-6">
              {level.switches.filter(s => s.type === 'valve').map((valve, index) => (
                <div key={valve.id} className="text-center">
                  <div className="text-gray-400 text-sm mb-2">Valvula {index + 1}</div>
                  <div className="w-16 h-16 rounded-full border-4 border-cyan-700 flex items-center justify-center bg-gray-800">
                    <span className="text-cyan-400 text-2xl font-bold">
                      {valveValues[valve.id] ?? 0}
                    </span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => {
                        const current = valveValues[valve.id] ?? 0
                        onValveChange?.(valve.id, current > 0 ? current - 1 : 9)
                      }}
                      className="w-7 h-7 bg-gray-700 text-gray-300 hover:bg-gray-600"
                    >
                      -
                    </button>
                    <button
                      onClick={() => {
                        const current = valveValues[valve.id] ?? 0
                        onValveChange?.(valve.id, current < 9 ? current + 1 : 0)
                      }}
                      className="w-7 h-7 bg-gray-700 text-gray-300 hover:bg-gray-600"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-gray-500 text-xs text-center mb-4">
              Usa los botones +/- o teclas numericas. ESC para salir.
            </div>
            
            <button
              onClick={onSubmitValves}
              className="w-full py-2 bg-cyan-800 border border-cyan-600 text-cyan-200 hover:bg-cyan-700"
            >
              CONFIRMAR
            </button>
          </div>
        </div>
      )}

      {/* Inventory Modal */}
      {showInventory && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center pointer-events-auto">
          <div className="bg-gray-900 border-4 border-amber-800 p-6 font-mono min-w-[400px]">
            <div className="text-amber-500 text-lg mb-4 text-center">INVENTARIO</div>
            
            {player.inventory.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No tienes objetos
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {player.inventory.map((item, index) => (
                  <div 
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-gray-800 border border-gray-700"
                  >
                    <div className="text-2xl">
                      {item.type === 'key' ? '🔑' : 
                       item.type === 'fuse' ? '🔌' : 
                       item.type === 'document' ? '📄' : 
                       item.type === 'vhs_tape' ? '📼' : '📦'}
                    </div>
                    <div>
                      <div className="text-gray-200">{item.name}</div>
                      <div className="text-gray-500 text-xs">{item.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={onCloseInventory}
              className="w-full mt-4 py-2 bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600"
            >
              CERRAR [I o ESC]
            </button>
          </div>
        </div>
      )}

      {/* Low sanity warning */}
      {player.sanity < 30 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div 
            className="text-red-500 text-4xl font-bold opacity-30 animate-pulse font-mono"
            style={{ textShadow: '0 0 20px rgba(255, 0, 0, 0.5)' }}
          >
            NO PUEDES HUIR DE LA VERDAD
          </div>
        </div>
      )}

      {/* Low health warning */}
      {player.health < 30 && (
        <div 
          className="absolute inset-0 pointer-events-none animate-pulse"
          style={{ 
            background: 'radial-gradient(circle, transparent 50%, rgba(255, 0, 0, 0.3) 100%)',
          }}
        />
      )}

      {/* Sprint noise warning */}
      {player.isSprinting && isStealthLevel && (
        <div className="absolute top-1/2 right-8 -translate-y-1/2 pointer-events-none">
          <div className="text-red-500 text-sm font-mono animate-pulse flex items-center gap-2">
            <span className="text-2xl">🔊</span>
            <span>HACIENDO RUIDO</span>
          </div>
        </div>
      )}
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  const safeValue = Math.max(0, Math.min(100, value))

  return (
    <div
      className="w-[112px] bg-black/50 border px-2 py-1 shadow-[0_0_18px_rgba(0,0,0,0.65)] backdrop-blur-[2px]"
      style={{ borderColor: `${color}66` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-[0.2em]" style={{ color }}>{label}</span>
        <span className="text-[10px] text-gray-200">{Math.round(safeValue)}%</span>
      </div>
      <div className="mt-1 h-1.5 bg-slate-950/90">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${safeValue}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}88`,
          }}
        />
      </div>
    </div>
  )
}
