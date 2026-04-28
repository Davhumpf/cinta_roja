'use client'

import { useRef, useEffect, useCallback } from 'react'
import type { Player, Enemy, Collectible, Obstacle, NPC, Level, Switch, HazardZone, Position } from '@/lib/game-types'

interface GameRendererProps {
  level: Level
  player: Player
  glitchIntensity: number
  showVHSEffect: boolean
  valveValues?: Record<string, number>
}

export function GameRenderer({ level, player, glitchIntensity, showVHSEffect, valveValues = {} }: GameRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const frameRef = useRef<number>(0)

  const drawPixelRect = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(width), Math.floor(height))
  }, [])

  const getActiveObstacles = useCallback((currentLevel: Level) => {
    if (currentLevel.isDark && !currentLevel.lightsOn && currentLevel.darkMazeWalls?.length) {
      return [...currentLevel.obstacles, ...currentLevel.darkMazeWalls]
    }

    return currentLevel.obstacles
  }, [])

  const getFlashlightOrigin = useCallback((currentPlayer: Player) => {
    const { x, y } = currentPlayer.position

    switch (currentPlayer.direction) {
      case 'up':
        return { x: x + 12, y: y + 12, angle: -Math.PI / 2 }
      case 'down':
        return { x: x + 12, y: y + 20, angle: Math.PI / 2 }
      case 'left':
        return { x: x + 6, y: y + 18, angle: Math.PI }
      default:
        return { x: x + 18, y: y + 18, angle: 0 }
    }
  }, [])

  const getBrokenFlashlightIntensity = useCallback((frame: number) => {
    const cycle = frame % 360
    const ambientPulse = 0.82 + Math.sin(frame * 0.06) * 0.04

    if (cycle >= 0 && cycle <= 9) return 0.45
    if (cycle >= 14 && cycle <= 22) return 1
    if (cycle >= 28 && cycle <= 36) return 0.6

    return ambientPulse
  }, [])

  const getEmergencyLightReveal = useCallback((currentLevel: Level, timeMs: number) => {
    if (!currentLevel.isDark || currentLevel.lightsOn) {
      return { isActive: false, overlayAlpha: 0 }
    }

    const darknessDurationMs = 7000
    const revealDurationMs = 3000
    const fadeDurationMs = 450
    const cycleDurationMs = darknessDurationMs + revealDurationMs
    const cycleTime = timeMs % cycleDurationMs
    const revealTime = cycleTime - darknessDurationMs

    if (revealTime < 0) {
      return { isActive: false, overlayAlpha: 0 }
    }

    const fadeIn = Math.min(1, revealTime / fadeDurationMs)
    const fadeOut = Math.min(1, (revealDurationMs - revealTime) / fadeDurationMs)
    const clarity = Math.max(0, Math.min(fadeIn, fadeOut))

    return {
      isActive: true,
      overlayAlpha: 0.12 + clarity * 0.14,
    }
  }, [])

  // Draw player sprite
  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D, player: Player, frame: number) => {
    const { x, y } = player.position
    const animFrame = player.isMoving ? Math.floor(frame / 8) % 4 : 0
    const flashlightActive = Boolean(level.isDark && !level.lightsOn && player.hasFlashlight)
    
    // Hiding state
    if (player.isHiding) {
      ctx.globalAlpha = 0.3
    }
    
    const bodyColor = player.isSprinting ? '#4a3a3a' : '#2d2d3a'
    const skinColor = '#e8c4a0'
    const hairColor = '#1a1a1a'
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.beginPath()
    ctx.ellipse(x + 12, y + 30, 10, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    if (flashlightActive) {
      ctx.strokeStyle = 'rgba(255, 244, 200, 0.45)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 3, y + 1, 18, 30)
    }
    
    const walkOffset = player.isMoving ? Math.sin(animFrame * Math.PI / 2) * 2 : 0
    
    // Body
    drawPixelRect(ctx, x + 4, y + 12 + walkOffset, 16, 14, bodyColor)
    
    // Head
    drawPixelRect(ctx, x + 6, y + 2, 12, 12, skinColor)
    
    // Hair
    drawPixelRect(ctx, x + 6, y + 2, 12, 4, hairColor)
    
    // Eyes
    ctx.fillStyle = '#1a1a1a'
    if (player.direction !== 'up') {
      drawPixelRect(ctx, x + 8, y + 7, 2, 2, '#1a1a1a')
      drawPixelRect(ctx, x + 14, y + 7, 2, 2, '#1a1a1a')
    } else {
      drawPixelRect(ctx, x + 6, y + 2, 12, 10, hairColor)
    }
    
    // Legs
    if (player.isMoving) {
      const legOffset = Math.sin(animFrame * Math.PI) * 3
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(x + 5, y + 24 - (animFrame % 2 === 0 ? legOffset : -legOffset), 5, 8)
      ctx.fillRect(x + 14, y + 24 + (animFrame % 2 === 0 ? legOffset : -legOffset), 5, 8)
    } else {
      drawPixelRect(ctx, x + 5, y + 24, 5, 8, '#1a1a2e')
      drawPixelRect(ctx, x + 14, y + 24, 5, 8, '#1a1a2e')
    }

    if (flashlightActive) {
      const { x: flashlightX, y: flashlightY } = getFlashlightOrigin(player)
      ctx.shadowColor = 'rgba(255, 240, 180, 0.85)'
      ctx.shadowBlur = 8
      drawPixelRect(ctx, flashlightX - 2, flashlightY - 1, 4, 3, '#9ca3af')
      drawPixelRect(ctx, flashlightX + 1, flashlightY - 1, 2, 3, '#fff4b5')
      ctx.shadowBlur = 0
    }
    
    ctx.globalAlpha = 1.0
  }, [drawPixelRect, getFlashlightOrigin, level.isDark, level.lightsOn])

  // Draw enemy sprite
  const drawEnemy = useCallback((ctx: CanvasRenderingContext2D, enemy: Enemy, frame: number) => {
    const { x, y } = enemy.position
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.beginPath()
    ctx.ellipse(x + enemy.width / 2, y + enemy.height - 2, enemy.width / 2.5, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    
    if (enemy.type === 'operator') {
      const glitchOffset = Math.random() * 4 - 2
      
      for (let i = 0; i < enemy.height; i += 4) {
        const offsetX = (Math.random() - 0.5) * glitchOffset
        const alpha = 0.5 + Math.random() * 0.5
        ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`
        ctx.fillRect(x + offsetX, y + i, enemy.width, 4)
      }
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.fillRect(x + 8, y + 4, enemy.width - 16, 16)
      
      ctx.fillStyle = '#ff0000'
      ctx.shadowColor = '#ff0000'
      ctx.shadowBlur = 10
      ctx.fillRect(x + 12 + Math.sin(frame * 0.1) * 2, y + 10, 6, 4)
      ctx.fillRect(x + enemy.width - 18 + Math.sin(frame * 0.1) * 2, y + 10, 6, 4)
      ctx.shadowBlur = 0
      
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + Math.random() * 0.3})`
      ctx.lineWidth = 1
      for (let i = 0; i < 3; i++) {
        const lineY = y + Math.random() * enemy.height
        ctx.beginPath()
        ctx.moveTo(x, lineY)
        ctx.lineTo(x + enemy.width, lineY)
        ctx.stroke()
      }
    } else if (enemy.type === 'echo') {
      const alpha = 0.4 + Math.sin(frame * 0.1) * 0.2
      
      ctx.fillStyle = `rgba(100, 150, 200, ${alpha})`
      ctx.fillRect(x + 2, y + 8, enemy.width - 4, enemy.height - 12)
      
      ctx.fillStyle = `rgba(150, 180, 220, ${alpha})`
      ctx.beginPath()
      ctx.arc(x + enemy.width / 2, y + 8, 8, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha + 0.3})`
      ctx.fillRect(x + 6, y + 5, 4, 4)
      ctx.fillRect(x + enemy.width - 10, y + 5, 4, 4)
      
      ctx.fillStyle = `rgba(100, 150, 200, ${alpha * 0.5})`
      for (let i = 0; i < enemy.width; i += 4) {
        const waveOffset = Math.sin((frame + i) * 0.2) * 4
        ctx.fillRect(x + i, y + enemy.height - 8 + waveOffset, 4, 8)
      }
    } else if (enemy.type === 'shadow') {
      const pulseSize = Math.sin(frame * 0.15) * 2
      
      ctx.fillStyle = 'rgba(10, 10, 20, 0.9)'
      ctx.beginPath()
      ctx.ellipse(x + enemy.width / 2, y + enemy.height / 2, 
        enemy.width / 2 + pulseSize, enemy.height / 2 + pulseSize, 0, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.95)'
      ctx.beginPath()
      ctx.ellipse(x + enemy.width / 2, y + enemy.height / 2, 
        enemy.width / 3, enemy.height / 3, 0, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.strokeStyle = 'rgba(10, 10, 20, 0.7)'
      ctx.lineWidth = 3
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + frame * 0.05
        const length = 15 + Math.sin(frame * 0.1 + i) * 5
        ctx.beginPath()
        ctx.moveTo(x + enemy.width / 2, y + enemy.height / 2)
        ctx.lineTo(
          x + enemy.width / 2 + Math.cos(angle) * length,
          y + enemy.height / 2 + Math.sin(angle) * length
        )
        ctx.stroke()
      }
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.fillRect(x + 6, y + enemy.height / 2 - 4, 4, 3)
      ctx.fillRect(x + enemy.width - 10, y + enemy.height / 2 - 4, 4, 3)
    } else if (enemy.type === 'stalker') {
      // Stalker - dark hooded figure
      const breathe = Math.sin(frame * 0.08) * 1
      
      // Cloak
      ctx.fillStyle = '#0a0a0f'
      ctx.beginPath()
      ctx.moveTo(x + enemy.width / 2, y + 4)
      ctx.lineTo(x, y + enemy.height)
      ctx.lineTo(x + enemy.width, y + enemy.height)
      ctx.closePath()
      ctx.fill()
      
      // Hood
      ctx.fillStyle = '#050508'
      ctx.beginPath()
      ctx.arc(x + enemy.width / 2, y + 12 + breathe, 12, 0, Math.PI * 2)
      ctx.fill()
      
      // Glowing eyes in hood
      if (enemy.behaviorState === 'chase') {
        ctx.fillStyle = '#ff0000'
        ctx.shadowColor = '#ff0000'
        ctx.shadowBlur = 8
      } else {
        ctx.fillStyle = '#ffcc00'
        ctx.shadowColor = '#ffcc00'
        ctx.shadowBlur = 5
      }
      ctx.fillRect(x + 10, y + 10 + breathe, 3, 2)
      ctx.fillRect(x + enemy.width - 13, y + 10 + breathe, 3, 2)
      ctx.shadowBlur = 0
    }
  }, [])

  // Draw collectible
  const drawCollectible = useCallback((ctx: CanvasRenderingContext2D, collectible: Collectible, frame: number) => {
    if (collectible.collected || collectible.hidden) return
    
    const { x, y } = collectible.position
    const floatOffset = Math.sin(frame * 0.1) * 3
    const glowPulse = 0.5 + Math.sin(frame * 0.15) * 0.3
    
    if (collectible.type === 'vhs_tape') {
      const tapeY = y + floatOffset
      
      ctx.shadowColor = '#ff3333'
      ctx.shadowBlur = 10 * glowPulse
      
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(x, tapeY, 24, 16)
      
      ctx.fillStyle = '#ff3333'
      ctx.fillRect(x + 2, tapeY + 2, 20, 8)
      
      ctx.fillStyle = '#cc0000'
      ctx.fillRect(x + 8, tapeY + 12, 8, 4)
      
      ctx.fillStyle = '#333'
      ctx.beginPath()
      ctx.arc(x + 8, tapeY + 8, 4, 0, Math.PI * 2)
      ctx.arc(x + 16, tapeY + 8, 4, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.shadowBlur = 0
    } else if (collectible.type === 'memory_fragment') {
      ctx.shadowColor = '#00ffff'
      ctx.shadowBlur = 15 * glowPulse
      
      ctx.fillStyle = `rgba(0, 255, 255, ${glowPulse})`
      ctx.beginPath()
      ctx.moveTo(x + 10, y + floatOffset)
      ctx.lineTo(x + 20, y + 10 + floatOffset)
      ctx.lineTo(x + 10, y + 20 + floatOffset)
      ctx.lineTo(x, y + 10 + floatOffset)
      ctx.closePath()
      ctx.fill()
      
      ctx.shadowBlur = 0
    } else if (collectible.type === 'key' || collectible.type === 'fuse') {
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 8 * glowPulse
      
      ctx.fillStyle = collectible.type === 'fuse' ? '#ff8800' : '#ffd700'
      ctx.fillRect(x + 6, y + floatOffset, 4, 12)
      ctx.fillRect(x + 2, y + floatOffset, 12, 4)
      
      if (collectible.type === 'key') {
        ctx.fillRect(x + 8, y + 8 + floatOffset, 6, 3)
        ctx.fillRect(x + 8, y + 14 + floatOffset, 6, 3)
      }
      
      ctx.shadowBlur = 0
    } else if (collectible.type === 'document' || collectible.type === 'code_piece') {
      ctx.fillStyle = '#f5f5dc'
      ctx.fillRect(x, y + floatOffset, 16, 20)
      
      ctx.fillStyle = '#333'
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + 2, y + 4 + i * 4 + floatOffset, 12, 1)
      }
      
      // Red mark for important documents
      ctx.fillStyle = '#cc0000'
      ctx.fillRect(x + 12, y + floatOffset, 4, 4)
    }
  }, [])

  // Draw obstacle
  const drawObstacle = useCallback((ctx: CanvasRenderingContext2D, obstacle: Obstacle, frame: number) => {
    const { x, y } = obstacle.position
    
    if (obstacle.type === 'wall') {
      ctx.fillStyle = '#2a2a35'
      ctx.fillRect(x, y, obstacle.width, obstacle.height)
      
      ctx.strokeStyle = '#1a1a25'
      ctx.lineWidth = 1
      for (let i = 0; i < obstacle.height; i += 12) {
        ctx.beginPath()
        ctx.moveTo(x, y + i)
        ctx.lineTo(x + obstacle.width, y + i)
        ctx.stroke()
        
        const offset = (i / 12) % 2 === 0 ? 0 : 15
        for (let j = offset; j < obstacle.width; j += 30) {
          ctx.beginPath()
          ctx.moveTo(x + j, y + i)
          ctx.lineTo(x + j, y + i + 12)
          ctx.stroke()
        }
      }
    } else if (obstacle.type === 'furniture') {
      ctx.fillStyle = '#3d3d4a'
      ctx.fillRect(x, y, obstacle.width, obstacle.height)
      
      ctx.fillStyle = '#4a4a5a'
      ctx.fillRect(x, y, obstacle.width, 4)
      
      ctx.fillStyle = '#2a2a35'
      ctx.fillRect(x, y + obstacle.height - 4, obstacle.width, 4)
    } else if (obstacle.type === 'debris') {
      ctx.fillStyle = '#1f1f28'
      for (let i = 0; i < 3; i++) {
        const ox = x + (i * obstacle.width / 3)
        const oy = y + Math.sin(i * 2) * 5
        const ow = obstacle.width / 3 + Math.random() * 4
        const oh = obstacle.height * (0.6 + Math.random() * 0.4)
        ctx.fillRect(ox, oy, ow, oh)
      }
      
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(x + obstacle.width / 4, y + obstacle.height / 3, obstacle.width / 2, obstacle.height / 3)
    } else if (obstacle.type === 'door') {
      if (obstacle.isOpen) {
        // Open door - just frame
        ctx.strokeStyle = '#2a1a0a'
        ctx.lineWidth = 4
        ctx.strokeRect(x, y, obstacle.width, obstacle.height)
      } else {
        ctx.fillStyle = '#4a3a2a'
        ctx.fillRect(x, y, obstacle.width, obstacle.height)
        
        ctx.strokeStyle = '#2a1a0a'
        ctx.lineWidth = 3
        ctx.strokeRect(x, y, obstacle.width, obstacle.height)
        
        // Lock indicator
        if (obstacle.requiresKey || obstacle.requiresCode) {
          ctx.fillStyle = '#cc0000'
          ctx.beginPath()
          ctx.arc(x + obstacle.width - 15, y + obstacle.height / 2, 6, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillStyle = '#c0a000'
          ctx.beginPath()
          ctx.arc(x + obstacle.width - 10, y + obstacle.height / 2, 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    } else if (obstacle.type === 'hiding_spot') {
      // Dumpster / hiding spot
      ctx.fillStyle = '#2a3a2a'
      ctx.fillRect(x, y, obstacle.width, obstacle.height)
      
      ctx.fillStyle = '#1a2a1a'
      ctx.fillRect(x + 5, y + 5, obstacle.width - 10, obstacle.height - 15)
      
      // Lid
      ctx.fillStyle = '#3a4a3a'
      ctx.fillRect(x - 3, y - 5, obstacle.width + 6, 8)
      
      // "HIDE" indicator
      ctx.fillStyle = '#00ff00'
      ctx.font = '8px monospace'
      ctx.fillText('HIDE', x + 12, y + obstacle.height + 12)
    }
  }, [])

  // Draw switch
  const drawSwitch = useCallback((ctx: CanvasRenderingContext2D, switchObj: Switch, frame: number, valveValue?: number) => {
    const { x, y } = switchObj.position
    const floatOffset = Math.sin(frame * 0.08) * 2
    
    if (switchObj.type === 'lever') {
      // Lever base
      ctx.fillStyle = '#3a3a4a'
      ctx.fillRect(x, y + 20, switchObj.width, 20)
      
      // Lever arm
      ctx.fillStyle = switchObj.isActivated ? '#00ff00' : '#ff4444'
      ctx.save()
      ctx.translate(x + switchObj.width / 2, y + 25)
      ctx.rotate(switchObj.isActivated ? -0.5 : 0.5)
      ctx.fillRect(-3, -25, 6, 30)
      ctx.restore()
      
      // Lever ball
      ctx.fillStyle = switchObj.isActivated ? '#00cc00' : '#cc0000'
      ctx.beginPath()
      ctx.arc(x + switchObj.width / 2 + (switchObj.isActivated ? -10 : 10), y + 10, 6, 0, Math.PI * 2)
      ctx.fill()
    } else if (switchObj.type === 'button') {
      // Memory station button
      ctx.fillStyle = '#2a2a3a'
      ctx.beginPath()
      ctx.arc(x + switchObj.width / 2, y + switchObj.height / 2, switchObj.width / 2, 0, Math.PI * 2)
      ctx.fill()
      
      // Glow when activated
      if (switchObj.isActivated) {
        ctx.fillStyle = '#00ffff'
        ctx.shadowColor = '#00ffff'
        ctx.shadowBlur = 15
      } else {
        ctx.fillStyle = '#4a4a6a'
      }
      ctx.beginPath()
      ctx.arc(x + switchObj.width / 2, y + switchObj.height / 2 + floatOffset, switchObj.width / 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      
      // Memory number
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(String(switchObj.correctSequenceIndex !== undefined ? switchObj.correctSequenceIndex + 1 : '?'), x + switchObj.width / 2, y + switchObj.height / 2 + 5 + floatOffset)
    } else if (switchObj.type === 'keypad') {
      // Keypad
      ctx.fillStyle = '#1a1a2a'
      ctx.fillRect(x, y, switchObj.width, switchObj.height)
      
      // Screen
      ctx.fillStyle = '#0a2010'
      ctx.fillRect(x + 3, y + 3, switchObj.width - 6, 15)
      
      // Keys
      ctx.fillStyle = '#3a3a4a'
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          ctx.fillRect(x + 4 + i * 8, y + 22 + j * 6, 6, 5)
        }
      }
      
      // Interact hint
      ctx.fillStyle = '#ffcc00'
      ctx.font = '8px monospace'
      ctx.fillText('E', x + switchObj.width / 2 - 3, y + switchObj.height + 10)
    } else if (switchObj.type === 'valve') {
      // Valve wheel
      ctx.strokeStyle = '#5a5a6a'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(x + switchObj.width / 2, y + switchObj.height / 2, 15, 0, Math.PI * 2)
      ctx.stroke()
      
      // Spokes
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(x + switchObj.width / 2, y + switchObj.height / 2)
        ctx.lineTo(
          x + switchObj.width / 2 + Math.cos(angle) * 12,
          y + switchObj.height / 2 + Math.sin(angle) * 12
        )
        ctx.stroke()
      }
      
      // Center with value
      ctx.fillStyle = '#2a2a3a'
      ctx.beginPath()
      ctx.arc(x + switchObj.width / 2, y + switchObj.height / 2, 8, 0, Math.PI * 2)
      ctx.fill()
      
      // Display value
      ctx.fillStyle = '#00ff00'
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(String(valveValue !== undefined ? valveValue : switchObj.dialValue || 0), x + switchObj.width / 2, y + switchObj.height / 2 + 4)
    } else if (switchObj.type === 'fuse_box') {
      // Fuse box
      ctx.fillStyle = '#2a2a3a'
      ctx.fillRect(x, y, switchObj.width, switchObj.height)
      
      ctx.strokeStyle = '#ffcc00'
      ctx.lineWidth = 2
      ctx.strokeRect(x + 2, y + 2, switchObj.width - 4, switchObj.height - 4)
      
      // Fuse slots
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#1a1a2a'
        ctx.fillRect(x + 8, y + 10 + i * 15, 24, 10)
      }
      
      ctx.fillStyle = '#ff6600'
      ctx.font = '8px monospace'
      ctx.fillText('FUSE', x + 8, y + switchObj.height + 10)
    }
  }, [])

  // Draw hazard zone
  const drawHazard = useCallback((ctx: CanvasRenderingContext2D, hazard: HazardZone, frame: number) => {
    const { x, y } = hazard.position
    
    if (!hazard.isActive && hazard.pattern === 'timed') {
      // Show outline when inactive
      ctx.strokeStyle = hazard.type === 'electric' ? 'rgba(0, 150, 255, 0.3)' : 'rgba(255, 100, 0, 0.3)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(x, y, hazard.width, hazard.height)
      ctx.setLineDash([])
      return
    }
    
    if (hazard.type === 'electric') {
      // Electric floor
      ctx.fillStyle = 'rgba(0, 150, 255, 0.3)'
      ctx.fillRect(x, y, hazard.width, hazard.height)
      
      // Lightning bolts
      ctx.strokeStyle = `rgba(150, 200, 255, ${0.5 + Math.random() * 0.5})`
      ctx.lineWidth = 2
      for (let i = 0; i < 3; i++) {
        const startX = x + Math.random() * hazard.width
        const startY = y
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        let currentX = startX
        let currentY = startY
        for (let j = 0; j < 4; j++) {
          currentX += (Math.random() - 0.5) * 20
          currentY += hazard.height / 4
          ctx.lineTo(currentX, currentY)
        }
        ctx.stroke()
      }
      
      // Sparks
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 5; i++) {
        const sparkX = x + Math.random() * hazard.width
        const sparkY = y + Math.random() * hazard.height
        ctx.fillRect(sparkX, sparkY, 2, 2)
      }
    } else if (hazard.type === 'fire') {
      const fireColors = ['#ff4500', '#ff6600', '#ff8800', '#ffaa00', '#ffcc00']
      
      for (let i = 0; i < hazard.width / 10; i++) {
        const flameHeight = hazard.height * (0.5 + Math.sin(frame * 0.3 + i) * 0.3)
        const flameWidth = 10
        const flameX = x + i * flameWidth
        const colorIndex = (i + Math.floor(frame / 5)) % fireColors.length
        
        ctx.fillStyle = fireColors[colorIndex]
        ctx.beginPath()
        ctx.moveTo(flameX, y + hazard.height)
        ctx.quadraticCurveTo(
          flameX + flameWidth / 2, y + hazard.height - flameHeight - Math.random() * 10,
          flameX + flameWidth, y + hazard.height
        )
        ctx.fill()
      }
      
      ctx.fillStyle = 'rgba(255, 100, 0, 0.3)'
      ctx.beginPath()
      ctx.ellipse(x + hazard.width / 2, y + hazard.height, hazard.width / 2, 10, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (hazard.type === 'gas') {
      // Poison gas
      ctx.fillStyle = `rgba(100, 200, 100, ${0.2 + Math.sin(frame * 0.05) * 0.1})`
      ctx.fillRect(x, y, hazard.width, hazard.height)
      
      // Gas particles
      for (let i = 0; i < 10; i++) {
        const px = x + ((frame * 0.5 + i * 50) % hazard.width)
        const py = y + hazard.height - ((frame * 0.3 + i * 30) % hazard.height)
        ctx.fillStyle = `rgba(150, 255, 150, ${0.3 + Math.random() * 0.2})`
        ctx.beginPath()
        ctx.arc(px, py, 5 + Math.random() * 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [])

  // Draw NPC
  const drawNPC = useCallback((ctx: CanvasRenderingContext2D, npc: NPC, frame: number) => {
    const { x, y } = npc.position
    const breathe = Math.sin(frame * 0.08) * 1
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.beginPath()
    ctx.ellipse(x + 12, y + 30, 10, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    
    let bodyColor = '#4a5568'
    let skinColor = '#e8c4a0'
    let hairColor = '#4a3728'
    
    if (npc.sprite === 'npc_female') {
      bodyColor = '#6b46c1'
      hairColor = '#1a1a1a'
    } else if (npc.sprite === 'npc_child') {
      bodyColor = '#48bb78'
      hairColor = '#8b4513'
    }
    
    drawPixelRect(ctx, x + 4, y + 12 + breathe, 16, 14, bodyColor)
    drawPixelRect(ctx, x + 6, y + 2 + breathe, 12, 12, skinColor)
    drawPixelRect(ctx, x + 6, y + 2 + breathe, 12, 4, hairColor)
    drawPixelRect(ctx, x + 8, y + 7 + breathe, 2, 2, '#1a1a1a')
    drawPixelRect(ctx, x + 14, y + 7 + breathe, 2, 2, '#1a1a1a')
    drawPixelRect(ctx, x + 5, y + 24, 5, 8, '#2d3748')
    drawPixelRect(ctx, x + 14, y + 24, 5, 8, '#2d3748')
    
    // Interaction indicator
    ctx.fillStyle = '#ffd700'
    ctx.shadowColor = '#ffd700'
    ctx.shadowBlur = 5
    const indicatorY = y - 15 + Math.sin(frame * 0.15) * 3
    ctx.beginPath()
    ctx.moveTo(x + 12, indicatorY)
    ctx.lineTo(x + 8, indicatorY - 8)
    ctx.lineTo(x + 16, indicatorY - 8)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
  }, [drawPixelRect])

  // Draw exit
  const drawExit = useCallback((ctx: CanvasRenderingContext2D, level: Level, frame: number) => {
    const { x, y } = level.exitPosition
    const pulse = 0.5 + Math.sin(frame * 0.1) * 0.3
    
    // Check if exit is locked
    const puzzle = level.puzzles.find(p => p.id === level.exitUnlockedBy)
    const isLocked = level.exitLocked && (!puzzle || !puzzle.isSolved)
    
    if (isLocked) {
      // Locked exit - red glow
      ctx.fillStyle = `rgba(255, 50, 50, ${pulse * 0.5})`
      ctx.fillRect(x, y, level.exitWidth, level.exitHeight)
      
      // Lock icon
      ctx.fillStyle = '#cc0000'
      ctx.fillRect(x + level.exitWidth / 2 - 8, y + level.exitHeight / 2 - 5, 16, 12)
      ctx.beginPath()
      ctx.arc(x + level.exitWidth / 2, y + level.exitHeight / 2 - 8, 6, Math.PI, 0)
      ctx.stroke()
    } else {
      // Unlocked exit - green glow
      ctx.shadowColor = '#00ff88'
      ctx.shadowBlur = 15 * pulse
      
      ctx.fillStyle = `rgba(0, 255, 136, ${pulse})`
      ctx.fillRect(x, y, level.exitWidth, level.exitHeight)
      
      ctx.fillStyle = `rgba(200, 255, 220, ${pulse * 0.5})`
      ctx.fillRect(x + 5, y + 5, level.exitWidth - 10, level.exitHeight - 10)
      
      // Arrow
      ctx.fillStyle = '#ffffff'
      const arrowY = y + level.exitHeight / 2 + Math.sin(frame * 0.15) * 5
      ctx.beginPath()
      ctx.moveTo(x + level.exitWidth / 2, arrowY - 10)
      ctx.lineTo(x + level.exitWidth / 2 - 8, arrowY + 5)
      ctx.lineTo(x + level.exitWidth / 2 + 8, arrowY + 5)
      ctx.closePath()
      ctx.fill()
      
      ctx.shadowBlur = 0
    }
  }, [])

  // Draw fog of war
  const drawFogOfWar = useCallback((ctx: CanvasRenderingContext2D, player: Player, level: Level, frame: number, emergencyRevealActive: boolean) => {
    if (!level.fogOfWar || level.lightsOn || emergencyRevealActive) return
    
    const playerCenterX = player.position.x + player.width / 2
    const playerCenterY = player.position.y + player.height / 2
    const baseRadius = level.visibilityRadius || 150

    if (level.isDark && player.hasFlashlight) {
      const intensity = getBrokenFlashlightIntensity(frame)
      const radius = baseRadius * (0.86 + intensity * 0.18)
      const beamLength = radius * 1.45
      const beamSpread = radius * 0.55
      const flashlight = getFlashlightOrigin(player)

      ctx.fillStyle = 'rgba(0, 0, 0, 0.96)'
      ctx.fillRect(0, 0, level.width, level.height)

      // Broken flashlight: a dim halo plus a cone that flickers three times every few seconds.
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.arc(playerCenterX, playerCenterY, radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.translate(flashlight.x, flashlight.y)
      ctx.rotate(flashlight.angle)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(beamLength, -beamSpread)
      ctx.quadraticCurveTo(beamLength * 1.05, 0, beamLength, beamSpread)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.globalCompositeOperation = 'screen'

      const glowGradient = ctx.createRadialGradient(
        flashlight.x,
        flashlight.y,
        radius * 0.12,
        flashlight.x,
        flashlight.y,
        radius
      )
      glowGradient.addColorStop(0, `rgba(255, 246, 200, ${0.16 + intensity * 0.12})`)
      glowGradient.addColorStop(0.55, `rgba(255, 226, 160, ${0.08 + intensity * 0.06})`)
      glowGradient.addColorStop(1, 'rgba(255, 226, 160, 0)')
      ctx.fillStyle = glowGradient
      ctx.beginPath()
      ctx.arc(flashlight.x, flashlight.y, radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.translate(flashlight.x, flashlight.y)
      ctx.rotate(flashlight.angle)
      const beamGradient = ctx.createLinearGradient(0, 0, beamLength, 0)
      beamGradient.addColorStop(0, `rgba(255, 240, 190, ${0.12 + intensity * 0.06})`)
      beamGradient.addColorStop(1, 'rgba(255, 240, 190, 0)')
      ctx.fillStyle = beamGradient
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(beamLength, -beamSpread)
      ctx.lineTo(beamLength, beamSpread)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      return
    }

    const gradient = ctx.createRadialGradient(
      playerCenterX,
      playerCenterY,
      baseRadius * 0.3,
      playerCenterX,
      playerCenterY,
      baseRadius
    )
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.7)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)')

    ctx.fillStyle = 'rgba(0, 0, 0, 0.95)'
    ctx.fillRect(0, 0, level.width, level.height)

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(playerCenterX, playerCenterY, baseRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, level.width, level.height)
  }, [getBrokenFlashlightIntensity, getFlashlightOrigin])

  // Draw VHS effect
  const drawVHSEffect = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, frame: number) => {
    // Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
    for (let i = 0; i < height; i += 3) {
      ctx.fillRect(0, i, width, 1)
    }
    
    // Noise
    if (intensity > 0) {
      const noiseIntensity = intensity / 100
      for (let i = 0; i < 50 * noiseIntensity; i++) {
        const nx = Math.random() * width
        const ny = Math.random() * height
        const ns = Math.random() * 3
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.3 * noiseIntensity})`
        ctx.fillRect(nx, ny, ns, ns)
      }
      
      // Glitch lines
      if (Math.random() < noiseIntensity * 0.3) {
        const glitchY = Math.random() * height
        const glitchHeight = 2 + Math.random() * 10
        ctx.fillStyle = `rgba(255, 0, 0, ${noiseIntensity * 0.3})`
        ctx.fillRect(0, glitchY, width, glitchHeight)
      }
    }
    
    // Tracking lines
    if (frame % 120 < 10) {
      const trackingY = (frame * 3) % (height + 100) - 50
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.fillRect(0, trackingY, width, 50)
    }
    
    // Vignette
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7)
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    // Red chromatic aberration
    if (intensity > 30) {
      ctx.fillStyle = `rgba(255, 0, 0, ${(intensity - 30) / 200})`
      ctx.fillRect(3, 0, width, height)
    }
  }, [])

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = () => {
      frameRef.current++
      const frame = frameRef.current
      const timeMs = performance.now()
      const activeObstacles = getActiveObstacles(level)
      const emergencyReveal = getEmergencyLightReveal(level, timeMs)
      const showFullLevel = level.lightsOn || emergencyReveal.isActive
      const backgroundColor = showFullLevel && level.litBackgroundColor ? level.litBackgroundColor : level.backgroundColor
      const ambientColor = showFullLevel && level.litAmbientColor ? level.litAmbientColor : level.ambientColor

      // Clear
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, level.width, level.height)

      // Floor pattern
      ctx.fillStyle = ambientColor
      for (let x = 0; x < level.width; x += 32) {
        for (let y = 0; y < level.height; y += 32) {
          if ((x + y) / 32 % 2 === 0) {
            ctx.fillRect(x, y, 32, 32)
          }
        }
      }

      // Draw hazard zones (behind everything)
      for (const hazard of level.hazardZones) {
        drawHazard(ctx, hazard, frame)
      }

      // Draw obstacles
      for (const obstacle of activeObstacles) {
        drawObstacle(ctx, obstacle, frame)
      }

      // Draw switches
      for (const switchObj of level.switches) {
        drawSwitch(ctx, switchObj, frame, valveValues[switchObj.id])
      }

      // Draw exit
      drawExit(ctx, level, frame)

      // Draw collectibles
      for (const collectible of level.collectibles) {
        drawCollectible(ctx, collectible, frame)
      }

      // Draw NPCs
      for (const npc of level.npcs) {
        drawNPC(ctx, npc, frame)
      }

      // Draw enemies
      for (const enemy of level.enemies) {
        if (enemy.isActive) {
          drawEnemy(ctx, enemy, frame)
        }
      }

      // Draw player
      drawPlayer(ctx, player, frame)

      if (emergencyReveal.isActive) {
        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        ctx.fillStyle = `rgba(255, 245, 214, ${emergencyReveal.overlayAlpha})`
        ctx.fillRect(0, 0, level.width, level.height)
        ctx.restore()
      }

      // Draw fog of war
      drawFogOfWar(ctx, player, level, frame, emergencyReveal.isActive)

      // Draw VHS effect
      if (showVHSEffect) {
        drawVHSEffect(ctx, level.width, level.height, glitchIntensity, frame)
      }

      animationRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [level, player, glitchIntensity, showVHSEffect, valveValues, drawPlayer, drawEnemy, drawCollectible, drawObstacle, drawSwitch, drawHazard, drawNPC, drawExit, drawFogOfWar, drawVHSEffect, getActiveObstacles, getEmergencyLightReveal])

  return (
    <canvas
      ref={canvasRef}
      width={level.width}
      height={level.height}
      className="border-4 border-red-900/50 shadow-2xl shadow-red-900/30"
      style={{ 
        imageRendering: 'pixelated',
        maxWidth: '100%',
        height: 'auto',
      }}
    />
  )
}
