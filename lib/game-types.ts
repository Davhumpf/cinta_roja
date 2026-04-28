// Cinta Roja - Game Types - Enhanced Puzzle System

export interface Position {
  x: number
  y: number
}

export interface Player {
  position: Position
  width: number
  height: number
  speed: number
  direction: 'up' | 'down' | 'left' | 'right'
  isMoving: boolean
  health: number
  tapes: number
  sanity: number
  inventory: InventoryItem[]
  isHiding: boolean
  isSprinting: boolean
  stamina: number
  hasFlashlight: boolean
  flashlightBroken: boolean // Broken flashlight that flickers
}

export interface InventoryItem {
  id: string
  type: 'key' | 'fuse' | 'document' | 'code_piece' | 'tool' | 'vhs_tape'
  name: string
  description: string
  usesWith?: string // ID of object it can be used with
}

export interface Enemy {
  id: string
  type: 'echo' | 'operator' | 'shadow' | 'stalker'
  position: Position
  width: number
  height: number
  speed: number
  direction: 'up' | 'down' | 'left' | 'right'
  isActive: boolean
  detectionRadius: number
  patrolPath?: Position[] // For complex patrol patterns
  patrolIndex?: number
  behaviorState: 'patrol' | 'chase' | 'search' | 'idle'
  lastKnownPlayerPos?: Position
  canHear: boolean // Can detect player by sound
  hearingRadius: number
  stunned: boolean
  stunnedTimer: number
}

export interface Collectible {
  id: string
  type: 'vhs_tape' | 'clue' | 'memory_fragment' | 'key' | 'fuse' | 'code_piece' | 'document' | 'tool'
  position: Position
  width: number
  height: number
  collected: boolean
  dialogueId?: string
  inventoryItem?: InventoryItem
  hidden: boolean // Only visible after solving puzzle or using item
  revealedBy?: string // ID of puzzle/switch that reveals it
}

export interface Obstacle {
  id: string
  type: 'wall' | 'furniture' | 'debris' | 'fire' | 'door' | 'hiding_spot' | 'vent' | 'pressure_plate' | 'electric_floor'
  position: Position
  width: number
  height: number
  solid: boolean
  requiresKey?: string // Key ID needed
  requiresCode?: string // Code needed to open
  isOpen?: boolean
  canHideIn?: boolean
  isElectrified?: boolean
  electrifyPattern?: number[] // [on_frames, off_frames]
  linkedTo?: string[] // IDs of things this activates
}

export interface Switch {
  id: string
  type: 'lever' | 'button' | 'dial' | 'keypad' | 'fuse_box' | 'valve'
  position: Position
  width: number
  height: number
  isActivated: boolean
  requiresItem?: string // Item ID needed to activate
  linkedTo: string[] // IDs of doors/traps/puzzles it affects
  correctSequenceIndex?: number // For sequence puzzles
  dialValue?: number // For dial puzzles (0-9)
  code?: string // For keypads
}

export interface Puzzle {
  id: string
  type: 'sequence' | 'code' | 'pattern' | 'timing' | 'stealth' | 'chase' | 'memory' | 'logic'
  name: string
  description: string
  hint: string
  isSolved: boolean
  // Sequence puzzle: activate switches in correct order
  sequenceSwitches?: string[] // Ordered switch IDs
  currentSequenceIndex?: number
  // Code puzzle: enter correct code on keypad
  correctCode?: string
  enteredCode?: string
  // Pattern puzzle: step on pressure plates in pattern
  patternTiles?: string[] // Ordered tile IDs
  currentPatternIndex?: number
  // Timing puzzle: do something within time limit
  timeLimit?: number
  timeRemaining?: number
  // Memory puzzle: remember and repeat a sequence
  memorySequence?: string[]
  playerSequence?: string[]
  // Logic puzzle: figure out combination from clues
  logicClues?: string[]
  // Rewards
  unlocksExit?: boolean
  unlocksCollectible?: string
  unlocksDoor?: string
  triggersDialogue?: string
  spawnEnemy?: string
}

export interface PressurePlate {
  id: string
  position: Position
  width: number
  height: number
  isPressed: boolean
  isCorrect: boolean // For pattern puzzles
  linkedPuzzle: string
  triggerEffect?: 'open_door' | 'spawn_enemy' | 'electrify' | 'reveal_item' | 'play_sound'
  triggerTarget?: string
}

export interface HazardZone {
  id: string
  type: 'fire' | 'electric' | 'gas' | 'dark' | 'noise'
  position: Position
  width: number
  height: number
  isActive: boolean
  pattern: 'always' | 'timed' | 'triggered'
  onDuration?: number
  offDuration?: number
  currentTimer?: number
  damage: number
  triggeredBy?: string
}

export interface NPC {
  id: string
  name: string
  position: Position
  width: number
  height: number
  dialogueIds: string[]
  currentDialogueIndex: number
  sprite: string
  requiresItem?: string // Must give item to progress
  givesItem?: InventoryItem
  isBlocking?: boolean // Blocks path until talked to
  hasBeenHelped?: boolean
}

export interface Dialogue {
  id: string
  speaker: string
  text: string
  choices?: DialogueChoice[]
  nextDialogueId?: string
  effect?: 'reduce_sanity' | 'add_tape' | 'reveal_memory' | 'trigger_event' | 'give_item' | 'reveal_code' | 'unlock_door'
  effectData?: string // Additional data for effect
  requiresItem?: string // Only shows if player has item
}

export interface DialogueChoice {
  text: string
  nextDialogueId: string
  requiresItem?: string
  giveItem?: boolean
}

export interface LevelHint {
  id: string
  text: string
  triggerCondition: 'time' | 'deaths' | 'stuck' | 'near_puzzle'
  conditionValue: number
  hasBeenShown: boolean
}

export interface Level {
  id: number
  name: string
  description: string
  objective: string // Clear objective for player
  width: number
  height: number
  playerStart: Position
  obstacles: Obstacle[]
  enemies: Enemy[]
  collectibles: Collectible[]
  npcs: NPC[]
  switches: Switch[]
  puzzles: Puzzle[]
  pressurePlates: PressurePlate[]
  hazardZones: HazardZone[]
  hints: LevelHint[]
  hidingSpots: Position[]
  exitPosition: Position
  exitWidth: number
  exitHeight: number
  exitLocked: boolean
  exitUnlockedBy?: string // Puzzle ID that unlocks exit
  backgroundColor: string
  ambientColor: string
  fogOfWar: boolean // Limited visibility
  visibilityRadius?: number
  litBackgroundColor?: string
  litAmbientColor?: string
  introDialogueIds: string[]
  completionDialogueIds: string[]
  requiredTapes: number
  isCompleted: boolean
  deathCount: number
  timeSpent: number
  musicTrack?: string
  ambientSounds?: string[]
  // Darkness system
  isDark?: boolean // Level starts in complete darkness
  lightsOn?: boolean // Lights have been turned on
  darkMazeWalls?: Obstacle[] // Extra walls only visible/active when dark
  requiresLightToExit?: boolean // Must turn on lights to see exit
}

export interface GameState {
  currentLevel: number
  player: Player
  levels: Level[]
  dialogues: Record<string, Dialogue>
  currentDialogue: Dialogue | null
  isShowingDialogue: boolean
  isPaused: boolean
  isGameOver: boolean
  isVictory: boolean
  totalTapesCollected: number
  memoriesUnlocked: string[]
  glitchIntensity: number
  showVHSEffect: boolean
  codeInput: string // For keypad puzzles
  showCodeInput: boolean
  activeKeypad: string | null
  showInventory: boolean
  selectedInventoryItem: number
  showHint: boolean
  currentHint: string
  totalDeaths: number
  playTime: number
  // Flashlight system
  flashlightOn?: boolean
  flashlightFlickerState?: 'off' | 'flickering' | 'stable'
  flashlightFlickerTimer?: number
  flashlightFlickerCount?: number
}

export interface GameKeys {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  interact: boolean
  pause: boolean
  sprint: boolean
  hide: boolean
  inventory: boolean
  useItem: boolean
}

export type GameScreen = 'title' | 'playing' | 'dialogue' | 'pause' | 'gameover' | 'victory' | 'cutscene' | 'keypad' | 'inventory'
