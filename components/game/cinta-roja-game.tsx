'use client'

/**
 * CINTA ROJA — cinta-roja-game.tsx con audio integrado
 *
 * Cambios respecto al original:
 *  1. Importa useAudio y AudioControls
 *  2. Llama a audio.init() en el primer clic (requiere gesto del usuario)
 *  3. Cambia el modo de música según la pantalla / estado del juego
 *  4. Dispara SFX desde eventos del engine
 *  5. El narrador habla los diálogos del "Narrador" automáticamente
 *
 * INSTALACIÓN:
 *  - Copia hooks/use-audio.ts  →  hooks/use-audio.ts
 *  - Copia components/game/audio-controls.tsx  →  components/game/audio-controls.tsx
 *  - Reemplaza components/game/cinta-roja-game.tsx con este archivo
 */

import { useEffect, useState, useCallback } from 'react'
import { useGameEngine } from '@/hooks/use-game-engine'
import { useAudio } from '@/hooks/use-audio'          // ← nuevo
import { GameRenderer } from './game-renderer'
import { GameUI } from './game-ui'
import { AudioControls } from './audio-controls'       // ← nuevo
import {
  TitleScreen,
  PauseScreen,
  GameOverScreen,
  VictoryScreen,
  IntroScreen,
} from './game-screens'

export function CintaRojaGame() {
  const {
    gameState,
    screen,
    currentLevel,
    startGame,
    restartLevel,
    togglePause,
    toggleInventory,
    advanceDialogue,
    getCurrentDialogue,
    maxUnlockedLevel,
    setScreen,
  } = useGameEngine()

  const audio = useAudio()                             // ← nuevo
  const [isMounted, setIsMounted] = useState(false)

  // ── Mount ────────────────────────────────────────
  useEffect(() => { setIsMounted(true) }, [])

  // ── Init AudioContext en primer gesto ────────────
  // AudioContext necesita un gesto del usuario para funcionar en todos los browsers.
  // Lo iniciamos una sola vez al montar el componente de audio al primer clic.
  const handleFirstInteraction = useCallback(() => {
    audio.init()
    window.removeEventListener('click', handleFirstInteraction)
    window.removeEventListener('keydown', handleFirstInteraction)
  }, [audio])

  useEffect(() => {
    window.addEventListener('click', handleFirstInteraction)
    window.addEventListener('keydown', handleFirstInteraction)
    return () => {
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [handleFirstInteraction])

  // ── Música según pantalla ────────────────────────
  useEffect(() => {
    if (!audio.isReady) return
    const map: Record<string, Parameters<typeof audio.setMusicMode>[0]> = {
      title:     'title',
      playing:   'ambient',
      pause:     'ambient',
      dialogue:  'tension',
      intro:     'tension',
      inventory: 'ambient',
      gameover:  'gameover',
      victory:   'victory',
    }
    audio.setMusicMode(map[screen] ?? 'ambient')
  }, [screen, audio.isReady, audio])

  // ── Escalar tensión según stats del jugador ──────
  useEffect(() => {
    if (!audio.isReady || screen !== 'playing') return
    const { health, sanity } = gameState.player
    if (health < 25 || sanity < 25) {
      audio.setMusicMode('horror')
      if (sanity < 25) audio.playSound('sanity_low', 0.4)
    }
  }, [
    gameState.player.health,
    gameState.player.sanity,
    screen,
    audio.isReady,
    audio,
  ])

  // ── Música de nivel oscuro ───────────────────────
  useEffect(() => {
    if (!audio.isReady || screen !== 'playing') return
    if (currentLevel?.isDark && !currentLevel?.lightsOn) {
      audio.setMusicMode('dark')
    }
  }, [currentLevel?.isDark, currentLevel?.lightsOn, screen, audio.isReady, audio])

  // ── Narrador: hablar diálogos del Narrador ───────
  useEffect(() => {
    if (screen !== 'dialogue' && screen !== 'intro') return
    const dialogue = getCurrentDialogue()
    if (!dialogue) return
    if (dialogue.speaker === 'Narrador' || dialogue.speaker === 'Sistema') {
      audio.speak(dialogue.text, {
        pitch: dialogue.speaker === 'Sistema' ? 0.7 : 0.5,
        rate: dialogue.speaker === 'Sistema' ? 0.95 : 0.8,
      })
    }
  }, [screen, getCurrentDialogue, audio])

  // ── SFX: pasos del jugador ───────────────────────
  useEffect(() => {
    if (!audio.isReady || screen !== 'playing') return
    if (gameState.player.isMoving) {
      audio.playFootstep(gameState.player.isSprinting)
    }
  }, [
    gameState.player.isMoving,
    gameState.player.isSprinting,
    gameState.player.position,   // cambia en cada frame de movimiento
    audio.isReady,
    audio,
    screen,
  ])

  // ── SFX: Game Over / Victory ─────────────────────
  useEffect(() => {
    if (!audio.isReady) return
    if (gameState.isGameOver) audio.playSound('static_burst', 0.8)
    if (gameState.isVictory)  audio.playSound('level_complete', 0.7)
  }, [gameState.isGameOver, gameState.isVictory, audio.isReady, audio])

  // ── Loading screen ───────────────────────────────
  if (!isMounted) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-red-600 font-mono text-2xl animate-pulse">
          Cargando CINTA ROJA...
        </div>
      </div>
    )
  }

  // ── Layout cálculos (igual que antes) ────────────
  const windowWidth  = typeof window !== 'undefined' ? window.innerWidth  : 1440
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 760
  const gameSideInset   = windowWidth >= 640 ? 12 : 4
  const gameTopInset    = windowWidth >= 640 ? 54 : 46
  const gameBottomInset = 8
  const viewportWidth   = Math.max(320, windowWidth  - gameSideInset * 2)
  const viewportHeight  = Math.max(320, windowHeight - gameTopInset - gameBottomInset)

  const translateX = currentLevel?.width > viewportWidth
    ? Math.max(viewportWidth  - currentLevel.width,  Math.min(0, viewportWidth  / 2 - gameState.player.position.x)) : 0
  const translateY = currentLevel?.height > viewportHeight
    ? Math.max(viewportHeight - currentLevel.height, Math.min(0, viewportHeight / 2 - gameState.player.position.y)) : 0

  return (
    <div className="relative w-full min-h-screen bg-black overflow-hidden">

      {/* Title Screen */}
      {screen === 'title' && (
        <TitleScreen
          onStart={() => {
            audio.init()
            startGame(0)
          }}
          levels={gameState.levels.map(l => ({ id: l.id, name: l.name }))}
          maxUnlockedLevel={maxUnlockedLevel}
          onSelectLevel={(idx) => {
            audio.init()
            startGame(idx)
          }}
        />
      )}

      {/* Game Screen */}
      {(screen === 'playing' || screen === 'pause' || screen === 'dialogue' || screen === 'inventory') && (
        <div className="relative w-full h-screen bg-black overflow-hidden">
          <div
            className="absolute flex items-center justify-center overflow-hidden"
            style={{
              left: gameSideInset, right: gameSideInset,
              top: gameTopInset,   bottom: gameBottomInset,
            }}
          >
            <div
              className="relative overflow-hidden"
              style={{
                width:  Math.min(currentLevel.width,  viewportWidth),
                height: Math.min(currentLevel.height, viewportHeight),
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  transform: `translate(${translateX}px, ${translateY}px)`,
                  transition: 'transform 0.1s ease-out',
                }}
              >
                <GameRenderer
                  level={currentLevel}
                  player={gameState.player}
                  glitchIntensity={gameState.glitchIntensity}
                  showVHSEffect={gameState.showVHSEffect}
                />
              </div>
            </div>
          </div>

          <GameUI
            player={gameState.player}
            level={currentLevel}
            currentDialogue={screen === 'dialogue' ? getCurrentDialogue() : null}
            onAdvanceDialogue={() => {
              audio.playSound('dialogue_blip', 0.25)
              audio.stopNarrator()
              advanceDialogue()
            }}
            totalTapes={gameState.totalTapesCollected}
            memoriesCount={gameState.memoriesUnlocked.length}
            showInventory={screen === 'inventory'}
            onCloseInventory={toggleInventory}
          />

          {screen === 'pause' && (
            <PauseScreen
              onResume={togglePause}
              onQuit={() => window.location.reload()}
              onOpenLevels={() => setScreen('title')}
              currentLevel={gameState.currentLevel + 1}
              totalTapes={gameState.totalTapesCollected}
            />
          )}
        </div>
      )}

      {/* Intro Screen */}
      {screen === 'intro' && (
        <div className="relative w-full h-screen">
          <IntroScreen
            dialogue={getCurrentDialogue()}
            onAdvance={() => {
              audio.playSound('dialogue_blip', 0.2)
              audio.stopNarrator()
              advanceDialogue()
            }}
          />
        </div>
      )}

      {/* Game Over */}
      {gameState.isGameOver && (
        <GameOverScreen
          onRetry={restartLevel}
          currentLevel={gameState.currentLevel + 1}
        />
      )}

      {/* Victory */}
      {gameState.isVictory && (
        <VictoryScreen
          onRestart={() => window.location.reload()}
          totalTapes={gameState.totalTapesCollected}
          memoriesCount={gameState.memoriesUnlocked.length}
        />
      )}

      {/* Audio Controls HUD — siempre visible */}
      <AudioControls
        isMuted={audio.isMuted}
        onToggleMute={audio.toggleMute}
        onMasterVolume={audio.setMasterVolume}
        onMusicVolume={audio.setMusicVolume}
        onSFXVolume={audio.setSFXVolume}
      />

      {/* Mobile touch controls (igual que antes) */}
      <MobileTouchControls />
    </div>
  )
}

// ── MobileTouchControls (sin cambios) ─────────────
function MobileTouchControls() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const simulateKey = (key: string, type: 'down' | 'up') => {
    window.dispatchEvent(new KeyboardEvent(`key${type}`, { key, bubbles: true }))
  }

  if (!isMobile) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 flex justify-between items-end z-40 pointer-events-none">
      <div className="relative w-32 h-32 pointer-events-auto">
        {([['w', '▲', 'top-0 left-1/2 -translate-x-1/2'],
           ['s', '▼', 'bottom-0 left-1/2 -translate-x-1/2'],
           ['a', '◀', 'left-0 top-1/2 -translate-y-1/2'],
           ['d', '▶', 'right-0 top-1/2 -translate-y-1/2']] as const).map(([key, icon, pos]) => (
          <button
            key={key}
            className={`absolute ${pos} w-10 h-10 bg-gray-800/80 border border-gray-600 rounded flex items-center justify-center text-white active:bg-gray-700`}
            onTouchStart={() => simulateKey(key, 'down')}
            onTouchEnd={() => simulateKey(key, 'up')}
          >{icon}</button>
        ))}
      </div>
      <div className="flex gap-3 pointer-events-auto">
        <button
          className="w-14 h-14 bg-red-900/80 border-2 border-red-700 rounded-full flex items-center justify-center text-white font-bold active:bg-red-800"
          onTouchStart={() => simulateKey('e', 'down')}
          onTouchEnd={() => simulateKey('e', 'up')}
        >E</button>
        <button
          className="w-14 h-14 bg-gray-800/80 border-2 border-gray-600 rounded-full flex items-center justify-center text-white font-bold active:bg-gray-700"
          onTouchStart={() => simulateKey('Escape', 'down')}
        >⏸</button>
      </div>
    </div>
  )
}
