'use client'

import type { Player, Level, Dialogue, InventoryItem } from '@/lib/game-types'
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
      label: 'SALUD',
      value: player.health,
      valueClass: 'text-red-400',
      labelClass: 'text-red-500',
      borderClass: 'border-red-900',
      barColor: player.health > 50 ? '#22c55e' : player.health > 25 ? '#eab308' : '#ef4444',
    },
    {
      label: 'CORDURA',
      value: player.sanity,
      valueClass: 'text-purple-400',
      labelClass: 'text-purple-500',
      borderClass: 'border-purple-900',
      barColor: '#9333ea',
    },
    {
      label: 'STAMINA',
      value: player.stamina,
      valueClass: 'text-yellow-400',
      labelClass: 'text-yellow-500',
      borderClass: 'border-yellow-900',
      barColor: '#eab308',
    },
  ]

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* HUD - Top */}
      <div className="absolute top-4 left-4 right-4 flex justify-start items-start pointer-events-auto">
        {/* Level info */}
        <div className="bg-black/90 border-2 border-red-800 px-4 py-2 font-mono max-w-sm">
          <div className="text-red-500 text-xs tracking-widest">NIVEL {level.id}</div>
          <div className="text-gray-200 text-sm font-bold">{level.name}</div>
          <div className="text-gray-400 text-xs mt-1 leading-tight">{level.objective}</div>
          {isDarkLevel && player.hasFlashlight && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-300">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
              <span>Linterna dañada activa: 7s de oscuridad, luego 3s iluminando todo el mapa.</span>
            </div>
          )}
        </div>
      </div>

      <div className="absolute right-4 top-4 bottom-4 w-[230px] flex flex-col gap-3 pointer-events-auto">
        {/* Stats */}
        <div className="bg-black/90 border-2 border-red-800 px-3 py-3 font-mono">
          <div className="flex flex-col gap-2">
            {statCards.map((stat) => (
              <div key={stat.label} className="bg-black/50 border border-red-950/80 px-2 py-2">
                <div className={`text-xs tracking-widest mb-1 ${stat.labelClass}`}>{stat.label}</div>
                <div className="flex items-center gap-2">
                  <div className={`flex-1 h-3 bg-gray-800 border ${stat.borderClass}`}>
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${stat.value}%`,
                        backgroundColor: stat.barColor,
                      }}
                    />
                  </div>
                  <span className={`text-xs w-10 text-right ${stat.valueClass}`}>{Math.round(stat.value)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right rail info space between stats and controls */}
        <div className="bg-black/90 border-2 border-cyan-800 px-3 py-2 font-mono flex-1 overflow-y-auto">
          {puzzle && !puzzle.isSolved ? (
            <>
              <div className="text-cyan-400 text-sm font-bold">{puzzle.name}</div>
              <div className="text-gray-400 text-xs leading-tight whitespace-normal break-words">{puzzle.description}</div>
              {(puzzle.type === 'sequence' || puzzle.type === 'memory') && puzzle.sequenceSwitches && (
                <div className="flex gap-1 mt-2">
                  {(puzzle.sequenceSwitches || puzzle.memorySequence || []).map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded transition-all ${
                        i < (puzzle.currentSequenceIndex || 0)
                          ? 'bg-green-500 shadow-lg shadow-green-500/50'
                          : 'bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              )}
              <div className="text-gray-500 text-xs mt-1 italic leading-tight whitespace-normal break-words">{puzzle.hint}</div>
              {puzzle.id === 'fusebox_puzzle' && (
                <div className="text-amber-300 text-xs mt-2 leading-tight whitespace-normal break-words">
                  Acércate a la caja y presiona E. Si ya encontraste el siguiente fusible correcto, lo insertará.
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-xs text-cyan-200/70">
              Espacio reservado para información del nivel.
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-black/90 border-2 border-gray-700 px-3 py-2 font-mono text-xs text-gray-400">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <span>WASD / Flechas</span><span>Mover</span>
            <span>SHIFT</span><span>Correr</span>
            <span>E / Enter</span><span>Interactuar</span>
            <span>I</span><span>Inventario</span>
            <span>ESC / P</span><span>Pausa</span>
          </div>
        </div>
      </div>

      {/* HUD - Bottom */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-auto gap-4">
        {/* Tapes & Inventory */}
        <div className="flex gap-3">
          <div className="bg-black/90 border-2 border-red-800 px-4 py-2 font-mono">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📼</div>
              <div>
                <div className="text-red-500 text-xs tracking-widest">CINTAS</div>
                <div className="text-gray-200 text-lg">
                  {player.tapes}/{level.requiredTapes}
                  {player.tapes >= level.requiredTapes && !level.exitLocked && (
                    <span className="text-green-400 ml-2 text-sm">SALIDA ABIERTA</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Inventory count */}
          {player.inventory.length > 0 && (
            <div className="bg-black/90 border-2 border-amber-800 px-4 py-2 font-mono">
              <div className="flex items-center gap-3">
                <div className="text-2xl">🎒</div>
                <div>
                  <div className="text-amber-500 text-xs tracking-widest">INVENTARIO [I]</div>
                  <div className="text-gray-200 text-lg">{player.inventory.length} items</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detection Counter for Stealth Levels */}
        {isStealthLevel && (
          <div className="bg-black/90 border-2 border-red-800 px-4 py-2 font-mono">
            <div className="text-red-500 text-xs tracking-widest mb-2">DETECCIONES</div>
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    i < detectionCount 
                      ? 'bg-red-500 border-red-400 shadow-lg shadow-red-500/50' 
                      : 'bg-transparent border-gray-600'
                  }`}
                />
              ))}
            </div>
            <div className="text-xs text-gray-500 mt-1">3 = GAME OVER</div>
          </div>
        )}

        {/* Hiding Indicator */}
        {player.isHiding && (
          <div className="bg-green-900/90 border-2 border-green-500 px-4 py-2 font-mono animate-pulse">
            <span className="text-green-400 font-bold">ESCONDIDO</span>
            <div className="text-green-300 text-xs">Los enemigos no te ven</div>
          </div>
        )}

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
