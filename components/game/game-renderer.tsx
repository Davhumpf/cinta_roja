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

type Rgb = readonly [number, number, number]

const FLOOR_TILE_SIZE = 48
const BASE_PARTICLE_COUNT = 96
const RED_LIGHT: Rgb = [255, 28, 28]
const WARM_LIGHT: Rgb = [255, 236, 176]
const CYAN_LIGHT: Rgb = [80, 240, 255]
const FIRE_LIGHT: Rgb = [255, 104, 28]

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const fract = (value: number) => value - Math.floor(value)

const hashNumber = (seed: number) => {
  return fract(Math.sin(seed * 12.9898) * 43758.5453123)
}

const tileHash = (tileX: number, tileY: number, salt = 0) => {
  return hashNumber(tileX * 127.1 + tileY * 311.7 + salt * 74.7)
}

const rgba = ([r, g, b]: Rgb, alpha: number) => {
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
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
      overlayAlpha: 0.08 + clarity * 0.11,
    }
  }, [])

  const drawEntityShadow = useCallback((ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radiusX: number, radiusY: number, alpha = 0.34) => {
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.scale(radiusX, radiusY)

    const gradient = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1)
    gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`)
    gradient.addColorStop(0.62, `rgba(0, 0, 0, ${alpha * 0.36})`)
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(0, 0, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, [])

  const drawLight = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, radius = 120, color: Rgb = WARM_LIGHT, alpha = 0.28) => {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, rgba(color, alpha))
    gradient.addColorStop(0.36, rgba(color, alpha * 0.38))
    gradient.addColorStop(0.72, rgba(color, alpha * 0.12))
    gradient.addColorStop(1, rgba(color, 0))

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, [])

  const drawFloorTexture = useCallback((ctx: CanvasRenderingContext2D, currentLevel: Level, ambientColor: string) => {
    ctx.save()
    ctx.globalAlpha = currentLevel.lightsOn ? 0.82 : 0.58

    for (let x = 0; x < currentLevel.width; x += FLOOR_TILE_SIZE) {
      for (let y = 0; y < currentLevel.height; y += FLOOR_TILE_SIZE) {
        const tileX = x / FLOOR_TILE_SIZE
        const tileY = y / FLOOR_TILE_SIZE
        const baseNoise = tileHash(tileX, tileY, currentLevel.id)
        const coolNoise = tileHash(tileX, tileY, 16)

        ctx.fillStyle = ambientColor
        ctx.fillRect(x, y, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE)

        ctx.fillStyle = baseNoise > 0.52
          ? `rgba(18, 22, 34, ${0.1 + baseNoise * 0.08})`
          : `rgba(0, 0, 0, ${0.05 + (1 - baseNoise) * 0.09})`
        ctx.fillRect(x, y, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE)

        ctx.fillStyle = coolNoise > 0.64
          ? `rgba(84, 97, 118, ${0.025 + coolNoise * 0.028})`
          : `rgba(88, 22, 26, ${0.012 + coolNoise * 0.014})`
        ctx.fillRect(x + 1, y + 1, FLOOR_TILE_SIZE - 2, FLOOR_TILE_SIZE - 2)

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
        ctx.lineWidth = 1
        ctx.strokeRect(x + 0.5, y + 0.5, FLOOR_TILE_SIZE - 1, FLOOR_TILE_SIZE - 1)

        const scuff = tileHash(tileX, tileY, 2)
        if (scuff > 0.6) {
          const sx = x + 3 + Math.floor(tileHash(tileX, tileY, 3) * 22)
          const sy = y + 3 + Math.floor(tileHash(tileX, tileY, 4) * 22)
          ctx.fillStyle = scuff > 0.84 ? 'rgba(0, 0, 0, 0.26)' : 'rgba(180, 190, 205, 0.035)'
          ctx.fillRect(sx, sy, 5 + Math.floor(scuff * 10), 1)
          ctx.fillRect(sx + 1, sy + 3, 2 + Math.floor(scuff * 6), 1)
        }

        const stain = tileHash(tileX, tileY, 5)
        if (stain > 0.88) {
          ctx.fillStyle = `rgba(68, 9, 12, ${0.08 + stain * 0.08})`
          ctx.beginPath()
          ctx.ellipse(
            x + 8 + tileHash(tileX, tileY, 6) * 16,
            y + 8 + tileHash(tileX, tileY, 7) * 16,
            5 + tileHash(tileX, tileY, 8) * 12,
            2 + tileHash(tileX, tileY, 9) * 6,
            tileHash(tileX, tileY, 10) * Math.PI,
            0,
            Math.PI * 2
          )
          ctx.fill()
        }

        const crack = tileHash(tileX, tileY, 11)
        if (crack < 0.16) {
          const crackX = x + 4 + tileHash(tileX, tileY, 12) * 22
          const crackY = y + 4 + tileHash(tileX, tileY, 13) * 22
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(crackX, crackY)
          ctx.lineTo(crackX + 7 + crack * 18, crackY + 2 + tileHash(tileX, tileY, 14) * 10)
          ctx.lineTo(crackX + 11 + crack * 10, crackY + 8 + tileHash(tileX, tileY, 15) * 13)
          ctx.stroke()
        }
      }
    }

    ctx.restore()
  }, [])

  const drawMist = useCallback((ctx: CanvasRenderingContext2D, currentLevel: Level, frame: number, sanityPressure: number) => {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'

    const mistAlpha = 0.035 + sanityPressure * 0.035
    for (let i = 0; i < 5; i++) {
      const seed = currentLevel.id * 31 + i * 17
      const centerX = (hashNumber(seed) * currentLevel.width + Math.sin(frame * 0.004 + i) * 42 + currentLevel.width) % currentLevel.width
      const centerY = (hashNumber(seed + 3) * currentLevel.height + Math.cos(frame * 0.003 + i * 1.7) * 28 + currentLevel.height) % currentLevel.height
      const radiusX = 110 + hashNumber(seed + 7) * 140
      const radiusY = 24 + hashNumber(seed + 11) * 38

      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.scale(1, radiusY / radiusX)
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX)
      gradient.addColorStop(0, `rgba(120, 145, 150, ${mistAlpha})`)
      gradient.addColorStop(0.62, `rgba(120, 145, 150, ${mistAlpha * 0.34})`)
      gradient.addColorStop(1, 'rgba(120, 145, 150, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(0, 0, radiusX, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    ctx.restore()
  }, [])

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D, currentLevel: Level, currentPlayer: Player, frame: number) => {
    const sanityPressure = clamp((70 - currentPlayer.sanity) / 70, 0, 1)
    const hasFire = currentLevel.id >= 8 || currentLevel.hazardZones.some(hazard => hazard.type === 'fire')
    const particleCount = Math.min(150, Math.max(70, Math.floor((currentLevel.width * currentLevel.height) / 12000), BASE_PARTICLE_COUNT))

    drawMist(ctx, currentLevel, frame, sanityPressure)

    ctx.save()
    ctx.globalCompositeOperation = hasFire ? 'source-over' : 'screen'

    for (let i = 0; i < particleCount; i++) {
      const seed = i * 19.19 + currentLevel.id * 41.7
      const drift = Math.sin(frame * (0.004 + hashNumber(seed + 5) * 0.004) + seed) * (10 + hashNumber(seed + 6) * 18)
      const fallSpeed = hasFire ? 0.12 + hashNumber(seed + 7) * 0.34 : 0.04 + hashNumber(seed + 7) * 0.12
      const x = (hashNumber(seed) * currentLevel.width + drift + currentLevel.width) % currentLevel.width
      const y = (hashNumber(seed + 2) * currentLevel.height + frame * fallSpeed) % currentLevel.height
      const size = hashNumber(seed + 3) > 0.86 ? 2 : 1
      const alpha = 0.08 + hashNumber(seed + 4) * 0.14 + sanityPressure * 0.05

      ctx.fillStyle = hasFire
        ? `rgba(176, 150, 128, ${alpha})`
        : `rgba(170, 205, 210, ${alpha})`
      ctx.fillRect(Math.floor(x), Math.floor(y), size, size)
    }

    ctx.restore()
  }, [drawMist])

  const drawRedGlowLights = useCallback((ctx: CanvasRenderingContext2D, currentLevel: Level, activeObstacles: Obstacle[], frame: number) => {
    const pulse = 0.82 + Math.sin(frame * 0.075) * 0.18

    for (const hazard of currentLevel.hazardZones) {
      if (!hazard.isActive) continue
      const centerX = hazard.position.x + hazard.width / 2
      const centerY = hazard.position.y + hazard.height / 2

      if (hazard.type === 'fire') {
        drawLight(ctx, centerX, centerY, Math.max(hazard.width, hazard.height) * 1.5, FIRE_LIGHT, 0.34 * pulse)
      } else if (hazard.type === 'electric') {
        drawLight(ctx, centerX, centerY, Math.max(hazard.width, hazard.height), CYAN_LIGHT, 0.18 * pulse)
      }
    }

    for (const obstacle of activeObstacles) {
      if (obstacle.type === 'door' && !obstacle.isOpen && (obstacle.requiresKey || obstacle.requiresCode)) {
        drawLight(ctx, obstacle.position.x + obstacle.width - 15, obstacle.position.y + obstacle.height / 2, 74, RED_LIGHT, 0.22 * pulse)
      }
    }

    for (const switchObj of currentLevel.switches) {
      const centerX = switchObj.position.x + switchObj.width / 2
      const centerY = switchObj.position.y + switchObj.height / 2

      if (switchObj.type === 'lever' && !switchObj.isActivated) {
        drawLight(ctx, centerX + 10, centerY - 12, 68, RED_LIGHT, 0.24 * pulse)
      } else if (switchObj.type === 'button' && switchObj.isActivated) {
        drawLight(ctx, centerX, centerY, 82, CYAN_LIGHT, 0.24 * pulse)
      } else if (switchObj.type === 'fuse_box') {
        drawLight(ctx, centerX, centerY, 72, FIRE_LIGHT, 0.12 * pulse)
      }
    }

    if (currentLevel.exitLocked) {
      drawLight(
        ctx,
        currentLevel.exitPosition.x + currentLevel.exitWidth / 2,
        currentLevel.exitPosition.y + currentLevel.exitHeight / 2,
        Math.max(currentLevel.exitWidth, currentLevel.exitHeight) * 1.45,
        RED_LIGHT,
        0.2 * pulse
      )
    }

    for (const enemy of currentLevel.enemies) {
      if (!enemy.isActive) continue
      if (enemy.type === 'operator' || (enemy.type === 'stalker' && enemy.behaviorState === 'chase')) {
        drawLight(
          ctx,
          enemy.position.x + enemy.width / 2,
          enemy.position.y + enemy.height * 0.35,
          92,
          RED_LIGHT,
          enemy.type === 'operator' ? 0.3 * pulse : 0.18 * pulse
        )
      }
    }
  }, [drawLight])

  const drawMapDepth = useCallback((ctx: CanvasRenderingContext2D, activeObstacles: Obstacle[]) => {
    ctx.save()

    for (const obstacle of activeObstacles) {
      if (!obstacle.solid && obstacle.type !== 'furniture' && obstacle.type !== 'door') continue

      const { x, y } = obstacle.position
      const alpha = obstacle.type === 'wall' ? 0.3 : 0.2

      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`
      ctx.fillRect(x + 5, y + 6, obstacle.width, obstacle.height)

      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.42})`
      ctx.fillRect(x - 6, y + obstacle.height - 3, obstacle.width + 12, 10)
    }

    ctx.restore()
  }, [])

  const drawEmergencyReveal = useCallback((ctx: CanvasRenderingContext2D, currentLevel: Level, currentPlayer: Player, frame: number, overlayAlpha: number) => {
    const playerCenterX = currentPlayer.position.x + currentPlayer.width / 2
    const playerCenterY = currentPlayer.position.y + currentPlayer.height / 2
    const pulse = 0.7 + Math.sin(frame * 0.16) * 0.3

    drawLight(ctx, playerCenterX, playerCenterY, Math.max(currentLevel.width, currentLevel.height) * 0.62, FIRE_LIGHT, overlayAlpha * 0.72)

    for (const switchObj of currentLevel.switches) {
      if (switchObj.type === 'fuse_box') {
        drawLight(
          ctx,
          switchObj.position.x + switchObj.width / 2,
          switchObj.position.y + switchObj.height / 2,
          130,
          FIRE_LIGHT,
          overlayAlpha * (1.1 + pulse * 0.4)
        )
      }
    }

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = `rgba(255, 118, 54, ${overlayAlpha * 0.2})`
    ctx.fillRect(0, 0, currentLevel.width, currentLevel.height)

    const sweepY = (frame * 7) % (currentLevel.height + 120) - 60
    const sweep = ctx.createLinearGradient(0, sweepY - 42, 0, sweepY + 42)
    sweep.addColorStop(0, 'rgba(255, 50, 30, 0)')
    sweep.addColorStop(0.5, `rgba(255, 82, 42, ${overlayAlpha * 0.55})`)
    sweep.addColorStop(1, 'rgba(255, 50, 30, 0)')
    ctx.fillStyle = sweep
    ctx.fillRect(0, sweepY - 42, currentLevel.width, 84)

    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `rgba(0, 0, 0, ${0.16 + (1 - pulse) * 0.08})`
    for (let y = frame % 6; y < currentLevel.height; y += 12) {
      ctx.fillRect(0, y, currentLevel.width, 2)
    }

    ctx.restore()
  }, [drawLight])

  const drawSceneColorGrade = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, frame: number, emergencyRevealActive: boolean) => {
    ctx.save()

    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = emergencyRevealActive ? 'rgba(38, 8, 10, 0.3)' : 'rgba(6, 9, 18, 0.28)'
    ctx.fillRect(0, 0, width, height)

    ctx.globalCompositeOperation = 'screen'
    const diagonal = ctx.createLinearGradient(0, 0, width, height)
    diagonal.addColorStop(0, emergencyRevealActive ? 'rgba(255, 55, 30, 0.045)' : 'rgba(20, 52, 80, 0.035)')
    diagonal.addColorStop(0.48, 'rgba(0, 0, 0, 0)')
    diagonal.addColorStop(1, emergencyRevealActive ? 'rgba(255, 150, 40, 0.03)' : 'rgba(95, 12, 18, 0.04)')
    ctx.fillStyle = diagonal
    ctx.fillRect(0, 0, width, height)

    const pulse = 0.5 + Math.sin(frame * 0.025) * 0.5
    ctx.fillStyle = `rgba(130, 0, 16, ${0.018 + pulse * 0.015})`
    ctx.fillRect(0, 0, width, height)

    ctx.restore()
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
    
    drawEntityShadow(ctx, x + 12, y + 30, 13, 5, player.isSprinting ? 0.42 : 0.32)

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
  }, [drawEntityShadow, drawPixelRect, getFlashlightOrigin, level.isDark, level.lightsOn])

  // Draw enemy sprite
  const drawEnemy = useCallback((ctx: CanvasRenderingContext2D, enemy: Enemy, frame: number) => {
    const { x, y } = enemy.position
    
    drawEntityShadow(ctx, x + enemy.width / 2, y + enemy.height - 2, enemy.width / 2.1, 5, enemy.behaviorState === 'chase' ? 0.52 : 0.38)
    
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
  }, [drawEntityShadow])

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
      const wallGradient = ctx.createLinearGradient(x, y, x + obstacle.width, y + obstacle.height)
      wallGradient.addColorStop(0, '#202431')
      wallGradient.addColorStop(0.55, '#171a25')
      wallGradient.addColorStop(1, '#0d0f16')
      ctx.fillStyle = wallGradient
      ctx.fillRect(x, y, obstacle.width, obstacle.height)

      ctx.fillStyle = 'rgba(112, 122, 142, 0.12)'
      ctx.fillRect(x, y, obstacle.width, 2)
      ctx.fillRect(x, y, 2, obstacle.height)

      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)'
      ctx.fillRect(x, y + obstacle.height - 3, obstacle.width, 3)
      ctx.fillRect(x + obstacle.width - 3, y, 3, obstacle.height)

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)'
      ctx.lineWidth = 1
      if (obstacle.width > 48 || obstacle.height > 48) {
        for (let i = 18; i < obstacle.height; i += 32) {
          ctx.beginPath()
          ctx.moveTo(x + 4, y + i)
          ctx.lineTo(x + obstacle.width - 4, y + i + Math.sin(i + obstacle.width) * 2)
          ctx.stroke()
        }

        for (let i = 22; i < obstacle.width; i += 44) {
          const crackStart = y + 8 + tileHash(i, obstacle.height, 21) * Math.max(4, obstacle.height - 20)
          ctx.beginPath()
          ctx.moveTo(x + i, crackStart)
          ctx.lineTo(x + i + 6, crackStart + 8)
          ctx.lineTo(x + i + 2, crackStart + 14)
          ctx.stroke()
        }
      }
    } else if (obstacle.type === 'furniture') {
      const furnitureGradient = ctx.createLinearGradient(x, y, x, y + obstacle.height)
      furnitureGradient.addColorStop(0, '#454455')
      furnitureGradient.addColorStop(0.48, '#2d2f3d')
      furnitureGradient.addColorStop(1, '#171923')
      ctx.fillStyle = furnitureGradient
      ctx.fillRect(x, y, obstacle.width, obstacle.height)
      
      ctx.fillStyle = 'rgba(165, 170, 185, 0.14)'
      ctx.fillRect(x + 2, y + 2, obstacle.width - 4, 3)
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.fillRect(x, y + obstacle.height - 5, obstacle.width, 5)
      ctx.fillRect(x + obstacle.width - 4, y + 4, 4, obstacle.height - 4)

      ctx.fillStyle = 'rgba(92, 18, 22, 0.12)'
      ctx.fillRect(x + 6, y + Math.max(8, obstacle.height * 0.46), Math.max(8, obstacle.width - 12), 2)
    } else if (obstacle.type === 'debris') {
      ctx.fillStyle = '#1f1f28'
      for (let i = 0; i < 3; i++) {
        const seed = x * 0.13 + y * 0.19 + i * 9.7
        const ox = x + (i * obstacle.width / 3)
        const oy = y + Math.sin(i * 2) * 5
        const ow = obstacle.width / 3 + hashNumber(seed) * 4
        const oh = obstacle.height * (0.6 + hashNumber(seed + 2) * 0.4)
        ctx.fillRect(ox, oy, ow, oh)
      }
      
      ctx.fillStyle = '#0a0a0f'
      ctx.fillRect(x + obstacle.width / 4, y + obstacle.height / 3, obstacle.width / 2, obstacle.height / 3)
    } else if (obstacle.type === 'door') {
      if (obstacle.isOpen) {
        // Open door - just frame
        ctx.strokeStyle = '#1b120b'
        ctx.lineWidth = 4
        ctx.strokeRect(x, y, obstacle.width, obstacle.height)
      } else {
        const doorGradient = ctx.createLinearGradient(x, y, x + obstacle.width, y)
        doorGradient.addColorStop(0, '#3b261f')
        doorGradient.addColorStop(0.5, '#6a3c31')
        doorGradient.addColorStop(1, '#241712')
        ctx.fillStyle = doorGradient
        ctx.fillRect(x, y, obstacle.width, obstacle.height)
        
        ctx.fillStyle = 'rgba(255, 165, 120, 0.12)'
        ctx.fillRect(x + 4, y + 4, obstacle.width - 8, 2)

        ctx.strokeStyle = '#130b08'
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
    
    drawEntityShadow(ctx, x + 12, y + 30, 12, 5, 0.3)
    
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
  }, [drawEntityShadow, drawPixelRect])

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
    if ((!level.fogOfWar && !level.isDark) || level.lightsOn || emergencyRevealActive) return
    
    const playerCenterX = player.position.x + player.width / 2
    const playerCenterY = player.position.y + player.height / 2
    const baseRadius = level.visibilityRadius || 150

    if (level.isDark && player.hasFlashlight) {
      const intensity = player.flashlightBroken ? getBrokenFlashlightIntensity(frame) : 1
      const radius = baseRadius * (0.9 + intensity * 0.3)
      const beamLength = radius * 1.72
      const beamSpread = radius * 0.62
      const flashlight = getFlashlightOrigin(player)

      ctx.save()
      ctx.fillStyle = `rgba(0, 0, 0, ${0.88 + (1 - intensity) * 0.04})`
      ctx.fillRect(0, 0, level.width, level.height)

      ctx.globalCompositeOperation = 'destination-out'

      const haloMask = ctx.createRadialGradient(playerCenterX, playerCenterY, 0, playerCenterX, playerCenterY, radius)
      haloMask.addColorStop(0, `rgba(0, 0, 0, ${0.92 * intensity})`)
      haloMask.addColorStop(0.4, `rgba(0, 0, 0, ${0.65 * intensity})`)
      haloMask.addColorStop(0.75, `rgba(0, 0, 0, ${0.28 * intensity})`)
      haloMask.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = haloMask
      ctx.fillRect(playerCenterX - radius, playerCenterY - radius, radius * 2, radius * 2)

      ctx.translate(flashlight.x, flashlight.y)
      ctx.rotate(flashlight.angle)

      const coneLayers = [
        { spread: 1.22, alpha: 0.38 },
        { spread: 0.85, alpha: 0.62 },
        { spread: 0.5, alpha: 0.88 },
      ]

      for (const layer of coneLayers) {
        const coneGradient = ctx.createLinearGradient(0, 0, beamLength, 0)
        coneGradient.addColorStop(0, `rgba(0, 0, 0, ${layer.alpha * intensity})`)
        coneGradient.addColorStop(0.7, `rgba(0, 0, 0, ${layer.alpha * 0.4 * intensity})`)
        coneGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

        ctx.fillStyle = coneGradient
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(beamLength, -beamSpread * layer.spread)
        ctx.quadraticCurveTo(beamLength * 1.08, 0, beamLength, beamSpread * layer.spread)
        ctx.closePath()
        ctx.fill()
      }

      ctx.restore()

      drawLight(ctx, flashlight.x, flashlight.y, radius * 0.9, WARM_LIGHT, 0.25 + intensity * 0.15)

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.translate(flashlight.x, flashlight.y)
      ctx.rotate(flashlight.angle)
      const beamGlow = ctx.createLinearGradient(0, 0, beamLength, 0)
      beamGlow.addColorStop(0, rgba(WARM_LIGHT, 0.16 + intensity * 0.1))
      beamGlow.addColorStop(0.5, rgba(WARM_LIGHT, 0.07 + intensity * 0.04))
      beamGlow.addColorStop(1, rgba(WARM_LIGHT, 0))
      ctx.fillStyle = beamGlow
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(beamLength, -beamSpread * 0.6)
      ctx.quadraticCurveTo(beamLength * 1.02, 0, beamLength, beamSpread * 0.6)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      return
    }

    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.94)'
    ctx.fillRect(0, 0, level.width, level.height)

    ctx.globalCompositeOperation = 'destination-out'
    const revealGradient = ctx.createRadialGradient(
      playerCenterX,
      playerCenterY,
      baseRadius * 0.1,
      playerCenterX,
      playerCenterY,
      baseRadius
    )
    revealGradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)')
    revealGradient.addColorStop(0.62, 'rgba(0, 0, 0, 0.42)')
    revealGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = revealGradient
    ctx.fillRect(playerCenterX - baseRadius, playerCenterY - baseRadius, baseRadius * 2, baseRadius * 2)
    ctx.restore()

    const edgeGradient = ctx.createRadialGradient(
      playerCenterX,
      playerCenterY,
      baseRadius * 0.34,
      playerCenterX,
      playerCenterY,
      baseRadius * 1.28
    )
    edgeGradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    edgeGradient.addColorStop(0.72, 'rgba(0, 0, 0, 0.18)')
    edgeGradient.addColorStop(1, 'rgba(0, 0, 0, 0.64)')
    ctx.fillStyle = edgeGradient
    ctx.fillRect(0, 0, level.width, level.height)
  }, [drawLight, getBrokenFlashlightIntensity, getFlashlightOrigin])

  const drawVignette = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, intensity = 0.46) => {
    const radius = Math.max(width, height) * 0.72
    const gradient = ctx.createRadialGradient(width / 2, height / 2, radius * 0.1, width / 2, height / 2, radius)
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(0.62, `rgba(0, 0, 0, ${intensity * 0.18})`)
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }, [])

  const drawScanlines = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, frame: number, alpha = 0.12) => {
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`
    for (let y = frame % 3; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1)
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'
    for (let y = (frame * 2) % 9; y < height; y += 18) {
      ctx.fillRect(0, y, width, 1)
    }
  }, [])

  const drawNoise = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, intensity = 0.18, frame = 0) => {
    const normalized = clamp(intensity, 0, 1)
    const grainCount = Math.floor(70 + normalized * 180)

    ctx.save()
    for (let i = 0; i < grainCount; i++) {
      const seed = frame * 23.17 + i * 9.73
      const x = Math.floor(hashNumber(seed) * width)
      const y = Math.floor(hashNumber(seed + 2.3) * height)
      const widthNoise = 1 + Math.floor(hashNumber(seed + 4.6) * 3)
      const alpha = (0.035 + hashNumber(seed + 7.4) * 0.11) * normalized
      const lightNoise = hashNumber(seed + 8.8) > 0.48

      ctx.fillStyle = lightNoise ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha * 1.35})`
      ctx.fillRect(x, y, widthNoise, 1)
    }
    ctx.restore()
  }, [])

  const drawChromaticAberration = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, amount: number, frame: number) => {
    const normalized = clamp(amount, 0, 1)
    if (normalized <= 0.01) return

    const shift = 1 + Math.floor(normalized * 3 + Math.abs(Math.sin(frame * 0.05)) * normalized * 2)

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = 0.025 + normalized * 0.045
    ctx.filter = 'sepia(1) saturate(3) hue-rotate(-35deg)'
    ctx.drawImage(ctx.canvas, -shift, 0, width, height)
    ctx.filter = 'sepia(1) saturate(3) hue-rotate(145deg)'
    ctx.drawImage(ctx.canvas, shift, 0, width, height)
    ctx.filter = 'none'
    ctx.restore()
  }, [])

  const drawSanityDistortion = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, sanity: number, frame: number) => {
    const pressure = clamp((72 - sanity) / 72, 0, 1)
    if (pressure <= 0) return

    ctx.save()
    const bands = 2 + Math.floor(pressure * 6)
    for (let i = 0; i < bands; i++) {
      const bandHeight = Math.max(8, Math.floor(8 + hashNumber(i * 17 + frame * 0.03) * 20))
      const y = Math.floor((height / bands) * i + Math.sin(frame * 0.03 + i) * 16)
      const shift = Math.sin(frame * 0.09 + i * 1.8) * (2 + pressure * 8)
      ctx.globalAlpha = 0.035 + pressure * 0.06
      ctx.drawImage(ctx.canvas, 0, clamp(y, 0, height - bandHeight), width, bandHeight, shift, clamp(y, 0, height - bandHeight), width, bandHeight)
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = `rgba(255, 0, 30, ${pressure * 0.035})`
    ctx.fillRect(0, 0, width, height)
    ctx.restore()

    drawChromaticAberration(ctx, width, height, pressure * 0.48, frame)
  }, [drawChromaticAberration])

  // Draw VHS effect
  const drawVHSEffect = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number, frame: number) => {
    const noiseIntensity = clamp(intensity / 100, 0, 1)

    drawChromaticAberration(ctx, width, height, 0.05 + noiseIntensity * 0.32, frame)
    drawScanlines(ctx, width, height, frame, 0.055 + noiseIntensity * 0.06)
    drawNoise(ctx, width, height, 0.12 + noiseIntensity * 0.46, frame)

    if (noiseIntensity > 0.05) {
      const glitchSeed = Math.floor(frame / 5)
      if (hashNumber(glitchSeed + 91) < noiseIntensity * 0.48) {
        const glitchY = Math.floor(hashNumber(glitchSeed + 7) * height)
        const glitchHeight = 2 + Math.floor(hashNumber(glitchSeed + 11) * 10)
        const offset = Math.floor((hashNumber(glitchSeed + 13) - 0.5) * 18 * noiseIntensity)

        ctx.save()
        ctx.globalAlpha = 0.16 + noiseIntensity * 0.18
        ctx.drawImage(ctx.canvas, 0, glitchY, width, glitchHeight, offset, glitchY, width, glitchHeight)
        ctx.globalCompositeOperation = 'screen'
        ctx.fillStyle = `rgba(255, 20, 20, ${noiseIntensity * 0.22})`
        ctx.fillRect(0, glitchY, width, glitchHeight)
        ctx.restore()
      }
    }

    if (frame % 120 < 10) {
      const trackingY = (frame * 3) % (height + 100) - 50
      ctx.fillStyle = 'rgba(255, 255, 255, 0.045)'
      ctx.fillRect(0, trackingY, width, 50)
    }

    drawVignette(ctx, width, height, 0.5 + noiseIntensity * 0.18)
  }, [drawChromaticAberration, drawNoise, drawScanlines, drawVignette])

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false

    const render = () => {
      frameRef.current++
      const frame = frameRef.current
      const timeMs = performance.now()
      const activeObstacles = getActiveObstacles(level)
      const emergencyReveal = getEmergencyLightReveal(level, timeMs)
      const showFullLevel = Boolean(level.lightsOn)
      const backgroundColor = showFullLevel && level.litBackgroundColor ? level.litBackgroundColor : level.backgroundColor
      const ambientColor = showFullLevel && level.litAmbientColor ? level.litAmbientColor : level.ambientColor

      // Clear
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, level.width, level.height)

      // Floor texture
      drawFloorTexture(ctx, level, ambientColor)

      // Room depth shadows
      drawMapDepth(ctx, activeObstacles)

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

      // Dynamic glow and ambient particles
      drawRedGlowLights(ctx, level, activeObstacles, frame)
      drawParticles(ctx, level, player, frame)

      if (emergencyReveal.isActive) {
        drawEmergencyReveal(ctx, level, player, frame, emergencyReveal.overlayAlpha)
      }

      // Draw fog of war
      drawFogOfWar(ctx, player, level, frame, emergencyReveal.isActive)

      // Post-processing
      drawSceneColorGrade(ctx, level.width, level.height, frame, emergencyReveal.isActive)
      drawSanityDistortion(ctx, level.width, level.height, player.sanity, frame)
      drawVignette(ctx, level.width, level.height, 0.42 + clamp((80 - player.sanity) / 80, 0, 1) * 0.2)
      drawNoise(ctx, level.width, level.height, 0.055 + clamp((70 - player.sanity) / 70, 0, 1) * 0.1, frame)

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
  }, [level, player, glitchIntensity, showVHSEffect, valveValues, drawPlayer, drawEnemy, drawCollectible, drawObstacle, drawSwitch, drawHazard, drawNPC, drawExit, drawFloorTexture, drawMapDepth, drawRedGlowLights, drawParticles, drawEmergencyReveal, drawFogOfWar, drawSceneColorGrade, drawSanityDistortion, drawVignette, drawNoise, drawVHSEffect, getActiveObstacles, getEmergencyLightReveal])

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
