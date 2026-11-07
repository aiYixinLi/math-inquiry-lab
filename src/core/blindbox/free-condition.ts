// “自由提条件”（研究方案 7.6、7.8）的计算部分。学生用自己的话提出条件，翻译器给出
// parameterChanges；这里把它合并到 L0 或 L1 上，由程序（不是大模型）生成回读的白话，
// 算出这一问的结果，并按改动的参数配好三道检验（7.5）。纯计算，不依赖浏览器。
//
// 每道检验都要经过新模型自己的代码：退化检验把新参数取特殊值，和上一级或已知公式比；
// 双路验证比较这一问的理论值和模拟值；方向检验让改动的参数往一个方向变。

import { empiricalQuantile } from "../statistics"
import {
  bestEstimate,
  compareEstimates,
  degeneracyCheck,
  directionCheck,
  dualPathCheck,
  type CheckOptions,
  type CheckResult,
  type Estimate,
  type Metric,
} from "./checks"
import {
  applyParameterChanges,
  buildKinds,
  type GoalChange,
  type KindsChange,
  type ParameterChanges,
  type PricesChange,
  type Question,
} from "./changes"
import { freeConditionBase, ladderL6 } from "./ladder"
import {
  parseProbability,
  resolveModel,
  type BlindBoxParams,
  type KindParam,
} from "./params"
import { DEFAULT_RUNS, DEFAULT_SEED, simulateModel } from "./simulate"
import {
  lastKindDecision,
  theory,
  theoryDistribution,
  type TheoryMethod,
} from "./theory"
import {
  chao1,
  expectedObservedKinds,
  goalReachedProbability,
  simulateFixedDraws,
} from "./unknown-kinds"

export type FreeConditionLevel = "L0" | "L1"

export interface FreeConditionSetup {
  /** 条件改在哪一级上（freeConditionBase）。 */
  readonly level: FreeConditionLevel
  readonly base: BlindBoxParams
  /** 合并之后的模型。 */
  readonly params: BlindBoxParams
  readonly question: Question
  /** 已经通过 applyParameterChanges 严格解析的翻译结果。 */
  readonly changes: ParameterChanges
}

export type PreparedFreeCondition =
  | ({ readonly ok: true } & FreeConditionSetup)
  | { readonly ok: false; readonly level: FreeConditionLevel; readonly issues: readonly string[] }

/** A6 学生自己的样本：见到的款里，只买到过 1 次、2 次的各有几款（Chao1 要用）。 */
export interface KindsSample {
  readonly singletons: number
  readonly doubletons: number
}

export const LEVEL_NAMES: Readonly<Record<FreeConditionLevel, string>> = {
  L0: "L0 理想模型",
  L1: "L1 示例",
}

export const LEVEL_SUMMARIES: Readonly<Record<FreeConditionLevel, string>> = {
  L0: "6 款等概率（每款 1/6），货买不完，没有保底，一个人集齐一套。",
  L1: "6 款常规款 + 1 款隐藏款（每盒 1/72），货买不完，没有保底，一个人集齐全套。",
}

/** 研究方案 6.8 的例子世界：真实 12 款等概率，收集者不知道一共几款。 */
export const EXAMPLE_UNKNOWN_KINDS = 12
const DEFAULT_SAMPLE_DRAWS = 15

/** 一次模拟最多抽这么多盒；平均盒数很大时减少轮数，免得界面等太久。 */
const MAX_SIMULATED_DRAWS = 30_000_000
const MIN_RUNS = 1_000

const METHOD_NAMES: Readonly<Record<TheoryMethod, string>> = {
  "inclusion-exclusion": "容斥原理",
  "hypergeometric-inclusion-exclusion": "不放回抽样的容斥原理",
  "truncated-geometric": "截断几何分布",
  "state-recursion": "按抽数推进的状态概率",
}

/**
 * 按“自由提条件”的规则选好改在哪一级上，再严格合并。没有改动、格式不对或合并后
 * 不能计算时返回问题代码，界面据此请学生换个说法。
 */
export function prepareFreeCondition(changes: unknown): PreparedFreeCondition {
  const { level, params: base } = freeConditionBase(changes)
  if (typeof changes === "object" && changes !== null && Object.keys(changes).length === 0) {
    return { ok: false, level, issues: ["changes-empty"] }
  }
  const outcome = applyParameterChanges(base, changes)
  if (!outcome.ok) return { ok: false, level, issues: outcome.issues }
  return {
    ok: true,
    level,
    base,
    params: outcome.params,
    question: outcome.question,
    changes: changes as ParameterChanges,
  }
}

// ---------------------------------------------------------------------------
// 回读：程序按解析后的参数复述，学生确认后才计算。

export interface ReadBackLine {
  readonly topic: string
  readonly text: string
}

export function readBack(setup: FreeConditionSetup): ReadBackLine[] {
  const { changes, params, question } = setup
  const lines: ReadBackLine[] = []
  if (changes.kinds !== undefined) lines.push({ topic: "款式", text: describeKinds(changes.kinds) })
  if (changes.stock !== undefined) lines.push({ topic: "库存", text: describeStock(params) })
  if (changes.pity !== undefined) lines.push({ topic: "保底", text: describePity(params) })
  if (changes.goal !== undefined) lines.push({ topic: "目标", text: describeGoal(changes.goal, params) })
  if (changes.prices !== undefined) lines.push({ topic: "价钱", text: describePrices(changes.prices) })
  if (changes.kindsKnown !== undefined) lines.push({ topic: "款数", text: describeUnknownKinds(question) })
  if (changes.question !== undefined) lines.push({ topic: "问题", text: describeQuestion(question, params) })
  return lines
}

/** 完整回读以合并后的参数为准，不能把修改前的 L0/L1 摘要当作当前条件。 */
export function currentModelConditions(setup: FreeConditionSetup): string {
  const { params } = setup
  const hidden = params.kinds.filter((kind) => kind.hidden).length
  const kinds = `一共 ${params.kinds.length} 款${hidden > 0 ? `，其中 ${hidden} 款隐藏款` : ""}。`
  const sampling = params.stock === "unlimited"
    ? `各款基础概率：${params.kinds.map((kind) => `${kindName(kind.id)} ${formatPercent(kind.probability)}`).join("、")}。`
    : "从剩余库存中等可能地随机抽取一盒。"
  const goal = params.goal.kinds === "all" ? "全部款式"
    : params.goal.kinds === "regular" ? "全部常规款"
      : params.goal.kinds.map(kindName).join("、")
  return `${kinds}${describeStock(params)}${sampling}${describePity(params)}${params.goal.players} 人共用这批盲盒，目标是集齐 ${goal}，每款 ${params.goal.sets} 个。`
}

function describeKinds(change: KindsChange): string {
  const special = change.special ?? []
  const specialCount = special.reduce((sum, group) => sum + group.count, 0)
  const ordinary = change.total !== undefined ? change.total - specialCount : change.ordinary ?? 0
  const total = ordinary + specialCount
  if (special.length === 0) {
    return `一共 ${total} 款，每款一样容易抽到（每盒抽到某一款的概率是 1/${total}）。`
  }

  const share = special.reduce((sum, group) => sum + group.count * parseProbability(group.probability), 0)
  const groups = special.map((group) => {
    const each = group.count > 1 ? "每款" : ""
    const name = group.hidden ? "隐藏款，" : ""
    return `${group.count} 款${name}${each}每盒抽到的概率是 ${probabilityText(group.probability)}`
  })
  const rest = ordinary > 0 ? formatPercent((1 - share) / ordinary) : ""
  if (ordinary === 0) return `一共 ${total} 款：${groups.join("；")}。`
  if (change.total !== undefined) {
    return `一共 ${total} 款：其中 ${groups.join("；")}；其余 ${ordinary} 款平分剩下的概率（每款约 ${rest}）。`
  }
  return `${ordinary} 款常规款之外，另有 ${groups.join("；")}；一共 ${total} 款，常规款平分剩下的概率（每款约 ${rest}）。`
}

function describeStock(params: BlindBoxParams): string {
  if (params.stock === "unlimited") return "店里的货买不完（库存无限），每次买到各款的概率不变。"
  const model = resolveModel(params)
  const counts = model.stock ?? []
  const total = counts.reduce((sum, count) => sum + count, 0)
  const first = counts[0] ?? 0
  if (counts.every((count) => count === first)) {
    return `店里每款只剩 ${first} 盒，一共 ${total} 盒；买走一盒就少一盒，剩下各款的比例跟着变（不放回）。`
  }
  const list = model.ids.map((id, index) => `${kindName(id)} ${counts[index] ?? 0} 盒`).join("、")
  return `店里一共只剩 ${total} 盒：${list}；买走一盒就少一盒（不放回）。`
}

function describePity(params: BlindBoxParams): string {
  if (params.pity === null) return "没有保底。"
  const { target, within } = params.pity
  const name = kindName(target)
  if (within === 1) return `保底：每一盒都一定是${name}。`
  return `保底：连续 ${within - 1} 盒没出${name}，第 ${within} 盒一定是${name}；每出一次${name}，重新计数。`
}

function describeGoal(change: GoalChange, params: BlindBoxParams): string {
  const parts: string[] = []
  if (change.kinds === "regular") parts.push("只集齐常规款，隐藏款不要")
  if (change.kinds === "hidden") parts.push("只要抽到隐藏款")
  if (change.kinds === "all") parts.push("集齐全部款式（包括隐藏款）")
  const { sets, players } = params.goal
  if (players > 1) {
    parts.push(
      `${players} 个人合买、重复款互相交换，一共要集齐 ${sets} 套${sets === players ? "（每人一套）" : ""}；算的是大家一共买几盒`,
    )
  } else if (sets > 1) {
    parts.push(`要集齐 ${sets} 套`)
  } else if (change.sets !== undefined || change.players !== undefined) {
    parts.push("一个人集齐一套")
  }
  return `目标：${parts.join("；")}。`
}

function describePrices(change: PricesChange): string {
  const parts = [`每盒 ${change.box} 元`]
  if (change.resale !== undefined) parts.push(`用不上的盒（重复款）每盒能卖 ${change.resale} 元`)
  if (change.secondHand !== undefined) parts.push(`二手市场直接买一款要 ${change.secondHand} 元`)
  return `${parts.join("；")}。除了盒数，还要算平均花多少钱。`
}

function describeUnknownKinds(question: Question): string {
  const text = "不知道一共有几款：问题反过来，要从买到的结果估计一共有几款（反问题）。"
  if (question.kind !== "unknown-kinds" || question.draws === null) return text
  const observed = question.observedKinds === null ? "" : `，见到了 ${question.observedKinds} 款`
  return `${text}已知：买了 ${question.draws} 盒${observed}。`
}

function describeQuestion(question: Question, params: BlindBoxParams): string {
  const goal = goalWord(params)
  if (question.kind === "within-draws") {
    return `问题换成：买 ${question.draws} 盒就${goal}的概率有多大？（不再只看平均数）`
  }
  if (question.kind === "confidence") {
    return `问题换成：要买多少盒，才有 ${formatPercent(question.level)} 的把握${goal}？（不再只看平均数）`
  }
  return "问题：平均要买几盒。"
}

// ---------------------------------------------------------------------------
// 这一问的主要结果，以及学生事先猜它比参照值大还是小。

export type Relation = "higher" | "lower" | "similar"

export type HeadlineKind = "mean" | "per-player-mean" | "cost" | "within-draws" | "confidence" | "unknown-kinds"

export interface HeadlineSpec {
  readonly kind: HeadlineKind
  readonly label: string
  /** "盒"、"元"、"款"；概率为空字符串。 */
  readonly unit: string
  readonly probability: boolean
  /** 猜想时比较的参照值（计算前就知道）。 */
  readonly reference: { readonly label: string; readonly value: number }
  /** 猜想选项的写法。 */
  readonly higher: string
  readonly lower: string
}

export function headlineSpec(setup: FreeConditionSetup, sample: KindsSample | null = null): HeadlineSpec {
  const { question, params, base, level } = setup
  const goal = goalWord(params)

  switch (question.kind) {
    case "unknown-kinds": {
      if (question.observedKinds !== null && sample !== null) {
        return {
          kind: "unknown-kinds",
          label: "用你的样本估计一共有几款（Chao1）",
          unit: "款",
          probability: false,
          reference: { label: "你见到的款数", value: question.observedKinds },
          higher: "比见到的多",
          lower: "比见到的少",
        }
      }
      const draws = question.draws ?? DEFAULT_SAMPLE_DRAWS
      const observed = expectedObservedKinds(ladderL6(EXAMPLE_UNKNOWN_KINDS), draws)
      return {
        kind: "unknown-kinds",
        label: `例子世界里买 ${draws} 盒，Chao1 平均估计一共几款`,
        unit: "款",
        probability: false,
        reference: { label: "平均见到的款数", value: observed.available ? observed.value : Number.NaN },
        higher: "比见到的多",
        lower: "比见到的少",
      }
    }
    case "within-draws":
      return {
        kind: "within-draws",
        label: `买 ${question.draws} 盒就${goal}的概率`,
        unit: "",
        probability: true,
        reference: { label: "一半", value: 0.5 },
        higher: "一半以上",
        lower: "不到一半",
      }
    case "confidence":
      return {
        kind: "confidence",
        label: `要有 ${formatPercent(question.level)} 的把握${goal}，要买几盒`,
        unit: "盒",
        probability: false,
        reference: { label: "平均要买的盒数", value: theoryMean(params) ?? theoryMean(base) ?? Number.NaN },
        higher: "比平均多",
        lower: "比平均少",
      }
    case "mean": {
      const baseMean = theoryMean(base) ?? Number.NaN
      if (params.prices !== null) {
        const { box } = params.prices
        return {
          kind: "cost",
          label: "平均要花多少钱",
          unit: "元",
          probability: false,
          reference: {
            label: `${LEVEL_NAMES[level]}、不卖重复款（${box} 元 × ${formatNumber(baseMean)} 盒）`,
            value: box * baseMean,
          },
          higher: "更多",
          lower: "更少",
        }
      }
      if (params.goal.players > 1) {
        return {
          kind: "per-player-mean",
          label: "每人平均要买几盒",
          unit: "盒",
          probability: false,
          reference: { label: `${LEVEL_NAMES[level]}，一个人集一套`, value: baseMean },
          higher: "每人更多",
          lower: "每人更少",
        }
      }
      return {
        kind: "mean",
        label: `平均要买几盒才能${goal}`,
        unit: "盒",
        probability: false,
        reference: { label: LEVEL_NAMES[level], value: baseMean },
        higher: "更多",
        lower: "更少",
      }
    }
  }
}

/**
 * 这一问的精确答案，只用理论值、不模拟，翻译器评测（研究方案 8.2）用它判对错。
 * 问的是反问题（一共几款），或者这组参数没有理论值时返回 null。
 */
export function exactHeadline(setup: FreeConditionSetup): { readonly spec: HeadlineSpec; readonly value: number } | null {
  try {
    return exactHeadlineOrThrow(setup)
  } catch {
    // 例如库存有限时问“买的盒数比店里的还多”。
    return null
  }
}

function exactHeadlineOrThrow(setup: FreeConditionSetup): { readonly spec: HeadlineSpec; readonly value: number } | null {
  const spec = headlineSpec(setup)
  const { params, question } = setup
  const exact = theory(params)
  if (!exact.available) return null
  switch (spec.kind) {
    case "mean":
      return { spec, value: exact.mean }
    case "per-player-mean":
      return { spec, value: exact.perPlayerMean }
    case "cost":
      return exact.expectedCost === null ? null : { spec, value: exact.expectedCost }
    case "within-draws": {
      if (question.kind !== "within-draws") return null
      const reached = goalReachedProbability(params, question.draws)
      return reached.available ? { spec, value: reached.value } : null
    }
    case "confidence": {
      const distribution = theoryDistribution(params)
      return question.kind === "confidence" && distribution.available
        ? { spec, value: distribution.quantile(question.level) }
        : null
    }
    case "unknown-kinds":
      return null
  }
}

/** 学生样本是否说得通；说不通时返回给学生看的原因。 */
export function sampleProblem(question: Question, sample: KindsSample): string | null {
  if (question.kind !== "unknown-kinds" || question.observedKinds === null || question.draws === null) {
    return "这个条件没有给出“买了几盒、见到几款”。"
  }
  const { singletons, doubletons } = sample
  if (![singletons, doubletons].every((value) => Number.isInteger(value) && value >= 0)) {
    return "请填 0 或正整数。"
  }
  const observed = question.observedKinds
  if (singletons + doubletons > observed) return `只见过 1 次和 2 次的款加起来，不能超过见到的 ${observed} 款。`
  const fewest = singletons + 2 * doubletons + 3 * (observed - singletons - doubletons)
  if (fewest > question.draws) {
    return `这样至少要买 ${fewest} 盒，可是只买了 ${question.draws} 盒，请再核对一下。`
  }
  return null
}

export interface ReportRow {
  readonly label: string
  readonly value: string
}

export interface FreeConditionReport {
  readonly spec: HeadlineSpec
  readonly value: number
  /** exact：理论值或按公式直接算出；simulation：只有模拟值。 */
  readonly source: "exact" | "simulation"
  readonly relation: Relation
  readonly rows: readonly ReportRow[]
  readonly notes: readonly string[]
  readonly checks: readonly CheckResult[]
  readonly runs: number
  readonly seed: number
}

export interface EvaluateOptions {
  readonly runs?: number
  readonly seed?: number
}

export function evaluateFreeCondition(
  setup: FreeConditionSetup,
  sample: KindsSample | null = null,
  options: EvaluateOptions = {},
): FreeConditionReport {
  const spec = headlineSpec(setup, sample)
  const seed = options.seed ?? DEFAULT_SEED
  const runs = options.runs ?? runsFor(setup)
  const checkOptions: CheckOptions = { runs, seed }
  const notes: string[] = []
  if (runs < DEFAULT_RUNS) {
    notes.push(`平均要买的盒数很大，模拟很慢，这次只模拟了 ${runs} 轮（研究方案正式实验要求至少 10 000 轮）。`)
  }

  const answer = computeHeadline(setup, spec, sample, checkOptions, notes)
  return {
    spec,
    value: answer.value,
    source: answer.source,
    relation: relationOf(answer.value, spec),
    rows: answer.rows,
    notes,
    checks: freeConditionChecks(setup, checkOptions),
    runs,
    seed,
  }
}

interface HeadlineAnswer {
  readonly value: number
  readonly source: "exact" | "simulation"
  readonly rows: ReportRow[]
}

function computeHeadline(
  setup: FreeConditionSetup,
  spec: HeadlineSpec,
  sample: KindsSample | null,
  options: CheckOptions,
  notes: string[],
): HeadlineAnswer {
  const { params, question } = setup
  const runs = options.runs ?? DEFAULT_RUNS
  const seed = options.seed ?? DEFAULT_SEED
  const goal = goalWord(params)
  const rows: ReportRow[] = []

  if (question.kind === "unknown-kinds") {
    const world = ladderL6(EXAMPLE_UNKNOWN_KINDS)
    const draws = question.draws ?? DEFAULT_SAMPLE_DRAWS
    const fixed = simulateFixedDraws(world, { draws, runs, seed })
    const observedTheory = expectedObservedKinds(world, draws)
    notes.push(
      `检验和例子用的是研究方案 6.8 的例子世界：真实 ${EXAMPLE_UNKNOWN_KINDS} 款等概率。真实世界一共几款，正是要估计的，程序不知道。`,
    )
    let value = fixed.chao1.mean
    let source: HeadlineAnswer["source"] = "simulation"
    if (sample !== null && question.observedKinds !== null) {
      const { singletons: f1, doubletons: f2 } = sample
      const observed = question.observedKinds
      value = chao1(sampleCounts(observed, f1, f2))
      source = "exact"
      rows.push({
        label: "你的样本",
        value: `买 ${question.draws ?? "?"} 盒，见到 ${observed} 款；只见过 1 次的 ${f1} 款，2 次的 ${f2} 款`,
      })
      rows.push({
        label: "Chao1 估计",
        value: `${observed} + ${f1}×(${f1}−1) ÷ [2×(${f2}+1)] = ${formatNumber(value)} 款`,
      })
    }
    rows.push({ label: "例子世界", value: `真实 ${EXAMPLE_UNKNOWN_KINDS} 款等概率，每轮买 ${draws} 盒，模拟 ${runs} 轮` })
    rows.push({
      label: "平均见到",
      value: `${formatNumber(fixed.observedKinds.mean)} 款${observedTheory.available ? `（理论 ${formatNumber(observedTheory.value)} 款）` : ""}`,
    })
    rows.push({
      label: "Chao1 平均估计",
      value: `${formatNumber(fixed.chao1.mean)} 款，95% 置信区间 ${formatRange(fixed.chao1.ci95)}`,
    })
    return { value, source, rows }
  }

  const exact = theory(params)
  if (!exact.available) notes.push(exact.message)
  const distribution = exact.available ? theoryDistribution(params) : null
  const method = exact.available ? `（${METHOD_NAMES[exact.method]}）` : ""

  if (question.kind === "within-draws") {
    const { draws } = question
    const theoryValue = goalReachedProbability(params, draws)
    const share = simulateFixedDraws(params, { draws, runs, seed }).goalReachedShare
    rows.push({
      label: "理论值",
      value: theoryValue.available ? `${formatProbability(theoryValue.value)}${method}` : "没有理论值",
    })
    rows.push({ label: "模拟值", value: `${runs} 轮里有 ${formatProbability(share)} 在 ${draws} 盒内${goal}` })
    if (exact.available) rows.push({ label: "平均要买", value: `${formatNumber(exact.mean)} 盒` })
    return theoryValue.available
      ? { value: theoryValue.value, source: "exact", rows }
      : { value: share, source: "simulation", rows }
  }

  const simulation = simulateModel(params, { runs, seed })

  if (question.kind === "confidence") {
    const { level } = question
    const simulated = empiricalQuantile(simulation.samples, level)
    if (distribution !== null && distribution.available) {
      const boxes = distribution.quantile(level)
      const reached = 1 - distribution.survival(boxes)
      const fewer = 1 - distribution.survival(boxes - 1)
      rows.push({
        label: "理论值",
        value: `买 ${boxes} 盒，${goal}的概率是 ${formatProbability(reached)}；少买 1 盒只有 ${formatProbability(fewer)}${method}`,
      })
      rows.push({ label: "模拟值", value: `${runs} 轮里，${formatPercent(level)} 的轮在 ${simulated} 盒内${goal}` })
      rows.push({ label: "平均要买", value: `${formatNumber(distribution.mean)} 盒` })
      return { value: boxes, source: "exact", rows }
    }
    rows.push({ label: "理论值", value: "没有理论值" })
    rows.push({ label: "模拟值", value: `${runs} 轮里，${formatPercent(level)} 的轮在 ${simulated} 盒内${goal}` })
    rows.push({ label: "平均要买", value: `${formatNumber(simulation.draws.mean)} 盒（模拟）` })
    return { value: simulated, source: "simulation", rows }
  }

  // 平均盒数、每人平均或平均花费。
  const players = params.goal.players
  const meanExact = exact.available ? exact.mean : null
  const meanSimulated = simulation.draws.mean
  const p50 = exact.available ? exact.quantiles.p50 : simulation.quantiles.p50
  const p90 = exact.available ? exact.quantiles.p90 : simulation.quantiles.p90
  const boxesRow = (value: number | null, simulated: boolean): string =>
    value === null
      ? "没有理论值"
      : simulated
        ? `${formatNumber(value)} 盒，95% 置信区间 ${formatRange(simulation.draws.ci95)}（${runs} 轮）`
        : `${formatNumber(value)} 盒${method}`

  if (spec.kind === "cost") {
    const costExact = exact.available ? exact.expectedCost : null
    const costSimulated = simulation.cost
    rows.push({ label: "平均花费（理论）", value: costExact === null ? "没有理论值" : `${formatNumber(costExact)} 元${method}` })
    if (costSimulated !== null) {
      rows.push({
        label: "平均花费（模拟）",
        value: `${formatNumber(costSimulated.mean)} 元，95% 置信区间 ${formatRange(costSimulated.ci95)}（${runs} 轮）`,
      })
    }
    rows.push({ label: "平均盒数", value: `${formatNumber(meanExact ?? meanSimulated)} 盒` })
    const decision = secondHandRow(params)
    if (decision !== null) rows.push(decision)
    return costExact !== null
      ? { value: costExact, source: "exact", rows }
      : { value: costSimulated?.mean ?? Number.NaN, source: "simulation", rows }
  }

  rows.push({ label: players > 1 ? "大家一共买（理论）" : "理论值", value: boxesRow(meanExact, false) })
  rows.push({ label: players > 1 ? "大家一共买（模拟）" : "模拟值", value: boxesRow(meanSimulated, true) })
  rows.push({ label: "一半的人", value: `${p50} 盒内${goal}` })
  rows.push({ label: "90% 的人", value: `${p90} 盒内${goal}` })

  if (spec.kind === "per-player-mean") {
    const total = meanExact ?? meanSimulated
    rows.unshift({ label: "每人平均", value: `${formatNumber(total / players)} 盒（${players} 人平分）` })
    const alone = theoryMean(setup.base)
    if (alone !== null && params.goal.sets === players) {
      const separate = alone * players
      rows.push({
        label: "和各自集比",
        value: `各自集一共 ${formatNumber(separate)} 盒，合作省 ${formatPercent(1 - total / separate)}`,
      })
    }
    return { value: total / players, source: meanExact === null ? "simulation" : "exact", rows }
  }
  return meanExact !== null
    ? { value: meanExact, source: "exact", rows }
    : { value: meanSimulated, source: "simulation", rows }
}

/** 研究方案 6.7 的停手规则：只差最难抽的那一款时，继续抽和买二手哪个便宜。 */
function secondHandRow(params: BlindBoxParams): ReportRow | null {
  if (params.prices?.secondHand === undefined) return null
  const model = resolveModel(params)
  const rarest = [...model.goalIndices].sort(
    (left, right) => (model.probabilities[left] ?? 0) - (model.probabilities[right] ?? 0),
  )[0]
  const id = rarest === undefined ? undefined : model.ids[rarest]
  if (id === undefined) return null
  const decision = lastKindDecision(params, id)
  if (!decision.available) return { label: "只差最后一款时", value: decision.message }
  const verdict =
    decision.cheaper === "second-hand" ? "买二手更省" : decision.cheaper === "continue" ? "继续抽更省" : "两种一样"
  return {
    label: "只差最后一款时",
    value:
      `缺的是 ${kindName(id)}：继续抽平均还要 ${formatNumber(decision.expectedDraws)} 盒、约 ${formatNumber(decision.continueCost)} 元；` +
      `二手价 ${decision.secondHand ?? "?"} 元，${verdict}`,
  }
}

function relationOf(value: number, spec: HeadlineSpec): Relation {
  const reference = spec.reference.value
  const tolerance = spec.probability ? 0.02 : 0.02 * Math.abs(reference)
  if (!Number.isFinite(value) || !Number.isFinite(reference) || Math.abs(value - reference) <= tolerance) {
    return "similar"
  }
  return value > reference ? "higher" : "lower"
}

function runsFor(setup: FreeConditionSetup): number {
  if (setup.question.kind === "unknown-kinds") return DEFAULT_RUNS
  const mean = theoryMean(setup.params)
  if (mean === null || mean <= 0) return DEFAULT_RUNS
  return Math.max(MIN_RUNS, Math.min(DEFAULT_RUNS, Math.floor(MAX_SIMULATED_DRAWS / mean)))
}

// ---------------------------------------------------------------------------
// 三道检验：按改动了哪个参数、问的是什么来配。

export function freeConditionChecks(setup: FreeConditionSetup, options: CheckOptions = {}): CheckResult[] {
  return [
    ...degeneracyChecks(setup, options),
    ...dualPaths(setup, options),
    ...directionChecks(setup, options),
  ]
}

function degeneracyChecks(setup: FreeConditionSetup, options: CheckOptions): CheckResult[] {
  const { changes, params, question } = setup
  const results: CheckResult[] = []
  const simple = isSimpleWorld(params)

  if (question.kind === "unknown-kinds") {
    const enough = simulateFixedDraws(ladderL6(EXAMPLE_UNKNOWN_KINDS), {
      draws: 1_000,
      runs: Math.min(options.runs ?? DEFAULT_RUNS, 2_000),
      seed: options.seed ?? DEFAULT_SEED,
    })
    results.push(
      compareEstimates(
        "degeneracy",
        `买得足够多（${EXAMPLE_UNKNOWN_KINDS} 款买 1 000 盒）→ Chao1 估计等于见到的款数`,
        [
          { label: "Chao1 平均", estimate: summaryEstimate(enough.chao1) },
          { label: "见到的款数平均", estimate: summaryEstimate(enough.observedKinds) },
        ],
        // 同一批模拟里逐轮相等，差应当恰好为 0。
        { zLimit: 0 },
      ),
    )
    return results
  }

  if (question.kind === "within-draws" || question.kind === "confidence") {
    const need = resolveModel(params).needTotal
    if (need >= 2) {
      results.push(
        compareEstimates("degeneracy", `只买 ${need - 1} 盒（比要集的 ${need} 个还少）→ 集齐的概率必须是 0`, [
          { label: "模型", estimate: bestEstimate(params, { kind: "reached-within", draws: need - 1 }, options) },
          { label: "应当", estimate: exactEstimate(0) },
        ]),
      )
    }
  }

  const kinds = changes.kinds
  if (kinds !== undefined && simple && question.kind === "mean" && params.prices === null) {
    const { ordinary, special } = kindsStructure(kinds)
    const total = ordinary + special.reduce((sum, group) => sum + group.count, 0)
    if (special.length > 0) {
      results.push(
        degeneracyCheck(
          {
            name: `特殊款的概率改成 1/${total} → 退回 ${total} 款等概率（${total}×(1+1/2+…+1/${total}) 盒）`,
            special: {
              ...params,
              kinds: buildKinds(ordinary, special.map((group) => ({ ...group, probability: 1 / total }))),
            },
            reference: harmonicMean(total),
          },
          options,
        ),
      )
    } else {
      results.push(
        degeneracyCheck(
          {
            name: "款数改回 6 → 退回 L0 理想模型（14.7 盒）",
            special: { ...params, kinds: buildKinds(6, []) },
            reference: harmonicMean(6),
          },
          options,
        ),
      )
    }
  }

  if (changes.stock !== undefined && params.stock !== "unlimited" && params.pity === null && params.goal.sets === 1) {
    const model = resolveModel(params)
    if (params.goal.kinds === "all") {
      results.push(
        degeneracyCheck(
          {
            name: `每款只剩 1 盒 → 正好买 ${model.ids.length} 盒`,
            special: { ...params, stock: { perKind: 1 } },
            reference: model.ids.length,
          },
          options,
        ),
      )
    }
    results.push(
      degeneracyCheck(
        {
          name: "每款库存改成 10 000 盒 → 接近库存无限",
          special: { ...params, stock: { perKind: 10_000 } },
          reference: { ...params, stock: "unlimited" },
          tolerance: 0.01,
        },
        options,
      ),
    )
  }

  if (params.pity !== null) {
    results.push(
      degeneracyCheck(
        {
          name: "保底次数改成 10 000 → 退回没有保底",
          special: { ...params, pity: { ...params.pity, within: 10_000 } },
          reference: { ...params, pity: null },
          tolerance: 1e-6,
        },
        options,
      ),
    )
  }

  const goal = changes.goal
  const hidden = params.kinds.filter((kind) => kind.hidden === true)
  if (goal?.kinds === "regular" && hidden.length > 0 && params.stock === "unlimited" && params.pity === null) {
    const regular = params.kinds.filter((kind) => kind.hidden !== true)
    results.push(
      degeneracyCheck(
        {
          name: "隐藏款的概率改成 0 → 退回只有常规款的模型",
          special: { ...params, kinds: withHiddenProbability(params.kinds, 0) },
          reference: { ...params, kinds: renormalize(regular), goal: { ...params.goal, kinds: "all" } },
        },
        options,
      ),
    )
  }
  if (goal?.kinds === "hidden" && hidden.length === 1 && params.pity === null && params.stock === "unlimited") {
    const q = hidden[0]?.probability ?? 0
    results.push(
      compareEstimates("degeneracy", `只等一款 → 退回几何分布，平均应当是 1 ÷ 概率 = ${formatNumber(1 / q)} 盒`, [
        { label: "模型", estimate: bestEstimate(params, { kind: "mean" }, options) },
        { label: "1 ÷ 概率", estimate: exactEstimate(1 / q) },
      ], options),
    )
  }
  if ((goal?.sets !== undefined || goal?.players !== undefined) && (params.goal.sets > 1 || params.goal.players > 1)) {
    const single: BlindBoxParams = { ...params, goal: { ...params.goal, sets: 1, players: 1 } }
    results.push(
      degeneracyCheck(
        {
          name: `一个人只集一套 → 退回 ${LEVEL_NAMES[setup.level]}`,
          special: single,
          reference: equalProbabilities(single) && single.goal.kinds === "all" && single.stock === "unlimited" && single.pity === null
            ? harmonicMean(single.kinds.length)
            : setup.base,
        },
        options,
      ),
    )
  }

  if (params.prices !== null && question.kind === "mean") {
    const mean = bestEstimate(params, { kind: "mean" }, options)
    const { box } = params.prices
    results.push(
      compareEstimates(
        "degeneracy",
        "重复款卖 0 元 → 平均花费等于单价 × 平均盒数",
        [
          {
            label: "模型",
            estimate: bestEstimate({ ...params, prices: { ...params.prices, resale: 0 } }, { kind: "cost" }, options),
          },
          { label: "单价 × 平均盒数", estimate: mean === null ? null : scaleEstimate(mean, box) },
        ],
        options,
      ),
    )
  }

  return results
}

function dualPaths(setup: FreeConditionSetup, options: CheckOptions): CheckResult[] {
  const { params, question } = setup

  if (question.kind === "unknown-kinds") {
    const draws = question.draws ?? DEFAULT_SAMPLE_DRAWS
    const world = ladderL6(EXAMPLE_UNKNOWN_KINDS)
    return [
      dualPathCheck(
        {
          name: `例子世界（${EXAMPLE_UNKNOWN_KINDS} 款）买 ${draws} 盒见到的款数`,
          params: world,
          metric: { kind: "observed-kinds", draws },
        },
        options,
      ),
      dualPathCheck(
        {
          name: `例子世界（${EXAMPLE_UNKNOWN_KINDS} 款）买 ${draws} 盒，Chao1 的平均估计`,
          params: world,
          metric: { kind: "chao1", draws },
        },
        options,
      ),
    ]
  }

  const goal = goalWord(params)
  let name = `平均要买几盒才能${goal}`
  let metric: Metric = { kind: "mean" }
  if (question.kind === "within-draws") {
    name = `买 ${question.draws} 盒就${goal}的概率`
    metric = { kind: "reached-within", draws: question.draws }
  } else if (question.kind === "confidence") {
    const distribution = theoryDistribution(params)
    if (distribution.available) {
      const boxes = distribution.quantile(question.level)
      name = `买 ${boxes} 盒就${goal}的概率（${formatPercent(question.level)} 把握对应的盒数）`
      metric = { kind: "reached-within", draws: boxes }
    }
  } else if (params.prices !== null) {
    name = "平均花费"
    metric = { kind: "cost" }
  }

  const result = dualPathCheck({ name, params, metric }, options)
  if (result.status !== "no-theory") return [result]
  const exact = theory(params)
  return [exact.available ? result : { ...result, detail: `${result.detail}${exact.message}` }]
}

function directionChecks(setup: FreeConditionSetup, options: CheckOptions): CheckResult[] {
  const { changes, params, question } = setup
  const results: CheckResult[] = []

  if (question.kind === "unknown-kinds") {
    const draws = question.draws ?? DEFAULT_SAMPLE_DRAWS
    results.push(
      directionCheck(
        {
          name: `买得越多，见到的款数越接近 ${EXAMPLE_UNKNOWN_KINDS}（例子世界）`,
          values: uniqueSorted([5, 10, draws, 24, 50]),
          build: () => ladderL6(EXAMPLE_UNKNOWN_KINDS),
          expect: "increasing",
          approaches: EXAMPLE_UNKNOWN_KINDS,
          metric: (value) => ({ kind: "observed-kinds", draws: value }),
          formatValue: (value) => `${value} 盒`,
        },
        options,
      ),
    )
    return results
  }

  if (question.kind === "within-draws") {
    const distribution = theoryDistribution(params)
    const values = distribution.available
      ? uniqueSorted([
          ...[0.1, 0.5, 0.9].map((level) => distribution.quantile(level)),
          ...(distribution.survival(question.draws) > 1e-9 ? [question.draws] : []),
        ])
      : uniqueSorted([Math.max(1, Math.ceil(question.draws / 2)), question.draws])
    results.push(
      directionCheck(
        {
          name: `买的盒数越多，${goalWord(params)}的概率越大`,
          values,
          build: () => params,
          expect: "increasing",
          metric: (value) => ({ kind: "reached-within", draws: value }),
          formatValue: (value) => `${value} 盒`,
        },
        options,
      ),
    )
  }

  if (question.kind === "confidence") {
    const { level } = question
    const levels = level > 0.5 ? [0.5, level, (1 + level) / 2] : [level, 0.5, 0.9]
    results.push(
      directionCheck(
        {
          name: "把握要求越高，要买的盒数越多",
          values: uniqueSorted(levels),
          build: () => params,
          expect: "increasing",
          metric: (value) => ({ kind: "quantile", level: value }),
          formatValue: formatPercent,
        },
        options,
      ),
    )
  }

  const kinds = changes.kinds
  if (kinds !== undefined && isSimpleWorld(params)) {
    const { ordinary, special } = kindsStructure(kinds)
    const group = special[0]
    if (special.length === 0) {
      const total = ordinary
      results.push(
        directionCheck(
          {
            name: "款数越多，集齐越难",
            values: uniqueSorted([total - 2, total, total + 2, total + 4].filter((value) => value >= 1)),
            build: (count) => ({ ...params, kinds: buildKinds(count, []) }),
            expect: "increasing",
            formatValue: (value) => `${value} 款`,
          },
          options,
        ),
      )
    } else if (special.length === 1 && group !== undefined) {
      const total = ordinary + group.count
      const equal = 1 / total
      const p = group.probability
      const highest = ordinary > 0 ? 1 / group.count : p
      const name = group.hidden ? "隐藏款" : "这款"
      if (Math.abs(p - equal) > 1e-12 && (p < equal || highest > p)) {
        const values =
          p < equal ? [equal, (equal + p) / 2, p, p / 2] : [equal, (equal + p) / 2, p, (p + highest) / 2]
        results.push(
          directionCheck(
            {
              name: p < equal ? `${name}越稀有，集齐越难` : `${name}越常见、其余款越稀有，集齐越难`,
              values,
              build: (q) => ({ ...params, kinds: buildKinds(ordinary, [{ ...group, probability: q }]) }),
              expect: "increasing",
              formatValue: formatPercent,
            },
            options,
          ),
        )
      }
    }
  }

  if (changes.stock !== undefined && params.stock !== "unlimited" && params.pity === null && params.goal.sets === 1) {
    const counts = resolveModel(params).stock ?? []
    const m = counts[0] ?? 0
    const limit = theoryMean({ ...params, stock: "unlimited" })
    if (m > 0 && counts.every((count) => count === m)) {
      results.push(
        directionCheck(
          {
            name: `库存越多，越接近库存无限时的 ${limit === null ? "结果" : `${formatNumber(limit)} 盒`}`,
            values: uniqueSorted([1, Math.ceil(m / 2), m, 2 * m, 5 * m]),
            build: (perKind) => ({ ...params, stock: { perKind } }),
            expect: "increasing",
            ...(limit === null ? {} : { approaches: limit }),
            formatValue: (value) => `每款 ${value} 盒`,
          },
          options,
        ),
      )
    }
  }

  if (params.pity !== null) {
    const { within } = params.pity
    const others = resolveModel(params).goalIndices.length > 1 || params.goal.sets > 1
    const smallest = others ? 2 : 1
    results.push(
      directionCheck(
        {
          name: "保底次数越小，平均越少",
          values: uniqueSorted(
            [Math.ceil(within / 4), Math.ceil(within / 2), within, 2 * within].map((value) => Math.max(smallest, value)),
          ),
          build: (value) => ({ ...params, pity: params.pity === null ? null : { ...params.pity, within: value } }),
          expect: "increasing",
          formatValue: (value) => `${value} 抽`,
        },
        options,
      ),
    )
  }

  const goal = changes.goal
  const hidden = params.kinds.filter((kind) => kind.hidden === true)
  const q = hidden[0]?.probability ?? 0
  const highestHidden = hidden.length > 0 ? 0.9 / hidden.length : 0
  if (goal?.kinds === "regular" && hidden.length > 0 && q > 0 && params.pity === null) {
    const limit = theoryMean({
      ...params,
      kinds: renormalize(params.kinds.filter((kind) => kind.hidden !== true)),
      goal: { ...params.goal, kinds: "all" },
    })
    results.push(
      directionCheck(
        {
          name: `隐藏款越稀有，只集常规款越接近只有常规款时的 ${limit === null ? "结果" : `${formatNumber(limit)} 盒`}`,
          values: uniqueSorted([Math.min(4 * q, highestHidden), 2 * q, q, q / 2]).reverse(),
          build: (value) => ({ ...params, kinds: withHiddenProbability(params.kinds, value) }),
          expect: "decreasing",
          ...(limit === null ? {} : { approaches: limit }),
          formatValue: formatPercent,
        },
        options,
      ),
    )
  }
  if (goal?.kinds === "hidden" && hidden.length > 0 && q > 0) {
    results.push(
      directionCheck(
        {
          name: "隐藏款越稀有，等到它要的盒数越多",
          values: uniqueSorted([Math.min(2 * q, highestHidden), q, q / 2]).reverse(),
          build: (value) => ({ ...params, kinds: withHiddenProbability(params.kinds, value) }),
          expect: "increasing",
          formatValue: formatPercent,
        },
        options,
      ),
    )
  }
  if (goal !== undefined && (goal.sets !== undefined || goal.players !== undefined)) {
    const { sets, players } = params.goal
    if (players > 1 && sets === players) {
      results.push(
        directionCheck(
          {
            name: "合作的人越多，每人平均越少",
            values: uniqueSorted([1, 2, 3, 4, players]),
            build: (value) => ({ ...params, goal: { ...params.goal, sets: value, players: value } }),
            expect: "decreasing",
            metric: { kind: "per-player-mean" },
            formatValue: (value) => `${value} 人`,
          },
          options,
        ),
      )
    } else if (sets > 1 || players > 1) {
      results.push(
        directionCheck(
          {
            name: "要集的套数越多，要买的盒数越多",
            values: uniqueSorted([1, 2, 3, sets]),
            build: (value) => ({ ...params, goal: { ...params.goal, sets: value } }),
            expect: "increasing",
            formatValue: (value) => `${value} 套`,
          },
          options,
        ),
      )
    }
  }

  if (params.prices !== null && question.kind === "mean") {
    const prices = params.prices
    const resale = prices.resale ?? 0
    results.push(
      resale > 0
        ? directionCheck(
            {
              name: "重复款卖得越贵，平均花费越少",
              values: uniqueSorted([0, resale / 2, resale, 1.5 * resale]),
              build: (value) => ({ ...params, prices: { ...prices, resale: value } }),
              expect: "decreasing",
              metric: { kind: "cost" },
              formatValue: (value) => `${formatNumber(value)} 元`,
            },
            options,
          )
        : directionCheck(
            {
              name: "单价越高，平均花费越多",
              values: uniqueSorted([prices.box / 2, prices.box, 2 * prices.box].filter((value) => value > 0)),
              build: (value) => ({ ...params, prices: { ...prices, box: value } }),
              expect: "increasing",
              metric: { kind: "cost" },
              formatValue: (value) => `${formatNumber(value)} 元`,
            },
            options,
          ),
    )
  }

  return results
}

// ---------------------------------------------------------------------------
// 共用的小工具

/** 货无限、没有保底、集全部款一套、一个人：等概率时平均就是 n(1 + 1/2 + … + 1/n)。 */
function isSimpleWorld(params: BlindBoxParams): boolean {
  return (
    params.stock === "unlimited" &&
    params.pity === null &&
    params.goal.kinds === "all" &&
    params.goal.sets === 1 &&
    params.goal.players === 1
  )
}

function kindsStructure(change: KindsChange): {
  readonly ordinary: number
  readonly special: { readonly count: number; readonly probability: number; readonly hidden: boolean }[]
} {
  const special = (change.special ?? []).map((group) => ({
    count: group.count,
    probability: parseProbability(group.probability),
    hidden: group.hidden,
  }))
  const specialCount = special.reduce((sum, group) => sum + group.count, 0)
  return { ordinary: change.total !== undefined ? change.total - specialCount : change.ordinary ?? 0, special }
}

export function harmonicMean(kinds: number): number {
  let sum = 0
  for (let index = 1; index <= kinds; index += 1) sum += 1 / index
  return kinds * sum
}

function equalProbabilities(params: BlindBoxParams): boolean {
  const first = params.kinds[0]?.probability
  return params.kinds.every((kind) => Math.abs(kind.probability - (first ?? 0)) < 1e-12)
}

/** 隐藏款每款概率改成 q，常规款按原来的比例分剩下的概率。 */
function withHiddenProbability(kinds: readonly KindParam[], q: number): KindParam[] {
  const hiddenCount = kinds.filter((kind) => kind.hidden === true).length
  const regularShare = kinds.filter((kind) => kind.hidden !== true).reduce((sum, kind) => sum + kind.probability, 0)
  const scale = regularShare > 0 ? (1 - hiddenCount * q) / regularShare : 0
  return kinds.map((kind) =>
    kind.hidden === true ? { ...kind, probability: q } : { ...kind, probability: kind.probability * scale },
  )
}

function renormalize(kinds: readonly KindParam[]): KindParam[] {
  const total = kinds.reduce((sum, kind) => sum + kind.probability, 0)
  return kinds.map((kind) => ({ ...kind, probability: kind.probability / total }))
}

function theoryMean(params: BlindBoxParams): number | null {
  const result = theory(params)
  return result.available ? result.mean : null
}

function exactEstimate(value: number): Estimate {
  return { source: "theory", value, standardError: 0, ci95: null }
}

function scaleEstimate(estimate: Estimate, factor: number): Estimate {
  return {
    ...estimate,
    value: estimate.value * factor,
    standardError: estimate.standardError * factor,
    ci95: estimate.ci95 === null ? null : [estimate.ci95[0] * factor, estimate.ci95[1] * factor],
  }
}

function summaryEstimate(summary: {
  readonly mean: number
  readonly standardError: number
  readonly ci95: readonly [number, number]
}): Estimate {
  return { source: "simulation", value: summary.mean, standardError: summary.standardError, ci95: summary.ci95 }
}

/** Chao1 只看见到几款、其中只见过 1 次和 2 次的各几款；其余的款按 3 次计。 */
function sampleCounts(observed: number, singletons: number, doubletons: number): number[] {
  return [
    ...Array.from({ length: singletons }, () => 1),
    ...Array.from({ length: doubletons }, () => 2),
    ...Array.from({ length: Math.max(0, observed - singletons - doubletons) }, () => 3),
  ]
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right)
}

function goalWord(params: BlindBoxParams): string {
  const { kinds, sets, players } = params.goal
  if (Array.isArray(kinds)) return kinds.length === 1 && kinds[0]?.startsWith("hidden") ? "抽到隐藏款" : "达成目标"
  const what = kinds === "regular" ? "常规款" : ""
  if (players > 1 || sets > 1) return `集齐 ${sets} 套${what}`
  return `集齐${what}`
}

export function kindName(id: string): string {
  if (id === "hidden") return "隐藏款"
  if (id.startsWith("hidden")) return `隐藏款 ${id.slice("hidden".length)}`
  return `${id} 款`
}

/** 学生原来的概率写法，必要时补上百分数。 */
function probabilityText(raw: string): string {
  const text = raw.normalize("NFKC").replace(/\s+/gu, "")
  return text.endsWith("%") ? text : `${text}（约 ${formatPercent(parseProbability(text))}）`
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? trimZeros(value.toFixed(2)) : "—"
}

/** 写在条件里的概率：保留 3 位有效数字。 */
export function formatPercent(value: number): string {
  const percent = value * 100
  const digits = percent >= 10 ? 1 : percent >= 1 ? 2 : 3
  return `${trimZeros(percent.toFixed(digits))}%`
}

/** 算出来的概率：靠近 0 或 1 时不写成 0% 或 100%。 */
export function formatProbability(value: number): string {
  if (value >= 1) return "100%"
  if (value <= 0) return "0%"
  if (value > 0.9999) return "超过 99.99%"
  if (value < 0.0001) return "不到 0.01%"
  return `${trimZeros((value * 100).toFixed(2))}%`
}

function formatRange(range: readonly [number, number]): string {
  return `${formatNumber(range[0])}–${formatNumber(range[1])}`
}

function trimZeros(text: string): string {
  return text.includes(".") ? text.replace(/0+$/u, "").replace(/\.$/u, "") : text
}
