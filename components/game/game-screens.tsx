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
    }, 500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      if (Math.random() < 0.1) {
        const glitchChars = '░▒▓█▀▄■□'
        let newText = 'CINTA ROJA'
        const glitchPos = Math.floor(Math.random() * newText.length)
        newText = newText.slice(0, glitchPos) + glitchChars[Math.floor(Math.random() * glitchChars.length)] + newText.slice(glitchPos + 1)
        setGlitchText(newText)
        setTimeout(() => setGlitchText('CINTA ROJA'), 100)
      }
    }, 200)
    return () => clearInterval(glitchInterval)
  }, [])

  return (
    <div className="relative w-full h-screen bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* VHS tracking lines */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 100 }).map((_, i) => (
          <div 
            key={i}
            className="h-[2px] bg-white/5"
            style={{ marginTop: i * 8 }}
          />
        ))}
      </div>

      {/* Animated background */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.7\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          animation: 'noise 0.5s steps(10) infinite',
        }}
      />

      {/* Red glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-red-600/20 blur-[100px] rounded-full" />

      {/* Title */}
      <div className="relative z-10 text-center">
        {/* VHS tape icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-32 h-20 bg-gray-900 border-4 border-gray-700 rounded-sm relative">
              <div className="absolute top-2 left-2 right-2 h-8 bg-red-800 flex items-center justify-center">
                <span className="text-red-200 text-xs font-mono">REC ●</span>
              </div>
              <div className="absolute bottom-2 left-4 w-6 h-6 bg-gray-800 rounded-full border-2 border-gray-600" />
              <div className="absolute bottom-2 right-4 w-6 h-6 bg-gray-800 rounded-full border-2 border-gray-600" />
              {/* Red ribbon */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-2 bg-red-600" />
            </div>
          </div>
        </div>

        {/* Game title */}
        <h1 
          className="text-7xl md:text-9xl font-bold text-red-600 font-mono tracking-wider mb-4"
          style={{ 
            textShadow: '0 0 40px rgba(220, 38, 38, 0.8), 0 0 80px rgba(220, 38, 38, 0.4)',
          }}
        >
          {glitchText}
        </h1>

        <p className="text-gray-500 text-lg font-mono mb-2">
          Un juego de terror psicológico
        </p>

        <p className="text-gray-600 text-sm font-mono mb-12">
          Universidad Cooperativa de Colombia - Campus Pasto
        </p>

        {/* Start prompt */}
        <button
          onClick={onStart}
          className="group relative"
        >
          <div 
            className={`text-2xl font-mono tracking-widest transition-opacity duration-300 ${showPrompt ? 'opacity-100' : 'opacity-50'}`}
            style={{ color: '#ff4444' }}
          >
            ▶ PRESIONA ESPACIO PARA INICIAR ◀
          </div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-gray-500 text-sm font-mono">
            o haz clic aquí
          </div>
        </button>

        <button
          onClick={() => setShowLevelSelect(true)}
          className="mt-14 border border-red-800/70 px-5 py-2 text-sm font-mono text-red-300 hover:bg-red-900/30 transition-colors"
        >
          SELECCIONAR NIVEL
        </button>

        {/* Credits */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-600 text-xs font-mono text-center">
          <p>Juan Patiño • Gabriel Narvaez • Edison Chacua • David Rodriguez</p>
          <p className="mt-1">© 2026</p>
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-4 left-4 text-red-800 font-mono text-sm">
        ░░ PLAY ░░
      </div>
      <div className="absolute top-4 right-4 text-red-800 font-mono text-sm">
        ░░ 00:00:00 ░░
      </div>
      <div className="absolute bottom-4 left-4 text-red-800 font-mono text-sm">
        ░░ SP ░░
      </div>
      <div className="absolute bottom-4 right-4 text-red-800 font-mono text-sm">
        ░░ VHS ░░
      </div>

      {showLevelSelect && (
        <div className="absolute inset-0 z-20 bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-xl border-2 border-red-800 bg-black p-5 font-mono">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-red-400 text-lg tracking-wider">SELECCIÓN DE NIVEL</h3>
              <button
                onClick={() => setShowLevelSelect(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-2">
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
                    className={`w-full border px-4 py-3 text-left transition-colors ${
                      isLocked
                        ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                        : 'border-red-800/80 text-gray-200 hover:bg-red-900/30'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>NIVEL {level.id} · {level.name}</span>
                      <span>{isLocked ? '🔒' : '▶'}</span>
                    </div>
                    {isLocked && <div className="text-xs text-gray-500 mt-1">Completa el nivel anterior para desbloquearlo</div>}
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
  currentLevel: number
  totalTapes: number
}

export function PauseScreen({ onResume, onQuit, currentLevel, totalTapes }: PauseScreenProps) {
  return (
    <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="text-center">
        <h2 
          className="text-5xl font-bold text-red-600 font-mono tracking-wider mb-8"
          style={{ textShadow: '0 0 20px rgba(220, 38, 38, 0.5)' }}
        >
          ░░ PAUSA ░░
        </h2>

        <div className="bg-black/80 border-2 border-red-800 p-6 font-mono mb-8">
          <div className="text-gray-400 mb-2">Nivel actual: <span className="text-red-400">{currentLevel}</span></div>
          <div className="text-gray-400">Cintas recolectadas: <span className="text-red-400">{totalTapes}/10</span></div>
        </div>

        <div className="space-y-4">
          <button
            onClick={onResume}
            className="block w-64 mx-auto bg-red-900/50 border-2 border-red-700 text-red-100 py-3 px-6 font-mono text-lg hover:bg-red-800/50 transition-colors"
          >
            ▶ CONTINUAR
          </button>
          <button
            onClick={onQuit}
            className="block w-64 mx-auto bg-gray-900/50 border-2 border-gray-700 text-gray-300 py-3 px-6 font-mono text-lg hover:bg-gray-800/50 transition-colors"
          >
            ✕ SALIR AL MENÚ
          </button>
        </div>

        <p className="text-gray-600 text-sm font-mono mt-8">
          Presiona ESC o P para continuar
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
  const [glitchIntensity, setGlitchIntensity] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitchIntensity(Math.random() * 100)
    }, 100)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center z-50 overflow-hidden">
      {/* Static noise */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          animation: 'noise 0.2s steps(10) infinite',
        }}
      />

      {/* Red vignette */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle, transparent 30%, rgba(100, 0, 0, 0.8) 100%)',
        }}
      />

      <div className="text-center relative z-10">
        <h2 
          className="text-6xl font-bold text-red-700 font-mono tracking-wider mb-4"
          style={{ 
            textShadow: '0 0 30px rgba(200, 0, 0, 0.8)',
            transform: `translateX(${(Math.random() - 0.5) * glitchIntensity * 0.1}px)`,
          }}
        >
          ░░░ LA CINTA SE DETUVO ░░░
        </h2>

        <p className="text-gray-400 font-mono text-xl mb-2">
          El ciclo se repite...
        </p>
        <p className="text-gray-600 font-mono text-sm mb-8">
          Muriste en el nivel {currentLevel}
        </p>

        <button
          onClick={onRetry}
          className="bg-red-900/50 border-2 border-red-700 text-red-100 py-3 px-8 font-mono text-xl hover:bg-red-800/50 transition-colors"
        >
          ▶ REINICIAR
        </button>

        <p className="text-gray-700 text-sm font-mono mt-8">
          Presiona ESPACIO para reiniciar
        </p>

        {/* Creepy message */}
        <p 
          className="absolute bottom-20 left-1/2 -translate-x-1/2 text-red-900/50 text-xs font-mono"
          style={{ transform: `translateX(${(Math.random() - 0.5) * 10}px)` }}
        >
          ...no puedes escapar de lo que eres...
        </p>
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
      setTimeout(() => setShowText(1), 1000),
      setTimeout(() => setShowText(2), 3000),
      setTimeout(() => setShowText(3), 5000),
      setTimeout(() => setShowText(4), 7000),
      setTimeout(() => setShowText(5), 9000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center z-50 overflow-hidden">
      {/* Soft light gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, rgba(255, 255, 200, 0.05) 0%, transparent 70%)',
        }}
      />

      <div className="text-center relative z-10 max-w-2xl px-8">
        {showText >= 1 && (
          <p className="text-gray-400 font-mono text-lg mb-4 animate-fade-in">
            Adrián cruzó la puerta de luz.
          </p>
        )}

        {showText >= 2 && (
          <p className="text-gray-500 font-mono text-lg mb-4 animate-fade-in">
            El Edificio Orfeo se vació. Los ecos desaparecieron.
          </p>
        )}

        {showText >= 3 && (
          <p className="text-gray-400 font-mono text-lg mb-8 animate-fade-in">
            Las cintas perdieron todo significado.
          </p>
        )}

        {showText >= 4 && (
          <h2 
            className="text-5xl font-bold text-amber-200/80 font-mono tracking-wider mb-8 animate-fade-in"
            style={{ textShadow: '0 0 40px rgba(255, 200, 100, 0.3)' }}
          >
            Finalmente... paz.
          </h2>
        )}

        {showText >= 5 && (
          <div className="animate-fade-in">
            <div className="bg-black/60 border border-gray-700 p-6 font-mono mb-8">
              <h3 className="text-gray-300 text-lg mb-4">Estadísticas finales</h3>
              <div className="text-gray-500 space-y-2">
                <p>Cintas VHS recolectadas: <span className="text-red-400">{totalTapes}/10</span></p>
                <p>Fragmentos de memoria: <span className="text-cyan-400">{memoriesCount}</span></p>
                <p>Ciclo completado: <span className="text-green-400">✓</span></p>
              </div>
            </div>

            <p className="text-gray-600 font-mono text-sm mb-8">
              &ldquo;El verdadero horror no era un asesino externo, sino la imposibilidad de aceptar un trauma enterrado incluso después de la muerte.&rdquo;
            </p>

            <button
              onClick={onRestart}
              className="bg-gray-900/50 border-2 border-gray-600 text-gray-300 py-3 px-8 font-mono text-lg hover:bg-gray-800/50 transition-colors"
            >
              VOLVER AL INICIO
            </button>

            {/* Credits */}
            <div className="mt-12 text-gray-600 text-xs font-mono">
              <p className="text-gray-500 mb-2">CINTA ROJA</p>
              <p>Juan Patiño • Gabriel Narvaez • Edison Chacua • David Rodriguez</p>
              <p className="mt-2">Universidad Cooperativa de Colombia - Campus Pasto</p>
              <p>2026</p>
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
      className="absolute inset-0 bg-black/95 flex items-center justify-center z-50"
      onClick={() => {
        if (!isTyping) {
          onAdvance()
        } else {
          setTypedText(dialogue.text)
          setIsTyping(false)
        }
      }}
    >
      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        {Array.from({ length: 150 }).map((_, i) => (
          <div 
            key={i}
            className="h-[1px] bg-white/10"
            style={{ marginTop: i * 4 }}
          />
        ))}
      </div>

      <div className="max-w-2xl px-8 text-center">
        <div className="text-red-600 font-mono text-sm tracking-widest mb-4">
          {dialogue.speaker}
        </div>
        <p className="text-gray-200 font-mono text-2xl leading-relaxed">
          {typedText}
          {isTyping && <span className="animate-pulse">▊</span>}
        </p>
        {!isTyping && (
          <p className="text-gray-600 font-mono text-sm mt-8 animate-pulse">
            ▶ Presiona E o Enter para continuar
          </p>
        )}
      </div>
    </div>
  )
}
