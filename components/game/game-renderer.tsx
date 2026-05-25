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
type GlowTone = 'red' | 'cyan' | 'amber' | 'green' | 'white'

type CharacterRenderEntity = {
  kind: 'player' | 'enemy'
  enemyType?: Enemy['type']
  position: Position
  width: number
  height: number
  direction: Player['direction']
  isMoving: boolean
  frame: number
  isSprinting?: boolean
  isHiding?: boolean
  sanity?: number
  health?: number
  flashlightActive?: boolean
  behaviorState?: Enemy['behaviorState']
  stunned?: boolean
}

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

const getGlowColor = (tone: GlowTone): Rgb => {
  switch (tone) {
    case 'red':
      return RED_LIGHT
    case 'cyan':
      return CYAN_LIGHT
    case 'amber':
      return [255, 194, 76]
    case 'green':
      return [32, 255, 146]
    default:
      return [245, 250, 255]
  }
}

let globalMaskCanvas: HTMLCanvasElement | null = null;
let cachedFloorCanvas: Map<number, HTMLCanvasElement> = new Map();

export function GameRenderer({ level, player, glitchIntensity, showVHSEffect, valveValues = {} }: GameRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const frameRef = useRef<number>(0)
  const colorCacheRef = useRef<Record<string, string>>({})

  const drawPixelRect = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(width), Math.floor(height))
  }, [])

  const cachedObstaclesRef = useRef<Map<number, Obstacle[]>>(new Map())
  
  const getActiveObstacles = useCallback((currentLevel: Level) => {
    const cached = cachedObstaclesRef.current.get(currentLevel.id)
    if (cached) return cached
    
    let obstacles: Obstacle[]
    if (currentLevel.isDark && !currentLevel.lightsOn && currentLevel.darkMazeWalls?.length) {
      obstacles = currentLevel.obstacles.concat(currentLevel.darkMazeWalls)
    } else {
      obstacles = currentLevel.obstacles
    }
    
    cachedObstaclesRef.current.set(currentLevel.id, obstacles)
    return obstacles
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

  const drawShadow = useCallback((ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radiusX = 18, radiusY = 7, alpha = 0.34) => {
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

  const drawOutlinedPixelRect = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    outline = '#050507',
  ) => {
    drawPixelRect(ctx, x - 1, y - 1, width + 2, height + 2, outline)
    drawPixelRect(ctx, x, y, width, height, color)
  }, [drawPixelRect])

  const drawEyes = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    variant: 'player' | 'enemy' = 'player',
    frame = 0,
    intensity = 1,
    width = 2,
    gap = 6,
  ) => {
    const isPlayer = variant === 'player'
    const isBlinking = isPlayer && frame % 190 < 8

    if (isBlinking) {
      drawPixelRect(ctx, x, y + 1, width, 1, '#07070a')
      drawPixelRect(ctx, x + gap, y + 1, width, 1, '#07070a')
      return
    }

    const color = isPlayer ? '#f8fbff' : '#ff2a2a'
    const glowColor = isPlayer ? 'rgba(210, 245, 255, 0.9)' : 'rgba(255, 30, 30, 0.95)'
    const pulse = 0.75 + Math.sin(frame * (isPlayer ? 0.08 : 0.16)) * 0.25

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.shadowColor = glowColor
    ctx.shadowBlur = (isPlayer ? 8 : 14) * intensity * pulse
    drawPixelRect(ctx, x, y, width, 2, color)
    drawPixelRect(ctx, x + gap, y, width, 2, color)
    ctx.restore()

    drawPixelRect(ctx, x, y, width, 1, color)
    drawPixelRect(ctx, x + gap, y, width, 1, color)
  }, [drawPixelRect])

  const applySanityEffects = useCallback((ctx: CanvasRenderingContext2D, currentPlayer: Player, frame: number) => {
    const sanityPressure = clamp((42 - currentPlayer.sanity) / 42, 0, 1)
    const healthPressure = clamp((30 - currentPlayer.health) / 30, 0, 1)
    const dangerPressure = Math.max(sanityPressure, healthPressure)

    if (dangerPressure <= 0) return

    const glitchGate = frame % 28 < 5 ? 1 : 0.22
    const jitterX = Math.round((hashNumber(frame * 0.61 + currentPlayer.position.x) - 0.5) * 5 * dangerPressure * glitchGate)
    const jitterY = Math.round((hashNumber(frame * 0.47 + currentPlayer.position.y + 9) - 0.5) * 3 * dangerPressure * glitchGate)
    const shear = Math.sin(frame * 0.31) * 0.018 * sanityPressure
    const alphaDip = (frame % 18 < 3 ? 0.18 : 0.06) * dangerPressure

    ctx.translate(jitterX, jitterY)
    ctx.transform(1, shear, -shear * 0.45, 1, 0, 0)
    ctx.globalAlpha *= 1 - alphaDip
  }, [])

  const drawDecoration = useCallback((ctx: CanvasRenderingContext2D, decoration: any, frame: number) => {
    const { x, y } = decoration.position
    const { width, height, type, rotation = 0, opacity = 1, scale = 1 } = decoration
    
    ctx.save()
    ctx.translate(x + width / 2, y + height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(scale, scale)
    ctx.globalAlpha = opacity

    switch (type) {
      case 'blood':
        ctx.fillStyle = '#660a0a'
        ctx.beginPath()
        ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2)
        ctx.fill()
        // Splatters
        for (let i = 0; i < 3; i++) {
          const offX = Math.sin(i * 2.5) * (width / 3)
          const offY = Math.cos(i * 2.5) * (height / 3)
          ctx.beginPath()
          ctx.arc(offX, offY, width / 6, 0, Math.PI * 2)
          ctx.fill()
        }
        break
      case 'crack':
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(-width / 2, -height / 2)
        ctx.lineTo(0, 0)
        ctx.lineTo(width / 4, -height / 4)
        ctx.lineTo(width / 2, height / 2)
        ctx.stroke()
        break
      case 'poster':
        ctx.fillStyle = '#d1d5db'
        ctx.fillRect(-width / 2, -height / 2, width, height)
        ctx.fillStyle = '#4b5563'
        ctx.fillRect(-width / 2 + 2, -height / 2 + 2, width - 4, 2)
        ctx.fillRect(-width / 2 + 2, -height / 2 + 8, width - 6, 1)
        ctx.fillRect(-width / 2 + 2, -height / 2 + 12, width - 8, 1)
        break
      case 'plant':
        ctx.fillStyle = '#14532d'
        ctx.beginPath()
        ctx.moveTo(0, height / 2)
        ctx.quadraticCurveTo(-width / 2, 0, 0, -height / 2)
        ctx.quadraticCurveTo(width / 2, 0, 0, height / 2)
        ctx.fill()
        ctx.fillStyle = '#064e3b'
        ctx.fillRect(-2, 0, 4, height / 2)
        break
      case 'trash':
        ctx.fillStyle = '#374151'
        ctx.fillRect(-width / 2, -height / 4, width, height / 2)
        ctx.fillStyle = '#1f2937'
        ctx.fillRect(-width / 3, -height / 2, width / 1.5, height / 1.2)
        break
      case 'puddle':
        ctx.fillStyle = 'rgba(30, 41, 59, 0.4)'
        ctx.beginPath()
        ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
        ctx.stroke()
        break
      case 'cables':
        ctx.strokeStyle = '#111827'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(-width / 2, 0)
        ctx.bezierCurveTo(-width / 4, height / 2, width / 4, -height / 2, width / 2, 0)
        ctx.stroke()
        break
    }

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

  const drawBackgroundBlur = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, frame: number) => {
    const driftAlpha = 0.16 + Math.sin(frame * 0.012) * 0.025

    ctx.save()
    ctx.globalAlpha = driftAlpha
    ctx.filter = 'blur(0.75px)'
    ctx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, width, height)
    ctx.filter = 'none'
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.12
    ctx.fillStyle = '#090b12'
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  }, [])

  const applyDepthLayers = useCallback((ctx: CanvasRenderingContext2D, currentLevel: Level, currentPlayer: Player, frame: number) => {
    const focusX = currentPlayer.position.x + currentPlayer.width / 2
    const focusY = currentPlayer.position.y + currentPlayer.height / 2
    const radius = Math.max(210, Math.min(currentLevel.width, currentLevel.height) * 0.36)
    const pulse = 0.5 + Math.sin(frame * 0.025) * 0.5

    ctx.save()
    const focusShadow = ctx.createRadialGradient(focusX, focusY, 0, focusX, focusY, radius)
    focusShadow.addColorStop(0, 'rgba(0, 0, 0, 0)')
    focusShadow.addColorStop(0.52, 'rgba(0, 0, 0, 0.045)')
    focusShadow.addColorStop(1, `rgba(0, 0, 0, ${0.18 + pulse * 0.035})`)
    ctx.fillStyle = focusShadow
    ctx.fillRect(0, 0, currentLevel.width, currentLevel.height)

    const verticalDepth = ctx.createLinearGradient(0, 0, 0, currentLevel.height)
    verticalDepth.addColorStop(0, 'rgba(0, 0, 0, 0.18)')
    verticalDepth.addColorStop(0.2, 'rgba(0, 0, 0, 0.03)')
    verticalDepth.addColorStop(0.72, 'rgba(0, 0, 0, 0.02)')
    verticalDepth.addColorStop(1, 'rgba(0, 0, 0, 0.22)')
    ctx.fillStyle = verticalDepth
    ctx.fillRect(0, 0, currentLevel.width, currentLevel.height)
    ctx.restore()
  }, [])

  const drawInteractiveGlow = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    frame: number,
    tone: GlowTone = 'cyan',
    intensity = 1,
  ) => {
    const color = getGlowColor(tone)
    const centerX = x + width / 2
    const centerY = y + height / 2
    const radius = Math.max(width, height) * (1.45 + intensity * 0.28)
    const pulse = 0.68 + Math.sin(frame * 0.085 + x * 0.013 + y * 0.017) * 0.24
    const alpha = clamp((0.08 + intensity * 0.08) * pulse, 0.025, 0.28)

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
    glow.addColorStop(0, rgba(color, alpha))
    glow.addColorStop(0.46, rgba(color, alpha * 0.32))
    glow.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = glow
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)

    ctx.shadowColor = rgba(color, 0.75)
    ctx.shadowBlur = 8 + intensity * 8
    ctx.strokeStyle = rgba(color, 0.16 + intensity * 0.08)
    ctx.lineWidth = 1
    ctx.strokeRect(Math.floor(x) + 0.5, Math.floor(y) + 0.5, Math.floor(width), Math.floor(height))
    ctx.restore()
  }, [])

  const drawPlayerLight = useCallback((ctx: CanvasRenderingContext2D, currentPlayer: Player, currentLevel: Level, frame: number) => {
    const centerX = currentPlayer.position.x + currentPlayer.width / 2
    const centerY = currentPlayer.position.y + currentPlayer.height / 2 + 4
    const sanityPressure = clamp((70 - currentPlayer.sanity) / 70, 0, 1)
    const flashlightIntensity = currentPlayer.flashlightBroken ? getBrokenFlashlightIntensity(frame) : 1
    const auraPulse = 0.88 + Math.sin(frame * 0.055) * 0.08
    const auraRadius = (currentLevel.isDark && !currentLevel.lightsOn ? 92 : 66) + sanityPressure * 12

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    const aura = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, auraRadius)
    aura.addColorStop(0, rgba(WARM_LIGHT, 0.14 * auraPulse))
    aura.addColorStop(0.34, rgba(WARM_LIGHT, 0.06 * auraPulse))
    aura.addColorStop(0.78, rgba(CYAN_LIGHT, 0.018 * (1 - sanityPressure)))
    aura.addColorStop(1, rgba(WARM_LIGHT, 0))
    ctx.fillStyle = aura
    ctx.fillRect(centerX - auraRadius, centerY - auraRadius, auraRadius * 2, auraRadius * 2)

    if (currentPlayer.hasFlashlight) {
      const flashlight = getFlashlightOrigin(currentPlayer)
      const beamLength = currentLevel.isDark && !currentLevel.lightsOn ? 132 : 86
      const beamSpread = currentLevel.isDark && !currentLevel.lightsOn ? 44 : 30

      ctx.translate(flashlight.x, flashlight.y)
      ctx.rotate(flashlight.angle)
      const beam = ctx.createLinearGradient(0, 0, beamLength, 0)
      beam.addColorStop(0, rgba(WARM_LIGHT, 0.13 * flashlightIntensity))
      beam.addColorStop(0.48, rgba(WARM_LIGHT, 0.05 * flashlightIntensity))
      beam.addColorStop(1, rgba(WARM_LIGHT, 0))
      ctx.fillStyle = beam
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(beamLength, -beamSpread * 0.48)
      ctx.quadraticCurveTo(beamLength * 1.04, 0, beamLength, beamSpread * 0.48)
      ctx.closePath()
      ctx.fill()
    }

    ctx.restore()
  }, [getBrokenFlashlightIntensity, getFlashlightOrigin])

  const drawEnemyEffects = useCallback((ctx: CanvasRenderingContext2D, enemy: Enemy, frame: number) => {
    const { x, y } = enemy.position
    const centerX = x + enemy.width / 2
    const centerY = y + enemy.height / 2
    const chasePressure = enemy.behaviorState === 'chase' ? 1 : 0.55
    const isEcho = enemy.type === 'echo'
    const instabilitySeed = Math.floor(frame / 5) + x * 0.073 + y * 0.041
    const glitchBurst = hashNumber(instabilitySeed) > (enemy.type === 'operator' ? 0.58 : 0.78)
    const alpha = isEcho
      ? 0.72 + Math.sin(frame * 0.08 + x) * 0.18
      : glitchBurst ? 0.58 + hashNumber(instabilitySeed + 5) * 0.22 : 0.92 + Math.sin(frame * 0.035 + y) * 0.08
    const jitterX = glitchBurst ? Math.round((hashNumber(instabilitySeed + 9) - 0.5) * 7) : 0
    const jitterY = glitchBurst ? Math.round((hashNumber(instabilitySeed + 12) - 0.5) * 3) : 0
    const glowRadius = Math.max(enemy.width, enemy.height) * (enemy.type === 'operator' ? 2.6 : enemy.type === 'stalker' ? 2.25 : 1.8)

    drawShadow(
      ctx,
      centerX,
      y + enemy.height + 3,
      enemy.width * (enemy.type === 'operator' ? 0.8 : 0.64),
      enemy.type === 'echo' ? 6 : 9,
      enemy.type === 'echo' ? 0.24 : 0.55,
    )

    if (!isEcho) {
      drawLight(ctx, centerX + jitterX, centerY, glowRadius, RED_LIGHT, (0.09 + chasePressure * 0.08) * (glitchBurst ? 1.45 : 1))

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = glitchBurst ? 0.28 : 0.12
      ctx.fillStyle = 'rgba(255, 20, 20, 0.72)'
      for (let i = 0; i < 3; i++) {
        const seed = instabilitySeed + i * 13
        const sliceY = y + hashNumber(seed) * enemy.height
        const shift = (hashNumber(seed + 3) - 0.5) * 12
        ctx.fillRect(x - 6 + shift, sliceY, enemy.width + 12, 1 + Math.floor(hashNumber(seed + 6) * 2))
      }
      ctx.restore()
    }

    return { alpha: clamp(alpha, 0.45, 1), jitterX, jitterY }
  }, [drawLight, drawShadow])

  const drawAtmosphere = useCallback((ctx: CanvasRenderingContext2D, currentLevel: Level, currentPlayer: Player, frame: number) => {
    const playerX = currentPlayer.position.x + currentPlayer.width / 2
    const playerY = currentPlayer.position.y + currentPlayer.height / 2
    const sanityPressure = clamp((78 - currentPlayer.sanity) / 78, 0, 1)
    const darkness = currentLevel.isDark && !currentLevel.lightsOn ? 0.16 : 0.075

    ctx.save()
    const shadow = ctx.createRadialGradient(playerX, playerY, 76, playerX, playerY, Math.max(currentLevel.width, currentLevel.height) * 0.72)
    shadow.addColorStop(0, 'rgba(0, 0, 0, 0)')
    shadow.addColorStop(0.46, `rgba(0, 0, 0, ${darkness * 0.55})`)
    shadow.addColorStop(1, `rgba(0, 0, 0, ${0.26 + sanityPressure * 0.12})`)
    ctx.fillStyle = shadow
    ctx.fillRect(0, 0, currentLevel.width, currentLevel.height)

    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < 3; i++) {
      const seed = currentLevel.id * 67 + i * 29
      const fogX = (hashNumber(seed) * currentLevel.width + Math.sin(frame * 0.003 + i) * 58 + currentLevel.width) % currentLevel.width
      const fogY = (hashNumber(seed + 4) * currentLevel.height + Math.cos(frame * 0.002 + i) * 42 + currentLevel.height) % currentLevel.height
      const radius = 150 + hashNumber(seed + 8) * 160
      const fog = ctx.createRadialGradient(fogX, fogY, 0, fogX, fogY, radius)
      fog.addColorStop(0, `rgba(120, 150, 156, ${0.022 + sanityPressure * 0.018})`)
      fog.addColorStop(0.64, `rgba(120, 150, 156, ${0.006 + sanityPressure * 0.008})`)
      fog.addColorStop(1, 'rgba(120, 150, 156, 0)')
      ctx.fillStyle = fog
      ctx.fillRect(fogX - radius, fogY - radius, radius * 2, radius * 2)
    }

    ctx.restore()
  }, [])

  const drawFloorTexture = useCallback((ctx: CanvasRenderingContext2D, currentLevel: Level, ambientColor: string) => {
    // Check if we have a cached floor texture for this level
    let floorCanvas = cachedFloorCanvas.get(currentLevel.id)
    if (!floorCanvas) {
      floorCanvas = document.createElement('canvas')
      floorCanvas.width = currentLevel.width
      floorCanvas.height = currentLevel.height
      const fCtx = floorCanvas.getContext('2d', { willReadFrequently: false })!

      fCtx.globalAlpha = currentLevel.lightsOn ? 0.82 : 0.58

      for (let x = 0; x < currentLevel.width; x += FLOOR_TILE_SIZE) {
        for (let y = 0; y < currentLevel.height; y += FLOOR_TILE_SIZE) {
          const tileX = x / FLOOR_TILE_SIZE
          const tileY = y / FLOOR_TILE_SIZE
          const baseNoise = tileHash(tileX, tileY, currentLevel.id)
          const coolNoise = tileHash(tileX, tileY, 16)

          fCtx.fillStyle = ambientColor
          fCtx.fillRect(x, y, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE)

          fCtx.fillStyle = baseNoise > 0.52
            ? `rgba(18, 22, 34, ${0.1 + baseNoise * 0.08})`
            : `rgba(0, 0, 0, ${0.05 + (1 - baseNoise) * 0.09})`
          fCtx.fillRect(x, y, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE)

          fCtx.fillStyle = coolNoise > 0.64
            ? `rgba(84, 97, 118, ${0.025 + coolNoise * 0.028})`
            : `rgba(88, 22, 26, ${0.012 + coolNoise * 0.014})`
          fCtx.fillRect(x + 1, y + 1, FLOOR_TILE_SIZE - 2, FLOOR_TILE_SIZE - 2)

          fCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
          fCtx.lineWidth = 1
          fCtx.strokeRect(x + 0.5, y + 0.5, FLOOR_TILE_SIZE - 1, FLOOR_TILE_SIZE - 1)

          const scuff = tileHash(tileX, tileY, 2)
          if (scuff > 0.6) {
            const sx = x + 3 + Math.floor(tileHash(tileX, tileY, 3) * 22)
            const sy = y + 3 + Math.floor(tileHash(tileX, tileY, 4) * 22)
            fCtx.fillStyle = scuff > 0.84 ? 'rgba(0, 0, 0, 0.26)' : 'rgba(180, 190, 205, 0.035)'
            fCtx.fillRect(sx, sy, 5 + Math.floor(scuff * 10), 1)
            fCtx.fillRect(sx + 1, sy + 3, 2 + Math.floor(scuff * 6), 1)
          }

          const stain = tileHash(tileX, tileY, 5)
          if (stain > 0.88) {
            fCtx.fillStyle = `rgba(68, 9, 12, ${0.08 + stain * 0.08})`
            fCtx.beginPath()
            fCtx.ellipse(
              x + 8 + tileHash(tileX, tileY, 6) * 16,
              y + 8 + tileHash(tileX, tileY, 7) * 16,
              5 + tileHash(tileX, tileY, 8) * 12,
              2 + tileHash(tileX, tileY, 9) * 6,
              tileHash(tileX, tileY, 10) * Math.PI,
              0,
              Math.PI * 2
            )
            fCtx.fill()
          }

          const crack = tileHash(tileX, tileY, 11)
          if (crack < 0.16) {
            const crackX = x + 4 + tileHash(tileX, tileY, 12) * 22
            const crackY = y + 4 + tileHash(tileX, tileY, 13) * 22
            fCtx.strokeStyle = 'rgba(0, 0, 0, 0.28)'
            fCtx.lineWidth = 1
            fCtx.beginPath()
            fCtx.moveTo(crackX, crackY)
            fCtx.lineTo(crackX + 7 + crack * 18, crackY + 2 + tileHash(tileX, tileY, 14) * 10)
            fCtx.lineTo(crackX + 11 + crack * 10, crackY + 8 + tileHash(tileX, tileY, 15) * 13)
            fCtx.stroke()
          }
        }
      }

      cachedFloorCanvas.set(currentLevel.id, floorCanvas)
    }

    ctx.drawImage(floorCanvas, 0, 0)
  }, [])

  const drawMist = useCallback((ctx: CanvasRenderingContext2D, currentLevel: Level, frame: number, sanityPressure: number) => {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'

    const mistAlpha = 0.035 + sanityPressure * 0.035
    for (let i = 0; i < 3; i++) {
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
    const particleCount = Math.min(100, Math.max(50, Math.floor((currentLevel.width * currentLevel.height) / 15000)))

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

    const lockedDoorsCount = Math.min(8, activeObstacles.filter(o => o.type === 'door' && !o.isOpen && (o.requiresKey || o.requiresCode)).length)
    for (let i = 0; i < lockedDoorsCount; i++) {
      const obstacle = activeObstacles[i]
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

    const depthCount = Math.min(50, activeObstacles.length)
    for (let i = 0; i < depthCount; i++) {
      const obstacle = activeObstacles[i]
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
    const pulse = 0.5 + Math.sin(frame * 0.025) * 0.5
    ctx.fillStyle = `rgba(130, 0, 16, ${0.018 + pulse * 0.015})`
    ctx.fillRect(0, 0, width, height)

    ctx.restore()
  }, [])

  const drawCharacter = useCallback((ctx: CanvasRenderingContext2D, entity: CharacterRenderEntity) => {
    const { x, y } = entity.position
    const frame = entity.frame
    const isPlayer = entity.kind === 'player'
    const baseScale = isPlayer ? 1.12 : entity.enemyType === 'stalker' ? 1.08 : 1
    const breathScale = isPlayer && !entity.isMoving ? 1 + Math.sin(frame * 0.06) * 0.018 : 1
    const centerX = x + entity.width / 2
    const footY = y + entity.height
    const bob = entity.isMoving ? Math.sin(frame * 0.22) * 1.5 : Math.sin(frame * 0.055) * 1.4
    const headBob = bob * 0.48
    const step = entity.isMoving ? Math.sin(frame * 0.28) * 3.5 : 0

    ctx.save()
    ctx.translate(centerX, footY)
    ctx.scale(baseScale, baseScale * breathScale)
    ctx.translate(-centerX, -footY)

    if (isPlayer) {
      const bodyY = y + 11 + bob
      const headY = y + 2 + headBob
      const leftStep = step
      const rightStep = -step
      const bodyColor = entity.isSprinting ? '#6f1f22' : '#252733'
      const jacketHighlight = entity.isSprinting ? '#9b3033' : '#3b4150'
      const sleeveColor = entity.isSprinting ? '#421013' : '#191b24'
      const legColor = '#141620'
      const shoeColor = '#06070b'
      const skinColor = '#d7ad8f'
      const skinShadow = '#a87563'
      const hairColor = '#09090d'
      const sanityPressure = clamp((36 - (entity.sanity ?? 100)) / 36, 0, 1)

      drawOutlinedPixelRect(ctx, x + 4, y + 24 + leftStep, 6, 8, legColor)
      drawOutlinedPixelRect(ctx, x + 4, y + 31 + leftStep, 8, 3, shoeColor)
      drawOutlinedPixelRect(ctx, x + 14, y + 24 + rightStep, 6, 8, legColor)
      drawOutlinedPixelRect(ctx, x + 13, y + 31 + rightStep, 8, 3, shoeColor)

      drawOutlinedPixelRect(ctx, x + 1, bodyY + 3, 4, 12, sleeveColor)
      drawOutlinedPixelRect(ctx, x + 20, bodyY + 3, 4, 12, sleeveColor)
      drawOutlinedPixelRect(ctx, x + 3, bodyY, 18, 16, bodyColor)
      drawPixelRect(ctx, x + 4, bodyY + 1, 16, 2, jacketHighlight)
      drawPixelRect(ctx, x + 4, bodyY + 3, 2, 12, 'rgba(0, 0, 0, 0.28)')
      drawPixelRect(ctx, x + 11, bodyY + 2, 2, 14, '#0d0e14')
      drawPixelRect(ctx, x + 7, bodyY + 5, 3, 2, sanityPressure > 0.45 ? '#841515' : '#59616f')
      drawPixelRect(ctx, x + 14, bodyY + 7, 4, 1, '#59616f')

      drawOutlinedPixelRect(ctx, x + 6, headY, 12, 12, skinColor)
      drawPixelRect(ctx, x + 6, headY + 9, 12, 3, skinShadow)
      drawOutlinedPixelRect(ctx, x + 5, headY - 2, 14, 6, hairColor)
      drawPixelRect(ctx, x + 4, headY + 1, 2, 6, hairColor)
      drawPixelRect(ctx, x + 18, headY + 1, 2, 6, hairColor)

      if (entity.direction !== 'up') {
        drawEyes(ctx, x + 8, headY + 6, 'player', frame, 1 + sanityPressure * 0.5)
      }

      if (sanityPressure > 0.55) {
        drawPixelRect(ctx, x + 6, headY + 8, 12, 2, `rgba(135, 0, 0, ${0.12 + sanityPressure * 0.16})`)
      }

      if (entity.flashlightActive) {
        const handY = bodyY + 8
        const handX = entity.direction === 'left' ? x + 0 : entity.direction === 'right' ? x + 21 : x + 18
        const lensX = entity.direction === 'left' ? handX - 1 : handX + 4

        ctx.save()
        ctx.shadowColor = 'rgba(255, 242, 190, 0.72)'
        ctx.shadowBlur = 10
        drawOutlinedPixelRect(ctx, handX, handY, 6, 4, '#555f6d')
        drawPixelRect(ctx, handX + 1, handY + 1, 4, 2, '#7b8798')
        drawPixelRect(ctx, lensX, handY + 1, 2, 2, '#fff4ba')
        ctx.restore()
      }
    } else {
      const bodyY = y + 8 + bob
      const headY = y + 1 + headBob
      const chase = entity.behaviorState === 'chase'
      const coatColor = chase ? '#130507' : '#07080d'
      const coatLight = chase ? '#3a0b10' : '#171923'
      const legColor = '#030407'

      drawOutlinedPixelRect(ctx, x + 8, y + 25 + step, 6, 11, legColor)
      drawOutlinedPixelRect(ctx, x + 17, y + 25 - step, 6, 11, legColor)
      drawOutlinedPixelRect(ctx, x + 5, bodyY, 20, 23, coatColor)
      drawPixelRect(ctx, x + 7, bodyY + 2, 16, 2, coatLight)
      drawPixelRect(ctx, x + 14, bodyY + 3, 2, 18, '#010204')
      drawPixelRect(ctx, x + 9, bodyY + 9, 3, 2, '#4c1114')
      drawOutlinedPixelRect(ctx, x + 7, headY, 16, 13, '#07070a')
      drawPixelRect(ctx, x + 7, headY + 9, 16, 4, '#010102')
      drawEyes(ctx, x + 10, headY + 6, 'enemy', frame, chase ? 1.35 : 1, 3, 8)

      if (entity.stunned) {
        drawPixelRect(ctx, x + 4, bodyY + 6, 23, 1, 'rgba(103, 232, 249, 0.72)')
        drawPixelRect(ctx, x + 7, bodyY + 14, 18, 1, 'rgba(103, 232, 249, 0.5)')
      }
    }

    ctx.restore()
  }, [drawEyes, drawOutlinedPixelRect, drawPixelRect])

  const drawPlayerCriticalGlitch = useCallback((ctx: CanvasRenderingContext2D, currentPlayer: Player, frame: number) => {
    const { x, y } = currentPlayer.position
    const sanityPressure = clamp((32 - currentPlayer.sanity) / 32, 0, 1)
    const healthPressure = clamp((24 - currentPlayer.health) / 24, 0, 1)
    const pressure = Math.max(sanityPressure, healthPressure)

    if (pressure <= 0) return

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = 0.08 + pressure * 0.18

    for (let i = 0; i < 4; i++) {
      const seed = frame * 0.19 + i * 13.7
      const sliceY = y + 4 + hashNumber(seed) * (currentPlayer.height - 3)
      const shift = Math.round((hashNumber(seed + 4) - 0.5) * 12 * pressure)
      const sliceHeight = 1 + Math.floor(hashNumber(seed + 8) * 3)
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 35, 35, 0.9)' : 'rgba(80, 240, 255, 0.75)'
      ctx.fillRect(x - 4 + shift, sliceY, currentPlayer.width + 10, sliceHeight)
    }

    ctx.restore()
  }, [])

  // Draw player sprite
  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D, currentPlayer: Player, frame: number) => {
    const { x, y } = currentPlayer.position
    const flashlightActive = Boolean(level.isDark && !level.lightsOn && currentPlayer.hasFlashlight)
    const dangerPressure = Math.max(
      clamp((38 - currentPlayer.sanity) / 38, 0, 1),
      clamp((26 - currentPlayer.health) / 26, 0, 1),
    )
    const shadowPulse = currentPlayer.isMoving ? Math.sin(frame * 0.2) * 2.5 : Math.sin(frame * 0.06) * 1.2

    drawShadow(
      ctx,
      x + currentPlayer.width / 2,
      y + currentPlayer.height + 2,
      17 + shadowPulse,
      6.5,
      currentPlayer.isSprinting ? 0.5 : 0.38 + dangerPressure * 0.08,
    )

    ctx.save()
    if (currentPlayer.isHiding) {
      ctx.globalAlpha = 0.42
    }
    applySanityEffects(ctx, currentPlayer, frame)
    drawCharacter(ctx, {
      kind: 'player',
      position: currentPlayer.position,
      width: currentPlayer.width,
      height: currentPlayer.height,
      direction: currentPlayer.direction,
      isMoving: currentPlayer.isMoving,
      frame,
      isSprinting: currentPlayer.isSprinting,
      isHiding: currentPlayer.isHiding,
      sanity: currentPlayer.sanity,
      health: currentPlayer.health,
      flashlightActive,
    })
    ctx.restore()

    drawPlayerCriticalGlitch(ctx, currentPlayer, frame)
  }, [applySanityEffects, drawCharacter, drawPlayerCriticalGlitch, drawShadow, level.isDark, level.lightsOn])

  const drawEnemy = useCallback((ctx: CanvasRenderingContext2D, enemy: Enemy, frame: number) => {
    const { x, y } = enemy.position
    const t = frame * 0.1
    const centerX = x + enemy.width / 2
    const centerY = y + enemy.height / 2
    const chase = enemy.behaviorState === 'chase'
    const instability = drawEnemyEffects(ctx, enemy, frame)

    ctx.save()
    ctx.translate(instability.jitterX, instability.jitterY)
    ctx.globalAlpha *= instability.alpha
    
    if (enemy.type === 'operator') {
      const glitchSeed = hashNumber(frame * 0.37 + x * 0.11 + y * 0.07)
      const glitchX = Math.round(Math.sin(t * 2) * 1.4 + (frame % 24 < 5 ? (glitchSeed - 0.5) * 7 : 0))

      ctx.save()
      ctx.translate(glitchX, 0)
      
      drawOutlinedPixelRect(ctx, x + 5, y + 1, enemy.width - 10, enemy.height - 1, '#020203', '#000000')
      drawPixelRect(ctx, x + 7, y + 15, enemy.width - 14, enemy.height - 15, '#09090b')
      drawPixelRect(ctx, x + 9, y + 4, enemy.width - 18, 11, '#040405')
      
      for (let i = 0; i < 9; i++) {
        const seed = frame * 0.16 + i * 17.3
        const px = x + hashNumber(seed) * enemy.width
        const py = y + hashNumber(seed + 5) * enemy.height
        const size = 1 + Math.floor(hashNumber(seed + 8) * 3)
        ctx.fillStyle = hashNumber(seed + 11) > 0.64 ? '#ff2020' : 'rgba(255, 255, 255, 0.18)'
        ctx.fillRect(px, py, size, size)
      }

      const corePulse = 0.34 + Math.sin(t * 1.5) * 0.22
      drawPixelRect(ctx, x + enemy.width / 2 - 2, y + 18, 4, 13, `rgba(220, 0, 0, ${corePulse})`)
      drawEyes(ctx, x + 10, y + 8, 'enemy', frame, 1.65, 5, Math.max(6, enemy.width - 20))
      
      ctx.strokeStyle = `rgba(255, 40, 40, ${0.08 + hashNumber(frame * 0.2) * 0.08})`
      ctx.lineWidth = 1
      for (let i = 0; i < 4; i++) {
        const ly = y + ((i * 12 + t * 10) % enemy.height)
        ctx.beginPath()
        ctx.moveTo(x - 5, ly)
        ctx.lineTo(x + enemy.width + 5, ly)
        ctx.stroke()
      }
      
      ctx.restore()
    } else if (enemy.type === 'echo') {
      const alpha = 0.24 + Math.sin(t * 0.8) * 0.12
      ctx.save()
      
      for (let i = 3; i > 0; i--) {
        const ox = Math.sin(t - i * 0.28) * 8
        ctx.globalAlpha = alpha / (i + 1)
        drawPixelRect(ctx, x + 5 + ox, y + 4, enemy.width - 10, 12, '#b8c4d2')
        drawPixelRect(ctx, x + 4 + ox, y + 15, enemy.width - 8, enemy.height - 14, '#8da0b4')
      }

      ctx.globalAlpha = alpha + 0.18
      drawOutlinedPixelRect(ctx, x + 5, y + 4, enemy.width - 10, 12, '#cbd5e1', 'rgba(10, 13, 20, 0.7)')
      drawOutlinedPixelRect(ctx, x + 3, y + 15, enemy.width - 6, enemy.height - 14, '#9aa9bb', 'rgba(10, 13, 20, 0.72)')
      drawPixelRect(ctx, x + 6, y + enemy.height - 5, 5, 4, 'rgba(2, 6, 23, 0.45)')
      drawPixelRect(ctx, x + enemy.width - 11, y + enemy.height - 6, 5, 5, 'rgba(2, 6, 23, 0.45)')
      drawEyes(ctx, x + 9, y + 11, 'enemy', frame, 0.9, 2, Math.max(7, enemy.width - 18))
      
      ctx.restore()
    } else if (enemy.type === 'shadow') {
      const pulse = 1 + Math.sin(t * 1.2) * 0.08
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.scale(pulse, pulse)
      
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, enemy.width / 2 + 12)
      grad.addColorStop(0, '#020207')
      grad.addColorStop(0.48, '#10101a')
      grad.addColorStop(0.78, 'rgba(95, 12, 18, 0.38)')
      grad.addColorStop(1, 'transparent')
      
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(0, 0, enemy.width / 2 + 12, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = '#12131d'
      for (let i = 0; i < 12; i++) {
        const ang = t * 2 + i * (Math.PI / 6)
        const d = (Math.sin(t + i) * 0.5 + 0.5) * (enemy.width / 3)
        ctx.fillRect(Math.cos(ang) * d - 1, Math.sin(ang) * d - 1, 3, 3)
      }
      
      drawEyes(ctx, -6, -2, 'enemy', frame, 1.1, 2, 9)
      
      ctx.restore()
    } else if (enemy.type === 'stalker') {
      drawLight(ctx, centerX, centerY, enemy.width * 2.1, RED_LIGHT, chase ? 0.1 : 0.055)
      drawCharacter(ctx, {
        kind: 'enemy',
        enemyType: enemy.type,
        position: enemy.position,
        width: enemy.width,
        height: enemy.height,
        direction: enemy.direction,
        isMoving: enemy.behaviorState !== 'idle',
        frame,
        behaviorState: enemy.behaviorState,
        stunned: enemy.stunned,
      })
    }

    ctx.restore()
  }, [drawCharacter, drawEnemyEffects, drawEyes, drawLight, drawOutlinedPixelRect, drawPixelRect])

  // Draw collectible
  const drawCollectible = useCallback((ctx: CanvasRenderingContext2D, collectible: Collectible, frame: number) => {
    if (collectible.collected || collectible.hidden) return
    
    const { x, y } = collectible.position
    const floatOffset = Math.sin(frame * 0.1) * 3
    const glowPulse = 0.5 + Math.sin(frame * 0.15) * 0.3
    const tone: GlowTone = collectible.type === 'memory_fragment' || collectible.type === 'tool'
      ? 'cyan'
      : collectible.type === 'vhs_tape'
        ? 'red'
        : 'amber'

    drawInteractiveGlow(ctx, x, y + floatOffset, collectible.width || 22, collectible.height || 22, frame, tone, collectible.type === 'vhs_tape' ? 1.2 : 0.86)
    
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
    } else if (collectible.type === 'tool') {
      const toolY = y + floatOffset

      ctx.shadowColor = '#7dd3fc'
      ctx.shadowBlur = 12 * glowPulse

      ctx.fillStyle = '#0f172a'
      ctx.fillRect(x + 2, toolY + 2, 20, 20)

      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 2
      ctx.strokeRect(x + 2, toolY + 2, 20, 20)

      ctx.fillStyle = '#bae6fd'
      ctx.fillRect(x + 10, toolY + 5, 4, 14)
      ctx.fillRect(x + 5, toolY + 10, 14, 4)

      ctx.shadowBlur = 0
    }
  }, [drawInteractiveGlow])

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
      drawInteractiveGlow(
        ctx,
        x,
        y,
        obstacle.width,
        obstacle.height,
        frame,
        obstacle.requiresKey || obstacle.requiresCode ? 'red' : 'amber',
        obstacle.isOpen ? 0.36 : 0.74,
      )

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

        const doorLabels: Record<string, string> = {
          door_fire: '^',
          door_water: '~',
          door_eye: '()',
          door_dark: '#',
          door_light: '*',
        }
        const doorLabel = doorLabels[obstacle.id]
        if (doorLabel) {
          ctx.fillStyle = '#cbd5e1'
          ctx.font = 'bold 12px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(doorLabel, x + obstacle.width / 2, y + obstacle.height + 14)
          ctx.textAlign = 'start'
        }
      }
    } else if (obstacle.type === 'hiding_spot') {
      drawInteractiveGlow(ctx, x, y, obstacle.width, obstacle.height, frame, 'green', 0.42)

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
  }, [drawInteractiveGlow])

  // Draw switch
  const drawSwitch = useCallback((ctx: CanvasRenderingContext2D, switchObj: Switch, frame: number, valveValue?: number) => {
    const { x, y } = switchObj.position
    const floatOffset = Math.sin(frame * 0.08) * 2
    const glowTone: GlowTone = switchObj.isActivated
      ? 'green'
      : switchObj.type === 'keypad' || switchObj.type === 'fuse_box'
        ? 'amber'
        : 'cyan'

    drawInteractiveGlow(ctx, x, y, switchObj.width, switchObj.height, frame, glowTone, switchObj.isActivated ? 0.58 : 0.96)
    
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
  }, [drawInteractiveGlow])

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
      const electricSeed = frame * 0.37 + x * 0.11 + y * 0.17

      // Electric floor
      ctx.fillStyle = 'rgba(0, 150, 255, 0.3)'
      ctx.fillRect(x, y, hazard.width, hazard.height)
      
      // Lightning bolts
      ctx.strokeStyle = `rgba(150, 200, 255, ${0.5 + hashNumber(electricSeed) * 0.5})`
      ctx.lineWidth = 2
      for (let i = 0; i < 3; i++) {
        const boltSeed = electricSeed + i * 11.3
        const startX = x + hashNumber(boltSeed) * hazard.width
        const startY = y
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        let currentX = startX
        let currentY = startY
        for (let j = 0; j < 4; j++) {
          currentX += (hashNumber(boltSeed + j * 5.7) - 0.5) * 20
          currentY += hazard.height / 4
          ctx.lineTo(currentX, currentY)
        }
        ctx.stroke()
      }
      
      // Sparks
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 5; i++) {
        const sparkSeed = electricSeed + i * 19.9
        const sparkX = x + hashNumber(sparkSeed) * hazard.width
        const sparkY = y + hashNumber(sparkSeed + 4.4) * hazard.height
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
          flameX + flameWidth / 2, y + hazard.height - flameHeight - hashNumber(frame * 0.41 + i * 7.2 + x) * 10,
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
        const gasSeed = frame * 0.09 + i * 13.4 + y
        ctx.fillStyle = `rgba(150, 255, 150, ${0.3 + hashNumber(gasSeed) * 0.2})`
        ctx.beginPath()
        ctx.arc(px, py, 5 + hashNumber(gasSeed + 6.1) * 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [])

  // Draw NPC
  const drawNPC = useCallback((ctx: CanvasRenderingContext2D, npc: NPC, frame: number) => {
    const { x, y } = npc.position
    const breathe = Math.sin(frame * 0.08) * 1
    
    drawShadow(ctx, x + 12, y + 30, 12, 5, 0.3)
    
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
  }, [drawShadow, drawPixelRect])

  // Draw exit
  const drawExit = useCallback((ctx: CanvasRenderingContext2D, level: Level, frame: number) => {
    const { x, y } = level.exitPosition
    const pulse = 0.5 + Math.sin(frame * 0.1) * 0.3
    
    // Check if exit is locked
    const puzzle = level.puzzles.find(p => p.id === level.exitUnlockedBy)
    const isLocked = level.exitLocked && (!puzzle || !puzzle.isSolved)
    drawInteractiveGlow(ctx, x, y, level.exitWidth, level.exitHeight, frame, isLocked ? 'red' : 'green', isLocked ? 0.82 : 1.24)
    
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
  }, [drawInteractiveGlow])

  // Draw fog of war
  const drawFogOfWar = useCallback((ctx: CanvasRenderingContext2D, player: Player, level: Level, frame: number, emergencyRevealActive: boolean) => {
    if ((!level.fogOfWar && !level.isDark) || level.lightsOn || emergencyRevealActive) return

    const playerCenterX = player.position.x + player.width / 2
    const playerCenterY = player.position.y + player.height / 2
    const baseRadius = level.visibilityRadius || 150

    if (level.isDark && player.hasFlashlight) {
      const intensity = player.flashlightBroken ? getBrokenFlashlightIntensity(frame) : 1
      const radius = baseRadius * (0.88 + intensity * 0.28)
      const beamLength = radius * 1.68
      const beamSpread = radius * 0.58
      const flashlight = getFlashlightOrigin(player)

      // --- Step 1: Actively illuminate the scene within flashlight area ---
      // The scene colors are very dark, so we use 'lighter' to brighten them
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      // Radial ambient light around the player
      const ambientGlow = ctx.createRadialGradient(playerCenterX, playerCenterY, 0, playerCenterX, playerCenterY, radius)
      ambientGlow.addColorStop(0, `rgba(200, 190, 160, ${0.35 * intensity})`)
      ambientGlow.addColorStop(0.4, `rgba(180, 170, 140, ${0.18 * intensity})`)
      ambientGlow.addColorStop(0.75, `rgba(150, 140, 120, ${0.06 * intensity})`)
      ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = ambientGlow
      ctx.beginPath()
      ctx.arc(playerCenterX, playerCenterY, radius, 0, Math.PI * 2)
      ctx.fill()

      // Cone-shaped flashlight illumination
      ctx.translate(flashlight.x, flashlight.y)
      ctx.rotate(flashlight.angle)
      const coneBrightness = ctx.createLinearGradient(0, 0, beamLength, 0)
      coneBrightness.addColorStop(0, `rgba(220, 210, 170, ${0.45 * intensity})`)
      coneBrightness.addColorStop(0.35, `rgba(200, 190, 150, ${0.3 * intensity})`)
      coneBrightness.addColorStop(0.7, `rgba(160, 150, 120, ${0.12 * intensity})`)
      coneBrightness.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = coneBrightness
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(beamLength, -beamSpread * 0.9)
      ctx.quadraticCurveTo(beamLength * 1.08, 0, beamLength, beamSpread * 0.9)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // --- Step 2: Dark overlay with cutout for fog of war ---
      if (!globalMaskCanvas) {
        globalMaskCanvas = document.createElement('canvas')
      }
      if (globalMaskCanvas.width !== level.width || globalMaskCanvas.height !== level.height) {
        globalMaskCanvas.width = level.width
        globalMaskCanvas.height = level.height
      }

      const mCtx = globalMaskCanvas.getContext('2d')
      if (mCtx) {
        mCtx.globalCompositeOperation = 'source-over'
        mCtx.clearRect(0, 0, level.width, level.height)
        mCtx.fillStyle = `rgba(0, 0, 0, ${0.90 + (1 - intensity) * 0.04})`
        mCtx.fillRect(0, 0, level.width, level.height)

        mCtx.globalCompositeOperation = 'destination-out'

        const haloMask = mCtx.createRadialGradient(playerCenterX, playerCenterY, 0, playerCenterX, playerCenterY, radius)
        haloMask.addColorStop(0, `rgba(0, 0, 0, ${0.96 * intensity})`)
        haloMask.addColorStop(0.35, `rgba(0, 0, 0, ${0.75 * intensity})`)
        haloMask.addColorStop(0.7, `rgba(0, 0, 0, ${0.35 * intensity})`)
        haloMask.addColorStop(1, 'rgba(0, 0, 0, 0)')
        mCtx.fillStyle = haloMask
        mCtx.fillRect(playerCenterX - radius, playerCenterY - radius, radius * 2, radius * 2)

        mCtx.save()
        mCtx.translate(flashlight.x, flashlight.y)
        mCtx.rotate(flashlight.angle)

        const coneLayers = [
          { spread: 1.25, alpha: 0.4 },
          { spread: 0.88, alpha: 0.7 },
          { spread: 0.5, alpha: 0.95 },
        ]

        for (const layer of coneLayers) {
          const coneGradient = mCtx.createLinearGradient(0, 0, beamLength, 0)
          coneGradient.addColorStop(0, `rgba(0, 0, 0, ${layer.alpha * intensity})`)
          coneGradient.addColorStop(0.75, `rgba(0, 0, 0, ${layer.alpha * 0.45 * intensity})`)
          coneGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

          mCtx.fillStyle = coneGradient
          mCtx.beginPath()
          mCtx.moveTo(0, 0)
          mCtx.lineTo(beamLength, -beamSpread * layer.spread)
          mCtx.quadraticCurveTo(beamLength * 1.08, 0, beamLength, beamSpread * layer.spread)
          mCtx.closePath()
          mCtx.fill()
        }
        mCtx.restore()

        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        ctx.drawImage(globalMaskCanvas, 0, 0)
        ctx.restore()
      }

      // --- Step 3: Warm glow on top ---
      drawLight(ctx, flashlight.x, flashlight.y, radius * 0.88, WARM_LIGHT, 0.24 + intensity * 0.14)

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.translate(flashlight.x, flashlight.y)
      ctx.rotate(flashlight.angle)
      const beamGlow = ctx.createLinearGradient(0, 0, beamLength, 0)
      beamGlow.addColorStop(0, rgba(WARM_LIGHT, 0.15 + intensity * 0.1))
      beamGlow.addColorStop(0.52, rgba(WARM_LIGHT, 0.065 + intensity * 0.04))
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

    if (!globalMaskCanvas) {
      globalMaskCanvas = document.createElement('canvas')
    }
    if (globalMaskCanvas.width !== level.width || globalMaskCanvas.height !== level.height) {
      globalMaskCanvas.width = level.width
      globalMaskCanvas.height = level.height
    }

    const mCtx = globalMaskCanvas.getContext('2d')
    if (mCtx) {
      mCtx.globalCompositeOperation = 'source-over'
      mCtx.clearRect(0, 0, level.width, level.height)
      mCtx.fillStyle = 'rgba(0, 0, 0, 0.88)'
      mCtx.fillRect(0, 0, level.width, level.height)

      mCtx.globalCompositeOperation = 'destination-out'
      const revealGradient = mCtx.createRadialGradient(
        playerCenterX,
        playerCenterY,
        baseRadius * 0.1,
        playerCenterX,
        playerCenterY,
        baseRadius
      )
      revealGradient.addColorStop(0, 'rgba(0, 0, 0, 0.96)')
      revealGradient.addColorStop(0.62, 'rgba(0, 0, 0, 0.58)')
      revealGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      mCtx.fillStyle = revealGradient
      mCtx.fillRect(playerCenterX - baseRadius, playerCenterY - baseRadius, baseRadius * 2, baseRadius * 2)

      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(globalMaskCanvas, 0, 0)
      ctx.restore()
    }

    const edgeGradient = ctx.createRadialGradient(
      playerCenterX,
      playerCenterY,
      baseRadius * 0.34,
      playerCenterX,
      playerCenterY,
      baseRadius * 1.28
    )
    edgeGradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    edgeGradient.addColorStop(0.72, 'rgba(0, 0, 0, 0.12)')
    edgeGradient.addColorStop(1, 'rgba(0, 0, 0, 0.46)')
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

      // Background layer: floor, room shadows and distant decor get a tiny blur.
      drawFloorTexture(ctx, level, ambientColor)
      drawMapDepth(ctx, activeObstacles)

      if (level.decorations) {
        for (const decoration of level.decorations) {
          drawDecoration(ctx, decoration, frame)
        }
      }

      drawBackgroundBlur(ctx, level.width, level.height, frame)
      applyDepthLayers(ctx, level, player, frame)

      // World layer: hazards, walls, interactables and pickups.
      for (const hazard of level.hazardZones) {
        drawHazard(ctx, hazard, frame)
      }

      for (const obstacle of activeObstacles) {
        drawObstacle(ctx, obstacle, frame)
      }

      for (const switchObj of level.switches) {
        drawSwitch(ctx, switchObj, frame, valveValues[switchObj.id])
      }

      drawExit(ctx, level, frame)

      for (const collectible of level.collectibles) {
        drawCollectible(ctx, collectible, frame)
      }

      // Character layer: NPCs, enemies and player sit above the softened world.
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

      // Effects layer: focus lighting, threat glow, fog and VHS atmosphere.
      drawAtmosphere(ctx, level, player, frame)
      drawRedGlowLights(ctx, level, activeObstacles, frame)
      drawParticles(ctx, level, player, frame)

      if (emergencyReveal.isActive) {
        drawEmergencyReveal(ctx, level, player, frame, emergencyReveal.overlayAlpha)
      }

      // Draw fog of war
      drawFogOfWar(ctx, player, level, frame, emergencyReveal.isActive)
      drawPlayerLight(ctx, player, level, frame)

      // Post-processing
      if (level.id === 5) {
        ctx.save()
        ctx.globalCompositeOperation = 'screen'
        ctx.fillStyle = 'rgba(96, 125, 160, 0.18)'
        ctx.fillRect(0, 0, level.width, level.height)
        ctx.restore()
      } else {
        drawSceneColorGrade(ctx, level.width, level.height, frame, emergencyReveal.isActive)
      }
      drawSanityDistortion(ctx, level.width, level.height, player.sanity, frame)
      drawVignette(ctx, level.width, level.height, level.id === 5 ? 0.14 : 0.42 + clamp((80 - player.sanity) / 80, 0, 1) * 0.2)
      drawNoise(ctx, level.width, level.height, level.id === 5 ? 0.02 : 0.055 + clamp((70 - player.sanity) / 70, 0, 1) * 0.1, frame)

      if (showVHSEffect && level.id !== 5) {
        drawVHSEffect(ctx, level.width, level.height, glitchIntensity, frame)
      }

      animationRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      // Clean up floor cache if too large
      if (cachedFloorCanvas.size > 12) {
        cachedFloorCanvas.clear()
      }
      if (cachedObstaclesRef.current.size > 12) {
        cachedObstaclesRef.current.clear()
      }
    }
  }, [level, player, glitchIntensity, showVHSEffect, valveValues, drawPlayer, drawEnemy, drawCollectible, drawDecoration, drawObstacle, drawSwitch, drawHazard, drawNPC, drawExit, drawFloorTexture, drawMapDepth, drawBackgroundBlur, applyDepthLayers, drawAtmosphere, drawPlayerLight, drawRedGlowLights, drawParticles, drawEmergencyReveal, drawFogOfWar, drawSceneColorGrade, drawSanityDistortion, drawVignette, drawNoise, drawVHSEffect, getActiveObstacles, getEmergencyLightReveal])

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
