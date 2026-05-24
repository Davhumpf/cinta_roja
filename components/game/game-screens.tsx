'use client'

import { useEffect, useState } from 'react'

interface TitleScreenProps {
  onStart: () => void
  levels: Array<{ id: number; name: string }>
  maxUnlockedLevel: number
  onSelectLevel: (levelIndex: number) => void
}

export function TitleScreen({ onStart, levels, maxUnlockedLevel, onSelectLevel }: TitleScreenProps) {
  const [showPrompt, setShowPrompt] = useState(true)
  const [glitchText, setGlitchText] = useState('CINTA ROJA')
  const [showLevelSelect, setShowLevelSelect] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setShowPrompt(prev => !prev)
    }, 600)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      if (Math.random() < 0.08) {
        const glitchChars = '░▒▓█▀▄■□'
        let newText = 'CINTA ROJA'
        const glitchPos = Math.floor(Math.random() * newText.length)
        newText = newText.slice(0, glitchPos) + glitchChars[Math.floor(Math.random() * glitchChars.length)] + newText.slice(glitchPos + 1)
        setGlitchText(newText)
        setTimeout(() => setGlitchText('CINTA ROJA'), 80)
      }
    }, 300)
    return () => clearInterval(glitchInterval)
  }, [])

  return (
    <div className="relative w-full h-screen bg-[#050508] flex flex-col items-center justify-center overflow-hidden font-mono">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />
      <div className="absolute inset-0 animate-scanline bg-gradient-to-b from-transparent via-red-900/5 to-transparent h-1/4 w-full pointer-events-none" />
      
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.7\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          animation: 'noise 0.2s steps(4) infinite',
        }}
      />

      {/* Decorative Corner Indicators */}
      <div className="absolute top-8 left-8 text-red-600/60 text-[10px] tracking-[0.4em] uppercase">
        <span className="animate-pulse mr-2">●</span> REC_MODE_04
      </div>
      <div className="absolute top-8 right-8 text-red-600/60 text-[10px] tracking-[0.4em] uppercase">
        VHS_SP_00:00:{Math.floor(Math.random() * 60).toString().padStart(2, '0')}
      </div>
      <div className="absolute bottom-8 left-8 text-gray-700 text-[9px] tracking-[0.2em] uppercase">
        system_orfeo_v2.1
      </div>
      <div className="absolute bottom-8 right-8 text-gray-700 text-[9px] tracking-[0.2em] uppercase">
        unreal_memories_inc
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center uppercase">
        <p className="text-gray-600 text-[10px] tracking-widest">
          UCC - CAMPUS PASTO
        </p>
        <p className="mt-1 text-gray-700 text-[9px] tracking-widest">
          designed by extraditables
        </p>
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center px-4">
        <div className="mb-12 relative inline-block">
          <div className="absolute -inset-8 bg-red-600/10 blur-[60px] rounded-full animate-pulse" />
          <h1 
            className="text-7xl md:text-9xl font-bold text-red-600 tracking-tighter mb-4 select-none"
            style={{ 
              textShadow: '0 0 30px rgba(220, 38, 38, 0.6), 0 0 60px rgba(220, 38, 38, 0.3)',
            }}
          >
            {glitchText}
          </h1>
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50" />
        </div>

        <div className="space-y-6 mb-16">
          <p className="text-gray-400 text-sm tracking-[0.3em] uppercase opacity-70">
            Un simulacro de terror psicológico
          </p>
          <div className="flex flex-col items-center gap-6">
            <button
              onClick={onStart}
              className="group relative px-12 py-4 overflow-hidden transition-all active:scale-95"
            >
              <div className="absolute inset-0 border border-red-600/30 group-hover:border-red-600 transition-colors" />
              <div className="absolute inset-0 bg-red-600/0 group-hover:bg-red-600/5 transition-colors" />
              <div className={`text-xl font-bold tracking-[0.3em] transition-opacity duration-300 ${showPrompt ? 'opacity-100' : 'opacity-40'}`} style={{ color: '#ef4444' }}>
                INICIAR
              </div>
            </button>

            <button
              onClick={() => setShowLevelSelect(true)}
              className="group relative px-6 py-2 overflow-hidden transition-all active:scale-95"
            >
              <div className="absolute inset-0 border border-red-600/30 group-hover:border-red-600 transition-colors" />
              <div className="absolute inset-0 bg-red-600/0 group-hover:bg-red-600/5 transition-colors" />
              <div className="relative text-[10px] font-bold tracking-[0.4em] uppercase text-gray-500 group-hover:text-red-400 transition-colors">
                SELECCIÓN_DE_NIVEL
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Level Select Modal */}
      {showLevelSelect && (
        <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-5xl border border-red-900/50 bg-[#08080a] p-8 relative box-glow-red">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-red-600" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-red-600" />
            
            <div className="flex items-center justify-between mb-10 border-b border-red-900/30 pb-4">
              <h3 className="text-red-500 text-xl tracking-[0.4em] font-bold uppercase">ARCHIVO_DE_NIVELES</h3>
              <button
                onClick={() => setShowLevelSelect(false)}
                className="text-gray-500 hover:text-white transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {levels.map((level, index) => {
                const isLocked = index > maxUnlockedLevel
                return (
                  <button
                    key={level.id}
                    disabled={isLocked}
                    onClick={() => {
                      onSelectLevel(index)
                      setShowLevelSelect(false)
                    }}
                    className={`group relative aspect-video border p-4 text-left transition-all ${
                      isLocked
                        ? 'border-gray-900 bg-gray-950/50 text-gray-700 cursor-not-allowed opacity-40'
                        : 'border-red-900/40 bg-red-950/5 text-gray-200 hover:border-red-500 hover:bg-red-900/10'
                    }`}
                  >
                    {!isLocked && <div className="absolute top-2 right-2 text-[8px] text-red-500/50 font-bold">READY</div>}
                    <div className="h-full flex flex-col justify-between">
                      <span className="text-[10px] tracking-widest text-red-700 font-bold">LVL_{level.id.toString().padStart(2, '0')}</span>
                      <div className="text-sm font-bold tracking-tight uppercase leading-tight group-hover:text-red-400 transition-colors">
                        {isLocked ? 'Encrypted' : level.name}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface PauseScreenProps {
  onResume: () => void
  onQuit: () => void
  onOpenLevels: () => void
  currentLevel: number
  totalTapes: number
}

export function PauseScreen({ onResume, onQuit, onOpenLevels, currentLevel, totalTapes }: PauseScreenProps) {
  return (
    <div className="absolute inset-0 bg-[#050508]/90 backdrop-blur-sm flex items-center justify-center z-50 font-mono">
      <div className="w-[400px] relative">
        <div className="absolute -inset-20 bg-red-600/5 blur-[100px] rounded-full animate-pulse" />
        
        <div className="relative glass-panel p-8 box-glow-red border-l-4 border-red-600">
          <div className="absolute -top-4 left-6 bg-red-600 px-4 py-1 text-white text-xs font-bold tracking-[0.4em] uppercase">
            sistema_pausa
          </div>
          
          <div className="mb-10 space-y-2">
            <div className="flex justify-between items-center text-[10px] tracking-widest">
              <span className="text-gray-500 uppercase">estado_actual:</span>
              <span className="text-red-500 font-bold uppercase animate-pulse">interrumpido</span>
            </div>
            <div className="flex justify-between items-center text-[10px] tracking-widest">
              <span className="text-gray-500 uppercase">nivel_id:</span>
              <span className="text-gray-200 font-bold uppercase">sector_{currentLevel.toString().padStart(2, '0')}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] tracking-widest">
              <span className="text-gray-500 uppercase">vhs_tapes:</span>
              <span className="text-gray-200 font-bold uppercase">{totalTapes}/10</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onResume}
              className="w-full bg-red-600 text-white py-4 font-bold tracking-[0.3em] hover:bg-red-500 transition-all uppercase text-sm group"
            >
              <span className="mr-2 group-hover:animate-ping inline-block">▶</span> reanudar_ciclo
            </button>
            <button
              onClick={onOpenLevels}
              className="w-full bg-gray-900 border border-gray-700 text-gray-300 py-4 font-bold tracking-[0.3em] hover:bg-gray-800 hover:text-white transition-all uppercase text-sm"
            >
              SELECCIÓN_DE_SECTOR
            </button>
            <button
              onClick={onQuit}
              className="w-full bg-transparent border border-red-900/30 text-red-900/60 py-3 font-bold tracking-[0.2em] hover:text-red-500 hover:border-red-500 transition-all uppercase text-[10px]"
            >
              ABORTAR_SESIÓN
            </button>
          </div>
        </div>
        
        <p className="text-center text-[9px] text-gray-700 tracking-[0.3em] mt-8 uppercase">
          Presiona ESC para continuar
        </p>
      </div>
    </div>
  )
}

interface GameOverScreenProps {
  onRetry: () => void
  currentLevel: number
}

export function GameOverScreen({ onRetry, currentLevel }: GameOverScreenProps) {
  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center z-50 overflow-hidden font-mono">
      {/* Heavy static effect */}
      <div 
        className="absolute inset-0 opacity-40 mix-blend-screen pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.95\' numOctaves=\'5\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          animation: 'noise 0.1s steps(2) infinite',
        }}
      />
      
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-950/20 to-black pointer-events-none" />

      <div className="text-center relative z-10 px-6">
        <div className="mb-2 text-red-900/40 text-[10px] tracking-[0.8em] uppercase animate-pulse">error_fatal_cycle_broken</div>
        
        <h2 
          className="text-5xl md:text-7xl font-bold text-red-700 tracking-tighter mb-8 animate-glitch"
          style={{ textShadow: '0 0 40px rgba(185, 28, 28, 0.6)' }}
        >
          SESIÓN TERMINADA
        </h2>

        <div className="glass-panel py-6 px-10 mb-12 box-glow-red border-red-900/50 max-w-sm mx-auto">
          <p className="text-gray-400 text-xs tracking-[0.3em] mb-4 uppercase">
            El ciclo se repite en la oscuridad...
          </p>
          <div className="h-[1px] bg-red-900/30 w-full mb-4" />
          <p className="text-red-600/80 text-[10px] tracking-widest uppercase">
            Sector fallido: {currentLevel.toString().padStart(2, '0')}
          </p>
        </div>

        <button
          onClick={onRetry}
          className="group relative px-16 py-5 transition-all active:scale-95"
        >
          <div className="absolute inset-0 bg-red-700 box-glow-red group-hover:bg-red-600 transition-colors" />
          <div className="relative text-white font-bold tracking-[0.5em] uppercase text-sm">
            REINICIAR_CICLO
          </div>
        </button>

        <p className="text-gray-700 text-[10px] tracking-[0.3em] mt-12 uppercase animate-pulse">
          Presiona espacio para reintentar
        </p>
      </div>
      
      {/* Creepy subliminal flashes */}
      <div className="absolute bottom-10 left-10 text-[8px] text-red-950 opacity-20 select-none pointer-events-none">
        01001110 01101111 01110011 00100000 01101111 01101100 01110110 01101001 01100100 01100001 01110011 01110100 01100101
      </div>
    </div>
  )
}

interface VictoryScreenProps {
  onRestart: () => void
  totalTapes: number
  memoriesCount: number
}

export function VictoryScreen({ onRestart, totalTapes, memoriesCount }: VictoryScreenProps) {
  const [showText, setShowText] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setShowText(1), 1200),
      setTimeout(() => setShowText(2), 3500),
      setTimeout(() => setShowText(3), 5500),
      setTimeout(() => setShowText(4), 7500),
      setTimeout(() => setShowText(5), 9500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="absolute inset-0 bg-[#020203] flex items-center justify-center z-50 overflow-hidden font-mono">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/10 via-transparent to-transparent pointer-events-none" />
      
      <div className="text-center relative z-10 max-w-3xl px-8">
        <div className="space-y-6 mb-16 min-h-[150px]">
          {showText >= 1 && (
            <p className="text-gray-400 text-lg tracking-wide animate-fade-in italic">
              "Adrián cruzó la puerta de luz. El Edificio Orfeo se vació."
            </p>
          )}

          {showText >= 2 && (
            <p className="text-gray-500 text-lg tracking-wide animate-fade-in italic">
              "Los ecos desaparecieron. Las cintas perdieron todo significado."
            </p>
          )}

          {showText >= 3 && (
            <h2 className="text-5xl font-bold text-cyan-400/90 tracking-[0.3em] animate-fade-in uppercase py-8" style={{ textShadow: '0 0 30px rgba(34, 211, 238, 0.4)' }}>
              Finalmente... paz.
            </h2>
          )}
        </div>

        {showText >= 4 && (
          <div className="animate-fade-in space-y-12">
            <div className="glass-panel p-10 box-glow-cyan border-cyan-900/30 bg-black/40">
              <div className="text-cyan-500 text-[10px] tracking-[0.5em] mb-8 font-bold uppercase">INFORME_FINAL_SESIÓN</div>
              <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                <div className="text-left">
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">RECOLECCIÓN_VHS</div>
                  <div className="text-2xl text-red-500 font-bold">{totalTapes}/10</div>
                </div>
                <div className="text-left">
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">FRAGMENTOS_MEMORIA</div>
                  <div className="text-2xl text-cyan-400 font-bold">{memoriesCount}</div>
                </div>
                <div className="text-left">
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">ESTADO_CICLO</div>
                  <div className="text-sm text-green-500 font-bold uppercase tracking-widest">completo_exitoso</div>
                </div>
                <div className="text-left">
                  <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">identidad</div>
                  <div className="text-sm text-gray-200 font-bold uppercase tracking-widest">adrian_restaurado</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-8">
              <button
                onClick={onRestart}
                className="group relative px-12 py-4 transition-all active:scale-95"
              >
                <div className="absolute inset-0 border border-cyan-500/30 group-hover:border-cyan-500 transition-colors" />
                <div className="relative text-cyan-400 text-sm font-bold tracking-[0.4em] uppercase group-hover:text-cyan-200">
                  LIBERAR_SISTEMA
                </div>
              </button>

              <div className="text-gray-600 text-[9px] tracking-[0.3em] leading-relaxed uppercase opacity-40">
                CINTA ROJA © 2026<br />
                un proyecto de terror analógico para la UCC
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function IntroScreen({ dialogue, onAdvance }: { dialogue: { speaker: string; text: string } | null; onAdvance: () => void }) {
  const [typedText, setTypedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (dialogue) {
      setIsTyping(true)
      setTypedText('')
      let index = 0
      const text = dialogue.text
      
      const interval = setInterval(() => {
        if (index < text.length) {
          setTypedText(text.slice(0, index + 1))
          index++
        } else {
          setIsTyping(false)
          clearInterval(interval)
        }
      }, 40)
      
      return () => clearInterval(interval)
    }
  }, [dialogue])

  if (!dialogue) return null

  return (
    <div 
      className="absolute inset-0 bg-black/98 flex items-center justify-center z-50 font-mono"
      onClick={() => {
        if (!isTyping) onAdvance()
        else { setTypedText(dialogue.text); setIsTyping(false); }
      }}
    >
      <div className="absolute inset-0 scanlines opacity-20 pointer-events-none" />
      <div className="max-w-3xl px-12 text-center">
        <div className="text-red-700 text-[10px] tracking-[0.6em] font-bold uppercase mb-8 animate-pulse">
          {dialogue.speaker}
        </div>
        <div className="text-gray-200 text-3xl md:text-4xl font-bold leading-tight tracking-tight min-h-[120px]">
          {typedText}
          {isTyping && <span className="w-4 h-8 bg-red-600 inline-block align-middle ml-2 animate-pulse" />}
        </div>
        {!isTyping && (
          <div className="mt-16 text-red-600/40 text-[10px] tracking-[0.4em] uppercase animate-fade-in">
            [ presiona_enter_para_iniciar_transmisión ]
          </div>
        )}
      </div>
    </div>
  )
}
