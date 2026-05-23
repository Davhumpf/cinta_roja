'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { GameState, GameKeys, Player, Enemy, Position, Level, Dialogue, Switch, Puzzle, HazardZone, InventoryItem, Collectible } from '@/lib/game-types'
import { initialPlayer, levels, dialogues } from '@/lib/game-data'

const GAME_TICK = 1000 / 60

export function useGameEngine() {
  const [maxUnlockedLevel, setMaxUnlockedLevel] = useState(0)
  const [gameState, setGameState] = useState<GameState>({
    currentLevel: 0,
    player: { ...initialPlayer },
    levels: levels.map(l => ({
      ...l,
      obstacles: l.obstacles.map(o => ({ ...o })),
      darkMazeWalls: l.darkMazeWalls?.map(o => ({ ...o })),
      enemies: l.enemies.map(e => ({ ...e, patrolPath: e.patrolPath ? [...e.patrolPath] : undefined })),
      collectibles: l.collectibles.map(c => ({ ...c })),
      npcs: l.npcs.map(n => ({ ...n })),
      switches: l.switches.map(s => ({ ...s })),
      puzzles: l.puzzles.map(p => ({ ...p })),
      pressurePlates: l.pressurePlates.map(pp => ({ ...pp })),
      hazardZones: l.hazardZones.map(hz => ({ ...hz })),
      hints: l.hints.map(h => ({ ...h })),
    })),
    dialogues,
    currentDialogue: null,
    isShowingDialogue: false,
    isPaused: false,
    isGameOver: false,
    isVictory: false,
    totalTapesCollected: 0,
    memoriesUnlocked: [],
    glitchIntensity: 0,
    showVHSEffect: true,
    codeInput: '',
    showCodeInput: false,
    activeKeypad: null,
    showInventory: false,
    selectedInventoryItem: 0,
    showHint: false,
    currentHint: '',
    totalDeaths: 0,
    playTime: 0,
  })

  const [screen, setScreen] = useState<'title' | 'playing' | 'dialogue' | 'pause' | 'gameover' | 'victory' | 'cutscene' | 'intro' | 'keypad' | 'inventory' | 'valve'>('title')
  const [dialogueQueue, setDialogueQueue] = useState<string[]>([])
  const [currentDialogueIndex, setCurrentDialogueIndex] = useState(0)
  const [detectionCount, setDetectionCount] = useState(0)
  const [activeValve, setActiveValve] = useState<string | null>(null)
  const [valveValues, setValveValues] = useState<Record<string, number>>({})
  const [sequenceProgress, setSequenceProgress] = useState<string[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedUnlocked = window.localStorage.getItem('cinta-roja-max-unlocked-level')
    if (!savedUnlocked) return

    const parsed = Number.parseInt(savedUnlocked, 10)
    if (!Number.isNaN(parsed)) {
      setMaxUnlockedLevel(Math.min(Math.max(parsed, 0), levels.length - 1))
    }
  }, [])
  
  const keysRef = useRef<GameKeys>({
    up: false,
    down: false,
    left: false,
    right: false,
    interact: false,
    pause: false,
    sprint: false,
    hide: false,
    inventory: false,
    useItem: false,
  })

  const gameLoopRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const stuckTimerRef = useRef<number>(0)

  // Deep clone levels for new game
  const cloneLevels = useCallback(() => {
    return levels.map(l => ({
      ...l,
      obstacles: l.obstacles.map(o => ({ ...o })),
      darkMazeWalls: l.darkMazeWalls?.map(o => ({ ...o })),
      enemies: l.enemies.map(e => ({ ...e, patrolPath: e.patrolPath ? [...e.patrolPath] : undefined })),
      collectibles: l.collectibles.map(c => ({ ...c })),
      npcs: l.npcs.map(n => ({ ...n })),
      switches: l.switches.map(s => ({ ...s })),
      puzzles: l.puzzles.map(p => ({ ...p, playerSequence: [], currentSequenceIndex: 0, enteredCode: '' })),
      pressurePlates: l.pressurePlates.map(pp => ({ ...pp })),
      hazardZones: l.hazardZones.map(hz => ({ ...hz })),
      hints: l.hints.map(h => ({ ...h })),
    }))
  }, [])

  // Start new game
  const startGame = useCallback((requestedLevel = 0) => {
    const safeLevel = Math.min(Math.max(requestedLevel, 0), maxUnlockedLevel, levels.length - 1)
    const newLevels = cloneLevels()

    setGameState({
      currentLevel: safeLevel,
      player: { ...initialPlayer, position: { ...newLevels[safeLevel].playerStart }, inventory: [] },
      levels: newLevels,
      dialogues,
      currentDialogue: null,
      isShowingDialogue: false,
      isPaused: false,
      isGameOver: false,
      isVictory: false,
      totalTapesCollected: 0,
      memoriesUnlocked: [],
      glitchIntensity: 0,
      showVHSEffect: true,
      codeInput: '',
      showCodeInput: false,
      activeKeypad: null,
      showInventory: false,
      selectedInventoryItem: 0,
      showHint: false,
      currentHint: '',
      totalDeaths: 0,
      playTime: 0,
    })
    setDetectionCount(0)
    setValveValues({})
    setSequenceProgress([])

    const introDialogues = newLevels[safeLevel].introDialogueIds
    if (introDialogues.length > 0) {
      setDialogueQueue(introDialogues)
      setCurrentDialogueIndex(0)
      setScreen('intro')
    } else {
      setScreen('playing')
    }
  }, [cloneLevels, maxUnlockedLevel])

  // Restart current level
  const restartLevel = useCallback(() => {
    setGameState(prev => {
      const level = levels[prev.currentLevel]
      const newLevels = [...prev.levels]
      
      // Reset level state
      newLevels[prev.currentLevel] = {
        ...level,
        obstacles: level.obstacles.map(o => ({ ...o })),
        darkMazeWalls: level.darkMazeWalls?.map(o => ({ ...o })),
        enemies: level.enemies.map(e => ({ ...e, patrolPath: e.patrolPath ? [...e.patrolPath] : undefined, behaviorState: 'patrol' as const })),
        collectibles: level.collectibles.map(c => ({ ...c })),
        npcs: level.npcs.map(n => ({ ...n })),
        switches: level.switches.map(s => ({ ...s, isActivated: false })),
        puzzles: level.puzzles.map(p => ({ ...p, isSolved: false, playerSequence: [], currentSequenceIndex: 0, enteredCode: '' })),
        pressurePlates: level.pressurePlates.map(pp => ({ ...pp, isPressed: false })),
        hazardZones: level.hazardZones.map(hz => ({ ...hz })),
        hints: level.hints.map(h => ({ ...h })),
        deathCount: prev.levels[prev.currentLevel].deathCount + 1,
      }

      return {
        ...prev,
        levels: newLevels,
        player: {
          ...initialPlayer,
          position: { ...level.playerStart },
          inventory: prev.player.inventory, // Keep inventory
        },
        isGameOver: false,
        glitchIntensity: 0,
        totalDeaths: prev.totalDeaths + 1,
      }
    })
    setDetectionCount(0)
    setSequenceProgress([])
    setScreen('playing')
  }, [])

  // Collision detection
  const checkCollision = useCallback((pos1: Position, w1: number, h1: number, pos2: Position, w2: number, h2: number): boolean => {
    const m = 0.01; // Margin to avoid floating point sticky collisions
    return (
      pos1.x < pos2.x + w2 - m &&
      pos1.x + w1 > pos2.x + m &&
      pos1.y < pos2.y + h2 - m &&
      pos1.y + h1 > pos2.y + m
    )
  }, [])

  const getActiveObstacles = useCallback((level: Level) => {
    if (level.isDark && !level.lightsOn && level.darkMazeWalls?.length) {
      return [...level.obstacles, ...level.darkMazeWalls]
    }

    return level.obstacles
  }, [])

  // Check if position is valid
  const isValidPosition = useCallback((player: Player, newPos: Position, level: Level): boolean => {
    for (const obstacle of getActiveObstacles(level)) {
      if (obstacle.solid && !obstacle.isOpen && checkCollision(newPos, player.width, player.height, obstacle.position, obstacle.width, obstacle.height)) {
        return false
      }
    }
    const m = 0.01;
    if (newPos.x < 40 - m || newPos.x + player.width > level.width - 40 + m ||
        newPos.y < 40 - m || newPos.y + player.height > level.height - 40 + m) {
      return false
    }
    return true
  }, [checkCollision, getActiveObstacles])

  // Move player
  const movePlayer = useCallback((keys: GameKeys) => {
    setGameState(prev => {
      if (prev.isShowingDialogue || prev.isPaused || prev.isGameOver || prev.isVictory || prev.player.isHiding) return prev

      const level = prev.levels[prev.currentLevel]
      const newPlayer = { ...prev.player }
      let dx = 0, dy = 0

      // Sprint mechanics
      const isSprinting = keys.sprint && newPlayer.stamina > 0
      const currentSpeed = isSprinting ? newPlayer.speed * 1.8 : newPlayer.speed

      if (keys.up) { dy = -currentSpeed; newPlayer.direction = 'up' }
      if (keys.down) { dy = currentSpeed; newPlayer.direction = 'down' }
      if (keys.left) { dx = -currentSpeed; newPlayer.direction = 'left' }
      if (keys.right) { dx = currentSpeed; newPlayer.direction = 'right' }

      newPlayer.isMoving = dx !== 0 || dy !== 0
      newPlayer.isSprinting = isSprinting && newPlayer.isMoving

      // Stamina management
      if (newPlayer.isSprinting) {
        newPlayer.stamina = Math.max(0, newPlayer.stamina - 0.5)
      } else {
        newPlayer.stamina = Math.min(100, newPlayer.stamina + 0.2)
      }

      if (newPlayer.isMoving) {
        const isCurrentlyValid = isValidPosition(newPlayer, newPlayer.position, level)

        if (!isCurrentlyValid) {
          // Fallback: Si el jugador quedó atrapado dentro de una pared (ej. por un enemigo),
          // le permitimos moverse para que pueda salir.
          newPlayer.position = {
            x: Math.max(40, Math.min(level.width - 40 - newPlayer.width, newPlayer.position.x + dx)),
            y: Math.max(40, Math.min(level.height - 40 - newPlayer.height, newPlayer.position.y + dy))
          }
        } else {
          let finalX = newPlayer.position.x
          let finalY = newPlayer.position.y

          // Intentar movimiento en X
          if (dx !== 0) {
            if (isValidPosition(newPlayer, { x: finalX + dx, y: finalY }, level)) {
              finalX += dx
            } else {
              // Acercarse progresivamente a la pared
              const stepX = Math.sign(dx)
              let testX = finalX
              let steps = Math.ceil(Math.abs(dx))
              while (steps > 0 && isValidPosition(newPlayer, { x: testX + stepX, y: finalY }, level)) {
                testX += stepX
                steps--
              }
              finalX = testX
            }
          }

          // Intentar movimiento en Y
          if (dy !== 0) {
            if (isValidPosition(newPlayer, { x: finalX, y: finalY + dy }, level)) {
              finalY += dy
            } else {
              // Acercarse progresivamente a la pared
              const stepY = Math.sign(dy)
              let testY = finalY
              let steps = Math.ceil(Math.abs(dy))
              while (steps > 0 && isValidPosition(newPlayer, { x: finalX, y: testY + stepY }, level)) {
                testY += stepY
                steps--
              }
              finalY = testY
            }
          }

          newPlayer.position = { x: finalX, y: finalY }
        }
      }

      return { ...prev, player: newPlayer }
    })
  }, [isValidPosition])

  // Update enemies with improved AI
  const updateEnemies = useCallback(() => {
    setGameState(prev => {
      if (prev.isShowingDialogue || prev.isPaused || prev.isGameOver || prev.isVictory) return prev

      const level = prev.levels[prev.currentLevel]
      const playerPos = prev.player.position
      const playerCenter = { x: playerPos.x + prev.player.width / 2, y: playerPos.y + prev.player.height / 2 }
      const isPlayerSprinting = prev.player.isSprinting

      const updatedEnemies = level.enemies.map(enemy => {
        if (!enemy.isActive || prev.player.isHiding) return enemy

        const newEnemy = { ...enemy }
        const enemyCenter = { x: enemy.position.x + enemy.width / 2, y: enemy.position.y + enemy.height / 2 }
        const dx = playerCenter.x - enemyCenter.x
        const dy = playerCenter.y - enemyCenter.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Hearing detection for sprinting
        const canHearPlayer = enemy.canHear && isPlayerSprinting && dist < enemy.hearingRadius

        // Visual detection
        const canSeePlayer = dist < enemy.detectionRadius

        if (enemy.type === 'operator') {
          // Operator always moves towards player
          if (dist > 30) {
            newEnemy.position = {
              x: enemy.position.x + (dx / dist) * enemy.speed,
              y: enemy.position.y + (dy / dist) * enemy.speed,
            }
          }
        } else if (enemy.type === 'stalker') {
          // Stalker has advanced patrol and chase
          if (canSeePlayer || canHearPlayer) {
            newEnemy.behaviorState = 'chase'
            newEnemy.lastKnownPlayerPos = { ...playerCenter }
          }

          if (newEnemy.behaviorState === 'chase' && newEnemy.lastKnownPlayerPos) {
            const targetDx = newEnemy.lastKnownPlayerPos.x - enemyCenter.x
            const targetDy = newEnemy.lastKnownPlayerPos.y - enemyCenter.y
            const targetDist = Math.sqrt(targetDx * targetDx + targetDy * targetDy)

            if (targetDist > 10) {
              newEnemy.position = {
                x: enemy.position.x + (targetDx / targetDist) * enemy.speed * 1.5,
                y: enemy.position.y + (targetDy / targetDist) * enemy.speed * 1.5,
              }
            } else {
              newEnemy.behaviorState = 'search'
            }
          } else if (newEnemy.behaviorState === 'search') {
            // Random search for a bit then return to patrol
            newEnemy.behaviorState = 'patrol'
          } else if (enemy.patrolPath && enemy.patrolPath.length > 0) {
            // Patrol behavior
            const targetPoint = enemy.patrolPath[enemy.patrolIndex || 0]
            const patrolDx = targetPoint.x - enemyCenter.x
            const patrolDy = targetPoint.y - enemyCenter.y
            const patrolDist = Math.sqrt(patrolDx * patrolDx + patrolDy * patrolDy)

            if (patrolDist > 10) {
              newEnemy.position = {
                x: enemy.position.x + (patrolDx / patrolDist) * enemy.speed,
                y: enemy.position.y + (patrolDy / patrolDist) * enemy.speed,
              }
            } else {
              newEnemy.patrolIndex = ((enemy.patrolIndex || 0) + 1) % enemy.patrolPath.length
            }
          }
        } else {
          // Echo and Shadow patrol with chase
          if (canSeePlayer || canHearPlayer) {
            const chaseSpeed = enemy.speed * 1.5
            newEnemy.position = {
              x: enemy.position.x + (dx / dist) * chaseSpeed,
              y: enemy.position.y + (dy / dist) * chaseSpeed,
            }
          } else if (enemy.patrolPath && enemy.patrolPath.length > 0) {
            const targetPoint = enemy.patrolPath[enemy.patrolIndex || 0]
            const patrolDx = targetPoint.x - enemyCenter.x
            const patrolDy = targetPoint.y - enemyCenter.y
            const patrolDist = Math.sqrt(patrolDx * patrolDx + patrolDy * patrolDy)

            if (patrolDist > 10) {
              newEnemy.position = {
                x: enemy.position.x + (patrolDx / patrolDist) * enemy.speed,
                y: enemy.position.y + (patrolDy / patrolDist) * enemy.speed,
              }
            } else {
              newEnemy.patrolIndex = ((enemy.patrolIndex || 0) + 1) % enemy.patrolPath.length
            }
          } else {
            // Simple back and forth
            const moveAmount = enemy.speed
            switch (enemy.direction) {
              case 'up':
                newEnemy.position.y -= moveAmount
                if (newEnemy.position.y < 50) newEnemy.direction = 'down'
                break
              case 'down':
                newEnemy.position.y += moveAmount
                if (newEnemy.position.y > level.height - 90) newEnemy.direction = 'up'
                break
              case 'left':
                newEnemy.position.x -= moveAmount
                if (newEnemy.position.x < 50) newEnemy.direction = 'right'
                break
              case 'right':
                newEnemy.position.x += moveAmount
                if (newEnemy.position.x > level.width - 90) newEnemy.direction = 'left'
                break
            }
          }
        }

        return newEnemy
      })

      const newLevels = [...prev.levels]
      newLevels[prev.currentLevel] = { ...level, enemies: updatedEnemies }

      return { ...prev, levels: newLevels }
    })
  }, [])

  // Update hazard zones
  const updateHazards = useCallback(() => {
    setGameState(prev => {
      if (prev.isPaused || prev.isGameOver || prev.isVictory) return prev

      const level = prev.levels[prev.currentLevel]
      const updatedHazards = level.hazardZones.map(hazard => {
        if (hazard.pattern !== 'timed') return hazard

        const newHazard = { ...hazard }
        const currentTimer = (hazard.currentTimer || 0) + 1

        if (hazard.isActive) {
          if (currentTimer >= (hazard.onDuration || 180)) {
            newHazard.isActive = false
            newHazard.currentTimer = 0
          } else {
            newHazard.currentTimer = currentTimer
          }
        } else {
          if (currentTimer >= (hazard.offDuration || 120)) {
            newHazard.isActive = true
            newHazard.currentTimer = 0
          } else {
            newHazard.currentTimer = currentTimer
          }
        }

        return newHazard
      })

      const newLevels = [...prev.levels]
      newLevels[prev.currentLevel] = { ...level, hazardZones: updatedHazards }

      return { ...prev, levels: newLevels }
    })
  }, [])

  // Check all collisions
  const checkGameCollisions = useCallback(() => {
    setGameState(prev => {
      if (prev.isShowingDialogue || prev.isPaused || prev.isGameOver || prev.isVictory || prev.player.isHiding) return prev

      const level = prev.levels[prev.currentLevel]
      let newState = { ...prev }
      let newPlayer = { ...prev.player }
      let shouldTriggerDialogue = false
      let dialoguesToShow: string[] = []
      let newDetectionCount = detectionCount

      // Check enemy collisions
      for (const enemy of level.enemies) {
        if (enemy.isActive && checkCollision(
          newPlayer.position, newPlayer.width, newPlayer.height,
          enemy.position, enemy.width, enemy.height
        )) {
          if (enemy.type === 'stalker') {
            // Stealth level detection
            newDetectionCount++
            setDetectionCount(newDetectionCount)
            
            // Push player back
            const dx = newPlayer.position.x - enemy.position.x
            const dy = newPlayer.position.y - enemy.position.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > 0) {
              newPlayer.position = {
                x: newPlayer.position.x + (dx / dist) * 50,
                y: newPlayer.position.y + (dy / dist) * 50,
              }
            }
            
            if (newDetectionCount >= 3) {
              return { ...newState, player: newPlayer, isGameOver: true }
            }
          } else {
            newPlayer.sanity -= enemy.type === 'operator' ? 8 : 3
            newPlayer.health -= enemy.type === 'operator' ? 15 : 8
            
            const dx = newPlayer.position.x - enemy.position.x
            const dy = newPlayer.position.y - enemy.position.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist > 0) {
              newPlayer.position = {
                x: newPlayer.position.x + (dx / dist) * 40,
                y: newPlayer.position.y + (dy / dist) * 40,
              }
            }
            
            newState.glitchIntensity = Math.min(100, newState.glitchIntensity + 25)
          }
        }
      }

      // Check hazard zones
      for (const hazard of level.hazardZones) {
        if (hazard.isActive && checkCollision(
          newPlayer.position, newPlayer.width, newPlayer.height,
          hazard.position, hazard.width, hazard.height
        )) {
          newPlayer.health -= hazard.damage / 10
          if (hazard.type === 'electric') {
            newState.glitchIntensity = Math.min(100, newState.glitchIntensity + 10)
          }
        }
      }

      // Check if player is dead
      if (newPlayer.health <= 0 || newPlayer.sanity <= 0) {
        return { ...newState, player: newPlayer, isGameOver: true }
      }

      // Check collectible collisions
      const updatedCollectibles = level.collectibles.map(collectible => {
        if (!collectible.collected && !collectible.hidden && checkCollision(
          newPlayer.position, newPlayer.width, newPlayer.height,
          collectible.position, collectible.width, collectible.height
        )) {
          if (collectible.type === 'vhs_tape') {
            newPlayer.tapes++
            newState.totalTapesCollected++
          }
          
          // Add to inventory if it has an inventory item
          if (collectible.inventoryItem) {
            newPlayer.inventory = [...newPlayer.inventory, collectible.inventoryItem]
          }

          if (collectible.buff) {
            newPlayer.health = Math.min(100, newPlayer.health + (collectible.buff.health || 0))
            newPlayer.sanity = Math.min(100, newPlayer.sanity + (collectible.buff.sanity || 0))
            newPlayer.stamina = Math.min(100, newPlayer.stamina + (collectible.buff.stamina || 0))
            newPlayer.speed = Math.min(3.4, newPlayer.speed + (collectible.buff.speed || 0))
          }
          
          if (collectible.dialogueId) {
            dialoguesToShow.push(collectible.dialogueId)
            shouldTriggerDialogue = true
          }
          
          return { ...collectible, collected: true }
        }
        return collectible
      })

      const newLevels = [...prev.levels]
      newLevels[prev.currentLevel] = { ...level, collectibles: updatedCollectibles }
      newState.levels = newLevels

      // Check exit
      const puzzle = level.puzzles.find(p => p.id === level.exitUnlockedBy)
      const exitUnlocked = !level.exitLocked || (puzzle && puzzle.isSolved)
      const tapesCollected = updatedCollectibles.filter(c => c.type === 'vhs_tape' && c.collected).length

      if (exitUnlocked && tapesCollected >= level.requiredTapes && checkCollision(
        newPlayer.position, newPlayer.width, newPlayer.height,
        level.exitPosition, level.exitWidth, level.exitHeight
      )) {
        if (level.completionDialogueIds.length > 0) {
          dialoguesToShow = [...dialoguesToShow, ...level.completionDialogueIds]
          shouldTriggerDialogue = true
        }
        
        newLevels[prev.currentLevel] = { ...newLevels[prev.currentLevel], isCompleted: true }
        
        if (prev.currentLevel >= 9) {
          return { ...newState, player: newPlayer, levels: newLevels, isVictory: true }
        } else {
          const nextLevel = prev.currentLevel + 1
          if (nextLevel > maxUnlockedLevel) {
            setMaxUnlockedLevel(nextLevel)
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('cinta-roja-max-unlocked-level', String(nextLevel))
            }
          }
          const nextLevelData = newLevels[nextLevel]
          newPlayer.position = { ...nextLevelData.playerStart }
          newPlayer.tapes = 0
          
          if (nextLevelData.introDialogueIds.length > 0) {
            dialoguesToShow = [...dialoguesToShow, ...nextLevelData.introDialogueIds]
            shouldTriggerDialogue = true
          }
          
          setDetectionCount(0)
          setSequenceProgress([])
          return { ...newState, player: newPlayer, levels: newLevels, currentLevel: nextLevel }
        }
      }

      if (shouldTriggerDialogue && dialoguesToShow.length > 0) {
        setDialogueQueue(dialoguesToShow)
        setCurrentDialogueIndex(0)
        setScreen('dialogue')
      }

      newState.glitchIntensity = Math.max(0, newState.glitchIntensity - 0.3)

      return { ...newState, player: newPlayer }
    })
  }, [checkCollision, detectionCount, maxUnlockedLevel])

  // Handle switch activation
  const activateSwitch = useCallback((switchObj: Switch) => {
    setGameState(prev => {
      const level = prev.levels[prev.currentLevel]
      const puzzle = level.puzzles[0]
      
      if (switchObj.type === 'keypad') {
        setScreen('keypad')
        return { ...prev, activeKeypad: switchObj.id, codeInput: '' }
      }
      
      if (switchObj.type === 'valve') {
        const valves = level.switches.filter(s => s.type === 'valve')
        const valveIndex = valves.findIndex(s => s.id === switchObj.id)
        const requiredRecordId = `record_${valveIndex + 1}`
        const hasRequiredRecord = level.collectibles.some(c => c.id === requiredRecordId && c.collected)

        if (!hasRequiredRecord) {
          setDialogueQueue(['valve_record_required'])
          setCurrentDialogueIndex(0)
          setScreen('dialogue')
          return prev
        }

        setActiveValve(switchObj.id)
        setScreen('valve')
        return prev
      }

      if (switchObj.type === 'fuse_box') {
        const fusePuzzle = level.puzzles.find(p => p.id === 'fusebox_puzzle')

        if (!fusePuzzle || fusePuzzle.isSolved) {
          return prev
        }

        const requiredFuseOrder = fusePuzzle.sequenceSwitches || []
        const currentSequenceIndex = fusePuzzle.currentSequenceIndex || 0
        const nextFuseId = requiredFuseOrder[currentSequenceIndex]
        const collectedFuses = prev.player.inventory.filter(item => item.type === 'fuse')

        if (currentSequenceIndex + collectedFuses.length < requiredFuseOrder.length) {
          setDialogueQueue(['fusebox_incomplete'])
          setCurrentDialogueIndex(0)
          setScreen('dialogue')
          return prev
        }

        if (!nextFuseId || !collectedFuses.some(item => item.id === nextFuseId)) {
          setDialogueQueue(['fusebox_hint'])
          setCurrentDialogueIndex(0)
          setScreen('dialogue')
          return prev
        }

        const removeFuseIndex = prev.player.inventory.findIndex(item => item.id === nextFuseId)
        const updatedInventory = prev.player.inventory.filter((_, index) => index !== removeFuseIndex)
        const nextSequenceIndex = currentSequenceIndex + 1
        const isSolved = nextSequenceIndex >= requiredFuseOrder.length

        const newPuzzles = level.puzzles.map(currentPuzzle =>
          currentPuzzle.id === fusePuzzle.id
            ? { ...currentPuzzle, currentSequenceIndex: nextSequenceIndex, isSolved }
            : currentPuzzle
        )

        const newSwitches = level.switches.map(currentSwitch =>
          currentSwitch.id === switchObj.id
            ? { ...currentSwitch, isActivated: true }
            : currentSwitch
        )

        const newObstacles = isSolved
          ? level.obstacles.map(obstacle =>
              obstacle.id === fusePuzzle.unlocksDoor
                ? { ...obstacle, isOpen: true, solid: false }
                : obstacle
            )
          : level.obstacles

        const newCollectibles = isSolved
          ? level.collectibles.map(collectible =>
              collectible.revealedBy === fusePuzzle.id
                ? { ...collectible, hidden: false }
                : collectible
            )
          : level.collectibles

        const newLevels = [...prev.levels]
        newLevels[prev.currentLevel] = {
          ...level,
          switches: newSwitches,
          puzzles: newPuzzles,
          obstacles: newObstacles,
          collectibles: newCollectibles,
          lightsOn: isSolved ? true : level.lightsOn,
          exitLocked: isSolved && fusePuzzle.unlocksExit ? false : level.exitLocked,
        }

        if (isSolved) {
          setDialogueQueue(['lights_restored'])
          setCurrentDialogueIndex(0)
          setScreen('dialogue')
        }

        return {
          ...prev,
          player: {
            ...prev.player,
            inventory: updatedInventory,
          },
          levels: newLevels,
        }
      }
      
      if (switchObj.type === 'lever' || switchObj.type === 'button') {
        // Sequence puzzle
        if (puzzle?.type === 'sequence' || puzzle?.type === 'memory') {
          const newSequence = [...sequenceProgress, switchObj.id]
          const expectedSequence = puzzle.sequenceSwitches || puzzle.memorySequence || []
          
          // Check if this is the correct next switch
          const expectedSwitch = expectedSequence[newSequence.length - 1]
          
          if (switchObj.id === expectedSwitch) {
            setSequenceProgress(newSequence)
            
            // Update switch state
            const newSwitches = level.switches.map(s =>
              s.id === switchObj.id ? { ...s, isActivated: true } : s
            )

            const newPuzzles = level.puzzles.map(p =>
              p.id === puzzle.id
                ? {
                    ...p,
                    isSolved: newSequence.length === expectedSequence.length,
                    currentSequenceIndex: newSequence.length,
                  }
                : p
            )
            
            // Check if puzzle is complete
            if (newSequence.length === expectedSequence.length) {
              // Unlock door if specified
              const newObstacles = level.obstacles.map(o =>
                o.id === puzzle.unlocksDoor ? { ...o, isOpen: true, solid: false } : o
              )
              
              // Reveal collectible if specified
              const newCollectibles = level.collectibles.map(c =>
                c.revealedBy === puzzle.id ? { ...c, hidden: false } : c
              )
              
              const newLevels = [...prev.levels]
              newLevels[prev.currentLevel] = {
                ...level,
                switches: newSwitches,
                puzzles: newPuzzles,
                obstacles: newObstacles,
                collectibles: newCollectibles,
                exitLocked: puzzle.unlocksExit ? false : level.exitLocked,
              }
              
              setDialogueQueue(['all_switches'])
              setCurrentDialogueIndex(0)
              setScreen('dialogue')
              
              return { ...prev, levels: newLevels }
            }
            
            const newLevels = [...prev.levels]
            newLevels[prev.currentLevel] = { ...level, switches: newSwitches, puzzles: newPuzzles }
            
            setDialogueQueue(['switch_correct'])
            setCurrentDialogueIndex(0)
            setScreen('dialogue')
            
            return { ...prev, levels: newLevels }
          } else {
            // Wrong switch - reset sequence
            setSequenceProgress([])
            
            const newSwitches = level.switches.map(s => ({ ...s, isActivated: false }))
            const newPuzzles = level.puzzles.map(p =>
              p.id === puzzle.id ? { ...p, currentSequenceIndex: 0 } : p
            )
            const newLevels = [...prev.levels]
            newLevels[prev.currentLevel] = { ...level, switches: newSwitches, puzzles: newPuzzles }
            
            setDialogueQueue(['switch_wrong'])
            setCurrentDialogueIndex(0)
            setScreen('dialogue')
            
            return { ...prev, levels: newLevels }
          }
        }
      }
      
      return prev
    })
  }, [sequenceProgress])

  // Submit code for keypad
  const submitCode = useCallback((code: string) => {
    setGameState(prev => {
      const level = prev.levels[prev.currentLevel]
      const puzzle = level.puzzles.find(p => p.type === 'code')
      
      if (puzzle && code === puzzle.correctCode) {
        const newPuzzles = level.puzzles.map(p =>
          p.id === puzzle.id ? { ...p, isSolved: true, enteredCode: code } : p
        )
        
        const newObstacles = level.obstacles.map(o =>
          o.id === puzzle.unlocksDoor || o.requiresCode === code ? { ...o, isOpen: true, solid: false } : o
        )
        
        const newCollectibles = level.collectibles.map(c =>
          c.revealedBy === puzzle.id ? { ...c, hidden: false } : c
        )
        
        const newLevels = [...prev.levels]
        newLevels[prev.currentLevel] = {
          ...level,
          puzzles: newPuzzles,
          obstacles: newObstacles,
          collectibles: newCollectibles,
          exitLocked: puzzle.unlocksExit ? false : level.exitLocked,
        }
        
        setScreen('playing')
        return { ...prev, levels: newLevels, activeKeypad: null, codeInput: '' }
      } else {
        // Wrong code
        return { ...prev, codeInput: '', glitchIntensity: Math.min(100, prev.glitchIntensity + 20) }
      }
    })
  }, [])

  // Submit valve values
  const submitValves = useCallback(() => {
    setGameState(prev => {
      const level = prev.levels[prev.currentLevel]
      const puzzle = level.puzzles.find(p => p.type === 'code' && p.name.includes('Valvula'))
      
      if (puzzle) {
        const valves = level.switches.filter(s => s.type === 'valve')
        const hasAdjustedAllValves = valves.every(s => valveValues[s.id] !== undefined)
        const valveCode = valves
          .map(s => valveValues[s.id] || 0)
          .join('')

        if (!hasAdjustedAllValves) {
          setActiveValve(null)
          setScreen('playing')
          return prev
        }
        
        if (valveCode === puzzle.correctCode) {
          const newPuzzles = level.puzzles.map(p =>
            p.id === puzzle.id ? { ...p, isSolved: true } : p
          )
          
          const newObstacles = level.obstacles.map(o =>
            o.id === puzzle.unlocksDoor || o.requiresKey === 'valve_complete' ? { ...o, isOpen: true, solid: false } : o
          )
          
          const newLevels = [...prev.levels]
          newLevels[prev.currentLevel] = {
            ...level,
            puzzles: newPuzzles,
            obstacles: newObstacles,
            exitLocked: puzzle.unlocksExit ? false : level.exitLocked,
          }
          
          setActiveValve(null)
          setScreen('playing')
          return { ...prev, levels: newLevels }
        }
      }
      
      setActiveValve(null)
      setScreen('playing')
      return { ...prev, glitchIntensity: Math.min(100, prev.glitchIntensity + 15) }
    })
  }, [valveValues])

  // Interact with objects
  const interact = useCallback(() => {
    setGameState(prev => {
      if (prev.isShowingDialogue || prev.isPaused) return prev

      const level = prev.levels[prev.currentLevel]
      const playerCenter = {
        x: prev.player.position.x + prev.player.width / 2,
        y: prev.player.position.y + prev.player.height / 2,
      }

      // Check hiding spots
      for (const spot of level.hidingSpots) {
        const dist = Math.sqrt(
          Math.pow(playerCenter.x - (spot.x + 30), 2) +
          Math.pow(playerCenter.y - (spot.y + 30), 2)
        )
        if (dist < 50) {
          return {
            ...prev,
            player: { ...prev.player, isHiding: !prev.player.isHiding },
          }
        }
      }

      // Check switches
      for (const switchObj of level.switches) {
        const dist = Math.sqrt(
          Math.pow(playerCenter.x - (switchObj.position.x + switchObj.width / 2), 2) +
          Math.pow(playerCenter.y - (switchObj.position.y + switchObj.height / 2), 2)
        )
        if (dist < 60) {
          activateSwitch(switchObj)
          return prev
        }
      }

      // Check NPCs
      for (const npc of level.npcs) {
        const dist = Math.sqrt(
          Math.pow(playerCenter.x - (npc.position.x + npc.width / 2), 2) +
          Math.pow(playerCenter.y - (npc.position.y + npc.height / 2), 2)
        )
        if (dist < 60 && npc.dialogueIds.length > 0) {
          const dialogueId = npc.dialogueIds[Math.min(npc.currentDialogueIndex, npc.dialogueIds.length - 1)]
          
          const dialogueChain: string[] = []
          let currentId: string | undefined = dialogueId
          while (currentId) {
            dialogueChain.push(currentId)
            const dialogueData: Dialogue | undefined = prev.dialogues[currentId]
            currentId = dialogueData?.nextDialogueId
          }
          
          if (dialogueChain.length > 0) {
            setDialogueQueue(dialogueChain)
            setCurrentDialogueIndex(0)
            setScreen('dialogue')
            
            const newLevels = [...prev.levels]
            const newNpcs = level.npcs.map(n =>
              n.id === npc.id
                ? { ...n, currentDialogueIndex: Math.min(n.currentDialogueIndex + 1, n.dialogueIds.length - 1) }
                : n
            )
            newLevels[prev.currentLevel] = { ...level, npcs: newNpcs }
            
            return { ...prev, levels: newLevels, isShowingDialogue: true }
          }
        }
      }

      // Check doors that need keys
      for (const obstacle of level.obstacles) {
        if (obstacle.type === 'door' && obstacle.requiresKey && !obstacle.isOpen) {
          const dist = Math.sqrt(
            Math.pow(playerCenter.x - (obstacle.position.x + obstacle.width / 2), 2) +
            Math.pow(playerCenter.y - (obstacle.position.y + obstacle.height / 2), 2)
          )
          if (dist < 60) {
            const hasKey = prev.player.inventory.some(item => item.id === obstacle.requiresKey)
            if (hasKey) {
              const newObstacles = level.obstacles.map(o =>
                o.id === obstacle.id ? { ...o, isOpen: true, solid: false } : o
              )
              const newLevels = [...prev.levels]
              newLevels[prev.currentLevel] = { ...level, obstacles: newObstacles }
              return { ...prev, levels: newLevels }
            }
          }
        }
      }

      return prev
    })
  }, [activateSwitch])

  // Advance dialogue
  const advanceDialogue = useCallback(() => {
    const currentDialogue = dialogues[dialogueQueue[currentDialogueIndex]]
    
    // Handle dialogue choices
    if (currentDialogue?.choices) {
      // Wait for choice selection
      return
    }
    
    // Handle dialogue effects
    if (currentDialogue?.effect === 'reduce_sanity') {
      setGameState(prev => ({
        ...prev,
        player: { ...prev.player, sanity: Math.max(0, prev.player.sanity - 15) },
        glitchIntensity: Math.min(100, prev.glitchIntensity + 30),
      }))
    }
    
    if (currentDialogueIndex < dialogueQueue.length - 1) {
      setCurrentDialogueIndex(prev => prev + 1)
    } else {
      setDialogueQueue([])
      setCurrentDialogueIndex(0)
      setGameState(prev => ({ ...prev, isShowingDialogue: false, currentDialogue: null }))
      setScreen('playing')
    }
  }, [currentDialogueIndex, dialogueQueue])

  // Select dialogue choice
  const selectChoice = useCallback((choiceIndex: number) => {
    const currentDialogue = dialogues[dialogueQueue[currentDialogueIndex]]
    if (currentDialogue?.choices && currentDialogue.choices[choiceIndex]) {
      const choice = currentDialogue.choices[choiceIndex]
      setDialogueQueue([choice.nextDialogueId])
      setCurrentDialogueIndex(0)
    }
  }, [currentDialogueIndex, dialogueQueue])

  // Toggle pause
  const togglePause = useCallback(() => {
    if (screen === 'playing') {
      setScreen('pause')
      setGameState(prev => ({ ...prev, isPaused: true }))
    } else if (screen === 'pause') {
      setScreen('playing')
      setGameState(prev => ({ ...prev, isPaused: false }))
    }
  }, [screen])

  // Toggle inventory
  const toggleInventory = useCallback(() => {
    if (screen === 'playing') {
      setScreen('inventory')
    } else if (screen === 'inventory') {
      setScreen('playing')
    }
  }, [screen])

  // Game loop
  useEffect(() => {
    if (screen !== 'playing') return

    const gameLoop = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= GAME_TICK) {
        movePlayer(keysRef.current)
        updateEnemies()
        updateHazards()
        checkGameCollisions()
        stuckTimerRef.current++
        lastUpdateRef.current = timestamp
      }
      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [screen, movePlayer, updateEnemies, updateHazards, checkGameCollisions])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keysRef.current.up = true
          break
        case 's':
        case 'arrowdown':
          keysRef.current.down = true
          break
        case 'a':
        case 'arrowleft':
          keysRef.current.left = true
          break
        case 'd':
        case 'arrowright':
          keysRef.current.right = true
          break
        case 'shift':
          keysRef.current.sprint = true
          break
        case 'e':
        case 'enter':
          if (screen === 'dialogue' || screen === 'intro') {
            advanceDialogue()
          } else if (screen === 'playing') {
            interact()
          } else if (screen === 'valve') {
            submitValves()
          }
          break
        case 'escape':
        case 'p':
          if (screen === 'playing' || screen === 'pause') {
            togglePause()
          } else if (screen === 'keypad' || screen === 'inventory' || screen === 'valve') {
            setScreen('playing')
            setActiveValve(null)
          }
          break
        case 'i':
          if (screen === 'playing' || screen === 'inventory') {
            toggleInventory()
          }
          break
        case 'h':
          if (screen === 'playing') {
            keysRef.current.hide = true
            interact()
          }
          break
        case ' ':
          if (screen === 'title') {
            startGame()
          } else if (screen === 'gameover' || gameState.isGameOver) {
            restartLevel()
          } else if (screen === 'victory') {
            setScreen('title')
          }
          break
        case '0': case '1': case '2': case '3': case '4':
        case '5': case '6': case '7': case '8': case '9':
          if (screen === 'keypad') {
            setGameState(prev => ({
              ...prev,
              codeInput: (prev.codeInput + e.key).slice(-4),
            }))
          } else if (screen === 'valve' && activeValve) {
            setValveValues(prev => ({
              ...prev,
              [activeValve]: parseInt(e.key),
            }))
          }
          break
        case 'backspace':
          if (screen === 'keypad') {
            setGameState(prev => ({
              ...prev,
              codeInput: prev.codeInput.slice(0, -1),
            }))
          }
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          keysRef.current.up = false
          break
        case 's':
        case 'arrowdown':
          keysRef.current.down = false
          break
        case 'a':
        case 'arrowleft':
          keysRef.current.left = false
          break
        case 'd':
        case 'arrowright':
          keysRef.current.right = false
          break
        case 'shift':
          keysRef.current.sprint = false
          break
        case 'h':
          keysRef.current.hide = false
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [screen, gameState.isGameOver, startGame, restartLevel, advanceDialogue, interact, togglePause, toggleInventory, activeValve, submitValves])

  // Get current dialogue
  const getCurrentDialogue = useCallback((): Dialogue | null => {
    if (dialogueQueue.length === 0) return null
    const dialogueId = dialogueQueue[currentDialogueIndex]
    return gameState.dialogues[dialogueId] || null
  }, [dialogueQueue, currentDialogueIndex, gameState.dialogues])

  return {
    gameState,
    screen,
    currentLevel: gameState.levels[gameState.currentLevel],
    startGame,
    restartLevel,
    togglePause,
    toggleInventory,
    advanceDialogue,
    selectChoice,
    interact,
    getCurrentDialogue,
    dialogueQueue,
    currentDialogueIndex,
    detectionCount,
    submitCode,
    submitValves,
    activeValve,
    valveValues,
    setValveValues,
    setActiveValve,
    setScreen,
    maxUnlockedLevel,
  }
}
