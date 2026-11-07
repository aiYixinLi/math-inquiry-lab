// 建模阶梯的学习记录：存在本机浏览器里，可以导出给研究日志和同学试用（研究方案 8.3）。
// 只记录猜想、判断、实验和结论，不含任何个人信息。浏览器不让存储时照常使用，只是不保存。

import type { AssumptionId } from "../../../lib/translator-client"
import { DEFAULT_KINDS, LADDER_LEVELS, LADDER_STEPS, sanitizeKinds, type HiddenTarget, type LadderControls, type LadderLevelId } from "./levels"

export type AssumptionPick = AssumptionId | "unsure"

export interface ExperimentLog {
  readonly at: string
  readonly runs: number
  readonly seed: number
  /** 这次实验的参数（程序回读的白话）。 */
  readonly setting: string
  /** 平均盒数；L6 是 Chao1 的平均估计（款）。 */
  readonly mean: number
  readonly notReachedShare: number | null
  /** L6：平均见到几款；其余各级为 null。 */
  readonly observedKinds: number | null
}

/** 被改掉的旧猜想：改猜想时把原来的留在这里，研究日志里能看出学生是不是看过结果才改。 */
export interface GuessRevision {
  readonly at: string
  readonly guess: number
  /** 这个旧猜想是按几款做的；L6 用不到，为 null。 */
  readonly guessKinds: number | null
  /** 改的时候已经做过实验或看过理论值。 */
  readonly seenResults: boolean
}

export interface LevelRecord {
  /** 已经走到第几步（0 = 设置参数，6 = 做检验）。 */
  readonly reachedStep: number
  /**
   * “设置参数”里定下的参数，后面的步骤都沿用；还没动过为 null（按默认参数）。
   * 锁定猜想之后不再改；这一项出现以前的记录是 null，按默认参数算。
   */
  readonly controls: LadderControls | null
  readonly guess: number | null
  /**
   * 锁定猜想时的款数（L0–L5 共用的那个）；还没有猜想时为 null，L6 用不到。猜想要和“那时的款数”算出的理论值比，
   * 所以后来款数改了也不变，只有重新修改猜想时才跟着现在的款数走。这一项出现以前的记录，猜想都是按默认的 6 款做的。
   */
  readonly guessKinds: number | null
  /** 改过猜想的历史，从早到晚；没改过为空。 */
  readonly guessRevisions: readonly GuessRevision[]
  /** L1–L6：学生选的那条假设（第一次的选择）。 */
  readonly assumptionPick: AssumptionPick | null
  /** L0：在 12 句话里选中的句子下标（l0AssumptionStatements 里的位置，不是屏幕上的先后）。 */
  readonly listPicks: readonly number[] | null
  readonly experiments: readonly ExperimentLog[]
  readonly degeneracyPrediction: number | null
  readonly degeneracyValue: number | null
  readonly checks: { readonly passed: number; readonly failed: number; readonly unchecked: number } | null
  readonly conclusion: string
  readonly completedAt: string | null
}

export interface LadderRecord {
  /** 2：第一步是“设置参数”。1 的记录读回来时把已走到的步数换成新的顺序。 */
  readonly version: 2
  readonly current: LadderLevelId
  /** L0–L5 共用的常规款数：学生在任何一级的实验台上改了，每一级都沿用。 */
  readonly kinds: number
  readonly levels: Readonly<Record<LadderLevelId, LevelRecord>>
}

export const LADDER_STORAGE_KEY = "math-inquiry-lab:ladder:v1"
const ASSUMPTION_PICKS: readonly string[] = ["A1", "A2", "A3", "A4", "A5", "A6", "unsure"]

export const EMPTY_LEVEL_RECORD: LevelRecord = {
  reachedStep: 0,
  controls: null,
  guess: null,
  guessKinds: null,
  guessRevisions: [],
  assumptionPick: null,
  listPicks: null,
  experiments: [],
  degeneracyPrediction: null,
  degeneracyValue: null,
  checks: null,
  conclusion: "",
  completedAt: null,
}

export function emptyLadderRecord(): LadderRecord {
  return {
    version: 2,
    current: "L0",
    kinds: DEFAULT_KINDS,
    levels: {
      L0: EMPTY_LEVEL_RECORD,
      L1: EMPTY_LEVEL_RECORD,
      L2: EMPTY_LEVEL_RECORD,
      L3: EMPTY_LEVEL_RECORD,
      L4: EMPTY_LEVEL_RECORD,
      L5: EMPTY_LEVEL_RECORD,
      L6: EMPTY_LEVEL_RECORD,
    },
  }
}

export function loadLadderRecord(): LadderRecord {
  try {
    const raw = window.localStorage.getItem(LADDER_STORAGE_KEY)
    return raw === null ? emptyLadderRecord() : normalizeLadderRecord(JSON.parse(raw))
  } catch {
    return emptyLadderRecord()
  }
}

export function saveLadderRecord(record: LadderRecord): void {
  try {
    window.localStorage.setItem(LADDER_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // 隐私模式或存储已满：本次照常使用，只是不保存。
  }
}

export function clearLadderRecord(): void {
  try {
    window.localStorage.removeItem(LADDER_STORAGE_KEY)
  } catch {
    // 同上。
  }
}

/** 读回来的记录逐项检查，不对的字段用空值代替。 */
export function normalizeLadderRecord(value: unknown): LadderRecord {
  const empty = emptyLadderRecord()
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) return empty
  const legacy = value.version === 1
  const levels = isRecord(value.levels) ? value.levels : {}
  const ids = LADDER_LEVELS.map((level) => level.id)
  return {
    version: 2,
    current: ids.includes(value.current as LadderLevelId) ? (value.current as LadderLevelId) : "L0",
    kinds: sanitizeKinds(value.kinds),
    levels: {
      L0: normalizeLevel(levels.L0, legacy),
      L1: normalizeLevel(levels.L1, legacy),
      L2: normalizeLevel(levels.L2, legacy),
      L3: normalizeLevel(levels.L3, legacy),
      // 10/22 的记录里还没有 L4，10/23 的还没有 L5、L6，读回来时按未开始处理。
      L4: normalizeLevel(levels.L4, legacy),
      L5: normalizeLevel(levels.L5, legacy),
      L6: normalizeLevel(levels.L6, legacy),
    },
  }
}

/** 版本 1 的步骤顺序是 情境、猜想、找假设、改参数、做实验、……；现在“设置参数”排在最前面，“改参数”没有了。 */
const LEGACY_STEP_MAP: readonly number[] = [0, 2, 3, 4, 4, 5, 6]

function normalizeLevel(value: unknown, legacy = false): LevelRecord {
  if (!isRecord(value)) return EMPTY_LEVEL_RECORD
  const number = (key: string) => (typeof value[key] === "number" && Number.isFinite(value[key]) ? (value[key] as number) : null)
  const reachedRaw = number("reachedStep")
  const reached = legacy && reachedRaw !== null && Number.isInteger(reachedRaw) ? LEGACY_STEP_MAP[Math.max(0, Math.min(LEGACY_STEP_MAP.length - 1, reachedRaw))] : reachedRaw
  const checks = isRecord(value.checks) ? value.checks : null
  const guess = number("guess")
  return {
    reachedStep: reached !== null && Number.isInteger(reached) ? Math.max(0, Math.min(LADDER_STEPS.length - 1, reached)) : 0,
    controls: normalizeControls(value.controls),
    guess,
    // 有猜想却没记款数的是旧记录：那时款数固定是 6。
    guessKinds: guess === null ? null : sanitizeKinds(number("guessKinds") ?? DEFAULT_KINDS),
    // 没有这一项的是改猜想功能以前的记录：当时猜想锁定后不能改。
    guessRevisions: Array.isArray(value.guessRevisions) ? value.guessRevisions.filter(isGuessRevision).slice(-20) : [],
    assumptionPick: ASSUMPTION_PICKS.includes(value.assumptionPick as string) ? (value.assumptionPick as AssumptionPick) : null,
    listPicks: Array.isArray(value.listPicks) && value.listPicks.every((item) => Number.isInteger(item))
      ? (value.listPicks as number[])
      : null,
    experiments: Array.isArray(value.experiments)
      ? value.experiments.filter(isExperimentLog).map((log) => ({
          ...log,
          observedKinds: typeof log.observedKinds === "number" ? log.observedKinds : null,
        }))
      : [],
    degeneracyPrediction: number("degeneracyPrediction"),
    degeneracyValue: number("degeneracyValue"),
    checks:
      checks !== null && ["passed", "failed", "unchecked"].every((key) => typeof checks[key] === "number")
        ? { passed: checks.passed as number, failed: checks.failed as number, unchecked: checks.unchecked as number }
        : null,
    conclusion: typeof value.conclusion === "string" ? value.conclusion.slice(0, 500) : "",
    completedAt: typeof value.completedAt === "string" ? value.completedAt : null,
  }
}

const HIDDEN_TARGETS: readonly string[] = ["all", "regular", "hidden"]

function normalizeControls(value: unknown): LadderControls | null {
  if (!isRecord(value)) return null
  const numbers = ["kinds", "hiddenDenominator", "withinDraws", "perKind", "pityWithin", "players"] as const
  if (!numbers.every((key) => typeof value[key] === "number" && Number.isFinite(value[key]))) return null
  if (!HIDDEN_TARGETS.includes(value.target as string)) return null
  return {
    kinds: sanitizeKinds(value.kinds),
    hiddenDenominator: value.hiddenDenominator as number,
    target: value.target as HiddenTarget,
    withinDraws: value.withinDraws as number,
    perKind: value.perKind as number,
    pityWithin: value.pityWithin as number,
    players: value.players as number,
  }
}

function isGuessRevision(value: unknown): value is GuessRevision {
  return (
    isRecord(value) &&
    typeof value.at === "string" &&
    typeof value.guess === "number" &&
    Number.isFinite(value.guess) &&
    (value.guessKinds === null || typeof value.guessKinds === "number") &&
    typeof value.seenResults === "boolean"
  )
}

/** 10/23 以前的记录没有 observedKinds，读回来时补成 null。 */
function isExperimentLog(value: unknown): value is Omit<ExperimentLog, "observedKinds"> & { readonly observedKinds?: unknown } {
  return (
    isRecord(value) &&
    typeof value.at === "string" &&
    typeof value.runs === "number" &&
    typeof value.seed === "number" &&
    typeof value.setting === "string" &&
    typeof value.mean === "number" &&
    (value.notReachedShare === null || typeof value.notReachedShare === "number")
  )
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
