'use client'

import { useRef, useCallback, useEffect, useMemo, useState } from 'react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type MusicMode = 'title' | 'ambient' | 'tension' | 'chase' | 'horror' | 'dark' | 'victory' | 'gameover' | 'silence'
type SFXType =
  | 'footstep'
  | 'sprint'
  | 'collect_tape'
  | 'collect_item'
  | 'door_open'
  | 'door_locked'
  | 'switch_on'
  | 'switch_off'
  | 'switch_wrong'
  | 'enemy_detect'
  | 'enemy_nearby'
  | 'damage'
  | 'hide'
  | 'unhide'
  | 'glitch'
  | 'dialogue_blip'
  | 'keypad_press'
  | 'keypad_success'
  | 'keypad_fail'
  | 'sanity_low'
  | 'level_complete'
  | 'static_burst'
  | 'heartbeat'

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────
function createOsc(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType = 'sine',
  detune = 0,
): OscillatorNode {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  osc.detune.value = detune
  return osc
}

function createGain(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain()
  g.gain.value = value
  return g
}

function createFilter(
  ctx: AudioContext,
  type: BiquadFilterType,
  freq: number,
  q = 1,
): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}

// ─────────────────────────────────────────────
// Procedural music layers
// ─────────────────────────────────────────────
interface MusicLayer {
  nodes: AudioNode[]
  gainNode: GainNode
  intervalId?: ReturnType<typeof setInterval>
  intervalIds?: ReturnType<typeof setInterval>[]
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

function clearMusicLayer(layer: MusicLayer | null) {
  if (layer?.intervalId) clearInterval(layer.intervalId)
  layer?.intervalIds?.forEach(clearInterval)
}

function buildDroneLayer(ctx: AudioContext, dest: AudioNode): MusicLayer {
  const masterGain = createGain(ctx, 0)
  const freqs = [27.5, 41.2, 55, 58.3, 82.5, 110.8]
  const nodes: AudioNode[] = [masterGain]

  freqs.forEach((freq, i) => {
    const osc = createOsc(ctx, freq, i % 2 === 0 ? 'sawtooth' : 'triangle', i * 5 - 12)
    const gain = createGain(ctx, 0.035 - i * 0.003)
    const filter = createFilter(ctx, 'lowpass', 130 + i * 26, 1.2)
    const wobble = createOsc(ctx, 0.035 + i * 0.011, 'sine')
    const wobbleGain = createGain(ctx, 5 + i * 1.3)

    wobble.connect(wobbleGain)
    wobbleGain.connect(osc.detune)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(masterGain)
    wobble.start()
    osc.start()
    nodes.push(osc, gain, filter, wobble, wobbleGain)
  })

  masterGain.connect(dest)
  return { nodes, gainNode: masterGain }
}

function buildStaticLayer(ctx: AudioContext, dest: AudioNode): MusicLayer {
  const masterGain = createGain(ctx, 0)
  const bufferSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.15

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const filter = createFilter(ctx, 'bandpass', 800, 0.5)
  source.connect(filter)
  filter.connect(masterGain)
  masterGain.connect(dest)
  source.start()

  return { nodes: [source, filter, masterGain], gainNode: masterGain }
}

function buildPulseLayer(ctx: AudioContext, dest: AudioNode): MusicLayer {
  const masterGain = createGain(ctx, 0)
  const osc = createOsc(ctx, 40, 'square')
  const gain = createGain(ctx, 0)
  const filter = createFilter(ctx, 'lowpass', 120, 2)

  // LFO for rhythmic pulse
  const lfo = createOsc(ctx, 1.4, 'sine')
  const lfoGain = createGain(ctx, 0.04)
  lfo.connect(lfoGain)
  lfoGain.connect(gain.gain)
  lfo.start()

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(masterGain)
  masterGain.connect(dest)
  osc.start()

  return { nodes: [osc, gain, filter, lfo, lfoGain, masterGain], gainNode: masterGain }
}

function buildMelodyLayer(ctx: AudioContext, dest: AudioNode): MusicLayer {
  const masterGain = createGain(ctx, 0)
  const osc1 = createOsc(ctx, 220, 'sine', -14)
  const osc2 = createOsc(ctx, 233.1, 'sine', 9)
  const osc3 = createOsc(ctx, 311.1, 'triangle', -6)
  const g1 = createGain(ctx, 0.022)
  const g2 = createGain(ctx, 0.018)
  const g3 = createGain(ctx, 0.012)
  const filter = createFilter(ctx, 'bandpass', 560, 1.8)
  const wobble = createOsc(ctx, 0.07, 'sine')
  const wobbleGain = createGain(ctx, 80)

  osc1.connect(g1); g1.connect(filter)
  osc2.connect(g2); g2.connect(filter)
  osc3.connect(g3); g3.connect(filter)
  wobble.connect(wobbleGain); wobbleGain.connect(filter.frequency)
  filter.connect(masterGain)
  masterGain.connect(dest)
  osc1.start(); osc2.start(); osc3.start(); wobble.start()

  return { nodes: [osc1, osc2, osc3, g1, g2, g3, filter, wobble, wobbleGain, masterGain], gainNode: masterGain }
}

function buildDissonanceLayer(ctx: AudioContext, dest: AudioNode): MusicLayer {
  const masterGain = createGain(ctx, 0)
  const shiverGain = createGain(ctx, 0.018)
  const subGain = createGain(ctx, 0.03)
  const filter = createFilter(ctx, 'lowpass', 240, 1.6)
  const lfo = createOsc(ctx, 0.19, 'sine')
  const lfoGain = createGain(ctx, 0.01)

  const beatingPairs = [
    [92.5, 93.8],
    [138.6, 146.8],
    [184.9, 185.7],
  ]
  const nodes: AudioNode[] = [masterGain, shiverGain, subGain, filter, lfo, lfoGain]

  beatingPairs.forEach(([a, b], index) => {
    const oscA = createOsc(ctx, a, 'sawtooth', -3 + index)
    const oscB = createOsc(ctx, b, 'triangle', 2 - index)
    const pairGain = createGain(ctx, 0.012 - index * 0.002)
    oscA.connect(pairGain)
    oscB.connect(pairGain)
    pairGain.connect(filter)
    oscA.start()
    oscB.start()
    nodes.push(oscA, oscB, pairGain)
  })

  const sub = createOsc(ctx, 36.7, 'sine', -4)
  sub.connect(subGain)
  subGain.connect(masterGain)
  sub.start()
  nodes.push(sub)

  lfo.connect(lfoGain)
  lfoGain.connect(shiverGain.gain)
  lfo.start()
  filter.connect(shiverGain)
  shiverGain.connect(masterGain)
  masterGain.connect(dest)

  return { nodes, gainNode: masterGain }
}

function buildWhisperLayer(ctx: AudioContext, dest: AudioNode): MusicLayer {
  const masterGain = createGain(ctx, 0)
  masterGain.connect(dest)

  const whisper = () => {
    const now = ctx.currentTime
    const duration = 0.75 + Math.random() * 1.9
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0

    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1
      last = last * 0.92 + white * 0.08
      const breathEnvelope = Math.sin((i / data.length) * Math.PI)
      data[i] = last * breathEnvelope * 0.9
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = 0.65 + Math.random() * 0.5

    const band = createFilter(ctx, 'bandpass', 900 + Math.random() * 1250, 3.5)
    const low = createFilter(ctx, 'lowpass', 2100 + Math.random() * 900, 0.9)
    const gain = createGain(ctx, 0)
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.random() * 1.4 - 0.7

    source.connect(band)
    band.connect(low)
    low.connect(gain)
    gain.connect(pan)
    pan.connect(masterGain)

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.07 + Math.random() * 0.05, now + 0.18)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    source.start(now)
    source.stop(now + duration + 0.05)
  }

  const intervalId = setInterval(whisper, 2600 + Math.random() * 2200)
  return { nodes: [masterGain], gainNode: masterGain, intervalId }
}

function buildIntrusionLayer(ctx: AudioContext, dest: AudioNode): MusicLayer {
  const masterGain = createGain(ctx, 0)
  const delay = ctx.createDelay(1.2)
  const feedback = createGain(ctx, 0.18)
  const filter = createFilter(ctx, 'bandpass', 1200, 2.2)

  delay.delayTime.value = 0.18
  delay.connect(feedback)
  feedback.connect(delay)
  delay.connect(filter)
  filter.connect(masterGain)
  masterGain.connect(dest)

  const knock = () => {
    const now = ctx.currentTime
    const repeats = Math.random() > 0.72 ? 2 : 1

    for (let i = 0; i < repeats; i++) {
      const t = now + i * (0.11 + Math.random() * 0.12)
      const osc = createOsc(ctx, 260 + Math.random() * 740, Math.random() > 0.5 ? 'triangle' : 'sine')
      const gain = createGain(ctx, 0)
      const hitFilter = createFilter(ctx, 'bandpass', 520 + Math.random() * 1600, 4)

      osc.connect(hitFilter)
      hitFilter.connect(gain)
      gain.connect(delay)
      gain.connect(masterGain)
      osc.start(t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.06, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18 + Math.random() * 0.18)
      osc.frequency.exponentialRampToValueAtTime(45 + Math.random() * 80, t + 0.2)
      osc.stop(t + 0.4)
    }
  }

  const intervalId = setInterval(knock, 4200 + Math.random() * 3600)
  return { nodes: [masterGain, delay, feedback, filter], gainNode: masterGain, intervalId }
}

function buildHeartbeatLayer(ctx: AudioContext, dest: AudioNode): MusicLayer {
  const masterGain = createGain(ctx, 0)

  const scheduleBeats = (gainNode: GainNode) => {
    const bpm = 72
    const interval = (60 / bpm) * 1000

    const beat = () => {
      if (gainNode.gain.value < 0.01) return
      // Double thump: lub-dub
      const now = ctx.currentTime
      ;[now, now + 0.18].forEach((t) => {
        const osc = createOsc(ctx, 60, 'sine')
        const g = createGain(ctx, 0)
        osc.connect(g)
        g.connect(gainNode)
        osc.start(t)
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.35, t + 0.02)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
        osc.stop(t + 0.14)
      })
    }

    const id = setInterval(beat, interval)
    return id
  }

  masterGain.connect(dest)
  const id = scheduleBeats(masterGain)

  return {
    nodes: [masterGain],
    gainNode: masterGain,
    intervalId: id,
  }
}

// ─────────────────────────────────────────────
// SFX generator
// ─────────────────────────────────────────────
function playSFX(ctx: AudioContext, dest: AudioNode, type: SFXType, volume = 0.6) {
  const now = ctx.currentTime
  const v = Math.max(0, Math.min(1, volume))

  const short = (osc: OscillatorNode, gain: GainNode, dur: number) => {
    osc.connect(gain); gain.connect(dest)
    osc.start(now)
    gain.gain.setValueAtTime(v, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)
    osc.stop(now + dur)
  }

  switch (type) {
    case 'footstep': {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 500)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = createGain(ctx, v * 0.3)
      const f = createFilter(ctx, 'lowpass', 400, 1)
      src.connect(f); f.connect(g); g.connect(dest)
      src.start(now); src.stop(now + 0.06)
      break
    }
    case 'sprint': {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 300)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = createGain(ctx, v * 0.45)
      const f = createFilter(ctx, 'lowpass', 600, 1)
      src.connect(f); f.connect(g); g.connect(dest)
      src.start(now)
      break
    }
    case 'collect_tape': {
      // VHS rewind sound: rising pitch + static burst
      const osc = createOsc(ctx, 200, 'sawtooth')
      const g = createGain(ctx, v * 0.3)
      osc.frequency.linearRampToValueAtTime(800, now + 0.4)
      short(osc, g, 0.5)
      // Static layer
      const buf2 = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
      const d2 = buf2.getChannelData(0)
      for (let i = 0; i < d2.length; i++) d2[i] = (Math.random() * 2 - 1) * 0.1
      const src2 = ctx.createBufferSource()
      src2.buffer = buf2
      const g2 = createGain(ctx, v * 0.15)
      src2.connect(g2); g2.connect(dest)
      src2.start(now)
      break
    }
    case 'collect_item': {
      const osc = createOsc(ctx, 880, 'sine')
      const osc2 = createOsc(ctx, 1320, 'sine')
      const g = createGain(ctx, v * 0.2)
      const g2 = createGain(ctx, v * 0.1)
      short(osc, g, 0.25)
      osc2.connect(g2); g2.connect(dest)
      osc2.start(now + 0.1)
      g2.gain.setValueAtTime(v * 0.1, now + 0.1)
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc2.stop(now + 0.36)
      break
    }
    case 'door_open': {
      const osc = createOsc(ctx, 80, 'sawtooth')
      const g = createGain(ctx, v * 0.25)
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.6)
      short(osc, g, 0.7)
      break
    }
    case 'door_locked': {
      const osc = createOsc(ctx, 120, 'square')
      const g = createGain(ctx, v * 0.3)
      short(osc, g, 0.08)
      const osc2 = createOsc(ctx, 100, 'square')
      const g2 = createGain(ctx, v * 0.3)
      osc2.connect(g2); g2.connect(dest)
      osc2.start(now + 0.12)
      g2.gain.setValueAtTime(v * 0.3, now + 0.12)
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      osc2.stop(now + 0.23)
      break
    }
    case 'switch_on': {
      const osc = createOsc(ctx, 300, 'sine')
      const g = createGain(ctx, v * 0.2)
      osc.frequency.linearRampToValueAtTime(600, now + 0.15)
      short(osc, g, 0.2)
      break
    }
    case 'switch_off': {
      const osc = createOsc(ctx, 600, 'sine')
      const g = createGain(ctx, v * 0.2)
      osc.frequency.linearRampToValueAtTime(200, now + 0.2)
      short(osc, g, 0.25)
      break
    }
    case 'switch_wrong': {
      ;[0, 0.12, 0.24].forEach((offset) => {
        const osc = createOsc(ctx, 150, 'square')
        const g = createGain(ctx, v * 0.25)
        osc.connect(g); g.connect(dest)
        osc.start(now + offset)
        g.gain.setValueAtTime(v * 0.25, now + offset)
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08)
        osc.stop(now + offset + 0.09)
      })
      break
    }
    case 'enemy_detect': {
      // Stinger: sharp rising tone
      const osc = createOsc(ctx, 200, 'sawtooth')
      const g = createGain(ctx, v * 0.45)
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.25)
      short(osc, g, 0.4)
      break
    }
    case 'enemy_nearby': {
      const osc = createOsc(ctx, 60, 'sine')
      const g = createGain(ctx, v * 0.15)
      osc.frequency.setValueAtTime(60, now)
      osc.frequency.linearRampToValueAtTime(55, now + 1)
      short(osc, g, 1.2)
      break
    }
    case 'damage': {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 3000)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = createGain(ctx, v * 0.6)
      const f = createFilter(ctx, 'lowpass', 1200, 2)
      src.connect(f); f.connect(g); g.connect(dest)
      src.start(now)
      break
    }
    case 'hide': {
      const osc = createOsc(ctx, 400, 'sine')
      const g = createGain(ctx, v * 0.15)
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.3)
      short(osc, g, 0.35)
      break
    }
    case 'unhide': {
      const osc = createOsc(ctx, 200, 'sine')
      const g = createGain(ctx, v * 0.15)
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.25)
      short(osc, g, 0.3)
      break
    }
    case 'glitch': {
      ;[0, 0.05, 0.1, 0.18].forEach((t, i) => {
        const f = 200 + Math.random() * 2000
        const osc = createOsc(ctx, f, i % 2 === 0 ? 'sawtooth' : 'square')
        const g = createGain(ctx, v * (0.1 + Math.random() * 0.2))
        osc.connect(g); g.connect(dest)
        osc.start(now + t)
        g.gain.setValueAtTime(g.gain.value, now + t)
        g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.04)
        osc.stop(now + t + 0.05)
      })
      break
    }
    case 'dialogue_blip': {
      const osc = createOsc(ctx, 440 + Math.random() * 220, 'sine')
      const g = createGain(ctx, v * 0.06)
      short(osc, g, 0.05)
      break
    }
    case 'keypad_press': {
      const osc = createOsc(ctx, 700 + Math.random() * 300, 'sine')
      const g = createGain(ctx, v * 0.12)
      short(osc, g, 0.07)
      break
    }
    case 'keypad_success': {
      ;[0, 0.1, 0.2, 0.32].forEach((t, i) => {
        const freqs = [523, 659, 784, 1047]
        const osc = createOsc(ctx, freqs[i], 'sine')
        const g = createGain(ctx, v * 0.18)
        osc.connect(g); g.connect(dest)
        osc.start(now + t)
        g.gain.setValueAtTime(v * 0.18, now + t)
        g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.18)
        osc.stop(now + t + 0.19)
      })
      break
    }
    case 'keypad_fail': {
      ;[0, 0.15].forEach((t) => {
        const osc = createOsc(ctx, 180, 'sawtooth')
        const g = createGain(ctx, v * 0.3)
        osc.connect(g); g.connect(dest)
        osc.start(now + t)
        g.gain.setValueAtTime(v * 0.3, now + t)
        g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.12)
        osc.stop(now + t + 0.13)
      })
      break
    }
    case 'sanity_low': {
      const osc = createOsc(ctx, 432, 'sine')
      const g = createGain(ctx, v * 0.08)
      const lfo = createOsc(ctx, 6, 'sine')
      const lfoG = createGain(ctx, 20)
      lfo.connect(lfoG); lfoG.connect(osc.frequency)
      lfo.start(now); osc.connect(g); g.connect(dest)
      osc.start(now)
      g.gain.setValueAtTime(v * 0.08, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + 2)
      osc.stop(now + 2); lfo.stop(now + 2)
      break
    }
    case 'level_complete': {
      ;[0, 0.2, 0.4, 0.65, 0.9].forEach((t, i) => {
        const scale = [261, 329, 392, 523, 659]
        const osc = createOsc(ctx, scale[i], 'sine')
        const g = createGain(ctx, v * 0.2)
        osc.connect(g); g.connect(dest)
        osc.start(now + t)
        g.gain.setValueAtTime(v * 0.2, now + t)
        g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.4)
        osc.stop(now + t + 0.42)
      })
      break
    }
    case 'static_burst': {
      const dur = 0.4
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1)
      const src = ctx.createBufferSource()
      src.buffer = buf
      const g = createGain(ctx, v * 0.5)
      const f = createFilter(ctx, 'bandpass', 2000, 0.5)
      src.connect(f); f.connect(g); g.connect(dest)
      g.gain.setValueAtTime(v * 0.5, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + dur)
      src.start(now)
      break
    }
    case 'heartbeat': {
      ;[0, 0.2].forEach((t) => {
        const osc = createOsc(ctx, 55, 'sine')
        const g = createGain(ctx, v * 0.4)
        osc.connect(g); g.connect(dest)
        osc.start(now + t)
        g.gain.setValueAtTime(0, now + t)
        g.gain.linearRampToValueAtTime(v * 0.4, now + t + 0.02)
        g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.14)
        osc.stop(now + t + 0.15)
      })
      break
    }
  }
}

// ─────────────────────────────────────────────
// External music loader (MP3/OGG URLs)
// ─────────────────────────────────────────────
// Add your public URLs here. If left empty, only
// procedural music plays. Tracks are looped.
const EXTERNAL_TRACKS: Partial<Record<MusicMode, string>> = {
  // title: '/audio/title.mp3',
  // ambient: '/audio/ambient.mp3',
  // chase: '/audio/chase.mp3',
  // dark: '/audio/dark.mp3',
  // victory: '/audio/victory.mp3',
  // gameover: '/audio/gameover.mp3',
}

// ─────────────────────────────────────────────
// Main hook
// ─────────────────────────────────────────────
export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const sfxGainRef = useRef<GainNode | null>(null)
  const musicGainRef = useRef<GainNode | null>(null)
  const reverbRef = useRef<ConvolverNode | null>(null)

  // Procedural layers
  const droneRef = useRef<MusicLayer | null>(null)
  const staticRef = useRef<MusicLayer | null>(null)
  const pulseRef = useRef<MusicLayer | null>(null)
  const melodyRef = useRef<MusicLayer | null>(null)
  const dissonanceRef = useRef<MusicLayer | null>(null)
  const whisperRef = useRef<MusicLayer | null>(null)
  const intrusionRef = useRef<MusicLayer | null>(null)
  const heartbeatRef = useRef<MusicLayer | null>(null)

  // External audio element
  const extAudioRef = useRef<HTMLAudioElement | null>(null)

  const currentModeRef = useRef<MusicMode>('silence')
  const masterVolumeRef = useRef(0.82)
  const musicVolumeRef = useRef(0.65)
  const sfxVolumeRef = useRef(1)
  const isMutedRef = useRef(false)
  const [isReady, setIsReady] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isNarratorEnabled, setIsNarratorEnabledState] = useState(true)
  const footstepTimerRef = useRef<number>(0)

  // SpeechSynthesis narrator
  const narratorRef = useRef<SpeechSynthesisUtterance | null>(null)
  const narratorEnabledRef = useRef(true)

  // ── Init AudioContext ──────────────────────
  const init = useCallback(() => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') {
        void ctxRef.current.resume()
      }
      return
    }

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    ctxRef.current = ctx

    // Master chain: master → compressor → destination
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 10
    comp.ratio.value = 4
    comp.attack.value = 0.003
    comp.release.value = 0.15
    comp.connect(ctx.destination)

    const master = createGain(ctx, isMutedRef.current ? 0 : masterVolumeRef.current)
    master.connect(comp)
    masterGainRef.current = master

    const sfxGain = createGain(ctx, sfxVolumeRef.current)
    sfxGain.connect(master)
    sfxGainRef.current = sfxGain

    const musicGain = createGain(ctx, musicVolumeRef.current)
    musicGain.connect(master)
    musicGainRef.current = musicGain

    // Impulse reverb for depth
    const revLen = ctx.sampleRate * 2.5
    const revBuf = ctx.createBuffer(2, revLen, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = revBuf.getChannelData(ch)
      for (let i = 0; i < revLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / revLen, 2.5)
      }
    }
    const reverb = ctx.createConvolver()
    reverb.buffer = revBuf
    const revGain = createGain(ctx, 0.18)
    reverb.connect(revGain)
    revGain.connect(master)
    reverbRef.current = reverb

    // Build procedural layers (all silent at start)
    droneRef.current = buildDroneLayer(ctx, musicGain)
    staticRef.current = buildStaticLayer(ctx, musicGain)
    pulseRef.current = buildPulseLayer(ctx, musicGain)
    melodyRef.current = buildMelodyLayer(ctx, musicGain)
    dissonanceRef.current = buildDissonanceLayer(ctx, musicGain)
    whisperRef.current = buildWhisperLayer(ctx, musicGain)
    intrusionRef.current = buildIntrusionLayer(ctx, musicGain)
    heartbeatRef.current = buildHeartbeatLayer(ctx, musicGain)

    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    setIsReady(true)
  }, [])

  // ── Ramp helper ───────────────────────────
  const ramp = useCallback((gainNode: GainNode | null, target: number, duration = 1.5) => {
    if (!gainNode || !ctxRef.current) return
    const now = ctxRef.current.currentTime
    gainNode.gain.cancelScheduledValues(now)
    gainNode.gain.setValueAtTime(gainNode.gain.value, now)
    gainNode.gain.linearRampToValueAtTime(target, now + duration)
  }, [])

  // ── External audio helper ─────────────────
  const stopExternal = useCallback(() => {
    if (extAudioRef.current) {
      extAudioRef.current.pause()
      extAudioRef.current.currentTime = 0
    }
  }, [])

  const syncExternalVolume = useCallback(() => {
    if (!extAudioRef.current) return
    extAudioRef.current.volume = isMutedRef.current
      ? 0
      : clamp01(masterVolumeRef.current * musicVolumeRef.current * 0.85)
  }, [])

  const playExternal = useCallback((url: string) => {
    stopExternal()
    if (!extAudioRef.current) {
      extAudioRef.current = new Audio()
      extAudioRef.current.loop = true
    }
    extAudioRef.current.src = url
    syncExternalVolume()
    extAudioRef.current.play().catch(() => {/* autoplay blocked */})
  }, [stopExternal, syncExternalVolume])

  // ── Set music mode ────────────────────────
  const setMusicMode = useCallback((mode: MusicMode) => {
    if (!isReady || currentModeRef.current === mode) return
    currentModeRef.current = mode

    // If there's an external track for this mode, use it + subtle procedural
    const extUrl = EXTERNAL_TRACKS[mode]
    if (extUrl) {
      playExternal(extUrl)
    } else {
      stopExternal()
    }

    // Procedural layer targets per mode
    // [drone, static, pulse, melody, dissonance, whisper, intrusion, heartbeat]
    const targets: Record<MusicMode, [number, number, number, number, number, number, number, number]> = {
      silence:  [0,    0,    0,    0,    0,    0,    0,    0   ],
      title:    [0.42, 0.08, 0,    0.18, 0.20, 0.04, 0.02, 0   ],
      ambient:  [0.44, 0.08, 0.02, 0.12, 0.24, 0.05, 0.03, 0   ],
      tension:  [0.60, 0.18, 0.22, 0.20, 0.45, 0.14, 0.12, 0.02],
      chase:    [0.76, 0.30, 0.62, 0.03, 0.55, 0.06, 0.18, 0.16],
      horror:   [0.86, 0.34, 0.32, 0.08, 0.70, 0.22, 0.22, 0.28],
      dark:     [0.82, 0.28, 0.08, 0.02, 0.62, 0.20, 0.12, 0.12],
      victory:  [0.08, 0,    0,    0.35, 0.05, 0,    0,    0   ],
      gameover: [0.70, 0.60, 0.15, 0,    0.65, 0.28, 0.22, 0.40],
    }

    const t = targets[mode]
    const speed = mode === 'chase' ? 0.6 : 1.8
    ramp(droneRef.current?.gainNode ?? null, t[0], speed)
    ramp(staticRef.current?.gainNode ?? null, t[1], speed)
    ramp(pulseRef.current?.gainNode ?? null, t[2], speed)
    ramp(melodyRef.current?.gainNode ?? null, t[3], speed)
    ramp(dissonanceRef.current?.gainNode ?? null, t[4], speed)
    ramp(whisperRef.current?.gainNode ?? null, t[5], speed)
    ramp(intrusionRef.current?.gainNode ?? null, t[6], speed)
    ramp(heartbeatRef.current?.gainNode ?? null, t[7], speed)
  }, [isReady, ramp, playExternal, stopExternal])

  // ── Play SFX ──────────────────────────────
  const playSound = useCallback((type: SFXType, volume = 0.6) => {
    if (!isReady || !ctxRef.current || !sfxGainRef.current) return
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume()
    }
    playSFX(ctxRef.current, sfxGainRef.current, type, volume)
  }, [isReady])

  // ── Footstep throttle ─────────────────────
  const playFootstep = useCallback((isSprinting: boolean) => {
    const now = Date.now()
    const interval = isSprinting ? 200 : 380
    if (now - footstepTimerRef.current < interval) return
    footstepTimerRef.current = now
    playSound(isSprinting ? 'sprint' : 'footstep', isSprinting ? 0.35 : 0.18)
  }, [playSound])

  // ── Narrator (SpeechSynthesis) ────────────
  const stopNarrator = useCallback(() => {
    window.speechSynthesis?.cancel()
    narratorRef.current = null
  }, [])

  const speak = useCallback((text: string, options?: {
    rate?: number
    pitch?: number
    volume?: number
    lang?: string
    voiceName?: string
  }) => {
    if (isMutedRef.current || !narratorEnabledRef.current) return
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()

    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = options?.lang ?? 'es-ES'
    utt.rate = options?.rate ?? 0.82       // slightly slower = more ominous
    utt.pitch = options?.pitch ?? 0.55     // lower pitch = horror narrator feel
    utt.volume = options?.volume ?? 0.9

    // Try to find a matching voice
    const voices = window.speechSynthesis.getVoices()
    const preferred = options?.voiceName
      ? voices.find(v => v.name.includes(options.voiceName!))
      : voices.find(v => v.lang.startsWith('es') && v.localService)
        ?? voices.find(v => v.lang.startsWith('es'))
        ?? voices[0]

    if (preferred) utt.voice = preferred
    narratorRef.current = utt
    window.speechSynthesis.speak(utt)
  }, [])

  const setNarratorEnabled = useCallback((enabled: boolean) => {
    narratorEnabledRef.current = enabled
    setIsNarratorEnabledState(enabled)
    if (!enabled) stopNarrator()
  }, [stopNarrator])

  const toggleNarrator = useCallback(() => {
    setNarratorEnabled(!narratorEnabledRef.current)
  }, [setNarratorEnabled])

  // ── Toggle mute ───────────────────────────
  const toggleMute = useCallback(() => {
    const next = !isMutedRef.current
    isMutedRef.current = next
    setIsMuted(next)
    ramp(masterGainRef.current, next ? 0 : masterVolumeRef.current, 0.3)
    syncExternalVolume()
    if (next) stopNarrator()
  }, [ramp, stopNarrator, syncExternalVolume])

  // ── Volume controls ───────────────────────
  const setMasterVolume = useCallback((v: number) => {
    masterVolumeRef.current = clamp01(v)
    if (!isMutedRef.current) {
      ramp(masterGainRef.current, masterVolumeRef.current, 0.3)
    }
    syncExternalVolume()
  }, [ramp, syncExternalVolume])

  const setMusicVolume = useCallback((v: number) => {
    musicVolumeRef.current = clamp01(v)
    ramp(musicGainRef.current, musicVolumeRef.current, 0.3)
    syncExternalVolume()
  }, [ramp, syncExternalVolume])

  const setSFXVolume = useCallback((v: number) => {
    sfxVolumeRef.current = clamp01(v)
    ramp(sfxGainRef.current, sfxVolumeRef.current, 0.1)
  }, [ramp])

  // ── Cleanup ───────────────────────────────
  useEffect(() => {
    return () => {
      stopExternal()
      stopNarrator()
      clearMusicLayer(droneRef.current)
      clearMusicLayer(staticRef.current)
      clearMusicLayer(pulseRef.current)
      clearMusicLayer(melodyRef.current)
      clearMusicLayer(dissonanceRef.current)
      clearMusicLayer(whisperRef.current)
      clearMusicLayer(intrusionRef.current)
      clearMusicLayer(heartbeatRef.current)
      ctxRef.current?.close()
    }
  }, [stopExternal, stopNarrator])

  return useMemo(() => ({
    init,
    isReady,
    isMuted,
    isNarratorEnabled,
    toggleMute,
    setMusicMode,
    playSound,
    playFootstep,
    speak,
    stopNarrator,
    setNarratorEnabled,
    toggleNarrator,
    setMasterVolume,
    setMusicVolume,
    setSFXVolume,
  }), [
    init,
    isReady,
    isMuted,
    isNarratorEnabled,
    toggleMute,
    setMusicMode,
    playSound,
    playFootstep,
    speak,
    stopNarrator,
    setNarratorEnabled,
    toggleNarrator,
    setMasterVolume,
    setMusicVolume,
    setSFXVolume,
  ])
}
