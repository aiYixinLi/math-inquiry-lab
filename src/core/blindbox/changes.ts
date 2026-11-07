// 条件翻译器输出的 parameterChanges 的格式（研究方案 7.4），以及把它严格地
// 合并到某一级参数上的解析器。格式里每个字段的含义都唯一，缺字段、占位词
// （如 "未知"）、多余字段一律报问题代码，不猜；翻译器据此拒收，改为追问。
//
// 概率一律写成字符串，保留学生原来的写法："1/72"、"5%"、"0.05"（全角也可以）。
// 价格、盒数、款数一律写成数字。
//
// kinds（A1）用 total 或 ordinary 二选一说清楚“特殊款算不算在里面”：
//   {"total": 6, "special": [{"count": 1, "probability": "5%", "hidden": false}]}
//     一共 6 款，其中 1 款特别少（5%），其余 5 款平分剩下的概率；
//   {"ordinary": 6, "special": [{"count": 1, "probability": "1/72", "hidden": true}]}
//     6 款普通款之外，另有 1 款隐藏款（1/72），一共 7 款；
//   {"total": 8}
//     一共 8 款，等概率。
// special 里每一项三个字段都必须有：count 有几款，probability 其中每一款的概率，
// hidden 是不是隐藏款。学生没说概率时不能翻译 kinds，要追问。

import {
  BlindBoxParamError,
  parseProbability,
  validateParams,
  type BlindBoxParams,
  type KindParam,
} from "./params"

export interface SpecialKindsChange {
  /** 这样的款有几款。 */
  readonly count: number
  /** 其中每一款的概率（字符串）。 */
  readonly probability: string
  /** 是不是隐藏款。保底写 "hidden"、只集常规款，都靠这个标记。 */
  readonly hidden: boolean
}

export interface KindsChange {
  /** 一共几款，包括 special 里的款。和 ordinary 二选一。 */
  readonly total?: number
  /** 普通款几款，不包括 special 里的款（special 另外加上）。和 total 二选一。 */
  readonly ordinary?: number
  /** 概率和普通款不同的款。省略表示所有款等概率。 */
  readonly special?: readonly SpecialKindsChange[]
}

export type StockChange =
  | "unlimited"
  | { readonly perKind?: number; readonly total?: number }

export interface PityChange {
  /** "hidden"（恰好一款隐藏款时）或款的编号。 */
  readonly target: string
  readonly within: number
}

export interface GoalChange {
  /** "all" 全部，"regular" 不含隐藏款，"hidden" 只要隐藏款。 */
  readonly kinds?: "all" | "regular" | "hidden"
  readonly sets?: number
  /** 写了 players 就必须同时写 sets（每人一套还是合起来一套要说清楚）。 */
  readonly players?: number
}

export interface PricesChange {
  readonly box: number
  readonly resale?: number
  readonly secondHand?: number
}

/** A6：false，或者带上学生给出的样本（“买了 15 盒，见到 9 款”）。 */
export type KindsKnownChange =
  | false
  | { readonly known: false; readonly draws: number; readonly observedKinds?: number }

/** A2：不问平均，而问“k 盒内达成的概率”或“几成把握要几盒”。 */
export type QuestionChange =
  | { readonly withinDraws: number }
  | { readonly confidence: string }

export interface ParameterChanges {
  readonly kinds?: KindsChange
  readonly stock?: StockChange
  readonly pity?: PityChange
  readonly goal?: GoalChange
  readonly prices?: PricesChange
  readonly kindsKnown?: KindsKnownChange
  readonly question?: QuestionChange
}

/** 合并之后要回答的问题。 */
export type Question =
  | { readonly kind: "mean" }
  /** P(T ≤ draws)：买 draws 盒就达成目标的概率。 */
  | { readonly kind: "within-draws"; readonly draws: number }
  /** 最小的 k，使 P(T ≤ k) ≥ level。 */
  | { readonly kind: "confidence"; readonly level: number }
  /** 反问题：买了 draws 盒（见到 observedKinds 款），一共几款。 */
  | {
      readonly kind: "unknown-kinds"
      readonly draws: number | null
      readonly observedKinds: number | null
    }

export type ChangesOutcome =
  | { readonly ok: true; readonly params: BlindBoxParams; readonly question: Question }
  | { readonly ok: false; readonly issues: readonly string[] }

/** 翻译器提示词可以直接引用的标准写法，测试保证它们在 level 那一级上都能解析。 */
export const PARAMETER_CHANGE_EXAMPLES: readonly {
  readonly condition: string
  /** 这个例子合并到哪一级上：保底 "hidden" 需要先有隐藏款（L1）。 */
  readonly level: "L0" | "L1"
  readonly changes: ParameterChanges
}[] = [
  {
    condition: "这个系列 6 款常规款之外还有 1 款隐藏款，概率 1/72",
    level: "L0",
    changes: { kinds: { ordinary: 6, special: [{ count: 1, probability: "1/72", hidden: true }] } },
  },
  {
    condition: "一共 6 款，其中有一款特别少，只有 5% 的概率",
    level: "L0",
    changes: { kinds: { total: 6, special: [{ count: 1, probability: "5%", hidden: false }] } },
  },
  { condition: "这个系列一共 8 款", level: "L0", changes: { kinds: { total: 8 } } },
  { condition: "店里只剩 12 盒了，每款 2 盒", level: "L0", changes: { stock: { total: 12, perKind: 2 } } },
  { condition: "72 抽之内一定出隐藏款", level: "L1", changes: { pity: { target: "hidden", within: 72 } } },
  { condition: "我和同桌合买，每人都想集齐一套", level: "L0", changes: { goal: { sets: 2, players: 2 } } },
  { condition: "我只想要常规款", level: "L1", changes: { goal: { kinds: "regular" } } },
  { condition: "一盒 59 元，重复的能卖 20 元", level: "L0", changes: { prices: { box: 59, resale: 20 } } },
  { condition: "厂家没有公布一共几款", level: "L0", changes: { kindsKnown: false } },
  {
    condition: "买了 15 盒，见到 9 款，一共有几款",
    level: "L0",
    changes: { kindsKnown: { known: false, draws: 15, observedKinds: 9 } },
  },
  { condition: "买 72 盒能集齐的概率有多大", level: "L0", changes: { question: { withinDraws: 72 } } },
  { condition: "要买多少盒才有 90% 的把握集齐", level: "L0", changes: { question: { confidence: "90%" } } },
]

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const PROBABILITY_TEXT = /^\s*\d+(?:\.\d+)?\s*(?:\/\s*\d+(?:\.\d+)?|%)?\s*$/u

/**
 * 把翻译结果合并到 base（实验室当前所在的那一级）上。改了 kinds 就整体替换款的列表；
 * 其余字段只改写出来的部分。最后再用 validateParams 检查合并后的模型能不能计算。
 */
export function applyParameterChanges(base: BlindBoxParams, changes: unknown): ChangesOutcome {
  const issues: string[] = []
  if (!isRecord(changes)) return { ok: false, issues: ["changes-not-object"] }
  rejectUnknownFields(changes, ["kinds", "stock", "pity", "goal", "prices", "kindsKnown", "question"], "", issues)

  let params: BlindBoxParams = base
  let question: Question = { kind: "mean" }

  if ("kinds" in changes) {
    const kinds = parseKinds(changes.kinds, issues)
    if (kinds !== null) params = { ...params, kinds }
  }
  if ("stock" in changes) {
    const stock = parseStock(changes.stock, issues)
    if (stock !== null) params = { ...params, stock }
  }
  if ("goal" in changes) {
    params = parseGoal(changes.goal, params, issues)
  }
  if ("pity" in changes) {
    const pity = parsePity(changes.pity, params.kinds, issues)
    if (pity !== null) params = { ...params, pity }
  }
  if ("prices" in changes) {
    const prices = parsePrices(changes.prices, issues)
    if (prices !== null) params = { ...params, prices }
  }
  if ("kindsKnown" in changes) {
    const parsed = parseKindsKnown(changes.kindsKnown, issues)
    if (parsed !== null) {
      params = { ...params, kindsKnown: false }
      question = parsed
    }
  }
  if ("question" in changes) {
    const parsed = parseQuestion(changes.question, issues)
    if (parsed !== null) question = parsed
  }

  if (issues.length > 0) return { ok: false, issues }
  const modelIssues = validateParams(params).map((issue) => `model:${issue}`)
  return modelIssues.length > 0 ? { ok: false, issues: modelIssues } : { ok: true, params, question }
}

/** 同 applyParameterChanges，有问题时抛出 BlindBoxParamError。 */
export function applyParameterChangesOrThrow(
  base: BlindBoxParams,
  changes: unknown,
): { readonly params: BlindBoxParams; readonly question: Question } {
  const outcome = applyParameterChanges(base, changes)
  if (!outcome.ok) throw new BlindBoxParamError(outcome.issues)
  return { params: outcome.params, question: outcome.question }
}

/**
 * ordinary 款普通款平分剩下的概率，再加上 special 中的各款。
 * 编号：非隐藏款依次 A、B、C……（超过 26 款时 K1、K2……）；隐藏款只有一款时为
 * "hidden"，多款时为 "hidden1"、"hidden2"……
 */
export function buildKinds(
  ordinary: number,
  special: readonly { readonly count: number; readonly probability: number; readonly hidden: boolean }[],
): KindParam[] {
  const specialShare = special.reduce((sum, group) => sum + group.count * group.probability, 0)
  const ordinaryProbability = ordinary > 0 ? (1 - specialShare) / ordinary : 0
  const visibleCount = ordinary + special.filter((group) => !group.hidden).reduce((sum, group) => sum + group.count, 0)
  const hiddenCount = special.filter((group) => group.hidden).reduce((sum, group) => sum + group.count, 0)
  let visible = 0
  let hidden = 0
  const visibleId = () => {
    visible += 1
    return visibleCount <= LETTERS.length ? LETTERS.charAt(visible - 1) : `K${visible}`
  }
  const hiddenId = () => {
    hidden += 1
    return hiddenCount === 1 ? "hidden" : `hidden${hidden}`
  }

  const kinds: KindParam[] = Array.from({ length: ordinary }, () => ({
    id: visibleId(),
    probability: ordinaryProbability,
  }))
  for (const group of special) {
    for (let index = 0; index < group.count; index += 1) {
      kinds.push(
        group.hidden
          ? { id: hiddenId(), probability: group.probability, hidden: true }
          : { id: visibleId(), probability: group.probability },
      )
    }
  }
  return kinds
}

function parseKinds(value: unknown, issues: string[]): KindParam[] | null {
  if (!isRecord(value)) return fail(issues, "invalid:kinds")
  const before = issues.length
  rejectUnknownFields(value, ["total", "ordinary", "special"], "kinds.", issues)

  const hasTotal = "total" in value
  const hasOrdinary = "ordinary" in value
  if (hasTotal && hasOrdinary) return fail(issues, "kinds.total-and-ordinary")
  if (!hasTotal && !hasOrdinary) return fail(issues, "missing:kinds.total-or-ordinary")

  const specialValue = "special" in value ? value.special : []
  if (!Array.isArray(specialValue)) return fail(issues, "invalid:kinds.special")
  const special: { count: number; probability: number; hidden: boolean }[] = []
  specialValue.forEach((group: unknown, index) => {
    const path = `kinds.special[${index}]`
    if (!isRecord(group)) {
      issues.push(`invalid:${path}`)
      return
    }
    rejectUnknownFields(group, ["count", "probability", "hidden"], `${path}.`, issues)
    const count = requireInteger(group, "count", `${path}.count`, 1, issues)
    const probability = requireProbability(group, "probability", `${path}.probability`, issues)
    if (!("hidden" in group)) issues.push(`missing:${path}.hidden`)
    else if (typeof group.hidden !== "boolean") issues.push(`invalid:${path}.hidden`)
    if (probability !== null && (probability === 0 || probability === 1)) {
      issues.push(`invalid-probability:${path}.probability`)
    }
    if (count !== null && probability !== null && typeof group.hidden === "boolean") {
      special.push({ count, probability, hidden: group.hidden })
    }
  })
  const specialCount = special.reduce((sum, group) => sum + group.count, 0)

  let ordinary: number | null
  if (hasTotal) {
    const total = requireInteger(value, "total", "kinds.total", 1, issues)
    ordinary = total === null ? null : total - specialCount
    if (ordinary !== null && ordinary < 0) return fail(issues, "kinds.total-less-than-special")
  } else {
    ordinary = requireInteger(value, "ordinary", "kinds.ordinary", 0, issues)
  }
  if (ordinary === null || issues.length > before) return null

  const specialShare = special.reduce((sum, group) => sum + group.count * group.probability, 0)
  if (ordinary > 0 && specialShare >= 1) return fail(issues, "kinds.special-probability-too-large")
  if (ordinary === 0 && Math.abs(specialShare - 1) > 1e-9) return fail(issues, "kinds.probabilities-do-not-sum-to-1")
  if (ordinary + specialCount === 0) return fail(issues, "kinds.empty")
  return buildKinds(ordinary, special)
}

function parseStock(value: unknown, issues: string[]): BlindBoxParams["stock"] | null {
  if (value === "unlimited") return "unlimited"
  if (!isRecord(value)) return fail(issues, "invalid:stock")
  rejectUnknownFields(value, ["perKind", "total"], "stock.", issues)
  if (!("perKind" in value) && !("total" in value)) return fail(issues, "missing:stock.perKind-or-total")
  const perKind = "perKind" in value ? requireInteger(value, "perKind", "stock.perKind", 1, issues) : undefined
  const total = "total" in value ? requireInteger(value, "total", "stock.total", 1, issues) : undefined
  if (perKind === null || total === null) return null
  return {
    ...(perKind === undefined ? {} : { perKind }),
    ...(total === undefined ? {} : { total }),
  }
}

function parseGoal(value: unknown, params: BlindBoxParams, issues: string[]): BlindBoxParams {
  if (!isRecord(value)) {
    issues.push("invalid:goal")
    return params
  }
  rejectUnknownFields(value, ["kinds", "sets", "players"], "goal.", issues)
  if (Object.keys(value).length === 0) {
    issues.push("missing:goal")
    return params
  }
  if ("players" in value && !("sets" in value)) issues.push("missing:goal.sets")

  let goal = params.goal
  if ("kinds" in value) {
    if (value.kinds === "all" || value.kinds === "regular") {
      goal = { ...goal, kinds: value.kinds }
    } else if (value.kinds === "hidden") {
      const hidden = params.kinds.filter((kind) => kind.hidden === true).map((kind) => kind.id)
      if (hidden.length === 0) issues.push("goal.no-hidden-kind")
      goal = { ...goal, kinds: hidden }
    } else {
      issues.push("invalid:goal.kinds")
    }
  }
  if ("sets" in value) {
    const sets = requireInteger(value, "sets", "goal.sets", 1, issues)
    if (sets !== null) goal = { ...goal, sets }
  }
  if ("players" in value) {
    const players = requireInteger(value, "players", "goal.players", 1, issues)
    if (players !== null) goal = { ...goal, players }
  }
  return { ...params, goal }
}

function parsePity(
  value: unknown,
  kinds: readonly KindParam[],
  issues: string[],
): BlindBoxParams["pity"] | null {
  if (!isRecord(value)) return fail(issues, "invalid:pity")
  rejectUnknownFields(value, ["target", "within"], "pity.", issues)
  const within = requireInteger(value, "within", "pity.within", 1, issues)
  if (!("target" in value)) return fail(issues, "missing:pity.target")
  if (typeof value.target !== "string") return fail(issues, "invalid:pity.target")

  let target = value.target
  if (target === "hidden") {
    const hidden = kinds.filter((kind) => kind.hidden === true)
    if (hidden.length === 0) return fail(issues, "pity.no-hidden-kind")
    if (hidden.length > 1) return fail(issues, "pity.target-ambiguous")
    target = hidden[0]?.id ?? target
  } else if (!kinds.some((kind) => kind.id === target)) {
    return fail(issues, "pity.target-unknown")
  }
  return within === null ? null : { target, within }
}

function parsePrices(value: unknown, issues: string[]): BlindBoxParams["prices"] | null {
  if (!isRecord(value)) return fail(issues, "invalid:prices")
  rejectUnknownFields(value, ["box", "resale", "secondHand"], "prices.", issues)
  const amount = (key: "box" | "resale" | "secondHand") => {
    const raw = value[key]
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
      issues.push(`invalid:prices.${key}`)
      return null
    }
    return raw
  }
  if (!("box" in value)) return fail(issues, "missing:prices.box")
  const box = amount("box")
  const resale = "resale" in value ? amount("resale") : undefined
  const secondHand = "secondHand" in value ? amount("secondHand") : undefined
  if (box === null || resale === null || secondHand === null) return null
  return {
    box,
    ...(resale === undefined ? {} : { resale }),
    ...(secondHand === undefined ? {} : { secondHand }),
  }
}

function parseKindsKnown(value: unknown, issues: string[]): Question | null {
  if (value === false) return { kind: "unknown-kinds", draws: null, observedKinds: null }
  if (!isRecord(value)) return fail(issues, "invalid:kindsKnown")
  rejectUnknownFields(value, ["known", "draws", "observedKinds"], "kindsKnown.", issues)
  if (value.known !== false) return fail(issues, "invalid:kindsKnown.known")
  const draws = requireInteger(value, "draws", "kindsKnown.draws", 1, issues)
  const observedKinds =
    "observedKinds" in value ? requireInteger(value, "observedKinds", "kindsKnown.observedKinds", 0, issues) : undefined
  if (draws === null || observedKinds === null) return null
  if (observedKinds !== undefined && observedKinds > draws) return fail(issues, "kindsKnown.observed-exceeds-draws")
  return { kind: "unknown-kinds", draws, observedKinds: observedKinds ?? null }
}

function parseQuestion(value: unknown, issues: string[]): Question | null {
  if (!isRecord(value)) return fail(issues, "invalid:question")
  rejectUnknownFields(value, ["withinDraws", "confidence"], "question.", issues)
  const hasDraws = "withinDraws" in value
  const hasConfidence = "confidence" in value
  if (hasDraws === hasConfidence) return fail(issues, "question.withinDraws-or-confidence")
  if (hasDraws) {
    const draws = requireInteger(value, "withinDraws", "question.withinDraws", 1, issues)
    return draws === null ? null : { kind: "within-draws", draws }
  }
  const level = requireProbability(value, "confidence", "question.confidence", issues)
  if (level === null) return null
  if (level === 0 || level === 1) return fail(issues, "invalid-probability:question.confidence")
  return { kind: "confidence", level }
}

function requireInteger(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  minimum: number,
  issues: string[],
): number | null {
  if (!(key in record)) return fail(issues, `missing:${path}`)
  const value = record[key]
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    return fail(issues, `invalid:${path}`)
  }
  return value
}

function requireProbability(
  record: Readonly<Record<string, unknown>>,
  key: string,
  path: string,
  issues: string[],
): number | null {
  if (!(key in record)) return fail(issues, `missing:${path}`)
  const value = record[key]
  // 只认字符串写法；"未知"、"很难抽"、中文数字都不算概率。
  if (typeof value !== "string" || !PROBABILITY_TEXT.test(value.normalize("NFKC"))) {
    return fail(issues, `invalid-probability:${path}`)
  }
  try {
    return parseProbability(value)
  } catch {
    return fail(issues, `invalid-probability:${path}`)
  }
}

function rejectUnknownFields(
  record: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  prefix: string,
  issues: string[],
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) issues.push(`unknown-field:${prefix}${key}`)
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function fail(issues: string[], issue: string): null {
  issues.push(issue)
  return null
}
