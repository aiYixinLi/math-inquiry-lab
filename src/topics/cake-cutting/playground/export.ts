import type {
  CakeExperimentTemplate,
  CakeExperimentSnapshot,
  SavedCakePlan,
} from "./experiment"
import { APPLICATION_VERSION } from "../../../app/version"

export const CAKE_EXPORT_SCHEMA = "math-inquiry-experiment/v1"
export const CAKE_MODEL_ID = "controlled-cake-partition"
export const CAKE_MODEL_VERSION = "controlled-partition-v1"

export interface CakeHypothesis {
  readonly predicted_template: CakeExperimentTemplate
  readonly reason: string
}

export interface CakeExportOptions {
  readonly sessionId: string
  readonly sessionStartedAt: string
  readonly sessionEndedAt?: string
  readonly exportedAt?: string
  readonly hypothesisSubmittedAt?: string | null
  readonly theoryViewedAt?: string | null
  readonly hypothesis?: CakeHypothesis | null
  readonly savedPlans?: readonly SavedCakePlan[]
}

export interface CakeRawRecord {
  readonly pieceIndex: number
  readonly pieceId: string
  readonly area: number
  readonly areaShare: number
  readonly targetArea: number
  readonly originalOuterBoundary: number
  readonly newCutBoundary: number
  readonly totalPerimeter: number
}

export interface CakeExperimentExport {
  readonly schema: string
  readonly topic: "cake-cutting"
  readonly model: {
    readonly id: string
    readonly version: string
    readonly calculation: "deterministic-exact-geometry"
  }
  readonly source: {
    readonly type: "interactive_geometry"
    readonly status: "student-generated-candidate"
    readonly evidenceScope: "program-and-data-evidence-only"
  }
  readonly time: {
    readonly sessionStartedAt: string
    readonly exportedAt: string
  }
  readonly parameters: CakeExperimentSnapshot["parameters"]
  readonly metrics: CakeExperimentSnapshot["partition"]["metrics"]
  readonly rawRecords: readonly CakeRawRecord[]
  readonly savedPlanCount: number
  readonly schema_version: "1.0.0"
  readonly project_scope: "math-inquiry-web-app"
  readonly topic_id: "cake-cutting"
  readonly model_version: "controlled-partition-v1"
  readonly app_version: typeof APPLICATION_VERSION
  readonly session_id: string
  readonly source_type: "interactive_geometry"
  readonly data_status: "candidate"
  readonly algorithm_name_and_version: string
  readonly seed: null
  readonly started_at: string
  readonly ended_at: string
  readonly exported_at: string
  readonly hypothesis_submitted_at: string | null
  readonly theory_viewed_at: string | null
  readonly hypothesis: CakeHypothesis | null
  readonly raw_records: readonly CakeRawRecord[]
  readonly summary: CakeExperimentSnapshot["partition"]["metrics"]
}

export function createCakeExportPayload(
  snapshot: CakeExperimentSnapshot,
  options: CakeExportOptions,
): CakeExperimentExport {
  const totalArea = snapshot.partition.totalArea
  const exportedAt = options.exportedAt ?? new Date().toISOString()
  const theoryViewedAt = options.theoryViewedAt ?? null
  const endedAt = options.sessionEndedAt ?? theoryViewedAt ?? exportedAt
  const rawRecords = snapshot.partition.pieces.map((piece, index) => ({
    pieceIndex: index + 1,
    pieceId: piece.id,
    area: piece.area,
    areaShare: piece.area / totalArea,
    targetArea: snapshot.partition.metrics.targetArea,
    originalOuterBoundary: piece.originalOuterBoundary,
    newCutBoundary: piece.newCutBoundary,
    totalPerimeter: piece.totalPerimeter,
  }))
  return {
    schema: CAKE_EXPORT_SCHEMA,
    topic: "cake-cutting",
    model: {
      id: CAKE_MODEL_ID,
      version: CAKE_MODEL_VERSION,
      calculation: "deterministic-exact-geometry",
    },
    source: {
      type: "interactive_geometry",
      status: "student-generated-candidate",
      evidenceScope: "program-and-data-evidence-only",
    },
    time: {
      sessionStartedAt: options.sessionStartedAt,
      exportedAt,
    },
    parameters: snapshot.parameters,
    metrics: snapshot.partition.metrics,
    rawRecords,
    savedPlanCount: options.savedPlans?.length ?? 0,
    schema_version: "1.0.0",
    project_scope: "math-inquiry-web-app",
    topic_id: "cake-cutting",
    model_version: CAKE_MODEL_VERSION,
    app_version: APPLICATION_VERSION,
    session_id: options.sessionId,
    source_type: "interactive_geometry",
    data_status: "candidate",
    algorithm_name_and_version: "exact-circle-sector-and-rectangle-partition-formulas@1",
    seed: null,
    started_at: options.sessionStartedAt,
    ended_at: endedAt,
    exported_at: exportedAt,
    hypothesis_submitted_at: options.hypothesisSubmittedAt ?? null,
    theory_viewed_at: theoryViewedAt,
    hypothesis: options.hypothesis ?? null,
    raw_records: rawRecords,
    summary: snapshot.partition.metrics,
  }
}

export function cakeExportToCsv(payload: CakeExperimentExport): string {
  const parameterJson = JSON.stringify(payload.parameters)
  const hypothesisJson = payload.hypothesis === null
    ? ""
    : JSON.stringify(payload.hypothesis)
  const headers = [
    "schema_version",
    "project_scope",
    "topic_id",
    "model_version",
    "app_version",
    "session_id",
    "source_type",
    "data_status",
    "algorithm_name_and_version",
    "started_at",
    "ended_at",
    "exported_at",
    "hypothesis_submitted_at",
    "theory_viewed_at",
    "hypothesis_json",
    "parameters_json",
    "piece_index",
    "piece_id",
    "area",
    "area_share",
    "target_area",
    "original_outer_boundary",
    "new_cut_boundary",
    "total_perimeter",
  ]
  const rows = payload.rawRecords.map((record) => [
    payload.schema_version,
    payload.project_scope,
    payload.topic_id,
    payload.model_version,
    payload.app_version,
    payload.session_id,
    payload.source_type,
    payload.data_status,
    payload.algorithm_name_and_version,
    payload.started_at,
    payload.ended_at,
    payload.exported_at,
    payload.hypothesis_submitted_at ?? "",
    payload.theory_viewed_at ?? "",
    hypothesisJson,
    parameterJson,
    record.pieceIndex,
    record.pieceId,
    record.area,
    record.areaShare,
    record.targetArea,
    record.originalOuterBoundary,
    record.newCutBoundary,
    record.totalPerimeter,
  ])

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n")
}

export function downloadCakeJson(payload: CakeExperimentExport): void {
  downloadFile(
    `蛋糕切分Web计算候选_${compactTime(payload.time.exportedAt)}.json`,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8",
  )
}

export function downloadCakeCsv(payload: CakeExperimentExport): void {
  downloadFile(
    `蛋糕切分Web计算候选_${compactTime(payload.time.exportedAt)}.csv`,
    `\uFEFF${cakeExportToCsv(payload)}`,
    "text/csv;charset=utf-8",
  )
}

function csvCell(value: unknown): string {
  const text = String(value ?? "")
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function compactTime(isoTime: string): string {
  return isoTime.replaceAll(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z")
}

function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
