'use client'

import { useRef, useCallback, useEffect, useState } from 'react'

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
  | 'voice_tick'
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

type VoiceProfile = {
  base: number
  formantA: number
  formantB: number
  wave: OscillatorType
  gain: number
  noise: number
  duration: number
  pitchFall: number
  vibrato: number
}

function normalizeSpeaker(speaker: string) {
  return speaker
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function hashSpeaker(speaker: string) {
  let hash = 0
  for (let i = 0; i < speaker.length; i++) {
    hash = (hash * 31 + speaker.charCodeAt(i)) % 997
  }

  return hash
}

function getSpeakerVoiceProfile(speaker: string): VoiceProfile {
  const normalized = normalizeSpeaker(speaker)

  if (normalized.includes('sistema')) {
    return {
      base: 440,
      formantA: 980,
      formantB: 2140,
      wave: 'square',
      gain: 0.09,
      noise: 0.025,
      duration: 0.075,
      pitchFall: 0.58,
      vibrato: 22,
    }
  }

  if (normalized.includes('narrador') || normalized.includes('adrian')) {
    return {
      base: 118,
      formantA: 430,
      formantB: 920,
      wave: 'sawtooth',
      gain: 0.11,
      noise: 0.035,
      duration: 0.105,
      pitchFall: 0.76,
      vibrato: 12,
    }
  }

  if (normalized.includes('operador') || normalized.includes('???') || normalized.includes('eco')) {
    return {
      base: 82,
      formantA: 360,
      formantB: 760,
      wave: 'sawtooth',
      gain: 0.12,
      noise: 0.05,
      duration: 0.12,
      pitchFall: 0.68,
      vibrato: 18,
    }
  }

  if (normalized.includes('nino') || normalized.includes('nicolas')) {
    return {
      base: 280,
      formantA: 820,
      formantB: 1600,
      wave: 'triangle',
      gain: 0.085,
      noise: 0.018,
      duration: 0.085,
      pitchFall: 0.95,
      vibrato: 10,
    }
  }

  const hash = hashSpeaker(speaker)
  return {
    base: 190 + (hash % 150),
    formantA: 640 + (hash % 260),
    formantB: 1280 + (hash % 520),
    wave: hash % 2 === 0 ? 'triangle' : 'sine',
    gain: 0.08,
    noise: 0.018,
    duration: 0.082,
    pitchFall: 0.88,
    vibrato: 8,
  }
}

function playVoiceTick(
  ctx: AudioContext,
  dest: AudioNode,
  speaker: string,
  char: string,
  index: number,
  volume = 0.9,
) {
  {
    void speaker
  if (!/[a-záéíóúñ0-9.,;:!?¿¡]/i.test(char)) return

  const now = ctx.currentTime
  const isPunctuation = /[.,;:!?¿¡]/.test(char)
  const keySeed = (char.charCodeAt(0) * 17 + index * 23) % 100
  const dur = isPunctuation ? 0.045 : 0.032 + (keySeed % 8) / 1000
  const clickVolume = volume * (isPunctuation ? 0.048 : 0.068 + (keySeed % 5) * 0.004)

  const master = createGain(ctx, 0)
  const clickFilter = createFilter(ctx, 'bandpass', isPunctuation ? 1900 : 2400 + keySeed * 8, 3.8)
  const bodyFilter = createFilter(ctx, 'lowpass', 520 + keySeed * 2, 0.9)
  const clickGain = createGain(ctx, clickVolume)
  const bodyGain = createGain(ctx, clickVolume * 0.65)

  master.connect(dest)
  clickFilter.connect(clickGain)
  bodyFilter.connect(bodyGain)
  clickGain.connect(master)
  bodyGain.connect(master)

  const noiseLength = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noiseLength; i++) {
    const t = i / noiseLength
    const snap = Math.exp(-t * 17)
    data[i] = (Math.random() * 2 - 1) * snap
  }

  const click = ctx.createBufferSource()
  click.buffer = noiseBuffer
  click.connect(clickFilter)
  click.start(now)
  click.stop(now + dur)

  const thock = createOsc(ctx, 145 + (keySeed % 35), 'triangle')
  thock.connect(bodyFilter)
  thock.start(now)
  bodyGain.gain.setValueAtTime(clickVolume * 0.65, now)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.018)
  thock.stop(now + dur + 0.02)

  if (isPunctuation || index % 38 === 0) {
    const bell = createOsc(ctx, 1240 + (keySeed % 80), 'sine')
    const bellGain = createGain(ctx, volume * 0.018)
    bell.connect(bellGain)
    bellGain.connect(master)
    bell.start(now + 0.012)
    bellGain.gain.setValueAtTime(volume * 0.018, now + 0.012)
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
    bell.stop(now + 0.17)
  }

  master.gain.setValueAtTime(0.95, now)
  master.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    return
  }
  if (!/[a-záéíóúñ0-9]/i.test(char)) return

  const now = ctx.currentTime
  const profile = getSpeakerVoiceProfile(speaker)
  const vowelLift = /[aeiouáéíóú]/i.test(char) ? 46 : -12
  const jitter = ((char.charCodeAt(0) + index * 19) % 59) - 29
  const freq = Math.max(80, profile.base + vowelLift + jitter)
  const dur = profile.duration + (/[mnrl]/i.test(char) ? 0.026 : 0)
  const consonantNoise = /[bcdfghjkpqrstvwxyzñ]/i.test(char) ? 1.55 : 0.75

  const voiceGain = createGain(ctx, 0)
  const osc = createOsc(ctx, freq, profile.wave)
  const osc2 = createOsc(ctx, freq * 1.012, profile.wave, -5)
  const vibrato = createOsc(ctx, 38 + (index % 5) * 3, 'sine')
  const vibratoGain = createGain(ctx, profile.vibrato)
  const formantA = createFilter(ctx, 'bandpass', profile.formantA + vowelLift * 3, 6)
  const formantB = createFilter(ctx, 'bandpass', profile.formantB + jitter * 4, 4)
  const aGain = createGain(ctx, 0.9)
  const bGain = createGain(ctx, 0.46)

  vibrato.connect(vibratoGain)
  vibratoGain.connect(osc.detune)
  vibratoGain.connect(osc2.detune)
  osc.connect(formantA)
  osc2.connect(formantA)
  osc.connect(formantB)
  osc2.connect(formantB)
  formantA.connect(aGain)
  formantB.connect(bGain)
  aGain.connect(voiceGain)
  bGain.connect(voiceGain)

  if (profile.noise > 0) {
    const noiseLength = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseLength; i++) {
      const env = Math.sin((i / noiseLength) * Math.PI)
      data[i] = (Math.random() * 2 - 1) * env
    }

    const noise = ctx.createBufferSource()
    const noiseFilter = createFilter(ctx, 'bandpass', profile.formantB * 0.85, 2.8)
    const noiseGain = createGain(ctx, profile.noise * consonantNoise)
    noise.buffer = noiseBuffer
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(voiceGain)
    noise.start(now)
    noise.stop(now + dur)
  }

  const bodyOsc = createOsc(ctx, Math.max(45, freq * 0.48), 'triangle', -8)
  const bodyFilter = createFilter(ctx, 'lowpass', profile.formantA * 0.95, 1.2)
  const bodyGain = createGain(ctx, volume * profile.gain * 0.38)
  bodyOsc.connect(bodyFilter)
  bodyFilter.connect(bodyGain)
  bodyGain.connect(voiceGain)
  bodyOsc.start(now)
  bodyGain.gain.setValueAtTime(volume * profile.gain * 0.38, now)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + dur)
  bodyOsc.stop(now + dur + 0.01)

  voiceGain.connect(dest)
  vibrato.start(now)
  osc.start(now)
  osc2.start(now)
  voiceGain.gain.setValueAtTime(0, now)
  voiceGain.gain.linearRampToValueAtTime(volume * profile.gain, now + 0.01)
  voiceGain.gain.exponentialRampToValueAtTime(0.001, now + dur)
  osc.frequency.exponentialRampToValueAtTime(Math.max(70, freq * profile.pitchFall), now + dur)
  osc2.frequency.exponentialRampToValueAtTime(Math.max(70, freq * profile.pitchFall * 1.01), now + dur)
  osc.stop(now + dur + 0.01)
  osc2.stop(now + dur + 0.01)
  vibrato.stop(now + dur + 0.01)
}

// ─────────────────────────────────────────────
// Procedural music layers
// ─────────────────────────────────────────────
interface MusicLayer {
  nodes: AudioNode[]
  gainNode: GainNode
}

function buildDroneLayer(ctx: AudioContext, dest: AudioNode): MusicLayer {
  const masterGain = createGain(ctx, 0)
  const freqs = [27.5, 55, 82.5, 110]
  const nodes: AudioNode[] = [masterGain]

  freqs.forEach((freq, i) => {
    const osc = createOsc(ctx, freq, 'sawtooth', i * 7)
    const gain = createGain(ctx, 0.06 - i * 0.01)
    const filter = createFilter(ctx, 'lowpass', 180 + i * 40, 0.8)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(masterGain)
    osc.start()
    nodes.push(osc, gain, filter)
  })

  masterGain.connect(dest)
  return { nodes, gainNode: masterGain }
}

function buildStaticLayer(ctx: AudioContext, dest: AudioNode): MusicLayer {
  const masterGain = createGain(ctx, 0)
  const bufferSize = ctx.sampleRate * 4
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < bufferSize; i++) {
    const white = (Math.random() * 2 - 1) * 0.05
    last = last * 0.985 + white * 0.015
    data[i] = last + (Math.random() * 2 - 1) * 0.012
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const rainLow = createFilter(ctx, 'lowpass', 1250, 0.7)
  const rainHigh = createFilter(ctx, 'highpass', 260, 0.6)
  const rainGain = createGain(ctx, 0.72)
  source.connect(rainLow)
  rainLow.connect(rainHigh)
  rainHigh.connect(rainGain)
  rainGain.connect(masterGain)
  masterGain.connect(dest)
  source.start()

  const dropInterval = window.setInterval(() => {
    if (masterGain.gain.value < 0.01) return

    const now = ctx.currentTime
    const freq = 760 + Math.random() * 820
    const drop = createOsc(ctx, freq, Math.random() > 0.5 ? 'sine' : 'triangle')
    const dropFilter = createFilter(ctx, 'bandpass', freq, 4)
    const dropGain = createGain(ctx, 0)

    drop.connect(dropFilter)
    dropFilter.connect(dropGain)
    dropGain.connect(masterGain)
    drop.start(now)
    dropGain.gain.setValueAtTime(0, now)
    dropGain.gain.linearRampToValueAtTime(0.018 + Math.random() * 0.012, now + 0.008)
    dropGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14 + Math.random() * 0.1)
    drop.stop(now + 0.26)
  }, 220)

  return {
    nodes: [source, rainLow, rainHigh, rainGain, masterGain],
    gainNode: masterGain,
    // @ts-ignore - store interval id for cleanup
    _intervalId: dropInterval,
  }
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
  // Eerie high pad using two detuned sines
  const osc1 = createOsc(ctx, 220, 'sine', -8)
  const osc2 = createOsc(ctx, 220, 'sine', 8)
  const g1 = createGain(ctx, 0.04)
  const g2 = createGain(ctx, 0.04)
  const filter = createFilter(ctx, 'highpass', 180, 0.7)

  osc1.connect(g1); g1.connect(filter)
  osc2.connect(g2); g2.connect(filter)
  filter.connect(masterGain)
  masterGain.connect(dest)
  osc1.start(); osc2.start()

  return { nodes: [osc1, osc2, g1, g2, filter, masterGain], gainNode: masterGain }
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
    // @ts-ignore — store interval id for cleanup
    _intervalId: id,
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
    case 'voice_tick': {
      const osc = createOsc(ctx, 320 + Math.random() * 90, 'sine')
      const g = createGain(ctx, v * 0.05)
      short(osc, g, 0.035)
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
  const heartbeatRef = useRef<MusicLayer | null>(null)

  // External audio element
  const extAudioRef = useRef<HTMLAudioElement | null>(null)

  const currentModeRef = useRef<MusicMode>('silence')
  const [isReady, setIsReady] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const footstepTimerRef = useRef<number>(0)

  // SpeechSynthesis narrator
  const narratorRef = useRef<SpeechSynthesisUtterance | null>(null)

  // ── Init AudioContext ──────────────────────
  const init = useCallback(() => {
    if (ctxRef.current) return
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

    const master = createGain(ctx, 0.82)
    master.connect(comp)
    masterGainRef.current = master

    const sfxGain = createGain(ctx, 1)
    sfxGain.connect(master)
    sfxGainRef.current = sfxGain

    const musicGain = createGain(ctx, 0.65)
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
    heartbeatRef.current = buildHeartbeatLayer(ctx, musicGain)

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

  const playExternal = useCallback((url: string) => {
    stopExternal()
    if (!extAudioRef.current) {
      extAudioRef.current = new Audio()
      extAudioRef.current.loop = true
    }
    extAudioRef.current.src = url
    extAudioRef.current.volume = 0.55
    extAudioRef.current.play().catch(() => {/* autoplay blocked */})
  }, [stopExternal])

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
    // [drone, rain, pulse, melody, heartbeat]
    const targets: Record<MusicMode, [number, number, number, number, number]> = {
      silence:   [0,    0,    0,    0,    0   ],
      title:     [0.55, 0.32, 0,    0.28, 0   ],
      ambient:   [0.48, 0.38, 0.03, 0.16, 0   ],
      tension:   [0.68, 0.42, 0.24, 0.16, 0   ],
      chase:     [0.84, 0.28, 0.72, 0,    0   ],
      horror:    [0.92, 0.34, 0.42, 0.08, 0   ],
      dark:      [0.95, 0.44, 0.1,  0,    0   ],
      victory:   [0.08, 0.18, 0,    0.52, 0   ],
      gameover:  [0.78, 0.3,  0.18, 0,    0.38],
    }

    const t = targets[mode]
    const speed = mode === 'chase' ? 0.6 : 1.8
    ramp(droneRef.current?.gainNode ?? null, t[0], speed)
    ramp(staticRef.current?.gainNode ?? null, t[1], speed)
    ramp(pulseRef.current?.gainNode ?? null, t[2], speed)
    ramp(melodyRef.current?.gainNode ?? null, t[3], speed)
    ramp(heartbeatRef.current?.gainNode ?? null, t[4], speed)
  }, [isReady, ramp, playExternal, stopExternal])

  // ── Play SFX ──────────────────────────────
  const playSound = useCallback((type: SFXType, volume = 0.6) => {
    if (!isReady || !ctxRef.current || !sfxGainRef.current) return
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume()
    }
    playSFX(ctxRef.current, sfxGainRef.current, type, volume)
  }, [isReady])

  const playVoiceBlip = useCallback((speaker: string, char: string, index: number) => {
    if (!isReady || !ctxRef.current || !sfxGainRef.current) return
    if (ctxRef.current.state === 'suspended') {
      void ctxRef.current.resume()
    }
    playVoiceTick(ctxRef.current, sfxGainRef.current, speaker, char, index)
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
  const speak = useCallback((text: string, options?: {
    rate?: number
    pitch?: number
    volume?: number
    lang?: string
    voiceName?: string
  }) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()

    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = options?.lang ?? 'es-ES'
    utt.rate = options?.rate ?? 0.74
    utt.pitch = options?.pitch ?? 0.5
    utt.volume = options?.volume ?? 0.86

    const voices = window.speechSynthesis.getVoices()
    const suspenseVoiceNames = [
      'pablo',
      'raul',
      'jorge',
      'diego',
      'miguel',
      'google español',
      'google spanish',
      'microsoft',
    ]
    const spanishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('es'))
    const preferred = options?.voiceName
      ? voices.find(v => v.name.toLowerCase().includes(options.voiceName!.toLowerCase()))
      : spanishVoices.find(v => suspenseVoiceNames.some(name => v.name.toLowerCase().includes(name)))
        ?? spanishVoices.find(v => v.localService)
        ?? spanishVoices[0]
        ?? voices[0]

    if (preferred) utt.voice = preferred
    narratorRef.current = utt
    window.speechSynthesis.speak(utt)
  }, [])

  const stopNarrator = useCallback(() => {
    window.speechSynthesis?.cancel()
  }, [])

  // ── Toggle mute ───────────────────────────
  const toggleMute = useCallback(() => {
    if (!masterGainRef.current || !ctxRef.current) return
    const next = !isMuted
    setIsMuted(next)
    ramp(masterGainRef.current, next ? 0 : 0.82, 0.3)
    if (next) stopNarrator()
  }, [isMuted, ramp, stopNarrator])

  // ── Volume controls ───────────────────────
  const setMasterVolume = useCallback((v: number) => {
    ramp(masterGainRef.current, Math.max(0, Math.min(1, v)), 0.3)
  }, [ramp])

  const setMusicVolume = useCallback((v: number) => {
    ramp(musicGainRef.current, Math.max(0, Math.min(1, v)), 0.3)
    if (extAudioRef.current) extAudioRef.current.volume = Math.max(0, Math.min(1, v * 0.85))
  }, [ramp])

  const setSFXVolume = useCallback((v: number) => {
    ramp(sfxGainRef.current, Math.max(0, Math.min(1, v)), 0.1)
  }, [ramp])

  // ── Cleanup ───────────────────────────────
  useEffect(() => {
    return () => {
      stopExternal()
      stopNarrator()
      // @ts-ignore
      if (staticRef.current?._intervalId) clearInterval(staticRef.current._intervalId)
      // @ts-ignore
      if (heartbeatRef.current?._intervalId) clearInterval(heartbeatRef.current._intervalId)
      const ctx = ctxRef.current
      ctxRef.current = null
      if (ctx && ctx.state !== 'closed') {
        void ctx.close().catch(() => {
          // AudioContext may already be closing during React Fast Refresh cleanup.
        })
      }
    }
  }, [stopExternal, stopNarrator])

  return {
    init,
    isReady,
    isMuted,
    toggleMute,
    setMusicMode,
    playSound,
    playVoiceBlip,
    playFootstep,
    speak,
    stopNarrator,
    setMasterVolume,
    setMusicVolume,
    setSFXVolume,
  }
}
