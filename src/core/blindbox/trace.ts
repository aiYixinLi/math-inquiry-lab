// 建模阶梯“做实验”的开盒演示：把某一轮逐盒追踪下来，界面据此一盒一盒地打开。
// 抽法直接用 simulate.ts 的 BoxDrawer，同一个种子下第 k 轮和批量实验的第 k 轮完全一样。

import { DotNetRandom } from "../random"
import { chao1 } from "./unknown-kinds"
import { resolveModel, type BlindBoxParams } from "./params"
import { BoxDrawer, drawsToGoal } from "./simulate"

export interface TraceKind {
  readonly id: string
  readonly hidden: boolean
  /** 这一款要几个（不在目标里的款为 0）。 */
  readonly need: number
  /** 库存有限时这一款的库存；无限时为 null。 */
  readonly stock: number | null
  readonly probability: number
}

export interface TraceStep {
  /** 第几盒，从 1 开始。 */
  readonly index: number
  /** 这一盒是第几款（kinds 的下标）。 */
  readonly kind: number
  /** 这一款是不是第一次见到。 */
  readonly isNew: boolean
  /** 这一盒之后每款各有几个。 */
  readonly counts: readonly number[]
  /** 这一盒之后，目标里还差几个。 */
  readonly stillNeeded: number
  /** 这一盒是不是保底触发的（没有保底时一直是 false）。 */
  readonly pityForced: boolean
  /** 这一盒之后距离上一次出保底款已经连续几盒没出；没有保底时为 null。 */
  readonly sincePity: number | null
  /** 这一盒之后店里还剩几盒；库存无限时为 null。 */
  readonly boxesLeft: number | null
}

export interface RoundTrace {
  readonly kinds: readonly TraceKind[]
  readonly pity: { readonly target: number; readonly within: number } | null
  readonly steps: readonly TraceStep[]
  /** 目标一共要几个。 */
  readonly needTotal: number
  /** 是不是在 maxDraws 之内达成了目标（固定买几盒的演示不看这个）。 */
  readonly reached: boolean
  /** 固定买几盒的演示（L6）：每款见到几次，以及 Chao1 的材料；其余为 null。 */
  readonly fixed: {
    readonly draws: number
    readonly observed: number
    readonly singletons: number
    readonly doubletons: number
    readonly chao1: number
  } | null
}

export interface TraceOptions {
  readonly seed: number
  /** 第几轮，从 0 开始；前面的轮先按同一个种子“跳过”。 */
  readonly round?: number
  /** 固定每轮买几盒（L6）；不给时一直抽到达成目标。 */
  readonly draws?: number | null
  /** 单轮最多追踪几盒，防止参数极端时停不下来。 */
  readonly maxDraws?: number
}

export const TRACE_MAX_DRAWS = 3_000

export function traceRound(params: BlindBoxParams, options: TraceOptions): RoundTrace {
  const model = resolveModel(params)
  const { seed } = options
  const round = options.round ?? 0
  const fixedDraws = options.draws ?? null
  const maxDraws = options.maxDraws ?? TRACE_MAX_DRAWS

  const drawer = new BoxDrawer(model, new DotNetRandom(seed))
  for (let skipped = 0; skipped < round; skipped += 1) {
    if (fixedDraws === null) {
      drawsToGoal(model, drawer)
    } else {
      drawer.reset()
      for (let draw = 0; draw < fixedDraws; draw += 1) drawer.draw()
    }
  }

  drawer.reset()
  const counts = model.ids.map(() => 0)
  const left = model.stock === null ? null : [...model.stock]
  let boxesLeft = model.stock === null ? null : model.stock.reduce((sum, count) => sum + count, 0)
  let missing = model.needTotal
  let since = 0
  const limit = fixedDraws ?? maxDraws
  const steps: TraceStep[] = []

  while (steps.length < limit && (fixedDraws !== null || missing > 0)) {
    // 和 BoxDrawer.draw() 里保底的判断保持一致：只用来标出“这一盒是保底出的”。
    const pityForced =
      model.pity !== null &&
      since === model.pity.within - 1 &&
      (left === null || (left[model.pity.target] ?? 0) > 0)
    const kind = drawer.draw()
    const before = counts[kind] ?? 0
    counts[kind] = before + 1
    if (before < (model.need[kind] ?? 0)) missing -= 1
    if (left !== null) left[kind] = (left[kind] ?? 0) - 1
    if (boxesLeft !== null) boxesLeft -= 1
    if (model.pity !== null) since = kind === model.pity.target ? 0 : since + 1

    steps.push({
      index: steps.length + 1,
      kind,
      isNew: before === 0,
      counts: [...counts],
      stillNeeded: missing,
      pityForced,
      sincePity: model.pity === null ? null : since,
      boxesLeft,
    })
  }

  let fixed: RoundTrace["fixed"] = null
  if (fixedDraws !== null) {
    fixed = {
      draws: fixedDraws,
      observed: counts.filter((count) => count > 0).length,
      singletons: counts.filter((count) => count === 1).length,
      doubletons: counts.filter((count) => count === 2).length,
      chao1: chao1(counts),
    }
  }

  return {
    kinds: model.ids.map((id, index) => ({
      id,
      hidden: model.params.kinds[index]?.hidden === true,
      need: model.need[index] ?? 0,
      stock: model.stock?.[index] ?? null,
      probability: model.probabilities[index] ?? 0,
    })),
    pity: model.pity,
    steps,
    needTotal: model.needTotal,
    reached: missing === 0,
    fixed,
  }
}
