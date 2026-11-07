// 建模阶梯 L0–L6（研究方案 6.2–6.8、7.6）：每一级的情境、猜想、要找的假设、实验台上
// 可调的参数、理论要点和退化检验。数字一律由通用盲盒模型计算，这里不写死结果；
// 隐藏款 1/72、保底 72 盒、L5 的单价和转卖价是示例参数，真实参数要按具体系列的官方公示核实。

import {
  DEFAULT_REGULAR_KINDS,
  equalKinds,
  expectedChao1,
  expectedObservedKinds,
  formatNumber,
  formatPercent,
  formatProbability,
  lastKindDecision,
  ladderL0,
  ladderL1,
  ladderL3,
  ladderL4,
  ladderL5,
  ladderL6,
  prepareFreeCondition,
  theory,
  theoryDistribution,
  type BlindBoxParams,
  type FreeConditionSetup,
  type ParameterChanges,
} from "../../../core/blindbox"
import type { AssumptionId } from "../../../lib/translator-client"
import type { LearningTheoryFormula } from "../../../shared/learning/types"

export type LadderLevelId = "L0" | "L1" | "L2" | "L3" | "L4" | "L5" | "L6"

export const LADDER_STEPS = [
  { id: "parameters", label: "设置参数" },
  { id: "situation", label: "情境" },
  { id: "guess", label: "猜想" },
  { id: "assumption", label: "找假设" },
  { id: "experiment", label: "做实验" },
  { id: "theory", label: "看理论" },
  { id: "check", label: "做检验" },
] as const

export type LadderStepId = (typeof LADDER_STEPS)[number]["id"]

/** L1、L2、L4 的目标：集全套、只集常规款、只等隐藏款。 */
export type HiddenTarget = "all" | "regular" | "hidden"

/** 实验台上可以调的参数；每一级只用到其中几项。 */
export interface LadderControls {
  /** L0：一共几款（等概率）。L6：例子世界有几款常规款（等概率）。 */
  readonly kinds: number
  /** L1、L2、L4、L6：隐藏款每盒的概率是 1/hiddenDenominator；L6 里 0 表示没有隐藏款。 */
  readonly hiddenDenominator: number
  readonly target: HiddenTarget
  /** L2：买几盒。L6：每轮固定买几盒。 */
  readonly withinDraws: number
  /** L3：每款库存几盒。 */
  readonly perKind: number
  /** L4：连续 pityWithin − 1 盒没出隐藏款，第 pityWithin 盒一定是隐藏款。 */
  readonly pityWithin: number
  /** L5：几个人合买、重复款互相交换，每人要一套。 */
  readonly players: number
}

export type ControlSpec =
  | {
      readonly key: "kinds" | "withinDraws" | "perKind" | "pityWithin" | "players"
      readonly kind: "range"
      readonly label: string
      readonly min: number
      readonly max: number
      readonly unit: string
      /** 揭晓之前不显示当前值（L6 的真实款数要等学生找完假设再揭晓）。 */
      readonly secret?: boolean
    }
  | {
      readonly key: "hiddenDenominator"
      readonly kind: "fraction"
      readonly label: string
      /** 分母；0 表示不加隐藏款（只用于 L6）。 */
      readonly options: readonly number[]
    }
  | {
      readonly key: "target"
      readonly kind: "target"
      readonly label: string
      readonly options: readonly { readonly value: HiddenTarget; readonly label: string }[]
    }

export type AnswerUnit = "盒" | "款" | "%"

export interface LevelAnswer {
  readonly label: string
  /** 单位是 % 时写成百分数（0–100）。 */
  readonly value: number
  readonly unit: AnswerUnit
}

export interface LadderLevel {
  readonly id: LadderLevelId
  readonly title: string
  readonly subtitle: string
  /** 这一级打破的假设；L0 是理想模型，不打破。 */
  readonly breaks: AssumptionId | null
  readonly situation: {
    readonly recap?: string
    readonly story: readonly string[]
    readonly question: string
    readonly note?: string
    /** note 只在默认参数下才对（比如“和一款真实盲盒一样”）；参数改了就不显示。 */
    readonly noteOnlyAtDefaults?: boolean
  }
  readonly guess: {
    readonly prompt: string
    readonly unit: AnswerUnit
    readonly min: number
    readonly max: number
    readonly hint: string
  }
  /** 参数不是默认值时，猜想的题面、提示和范围跟着“设置参数”里定下的参数走；没写的项用 guess 里的。 */
  readonly guessFor?: (controls: LadderControls) => Partial<LadderLevel["guess"]>
  readonly assumption:
    | { readonly kind: "list" }
    | {
        readonly kind: "pick"
        readonly answer: AssumptionId
        readonly explanation: string
        /** 容易选成的另一条，以及为什么不是它。 */
        readonly nearMiss?: { readonly id: AssumptionId; readonly note: string }
      }
  readonly parametersIntro: string
  /** “做实验”一步的说明；不写时按“平均要买几盒”说明。 */
  readonly experimentIntro?: string
  readonly controls: readonly ControlSpec[]
  readonly defaults: LadderControls
  readonly theory: {
    readonly ideas: readonly string[]
    readonly formula?: LearningTheoryFormula
  }
  readonly degeneracy: {
    readonly prompt: string
    readonly unit: AnswerUnit
    readonly apply: Partial<LadderControls>
    readonly explanation: string
  }
}

/** 建模阶梯里学生可以改的常规款数：默认 6 款，上限 12 款（正好是有神兽图的款数，精确计算也都算得动）。 */
export const DEFAULT_KINDS = DEFAULT_REGULAR_KINDS
export const MAX_KINDS = 12

/** 款数必须是 1–MAX_KINDS 的整数，不是就退回默认的 6 款（读回旧记录时用）。 */
export function sanitizeKinds(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_KINDS ? value : DEFAULT_KINDS
}

/** 各级实验台参数的起点；kinds 是 L0–L5 共用的款数（L6 的 kinds 是例子世界的真实款数，另有默认值）。 */
function defaultsFor(kinds: number): LadderControls {
  return { kinds, hiddenDenominator: 72, target: "all", withinDraws: 72, perKind: 2, pityWithin: 72, players: 2 }
}

/** L5 停手规则的示例价格（元）：每盒单价、重复款转卖能收回的钱。 */
export const EXAMPLE_BOX_PRICE = 60
export const EXAMPLE_RESALE = 30

/** L6 情境里的样本：买了 15 盒，见到 9 款，其中只见过 1 次的 5 款、2 次的 2 款（另 2 款各 3 次）。 */
export const L6_SAMPLE = { draws: 15, observed: 9, singletons: 5, doubletons: 2 } as const

const L6_SITUATION = {
  story: [
    "有的系列厂家不公布一共有几款。",
    "你已经买了 15 盒，见到 9 款：其中 5 款只见过 1 次，2 款见过 2 次，还有 2 款各见过 3 次。",
  ],
  question: "这个系列一共大约有几款？",
} as const

/**
 * L0 找假设：12 句话里哪几句是理想模型默认的条件（6 句是，6 句不是）。
 * 记录里存的是这里的下标，所以已有的句子位置不能动，新句子只往后加；屏幕上的先后顺序见 L0_STATEMENT_ORDER。
 */
export function l0AssumptionStatements(kinds: number): readonly { readonly text: string; readonly assumption: AssumptionId | null }[] {
  return [
    { text: `${kinds} 款被抽到的机会都一样`, assumption: "A1" },
    { text: "店员会帮你挑出还没有的款", assumption: null },
    { text: "只关心平均要买几盒", assumption: "A2" },
    { text: "店里的货永远买不完", assumption: "A3" },
    { text: "盲盒越买越便宜", assumption: null },
    { text: "这一盒是什么，不影响下一盒是什么", assumption: "A4" },
    { text: "自己一个人集齐一套，不和别人交换", assumption: "A5" },
    { text: `事先知道一共有 ${kinds} 款`, assumption: "A6" },
    { text: `买够 ${kinds} 盒，就一定能集齐`, assumption: null },
    { text: "连着几盒没抽到新款，下一盒就更容易抽到", assumption: null },
    { text: "买到重复的款，可以拿去店里换一盒新的", assumption: null },
    { text: "盒子摇一摇、掂一掂，就能猜出里面是哪一款", assumption: null },
  ]
}

/** 找假设的 12 句话在屏幕上的先后顺序（l0AssumptionStatements 的下标）：是和不是的句子穿插着排。 */
export const L0_STATEMENT_ORDER: readonly number[] = [0, 8, 1, 2, 9, 3, 4, 10, 5, 6, 11, 7]

const oneDecimal = (value: number): string => formatNumber(Math.round(value * 10) / 10)

/**
 * 各级的文字和参数。L0–L5 共用一个款数 kinds（学生在实验台上改，每一级都沿用），
 * 凡是写着款数、盒数、平均值的地方都按它现算；kinds = 6 时和研究方案 6.1 的总览表一致。
 */
function buildLevels(kinds: number): readonly LadderLevel[] {
  const n = kinds
  const withHidden = n + 1
  const defaults = defaultsFor(n)
  const hiddenDefaults: LadderControls = { ...defaults, target: "hidden" }
  const l6Defaults: LadderControls = { ...defaults, kinds: 12, withinDraws: 15, hiddenDenominator: 0 }
  const l0Mean = meanOf(ladderL0(n))
  const allMean = meanOf(ladderL1({ regularKinds: n, goal: "all" }))
  const equalMean = meanOf(ladderL0(withHidden))
  const situation = (id: LadderLevelId, controls: LadderControls) => describeSituation(id, controls)
  const kindsControl = (label: string): ControlSpec => ({ key: "kinds", kind: "range", label, min: 1, max: MAX_KINDS, unit: "款" })
  const allLabel = `集全套 ${withHidden} 款`

  return [
    {
      id: "L0",
      title: "理想模型",
      subtitle: `${n} 款等概率`,
      breaks: null,
      situation: situation("L0", defaults),
      guess: {
        prompt: `平均要买几盒才能集齐 ${n} 款？`,
        unit: "盒",
        min: 1,
        max: 200,
        hint: `先凭感觉写一个数。最少要 ${n} 盒；运气不好时会重复很多次。`,
      },
      assumption: { kind: "list" },
      parametersIntro: `理想模型里只有一个参数：一共几款（每款机会一样），现在是 ${n} 款。在右边的实验台上拖动滑块定下款数；后面的每一步都用这个设定，L1–L5 也沿用这个款数。`,
      controls: [kindsControl("一共几款（等概率）")],
      defaults,
      theory: {
        ideas: [
          `把“集齐 ${n} 款”拆成 ${n} 段：已经有 k 款时，下一盒是新款的概率是 (${n}−k)/${n}，平均要等 ${n}/(${n}−k) 盒。`,
          `${n} 段的平均等待加起来，就是集齐一套的平均盒数。越接近集齐越难等：最后一款平均要等 ${n} 盒。`,
          "详细的推导在“互动学习”里。",
        ],
        formula: {
          plain: "E[T] = n/n + n/(n−1) + … + n/1 = n(1 + 1/2 + … + 1/n)",
          latex: "E[T]=\\frac{n}{n}+\\frac{n}{n-1}+\\cdots+\\frac{n}{1}=n\\left(1+\\frac12+\\cdots+\\frac1n\\right)",
        },
      },
      degeneracy: {
        prompt: "如果这个系列只有 1 款，平均要买几盒？",
        unit: "盒",
        apply: { kinds: 1 },
        explanation: "只有 1 款时，第一盒就集齐了。公式 n(1 + 1/2 + … + 1/n) 在 n = 1 时正好等于 1。",
      },
    },
    {
      id: "L1",
      title: "隐藏款",
      subtitle: "等概率被打破",
      breaks: "A1",
      situation: {
        recap: `上一级（L0）：${n} 款等概率，平均 ${oneDecimal(l0Mean)} 盒。`,
        ...situation("L1", defaults),
        ...(n === DEFAULT_KINDS
          ? { note: "这组参数和一款真实盲盒一样：它的包装上写着 6 款常规款每款 1/6、隐藏款 1/72。不同系列不一样，要看具体系列的公示。", noteOnlyAtDefaults: true }
          : {}),
      },
      guess: {
        prompt: "只多了 1 款，集齐全套平均大约要买几盒？",
        unit: "盒",
        min: 1,
        max: 1000,
        hint: `上一级 ${n} 款等概率是 ${oneDecimal(l0Mean)} 盒。`,
      },
      guessFor: ({ target, hiddenDenominator }) =>
        target === "regular"
          ? { prompt: `不要隐藏款，只集 ${n} 款常规款，平均大约要买几盒？`, hint: "隐藏款不用等，但它会占掉一部分盒子。" }
          : target === "hidden"
            ? { prompt: `只等隐藏款（每盒 1/${hiddenDenominator}），平均大约要买几盒？`, hint: "隐藏款越难抽，要等的盒数越多。" }
            : {},
      assumption: {
        kind: "pick",
        answer: "A1",
        explanation: "隐藏款比常规款难抽得多，“每款概率相同”不再成立。其余假设都没变：货还是买不完，每次互不影响，一个人集一套。",
      },
      parametersIntro: "这一级多了一款隐藏款。在右边的实验台上定下：常规款几款、隐藏款每盒的概率，以及目标（集全套、只集常规款、只等隐藏款）。后面的每一步都用这些设定。",
      controls: [
        kindsControl("常规款几款（不含隐藏款）"),
        { key: "hiddenDenominator", kind: "fraction", label: "隐藏款每盒的概率", options: [withHidden, 36, 72, 144] },
        {
          key: "target",
          kind: "target",
          label: "目标",
          options: [
            { value: "all", label: allLabel },
            { value: "regular", label: "只集常规款" },
            { value: "hidden", label: "只等隐藏款" },
          ],
        },
      ],
      defaults,
      theory: {
        ideas: [
          `用“已经集到几款常规款、隐藏款到手没有”描述进度，一共 ${withHidden} × 2 = ${withHidden * 2} 个状态。`,
          "从“全部集齐”往回推：每个状态只要解一个一元一次方程，就能算出从这里出发平均还要几盒，用电子表格就能完成。",
          "程序用容斥原理算出同一个精确值，可以拿来核对你的递推结果。",
        ],
        formula: {
          plain: "E(状态) = 1 + Σ P(下一盒到达那个状态) × E(那个状态)",
          latex: "E_s=1+\\sum_{s'}P(s\\to s')\\,E_{s'}",
        },
      },
      degeneracy: {
        prompt: `把隐藏款的概率调成 1/${withHidden}、目标集全套：${withHidden} 款的概率都一样了，平均要买几盒？`,
        unit: "盒",
        apply: { hiddenDenominator: withHidden, target: "all" },
        explanation: `这时 ${withHidden} 款等概率，应当和把 L0 的方法用到 ${withHidden} 款上一样：${withHidden} × (1 + 1/2 + … + 1/${withHidden}) = ${formatNumber(equalMean)} 盒。`,
      },
    },
    {
      id: "L2",
      title: "只看平均数够吗",
      subtitle: "看分布，不只看平均",
      breaks: "A2",
      situation: {
        recap: `上一级（L1）：单独等隐藏款平均要 72 盒，集全套 ${oneDecimal(allMean)} 盒。`,
        ...situation("L2", hiddenDefaults),
      },
      guess: {
        prompt: "买 72 盒还没抽到隐藏款的概率，大约是百分之几？",
        unit: "%",
        min: 0,
        max: 100,
        hint: "如果平均数就能说明问题，这个概率应该很小。",
      },
      guessFor: ({ target, withinDraws }) => ({
        prompt: `买 ${withinDraws} 盒还没${target === "all" ? `集齐全套 ${withHidden} 款` : "抽到隐藏款"}的概率，大约是百分之几？`,
      }),
      assumption: {
        kind: "pick",
        answer: "A2",
        explanation: "模型本身没变，变的是问题：只看平均数，看不出“特别倒霉”的可能。所以要看分布：k 盒内抽到的概率，一半的人、90% 的人分别要几盒。",
      },
      parametersIntro: "这一级问的是“买了这么多盒，还没达成目标的概率有多大”。在右边的实验台上定下：常规款几款、买几盒、隐藏款每盒的概率，以及目标。后面的每一步都用这些设定。",
      controls: [
        kindsControl("常规款几款（不含隐藏款）"),
        { key: "withinDraws", kind: "range", label: "买几盒", min: 1, max: 300, unit: "盒" },
        { key: "hiddenDenominator", kind: "fraction", label: "隐藏款每盒的概率", options: [36, 72, 144] },
        {
          key: "target",
          kind: "target",
          label: "目标",
          options: [
            { value: "hidden", label: "只等隐藏款" },
            { value: "all", label: allLabel },
          ],
        },
      ],
      defaults: hiddenDefaults,
      theory: {
        ideas: [
          "“k 盒都没出隐藏款”就是每一盒都不是隐藏款。每盒不是隐藏款的概率是 1 − q，各盒互不影响，所以概率是 (1 − q) 的 k 次方。",
          "72 盒都没出隐藏款的概率是 (71/72) 的 72 次方：平均 72 盒，并不等于买 72 盒就稳了。",
          "让“抽到的概率”第一次达到 50%、90% 的盒数，就是一半的人、90% 的人在多少盒内抽到。集全套时没有这么简单的式子，程序用容斥原理精确计算。",
        ],
        formula: {
          plain: "P(买 k 盒还没抽到隐藏款) = (1 − q)^k",
          latex: "P(T>k)=(1-q)^k",
        },
      },
      degeneracy: {
        prompt: "如果只买 1 盒，还没抽到隐藏款的概率是百分之几？",
        unit: "%",
        apply: { withinDraws: 1, target: "hidden" },
        explanation: "(1 − q) 的 k 次方在 k = 1 时就是 1 − q。隐藏款概率 1/72 时是 71/72，约 98.61%。",
      },
    },
    {
      id: "L3",
      title: "库存有限",
      subtitle: "有放回被打破",
      breaks: "A3",
      situation: {
        recap: `回到 ${n} 款等概率（L0：货买不完时平均 ${oneDecimal(l0Mean)} 盒），这一级只改“货”这一条。`,
        ...situation("L3", defaults),
      },
      guess: {
        prompt: "每款只剩 2 盒，平均要买几盒才能集齐？",
        unit: "盒",
        min: n,
        max: 2 * n,
        hint: `最少 ${n} 盒，最多把 ${2 * n} 盒全买下来。`,
      },
      guessFor: ({ perKind }) => ({
        prompt: `每款只剩 ${perKind} 盒，平均要买几盒才能集齐？`,
        max: perKind * n,
        hint: `最少 ${n} 盒，最多把 ${perKind * n} 盒全买下来。`,
      }),
      assumption: {
        kind: "pick",
        answer: "A3",
        explanation: "货不再无限：每买走一盒，剩下各款的比例就变了，下一盒是哪一款的概率跟着变。",
        nearMiss: {
          id: "A4",
          note: "库存有限时，前后几盒确实不再互不影响；但原因是“货无限多”这一条被打破了。A4 说的是保底这类规则让购买互相影响，留到 L4 研究。",
        },
      },
      parametersIntro: "这一级店里的货是有限的。在右边的实验台上定下：一共几款、每款库存几盒。后面的每一步都用这些设定。",
      controls: [
        kindsControl("一共几款（等概率）"),
        { key: "perKind", kind: "range", label: "每款库存", min: 1, max: 50, unit: "盒" },
      ],
      defaults,
      theory: {
        ideas: [
          "每买走一盒，剩下各款的比例就变了：这是不放回抽样，不能再看成每一盒都“重新掷一次骰子”。",
          "每款 1 盒、2 盒的小情形可以用条件概率手算；一般情形由程序用不放回抽样的容斥原理精确计算，再用模拟验证。",
          `库存越多，结果越接近货无限时的 ${oneDecimal(l0Mean)} 盒。`,
        ],
      },
      degeneracy: {
        prompt: `如果每款只剩 1 盒（一共 ${n} 盒），要买几盒才能集齐？`,
        unit: "盒",
        apply: { perKind: 1 },
        explanation: `店里只剩 ${n} 盒、每款 1 盒，全买下来正好集齐，一盒都不会重复。这就是“端盒”能保证集齐的道理。`,
      },
    },
    {
      id: "L4",
      title: "保底",
      subtitle: "独立被打破",
      breaks: "A4",
      situation: {
        recap: `回到 L1 的示例：${n} 款常规 + 1 款隐藏款（1/72）。没有保底时，只等隐藏款平均 72 盒；L2 发现买 72 盒还没抽到的概率有 36.5%。`,
        ...situation("L4", hiddenDefaults),
        note: "72 盒保底是示例参数，真实的保底规则要看具体平台的公示。",
      },
      guess: {
        prompt: "有了 72 盒保底，抽到隐藏款平均大约要买几盒？",
        unit: "盒",
        min: 1,
        max: 72,
        hint: "没有保底时平均 72 盒；有了保底，最多也只要买 72 盒。",
      },
      guessFor: ({ target, pityWithin, hiddenDenominator }) =>
        target === "all"
          ? { prompt: `有了 ${pityWithin} 盒保底，集齐全套 ${withHidden} 款平均大约要买几盒？`, max: 1000, hint: "保底让隐藏款不会拖太久，常规款还是要一款一款地凑。" }
          : {
              prompt: `有了 ${pityWithin} 盒保底，抽到隐藏款平均大约要买几盒？`,
              max: pityWithin,
              hint: `没有保底时平均 ${hiddenDenominator} 盒；有了保底，最多也只要买 ${pityWithin} 盒。`,
            },
      assumption: {
        kind: "pick",
        answer: "A4",
        explanation: "有了保底，这一盒是不是隐藏款，要看前面已经连续几盒没出：连续没出到保底的前一盒，下一盒就一定是隐藏款。前面买到什么会影响后面，“每次购买互不影响”不再成立。货还是买不完，没碰到保底时每盒是隐藏款的概率也还是原来的那个。",
        nearMiss: {
          id: "A1",
          note: "保底让某一盒“一定是隐藏款”，看起来像是概率变了；但各款概率不同，在 L1 已经研究过。这里新出现的是：下一盒的概率跟着前面买到了什么而变，所以打破的是 A4。",
        },
      },
      parametersIntro: "这一级有保底规则。在右边的实验台上定下：常规款几款、保底（几盒之内必出隐藏款）、隐藏款每盒的概率，以及目标。后面的每一步都用这些设定。",
      controls: [
        kindsControl("常规款几款（不含隐藏款）"),
        { key: "pityWithin", kind: "range", label: "保底：几盒之内必出隐藏款", min: 2, max: 300, unit: "盒" },
        { key: "hiddenDenominator", kind: "fraction", label: "隐藏款每盒的概率", options: [36, 72, 144] },
        {
          key: "target",
          kind: "target",
          label: "目标",
          options: [
            { value: "hidden", label: "只等隐藏款" },
            { value: "all", label: allLabel },
          ],
        },
      ],
      defaults: hiddenDefaults,
      theory: {
        ideas: [
          "从第 1 盒到第 72 盒，把“买这一盒之前还没抽到隐藏款”的概率一项一项加起来，就是平均盒数。为什么可以这样加？每买一盒，盒数就加 1，前提是买这一盒时还没抽到。",
          "没到保底时，前 k 盒都不是隐藏款的概率仍是 (71/72) 的 k 次方，所以第 k 盒的那一项是 (71/72) 的 k − 1 次方；第 72 盒一定抽到，后面的项都是 0。用电子表格逐项相加就行。",
          "这 72 项是等比数列，用求和公式可以一步算出（拓展）。集全套时，保底和集常规款同时进行，程序按“集到几款常规款、隐藏款已经连续几盒没出”逐盒推进，精确计算。",
        ],
        formula: {
          plain: "E[T] = 1 + (1 − q) + (1 − q)² + … + (1 − q)^(N−1) = [1 − (1 − q)^N] / q",
          latex: "E[T]=1+(1-q)+(1-q)^2+\\cdots+(1-q)^{N-1}=\\frac{1-(1-q)^N}{q}",
        },
      },
      degeneracy: {
        prompt: "把保底调成 10 000 盒（几乎永远碰不到），只等隐藏款（1/72）平均要买几盒？",
        unit: "盒",
        apply: { pityWithin: 10_000, hiddenDenominator: 72, target: "hidden" },
        explanation: `保底几乎碰不到，就和没有保底一样，应当回到 L1 的结果：只等隐藏款平均 1 ÷ (1/72) = 72 盒。式子里 (71/72) 的 10 000 次方小到可以忽略，[1 − (1 − q)^N] / q 就变成 1/q。把目标换成集全套，也会回到 L1 的 ${formatNumber(allMean)} 盒。`,
      },
    },
    {
      id: "L5",
      title: "交换与二手",
      subtitle: "目标被改变",
      breaks: "A5",
      situation: {
        recap: `回到 ${n} 款等概率（L0：一个人集一套平均 ${oneDecimal(l0Mean)} 盒），这一级只改“目标”这一条。`,
        ...situation("L5", defaults),
        note: "目标一变，问题也跟着变：只差最后一款时，是继续抽，还是去二手市场买？这个“停手规则”在“看理论”里讨论。",
      },
      guess: {
        prompt: "两个人合买交换、各集一套，一共平均大约要买几盒？",
        unit: "盒",
        min: 2 * n,
        max: 1000,
        hint: `两个人各自集，一共要 2 × ${formatNumber(l0Mean)} = ${formatNumber(2 * l0Mean)} 盒；合作最少也要 ${2 * n} 盒。`,
      },
      guessFor: ({ players }) =>
        players <= 1
          ? { prompt: "一个人集一套，平均要买几盒？", min: n, max: 1000, hint: `最少要 ${n} 盒。` }
          : {
              prompt: `${players === 2 ? "两" : players}个人合买交换、各集一套，一共平均大约要买几盒？`,
              min: players * n,
              max: 1000,
              hint: `${players === 2 ? "两个" : `${players} 个`}人各自集，一共要 ${players} × ${formatNumber(l0Mean)} = ${formatNumber(players * l0Mean)} 盒；合作最少也要 ${players * n} 盒。`,
            },
      assumption: {
        kind: "pick",
        answer: "A5",
        explanation: "目标变了：不再是“自己一个人集齐一套”，而是两个人合起来集两套、重复款互相交换。每一盒是哪一款，还是和 L0 一样等概率、互不影响，货也还是买不完。",
        nearMiss: {
          id: "A4",
          note: "两个人的盒子放在一起交换，看起来像“互相影响”；但每一盒抽到哪一款仍然和前面买到的无关，A4 没有变。变的是要集几套、几个人一起集（A5）。",
        },
      },
      parametersIntro: "这一级是几个人合买、重复款互相交换、每人要一套。在右边的实验台上定下：一共几款、几个人合买。后面的每一步都用这些设定。",
      controls: [
        kindsControl("一共几款（等概率）"),
        { key: "players", kind: "range", label: "几个人合买（每人要一套）", min: 1, max: 6, unit: "人" },
      ],
      defaults,
      theory: {
        ideas: [
          "两个人合买、重复款互相交换：第一套多出来的重复款，正好用来凑第二套，所以两套用不了两倍的盒数。",
          `用“已经有 0 个、1 个、2 个（够了）的款各有几款”描述进度，${n} 款一共 ${((n + 1) * (n + 2)) / 2} 个状态。和 L1 一样从“全部集齐”往回推，每个状态解一个一元一次方程。程序按盒数逐步推进这些状态的概率，精确计算。`,
          "“集齐几套”是一个经典问题（Newman 和 Shepp，1960 年）。",
          `停手规则：只差最后 1 款时，下一盒正好是它的概率是 1/${n}，平均还要 ${n} 盒，其中 ${n - 1} 盒是重复款。设每盒 p 元、重复款转卖能收回 v 元，继续抽平均要花 ${n}p − ${n - 1}v 元；二手市场上这一款比它便宜，就该停手去买二手。`,
        ],
        formula: {
          plain: `只差概率为 q 的一款时，继续抽的平均花费 = p × (1/q) − v × (1/q − 1)；${n} 款等概率时 = ${n}p − ${n - 1}v`,
          latex: `p\\cdot\\frac1q-v\\left(\\frac1q-1\\right)\\;\\xrightarrow{q=\\frac${n < 10 ? `1${n}` : `{1}{${n}}`}}\\;${n}p-${n - 1}v`,
        },
      },
      degeneracy: {
        prompt: "把合买的人数改成 1（一个人集一套），平均要买几盒？",
        unit: "盒",
        apply: { players: 1 },
        explanation: `只有一个人时，没有人可以交换，目标又回到“自己一个人集齐一套”，应当退回 L0：${n} × (1 + 1/2 + … + 1/${n}) = ${oneDecimal(l0Mean)} 盒。`,
      },
    },
    {
      id: "L6",
      title: "不知道一共几款",
      subtitle: "反问题",
      breaks: "A6",
      situation: {
        recap: "前面各级都默认知道一共有几款，所以能问“集齐要买几盒”。",
        story: L6_SITUATION.story,
        question: L6_SITUATION.question,
        note: "实验台上有一个“例子世界”，它真实有几款，程序知道；锁定猜想之后才揭晓。",
      },
      guess: {
        prompt: "买 15 盒见到 9 款，你估计这个系列一共大约有几款？",
        unit: "款",
        min: 9,
        max: 100,
        hint: "至少有 9 款，因为已经见到了 9 款。还有 5 款只见过 1 次——这说明什么？",
      },
      assumption: {
        kind: "pick",
        answer: "A6",
        explanation: "前面各级都知道一共几款。现在连一共几款都不知道，问题反过来了：要从买到的结果推测一共几款，这叫反问题。每一盒还是等概率、互不影响，货也买不完。",
        nearMiss: {
          id: "A1",
          note: "见到的款有的出现 3 次、有的只出现 1 次，看起来像各款概率不同；但在例子世界里各款机会一样，次数不同只是运气。变的是“知道一共几款”这一条（A6）。",
        },
      },
      parametersIntro: "这一级的情境是固定的：买 15 盒，见到 9 款。实验台上的“例子世界”真实有几款，程序知道，先保密；找完假设之后揭晓，到时候可以在实验台上自己调着试。",
      experimentIntro: "实验台每一轮在例子世界里买几盒，数一数见到几款，再用 Chao1 估计一共几款。点“开始实验”，看看 Chao1 的平均估计和你的猜想、和真实款数各差多少。",
      controls: [
        { key: "kinds", kind: "range", label: "例子世界：常规款几款（每款机会一样）", min: 2, max: 20, unit: "款", secret: true },
        { key: "withinDraws", kind: "range", label: "每轮买几盒", min: 1, max: 300, unit: "盒" },
        { key: "hiddenDenominator", kind: "fraction", label: "再加 1 款隐藏款，每盒的概率", options: [0, 72, 144] },
      ],
      defaults: l6Defaults,
      theory: {
        ideas: [
          "买 k 盒，某一款一次都没见到的概率是 (1 − p) 的 k 次方，所以平均见到的款数是 Σ[1 − (1 − p)^k]。见到的款数总比真实的少，只数见到几款会估少。",
          "只见过 1 次的款越多，说明还有没见过的款。生态学家调查物种时用 Chao1 估计：总数 ≈ 见到的款数 + f1(f1 − 1) / [2(f2 + 1)]，f1、f2 是只见过 1 次、2 次的款数。",
          "Chao1 给出的是“至少有几款”的估计（Gotelli 和 Chao，2013 年）。它靠只见过 1 次的款推测没见到的款；一次都没出现的稀有款不留下任何信号，所以估不出隐藏款。",
          "程序把所有抽法按“只见过 1 次、2 次的各有几款”分类，按概率精确相加，算出 Chao1 的平均估计，再用模拟验证。",
        ],
        formula: {
          plain: "Chao1 = 见到的款数 + f1(f1 − 1) / [2(f2 + 1)]",
          latex: "\\hat S_{\\text{Chao1}}=S_{\\text{见到}}+\\frac{f_1(f_1-1)}{2(f_2+1)}",
        },
      },
      degeneracy: {
        prompt: "例子世界取 12 款、不加隐藏款，每轮买 300 盒：每款都见过很多次了，Chao1 平均估计几款？",
        unit: "款",
        apply: { kinds: 12, withinDraws: 300, hiddenDenominator: 0 },
        explanation: "买得足够多时，每一款都见过好几次，只见过 1 次的款数 f1 = 0，Chao1 = 见到的款数 + 0。这时见到的就是全部 12 款，估计正好等于真实款数。",
      },
    },
  ]
}

const LEVEL_CACHE = new Map<number, readonly LadderLevel[]>()

/** 款数为 kinds（L0–L5 共用）时的全部各级；同一个款数只生成一次。 */
export function ladderLevels(kinds: number = DEFAULT_KINDS): readonly LadderLevel[] {
  const count = sanitizeKinds(kinds)
  const cached = LEVEL_CACHE.get(count)
  if (cached !== undefined) return cached
  const built = buildLevels(count)
  LEVEL_CACHE.set(count, built)
  return built
}

export function ladderLevel(id: LadderLevelId, kinds: number = DEFAULT_KINDS): LadderLevel {
  const level = ladderLevels(kinds).find((item) => item.id === id)
  if (!level) throw new Error(`Unknown ladder level: ${id}`)
  return level
}

export interface LevelModel {
  readonly params: BlindBoxParams
  /**
   * 用翻译器 parameterChanges 的写法描述这一级改了什么，三道检验据此配置。L6 只写
   * “不知道一共几款、买了几盒”，不写例子世界的款数，免得回读时提前揭晓。
   */
  readonly changes: ParameterChanges
  /** L2 问的“买几盒”；其余各级为 null。 */
  readonly withinDraws: number | null
  /** L6 每轮固定买几盒；其余各级为 null。 */
  readonly fixedDraws: number | null
}

export function levelModel(id: LadderLevelId, controls: LadderControls): LevelModel {
  const hiddenKinds = {
    ordinary: controls.kinds,
    special: [{ count: 1, probability: `1/${controls.hiddenDenominator}`, hidden: true }],
  }
  // L3、L5 在 L0 的基础上改，L0 是 6 款；款数不是 6 时要把款数也写进去，回读和三道检验才对得上。
  const kindsChange: Pick<ParameterChanges, "kinds"> =
    controls.kinds === DEFAULT_KINDS ? {} : { kinds: { total: controls.kinds } }
  switch (id) {
    case "L0":
      return {
        params: ladderL0(controls.kinds),
        changes: { kinds: { total: controls.kinds } },
        withinDraws: null,
        fixedDraws: null,
      }
    case "L1":
      return {
        params: ladderL1({ hiddenProbability: 1 / controls.hiddenDenominator, goal: controls.target, regularKinds: controls.kinds }),
        changes: { kinds: hiddenKinds, ...(controls.target === "all" ? {} : { goal: { kinds: controls.target } }) },
        withinDraws: null,
        fixedDraws: null,
      }
    case "L2": {
      const target = controls.target === "regular" ? "all" : controls.target
      return {
        params: ladderL1({ hiddenProbability: 1 / controls.hiddenDenominator, goal: target, regularKinds: controls.kinds }),
        changes: {
          kinds: hiddenKinds,
          ...(target === "hidden" ? { goal: { kinds: "hidden" } } : {}),
          question: { withinDraws: controls.withinDraws },
        },
        withinDraws: controls.withinDraws,
        fixedDraws: null,
      }
    }
    case "L3":
      return {
        params: ladderL3(controls.perKind, controls.kinds),
        changes: { ...kindsChange, stock: { perKind: controls.perKind } },
        withinDraws: null,
        fixedDraws: null,
      }
    case "L4": {
      const target = controls.target === "regular" ? "hidden" : controls.target
      return {
        params: ladderL4({
          within: controls.pityWithin,
          hiddenProbability: 1 / controls.hiddenDenominator,
          goal: target,
          regularKinds: controls.kinds,
        }),
        changes: {
          kinds: hiddenKinds,
          pity: { target: "hidden", within: controls.pityWithin },
          ...(target === "hidden" ? { goal: { kinds: "hidden" } } : {}),
        },
        withinDraws: null,
        fixedDraws: null,
      }
    }
    case "L5":
      return {
        params: ladderL5({ players: controls.players, kindCount: controls.kinds }),
        changes: { ...kindsChange, goal: { sets: controls.players, players: controls.players } },
        withinDraws: null,
        fixedDraws: null,
      }
    case "L6":
      return {
        params: l6World(controls),
        changes: { kindsKnown: { known: false, draws: controls.withinDraws } },
        withinDraws: null,
        fixedDraws: controls.withinDraws,
      }
  }
}

function l6World(controls: LadderControls): BlindBoxParams {
  return controls.hiddenDenominator > 0
    ? ladderL6(controls.kinds, { hiddenProbability: 1 / controls.hiddenDenominator })
    : ladderL6(controls.kinds)
}

/** 这一级的问题由程序算出的答案（理论值）。 */
export function levelAnswer(id: LadderLevelId, controls: LadderControls): LevelAnswer {
  const { params, withinDraws, fixedDraws } = levelModel(id, controls)
  if (fixedDraws !== null) {
    return { label: `例子世界买 ${fixedDraws} 盒，Chao1 平均估计一共几款`, value: chao1Of(params, fixedDraws), unit: "款" }
  }
  if (id === "L5" && controls.players > 1) {
    return { label: `${controls.players} 个人合买交换、每人一套，一共平均要买几盒`, value: meanOf(params), unit: "盒" }
  }
  if (withinDraws !== null) {
    const distribution = theoryDistribution(params)
    if (!distribution.available) throw new Error(distribution.message)
    return {
      label: `买 ${withinDraws} 盒还没${goalWord(id, controls)}的概率`,
      value: distribution.survival(withinDraws) * 100,
      unit: "%",
    }
  }
  return { label: `平均要买几盒才能${goalWord(id, controls)}`, value: meanOf(params), unit: "盒" }
}

/** 三道检验用的设置：和“自由提条件”走同一条路。 */
export function levelSetup(id: LadderLevelId, controls: LadderControls): FreeConditionSetup {
  const prepared = prepareFreeCondition(levelModel(id, controls).changes)
  if (!prepared.ok) throw new Error(prepared.issues.join(", "))
  return prepared
}

/** 看理论时的要点：用当前参数算出的具体数字。 */
export function levelInsight(id: LadderLevelId, controls: LadderControls): string {
  switch (id) {
    case "L0": {
      const n = controls.kinds
      const mean = meanOf(levelModel("L0", controls).params)
      const baseline = n === DEFAULT_KINDS ? "前身项目 350 轮实验平均 14.68 盒，和理论值只差 0.02。" : ""
      return `${n} 款时平均 ${formatNumber(mean)} 盒。${baseline}已经有 ${n - 1} 款时，最后一款平均还要等 ${n} 盒。`
    }
    case "L1": {
      const q = 1 / controls.hiddenDenominator
      const all = meanOf(ladderL1({ hiddenProbability: q, goal: "all", regularKinds: controls.kinds }))
      const regular = meanOf(ladderL1({ hiddenProbability: q, goal: "regular", regularKinds: controls.kinds }))
      return (
        `隐藏款概率 1/${controls.hiddenDenominator} 时：单独等隐藏款平均 ${formatNumber(1 / q)} 盒，` +
        `集全套 ${formatNumber(all)} 盒，只集常规款 ${formatNumber(regular)} 盒。` +
        "隐藏款很稀有时，集全套的成本几乎全花在等隐藏款上——一个稀有款决定了整套的成本，这叫“瓶颈效应”。"
      )
    }
    case "L2": {
      const { params, withinDraws } = levelModel("L2", controls)
      const distribution = theoryDistribution(params)
      if (!distribution.available) return distribution.message
      const goal = goalWord("L2", controls)
      return (
        `买 ${withinDraws} 盒还没${goal}的概率是 ${formatPercent(distribution.survival(withinDraws ?? 0))}。` +
        `平均 ${formatNumber(distribution.mean)} 盒，但一半的人在 ${distribution.quantile(0.5)} 盒内${goal}，` +
        `90% 的人要 ${distribution.quantile(0.9)} 盒——最倒霉的 10% 超过 ${distribution.quantile(0.9)} 盒。平均数说明不了这么大的差别。`
      )
    }
    case "L3": {
      const m = controls.perKind
      const mean = meanOf(ladderL3(m, controls.kinds))
      const unlimited = meanOf(ladderL0(controls.kinds))
      const at50 = meanOf(ladderL3(50, controls.kinds))
      return (
        `每款 ${m} 盒（一共 ${controls.kinds * m} 盒）：平均 ${formatNumber(mean)} 盒，比货无限时的 ${formatNumber(unlimited)} 盒少 ` +
        `${formatPercent((unlimited - mean) / unlimited)}。每款 50 盒时只差 ${formatPercent((unlimited - at50) / unlimited)}：` +
        "库存足够多时，“货无限多”这条假设可以放心用。"
      )
    }
    case "L4": {
      const n = controls.pityWithin
      const q = 1 / controls.hiddenDenominator
      const regularKinds = controls.kinds
      const hidden = theoryDistribution(ladderL4({ within: n, hiddenProbability: q, goal: "hidden", regularKinds }))
      if (!hidden.available) return hidden.message
      const all = meanOf(ladderL4({ within: n, hiddenProbability: q, goal: "all", regularKinds }))
      const allWithout = meanOf(ladderL1({ hiddenProbability: q, goal: "all", regularKinds }))
      return (
        `保底 ${n} 盒、隐藏款概率 1/${controls.hiddenDenominator}：只等隐藏款平均 ${formatNumber(hidden.mean)} 盒，` +
        `比没有保底时的 ${formatNumber(1 / q)} 盒少 ${formatPercent(1 - hidden.mean * q)}；` +
        `集全套 ${formatNumber(all)} 盒（没有保底时 ${formatNumber(allWithout)} 盒）。` +
        `前 ${n - 1} 盒都没抽到隐藏款的人占 ${formatProbability(hidden.survival(n - 1))}，他们都在第 ${n} 盒被保底接住，不会再更倒霉。` +
        "保底越小，省得越多；保底远远大于 1/q 时几乎碰不到，和没有保底差不多。"
      )
    }
    case "L5": {
      const n = controls.players
      const kindCount = controls.kinds
      const alone = meanOf(ladderL0(kindCount))
      const together = meanOf(ladderL5({ players: n, kindCount }))
      const team =
        n === 1
          ? `一个人集一套平均 ${formatNumber(alone)} 盒，没有人可以交换。`
          : `${n} 个人合买：一共平均 ${formatNumber(together)} 盒，每人 ${formatNumber(together / n)} 盒；` +
            `各自集一共要 ${formatNumber(alone * n)} 盒，合作省 ${formatPercent(1 - together / (alone * n))}。`
      const prices = { box: EXAMPLE_BOX_PRICE, resale: EXAMPLE_RESALE }
      const last = lastKindDecision({ ...ladderL0(kindCount), prices }, equalKinds(kindCount).at(-1)?.id ?? "A")
      const hidden = lastKindDecision({ ...ladderL1({ regularKinds: kindCount }), prices }, "hidden")
      if (!last.available || !hidden.available) return team
      return (
        `${team}人越多，重复款越容易派上用场，每人越省。` +
        `停手规则：例如每盒 ${EXAMPLE_BOX_PRICE} 元、重复款转卖收回 ${EXAMPLE_RESALE} 元，只差最后 1 款时继续抽平均还要 ` +
        `${formatNumber(last.expectedDraws)} 盒、花 ${formatNumber(last.continueCost)} 元，二手价低于它就该停手；` +
        `缺的是隐藏款（1/72）时，平均还要 ${formatNumber(hidden.expectedDraws)} 盒、花 ${formatNumber(hidden.continueCost)} 元。`
      )
    }
    case "L6": {
      const draws = controls.withinDraws
      const world = l6World(controls)
      const total = world.kinds.length
      const seen = expectedObservedKinds(world, draws)
      const estimate = chao1Of(world, draws)
      const { observed, singletons, doubletons } = L6_SAMPLE
      const sample = observed + (singletons * (singletons - 1)) / (2 * (doubletons + 1))
      const worldText =
        controls.hiddenDenominator > 0
          ? `例子世界真实 ${total} 款（${controls.kinds} 款常规 + 1 款隐藏款 1/${controls.hiddenDenominator}）`
          : `例子世界真实 ${total} 款、每款机会一样`
      const hiddenText =
        controls.hiddenDenominator > 0
          ? `Chao1 平均估计 ${formatNumber(estimate)} 款，比真实少 ${formatNumber(total - estimate)} 款：没出现的隐藏款不留下任何信号。`
          : `Chao1 平均估计 ${formatNumber(estimate)} 款，接近真实的 ${total} 款。试试在实验台上加一款隐藏款：Chao1 还能估出来吗？`
      return (
        `情境里的样本：见到 ${observed} 款，f1 = ${singletons}，f2 = ${doubletons}，` +
        `Chao1 = ${observed} + ${singletons}×${singletons - 1} ÷ (2×${doubletons + 1}) = ${formatNumber(sample)} 款。` +
        `${worldText}，买 ${draws} 盒平均只见到 ${seen.available ? formatNumber(seen.value) : "—"} 款；${hiddenText}`
      )
    }
  }
}

export function goalWord(id: LadderLevelId, controls: LadderControls): string {
  if (id === "L5" && controls.players > 1) return `集齐 ${controls.players} 套`
  if (id !== "L1" && id !== "L2" && id !== "L4") return "集齐"
  if (controls.target === "hidden") return "抽到隐藏款"
  if (controls.target === "regular" && id === "L1") return "集齐常规款"
  return "集齐全套"
}

/**
 * “情境”一步的故事和问题：数字跟着实验台上现在的参数走（默认参数下和 LADDER_LEVELS 里写的一字不差）。
 * L0–L5 的 controls.kinds 是共用的款数；L6 的真实款数要等学生猜完再揭晓，所以不随参数变。
 */
export function describeSituation(
  id: LadderLevelId,
  controls: LadderControls,
): { readonly story: readonly string[]; readonly question: string } {
  const { kinds, hiddenDenominator: denominator, withinDraws, perKind, pityWithin, players, target } = controls
  const allKinds = `集齐全套 ${kinds + 1} 款`
  switch (id) {
    case "L0":
      return {
        story: [`一个盲盒系列有 ${kinds} 款，每一盒是哪一款，机会都一样。`, `你一盒一盒地买，直到 ${kinds} 款都集齐为止。`],
        question: "平均要买几盒才能集齐？",
      }
    case "L1":
      return {
        story: [
          "真实的盲盒系列常常还有一款隐藏款。",
          `假设 ${kinds} 款常规款之外，还有 1 款隐藏款：每一盒是隐藏款的概率是 1/${denominator}，其余的概率由 ${kinds} 款常规款平分。`,
        ],
        question: `${target === "all" ? allKinds : target === "regular" ? `只集 ${kinds} 款常规款` : "只等隐藏款"}，平均要买几盒？`,
      }
    case "L2":
      return {
        story: [
          target === "all"
            ? `小明听说“隐藏款平均 ${denominator} 盒才抽到”，心想：那我准备买 ${withinDraws} 盒，应该能集齐全套了吧？`
            : `小明听说“平均 ${denominator} 盒抽到隐藏款”，心想：那我准备买 ${withinDraws} 盒，应该就稳了吧？`,
        ],
        question: `买 ${withinDraws} 盒，还是没${target === "all" ? allKinds : "抽到隐藏款"}的概率有多大？`,
      }
    case "L3":
      return {
        story: [`店里这个系列只剩 ${kinds * perKind} 盒了，每款正好 ${perKind} 盒。`, "你打算一盒一盒地买，直到集齐为止。"],
        question: "平均要买几盒才能集齐？",
      }
    case "L4":
      return {
        story: [
          `假设一个线上抽盒规定“${pityWithin} 盒之内必出隐藏款”：连续 ${pityWithin - 1} 盒都没出隐藏款，第 ${pityWithin} 盒一定是隐藏款；每出一次隐藏款，重新从 0 数。`,
          `没碰到保底的时候，每一盒是隐藏款的概率还是 1/${denominator}。`,
        ],
        question: `有了 ${pityWithin} 盒保底，${target === "all" ? allKinds : "抽到隐藏款"}平均要买几盒？`,
      }
    case "L5": {
      if (players <= 1) {
        return { story: [`你想集齐这 ${kinds} 款。`, "你一个人一盒一盒地买，直到集齐为止。"], question: "平均要买几盒才能集齐？" }
      }
      const group = players === 2 ? "两个人" : `${players} 个人`
      return {
        story: [
          players === 2 ? `你和好朋友都想集齐这 ${kinds} 款。` : `你和 ${players - 1} 个好朋友都想集齐这 ${kinds} 款。`,
          `${group}合起来买、重复的款互相交换，直到${players === 2 ? "两人" : `${players} 人`}各有一套为止。`,
        ],
        question: `${group}一共平均要买几盒？比各自集省多少？`,
      }
    }
    case "L6":
      return { story: L6_SITUATION.story, question: L6_SITUATION.question }
  }
}

function meanOf(params: BlindBoxParams): number {
  const result = theory(params)
  if (!result.available) throw new Error(result.message)
  return result.mean
}

function chao1Of(params: BlindBoxParams, draws: number): number {
  const result = expectedChao1(params, draws)
  if (!result.available) throw new Error(result.message)
  return result.value
}

/** 款数为默认的 6 款时的各级，和研究方案 6.1 的总览表一致。 */
export const LADDER_LEVELS: readonly LadderLevel[] = ladderLevels(DEFAULT_KINDS)

/** 按“设置参数”里定下的参数，算出猜想这一步的题面、提示和范围。 */
export function guessSpec(level: LadderLevel, controls: LadderControls): LadderLevel["guess"] {
  return { ...level.guess, ...level.guessFor?.(controls) }
}
