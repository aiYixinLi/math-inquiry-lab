// 通用盲盒模型的蒙特卡洛模拟：固定随机种子，可以重复得到同样的结果。
// 随机数沿用 ../random.ts 的 System.Random 兼容算法；6 款等概率时抽法与
// ../simulator.ts 完全相同，同一种子得到同样的每轮盒数。

import { DotNetRandom } from "../random"
import {
  empiricalQuantile,
  summarizeSample,
  type SampleSummary,
} from "../statistics"
import { resolveModel, type BlindBoxParams, type ResolvedModel } from "./params"

/** 研究方案 8.1：每一级至少 10 000 轮，固定随机种子。 */
export const DEFAULT_RUNS = 10_000
export const DEFAULT_SEED = 20_261_021
const DEFAULT_MAX_DRAWS_PER_RUN = 10_000_000

export interface UniformSource {
  next(minInclusive: number, maxExclusive: number): number
  nextDouble(): number
}

export interface SimulationOptions {
  readonly runs?: number
  readonly seed?: number
  /** 单轮最多抽几盒，防止参数极端时停不下来。 */
  readonly maxDrawsPerRun?: number
}

export interface SimulationResult {
  readonly runs: number
  readonly seed: number
  /** 达成目标时一共买的盒数（几个人合作时是大家一共买的）。 */
  readonly draws: SampleSummary
  /** 一半的人 / 90% 的人在多少盒内达成目标。 */
  readonly quantiles: { readonly p50: number; readonly p90: number }
  readonly perPlayerMean: number
  /** 给了价格时的花费：单价 × 盒数 − 转卖价 × 用不上的盒数。 */
  readonly cost: SampleSummary | null
  /** 每一轮的盒数，供直方图使用。 */
  readonly samples: readonly number[]
}

/**
 * 一轮抽盒的过程：负责按概率或剩余库存抽款，以及保底计数。
 * 达成目标的判断交给调用方，这样“抽到集齐”和“固定抽 n 盒”共用同一套抽法。
 */
export class BoxDrawer {
  private readonly cumulative: Float64Array

  private readonly remaining: Int32Array | null

  private remainingTotal = 0

  private sinceTarget = 0

  private readonly model: ResolvedModel

  private readonly random: UniformSource

  constructor(model: ResolvedModel, random: UniformSource) {
    this.model = model
    this.random = random
    this.cumulative = new Float64Array(model.probabilities.length)
    let sum = 0
    model.probabilities.forEach((p, index) => {
      sum += p
      this.cumulative[index] = sum
    })
    this.remaining = model.stock === null ? null : new Int32Array(model.stock.length)
    this.reset()
  }

  /** 开始新的一轮：库存补满，保底计数清零。 */
  reset(): void {
    this.sinceTarget = 0
    if (this.remaining !== null && this.model.stock !== null) {
      this.remaining.set(this.model.stock)
      this.remainingTotal = this.model.stock.reduce((sum, count) => sum + count, 0)
    }
  }

  get boxesLeft(): number {
    return this.remaining === null ? Number.POSITIVE_INFINITY : this.remainingTotal
  }

  /** 抽一盒，返回这一盒是第几款（下标）。 */
  draw(): number {
    const { pity } = this.model
    let kind: number

    if (
      pity !== null &&
      this.sinceTarget === pity.within - 1 &&
      (this.remaining === null || (this.remaining[pity.target] ?? 0) > 0)
    ) {
      // 保底触发：这一抽一定是 target，不消耗随机数。
      kind = pity.target
    } else if (this.remaining !== null) {
      kind = this.drawFromStock(this.remaining)
    } else if (this.model.equalProbabilities) {
      kind = this.random.next(0, this.model.probabilities.length)
    } else {
      kind = this.drawWeighted()
    }

    if (this.remaining !== null) {
      this.remaining[kind] = (this.remaining[kind] ?? 0) - 1
      this.remainingTotal -= 1
    }
    if (pity !== null) {
      this.sinceTarget = kind === pity.target ? 0 : this.sinceTarget + 1
    }
    return kind
  }

  private drawFromStock(remaining: Int32Array): number {
    if (this.remainingTotal <= 0) {
      throw new Error("The shop has no boxes left")
    }
    // 不放回：剩下的每一盒机会相同。
    let ticket = this.random.next(0, this.remainingTotal)
    for (let index = 0; index < remaining.length; index += 1) {
      const count = remaining[index] ?? 0
      if (ticket < count) return index
      ticket -= count
    }
    throw new Error("Stock bookkeeping is inconsistent")
  }

  private drawWeighted(): number {
    const { cumulative } = this
    const last = cumulative.length - 1
    const u = this.random.nextDouble() * (cumulative[last] ?? 1)
    for (let index = 0; index < last; index += 1) {
      if (u < (cumulative[index] ?? 0)) return index
    }
    // 浮点误差兜底：落到最后一个概率不为 0 的款。
    for (let index = last; index > 0; index -= 1) {
      if ((this.model.probabilities[index] ?? 0) > 0) return index
    }
    return 0
  }
}

/** 一轮：一直抽到目标达成，返回一共抽了几盒。 */
export function drawsToGoal(
  model: ResolvedModel,
  drawer: BoxDrawer,
  maxDraws = DEFAULT_MAX_DRAWS_PER_RUN,
): number {
  drawer.reset()
  const counts = new Int32Array(model.need.length)
  let missing = model.needTotal
  let draws = 0

  while (missing > 0) {
    if (draws >= maxDraws) {
      throw new Error(`No result within ${maxDraws} draws`)
    }
    const kind = drawer.draw()
    draws += 1
    counts[kind] = (counts[kind] ?? 0) + 1
    if ((counts[kind] ?? 0) <= (model.need[kind] ?? 0)) missing -= 1
  }

  return draws
}

export function simulateModel(
  params: BlindBoxParams,
  options: SimulationOptions = {},
): SimulationResult {
  const model = resolveModel(params)
  const runs = options.runs ?? DEFAULT_RUNS
  const seed = options.seed ?? DEFAULT_SEED
  assertPositiveInteger(runs, "runs")

  const drawer = new BoxDrawer(model, new DotNetRandom(seed))
  const samples: number[] = []
  for (let run = 0; run < runs; run += 1) {
    samples.push(drawsToGoal(model, drawer, options.maxDrawsPerRun))
  }

  const draws = summarizeSample(samples)
  return {
    runs,
    seed,
    draws,
    quantiles: {
      p50: empiricalQuantile(samples, 0.5),
      p90: empiricalQuantile(samples, 0.9),
    },
    perPlayerMean: draws.mean / model.players,
    cost:
      model.prices === null
        ? null
        : summarizeSample(samples.map((boxes) => costOf(model, boxes))),
    samples,
  }
}

/** 买 boxes 盒达成目标的花费：用不上的盒按转卖价卖掉。 */
export function costOf(model: ResolvedModel, boxes: number): number {
  if (model.prices === null) return Number.NaN
  const { box, resale = 0 } = model.prices
  return box * boxes - resale * (boxes - model.needTotal)
}

export function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`)
  }
}
