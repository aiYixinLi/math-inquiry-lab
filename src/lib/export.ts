import {
  STYLE_LABELS,
  type ExperimentSession,
  type StyleId,
} from "../types"
import { APPLICATION_VERSION } from "../app/version"

const UTF8_BOM = "\uFEFF"
const CSV_LINE_BREAK = "\r\n"
const WEB_EXPORT_SOURCE_TYPE = "web_simulation"
const WEB_EXPORT_SOURCE_LABEL = "Web应用模拟"
const WEB_EXPORT_DATA_STATUS = "candidate"
const WEB_EXPORT_DATA_STATUS_LABEL = "候选数据"
const WEB_APPLICATION_NAME = "blind-box-math-lab"
const WEB_APPLICATION_VERSION = APPLICATION_VERSION
const WEB_PROJECT_SCOPE = "math-inquiry-web-app"
const WEB_TOPIC_ID = "blind-box"
const WEB_MODEL_VERSION = "blind-box-equiprobable-v1"

type ExportKind = "轮次汇总" | "购买明细" | "完整数据"

interface WebExportMetadata {
  schemaVersion: "1.0"
  sourceType: typeof WEB_EXPORT_SOURCE_TYPE
  sourceLabel: typeof WEB_EXPORT_SOURCE_LABEL
  dataStatus: typeof WEB_EXPORT_DATA_STATUS
  dataStatusLabel: typeof WEB_EXPORT_DATA_STATUS_LABEL
  applicationName: typeof WEB_APPLICATION_NAME
  applicationVersion: typeof WEB_APPLICATION_VERSION
  sessionId: string
  seed: number
  randomAlgorithm: ExperimentSession["randomAlgorithm"]
  randomAlgorithmVersion: ExperimentSession["randomAlgorithmVersion"]
  exportedAt: string
  schema_version: "1.0.0"
  project_scope: typeof WEB_PROJECT_SCOPE
  topic_id: typeof WEB_TOPIC_ID
  model_version: typeof WEB_MODEL_VERSION
  app_version: typeof APPLICATION_VERSION
  session_id: string
  source_type: typeof WEB_EXPORT_SOURCE_TYPE
  data_status: typeof WEB_EXPORT_DATA_STATUS
  parameters: {
    style_count: 6
    probability_model: "equal-independent-with-replacement"
    stop_condition: "first-complete-set"
    mode: ExperimentSession["mode"]
    planned_rounds: number
  }
  algorithm_name_and_version: string
  started_at: string
  ended_at: string | null
  exported_at: string
  hypothesis_submitted_at: string | null
  theory_viewed_at: string | null
}

function createExportMetadata(
  session: ExperimentSession,
  exportedAt: Date,
): WebExportMetadata {
  const exportedAtIso = exportedAt.toISOString()
  const theoryUnlocked = session.discovery?.theoryUnlocked === true
  return {
    schemaVersion: "1.0",
    sourceType: WEB_EXPORT_SOURCE_TYPE,
    sourceLabel: WEB_EXPORT_SOURCE_LABEL,
    dataStatus: WEB_EXPORT_DATA_STATUS,
    dataStatusLabel: WEB_EXPORT_DATA_STATUS_LABEL,
    applicationName: WEB_APPLICATION_NAME,
    applicationVersion: WEB_APPLICATION_VERSION,
    sessionId: session.id,
    seed: session.seed,
    randomAlgorithm: session.randomAlgorithm,
    randomAlgorithmVersion: session.randomAlgorithmVersion,
    exportedAt: exportedAtIso,
    schema_version: "1.0.0",
    project_scope: WEB_PROJECT_SCOPE,
    topic_id: WEB_TOPIC_ID,
    model_version: WEB_MODEL_VERSION,
    app_version: APPLICATION_VERSION,
    session_id: session.id,
    source_type: WEB_EXPORT_SOURCE_TYPE,
    data_status: WEB_EXPORT_DATA_STATUS,
    parameters: {
      style_count: 6,
      probability_model: "equal-independent-with-replacement",
      stop_condition: "first-complete-set",
      mode: session.mode,
      planned_rounds: session.plannedRounds,
    },
    algorithm_name_and_version:
      `${session.randomAlgorithm}@${session.randomAlgorithmVersion}`,
    started_at: session.startedAt,
    ended_at: session.endedAt ?? null,
    exported_at: exportedAtIso,
    hypothesis_submitted_at: session.discovery?.hypothesis?.submittedAt ?? null,
    theory_viewed_at: theoryUnlocked
      ? session.discovery?.theoryUnlockedAt ?? null
      : null,
  }
}

function metadataCsvCells(metadata: WebExportMetadata): Array<string | number> {
  return [
    metadata.sourceLabel,
    metadata.dataStatusLabel,
    metadata.applicationName,
    metadata.applicationVersion,
    metadata.sessionId,
    metadata.seed,
    metadata.randomAlgorithm,
    metadata.randomAlgorithmVersion,
    metadata.exportedAt,
    metadata.schema_version,
    metadata.project_scope,
    metadata.topic_id,
    metadata.model_version,
    metadata.app_version,
    metadata.session_id,
    metadata.source_type,
    metadata.data_status,
    JSON.stringify(metadata.parameters),
    metadata.algorithm_name_and_version,
    metadata.seed,
    metadata.started_at,
    metadata.ended_at ?? "",
    metadata.exported_at,
    metadata.hypothesis_submitted_at ?? "",
    metadata.theory_viewed_at ?? "",
  ]
}

const METADATA_CSV_HEADERS = [
  "数据来源",
  "数据状态",
  "应用名称",
  "应用版本",
  "会话ID",
  "随机种子",
  "随机算法",
  "算法版本",
  "导出时间",
  "schema_version",
  "project_scope",
  "topic_id",
  "model_version",
  "app_version",
  "session_id",
  "source_type",
  "data_status",
  "parameters_json",
  "algorithm_name_and_version",
  "seed",
  "started_at",
  "ended_at",
  "exported_at",
  "hypothesis_submitted_at",
  "theory_viewed_at",
] as const

function escapeCsvCell(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function createCsv(rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  return (
    UTF8_BOM +
    rows
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
      .join(CSV_LINE_BREAK) +
    CSV_LINE_BREAK
  )
}

function labelsForStyleIds(styleIds: readonly StyleId[]): string {
  return styleIds.length === 0
    ? "无"
    : styleIds.map((styleId) => STYLE_LABELS[styleId - 1]).join(" ")
}

/** Creates the round-level CSV. The first five columns match the original PowerShell export. */
export function generateSummaryCsv(
  session: ExperimentSession,
  exportedAt: Date = new Date(),
): string {
  const metadata = createExportMetadata(session, exportedAt)
  const header = [
    "轮次",
    "投掷顺序",
    "集齐所需次数",
    "重复次数",
    "最后集到的点数",
    ...STYLE_LABELS.map((label) => `${label}数量`),
    ...STYLE_LABELS.map((_, index) => `阶段${index + 1}等待次数`),
    "轮次状态",
    "尚缺款式",
    ...METADATA_CSV_HEADERS,
  ]

  const rows: Array<Array<string | number>> = session.rounds.map((round) => [
    round.roundIndex,
    round.sequence.join(" "),
    round.totalPurchases,
    round.duplicateCount,
    round.lastNewStyleId,
    ...round.countsByStyle,
    ...round.stageWaits,
    "已完成",
    "无",
    ...metadataCsvCells(metadata),
  ])

  const activeRound = session.activeRound
  if (activeRound && activeRound.sequence.length > 0 && !activeRound.completed) {
    const lastNewStyleId = [...activeRound.events]
      .reverse()
      .find((event) => event.isNew)?.styleId ?? ""
    rows.push([
      activeRound.roundIndex,
      activeRound.sequence.join(" "),
      activeRound.sequence.length,
      activeRound.sequence.length - activeRound.collected.length,
      lastNewStyleId,
      ...activeRound.countsByStyle,
      ...activeRound.stageWaits,
      "未完成",
      labelsForStyleIds(activeRound.missing),
      ...metadataCsvCells(metadata),
    ])
  }

  return createCsv([header, ...rows])
}

/** Creates the purchase-level CSV, including the collection and missing styles after every draw. */
export function generateDetailCsv(
  session: ExperimentSession,
  exportedAt: Date = new Date(),
): string {
  const metadata = createExportMetadata(session, exportedAt)
  const theoryUnlocked = session.discovery?.theoryUnlocked === true
  const header = [
    "轮次",
    "购买序号",
    "款式",
    "点数",
    "新款或重复款",
    ...STYLE_LABELS.map((label) => `${label}当前数量`),
    "已收集款式",
    "尚缺款式",
    ...(theoryUnlocked ? ["购买前新款概率"] : []),
    "轮次状态",
    ...METADATA_CSV_HEADERS,
  ]

  const rows: Array<Array<string | number>> = session.rounds.flatMap((round) =>
    round.events.map((event) => [
      round.roundIndex,
      event.index,
      event.styleLabel,
      event.styleId,
      event.isNew ? "新款" : "重复款",
      ...event.countsAfter,
      labelsForStyleIds(event.collectedAfter),
      labelsForStyleIds(event.missingAfter),
      ...(theoryUnlocked ? [event.newProbabilityBefore] : []),
      "已完成",
      ...metadataCsvCells(metadata),
    ]),
  )

  if (session.activeRound && !session.activeRound.completed) {
    rows.push(
      ...session.activeRound.events.map((event) => [
        session.activeRound?.roundIndex ?? 0,
        event.index,
        event.styleLabel,
        event.styleId,
        event.isNew ? "新款" : "重复款",
        ...event.countsAfter,
        labelsForStyleIds(event.collectedAfter),
        labelsForStyleIds(event.missingAfter),
        ...(theoryUnlocked ? [event.newProbabilityBefore] : []),
        "未完成",
        ...metadataCsvCells(metadata),
      ]),
    )
  }

  return createCsv([header, ...rows])
}

/** Creates a complete, human-readable JSON snapshot without mutating the session. */
export function generateJson(
  session: ExperimentSession,
  exportedAt: Date = new Date(),
): string {
  const theoryUnlocked = session.discovery?.theoryUnlocked === true
  const exportMetadata = createExportMetadata(session, exportedAt)
  const payload = {
    exportMetadata,
    ...session,
    schema_version: exportMetadata.schema_version,
    project_scope: exportMetadata.project_scope,
    topic_id: exportMetadata.topic_id,
    model_version: exportMetadata.model_version,
    app_version: exportMetadata.app_version,
    session_id: exportMetadata.session_id,
    source_type: exportMetadata.source_type,
    data_status: exportMetadata.data_status,
    parameters: exportMetadata.parameters,
    algorithm_name_and_version: exportMetadata.algorithm_name_and_version,
    seed: exportMetadata.seed,
    started_at: exportMetadata.started_at,
    ended_at: exportMetadata.ended_at,
    exported_at: exportMetadata.exported_at,
    hypothesis_submitted_at: exportMetadata.hypothesis_submitted_at,
    theory_viewed_at: exportMetadata.theory_viewed_at,
    raw_records: {
      completed_rounds: session.rounds,
      active_round: session.activeRound ?? null,
    },
    summary: session.summary,
  }
  return `${JSON.stringify(
    payload,
    (key, value) =>
      !theoryUnlocked &&
      (key === "theoryMean" ||
        key === "meanMinusTheory" ||
        key === "newProbabilityBefore")
        ? undefined
        : value,
    2,
  )}\n`
}

function timestampForFilename(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("")
}

/** Builds a filesystem-safe Chinese filename. Passing a date makes this helper deterministic in tests. */
export function buildExportFilename(
  kind: ExportKind,
  session: ExperimentSession,
  date: Date = new Date(),
): string {
  const extension = kind === "完整数据" ? "json" : "csv"
  return `盲盒Web模拟候选_${session.completedRounds}轮_${kind}_${timestampForFilename(date)}.${extension}`
}

export function triggerBrowserDownload(content: string, mimeType: string, filename: string): void {
  if (
    typeof document === "undefined" ||
    typeof Blob === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return
  }

  let objectUrl: string | null = null
  let anchor: HTMLAnchorElement | null = null

  try {
    const blob = new Blob([content], { type: mimeType })
    objectUrl = URL.createObjectURL(blob)
    anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = filename
    anchor.hidden = true
    document.body.append(anchor)
    anchor.click()
  } catch {
    // The caller retains the source session and can retry or choose another export.
  } finally {
    anchor?.remove()
    if (objectUrl !== null && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(objectUrl)
    }
  }
}

export function downloadSummaryCsv(session: ExperimentSession): string {
  const exportedAt = new Date()
  const filename = buildExportFilename("轮次汇总", session, exportedAt)
  triggerBrowserDownload(
    generateSummaryCsv(session, exportedAt),
    "text/csv;charset=utf-8",
    filename,
  )
  return filename
}

export function downloadDetailCsv(session: ExperimentSession): string {
  const exportedAt = new Date()
  const filename = buildExportFilename("购买明细", session, exportedAt)
  triggerBrowserDownload(
    generateDetailCsv(session, exportedAt),
    "text/csv;charset=utf-8",
    filename,
  )
  return filename
}

export function downloadJson(session: ExperimentSession): string {
  const exportedAt = new Date()
  const filename = buildExportFilename("完整数据", session, exportedAt)
  triggerBrowserDownload(
    generateJson(session, exportedAt),
    "application/json;charset=utf-8",
    filename,
  )
  return filename
}
