// 通用盲盒模型的参数（研究方案 7.2）。每个字段对应假设清单中的一条：
// kinds → A1，stock → A3，pity → A4，goal / prices → A5，kindsKnown → A6。
// 这里只描述“世界是什么样、目标是什么”，计算在 simulate.ts / theory.ts。
// 本目录不依赖浏览器或 React，agent/ 以后可以把它注册成工具。

export interface KindParam {
  /** 款的编号，例如 "A" 或 "hidden"。 */
  readonly id: string
  /** 库存无限时，每抽一盒得到这一款的概率。全部款加起来必须等于 1。 */
  readonly probability: number
  readonly hidden?: boolean
}

/**
 * 库存有限时，店里每一盒被买到的机会相同（不放回抽样），各款的概率
 * 由剩余盒数决定，kinds 里的 probability 不再参与抽取。
 */
export interface FiniteStockParam {
  /** 每款剩几盒：一个数表示每款一样多，也可以按款编号分别写。 */
  readonly perKind?: number | Readonly<Record<string, number>>
  /** 一共剩几盒。只写 total 时按各款概率分配，必须分得整。 */
  readonly total?: number
}

export type StockParam = "unlimited" | FiniteStockParam

export interface PityParam {
  /** 保底的那一款的编号。 */
  readonly target: string
  /**
   * within 抽内必出：距离上一次出 target（或从头开始）已经连续 within − 1 抽
   * 没出，下一抽一定是 target。每出一次 target 计数清零，整个过程一直有效。
   */
  readonly within: number
}

export interface GoalParam {
  /** 要集哪些款："all" 全部，"regular" 只要常规款（不含 hidden 标记的款），或列出编号。 */
  readonly kinds: "all" | "regular" | readonly string[]
  /** 每一款要几个（几套）。 */
  readonly sets: number
  /** 几个人合买、共用同一批盲盒、互相交换。结果是这些人一共买的盒数。 */
  readonly players: number
}

export interface PricesParam {
  /** 每盒单价。 */
  readonly box: number
  /** 用不上的盒（重复款、目标以外的款）转卖能收回的钱。 */
  readonly resale?: number
  /** 二手市场直接买某一款的价格，用于“继续抽还是买二手”的比较。 */
  readonly secondHand?: number
}

export interface BlindBoxParams {
  readonly kinds: readonly KindParam[]
  readonly stock: StockParam
  readonly pity: PityParam | null
  readonly goal: GoalParam
  readonly prices: PricesParam | null
  /**
   * A6：收集者是否知道一共几款。false 时实验室问的是反问题“买了若干盒，
   * 一共有几款”，用 unknown-kinds.ts；正向的“要买几盒”仍按真实世界计算。
   */
  readonly kindsKnown: boolean
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const PROBABILITY_SUM_TOLERANCE = 1e-9

/** n 款等概率，编号 A、B、C……（超过 26 款时用 K1、K2……）。 */
export function equalKinds(count: number): KindParam[] {
  assertPositiveInteger(count, "count")
  return Array.from({ length: count }, (_, index) => ({
    id: count <= LETTERS.length ? LETTERS.charAt(index) : `K${index + 1}`,
    probability: 1 / count,
  }))
}

/**
 * regular 款常规款平分剩下的概率，再加 hiddenCount 款隐藏款，每款隐藏款的
 * 概率都是 hiddenProbability。只有 1 款隐藏款时编号为 "hidden"。
 */
export function regularWithHidden(
  regular: number,
  hiddenProbability: number,
  hiddenCount = 1,
): KindParam[] {
  assertPositiveInteger(regular, "regular")
  assertPositiveInteger(hiddenCount, "hiddenCount")

  const regularShare = 1 - hiddenCount * hiddenProbability

  if (!(hiddenProbability >= 0) || !(regularShare > 0)) {
    throw new RangeError("hidden probability leaves nothing for the regular kinds")
  }

  const regularKinds = equalKinds(regular).map((kind) => ({
    ...kind,
    probability: regularShare / regular,
  }))
  const hiddenKinds = Array.from({ length: hiddenCount }, (_, index) => ({
    id: hiddenCount === 1 ? "hidden" : `hidden${index + 1}`,
    probability: hiddenProbability,
    hidden: true,
  }))
  return [...regularKinds, ...hiddenKinds]
}

/** 理想模型 L0：6 款等概率、货无限、无保底、一个人集一套。 */
export const L0_PARAMS: BlindBoxParams = {
  kinds: equalKinds(6),
  stock: "unlimited",
  pity: null,
  goal: { kinds: "all", sets: 1, players: 1 },
  prices: null,
  kindsKnown: true,
}

/**
 * 把翻译器保留的写法（"1/72"、"5%"、"0.2"）或数字变成概率。
 * 不认识的写法直接报错，不猜。
 */
export function parseProbability(value: number | string): number {
  let result = Number.NaN

  if (typeof value === "number") {
    result = value
  } else {
    const text = value.normalize("NFKC").replace(/\s+/gu, "")
    const fraction = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/u.exec(text)
    const percent = /^(\d+(?:\.\d+)?)%$/u.exec(text)

    if (fraction) {
      result = Number(fraction[1]) / Number(fraction[2])
    } else if (percent) {
      result = Number(percent[1]) / 100
    } else if (/^\d+(?:\.\d+)?$/u.test(text)) {
      result = Number(text)
    }
  }

  if (!Number.isFinite(result) || result < 0 || result > 1) {
    throw new RangeError(`not a probability: ${String(value)}`)
  }

  return result
}

/** 校验并展开之后、计算模块直接使用的模型。 */
export interface ResolvedModel {
  readonly params: BlindBoxParams
  readonly ids: readonly string[]
  readonly probabilities: readonly number[]
  /** 所有款概率完全相同：抽取时走和原有模拟器一样的整数抽法。 */
  readonly equalProbabilities: boolean
  /** 每款库存；null 表示无限。 */
  readonly stock: readonly number[] | null
  /** 每款需要几个：目标款为 sets，其余为 0。 */
  readonly need: readonly number[]
  readonly goalIndices: readonly number[]
  readonly needTotal: number
  readonly pity: { readonly target: number; readonly within: number } | null
  readonly players: number
  readonly prices: PricesParam | null
}

export class BlindBoxParamError extends Error {
  readonly issues: readonly string[]

  constructor(issues: readonly string[]) {
    super(`invalid blind-box parameters: ${issues.join(", ")}`)
    this.name = "BlindBoxParamError"
    this.issues = issues
  }
}

/** 返回参数中的问题代码；空数组表示参数可以计算。 */
export function validateParams(params: BlindBoxParams): string[] {
  const result = resolveInternal(params)
  return "issues" in result ? [...result.issues] : []
}

export function resolveModel(params: BlindBoxParams): ResolvedModel {
  const result = resolveInternal(params)

  if ("issues" in result) {
    throw new BlindBoxParamError(result.issues)
  }

  return result
}

function resolveInternal(
  params: BlindBoxParams,
): ResolvedModel | { readonly issues: readonly string[] } {
  const issues: string[] = []
  const fail = (issue: string) => ({ issues: [...issues, issue] })

  if (typeof params !== "object" || params === null) return fail("params-not-object")

  // A1 kinds
  const { kinds } = params
  if (!Array.isArray(kinds) || kinds.length === 0) return fail("kinds-empty")
  const ids = kinds.map((kind) => kind?.id)
  if (!ids.every((id) => typeof id === "string" && id.length > 0)) return fail("kind-id-invalid")
  if (new Set(ids).size !== ids.length) return fail("kind-id-duplicate")
  const probabilities = kinds.map((kind) => kind.probability)
  if (!probabilities.every((p) => typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1)) {
    return fail("probability-invalid")
  }
  const total = probabilities.reduce((sum, p) => sum + p, 0)
  if (Math.abs(total - 1) > PROBABILITY_SUM_TOLERANCE) issues.push("probabilities-do-not-sum-to-1")
  const indexOf = new Map(ids.map((id, index) => [id, index]))

  // A3 stock
  const stock = resolveStock(params.stock, ids, probabilities, indexOf, issues)

  // A4 pity
  let pity: ResolvedModel["pity"] = null
  if (params.pity !== null) {
    const target = typeof params.pity === "object" ? indexOf.get(params.pity.target) : undefined
    if (target === undefined) {
      issues.push("pity-target-unknown")
    } else if (!isPositiveInteger(params.pity.within)) {
      issues.push("pity-within-invalid")
    } else {
      pity = { target, within: params.pity.within }
    }
  }

  // A5 goal
  const goal = params.goal
  let goalIndices: number[] = []
  if (typeof goal !== "object" || goal === null) {
    issues.push("goal-invalid")
  } else {
    if (goal.kinds === "all") {
      goalIndices = ids.map((_, index) => index)
    } else if (goal.kinds === "regular") {
      goalIndices = kinds.flatMap((kind, index) => (kind.hidden === true ? [] : [index]))
    } else if (Array.isArray(goal.kinds)) {
      goalIndices = goal.kinds.flatMap((id) => {
        const index = indexOf.get(id)
        return index === undefined ? [] : [index]
      })
      if (goalIndices.length !== goal.kinds.length) issues.push("goal-kind-unknown")
      if (new Set(goalIndices).size !== goalIndices.length) issues.push("goal-kind-duplicate")
    } else {
      issues.push("goal-kinds-invalid")
    }
    if (goalIndices.length === 0) issues.push("goal-empty")
    if (!isPositiveInteger(goal.sets)) issues.push("goal-sets-invalid")
    if (!isPositiveInteger(goal.players)) issues.push("goal-players-invalid")
  }

  // A5 prices
  const prices = params.prices
  if (prices !== null) {
    const amounts = [prices?.box, prices?.resale ?? 0, prices?.secondHand ?? 0]
    if (!amounts.every((amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0)) {
      issues.push("prices-invalid")
    }
  }

  // A6
  if (typeof params.kindsKnown !== "boolean") issues.push("kinds-known-invalid")

  if (issues.length > 0) return { issues }

  const sets = goal.sets
  const need = ids.map(() => 0)
  for (const index of goalIndices) need[index] = sets

  // 目标必须能达到，否则模拟永远停不下来。
  for (const index of goalIndices) {
    if (stock !== null) {
      if ((stock[index] ?? 0) < sets) issues.push("goal-exceeds-stock")
    } else if ((probabilities[index] ?? 0) === 0 && pity?.target !== index) {
      issues.push("goal-kind-has-zero-probability")
    }
  }
  if (pity !== null && pity.within === 1 && goalIndices.some((index) => index !== pity?.target)) {
    issues.push("pity-within-1-blocks-other-kinds")
  }
  if (issues.length > 0) return { issues: [...new Set(issues)] }

  const first = probabilities[0]
  return {
    params,
    ids,
    probabilities,
    equalProbabilities: probabilities.every((p) => p === first),
    stock,
    need,
    goalIndices,
    needTotal: sets * goalIndices.length,
    pity,
    players: goal.players,
    prices,
  }
}

function resolveStock(
  stock: StockParam,
  ids: readonly string[],
  probabilities: readonly number[],
  indexOf: ReadonlyMap<string, number>,
  issues: string[],
): number[] | null {
  if (stock === "unlimited") return null
  if (typeof stock !== "object" || stock === null) {
    issues.push("stock-invalid")
    return null
  }

  const { perKind, total } = stock
  let counts: number[]

  if (perKind === undefined) {
    if (total === undefined || !isNonNegativeInteger(total)) {
      issues.push("stock-invalid")
      return null
    }
    // 只给总数：按概率分，分不整就报错，不替学生四舍五入。
    counts = probabilities.map((p) => Math.round(p * total))
    if (!probabilities.every((p, index) => Math.abs(p * total - (counts[index] ?? 0)) < 1e-6)) {
      issues.push("stock-total-not-divisible")
      return null
    }
  } else if (typeof perKind === "number") {
    counts = ids.map(() => perKind)
  } else if (typeof perKind === "object" && perKind !== null) {
    if (!Object.keys(perKind).every((id) => indexOf.has(id))) {
      issues.push("stock-kind-unknown")
      return null
    }
    counts = ids.map((id) => perKind[id] ?? 0)
  } else {
    issues.push("stock-invalid")
    return null
  }

  if (!counts.every(isNonNegativeInteger)) {
    issues.push("stock-invalid")
    return null
  }
  const sum = counts.reduce((acc, count) => acc + count, 0)
  if (total !== undefined && total !== sum) issues.push("stock-total-mismatch")
  if (sum === 0) issues.push("stock-empty")
  return counts
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function assertPositiveInteger(value: number, name: string): void {
  if (!isPositiveInteger(value)) {
    throw new RangeError(`${name} must be a positive integer`)
  }
}
