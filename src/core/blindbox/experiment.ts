// 建模阶梯“做实验”一步：固定种子模拟若干轮，整理成直方图和统计量。

import { empiricalQuantile } from "../statistics"
import { resolveModel, type BlindBoxParams } from "./params"
import { simulateModel } from "./simulate"
import { simulateFixedDraws } from "./unknown-kinds"

export interface ExperimentBin {
  /** 这一组包含的盒数范围 [from, to]（L6 是 Chao1 估计的整数部分）。 */
  readonly from: number
  readonly to: number
  readonly count: number
}

export interface ExperimentOptions {
  readonly runs: number
  readonly seed: number
  /** 给了时额外统计“买这么多盒还没达成目标”的轮数占比（L2）。 */
  readonly withinDraws?: number | null
}

/** L6：每轮固定买 draws 盒时，见到的款数和 Chao1 估计准不准。 */
export interface UnknownKindsSummary {
  readonly draws: number
  /** 例子世界真实一共几款。 */
  readonly trueKinds: number
  readonly observedMean: number
  readonly observedCi95: readonly [number, number]
  /** Chao1 估计比真实款数少的轮数占比。 */
  readonly underestimateShare: number
}

export interface ExperimentResult {
  readonly runs: number
  readonly seed: number
  readonly mean: number
  readonly ci95: readonly [number, number]
  readonly p50: number
  readonly p90: number
  readonly min: number
  readonly max: number
  /** 从最少盒数到 99% 分位数分组；更多的计入 overflow。 */
  readonly bins: readonly ExperimentBin[]
  readonly overflow: number
  readonly notReachedShare: number | null
  /** L6 的实验：这时样本是每轮的 Chao1 估计，平均、分位数和直方图都按它算；其余各级为 null。 */
  readonly unknownKinds: UnknownKindsSummary | null
}

const MAX_BINS = 32

export function runExperiment(params: BlindBoxParams, options: ExperimentOptions): ExperimentResult {
  const { runs, seed } = options
  const simulation = simulateModel(params, { runs, seed })
  const { samples } = simulation

  const within = options.withinDraws
  return {
    runs,
    seed,
    mean: simulation.draws.mean,
    ci95: simulation.draws.ci95,
    p50: simulation.quantiles.p50,
    p90: simulation.quantiles.p90,
    ...histogram(samples),
    notReachedShare:
      within === undefined || within === null ? null : samples.filter((value) => value > within).length / runs,
    unknownKinds: null,
  }
}

/** L6“做实验”：每轮固定买 draws 盒，记下见到几款，再用 Chao1 估计一共几款。 */
export function runUnknownKindsExperiment(
  params: BlindBoxParams,
  options: { readonly runs: number; readonly seed: number; readonly draws: number },
): ExperimentResult {
  const { runs, seed, draws } = options
  const simulation = simulateFixedDraws(params, { draws, runs, seed })
  const estimates = simulation.samples.chao1
  const trueKinds = resolveModel(params).ids.length

  return {
    runs,
    seed,
    mean: simulation.chao1.mean,
    ci95: simulation.chao1.ci95,
    p50: empiricalQuantile(estimates, 0.5),
    p90: empiricalQuantile(estimates, 0.9),
    ...histogram(estimates),
    notReachedShare: null,
    unknownKinds: {
      draws,
      trueKinds,
      observedMean: simulation.observedKinds.mean,
      observedCi95: simulation.observedKinds.ci95,
      underestimateShare: estimates.filter((value) => value < trueKinds).length / runs,
    },
  }
}

/** 按整数部分分组：宽度取整数，最多 MAX_BINS 组，超过 99% 分位数的计入 overflow。 */
function histogram(samples: readonly number[]): Pick<ExperimentResult, "min" | "max" | "bins" | "overflow"> {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of samples) {
    if (value < min) min = value
    if (value > max) max = value
  }
  const first = Math.floor(min)
  const upper = Math.floor(empiricalQuantile(samples, 0.99))
  const width = Math.max(1, Math.ceil((upper - first + 1) / MAX_BINS))
  const binCount = Math.ceil((upper - first + 1) / width)
  const counts = Array.from({ length: binCount }, () => 0)
  let overflow = 0
  for (const value of samples) {
    const index = Math.floor((value - first) / width)
    if (index < binCount) counts[index] = (counts[index] ?? 0) + 1
    else overflow += 1
  }

  return {
    min,
    max,
    bins: counts.map((count, index) => ({ from: first + index * width, to: first + (index + 1) * width - 1, count })),
    overflow,
  }
}
