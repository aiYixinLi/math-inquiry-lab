// 研究方案 8.1 的数学验证：L1–L6 每一级的理论值和固定种子模拟值对比（双路验证），
// 附模拟值的 95% 区间；再做退化检验，并核对方案正文里写的数字。L0 作为参照一起列出。
// L6 另附 Chao1 在不同款数、不同盒数下的准确度表（研究方案 8.4 区赛阶段）。
// 网页不用这个模块，只有 scripts/math-validation.ts 用到；放在 src/ 里是为了参加类型检查和测试。
//
// 判定标准（和 core/blindbox/checks.ts 一致）：
// - 平均值、概率：理论值与模拟值之差不超过 3 倍标准误（约 99.7%）；
// - 分位数：理论值落在样本次序统计量给出的 99.7% 区间内；
// - 另外报告 95% 区间和理论值是否落在里面。95% 区间本来就有约 1/20 的机会不含真值，
//   所以不拿它判定；
// - 退化检验：特殊参数的理论值与上一级之差不超过容差，特殊参数的模拟值也要按上面的
//   标准和上一级一致。

import {
  DEFAULT_RUNS,
  DEFAULT_SEED,
  L0_PARAMS,
  equalKinds,
  expectedChao1,
  expectedObservedKinds,
  ladderL0,
  ladderL1,
  ladderL3,
  ladderL4,
  ladderL5,
  ladderL6,
  regularWithHidden,
  simulateFixedDraws,
  simulateModel,
  theoryDistribution,
  type BlindBoxParams,
  type NoTheory,
  type TheoryDistribution,
  type TheoryMethod,
  type TheoryNumber,
} from "../core/blindbox"
import {
  Z_95,
  empiricalQuantile,
  proportionStandardError,
  quantileInterval,
  summarizeSample,
} from "../core/statistics"
import { toCsv } from "./translator-eval"

export type LevelId = "L0" | "L1" | "L2" | "L3" | "L4" | "L5" | "L6"

export type Statistic =
  | { readonly kind: "mean" }
  /** 最小的 k，使“k 盒内达成目标”的概率 ≥ level。 */
  | { readonly kind: "quantile"; readonly level: number }
  /** P(T > draws)：买了 draws 盒还没达成目标的概率。 */
  | { readonly kind: "exceeds"; readonly draws: number }
  /** L6：固定买设置里的 draws 盒，平均见到几款。 */
  | { readonly kind: "seen" }
  /** L6：固定买设置里的 draws 盒，Chao1 平均估计一共几款。 */
  | { readonly kind: "chao1" }

export interface Setting {
  /** 编号，也是原始数据表里的列名；开头的 L0、L1……决定写进哪个文件。 */
  readonly id: string
  readonly description: string
  readonly params: BlindBoxParams
  /**
   * L6：每轮固定买 draws 盒，记下见到的款数和 Chao1 估计（原始数据表里是“编号:seen”
   * “编号:chao1”两列）。不写时每轮一直买到达成目标，记下买了几盒。
   */
  readonly draws?: number
}

/** 判定用的标准误倍数。 */
export const Z_LIMIT = 3
const TOLERANCE = 1e-9

const MEAN: Statistic = { kind: "mean" }
const MEDIAN: Statistic = { kind: "quantile", level: 0.5 }
const P90: Statistic = { kind: "quantile", level: 0.9 }
const SEEN: Statistic = { kind: "seen" }
const CHAO1: Statistic = { kind: "chao1" }

const noHiddenRegular: BlindBoxParams = {
  ...L0_PARAMS,
  kinds: regularWithHidden(6, 0),
  goal: { kinds: "regular", sets: 1, players: 1 },
}

/** 研究方案 6.8 表中两个有隐藏款的世界：隐藏款比一款常规款稀有 12 倍左右。 */
const hiddenWorld7 = ladderL6(6, { hiddenProbability: 1 / 72 })
const hiddenWorld13 = ladderL6(12, { hiddenProbability: 1 / 144 })

/** 每个设置模拟一次，样本供这个设置的各项指标共用。示例参数见研究方案 6.1。 */
export const SETTINGS: readonly Setting[] = [
  { id: "L0", description: "6 款等概率，货无限，无保底，集一套", params: ladderL0() },
  { id: "L1-all", description: "6 款常规 + 1 款隐藏款（1/72），集全套", params: ladderL1() },
  { id: "L1-regular", description: "6 款常规 + 1 款隐藏款（1/72），只集常规款", params: ladderL1({ goal: "regular" }) },
  { id: "L1-hidden", description: "6 款常规 + 1 款隐藏款（1/72），只等隐藏款", params: ladderL1({ goal: "hidden" }) },
  { id: "L1-q1of7", description: "退化检验：隐藏款概率取 1/7，集全套", params: ladderL1({ hiddenProbability: 1 / 7 }) },
  { id: "L1-q0", description: "退化检验：隐藏款概率取 0，只集常规款", params: noHiddenRegular },
  { id: "L3-m1", description: "店里每款只剩 1 盒，集一套", params: ladderL3(1) },
  { id: "L3-m2", description: "店里每款只剩 2 盒，集一套", params: ladderL3(2) },
  { id: "L3-m5", description: "店里每款只剩 5 盒，集一套", params: ladderL3(5) },
  { id: "L3-m10", description: "店里每款只剩 10 盒，集一套", params: ladderL3(10) },
  { id: "L3-m50", description: "店里每款只剩 50 盒，集一套", params: ladderL3(50) },
  { id: "L3-m10000", description: "退化检验：店里每款剩 10 000 盒，集一套", params: ladderL3(10_000) },
  { id: "L4-all-72", description: "L1 加隐藏款 72 抽保底，集全套", params: ladderL4() },
  { id: "L4-hidden-72", description: "L1 加隐藏款 72 抽保底，只等隐藏款", params: ladderL4({ goal: "hidden" }) },
  { id: "L4-hidden-36", description: "L1 加隐藏款 36 抽保底，只等隐藏款", params: ladderL4({ within: 36, goal: "hidden" }) },
  { id: "L4-all-10000", description: "退化检验：保底取 10 000 抽，集全套", params: ladderL4({ within: 10_000 }) },
  { id: "L4-hidden-10000", description: "退化检验：保底取 10 000 抽，只等隐藏款", params: ladderL4({ within: 10_000, goal: "hidden" }) },
  { id: "L4-hidden-1", description: "退化检验：保底取 1 抽，只等隐藏款", params: ladderL4({ within: 1, goal: "hidden" }) },
  { id: "L5-pair", description: "6 款等概率，两人合买、重复款互相交换，各集一套（一共 2 套）", params: ladderL5() },
  { id: "L5-last", description: "6 款等概率，只差最后 1 款（只等 F 款）", params: { ...L0_PARAMS, goal: { kinds: ["F"], sets: 1, players: 1 } } },
  { id: "L5-p1", description: "退化检验：合买的人数取 1（一人一套）", params: ladderL5({ players: 1 }) },
  { id: "L5-k1", description: "退化检验：只有 1 款，两人各要 1 个", params: { ...ladderL5(), kinds: equalKinds(1) } },
  { id: "L6-12-d15", description: "真实 12 款等概率，不知道一共几款，买 15 盒", params: ladderL6(12), draws: 15 },
  { id: "L6-h7-d15", description: "真实 6 款常规 + 1 款隐藏款（1/72），买 15 盒", params: hiddenWorld7, draws: 15 },
  { id: "L6-h7-d60", description: "真实 6 款常规 + 1 款隐藏款（1/72），买 60 盒", params: hiddenWorld7, draws: 60 },
  { id: "L6-h13-d15", description: "真实 12 款常规 + 1 款隐藏款（1/144），买 15 盒", params: hiddenWorld13, draws: 15 },
  { id: "L6-h13-d60", description: "真实 12 款常规 + 1 款隐藏款（1/144），买 60 盒", params: hiddenWorld13, draws: 60 },
  { id: "L6-12-d300", description: "退化检验：真实 12 款等概率，买 300 盒", params: ladderL6(12), draws: 300 },
]

export interface ComparisonSpec {
  readonly level: LevelId
  readonly name: string
  readonly setting: string
  readonly statistic: Statistic
  /** 方案正文里写的数字，原样照抄（"73.7"、"36.5%"），核对正文与程序一致。 */
  readonly plan?: string
}

/** 双路验证的各项。L2 不改参数，问的是 L1 的分布，所以用 L1 的样本。 */
export const COMPARISONS: readonly ComparisonSpec[] = [
  { level: "L0", name: "平均要买几盒", setting: "L0", statistic: MEAN, plan: "14.7" },
  { level: "L0", name: "一半的人在几盒内集齐", setting: "L0", statistic: MEDIAN, plan: "13" },
  { level: "L0", name: "90% 的人在几盒内集齐", setting: "L0", statistic: P90, plan: "23" },

  { level: "L1", name: "集全套平均要买几盒", setting: "L1-all", statistic: MEAN, plan: "73.7" },
  { level: "L1", name: "只集常规款平均要买几盒", setting: "L1-regular", statistic: MEAN, plan: "14.9" },
  { level: "L1", name: "只等隐藏款平均要买几盒", setting: "L1-hidden", statistic: MEAN, plan: "72" },

  { level: "L2", name: "买 72 盒还没抽到隐藏款的概率", setting: "L1-hidden", statistic: { kind: "exceeds", draws: 72 }, plan: "36.5%" },
  { level: "L2", name: "一半的人在几盒内抽到隐藏款", setting: "L1-hidden", statistic: MEDIAN, plan: "50" },
  { level: "L2", name: "90% 的人在几盒内抽到隐藏款", setting: "L1-hidden", statistic: P90, plan: "165" },
  { level: "L2", name: "一半的人在几盒内集齐全套", setting: "L1-all", statistic: MEDIAN },
  { level: "L2", name: "90% 的人在几盒内集齐全套", setting: "L1-all", statistic: P90 },

  { level: "L3", name: "每款剩 1 盒，平均要买几盒", setting: "L3-m1", statistic: MEAN, plan: "6" },
  { level: "L3", name: "每款剩 2 盒，平均要买几盒", setting: "L3-m2", statistic: MEAN, plan: "8.57" },
  { level: "L3", name: "每款剩 5 盒，平均要买几盒", setting: "L3-m5", statistic: MEAN, plan: "11.49" },
  { level: "L3", name: "每款剩 10 盒，平均要买几盒", setting: "L3-m10", statistic: MEAN, plan: "12.92" },
  { level: "L3", name: "每款剩 50 盒，平均要买几盒", setting: "L3-m50", statistic: MEAN, plan: "14.31" },

  { level: "L4", name: "72 抽保底，只等隐藏款平均几抽", setting: "L4-hidden-72", statistic: MEAN, plan: "45.7" },
  { level: "L4", name: "72 抽保底，集全套平均几抽", setting: "L4-all-72", statistic: MEAN, plan: "47.4" },
  { level: "L4", name: "36 抽保底，只等隐藏款平均几抽", setting: "L4-hidden-36", statistic: MEAN, plan: "28.5" },

  { level: "L5", name: "两人合买交换、各集一套，一共平均买几盒", setting: "L5-pair", statistic: MEAN, plan: "24.1" },
  { level: "L5", name: "两人合买，一半的情况在几盒内都集齐", setting: "L5-pair", statistic: MEDIAN },
  { level: "L5", name: "两人合买，90% 的情况在几盒内都集齐", setting: "L5-pair", statistic: P90 },
  { level: "L5", name: "只差最后 1 款，继续抽平均还要几盒", setting: "L5-last", statistic: MEAN, plan: "6" },

  { level: "L6", name: "真实 12 款、买 15 盒，平均见到几款", setting: "L6-12-d15", statistic: SEEN, plan: "8.7" },
  { level: "L6", name: "真实 12 款、买 15 盒，Chao1 平均估计几款", setting: "L6-12-d15", statistic: CHAO1, plan: "11.9" },
  { level: "L6", name: "6 款 + 隐藏款 1/72、买 15 盒，平均见到几款", setting: "L6-h7-d15", statistic: SEEN, plan: "5.8" },
  { level: "L6", name: "6 款 + 隐藏款 1/72、买 15 盒，Chao1 平均估计几款", setting: "L6-h7-d15", statistic: CHAO1, plan: "6.2" },
  { level: "L6", name: "6 款 + 隐藏款 1/72、买 60 盒，平均见到几款", setting: "L6-h7-d60", statistic: SEEN, plan: "6.6" },
  { level: "L6", name: "6 款 + 隐藏款 1/72、买 60 盒，Chao1 平均估计几款", setting: "L6-h7-d60", statistic: CHAO1, plan: "6.6" },
  { level: "L6", name: "12 款 + 隐藏款 1/144、买 15 盒，平均见到几款", setting: "L6-h13-d15", statistic: SEEN, plan: "8.8" },
  { level: "L6", name: "12 款 + 隐藏款 1/144、买 15 盒，Chao1 平均估计几款", setting: "L6-h13-d15", statistic: CHAO1, plan: "12.1" },
  { level: "L6", name: "12 款 + 隐藏款 1/144、买 60 盒，平均见到几款", setting: "L6-h13-d60", statistic: SEEN, plan: "12.3" },
  { level: "L6", name: "12 款 + 隐藏款 1/144、买 60 盒，Chao1 平均估计几款", setting: "L6-h13-d60", statistic: CHAO1, plan: "12.4" },
]

export type DerivedUnit = "boxes" | "share"

/** 不单独模拟、由上面几项的值直接算出的数字（两路各算一次）。 */
export interface DerivedSpec {
  readonly level: LevelId
  readonly name: string
  /** 写给读报告的人看的算法。 */
  readonly formula: string
  /** value(编号, 指标) 取那一项的理论值或模拟值。 */
  readonly compute: (value: (setting: string, statistic: Statistic) => number) => number
  readonly unit: DerivedUnit
  readonly plan: string
}

export const DERIVED: readonly DerivedSpec[] = [
  {
    level: "L5",
    name: "两人各自集一套，一共平均买几盒",
    formula: "2 × L0 平均",
    compute: (value) => 2 * value("L0", MEAN),
    unit: "boxes",
    plan: "29.4",
  },
  {
    level: "L5",
    name: "合作比各自集省多少",
    formula: "1 − 两人合买 ÷（2 × L0 平均）",
    compute: (value) => 1 - value("L5-pair", MEAN) / (2 * value("L0", MEAN)),
    unit: "share",
    plan: "17.9%",
  },
]

/** 研究方案 8.4 区赛阶段：Chao1 在不同款数、不同盒数下准不准，用精确值列表。 */
export const ACCURACY_WORLDS: readonly { readonly label: string; readonly params: BlindBoxParams }[] = [
  { label: "6 款等概率", params: ladderL6(6) },
  { label: "12 款等概率", params: ladderL6(12) },
  { label: "24 款等概率", params: ladderL6(24) },
  { label: "6 款常规 + 隐藏款 1/72", params: hiddenWorld7 },
  { label: "12 款常规 + 隐藏款 1/144", params: hiddenWorld13 },
]
export const ACCURACY_DRAWS: readonly number[] = [10, 20, 40, 80]

export type Reference =
  | { readonly label: string; readonly params: BlindBoxParams }
  | { readonly label: string; readonly value: number }

export interface DegeneracySpec {
  readonly level: LevelId
  readonly name: string
  /** 新参数取特殊值后的设置。 */
  readonly setting: string
  readonly statistic: Statistic
  /** 应当退回的上一级：参数（取它的理论值）或已知的数。 */
  readonly reference: Reference
  /** 理论值之间允许的差；“取极大值”这类近似退化要放宽。 */
  readonly tolerance: number
}

export const DEGENERACIES: readonly DegeneracySpec[] = [
  { level: "L1", name: "隐藏款概率取 1/7 → 7 款等概率", setting: "L1-q1of7", statistic: MEAN, reference: { label: "7 款等概率", params: { ...L0_PARAMS, kinds: equalKinds(7) } }, tolerance: TOLERANCE },
  { level: "L1", name: "隐藏款概率取 0、只集常规款 → L0", setting: "L1-q0", statistic: MEAN, reference: { label: "L0", params: ladderL0() }, tolerance: TOLERANCE },
  { level: "L2", name: "没有隐藏款时，一半的人几盒内集齐 → L0", setting: "L1-q0", statistic: MEDIAN, reference: { label: "L0", params: ladderL0() }, tolerance: TOLERANCE },
  { level: "L2", name: "没有隐藏款时，90% 的人几盒内集齐 → L0", setting: "L1-q0", statistic: P90, reference: { label: "L0", params: ladderL0() }, tolerance: TOLERANCE },
  { level: "L3", name: "每款只剩 1 盒 → 正好 6 盒", setting: "L3-m1", statistic: MEAN, reference: { label: "正好 6 盒", value: 6 }, tolerance: TOLERANCE },
  { level: "L3", name: "每款剩 10 000 盒 → 接近 L0（差不超过 0.01）", setting: "L3-m10000", statistic: MEAN, reference: { label: "L0", params: ladderL0() }, tolerance: 0.01 },
  { level: "L4", name: "保底取 10 000 抽 → 回到 L1 集全套", setting: "L4-all-10000", statistic: MEAN, reference: { label: "L1 集全套", params: ladderL1() }, tolerance: 1e-6 },
  { level: "L4", name: "只等隐藏款、保底取 10 000 抽 → 回到 L1 的 72 盒", setting: "L4-hidden-10000", statistic: MEAN, reference: { label: "L1 只等隐藏款", params: ladderL1({ goal: "hidden" }) }, tolerance: 1e-6 },
  { level: "L4", name: "只等隐藏款、保底取 1 抽 → 每次正好 1 抽", setting: "L4-hidden-1", statistic: MEAN, reference: { label: "正好 1 抽", value: 1 }, tolerance: TOLERANCE },
  { level: "L5", name: "合买的人数取 1（一人一套）→ 回到 L0", setting: "L5-p1", statistic: MEAN, reference: { label: "L0", params: ladderL0() }, tolerance: TOLERANCE },
  { level: "L5", name: "只有 1 款、两人各要 1 个 → 正好 2 盒", setting: "L5-k1", statistic: MEAN, reference: { label: "正好 2 盒", value: 2 }, tolerance: TOLERANCE },
  { level: "L6", name: "买得足够多（12 款买 300 盒）→ 见到的就是全部 12 款", setting: "L6-12-d300", statistic: SEEN, reference: { label: "真实款数", value: 12 }, tolerance: 1e-6 },
  { level: "L6", name: "买得足够多 → Chao1 估计等于见到的款数 12", setting: "L6-12-d300", statistic: CHAO1, reference: { label: "真实款数", value: 12 }, tolerance: 1e-6 },
]

export interface SampleEstimate {
  readonly value: number
  /** 平均值、概率的标准误；分位数没有，为 null。 */
  readonly standardError: number | null
  readonly ci95: readonly [number, number]
  /** 判定用的区间（3 倍标准误，或分位数的 99.7% 区间）。 */
  readonly judgeInterval: readonly [number, number]
}

/** 理论值用的方法：买到达成目标的盒数用 theoryDistribution，L6 固定盒数用 unknown-kinds.ts。 */
export type ValidationMethod = TheoryMethod | TheoryNumber["method"]

export interface ComparisonRow extends ComparisonSpec {
  readonly method: ValidationMethod
  readonly theory: number
  readonly simulation: SampleEstimate
  /** 模拟值 − 理论值。 */
  readonly difference: number
  readonly inCi95: boolean
  readonly passed: boolean
  /** 理论值按方案的写法取整后是否和方案一致；方案里没有这个数时为 null。 */
  readonly planMatches: boolean | null
}

export interface DegeneracyRow extends Omit<DegeneracySpec, "reference"> {
  readonly method: ValidationMethod
  readonly specialTheory: number
  readonly referenceLabel: string
  readonly reference: number
  /** 特殊参数的理论值 − 上一级。 */
  readonly theoryDifference: number
  readonly theoryPassed: boolean
  readonly simulation: SampleEstimate
  readonly simulationPassed: boolean
  readonly passed: boolean
}

export interface DerivedRow extends Omit<DerivedSpec, "compute"> {
  /** 用各项的理论值算出。 */
  readonly theory: number
  /** 用各项的模拟值算出，只作对照。 */
  readonly simulation: number
  readonly planMatches: boolean
}

export interface AccuracyRow {
  readonly world: string
  readonly trueKinds: number
  readonly draws: number
  /** 平均见到几款（精确值）。 */
  readonly seen: number
  /** Chao1 平均估计几款（精确值）。 */
  readonly chao1: number
}

export interface ValidationSummary {
  readonly comparisons: number
  readonly comparisonsPassed: number
  readonly inCi95: number
  readonly degeneracies: number
  readonly degeneraciesPassed: number
  readonly planNumbers: number
  readonly planNumbersMatched: number
}

export interface MathValidation {
  readonly runs: number
  readonly seed: number
  readonly settings: readonly { readonly id: string; readonly description: string; readonly file: string }[]
  readonly comparisons: readonly ComparisonRow[]
  readonly degeneracies: readonly DegeneracyRow[]
  readonly derived: readonly DerivedRow[]
  readonly accuracy: readonly AccuracyRow[]
  readonly summary: ValidationSummary
}

export interface ValidationOptions {
  readonly runs?: number
  readonly seed?: number
}

/**
 * 跑全部模拟和理论计算。samples 是原始数据表的每一列：一般设置一列（每轮买了几盒），
 * L6 的设置两列（每轮见到几款、Chao1 估计），列名见 sampleColumn。
 */
export function runMathValidation(options: ValidationOptions = {}): {
  readonly validation: MathValidation
  readonly samples: ReadonlyMap<string, readonly number[]>
} {
  const runs = options.runs ?? DEFAULT_RUNS
  const seed = options.seed ?? DEFAULT_SEED
  const samples = new Map<string, readonly number[]>()
  const distributions = new Map<string, TheoryDistribution>()

  for (const setting of SETTINGS) {
    if (setting.draws === undefined) {
      samples.set(setting.id, simulateModel(setting.params, { runs, seed }).samples)
      distributions.set(setting.id, exactDistribution(setting.params, setting.id))
    } else {
      const fixed = simulateFixedDraws(setting.params, { draws: setting.draws, runs, seed })
      samples.set(sampleColumn(setting.id, SEEN), fixed.samples.observedKinds)
      samples.set(sampleColumn(setting.id, CHAO1), fixed.samples.chao1)
    }
  }
  const settingOf = (id: string) => SETTINGS.find((setting) => setting.id === id) ?? fail(`unknown setting ${id}`)
  const samplesOf = (id: string, statistic: Statistic) =>
    samples.get(sampleColumn(id, statistic)) ?? fail(`no samples for ${id} ${statistic.kind}`)
  const theoryOf = (id: string, statistic: Statistic): { readonly value: number; readonly method: ValidationMethod } => {
    const setting = settingOf(id)
    const distribution = distributions.get(id)
    if (distribution !== undefined) return { value: theoryValue(distribution, statistic), method: distribution.method }
    if (setting.draws === undefined) return fail(`no theory for ${id}`)
    return fixedDrawsTheory(setting.params, setting.draws, statistic, id)
  }

  const comparisons = COMPARISONS.map((spec): ComparisonRow => {
    const { value: theory, method } = theoryOf(spec.setting, spec.statistic)
    const simulation = estimateFromSamples(samplesOf(spec.setting, spec.statistic), spec.statistic)
    return {
      ...spec,
      method,
      theory,
      simulation,
      difference: simulation.value - theory,
      inCi95: within(theory, simulation.ci95, TOLERANCE),
      passed: within(theory, simulation.judgeInterval, TOLERANCE),
      planMatches: spec.plan === undefined ? null : planMatches(spec.plan, theory),
    }
  })

  const degeneracies = DEGENERACIES.map((spec): DegeneracyRow => {
    const { value: specialTheory, method } = theoryOf(spec.setting, spec.statistic)
    const reference =
      "value" in spec.reference
        ? spec.reference.value
        : theoryValue(exactDistribution(spec.reference.params, spec.reference.label), spec.statistic)
    const simulation = estimateFromSamples(samplesOf(spec.setting, spec.statistic), spec.statistic)
    const theoryDifference = specialTheory - reference
    const theoryPassed = Math.abs(theoryDifference) <= spec.tolerance
    const simulationPassed = within(reference, simulation.judgeInterval, spec.tolerance)
    return {
      level: spec.level,
      name: spec.name,
      setting: spec.setting,
      statistic: spec.statistic,
      tolerance: spec.tolerance,
      method,
      specialTheory,
      referenceLabel: spec.reference.label,
      reference,
      theoryDifference,
      theoryPassed,
      simulation,
      simulationPassed,
      passed: theoryPassed && simulationPassed,
    }
  })

  const derived = DERIVED.map(({ compute, ...spec }): DerivedRow => {
    const theory = compute((id, statistic) => theoryOf(id, statistic).value)
    return {
      ...spec,
      theory,
      simulation: compute((id, statistic) => estimateFromSamples(samplesOf(id, statistic), statistic).value),
      planMatches: planMatches(spec.plan, theory),
    }
  })

  const accuracy = ACCURACY_WORLDS.flatMap((world) =>
    ACCURACY_DRAWS.map((draws): AccuracyRow => ({
      world: world.label,
      trueKinds: world.params.kinds.length,
      draws,
      seen: fixedDrawsTheory(world.params, draws, SEEN, world.label).value,
      chao1: fixedDrawsTheory(world.params, draws, CHAO1, world.label).value,
    })),
  )

  const planned = [
    ...comparisons.flatMap((row) => (row.planMatches === null ? [] : [row.planMatches])),
    ...derived.map((row) => row.planMatches),
  ]
  return {
    validation: {
      runs,
      seed,
      settings: SETTINGS.map(({ id, description }) => ({ id, description, file: samplesFile(id) })),
      comparisons,
      degeneracies,
      derived,
      accuracy,
      summary: {
        comparisons: comparisons.length,
        comparisonsPassed: comparisons.filter((row) => row.passed).length,
        inCi95: comparisons.filter((row) => row.inCi95).length,
        degeneracies: degeneracies.length,
        degeneraciesPassed: degeneracies.filter((row) => row.passed).length,
        planNumbers: planned.length,
        planNumbersMatched: planned.filter((matched) => matched).length,
      },
    },
    samples,
  }
}

/** 原始数据表的列名：一般就是设置的编号；L6 的设置分“编号:seen”“编号:chao1”两列。 */
export function sampleColumn(settingId: string, statistic: Statistic): string {
  return statistic.kind === "seen" || statistic.kind === "chao1" ? `${settingId}:${statistic.kind}` : settingId
}

export function theoryValue(distribution: TheoryDistribution, statistic: Statistic): number {
  switch (statistic.kind) {
    case "mean":
      return distribution.mean
    case "quantile":
      return distribution.quantile(statistic.level)
    case "exceeds":
      return distribution.survival(statistic.draws)
    case "seen":
    case "chao1":
      throw new Error(`${statistic.kind} needs a fixed number of draws`)
  }
}

export function estimateFromSamples(samples: readonly number[], statistic: Statistic): SampleEstimate {
  switch (statistic.kind) {
    case "mean":
    case "seen":
    case "chao1": {
      const { mean, standardError, ci95 } = summarizeSample(samples)
      return { value: mean, standardError, ci95, judgeInterval: around(mean, standardError, Z_LIMIT) }
    }
    case "quantile":
      return {
        value: empiricalQuantile(samples, statistic.level),
        standardError: null,
        ci95: quantileInterval(samples, statistic.level, Z_95),
        judgeInterval: quantileInterval(samples, statistic.level, Z_LIMIT),
      }
    case "exceeds": {
      const exceeded = samples.filter((value) => value > statistic.draws).length
      const share = exceeded / samples.length
      const standardError = proportionStandardError(exceeded, samples.length)
      return { value: share, standardError, ci95: around(share, standardError, Z_95), judgeInterval: around(share, standardError, Z_LIMIT) }
    }
  }
}

/** 理论值按方案的写法（小数位数、百分号）取整后和方案比较。 */
export function planMatches(plan: string, theory: number): boolean {
  const percent = plan.endsWith("%")
  const text = percent ? plan.slice(0, -1) : plan
  const decimals = text.includes(".") ? text.length - text.indexOf(".") - 1 : 0
  return (percent ? theory * 100 : theory).toFixed(decimals) === text
}

/** 原始数据表的文件名：按编号开头的级别分文件（L2 没有自己的样本）。 */
export function samplesFile(settingId: string): string {
  return `samples-${settingId.split("-")[0] ?? settingId}.csv`
}

/**
 * 每个文件一张表：第一列轮次，其余每列一个设置，每格是这一轮达成目标时买的盒数；
 * L6 的“编号:seen”“编号:chao1”两列是这一轮见到几款、Chao1 估计几款。
 */
export function samplesTables(samples: ReadonlyMap<string, readonly number[]>): Map<string, string> {
  const byFile = new Map<string, string[]>()
  for (const id of samples.keys()) {
    const file = samplesFile(id)
    byFile.set(file, [...(byFile.get(file) ?? []), id])
  }

  const tables = new Map<string, string>()
  for (const [file, ids] of byFile) {
    const columns = ids.map((id) => samples.get(id) ?? [])
    const runs = Math.max(...columns.map((column) => column.length))
    const rows = Array.from({ length: runs }, (_, run) => [
      String(run + 1),
      ...columns.map((column) => String(column[run] ?? "")),
    ])
    tables.set(file, toCsv([["轮次", ...ids], ...rows]))
  }
  return tables
}

// ---------------------------------------------------------------------------
// 报告

export interface RunMetadata {
  readonly generatedAt: string
  readonly gitCommit: string | null
  /** 生成时已跟踪的文件有没有未提交的改动。 */
  readonly gitDirty: boolean | null
  readonly node: string
  readonly appVersion: string
  /** 原始数据表的 SHA-256。 */
  readonly files: readonly { readonly file: string; readonly sha256: string }[]
}

const METHOD_LABELS: Readonly<Record<ValidationMethod, string>> = {
  "inclusion-exclusion": "容斥原理",
  "hypergeometric-inclusion-exclusion": "不放回抽样的容斥原理",
  "truncated-geometric": "截断几何分布",
  "state-recursion": "按抽数推进的状态概率",
  "observed-kinds-sum": "逐款相加 Σ[1 − (1 − p)^k]",
  "hypergeometric-observed-kinds-sum": "不放回时逐款相加",
  survival: "由 P(T > k) 得到",
  "chao1-enumeration": "按只见过 1 次、2 次的款数精确枚举",
}

const LEVEL_TITLES: Readonly<Record<LevelId, string>> = {
  L0: "L0 理想模型（参照）",
  L1: "L1 隐藏款：等概率被打破",
  L2: "L2 只看平均数够吗（L1 的分布）",
  L3: "L3 库存有限：有放回被打破",
  L4: "L4 保底：独立被打破",
  L5: "L5 交换与二手：目标被改变",
  L6: "L6 不知道一共几款：反问题",
}

export function renderReport(validation: MathValidation, meta: RunMetadata): string {
  const { summary } = validation
  const allPassed =
    summary.comparisonsPassed === summary.comparisons &&
    summary.degeneraciesPassed === summary.degeneracies &&
    summary.planNumbersMatched === summary.planNumbers
  const yesNo = (value: boolean) => (value ? "是" : "**否**")
  const verdict = (value: boolean) => (value ? "通过" : "**未通过**")
  const lines: string[] = [
    "# 数学验证结果（研究方案 8.1）",
    "",
    `> 由 \`mathlab/\` 下的 \`npm run validate:math\` 生成，不要手改。说明见同目录的 README.md。`,
    `> 每个设置模拟 ${validation.runs.toLocaleString("en-US").replaceAll(",", " ")} 轮，随机种子 ${validation.seed}；` +
      `生成于 ${meta.generatedAt}；代码版本 ${meta.gitCommit ?? "未知"}${meta.gitDirty === true ? "（有未提交的改动）" : ""}；` +
      `Node.js ${meta.node}，实验室 ${meta.appVersion}。`,
    "",
    "## 结论",
    "",
    `- 双路验证 ${summary.comparisons} 项，通过 ${summary.comparisonsPassed} 项；理论值落在模拟值 95% 区间内的有 ${summary.inCi95} 项。`,
    `- 退化检验 ${summary.degeneracies} 项，通过 ${summary.degeneraciesPassed} 项。`,
    `- 方案正文中的数字 ${summary.planNumbers} 个，与程序算出的理论值一致的有 ${summary.planNumbersMatched} 个。`,
    `- ${allPassed ? "全部通过。" : "**有未通过的项，见下表。**"}`,
    "",
    "判定标准：平均值和概率，理论值与模拟值之差不超过 3 倍标准误（约 99.7%）；分位数，理论值落在样本次序统计量给出的 99.7% 区间内。" +
      "95% 区间本来就有约 1/20 的机会不含真值，所以只报告、不拿它判定。",
    "",
    "## 一、双路验证：理论值与模拟值",
    "",
  ]

  for (const level of Object.keys(LEVEL_TITLES) as LevelId[]) {
    const rows = validation.comparisons.filter((row) => row.level === level)
    if (rows.length === 0) continue
    lines.push(
      `### ${LEVEL_TITLES[level]}`,
      "",
      "| 项目 | 理论值 | 理论方法 | 模拟值 | 模拟 − 理论 | 模拟值 95% 区间 | 理论值在区间内 | 判定 | 方案中的数字 |",
      "|---|---:|---|---:|---:|---|:---:|:---:|---|",
      ...rows.map((row) =>
        [
          row.name,
          formatValue(row.theory, row.statistic),
          METHOD_LABELS[row.method],
          formatValue(row.simulation.value, row.statistic),
          formatDifference(row.difference, row.statistic),
          formatInterval(row.simulation.ci95, row.statistic),
          yesNo(row.inCi95),
          verdict(row.passed),
          row.plan === undefined ? "—" : `${row.plan}（${row.planMatches === true ? "一致" : "**不一致**"}）`,
        ].join(" | "),
      ).map((cells) => `| ${cells} |`),
      "",
    )
  }

  lines.push(
    "## 二、退化检验",
    "",
    "新参数取特殊值时，必须退回上一级的结果。理论值和模拟值两条路都要退回去。",
    "",
    "| 级别 | 检验 | 特殊参数的理论值 | 应当退回 | 理论差 | 特殊参数的模拟值 | 模拟值 95% 区间 | 判定 |",
    "|---|---|---:|---:|---:|---:|---|:---:|",
    ...validation.degeneracies.map((row) =>
      `| ${[
        row.level,
        row.name,
        formatValue(row.specialTheory, row.statistic),
        `${formatValue(row.reference, row.statistic)}（${row.referenceLabel}）`,
        formatScientific(row.theoryDifference),
        formatValue(row.simulation.value, row.statistic),
        formatInterval(row.simulation.ci95, row.statistic),
        verdict(row.passed),
      ].join(" | ")} |`,
    ),
    "",
    "## 三、由上面的值推出的数字",
    "",
    "这些数字不单独模拟，由上面几项的值直接算出；用理论值算一次，用模拟值再算一次作对照。",
    "",
    "| 级别 | 项目 | 算法 | 由理论值 | 由模拟值 | 方案中的数字 |",
    "|---|---|---|---:|---:|---|",
    ...validation.derived.map((row) =>
      `| ${[
        row.level,
        row.name,
        row.formula,
        formatDerived(row.theory, row.unit),
        formatDerived(row.simulation, row.unit),
        `${row.plan}（${row.planMatches ? "一致" : "**不一致**"}）`,
      ].join(" | ")} |`,
    ),
    "",
    "## 四、Chao1 准不准（研究方案 8.4 区赛阶段）",
    "",
    "例子世界的真实款数程序知道。表中是精确值：平均见到几款按 Σ[1 − (1 − p)^k] 计算，Chao1 的平均估计按“只见过 1 次、2 次的款数”精确枚举。" +
      "两种算法都已在第一节 L6 用模拟验证。偏差 = Chao1 平均估计 − 真实款数，负数表示估少了。",
    "",
    "| 例子世界 | 真实款数 | 买几盒 | 平均见到 | Chao1 平均估计 | 偏差 |",
    "|---|---:|---:|---:|---:|---:|",
    ...validation.accuracy.map((row) =>
      `| ${[
        row.world,
        row.trueKinds,
        row.draws,
        row.seen.toFixed(2),
        row.chao1.toFixed(2),
        formatDifference(row.chao1 - row.trueKinds, { kind: "chao1" }),
      ].join(" | ")} |`,
    ),
    "",
    "## 五、模拟设置与原始数据",
    "",
    "原始数据表每列是一个设置，每行是一轮：这一轮达成目标时一共买了几盒。用 Excel 或 WPS 打开，对一列求平均就是上面的模拟值。" +
      "L6 的设置每轮固定买几盒，有两列：“编号:seen”是这一轮见到几款，“编号:chao1”是这一轮的 Chao1 估计。",
    "",
    "| 编号 | 设置 | 文件 |",
    "|---|---|---|",
    ...validation.settings.map((setting) => `| ${setting.id} | ${setting.description} | ${setting.file} |`),
    "",
    "| 文件 | SHA-256 |",
    "|---|---|",
    ...meta.files.map((file) => `| ${file.file} | \`${file.sha256}\` |`),
    "",
  )

  return lines.join("\n")
}

function formatValue(value: number, statistic: Statistic): string {
  switch (statistic.kind) {
    case "mean":
    case "seen":
    case "chao1":
      return value.toFixed(3)
    case "quantile":
      return String(value)
    case "exceeds":
      return `${(value * 100).toFixed(2)}%`
  }
}

function formatDifference(value: number, statistic: Statistic): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±"
  const magnitude = Math.abs(value)
  switch (statistic.kind) {
    case "mean":
    case "seen":
    case "chao1":
      return `${sign}${magnitude.toFixed(3)}`
    case "quantile":
      return `${sign}${magnitude}`
    case "exceeds":
      return `${sign}${(magnitude * 100).toFixed(2)} 个百分点`
  }
}

function formatDerived(value: number, unit: DerivedUnit): string {
  return unit === "share" ? `${(value * 100).toFixed(2)}%` : value.toFixed(3)
}

function formatInterval(interval: readonly [number, number], statistic: Statistic): string {
  return `[${formatValue(interval[0], statistic)}, ${formatValue(interval[1], statistic)}]`
}

function formatScientific(value: number): string {
  if (value === 0) return "0"
  const magnitude = Math.abs(value)
  return `${value > 0 ? "+" : "−"}${magnitude < 0.001 ? magnitude.toExponential(1) : magnitude.toFixed(4)}`
}

// ---------------------------------------------------------------------------
// 小工具

function exactDistribution(params: BlindBoxParams, label: string): TheoryDistribution {
  const distribution = theoryDistribution(params)
  if (!distribution.available) throw new Error(`${label} has no theory: ${distribution.message}`)
  return distribution
}

/** L6：固定买 draws 盒时平均见到几款、Chao1 平均估计几款的精确值。 */
function fixedDrawsTheory(
  params: BlindBoxParams,
  draws: number,
  statistic: Statistic,
  label: string,
): { readonly value: number; readonly method: ValidationMethod } {
  let result: TheoryNumber | NoTheory
  if (statistic.kind === "seen") result = expectedObservedKinds(params, draws)
  else if (statistic.kind === "chao1") result = expectedChao1(params, draws)
  else throw new Error(`${label}: ${statistic.kind} is not a fixed-draws statistic`)
  if (!result.available) throw new Error(`${label} has no theory: ${result.message}`)
  return { value: result.value, method: result.method }
}

function around(center: number, standardError: number, z: number): [number, number] {
  return [center - z * standardError, center + z * standardError]
}

function within(value: number, interval: readonly [number, number], tolerance: number): boolean {
  return value >= interval[0] - tolerance && value <= interval[1] + tolerance
}

function fail(message: string): never {
  throw new Error(message)
}
