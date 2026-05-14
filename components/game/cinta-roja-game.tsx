'use client'

import { useEffect, useState } from 'react'
import { useGameEngine } from '@/hooks/use-game-engine'
import { GameRenderer } from './game-renderer'
import { GameUI } from './game-ui'
import { TitleScreen, PauseScreen, GameOverScreen, VictoryScreen, IntroScreen } from './game-screens'

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

  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-red-600 font-mono text-2xl animate-pulse">
          Cargando CINTA ROJA...
        </div>
      </div>
    )
  }

  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1440
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 760
  const sideRailWidth = windowWidth >= 1280 ? 360 : 8
  const gameTopInset = 68
  const gameBottomInset = 16
  const viewportWidth = Math.max(320, windowWidth - sideRailWidth * 2 - 24)
  const viewportHeight = Math.max(320, windowHeight - gameTopInset - gameBottomInset)

  const translateX = currentLevel?.width > viewportWidth 
    ? Math.max(viewportWidth - currentLevel.width, Math.min(0, viewportWidth / 2 - gameState.player.position.x))
    : 0;

  const translateY = currentLevel?.height > viewportHeight 
    ? Math.max(viewportHeight - currentLevel.height, Math.min(0, viewportHeight / 2 - gameState.player.position.y))
    : 0;

  return (
    <div className="relative w-full min-h-screen bg-black overflow-hidden">
      {/* Title Screen */}
      {screen === 'title' && (
        <TitleScreen
          onStart={() => startGame(0)}
          levels={gameState.levels.map(level => ({ id: level.id, name: level.name }))}
          maxUnlockedLevel={maxUnlockedLevel}
          onSelectLevel={startGame}
        />
      )}

      {/* Game Screen */}
      {(screen === 'playing' || screen === 'pause' || screen === 'dialogue' || screen === 'inventory') && (
        <div className="relative w-full h-screen bg-black overflow-hidden">
          {/* Camera container with scroll */}
          <div 
            className="absolute flex items-center justify-center overflow-hidden"
            style={{
              left: sideRailWidth,
              right: sideRailWidth,
              top: gameTopInset,
              bottom: gameBottomInset,
            }}
          >
            <div
              className="relative overflow-hidden"
              style={{
                width: Math.min(currentLevel.width, viewportWidth),
                height: Math.min(currentLevel.height, viewportHeight),
              }}
            >
              {/* Scrolling container */}
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

          {/* Game UI */}
          <GameUI
            player={gameState.player}
            level={currentLevel}
            currentDialogue={screen === 'dialogue' ? getCurrentDialogue() : null}
            onAdvanceDialogue={advanceDialogue}
            totalTapes={gameState.totalTapesCollected}
            memoriesCount={gameState.memoriesUnlocked.length}
            showInventory={screen === 'inventory'}
            onCloseInventory={toggleInventory}
          />

          {/* Pause overlay */}
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

      {/* Intro Screen (level intro dialogues) */}
      {screen === 'intro' && (
        <div className="relative w-full h-screen">
          <IntroScreen
            dialogue={getCurrentDialogue()}
            onAdvance={advanceDialogue}
          />
        </div>
      )}

      {/* Game Over Screen */}
      {gameState.isGameOver && (
        <GameOverScreen
          onRetry={restartLevel}
          currentLevel={gameState.currentLevel + 1}
        />
      )}

      {/* Victory Screen */}
      {gameState.isVictory && (
        <VictoryScreen
          onRestart={() => window.location.reload()}
          totalTapes={gameState.totalTapesCollected}
          memoriesCount={gameState.memoriesUnlocked.length}
        />
      )}

      {/* Mobile touch controls */}
      <MobileTouchControls />
    </div>
  )
}

function MobileTouchControls() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const simulateKey = (key: string, type: 'down' | 'up') => {
    const event = new KeyboardEvent(`key${type}`, { key, bubbles: true })
    window.dispatchEvent(event)
  }

  if (!isMobile) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 flex justify-between items-end z-40 pointer-events-none">
      {/* D-Pad */}
      <div className="relative w-32 h-32 pointer-events-auto">
        {/* Up */}
        <button
          className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 bg-gray-800/80 border border-gray-600 rounded flex items-center justify-center text-white active:bg-gray-700"
          onTouchStart={() => simulateKey('w', 'down')}
          onTouchEnd={() => simulateKey('w', 'up')}
        >
          ▲
        </button>
        {/* Down */}
        <button
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-10 bg-gray-800/80 border border-gray-600 rounded flex items-center justify-center text-white active:bg-gray-700"
          onTouchStart={() => simulateKey('s', 'down')}
          onTouchEnd={() => simulateKey('s', 'up')}
        >
          ▼
        </button>
        {/* Left */}
        <button
          className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-gray-800/80 border border-gray-600 rounded flex items-center justify-center text-white active:bg-gray-700"
          onTouchStart={() => simulateKey('a', 'down')}
          onTouchEnd={() => simulateKey('a', 'up')}
        >
          ◀
        </button>
        {/* Right */}
        <button
          className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-gray-800/80 border border-gray-600 rounded flex items-center justify-center text-white active:bg-gray-700"
          onTouchStart={() => simulateKey('d', 'down')}
          onTouchEnd={() => simulateKey('d', 'up')}
        >
          ▶
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pointer-events-auto">
        <button
          className="w-14 h-14 bg-red-900/80 border-2 border-red-700 rounded-full flex items-center justify-center text-white font-bold active:bg-red-800"
          onTouchStart={() => simulateKey('e', 'down')}
          onTouchEnd={() => simulateKey('e', 'up')}
        >
          E
        </button>
        <button
          className="w-14 h-14 bg-gray-800/80 border-2 border-gray-600 rounded-full flex items-center justify-center text-white font-bold active:bg-gray-700"
          onTouchStart={() => simulateKey('Escape', 'down')}
        >
          ⏸
        </button>
      </div>
    </div>
  )
}
