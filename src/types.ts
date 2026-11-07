export type StyleId = 1 | 2 | 3 | 4 | 5 | 6

export type StyleLabel = "A" | "B" | "C" | "D" | "E" | "F"

export const STYLE_IDS: readonly StyleId[] = [1, 2, 3, 4, 5, 6]
export const STYLE_LABELS: readonly StyleLabel[] = ["A", "B", "C", "D", "E", "F"]

export interface DrawEvent {
  index: number
  styleId: StyleId
  styleLabel: StyleLabel
  isNew: boolean
  countsAfter: [number, number, number, number, number, number]
  collectedAfter: StyleId[]
  missingAfter: StyleId[]
  distinctCountAfter: number
  newProbabilityBefore: number
}

export interface ActiveRound {
  roundIndex: number
  sequence: StyleId[]
  events: DrawEvent[]
  countsByStyle: [number, number, number, number, number, number]
  collected: StyleId[]
  missing: StyleId[]
  stageWaits: [number, number, number, number, number, number]
  stageStartedAt: number
  completed: boolean
}

export interface RoundResult {
  roundIndex: number
  sequence: StyleId[]
  events: DrawEvent[]
  countsByStyle: [number, number, number, number, number, number]
  totalPurchases: number
  duplicateCount: number
  lastNewStyleId: StyleId
  stageWaits: [number, number, number, number, number, number]
  completed: true
}

export interface ExperimentSummary {
  completedRounds: number
  totalPurchases: number
  totalDuplicates: number
  meanPurchases: number
  meanDuplicates: number
  minPurchases: number
  maxPurchases: number
  range: number
  duplicateRate: number
  exactSixCount: number
  exactSixRate: number
  theoryMean: 14.7
  meanMinusTheory: number
  histogram: [number, number, number, number, number, number]
  cumulativeMeans: number[]
}

export interface DiscoveryHypothesis {
  /** Student's prediction, recorded before the theoretical answer is shown. */
  meanPurchases: number
  reason: string
  submittedAt: string
  /** Completed rounds already present when this hypothesis was locked. */
  completedRoundsAtSubmission: number
}

export type TheoryUnlockMethod = "student" | "teacher"

export interface DiscoveryState {
  hypothesis?: DiscoveryHypothesis
  theoryUnlocked: boolean
  theoryUnlockedAt?: string
  theoryUnlockMethod?: TheoryUnlockMethod
}

export type ExperimentMode = "manual" | "batch"
export type ExperimentStatus =
  | "idle"
  | "opening"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"

export interface ExperimentSession {
  id: string
  mode: ExperimentMode
  plannedRounds: number
  completedRounds: number
  seed: number
  randomAlgorithm: "System.Random-compatible"
  randomAlgorithmVersion: "1"
  status: ExperimentStatus
  startedAt: string
  endedAt?: string
  rounds: RoundResult[]
  /** Current unfinished manual round; excluded from formal summary statistics. */
  activeRound?: ActiveRound
  summary: ExperimentSummary
  /** Discovery-mode evidence and theory-gate state for this inquiry. */
  discovery?: DiscoveryState
}

export interface ReplaySnapshot {
  step: number
  countsByStyle: [number, number, number, number, number, number]
  collected: StyleId[]
  missing: StyleId[]
  currentEvent?: DrawEvent
}

export const THEORY_MEAN = 14.7 as const
export const THEORY_EXACT_SIX_RATE = 720 / 6 ** 6

export const HISTOGRAM_LABELS = [
  "6～9",
  "10～13",
  "14～17",
  "18～21",
  "22～25",
  "26+",
] as const
