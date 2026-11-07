// 研究方案 7.5 的三道检验，用来把关“模型算错了”：
// ① 退化检验：新参数取特殊值时，必须退回上一级的结果；
// ② 双路验证：理论值与模拟值必须在统计误差范围内一致；
// ③ 方向检验：参数往一个方向变，结果必须往该变的方向走。
//
// 判定标准：理论值与理论值比较时，差不超过给定容差；涉及模拟值时，
// 差不超过 zLimit 倍标准误（默认 3 倍，约 99.7%）再加容差。同时报告
// 模拟值的 95% 置信区间，以及理论值是否落在里面。

import { Z_95, proportionStandardError } from "../statistics"
import {
  ladderL0,
  ladderL1,
  ladderL3,
  ladderL4,
  ladderL5,
  ladderL6,
} from "./ladder"
import {
  L0_PARAMS,
  equalKinds,
  regularWithHidden,
  resolveModel,
  type BlindBoxParams,
} from "./params"
import { DEFAULT_RUNS, DEFAULT_SEED, simulateModel } from "./simulate"
import { theory, theoryDistribution } from "./theory"
import {
  expectedChao1,
  expectedObservedKinds,
  goalReachedProbability,
  simulateFixedDraws,
} from "./unknown-kinds"

export type CheckKind = "degeneracy" | "dual-path" | "direction"
export type CheckStatus = "passed" | "failed" | "no-theory"

/** 检验比较的是哪个量。 */
export type Metric =
  | { readonly kind: "mean" }
  | { readonly kind: "per-player-mean" }
  | { readonly kind: "quantile"; readonly level: number }
  | { readonly kind: "reached-within"; readonly draws: number }
  | { readonly kind: "observed-kinds"; readonly draws: number }
  | { readonly kind: "chao1"; readonly draws: number }
  /** 给了价格时的平均花费（用不上的盒按转卖价卖掉）。 */
  | { readonly kind: "cost" }

export interface Estimate {
  readonly source: "theory" | "simulation"
  readonly value: number
  /** 模拟值的标准误；理论值为 0。 */
  readonly standardError: number
  /** 模拟值的 95% 置信区间。 */
  readonly ci95: readonly [number, number] | null
}

export interface CheckOptions {
  readonly runs?: number
  readonly seed?: number
  /** 涉及模拟值时允许的标准误倍数。 */
  readonly zLimit?: number
}

export interface CheckValue {
  readonly label: string
  readonly estimate: Estimate | null
}

export interface CheckResult {
  readonly kind: CheckKind
  readonly name: string
  readonly status: CheckStatus
  readonly detail: string
  readonly values: readonly CheckValue[]
}

const MEAN: Metric = { kind: "mean" }
const DEFAULT_Z_LIMIT = 3
const DEFAULT_TOLERANCE = 1e-9

export function theoryEstimate(params: BlindBoxParams, metric: Metric = MEAN): Estimate | null {
  const exact = (value: number): Estimate => ({ source: "theory", value, standardError: 0, ci95: null })

  switch (metric.kind) {
    case "mean":
    case "per-player-mean": {
      const result = theory(params)
      if (!result.available) return null
      return exact(metric.kind === "mean" ? result.mean : result.perPlayerMean)
    }
    case "quantile": {
      const distribution = theoryDistribution(params)
      return distribution.available ? exact(distribution.quantile(metric.level)) : null
    }
    case "reached-within": {
      const result = goalReachedProbability(params, metric.draws)
      return result.available ? exact(result.value) : null
    }
    case "observed-kinds": {
      const result = expectedObservedKinds(params, metric.draws)
      return result.available ? exact(result.value) : null
    }
    case "chao1": {
      const result = expectedChao1(params, metric.draws)
      return result.available ? exact(result.value) : null
    }
    case "cost": {
      const result = theory(params)
      return result.available && result.expectedCost !== null ? exact(result.expectedCost) : null
    }
  }
}

export function simulationEstimate(
  params: BlindBoxParams,
  metric: Metric = MEAN,
  options: CheckOptions = {},
): Estimate | null {
  const runs = options.runs ?? DEFAULT_RUNS
  const seed = options.seed ?? DEFAULT_SEED

  switch (metric.kind) {
    case "mean":
    case "per-player-mean": {
      const { draws } = simulateModel(params, { runs, seed })
      const scale = metric.kind === "mean" ? 1 : 1 / resolveModel(params).players
      return {
        source: "simulation",
        value: draws.mean * scale,
        standardError: draws.standardError * scale,
        ci95: [draws.ci95[0] * scale, draws.ci95[1] * scale],
      }
    }
    case "quantile":
      // 样本分位数没有现成的标准误，这里不拿它做判定。
      return null
    case "reached-within": {
      const share = simulateFixedDraws(params, { draws: metric.draws, runs, seed }).goalReachedShare
      // 占比是 0 或 1 时 √(p(1−p)/n) 等于 0，会把“理论 99.999%、模拟 100%”判成不一致；
      // 按 Agresti–Coull 的做法先加 2 次成功、2 次失败再算标准误。
      const standardError = proportionStandardError(share * runs, runs)
      return {
        source: "simulation",
        value: share,
        standardError,
        ci95: [share - Z_95 * standardError, share + Z_95 * standardError],
      }
    }
    case "observed-kinds":
    case "chao1": {
      const result = simulateFixedDraws(params, { draws: metric.draws, runs, seed })
      const summary = metric.kind === "chao1" ? result.chao1 : result.observedKinds
      return {
        source: "simulation",
        value: summary.mean,
        standardError: summary.standardError,
        ci95: summary.ci95,
      }
    }
    case "cost": {
      const { cost } = simulateModel(params, { runs, seed })
      return cost === null
        ? null
        : { source: "simulation", value: cost.mean, standardError: cost.standardError, ci95: cost.ci95 }
    }
  }
}

/** 有理论值用理论值，否则用模拟值。 */
export function bestEstimate(
  params: BlindBoxParams,
  metric: Metric = MEAN,
  options: CheckOptions = {},
): Estimate | null {
  return theoryEstimate(params, metric) ?? simulationEstimate(params, metric, options)
}

/** 比较两个估计值，生成一条检验结果。 */
export function compareEstimates(
  kind: CheckKind,
  name: string,
  values: readonly [CheckValue, CheckValue],
  options: CheckOptions & { readonly tolerance?: number } = {},
): CheckResult {
  const [first, second] = values
  const a = first.estimate
  const b = second.estimate
  if (a === null || b === null) {
    return {
      kind,
      name,
      status: "no-theory",
      detail: `${a === null ? first.label : second.label}没有可用的值，无法比较。`,
      values,
    }
  }

  const zLimit = options.zLimit ?? DEFAULT_Z_LIMIT
  const difference = a.value - b.value
  const standardError = Math.hypot(a.standardError, b.standardError)
  const allowed = (options.tolerance ?? DEFAULT_TOLERANCE) + zLimit * standardError
  const passed = Math.abs(difference) <= allowed
  const noise = standardError > 0 ? `（${zLimit} 倍标准误 ${format(zLimit * standardError)}）` : ""

  return {
    kind,
    name,
    status: passed ? "passed" : "failed",
    detail:
      `${first.label} ${format(a.value)}，${second.label} ${format(b.value)}，` +
      `差 ${format(difference)}，允许 ${format(allowed)}${noise}。`,
    values,
  }
}

export interface DegeneracySpec {
  readonly name: string
  /** 新一级取特殊值后的参数。 */
  readonly special: BlindBoxParams
  /** 上一级的参数，或者上一级的已知结果。 */
  readonly reference: BlindBoxParams | number
  readonly metric?: Metric
  /** 理论值之间允许的差；“取极大值”这类近似退化需要放宽。 */
  readonly tolerance?: number
}

export function degeneracyCheck(spec: DegeneracySpec, options: CheckOptions = {}): CheckResult {
  const metric = spec.metric ?? MEAN
  const reference: Estimate | null =
    typeof spec.reference === "number"
      ? { source: "theory", value: spec.reference, standardError: 0, ci95: null }
      : bestEstimate(spec.reference, metric, options)

  return compareEstimates(
    "degeneracy",
    spec.name,
    [
      { label: "特殊参数", estimate: bestEstimate(spec.special, metric, options) },
      { label: "上一级", estimate: reference },
    ],
    { ...options, ...(spec.tolerance === undefined ? {} : { tolerance: spec.tolerance }) },
  )
}

export interface DualPathSpec {
  readonly name: string
  readonly params: BlindBoxParams
  readonly metric?: Metric
}

export function dualPathCheck(spec: DualPathSpec, options: CheckOptions = {}): CheckResult {
  const metric = spec.metric ?? MEAN
  const exact = theoryEstimate(spec.params, metric)
  const simulated = simulationEstimate(spec.params, metric, options)
  const values: [CheckValue, CheckValue] = [
    { label: "理论值", estimate: exact },
    { label: "模拟值", estimate: simulated },
  ]

  if (exact === null) {
    return {
      kind: "dual-path",
      name: spec.name,
      status: "no-theory",
      detail: `没有理论值，只有模拟值${simulated === null ? "" : ` ${format(simulated.value)}`}，不能做双路验证。`,
      values,
    }
  }

  const result = compareEstimates("dual-path", spec.name, values, options)
  const interval = simulated?.ci95
  if (interval === null || interval === undefined) return result
  const inside = exact.value >= interval[0] && exact.value <= interval[1]
  return {
    ...result,
    detail:
      `${result.detail}模拟值的 95% 置信区间 [${format(interval[0])}, ${format(interval[1])}]，` +
      `理论值${inside ? "在" : "不在"}区间内。`,
  }
}

export interface DirectionSpec {
  readonly name: string
  /** 参数依次取的值。 */
  readonly values: readonly number[]
  readonly build: (value: number) => BlindBoxParams
  readonly expect: "increasing" | "decreasing"
  /** 结果应该越来越接近的值（例如库存越多越接近 14.7）。 */
  readonly approaches?: number
  /** 比较的量；变的是量本身（例如“买几盒”）时传函数。 */
  readonly metric?: Metric | ((value: number) => Metric)
  /** 参数取值的写法（例如概率写成 "1/72"），默认 String(value)。 */
  readonly formatValue?: (value: number) => string
}

export function directionCheck(spec: DirectionSpec, options: CheckOptions = {}): CheckResult {
  const metricFor = (value: number) =>
    typeof spec.metric === "function" ? spec.metric(value) : spec.metric ?? MEAN
  const label = spec.formatValue ?? String
  const values = spec.values.map((value) => ({
    label: label(value),
    estimate: bestEstimate(spec.build(value), metricFor(value), options),
  }))
  const estimates = values.map((value) => value.estimate)

  if (!estimates.every((estimate): estimate is Estimate => estimate !== null)) {
    return { kind: "direction", name: spec.name, status: "no-theory", detail: "有的参数取值没有可用的值。", values }
  }

  const results = estimates.map((estimate) => estimate.value)
  const steps = results.slice(1).map((value, index) => value - (results[index] ?? 0))
  const monotone = steps.every((step) => (spec.expect === "increasing" ? step > 0 : step < 0))
  const { approaches } = spec
  const closer =
    approaches === undefined ||
    results.slice(1).every(
      (value, index) => Math.abs(value - approaches) < Math.abs((results[index] ?? 0) - approaches),
    )
  const passed = monotone && closer
  const sources = [...new Set(estimates.map((estimate) => (estimate.source === "theory" ? "理论值" : "模拟值")))]

  return {
    kind: "direction",
    name: spec.name,
    status: passed ? "passed" : "failed",
    detail:
      `${spec.values.map((value, index) => `${label(value)} → ${format(results[index] ?? Number.NaN)}`).join("；")}` +
      `（${sources.join("、")}）。应当${spec.expect === "increasing" ? "越来越大" : "越来越小"}` +
      `${approaches === undefined ? "" : `并越来越接近 ${format(approaches)}`}，` +
      `${passed ? "符合" : "不符合"}。`,
    values,
  }
}

/** 研究方案 6.1 各级（L0–L6）的三道检验，全部用示例参数。 */
export function standardChecks(options: CheckOptions = {}): CheckResult[] {
  const l0 = ladderL0()
  const sevenEqual: BlindBoxParams = { ...L0_PARAMS, kinds: equalKinds(7) }
  const noHidden: BlindBoxParams = {
    ...L0_PARAMS,
    kinds: regularWithHidden(6, 0),
    goal: { kinds: "regular", sets: 1, players: 1 },
  }
  const enoughDraws = simulateFixedDraws(ladderL6(6), {
    draws: 500,
    runs: options.runs ?? DEFAULT_RUNS,
    seed: options.seed ?? DEFAULT_SEED,
  })
  const toEstimate = (summary: { readonly mean: number; readonly standardError: number; readonly ci95: readonly [number, number] }): Estimate => ({
    source: "simulation",
    value: summary.mean,
    standardError: summary.standardError,
    ci95: summary.ci95,
  })

  return [
    // ① 退化检验
    degeneracyCheck({ name: "L1 隐藏款概率取 1/7 → 7 款等概率", special: ladderL1({ hiddenProbability: 1 / 7 }), reference: sevenEqual }, options),
    degeneracyCheck({ name: "L1 隐藏款概率取 0、只集常规款 → L0", special: noHidden, reference: l0 }, options),
    degeneracyCheck({ name: "L2 没有隐藏款时的中位数 → L0", special: noHidden, reference: l0, metric: { kind: "quantile", level: 0.5 } }, options),
    degeneracyCheck({ name: "L2 没有隐藏款时的 90% 分位数 → L0", special: noHidden, reference: l0, metric: { kind: "quantile", level: 0.9 } }, options),
    degeneracyCheck({ name: "L3 每款库存 10 000 盒 → 接近 L0", special: ladderL3(10_000), reference: l0, tolerance: 0.01 }, options),
    degeneracyCheck({ name: "L3 每款只剩 1 盒 → 正好 6 盒", special: ladderL3(1), reference: 6 }, options),
    degeneracyCheck({ name: "L4 保底取 10 000 抽 → 回到 L1", special: ladderL4({ within: 10_000 }), reference: ladderL1(), tolerance: 1e-6 }, options),
    degeneracyCheck({ name: "L4 只等隐藏款、保底取 10 000 抽 → 回到 72", special: ladderL4({ within: 10_000, goal: "hidden" }), reference: ladderL1({ goal: "hidden" }), tolerance: 1e-6 }, options),
    degeneracyCheck({ name: "L5 一人一套 → L0", special: ladderL5({ players: 1, sets: 1 }), reference: l0 }, options),
    compareEstimates(
      "degeneracy",
      "L6 抽得足够多（6 款抽 500 盒）→ Chao1 估计等于见到的款数",
      [
        { label: "Chao1 平均", estimate: toEstimate(enoughDraws.chao1) },
        { label: "见到的款数平均", estimate: toEstimate(enoughDraws.observedKinds) },
      ],
      // 同一批模拟里逐轮相等，差应当恰好为 0。
      { zLimit: 0 },
    ),

    // ② 双路验证
    dualPathCheck({ name: "L0 6 款等概率", params: l0 }, options),
    dualPathCheck({ name: "L1 集全套", params: ladderL1() }, options),
    dualPathCheck({ name: "L1 只集常规款", params: ladderL1({ goal: "regular" }) }, options),
    dualPathCheck({ name: "L2 72 盒内抽到隐藏款的概率", params: ladderL1({ goal: "hidden" }), metric: { kind: "reached-within", draws: 72 } }, options),
    dualPathCheck({ name: "L2 100 盒内集齐全套的概率", params: ladderL1(), metric: { kind: "reached-within", draws: 100 } }, options),
    dualPathCheck({ name: "L3 每款 2 盒", params: ladderL3(2) }, options),
    dualPathCheck({ name: "L3 每款 10 盒", params: ladderL3(10) }, options),
    dualPathCheck({ name: "L4 72 抽保底，集全套", params: ladderL4() }, options),
    dualPathCheck({ name: "L4 72 抽保底，只等隐藏款", params: ladderL4({ goal: "hidden" }) }, options),
    dualPathCheck({ name: "L5 两人合买集两套", params: ladderL5() }, options),
    dualPathCheck({ name: "L6 12 款抽 15 盒见到的款数", params: ladderL6(12), metric: { kind: "observed-kinds", draws: 15 } }, options),
    dualPathCheck({ name: "L6 12 款抽 15 盒的 Chao1 估计", params: ladderL6(12), metric: { kind: "chao1", draws: 15 } }, options),

    // ③ 方向检验
    directionCheck({ name: "L1 隐藏款越稀有，集全套越难", values: [1 / 7, 1 / 36, 1 / 72, 1 / 144], build: (q) => ladderL1({ hiddenProbability: q }), expect: "increasing" }, options),
    directionCheck({ name: "L3 库存越多，越接近 14.7", values: [1, 2, 3, 5, 10, 20, 50, 100], build: ladderL3, expect: "increasing", approaches: 14.7 }, options),
    directionCheck({ name: "L4 保底越小，平均越少", values: [18, 36, 72, 144], build: (within) => ladderL4({ within }), expect: "increasing" }, options),
    directionCheck({ name: "L5 合作人数越多，每人平均越少", values: [1, 2, 3, 4], build: (players) => ladderL5({ players }), expect: "decreasing", metric: { kind: "per-player-mean" } }, options),
    directionCheck({ name: "L6 买得越多，见到的款数越接近 12", values: [5, 10, 15, 24, 50], build: () => ladderL6(12), expect: "increasing", approaches: 12, metric: (draws) => ({ kind: "observed-kinds", draws }) }, options),
  ]
}

function format(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  const magnitude = Math.abs(value)
  return magnitude !== 0 && magnitude < 0.001 ? value.toExponential(2) : value.toFixed(4)
}
