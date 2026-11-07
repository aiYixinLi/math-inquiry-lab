// L6 反问题（假设 A6 被打破）：不知道一共几款，固定买 draws 盒，看见了几款、
// 能估计一共几款吗？同一套抽法也回答 A2 的“买 draws 盒能集齐的概率”。

import { DotNetRandom } from "../random"
import { summarizeSample, type SampleSummary } from "../statistics"
import { resolveModel, type BlindBoxParams } from "./params"
import {
  BoxDrawer,
  DEFAULT_RUNS,
  DEFAULT_SEED,
  assertPositiveInteger,
} from "./simulate"
import { noTheory, theoryDistribution, type NoTheory } from "./theory"

/**
 * Chao1 估计：见到的款数 + f1(f1 − 1) / [2(f2 + 1)]。
 * counts 是每一款被买到的次数（0 次的款不算见到），f1、f2 是只见过 1 次、2 次的款数。
 */
export function chao1(counts: readonly number[]): number {
  let observed = 0
  let singletons = 0
  let doubletons = 0
  for (const count of counts) {
    if (count > 0) observed += 1
    if (count === 1) singletons += 1
    if (count === 2) doubletons += 1
  }
  return observed + (singletons * (singletons - 1)) / (2 * (doubletons + 1))
}

export interface TheoryNumber {
  readonly available: true
  readonly method: "observed-kinds-sum" | "hypergeometric-observed-kinds-sum" | "survival" | "chao1-enumeration"
  readonly value: number
}

/**
 * 买 draws 盒平均能见到几款。第 i 款一次都没出现的概率是 (1 − p_i)^draws
 * （库存有限时是 C(N − s_i, draws) / C(N, draws)），所以
 *   E[见到的款数] = Σ_i [1 − P(第 i 款没出现)]
 */
export function expectedObservedKinds(
  params: BlindBoxParams,
  draws: number,
): TheoryNumber | NoTheory {
  const model = resolveModel(params)
  assertDraws(draws, model.stock)
  if (model.pity !== null) return noTheory("pity-changes-draw-probabilities")

  if (model.stock === null) {
    const value = model.probabilities.reduce((sum, p) => sum + 1 - (1 - p) ** draws, 0)
    return { available: true, method: "observed-kinds-sum", value }
  }

  const total = model.stock.reduce((sum, count) => sum + count, 0)
  const value = model.stock.reduce((sum, count) => {
    let missing = 1
    for (let i = 0; i < draws; i += 1) {
      missing *= Math.max(0, total - count - i) / (total - i)
    }
    return sum + 1 - missing
  }, 0)
  return { available: true, method: "hypergeometric-observed-kinds-sum", value }
}

/**
 * 买 draws 盒时 Chao1 估计的平均值，精确计算（货无限、没有保底）。
 *
 * Chao1 = 见到的款数 + f1(f1 − 1) / [2(f2 + 1)]。见到的款数的平均有公式（上面）；后一项要知道
 * “只见过 1 次的有 a 款、只见过 2 次的有 b 款”的概率 P(a, b)，见 singletonDoubletonDistribution。
 */
export function expectedChao1(params: BlindBoxParams, draws: number): TheoryNumber | NoTheory {
  const model = resolveModel(params)
  assertDraws(draws, model.stock)
  if (model.pity !== null) return noTheory("pity-changes-draw-probabilities")
  if (model.stock !== null) return noTheory("finite-stock-chao1")

  const observed = expectedObservedKinds(params, draws)
  if (!observed.available) return observed
  const pairs = singletonDoubletonDistribution(model.probabilities, draws)
  if (pairs === null) return noTheory("too-many-states")

  let total = 0
  let correction = 0
  for (const { singletons, doubletons, probability } of pairs) {
    total += probability
    correction += (probability * singletons * (singletons - 1)) / (2 * (doubletons + 1))
  }
  if (Math.abs(total - 1) > 1e-9) return noTheory("numerically-unstable")
  return { available: true, method: "chao1-enumeration", value: observed.value + correction }
}

export interface SingletonDoubletonProbability {
  /** f1：只见过 1 次的款数。 */
  readonly singletons: number
  /** f2：只见过 2 次的款数。 */
  readonly doubletons: number
  readonly probability: number
}

const MAX_ENUMERATION_DRAWS = 1_000
const MAX_ENUMERATION_WORK = 200_000_000

/**
 * 每盒按 probabilities 独立抽取、一共买 draws 盒时，P(f1 = a, f2 = b) 的精确值；
 * 太慢时返回 null。
 *
 * 把每一款出现的次数分成“1 次”“2 次”“0 次或 3 次以上”三类。对一组款，把“只见过 1 次的
 * 有 a 款、2 次的有 b 款、这组一共被抽到 m 盒”的所有抽法按多项分布 m! Π p^c / c! 加起来，
 * 记作 mass[a][b][m]。概率相同的款合成一组，组内按“选哪几款出现 1 次、2 次”直接计数；
 * 两组合并时 m 按二项系数分配：
 *   合并[a][b][m] = Σ C(m, m₁) × 甲[a₁][b₁][m₁] × 乙[a₂][b₂][m − m₁]（a₁ + a₂ = a，b₁ + b₂ = b）
 * 全部合并之后，P(a, b) = 合并[a][b][draws]。
 */
export function singletonDoubletonDistribution(
  probabilities: readonly number[],
  draws: number,
): SingletonDoubletonProbability[] | null {
  // 概率为 0 的款永远见不到，不影响 f1、f2。
  const groups = equalGroups(probabilities.filter((p) => p > 0))
  if (draws > MAX_ENUMERATION_DRAWS) return null

  let work = 0
  let kinds = 0
  groups.forEach((group, index) => {
    work += (group.size * draws * draws) / 2 + pairCount(group.size) * draws
    if (index > 0) work += pairCount(kinds) * pairCount(group.size) * (index === groups.length - 1 ? draws : (draws * draws) / 2)
    kinds += group.size
  })
  if (work > MAX_ENUMERATION_WORK) return null

  // 既要算到 draws!，也要算到组里的款数 size!。
  const logFactorial = new Float64Array(Math.max(draws, kinds) + 1)
  for (let n = 1; n < logFactorial.length; n += 1) logFactorial[n] = (logFactorial[n - 1] ?? 0) + Math.log(n)

  let mass: Mass = [[unitMass(draws)]]
  groups.forEach((group, index) => {
    const next = groupMass(group.size, group.value, draws, logFactorial)
    mass = index === 0 ? next : combineMass(mass, next, draws, index === groups.length - 1, logFactorial)
  })

  const result: SingletonDoubletonProbability[] = []
  mass.forEach((row, singletons) =>
    row.forEach((values, doubletons) => {
      const probability = values?.[draws] ?? 0
      if (probability > 0) result.push({ singletons, doubletons, probability })
    }),
  )
  return result
}

/** mass[a][b][m]，见 singletonDoubletonDistribution 的说明；没有的组合为 undefined。 */
type Mass = (Float64Array | undefined)[][]

function unitMass(draws: number): Float64Array {
  const values = new Float64Array(draws + 1)
  values[0] = 1
  return values
}

/** 一组 size 款、每款概率都是 p。 */
function groupMass(size: number, p: number, draws: number, logFactorial: Float64Array): Mass {
  // none[j][r]：j 款每款都出现 0 次或 3 次以上、一共 r 盒的所有抽法之和。
  // 再加一款时它出现 c 次（c = 0 或 c ≥ 3），系数 C(r, c) p^c，c 每加 1 乘以 (r − c + 1) / c × p。
  const none: Float64Array[] = [unitMass(draws)]
  for (let j = 1; j <= size; j += 1) {
    const previous = none[j - 1] ?? unitMass(draws)
    const row = new Float64Array(draws + 1)
    for (let r = 0; r <= draws; r += 1) {
      let coefficient = 1
      let sum = previous[r] ?? 0
      for (let c = 1; c <= r; c += 1) {
        coefficient *= ((r - c + 1) / c) * p
        if (c >= 3) sum += coefficient * (previous[r - c] ?? 0)
      }
      row[r] = sum
    }
    none.push(row)
  }

  // a 款出现 1 次、b 款出现 2 次、其余 rest 款：选法 size! / (a! b! rest!)，
  // m 盒里挑出这 a + 2b 盒并排好 m! / [(m − a − 2b)! 2^b]，概率 p^(a + 2b)。
  const mass: Mass = []
  for (let a = 0; a <= size; a += 1) {
    mass[a] = []
    for (let b = 0; a + b <= size; b += 1) {
      const rest = size - a - b
      const used = a + 2 * b
      const choose = (logFactorial[size] ?? 0) - (logFactorial[a] ?? 0) - (logFactorial[b] ?? 0) - (logFactorial[rest] ?? 0)
      const values = new Float64Array(draws + 1)
      for (let m = used; m <= draws; m += 1) {
        const others = none[rest]?.[m - used] ?? 0
        if (others === 0) continue
        values[m] = others * Math.exp(choose + (logFactorial[m] ?? 0) - (logFactorial[m - used] ?? 0) - b * Math.LN2 + used * Math.log(p))
      }
      ;(mass[a] ?? [])[b] = values
    }
  }
  return mass
}

/** 两组合并；最后一组只需要算 m = draws 这一格。 */
function combineMass(left: Mass, right: Mass, draws: number, lastOnly: boolean, logFactorial: Float64Array): Mass {
  const mass: Mass = []
  const binomials = new Float64Array(draws + 1)
  for (let m = lastOnly ? draws : 0; m <= draws; m += 1) {
    for (let k = 0; k <= m; k += 1) {
      binomials[k] = Math.exp((logFactorial[m] ?? 0) - (logFactorial[k] ?? 0) - (logFactorial[m - k] ?? 0))
    }
    left.forEach((leftRow, a1) =>
      leftRow.forEach((leftValues, b1) => {
        if (leftValues === undefined) return
        right.forEach((rightRow, a2) =>
          rightRow.forEach((rightValues, b2) => {
            if (rightValues === undefined) return
            let sum = 0
            for (let k = 0; k <= m; k += 1) {
              const value = leftValues[k] ?? 0
              if (value !== 0) sum += (binomials[k] ?? 0) * value * (rightValues[m - k] ?? 0)
            }
            if (sum === 0) return
            const row = (mass[a1 + a2] ??= [])
            const values = (row[b1 + b2] ??= new Float64Array(draws + 1))
            values[m] = (values[m] ?? 0) + sum
          }),
        )
      }),
    )
  }
  return mass
}

function pairCount(kinds: number): number {
  return ((kinds + 1) * (kinds + 2)) / 2
}

/** 把相等（相对误差 1e-12 内）的概率合成一组。 */
function equalGroups(values: readonly number[]): { size: number; value: number }[] {
  const groups: { size: number; value: number }[] = []
  for (const value of [...values].sort((left, right) => left - right)) {
    const last = groups[groups.length - 1]
    if (last !== undefined && Math.abs(value - last.value) <= 1e-12 * Math.max(value, last.value)) last.size += 1
    else groups.push({ size: 1, value })
  }
  return groups
}

/** 买 draws 盒就已经达成目标的概率 P(T ≤ draws)，没有理论值时明确返回。 */
export function goalReachedProbability(
  params: BlindBoxParams,
  draws: number,
): TheoryNumber | NoTheory {
  const model = resolveModel(params)
  assertDraws(draws, model.stock)
  const distribution = theoryDistribution(model)
  if (!distribution.available) return distribution
  return { available: true, method: "survival", value: 1 - distribution.survival(draws) }
}

export interface FixedDrawsOptions {
  readonly draws: number
  readonly runs?: number
  readonly seed?: number
}

export interface FixedDrawsResult {
  readonly runs: number
  readonly seed: number
  readonly draws: number
  /** 买 draws 盒见到的款数。 */
  readonly observedKinds: SampleSummary
  /** 每一轮用 Chao1 估计的总款数。平均值的精确值见 expectedChao1。 */
  readonly chao1: SampleSummary
  /** 买 draws 盒就已经达成目标的轮数占比。 */
  readonly goalReachedShare: number
  /** 每一轮见到的款数和 Chao1 估计，供直方图和原始数据表使用。 */
  readonly samples: { readonly observedKinds: readonly number[]; readonly chao1: readonly number[] }
}

export function simulateFixedDraws(
  params: BlindBoxParams,
  options: FixedDrawsOptions,
): FixedDrawsResult {
  const model = resolveModel(params)
  const runs = options.runs ?? DEFAULT_RUNS
  const seed = options.seed ?? DEFAULT_SEED
  const { draws } = options
  assertPositiveInteger(runs, "runs")
  assertDraws(draws, model.stock)

  const drawer = new BoxDrawer(model, new DotNetRandom(seed))
  const counts = new Int32Array(model.ids.length)
  const observed: number[] = []
  const estimates: number[] = []
  let reached = 0

  for (let run = 0; run < runs; run += 1) {
    drawer.reset()
    counts.fill(0)
    for (let draw = 0; draw < draws; draw += 1) {
      const kind = drawer.draw()
      counts[kind] = (counts[kind] ?? 0) + 1
    }
    const values = Array.from(counts)
    observed.push(values.filter((count) => count > 0).length)
    estimates.push(chao1(values))
    if (model.goalIndices.every((index) => (counts[index] ?? 0) >= (model.need[index] ?? 0))) {
      reached += 1
    }
  }

  return {
    runs,
    seed,
    draws,
    observedKinds: summarizeSample(observed),
    chao1: summarizeSample(estimates),
    goalReachedShare: reached / runs,
    samples: { observedKinds: observed, chao1: estimates },
  }
}

function assertDraws(draws: number, stock: readonly number[] | null): void {
  if (!Number.isInteger(draws) || draws < 0) {
    throw new RangeError("draws must be a non-negative integer")
  }
  if (stock !== null && draws > stock.reduce((sum, count) => sum + count, 0)) {
    throw new RangeError("draws exceeds the boxes in stock")
  }
}
