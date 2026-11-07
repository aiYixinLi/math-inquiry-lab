import type {
  CandidateFloorStatistics,
  ElevatorModelInput,
  ElevatorOptimizationObjective,
} from "./model"
import { APPLICATION_VERSION } from "../../../app/version"

export type ElevatorSourceType =
  | "deterministic_calculation"
  | "synthetic_simulation"

export interface ElevatorExportSnapshot {
  readonly sessionId: string
  readonly sourceType: ElevatorSourceType
  readonly presetId: string
  readonly seed: number | null
  readonly startedAt: string
  readonly endedAt: string
  readonly hypothesisSubmittedAt: string
  readonly theoryViewedAt: string | null
  readonly predictedFloor: number
  readonly predictedObjective: ElevatorOptimizationObjective
  readonly objective: ElevatorOptimizationObjective
  readonly modelInput: ElevatorModelInput
  readonly rawCalls: readonly number[]
  readonly statistics: readonly CandidateFloorStatistics[]
  readonly optimalFloors: readonly number[]
}

export interface ElevatorExportPayload {
  readonly schema_version: "1.0.0"
  readonly project_scope: "math-inquiry-web-app"
  readonly topic_id: "elevator"
  readonly model_version: "idle-floor-response-v1"
  readonly app_version: typeof APPLICATION_VERSION
  readonly session_id: string
  readonly source_type: ElevatorSourceType
  readonly data_status: "candidate"
  readonly parameters: {
    readonly floor_count: number
    readonly seconds_per_floor: number
    readonly fixed_time: number
    readonly preset_id: string
    readonly objective: ElevatorOptimizationObjective
  }
  readonly algorithm_name_and_version: string
  readonly seed: number | null
  readonly started_at: string
  readonly ended_at: string
  readonly exported_at: string
  readonly hypothesis_submitted_at: string
  readonly theory_viewed_at: string | null
  readonly raw_records: readonly Record<string, string | number>[]
  readonly summary: {
    readonly predicted_floor: number
    readonly predicted_objective: ElevatorOptimizationObjective
    readonly optimal_floors: readonly number[]
    readonly candidate_statistics: readonly CandidateFloorStatistics[]
  }
}

export function buildElevatorExportPayload(
  snapshot: ElevatorExportSnapshot,
  exportedAt = new Date().toISOString(),
): ElevatorExportPayload {
  const rawRecords = snapshot.sourceType === "synthetic_simulation"
    ? snapshot.rawCalls.map((floor, index) => ({
        record_type: "call",
        call_index: index + 1,
        floor,
      }))
    : snapshot.modelInput.frequencies.map(({ floor, frequency }) => ({
        record_type: "frequency",
        floor,
        frequency,
      }))

  return {
    schema_version: "1.0.0",
    project_scope: "math-inquiry-web-app",
    topic_id: "elevator",
    model_version: "idle-floor-response-v1",
    app_version: APPLICATION_VERSION,
    session_id: snapshot.sessionId,
    source_type: snapshot.sourceType,
    data_status: "candidate",
    parameters: {
      floor_count: snapshot.modelInput.floorCount,
      seconds_per_floor: snapshot.modelInput.secondsPerFloor,
      fixed_time: snapshot.modelInput.fixedTime,
      preset_id: snapshot.presetId,
      objective: snapshot.objective,
    },
    algorithm_name_and_version: snapshot.sourceType === "synthetic_simulation"
      ? "mulberry32-weighted-sampling@1 + weighted-absolute-distance-enumeration@1"
      : "weighted-absolute-distance-enumeration@1",
    seed: snapshot.seed,
    started_at: snapshot.startedAt,
    ended_at: snapshot.endedAt,
    exported_at: exportedAt,
    hypothesis_submitted_at: snapshot.hypothesisSubmittedAt,
    theory_viewed_at: snapshot.theoryViewedAt,
    raw_records: rawRecords,
    summary: {
      predicted_floor: snapshot.predictedFloor,
      predicted_objective: snapshot.predictedObjective,
      optimal_floors: [...snapshot.optimalFloors],
      candidate_statistics: snapshot.statistics.map((item) => ({ ...item })),
    },
  }
}

export function buildElevatorCsv(payload: ElevatorExportPayload): string {
  const common = {
    schema_version: payload.schema_version,
    topic_id: payload.topic_id,
    model_version: payload.model_version,
    source_type: payload.source_type,
    project_scope: payload.project_scope,
    app_version: payload.app_version,
    session_id: payload.session_id,
    data_status: payload.data_status,
    algorithm_name_and_version: payload.algorithm_name_and_version,
    seed: payload.seed ?? "",
    started_at: payload.started_at,
    ended_at: payload.ended_at,
    exported_at: payload.exported_at,
    hypothesis_submitted_at: payload.hypothesis_submitted_at,
    theory_viewed_at: payload.theory_viewed_at ?? "",
    parameters_json: JSON.stringify(payload.parameters),
  }
  const rows: Record<string, string | number>[] = []

  payload.raw_records.forEach((record, index) => {
    rows.push({
      ...common,
      record_type: String(record.record_type),
      record_index: Number(record.call_index ?? index + 1),
      floor: Number(record.floor),
      frequency: Number(record.frequency ?? ""),
    })
  })

  payload.summary.candidate_statistics.forEach((candidate) => {
    rows.push({
      ...common,
      record_type: "candidate",
      candidate_floor: candidate.candidateFloor,
      total_distance: candidate.totalDistance,
      total_time: candidate.totalTime,
      mean_time: candidate.meanTime,
      max_time: candidate.maxTime,
      is_optimal: payload.summary.optimal_floors.includes(candidate.candidateFloor) ? 1 : 0,
    })
  })

  const columns = [
    "schema_version",
    "topic_id",
    "model_version",
    "source_type",
    "project_scope",
    "app_version",
    "session_id",
    "data_status",
    "algorithm_name_and_version",
    "seed",
    "started_at",
    "ended_at",
    "exported_at",
    "hypothesis_submitted_at",
    "theory_viewed_at",
    "parameters_json",
    "record_type",
    "record_index",
    "floor",
    "frequency",
    "candidate_floor",
    "total_distance",
    "total_time",
    "mean_time",
    "max_time",
    "is_optimal",
  ] as const

  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(",")),
  ].join("\n")
}

export function downloadElevatorText(
  fileName: string,
  content: string,
  mimeType: string,
): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
