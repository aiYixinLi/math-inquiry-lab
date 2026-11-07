// 研究方案 6.1 总览表中各级的参数。隐藏款 1/72、保底 72 抽等是示例参数，
// 真实参数要按具体系列的官方公示核实。每一级只在 L0 上改一处。
// L2 不改参数，问的是 L1 的分布（中位数、90% 分位数、“k 盒内达成”的概率）。

import {
  L0_PARAMS,
  equalKinds,
  regularWithHidden,
  type BlindBoxParams,
  type GoalParam,
} from "./params"

export const EXAMPLE_HIDDEN_PROBABILITY = 1 / 72
export const EXAMPLE_PITY_WITHIN = 72

/** "all" 集全套，"regular" 只集常规款，"hidden" 只等隐藏款。 */
export type HiddenGoal = "all" | "regular" | "hidden"

/** 理想模型 L0 的常规款数；建模阶梯里学生可以改，其余各级沿用。 */
export const DEFAULT_REGULAR_KINDS = L0_PARAMS.kinds.length

/** L0：kindCount 款等概率（默认 6 款）。 */
export function ladderL0(kindCount = DEFAULT_REGULAR_KINDS): BlindBoxParams {
  return kindCount === DEFAULT_REGULAR_KINDS ? L0_PARAMS : { ...L0_PARAMS, kinds: equalKinds(kindCount) }
}

/** L1（打破 A1）：regularKinds 款常规（默认 6 款）+ 1 款隐藏款。 */
export function ladderL1(
  options: {
    readonly hiddenProbability?: number
    readonly goal?: HiddenGoal
    readonly regularKinds?: number
  } = {},
): BlindBoxParams {
  return {
    ...L0_PARAMS,
    kinds: regularWithHidden(
      options.regularKinds ?? DEFAULT_REGULAR_KINDS,
      options.hiddenProbability ?? EXAMPLE_HIDDEN_PROBABILITY,
    ),
    goal: hiddenGoal(options.goal ?? "all"),
  }
}

/** L3（打破 A3）：店里 kindCount 款（默认 6 款）每款只剩 perKind 盒。 */
export function ladderL3(perKind: number, kindCount = DEFAULT_REGULAR_KINDS): BlindBoxParams {
  return { ...ladderL0(kindCount), stock: { perKind } }
}

/** L4（打破 A4）：在 L1 上加隐藏款 within 抽保底。 */
export function ladderL4(
  options: {
    readonly within?: number
    readonly hiddenProbability?: number
    readonly goal?: HiddenGoal
    readonly regularKinds?: number
  } = {},
): BlindBoxParams {
  return {
    ...ladderL1(options),
    pity: { target: "hidden", within: options.within ?? EXAMPLE_PITY_WITHIN },
  }
}

/** L5（打破 A5）：players 个人合买交换，一共要 sets 套（默认每人一套），kindCount 款（默认 6 款）。 */
export function ladderL5(
  options: { readonly players?: number; readonly sets?: number; readonly kindCount?: number } = {},
): BlindBoxParams {
  const players = options.players ?? 2
  return {
    ...ladderL0(options.kindCount),
    goal: { kinds: "all", sets: options.sets ?? players, players },
  }
}

/**
 * L6（打破 A6）：真实有 kindCount 款等概率，但收集者不知道一共几款。给了 hiddenProbability
 * 时再加 1 款隐藏款，kindCount 款常规款平分剩下的概率（研究方案 6.8 的局限）。
 */
export function ladderL6(
  kindCount = 12,
  options: { readonly hiddenProbability?: number } = {},
): BlindBoxParams {
  const kinds =
    options.hiddenProbability === undefined
      ? equalKinds(kindCount)
      : regularWithHidden(kindCount, options.hiddenProbability)
  return { ...L0_PARAMS, kinds, kindsKnown: false }
}

/**
 * “自由提条件”（研究方案 7.6）把学生的条件改在哪一级上。一般改在 L0 上，每次只打破
 * 一条假设；保底出隐藏款、只要常规款或只要隐藏款，都要先有隐藏款，改在 L1 示例
 * （6 款常规 + 1 款隐藏款 1/72）上，界面回读时要说明这一点。
 */
export function freeConditionBase(changes: unknown): { readonly level: "L0" | "L1"; readonly params: BlindBoxParams } {
  const field = (key: string): Record<string, unknown> | null => {
    if (typeof changes !== "object" || changes === null) return null
    const value = (changes as Record<string, unknown>)[key]
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null
  }
  const needsHidden =
    field("pity")?.target === "hidden" || field("goal")?.kinds === "regular" || field("goal")?.kinds === "hidden"
  return needsHidden ? { level: "L1", params: ladderL1() } : { level: "L0", params: ladderL0() }
}

function hiddenGoal(goal: HiddenGoal): GoalParam {
  const kinds = goal === "hidden" ? ["hidden"] : goal
  return { kinds, sets: 1, players: 1 }
}
