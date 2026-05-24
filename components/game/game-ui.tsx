'use client'

import type { Dialogue, Level, Player } from '@/lib/game-types'
import {
  Activity,
  Archive,
  Battery,
  Brain,
  ClipboardList,
  Eye,
  FileText,
  Gauge,
  HeartPulse,
  KeyRound,
  Lock,
  Minus,
  Package,
  Plus,
  Radio,
  Shield,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

interface GameUIProps {
  player: Player
  level: Level
  currentDialogue: Dialogue | null
  onAdvanceDialogue: () => void
  onTypeVoice?: (speaker: string, char: string, index: number) => void
  onSelectChoice?: (index: number) => void
  totalTapes: number
  memoriesCount: number
  detectionCount?: number
  codeInput?: string
  showKeypad?: boolean
  onSubmitCode?: (code: string) => void
  showInventory?: boolean
  onCloseInventory?: () => void
  activeValve?: string | null
  valveValues?: Record<string, number>
  onValveChange?: (valveId: string, value: number) => void
  onSubmitValves?: () => void
}

type HudTone = 'red' | 'cyan' | 'amber' | 'green'
type HudMenu = 'mission' | 'objectives'
type Puzzle = Level['puzzles'][number]
type InventoryType = Player['inventory'][number]['type']

type StatusStat = {
  label: 'HP' | 'SAN' | 'STM'
  name: string
  value: number
  color: string
  darkColor: string
  Icon: LucideIcon
}

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

const toneStyles: Record<HudTone, { accent: string; border: string; glow: string; rail: string }> = {
  red: {
    accent: 'text-red-400',
    border: 'border-red-500/30',
    glow: 'shadow-[0_0_26px_rgba(127,29,29,0.24)]',
    rail: 'from-red-500/70',
  },
  cyan: {
    accent: 'text-cyan-300',
    border: 'border-cyan-400/30',
    glow: 'shadow-[0_0_26px_rgba(8,145,178,0.22)]',
    rail: 'from-cyan-400/70',
  },
  amber: {
    accent: 'text-amber-300',
    border: 'border-amber-400/30',
    glow: 'shadow-[0_0_22px_rgba(180,83,9,0.18)]',
    rail: 'from-amber-400/70',
  },
  green: {
    accent: 'text-emerald-300',
    border: 'border-emerald-400/30',
    glow: 'shadow-[0_0_22px_rgba(5,150,105,0.18)]',
    rail: 'from-emerald-400/70',
  },
}

export function GameUI({ 
  player, 
  level, 
  currentDialogue, 
  onAdvanceDialogue, 
  onTypeVoice,
  onSelectChoice,
  totalTapes, 
  memoriesCount,
  detectionCount = 0,
  codeInput = '',
  showKeypad = false,
  onSubmitCode,
  showInventory = false,
  onCloseInventory,
  activeValve,
  valveValues = {},
  onValveChange,
  onSubmitValves,
}: GameUIProps) {
  const [typedText, setTypedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [clock, setClock] = useState(0)
  const [openHudMenus, setOpenHudMenus] = useState<Record<HudMenu, boolean>>({
    mission: false,
    objectives: false,
  })

  const isStealthLevel = level.hidingSpots.length > 0
  const isDarkLevel = Boolean(level.isDark && !level.lightsOn)
  const puzzle = level.puzzles[0]

  useEffect(() => {
    setClock(Date.now())
    const interval = window.setInterval(() => setClock(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    setOpenHudMenus({ mission: false, objectives: false })
  }, [level.id])

  // Typewriter effect for dialogue
  useEffect(() => {
    if (!currentDialogue) {
      setTypedText('')
      setIsTyping(false)
      return
    }

    setIsTyping(true)
    setTypedText('')
    let index = 0
    const text = currentDialogue.text
    
    const interval = window.setInterval(() => {
      if (index < text.length) {
        const nextChar = text[index]
        setTypedText(text.slice(0, index + 1))
        onTypeVoice?.(currentDialogue.speaker, nextChar, index)
        index++
      } else {
        setIsTyping(false)
        window.clearInterval(interval)
      }
    }, 24)
    
    return () => window.clearInterval(interval)
  }, [currentDialogue, onTypeVoice])

  const statCards = useMemo<StatusStat[]>(() => [
    {
      label: 'HP',
      name: 'Salud',
      value: player.health,
      color: '#ef4444',
      darkColor: '#5b0d12',
      Icon: HeartPulse,
    },
    {
      label: 'SAN',
      name: 'Cordura',
      value: player.sanity,
      color: '#22d3ee',
      darkColor: '#083344',
      Icon: Brain,
    },
    {
      label: 'STM',
      name: 'Stamina',
      value: player.stamina,
      color: '#f59e0b',
      darkColor: '#451a03',
      Icon: Battery,
    },
  ], [player.health, player.sanity, player.stamina])

  const systemTime = clock ? new Date(clock).toISOString().slice(11, 19) : '--:--:--'
  const cycleCode = `0x${(level.id * 409 + Math.floor((clock || 1) / 1000)).toString(16).slice(-4).toUpperCase()}`
  const signalBars = [0, 1, 2, 3].map((i) => 34 + (Math.sin((clock || 0) / 420 + i * 1.7) + 1) * 28)

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden font-mono text-slate-100">
      <div className="absolute inset-x-0 top-0 z-20 px-2 pt-2 sm:px-4">
        <div className="mx-auto flex h-9 max-w-[1280px] items-center justify-between overflow-hidden border border-red-500/15 bg-black/35 px-2 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-[2px] sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2 text-red-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
              <Radio className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold tracking-[0.34em]">SYSTEM_REC</span>
            </div>
            <div className="hidden h-4 w-px bg-red-500/20 sm:block" />
            <div className="hidden min-w-0 items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-slate-500 sm:flex">
              <span className="truncate">Kernel v8.4.1</span>
              <span className={cx('font-bold', isDarkLevel ? 'text-red-300' : 'text-cyan-300')}>
                {isDarkLevel ? 'DARK' : 'SYNC'}
              </span>
              <span>{cycleCode}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <CompactVitals stats={statCards} />
            <div className="hidden items-end gap-1 sm:flex">
              {signalBars.map((height, index) => (
                <span key={index} className="flex h-4 w-1 items-end bg-red-950/60">
                  <span
                    className="w-full bg-red-400/70 shadow-[0_0_8px_rgba(248,113,113,0.55)] transition-[height] duration-300"
                    style={{ height: `${height}%` }}
                  />
                </span>
              ))}
            </div>
            <div className="text-right">
              <div className="text-[11px] font-bold tracking-[0.18em] text-slate-200">{systemTime}</div>
              <div className="text-[8px] uppercase tracking-[0.26em] text-red-500/50">session sync</div>
            </div>
          </div>
        </div>
      </div>

      <HudDock
        openMenus={openHudMenus}
        onToggleMenu={(menu) => setOpenHudMenus(current => ({ ...current, [menu]: !current[menu] }))}
        level={level}
        totalTapes={totalTapes}
        memoriesCount={memoriesCount}
        puzzle={puzzle}
        isDarkLevel={isDarkLevel}
        isStealthLevel={isStealthLevel}
        detectionCount={detectionCount}
      />

      {currentDialogue && (
        <DialoguePanel
          currentDialogue={currentDialogue}
          typedText={typedText}
          isTyping={isTyping}
          onAdvanceDialogue={onAdvanceDialogue}
          onSelectChoice={onSelectChoice}
          onSkipTyping={() => {
            setTypedText(currentDialogue.text)
            setIsTyping(false)
          }}
        />
      )}

      {(showKeypad || activeValve || showInventory) && (
        <InteractionOverlay
          player={player}
          level={level}
          codeInput={codeInput}
          showKeypad={showKeypad}
          onSubmitCode={onSubmitCode}
          showInventory={showInventory}
          onCloseInventory={onCloseInventory}
          activeValve={activeValve}
          valveValues={valveValues}
          onValveChange={onValveChange}
          onSubmitValves={onSubmitValves}
        />
      )}

      {player.sanity < 30 && (
        <div className="absolute inset-x-4 top-1/2 pointer-events-none z-30 flex -translate-y-1/2 justify-center">
          <div className="max-w-[92vw] animate-glitch border border-red-500/20 bg-black/20 px-4 py-2 text-center text-xl font-black uppercase tracking-[0.35em] text-red-500/25 text-glow-red sm:text-4xl">
            signal fracture
          </div>
        </div>
      )}

      {player.health < 30 && (
        <div className="absolute inset-0 pointer-events-none z-20 animate-pulse border border-red-500/10 shadow-[inset_0_0_120px_rgba(127,29,29,0.34)]" />
      )}
      
      {player.isHiding && (
        <div className="absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 border border-emerald-400/30 bg-black/70 px-5 py-2 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.22)] backdrop-blur-md">
          <Shield className="h-4 w-4" />
          <span className="text-[11px] font-bold uppercase tracking-[0.3em]">hidden state</span>
        </div>
      )}
    </div>
  )
}

function TerminalPanel({
  title,
  code,
  tone = 'red',
  Icon,
  className,
  children,
}: {
  title: string
  code?: string
  tone?: HudTone
  Icon?: LucideIcon
  className?: string
  children: ReactNode
}) {
  const toneClass = toneStyles[tone]

  return (
    <section
      className={cx(
        'relative overflow-hidden border bg-black/55 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.24)] backdrop-blur-[2px]',
        'before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] before:bg-[length:100%_4px] before:opacity-15',
        toneClass.border,
        toneClass.glow,
        className,
      )}
    >
      <CornerBrackets tone={tone} />
      <div className="relative mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className={cx('flex min-w-0 items-center gap-2', toneClass.accent)}>
          {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.28em]">{title}</span>
        </div>
        {code && <span className="shrink-0 text-[8px] uppercase tracking-[0.2em] text-slate-500">{code}</span>}
      </div>
      <div className="relative">{children}</div>
    </section>
  )
}

function HudDock({
  openMenus,
  onToggleMenu,
  level,
  totalTapes,
  memoriesCount,
  puzzle,
  isDarkLevel,
  isStealthLevel,
  detectionCount,
}: {
  openMenus: Record<HudMenu, boolean>
  onToggleMenu: (menu: HudMenu) => void
  level: Level
  totalTapes: number
  memoriesCount: number
  puzzle?: Puzzle
  isDarkLevel: boolean
  isStealthLevel: boolean
  detectionCount: number
}) {
  return (
    <>
      <div className="absolute left-2 top-14 z-30 pointer-events-auto sm:left-4 sm:top-14">
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-2">
            <HudMenuButton
              label="Mission"
              tone="red"
              Icon={ClipboardList}
              isOpen={openMenus.mission}
              onClick={() => onToggleMenu('mission')}
            />
            <HudMenuButton
              label="Objectives"
              tone="cyan"
              Icon={FileText}
              isOpen={openMenus.objectives}
              onClick={() => onToggleMenu('objectives')}
            />
          </div>

          <div className="w-[min(19rem,calc(100vw-4.75rem))] space-y-2">
            <div className={cx('grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out', openMenus.mission ? 'grid-rows-[1fr] translate-x-0 opacity-100' : 'pointer-events-none grid-rows-[0fr] -translate-x-2 opacity-0')}>
              <div className="min-h-0 max-h-[min(42vh,18rem)] overflow-y-auto">
                <MissionPanel level={level} totalTapes={totalTapes} memoriesCount={memoriesCount} />
              </div>
            </div>

            <div className={cx('grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out', openMenus.objectives ? 'grid-rows-[1fr] translate-x-0 opacity-100' : 'pointer-events-none grid-rows-[0fr] -translate-x-2 opacity-0')}>
              <div className="min-h-0 max-h-[min(42vh,20rem)] space-y-2 overflow-y-auto">
                <ObjectivePanel puzzle={puzzle} isDarkLevel={isDarkLevel} />
                {isStealthLevel && <DetectionPanel detectionCount={detectionCount} />}
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  )
}

function HudMenuButton({
  label,
  tone,
  Icon,
  isOpen,
  onClick,
}: {
  label: string
  tone: HudTone
  Icon: LucideIcon
  isOpen: boolean
  onClick: () => void
}) {
  const toneClass = toneStyles[tone]

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'group relative flex h-9 w-9 items-center justify-center border bg-black/45 backdrop-blur-[2px] transition-all active:scale-95',
        'hover:bg-black/65',
        toneClass.border,
        isOpen && toneClass.glow,
      )}
    >
      <Icon className={cx('h-3.5 w-3.5', toneClass.accent)} />
      <span className={cx('absolute right-1 top-1 h-1.5 w-1.5 transition-opacity', isOpen ? 'opacity-100' : 'opacity-0', tone === 'cyan' ? 'bg-cyan-300' : 'bg-red-400')} />
    </button>
  )
}

function MissionPanel({ level, totalTapes, memoriesCount }: { level: Level; totalTapes: number; memoriesCount: number }) {
  return (
    <TerminalPanel title="Mission log" code={`LVL-${String(level.id).padStart(2, '0')}`} tone="red" Icon={ClipboardList}>
      <div className="flex items-start gap-3">
        <span className="mt-1 h-2 w-2 shrink-0 bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]" />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black uppercase tracking-[0.12em] text-slate-100">{level.name}</h2>
          <p
            className="mt-2 text-[10px] leading-5 text-slate-400"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {level.objective}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-red-500/10 pt-3">
        <MiniMetric label="VHS" value={String(totalTapes).padStart(2, '0')} Icon={Archive} tone="red" />
        <MiniMetric label="MEM" value={String(memoriesCount).padStart(2, '0')} Icon={Eye} tone="cyan" />
        <MiniMetric label="REQ" value={String(level.requiredTapes).padStart(2, '0')} Icon={Lock} tone="amber" />
      </div>
    </TerminalPanel>
  )
}

function CompactVitals({ stats }: { stats: StatusStat[] }) {
  return (
    <div className="flex max-w-[50vw] items-center gap-1.5 sm:max-w-none sm:gap-2">
      {stats.map((stat) => (
        <CompactVital key={stat.label} stat={stat} />
      ))}
    </div>
  )
}

function CompactVital({ stat }: { stat: StatusStat }) {
  const safeValue = Math.max(0, Math.min(100, stat.value))
  const critical = safeValue <= 28
  const warning = safeValue <= 50
  const Icon = stat.Icon

  return (
    <div className={cx('w-12 sm:w-16', critical && 'animate-pulse')} title={stat.name}>
      <div className="mb-1 flex items-center gap-1">
        <Icon className="h-3 w-3 shrink-0" style={{ color: stat.color }} />
        <span className="hidden text-[8px] font-black tracking-[0.16em] sm:inline" style={{ color: stat.color }}>
          {stat.label}
        </span>
        <span className={cx('ml-auto text-[8px] font-bold tabular-nums', critical ? 'text-red-200' : warning ? 'text-amber-200' : 'text-slate-300')}>
          {Math.round(safeValue)}%
        </span>
      </div>

      <div className="relative h-1.5 overflow-hidden border border-white/10 bg-black/40">
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
          style={{
            width: `${safeValue}%`,
            background: `linear-gradient(90deg, ${stat.darkColor}, ${stat.color})`,
            boxShadow: critical ? `0 0 12px ${stat.color}` : `0 0 7px ${stat.color}66`,
          }}
        />
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent 0, transparent 7px, rgba(255,255,255,0.35) 8px)',
          }}
        />
      </div>
    </div>
  )
}

function ObjectivePanel({ puzzle, isDarkLevel }: { puzzle?: Puzzle; isDarkLevel: boolean }) {
  if (!puzzle || puzzle.isSolved) {
    return (
      <TerminalPanel title="Signal analysis" code={isDarkLevel ? 'LIGHT LOST' : 'STANDBY'} tone="cyan" Icon={Gauge}>
        <div className="flex items-center justify-between gap-4 py-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
              {isDarkLevel ? 'Emergency scan' : 'No active puzzle'}
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-slate-600">
              {isDarkLevel ? 'visibility degraded' : 'monitoring local signals'}
            </div>
          </div>
          <Activity className={cx('h-5 w-5', isDarkLevel ? 'text-red-400' : 'text-cyan-300')} />
        </div>
      </TerminalPanel>
    )
  }

  const progress = getPuzzleProgress(puzzle)

  return (
    <TerminalPanel title="Objectives" code={puzzle.type} tone="cyan" Icon={FileText}>
      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
            <h3 className="truncate text-sm font-black uppercase tracking-[0.12em] text-slate-100">{puzzle.name}</h3>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-slate-400">{puzzle.hint}</p>
        </div>

        {progress.total > 0 && (
          <div className="border-t border-cyan-400/10 pt-3">
            <div className="mb-2 flex justify-between text-[9px] uppercase tracking-[0.18em] text-slate-500">
              <span>Progress</span>
              <span>{progress.current}/{progress.total}</span>
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${progress.total}, minmax(0, 1fr))` }}>
              {Array.from({ length: progress.total }).map((_, index) => (
                <span
                  key={index}
                  className={cx(
                    'h-1.5 transition-all duration-500',
                    index < progress.current
                      ? 'bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.85)]'
                      : 'bg-slate-900/90 ring-1 ring-white/5',
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </TerminalPanel>
  )
}

function DetectionPanel({ detectionCount }: { detectionCount: number }) {
  const alertLevel = Math.max(0, Math.min(5, Math.ceil(detectionCount * 1.5)))

  return (
    <TerminalPanel title="Proximity" code="STEALTH" tone="red" Icon={TriangleAlert} className="mt-3 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-red-300/70">Detection</span>
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <span
              key={index}
              className={cx(
                'h-3 w-1.5 transition-all duration-300',
                index < alertLevel ? 'bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.9)]' : 'bg-red-950/40',
              )}
            />
          ))}
        </div>
      </div>
    </TerminalPanel>
  )
}

function DialoguePanel({
  currentDialogue,
  typedText,
  isTyping,
  onAdvanceDialogue,
  onSelectChoice,
  onSkipTyping,
}: {
  currentDialogue: Dialogue
  typedText: string
  isTyping: boolean
  onAdvanceDialogue: () => void
  onSelectChoice?: (index: number) => void
  onSkipTyping: () => void
}) {
  return (
    <div
      className="absolute bottom-20 left-1/2 z-40 w-[min(44rem,calc(100vw-1.5rem))] -translate-x-1/2 pointer-events-auto sm:bottom-16"
      onClick={() => {
        if (isTyping) {
          onSkipTyping()
        } else if (!currentDialogue.choices) {
          onAdvanceDialogue()
        }
      }}
    >
      <TerminalPanel title={currentDialogue.speaker} code="COMMS" tone="red" Icon={Radio} className="p-4 sm:p-5">
        <div className="min-h-16 text-sm leading-7 text-slate-100 sm:text-base">
          {typedText}
          {isTyping && <span className="ml-1 inline-block h-5 w-2 translate-y-1 bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.75)]" />}
        </div>

        {!isTyping && currentDialogue.choices && (
          <div className="mt-5 grid gap-2">
            {currentDialogue.choices.map((choice, index) => (
              <button
                key={index}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelectChoice?.(index)
                }}
                className="group flex w-full items-center gap-3 border border-red-500/25 bg-red-950/15 px-3 py-2.5 text-left text-slate-300 transition-all hover:border-red-400/70 hover:bg-red-900/30 hover:text-white"
              >
                <Zap className="h-3.5 w-3.5 shrink-0 text-red-400 transition-transform group-hover:translate-x-0.5" />
                <span className="text-xs font-bold uppercase tracking-[0.12em]">{choice.text}</span>
              </button>
            ))}
          </div>
        )}

        {!isTyping && !currentDialogue.choices && (
          <div className="mt-4 text-right text-[9px] font-bold uppercase tracking-[0.24em] text-red-400/60">
            continue
          </div>
        )}
      </TerminalPanel>
    </div>
  )
}

function InteractionOverlay({
  player,
  level,
  codeInput,
  showKeypad,
  onSubmitCode,
  showInventory,
  onCloseInventory,
  activeValve,
  valveValues,
  onValveChange,
  onSubmitValves,
}: {
  player: Player
  level: Level
  codeInput: string
  showKeypad: boolean
  onSubmitCode?: (code: string) => void
  showInventory: boolean
  onCloseInventory?: () => void
  activeValve?: string | null
  valveValues: Record<string, number>
  onValveChange?: (valveId: string, value: number) => void
  onSubmitValves?: () => void
}) {
  const valves = level.switches.filter((switchObj) => switchObj.type === 'valve')
  const activeValveIndex = Math.max(0, valves.findIndex((valve) => valve.id === activeValve))
  const visibleValves = activeValve ? valves.filter((valve) => valve.id === activeValve) : valves

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-4 pointer-events-auto backdrop-blur-[1px]">
      <TerminalPanel title={showInventory ? 'Inventory manifest' : activeValve ? 'Valve control' : 'Keypad entry'} code="INPUT" tone={activeValve ? 'cyan' : showInventory ? 'amber' : 'red'} Icon={Package} className="w-[min(34rem,calc(100vw-2rem))] p-5 sm:p-6">
        {showKeypad && (
          <div className="space-y-5">
            <div className="border border-red-500/25 bg-black/60 p-5 text-center">
              <div className="ml-[0.6em] text-4xl font-black tracking-[0.6em] text-red-100 drop-shadow-[0_0_12px_rgba(248,113,113,0.35)]">
                {codeInput.padEnd(4, '_')}
              </div>
            </div>
            <div className="mx-auto grid max-w-[18rem] grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((key) => (
                <button
                  key={key}
                  className="h-12 border border-red-500/25 bg-red-950/15 text-lg font-black text-red-100 transition-all hover:border-red-400 hover:bg-red-900/30"
                  onClick={() => {
                    if (key === 'OK' && codeInput.length === 4) onSubmitCode?.(codeInput)
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeValve && (
          <div className="space-y-6">
            <div className="border border-cyan-400/15 bg-cyan-950/10 p-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/75">
              Valvula {activeValveIndex + 1}: ajusta el valor segun el expediente encontrado
            </div>
            <div className="grid grid-cols-1 gap-4">
              {visibleValves.map((valve) => (
                <div key={valve.id} className="border border-cyan-400/15 bg-black/40 p-3 text-center">
                  <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300/60">vlv_{activeValveIndex + 1}</div>
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-cyan-400/30 bg-cyan-950/10 shadow-[inset_0_0_18px_rgba(8,145,178,0.18)]">
                    <span className="text-3xl font-black text-cyan-200 text-glow-cyan">{valveValues[valve.id] ?? 0}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onValveChange?.(valve.id, ((valveValues[valve.id] ?? 0) + 9) % 10)}
                      className="flex h-9 items-center justify-center border border-cyan-400/25 bg-cyan-950/15 text-cyan-200 transition-all hover:border-cyan-300 hover:bg-cyan-900/30"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onValveChange?.(valve.id, ((valveValues[valve.id] ?? 0) + 1) % 10)}
                      className="flex h-9 items-center justify-center border border-cyan-400/25 bg-cyan-950/15 text-cyan-200 transition-all hover:border-cyan-300 hover:bg-cyan-900/30"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={onSubmitValves} className="h-12 w-full border border-cyan-300/60 bg-cyan-900/30 text-[11px] font-black uppercase tracking-[0.28em] text-cyan-100 transition-all hover:bg-cyan-800/50">
              guardar ajuste
            </button>
          </div>
        )}

        {showInventory && (
          <div className="space-y-5">
            <div className="max-h-[min(24rem,55vh)] space-y-2 overflow-y-auto pr-1">
              {player.inventory.length === 0 ? (
                <div className="border border-white/10 bg-black/40 py-12 text-center text-[10px] uppercase tracking-[0.24em] text-slate-600">
                  null storage content
                </div>
              ) : (
                player.inventory.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 border border-amber-400/10 bg-black/40 p-3 transition-all hover:border-amber-300/40">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-amber-400/20 bg-amber-950/15 text-amber-200">
                      <InventoryIcon type={item.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black uppercase tracking-[0.08em] text-slate-100">{item.name}</div>
                      <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{item.description}</div>
                    </div>
                    <span className="hidden text-[8px] font-bold uppercase tracking-[0.18em] text-slate-700 sm:block">id {item.id.slice(0, 4)}</span>
                  </div>
                ))
              )}
            </div>
            <button onClick={onCloseInventory} className="flex h-11 w-full items-center justify-center gap-2 border border-slate-600/40 bg-slate-950/60 text-[10px] font-black uppercase tracking-[0.24em] text-slate-300 transition-all hover:border-slate-300/60 hover:text-white">
              <X className="h-4 w-4" />
              close manifest
            </button>
          </div>
        )}
      </TerminalPanel>
    </div>
  )
}

function MiniMetric({ label, value, Icon, tone }: { label: string; value: string; Icon: LucideIcon; tone: HudTone }) {
  const toneClass = toneStyles[tone]

  return (
    <div className="min-w-0 border border-white/10 bg-black/40 px-2 py-2">
      <div className={cx('mb-1 flex items-center gap-1.5', toneClass.accent)}>
        <Icon className="h-3 w-3 shrink-0" />
        <span className="text-[8px] font-bold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <div className="text-lg font-black leading-none tracking-[0.08em] text-slate-100">{value}</div>
    </div>
  )
}

function CornerBrackets({ tone = 'red' }: { tone?: HudTone }) {
  const color = tone === 'cyan'
    ? 'rgba(103, 232, 249, 0.46)'
    : tone === 'amber'
      ? 'rgba(251, 191, 36, 0.42)'
      : tone === 'green'
        ? 'rgba(110, 231, 183, 0.42)'
        : 'rgba(248, 113, 113, 0.46)'

  return (
    <>
      <div className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2" style={{ borderColor: color }} />
      <div className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2" style={{ borderColor: color }} />
      <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2" style={{ borderColor: color }} />
      <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2" style={{ borderColor: color }} />
    </>
  )
}

function getPuzzleProgress(puzzle: Puzzle) {
  if (puzzle.type === 'sequence') {
    return {
      current: puzzle.currentSequenceIndex ?? 0,
      total: puzzle.sequenceSwitches?.length ?? 0,
    }
  }

  if (puzzle.type === 'memory') {
    return {
      current: puzzle.playerSequence?.length ?? puzzle.currentSequenceIndex ?? 0,
      total: puzzle.memorySequence?.length ?? 0,
    }
  }

  if (puzzle.type === 'pattern') {
    return {
      current: puzzle.currentPatternIndex ?? 0,
      total: puzzle.patternTiles?.length ?? 0,
    }
  }

  if (puzzle.type === 'code') {
    return {
      current: puzzle.enteredCode?.length ?? 0,
      total: puzzle.correctCode?.length ?? 4,
    }
  }

  if (puzzle.type === 'logic') {
    return {
      current: 0,
      total: puzzle.logicClues?.length ?? 0,
    }
  }

  return { current: 0, total: 0 }
}

function InventoryIcon({ type }: { type: InventoryType }) {
  const icons: Record<InventoryType, LucideIcon> = {
    key: KeyRound,
    fuse: Zap,
    document: FileText,
    code_piece: Lock,
    tool: Gauge,
    vhs_tape: Archive,
  }
  const Icon = icons[type]
  return <Icon className="h-5 w-5" />
}
