import type {
  BlindBoxParams,
  CheckResult,
  ExperimentResult,
  FreeConditionReport,
  FreeConditionSetup,
  KindsSample,
} from "../core/blindbox"
import type { ExperimentSummary, RoundResult } from "../types"

export interface StartWorkerMessage {
  type: "start"
  runId: string
  rounds: number
  seed: number
  batchSize?: number
  delayMs?: number
}

export interface PauseWorkerMessage {
  type: "pause"
  runId: string
}

export interface ResumeWorkerMessage {
  type: "resume"
  runId: string
}

export interface CancelWorkerMessage {
  type: "cancel"
  runId: string
}

export type SimulationWorkerRequest =
  | StartWorkerMessage
  | PauseWorkerMessage
  | ResumeWorkerMessage
  | CancelWorkerMessage

export interface WorkerProgressMessage {
  type: "progress"
  runId: string
  completedRounds: number
  plannedRounds: number
  /** Results generated since the preceding progress message. */
  batch: RoundResult[]
  /** All completed results, included so dropped UI updates cannot lose data. */
  rounds: RoundResult[]
  summary: ExperimentSummary
}

export interface WorkerCompleteMessage {
  type: "complete"
  runId: string
  completedRounds: number
  plannedRounds: number
  rounds: RoundResult[]
  summary: ExperimentSummary
}

export interface WorkerPausedMessage {
  type: "paused"
  runId: string
  completedRounds: number
  plannedRounds: number
}

export interface WorkerResumedMessage {
  type: "resumed"
  runId: string
  completedRounds: number
  plannedRounds: number
}

export interface WorkerCancelledMessage {
  type: "cancelled"
  runId: string
  completedRounds: number
  plannedRounds: number
  rounds: RoundResult[]
  summary: ExperimentSummary
}

export interface WorkerErrorMessage {
  type: "error"
  runId: string
  message: string
}

export type SimulationWorkerResponse =
  | WorkerProgressMessage
  | WorkerCompleteMessage
  | WorkerPausedMessage
  | WorkerResumedMessage
  | WorkerCancelledMessage
  | WorkerErrorMessage

export interface FreeConditionWorkerRequest {
  id: number
  setup: FreeConditionSetup
  sample: KindsSample | null
}

export type FreeConditionWorkerResponse =
  | { id: number; ok: true; report: FreeConditionReport }
  | { id: number; ok: false; message: string }

export type LadderWorkerRequest =
  | {
      id: number
      op: "experiment"
      params: BlindBoxParams
      runs: number
      seed: number
      withinDraws: number | null
      /** L6：每轮固定买这么多盒，用 Chao1 估计一共几款；其余各级为 null。 */
      fixedDraws: number | null
    }
  | { id: number; op: "checks"; setup: FreeConditionSetup }

export type LadderWorkerResponse =
  | { id: number; ok: true; op: "experiment"; result: ExperimentResult }
  | { id: number; ok: true; op: "checks"; checks: CheckResult[] }
  | { id: number; ok: false; message: string }
