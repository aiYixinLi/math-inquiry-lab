// 通用盲盒模型的理论值。只在有精确公式或精确递推时给出数字；
// 其余情况明确返回“没有理论值”，交给模拟，不做近似猜测。
//
// T 表示“达成目标时一共买了几盒”。各方法都先算出 P(T > k)（买了 k 盒还没
// 达成目标的概率），平均值 E[T] = P(T > 0) + P(T > 1) + P(T > 2) + …
//
// | 情形                               | 方法                                   |
// |------------------------------------|----------------------------------------|
// | 货无限、无保底、一套               | 容斥原理（L0、L1、L2）                 |
// | 货有限、无保底、一套               | 不放回抽样的容斥原理（L3）             |
// | 只等保底的那一款、一套             | 截断几何分布（L4）                     |
// | 货无限，有保底或要几套             | 按抽数逐步推进的状态概率（L4、L5）     |
// | 货有限且有保底，或货有限且要几套   | 没有理论值                             |

import { resolveModel, type BlindBoxParams, type ResolvedModel } from "./params"

export type TheoryMethod =
  | "inclusion-exclusion"
  | "hypergeometric-inclusion-exclusion"
  | "truncated-geometric"
  | "state-recursion"

export type NoTheoryReason =
  | "finite-stock-with-pity"
  | "finite-stock-multiple-sets"
  | "finite-stock-chao1"
  | "pity-changes-draw-probabilities"
  | "too-many-states"
  | "numerically-unstable"
  | "did-not-converge"

export interface NoTheory {
  readonly available: false
  readonly reason: NoTheoryReason
  readonly message: string
}

export interface TheoryDistribution {
  readonly available: true
  readonly method: TheoryMethod
  /** E[T]：平均要买几盒。 */
  readonly mean: number
  /** P(T > k)：买了 k 盒还没达成目标的概率。 */
  survival(k: number): number
  /** 最小的 k，使 P(T ≤ k) ≥ level，例如 level = 0.9 是“90% 的人在 k 盒内达成”。 */
  quantile(level: number): number
}

export interface TheoryValues {
  readonly available: true
  readonly method: TheoryMethod
  readonly mean: number
  readonly perPlayerMean: number
  readonly quantiles: { readonly p50: number; readonly p90: number }
  /** 给了价格时的平均花费（用不上的盒按转卖价卖掉）。 */
  readonly expectedCost: number | null
}

export type TheoryResult = TheoryValues | NoTheory

const NO_THEORY_MESSAGES: Readonly<Record<NoTheoryReason, string>> = {
  "finite-stock-with-pity": "库存有限又有保底，目前没有精确公式，只能看模拟结果。",
  "finite-stock-multiple-sets": "库存有限又要集几套，目前没有精确公式，只能看模拟结果。",
  "finite-stock-chao1": "库存有限时，Chao1 估计的平均值目前没有精确算法，只能看模拟结果。",
  "pity-changes-draw-probabilities": "有保底时每一抽的概率会变，这一项目前没有精确公式，只能看模拟结果。",
  "too-many-states": "状态太多，精确计算太慢，只能看模拟结果。",
  "numerically-unstable": "这组参数下公式的正负项互相抵消，计算机算不准，只能看模拟结果。",
  "did-not-converge": "精确递推在限定步数内没有算完，只能看模拟结果。",
}

export function noTheory(reason: NoTheoryReason): NoTheory {
  return { available: false, reason, message: NO_THEORY_MESSAGES[reason] }
}

export function theory(params: BlindBoxParams): TheoryResult {
  const model = resolveModel(params)
  const distribution = theoryDistribution(model)
  if (!distribution.available) return distribution

  const { mean } = distribution
  return {
    available: true,
    method: distribution.method,
    mean,
    perPlayerMean: mean / model.players,
    quantiles: { p50: distribution.quantile(0.5), p90: distribution.quantile(0.9) },
    expectedCost: expectedCost(model, mean),
  }
}

export function theoryDistribution(
  input: BlindBoxParams | ResolvedModel,
): TheoryDistribution | NoTheory {
  const model = "needTotal" in input ? input : resolveModel(input)
  const { sets } = model.params.goal

  if (model.stock !== null) {
    if (model.pity !== null) return noTheory("finite-stock-with-pity")
    if (sets > 1) return noTheory("finite-stock-multiple-sets")
    return finiteInclusionExclusion(model, model.stock)
  }

  if (model.pity === null && sets === 1) {
    const exact = unlimitedInclusionExclusion(model)
    if (exact !== null) return exact
  }

  if (
    model.pity !== null &&
    sets === 1 &&
    model.goalIndices.length === 1 &&
    model.goalIndices[0] === model.pity.target
  ) {
    return truncatedGeometric(
      model.probabilities[model.pity.target] ?? 0,
      model.pity.within,
    )
  }

  return stateRecursion(model)
}

/** 平均花费 = 单价 × 平均盒数 − 转卖价 × 平均用不上的盒数。 */
export function expectedCost(model: ResolvedModel, meanBoxes: number): number | null {
  if (model.prices === null) return null
  const { box, resale = 0 } = model.prices
  return box * meanBoxes - resale * (meanBoxes - model.needTotal)
}

export interface LastKindDecision {
  readonly available: true
  /** 只差这一款时，继续抽平均还要几盒：1 / p。 */
  readonly expectedDraws: number
  /** 继续抽的平均花费：单价 × 1/p − 转卖价 × (1/p − 1)。 */
  readonly continueCost: number
  readonly secondHand: number | null
  readonly cheaper: "continue" | "second-hand" | "same" | null
}

/**
 * L5 停手规则：只差 kindId 这一款时，继续抽和去二手市场买哪个便宜。
 * 6 款等概率时 1/p = 6，继续抽的平均花费就是方案 6.7 的 6p − 5v。
 */
export function lastKindDecision(
  params: BlindBoxParams,
  kindId: string,
): LastKindDecision | NoTheory {
  const model = resolveModel(params)
  const index = model.ids.indexOf(kindId)

  if (index < 0) throw new RangeError(`unknown kind: ${kindId}`)
  if (model.prices === null) throw new RangeError("prices are required")
  if (model.stock !== null) return noTheory("finite-stock-multiple-sets")
  if (model.pity !== null) return noTheory("pity-changes-draw-probabilities")

  const p = model.probabilities[index] ?? 0
  if (p === 0) throw new RangeError(`kind ${kindId} can never be drawn`)

  const { box, resale = 0, secondHand } = model.prices
  const expectedDraws = 1 / p
  const continueCost = box * expectedDraws - resale * (expectedDraws - 1)
  let cheaper: LastKindDecision["cheaper"] = null
  if (secondHand !== undefined) {
    const difference = continueCost - secondHand
    cheaper = Math.abs(difference) < 1e-9 ? "same" : difference > 0 ? "second-hand" : "continue"
  }

  return {
    available: true,
    expectedDraws,
    continueCost,
    secondHand: secondHand ?? null,
    cheaper,
  }
}

// ---------------------------------------------------------------------------
// 容斥原理
//
// “买了 k 盒还没集齐”= 至少缺一款。设 S 是目标款中的一组，p(S) 是这组的
// 概率之和，则 k 盒里一款 S 中的都没有的概率是 (1 − p(S))^k，于是
//   P(T > k) = Σ_{S 非空} (−1)^{|S|+1} (1 − p(S))^k
//   E[T]     = Σ_{S 非空} (−1)^{|S|+1} / p(S)
// 概率相同的款合成一组，只需枚举“每组选几款”，项数从 2^n 降到 Π(组大小 + 1)。

interface Group {
  readonly size: number
  readonly value: number
}

interface Term {
  /** (−1)^{r+1} × Π C(组大小, 选几款)。 */
  readonly coefficient: number
  /** 所选各款的概率之和（或库存之和）。 */
  readonly weight: number
}

const MAX_TERMS = 100_000
// 正负项绝对值之和与结果之比超过这个数，双精度的抵消误差就不可忽略了。
const MAX_CANCELLATION_RATIO = 1e5

function unlimitedInclusionExclusion(model: ResolvedModel): TheoryDistribution | null {
  const groups = groupValues(model.goalIndices.map((index) => model.probabilities[index] ?? 0))
  const terms = inclusionExclusionTerms(groups)
  if (terms === null) return null

  let mean = 0
  let absolute = 0
  for (const { coefficient, weight } of terms) {
    mean += coefficient / weight
    absolute += Math.abs(coefficient) / weight
  }
  if (absolute / mean > MAX_CANCELLATION_RATIO) return null

  const survival = (k: number) => {
    if (k < 0) return 1
    let sum = 0
    for (const { coefficient, weight } of terms) {
      sum += coefficient * (1 - weight) ** k
    }
    return clampProbability(sum)
  }

  return {
    available: true,
    method: "inclusion-exclusion",
    mean,
    survival,
    quantile: (level) => quantileFromSurvival(survival, level),
  }
}

/**
 * 库存有限（不放回）：店里共 N 盒，组 S 的库存之和为 s(S)，
 * k 盒里一盒 S 中的都没有的概率是 C(N − s(S), k) / C(N, k)，其余同上。
 */
function finiteInclusionExclusion(
  model: ResolvedModel,
  stock: readonly number[],
): TheoryDistribution | NoTheory {
  const total = stock.reduce((sum, count) => sum + count, 0)
  if (total > 5_000_000) return noTheory("too-many-states")

  const groups = groupValues(model.goalIndices.map((index) => stock[index] ?? 0))
  const terms = inclusionExclusionTerms(groups)
  if (terms === null) return noTheory("too-many-states")

  // ratio[i] = C(N − s, k) / C(N, k)，k 每加 1 乘以 (N − s − k) / (N − k)。
  const ratio = terms.map(() => 1)
  const survivalTable = new Float64Array(total + 1)
  for (let k = 0; k <= total; k += 1) {
    let sum = 0
    terms.forEach(({ coefficient, weight }, index) => {
      const current = ratio[index] ?? 0
      sum += coefficient * current
      ratio[index] = k < total ? current * Math.max(0, total - weight - k) / (total - k) : 0
    })
    survivalTable[k] = clampProbability(sum)
  }

  let mean = 0
  for (const value of survivalTable) mean += value
  // Σ_k C(N − s, k) / C(N, k) = (N + 1) / (s + 1)
  let absolute = 0
  for (const { coefficient, weight } of terms) {
    absolute += (Math.abs(coefficient) * (total + 1)) / (weight + 1)
  }
  if (absolute / mean > MAX_CANCELLATION_RATIO) return noTheory("numerically-unstable")

  const survival = (k: number) => (k < 0 ? 1 : k > total ? 0 : survivalTable[k] ?? 0)
  return {
    available: true,
    method: "hypergeometric-inclusion-exclusion",
    mean,
    survival,
    quantile: (level) => quantileFromSurvival(survival, level),
  }
}

function inclusionExclusionTerms(groups: readonly Group[]): Term[] | null {
  const count = groups.reduce((product, group) => product * (group.size + 1), 1)
  if (count > MAX_TERMS) return null

  const terms: Term[] = []
  const visit = (groupIndex: number, chosen: number, coefficient: number, weight: number) => {
    const group = groups[groupIndex]
    if (group === undefined) {
      if (chosen > 0) {
        terms.push({ coefficient: (chosen % 2 === 1 ? 1 : -1) * coefficient, weight })
      }
      return
    }
    for (let r = 0; r <= group.size; r += 1) {
      visit(groupIndex + 1, chosen + r, coefficient * binomial(group.size, r), weight + r * group.value)
    }
  }
  visit(0, 0, 1, 0)
  return terms
}

// ---------------------------------------------------------------------------
// 截断几何分布：只等保底的那一款，概率 q，within = N 抽内必出。
//   P(T > k) = (1 − q)^k（k < N），k ≥ N 时为 0
//   E[T] = 1 + (1 − q) + … + (1 − q)^(N−1) = (1 − (1 − q)^N) / q

function truncatedGeometric(q: number, within: number): TheoryDistribution {
  const mean = q === 0 ? within : (1 - (1 - q) ** within) / q
  const survival = (k: number) => (k < 0 ? 1 : k >= within ? 0 : (1 - q) ** k)
  return {
    available: true,
    method: "truncated-geometric",
    mean,
    survival,
    quantile: (level) => quantileFromSurvival(survival, level),
  }
}

// ---------------------------------------------------------------------------
// 按抽数逐步推进的状态概率（货无限）。
//
// 状态 = 每一组目标款里“已经有 0 个、1 个……sets 个”的各有几款，再加上保底
// 计数（距离上一次出保底款已经几抽）。从“什么都没有”出发，每抽一盒把每个
// 状态的概率按转移概率分给下一抽的状态；到达“全部集齐”的概率被移出。
// 第 k 抽之后剩下的总概率就是 P(T > k)。概率相同的目标款合成一组，保底款
// 单独成组。

const MAX_STATES = 400_000
const MAX_STEPS = 5_000_000
const MAX_WORK = 500_000_000
const SURVIVAL_CUTOFF = 1e-14

interface GroupStates {
  readonly probability: number
  readonly isTarget: boolean
  /** 每个组合状态：从它出发、本组某一款升一级之后的状态及“有几款可以升”。 */
  readonly moves: readonly (readonly { readonly to: number; readonly count: number }[])[]
  /** 每个组合状态里已经够数（再抽到就是重复）的款数。 */
  readonly saturated: readonly number[]
  readonly start: number
  readonly complete: number
}

function stateRecursion(model: ResolvedModel): TheoryDistribution | NoTheory {
  const sets = model.params.goal.sets
  const pity = model.pity
  const target = pity?.target ?? -1
  const within = pity?.within ?? 1
  const inGoal = new Set(model.goalIndices)

  const groups: GroupStates[] = []
  if (pity !== null && inGoal.has(target)) {
    groups.push(groupStates(1, model.probabilities[target] ?? 0, sets, true))
  }
  const otherGoal = model.goalIndices.filter((index) => index !== target)
  for (const group of groupValues(otherGoal.map((index) => model.probabilities[index] ?? 0))) {
    groups.push(groupStates(group.size, group.value, sets, false))
  }

  let outsideProbability = 0
  let outsideTargetProbability = 0
  model.probabilities.forEach((p, index) => {
    if (inGoal.has(index)) return
    if (index === target) outsideTargetProbability += p
    else outsideProbability += p
  })

  const radices: number[] = []
  let tupleCount = 1
  for (const group of groups) {
    radices.push(tupleCount)
    tupleCount *= group.moves.length
  }
  if (tupleCount * within > MAX_STATES) return noTheory("too-many-states")

  // 每个组合状态的一抽转移，分两类：抽到保底款（计数清零）和抽到别的款
  // （计数加 1）。没有保底时全部算作清零，计数一直是 0。
  const resetEdges = new EdgeList(tupleCount)
  const advanceEdges = new EdgeList(tupleCount)
  const forcedTo = new Int32Array(tupleCount)
  let start = 0
  let complete = 0

  for (let tuple = 0; tuple < tupleCount; tuple += 1) {
    let selfTarget = outsideTargetProbability
    let selfOther = outsideProbability
    forcedTo[tuple] = tuple
    resetEdges.open(tuple)
    advanceEdges.open(tuple)

    groups.forEach((group, groupIndex) => {
      const radix = radices[groupIndex] ?? 1
      const state = Math.floor(tuple / radix) % group.moves.length
      const edges = pity === null || group.isTarget ? resetEdges : advanceEdges
      for (const { to, count } of group.moves[state] ?? []) {
        edges.add(tuple + (to - state) * radix, count * group.probability)
        if (group.isTarget) forcedTo[tuple] = tuple + (to - state) * radix
      }
      const duplicates = (group.saturated[state] ?? 0) * group.probability
      if (group.isTarget) selfTarget += duplicates
      else selfOther += duplicates
    })

    if (selfTarget > 0) resetEdges.add(tuple, selfTarget)
    if (selfOther > 0) (pity === null ? resetEdges : advanceEdges).add(tuple, selfOther)
  }
  resetEdges.close()
  advanceEdges.close()
  groups.forEach((group, groupIndex) => {
    start += group.start * (radices[groupIndex] ?? 1)
    complete += group.complete * (radices[groupIndex] ?? 1)
  })

  // 概率表按 [组合状态][保底计数] 排列。第 k 抽之后计数最多是 k，
  // 所以只处理 0…active 这一段，保底次数很大时也不必每抽扫一遍整张表。
  let current = new Float64Array(tupleCount * within)
  let next = new Float64Array(tupleCount * within)
  current[start * within] = 1
  let active = 0
  const survivalValues: number[] = []
  let mean = 0
  let work = 0

  for (let step = 0; ; step += 1) {
    let remaining = 0
    for (let tuple = 0; tuple < tupleCount; tuple += 1) {
      const base = tuple * within
      for (let counter = 0; counter <= active; counter += 1) remaining += current[base + counter] ?? 0
    }
    survivalValues.push(remaining)
    mean += remaining

    if (remaining < SURVIVAL_CUTOFF) {
      // 尾部按等比数列补上（比值取最后两步之比），对结果的影响小于 1e-12。
      const previous = survivalValues[survivalValues.length - 2] ?? 0
      const rate = previous > 0 ? remaining / previous : 0
      if (rate > 0 && rate < 1) mean += (remaining * rate) / (1 - rate)
      break
    }
    if (step >= MAX_STEPS || work >= MAX_WORK) return noTheory("did-not-converge")

    const nextActive = Math.min(active + 1, within - 1)
    // 计数 0…free 正常抽；计数到 within − 1 的那一格这一抽被保底。
    const free = pity === null ? active : Math.min(active, within - 2)
    for (let tuple = 0; tuple < tupleCount; tuple += 1) {
      next.fill(0, tuple * within, tuple * within + nextActive + 1)
    }

    for (let tuple = 0; tuple < tupleCount; tuple += 1) {
      if (tuple === complete) continue
      const base = tuple * within
      let freeMass = 0
      for (let counter = 0; counter <= free; counter += 1) freeMass += current[base + counter] ?? 0

      for (let edge = resetEdges.from(tuple); edge < resetEdges.from(tuple + 1); edge += 1) {
        const index = resetEdges.target(edge) * within
        next[index] = (next[index] ?? 0) + freeMass * resetEdges.probability(edge)
      }
      for (let edge = advanceEdges.from(tuple); edge < advanceEdges.from(tuple + 1); edge += 1) {
        const toBase = advanceEdges.target(edge) * within + 1
        const probability = advanceEdges.probability(edge)
        for (let counter = 0; counter <= free; counter += 1) {
          next[toBase + counter] = (next[toBase + counter] ?? 0) + probability * (current[base + counter] ?? 0)
        }
        work += free + 1
      }
      if (pity !== null && active === within - 1) {
        // 保底触发：这一抽一定是保底款。
        const index = (forcedTo[tuple] ?? tuple) * within
        next[index] = (next[index] ?? 0) + (current[base + within - 1] ?? 0)
      }
    }
    // 已经集齐的概率移出。
    next.fill(0, complete * within, (complete + 1) * within)
    ;[current, next] = [next, current]
    active = nextActive
  }

  const survival = (k: number) =>
    k < 0 ? 1 : k < survivalValues.length ? clampProbability(survivalValues[k] ?? 0) : 0
  return {
    available: true,
    method: "state-recursion",
    mean,
    survival,
    quantile: (level) => quantileFromSurvival(survival, level),
  }
}

/** 按组合状态分段存放的转移（去哪、概率），用定长数组以便快速遍历。 */
class EdgeList {
  private readonly starts: Int32Array

  private readonly targets: number[] = []

  private readonly probabilities: number[] = []

  private packedTargets = new Int32Array(0)

  private packedProbabilities = new Float64Array(0)

  constructor(tupleCount: number) {
    this.starts = new Int32Array(tupleCount + 1)
  }

  open(tuple: number): void {
    this.starts[tuple] = this.targets.length
  }

  add(target: number, probability: number): void {
    this.targets.push(target)
    this.probabilities.push(probability)
  }

  close(): void {
    this.starts[this.starts.length - 1] = this.targets.length
    this.packedTargets = Int32Array.from(this.targets)
    this.packedProbabilities = Float64Array.from(this.probabilities)
  }

  from(tuple: number): number {
    return this.starts[tuple] ?? 0
  }

  target(edge: number): number {
    return this.packedTargets[edge] ?? 0
  }

  probability(edge: number): number {
    return this.packedProbabilities[edge] ?? 0
  }
}

/** 一组 size 款、每款要 sets 个时，所有“各有几款在第几级”的组合状态。 */
function groupStates(
  size: number,
  probability: number,
  sets: number,
  isTarget: boolean,
): GroupStates {
  const compositions: number[][] = []
  const build = (level: number, left: number, prefix: number[]) => {
    if (level === sets) {
      compositions.push([...prefix, left])
      return
    }
    for (let count = left; count >= 0; count -= 1) {
      build(level + 1, left - count, [...prefix, count])
    }
  }
  build(0, size, [])

  const indexOf = new Map(compositions.map((levels, index) => [levels.join(","), index]))
  const moves = compositions.map((levels) =>
    levels.slice(0, sets).flatMap((count, level) => {
      if (count === 0) return []
      const moved = [...levels]
      moved[level] = count - 1
      moved[level + 1] = (moved[level + 1] ?? 0) + 1
      return [{ to: indexOf.get(moved.join(",")) ?? -1, count }]
    }),
  )
  const startLevels = [size, ...Array.from({ length: sets }, () => 0)]
  const completeLevels = [...Array.from({ length: sets }, () => 0), size]

  return {
    probability,
    isTarget,
    moves,
    saturated: compositions.map((levels) => levels[sets] ?? 0),
    start: indexOf.get(startLevels.join(",")) ?? -1,
    complete: indexOf.get(completeLevels.join(",")) ?? -1,
  }
}

// ---------------------------------------------------------------------------
// 共用的小工具

/** 把相等（相对误差 1e-12 内）的值合成一组。 */
function groupValues(values: readonly number[]): Group[] {
  const sorted = [...values].sort((left, right) => left - right)
  const groups: { size: number; value: number }[] = []
  for (const value of sorted) {
    const last = groups[groups.length - 1]
    if (last !== undefined && Math.abs(value - last.value) <= 1e-12 * Math.max(value, last.value)) {
      last.size += 1
    } else {
      groups.push({ size: 1, value })
    }
  }
  return groups
}

/** 最小的 k ≥ 0，使 1 − P(T > k) ≥ level。P(T > k) 随 k 不增，先倍增找上界再二分。 */
export function quantileFromSurvival(survival: (k: number) => number, level: number): number {
  if (!(level > 0 && level < 1)) throw new RangeError("level must be in (0, 1)")
  const reached = (k: number) => 1 - survival(k) >= level - 1e-12

  let high = 1
  while (!reached(high)) {
    high *= 2
    if (high > 2 ** 40) throw new RangeError("quantile is out of range")
  }
  let low = 0
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (reached(middle)) high = middle
    else low = middle + 1
  }
  return low
}

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 1; i <= Math.min(k, n - k); i += 1) {
    result = (result * (n - Math.min(k, n - k) + i)) / i
  }
  return result
}

function clampProbability(value: number): number {
  return Math.min(1, Math.max(0, value))
}
