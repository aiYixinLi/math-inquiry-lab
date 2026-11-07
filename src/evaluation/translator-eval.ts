// 研究方案 8.2 的翻译器评测：检查测试集的标注、给出标准答案，再给一次评测运行打分。
// 测试集由学生本人编写和标注（研究方案第十节）；这里只做格式检查和计算，不改标注。
// 网页不用这个模块，只有 scripts/translator-eval.ts 用到；放在 src/ 里是为了参加类型检查和测试。
//
// 判分全部由程序完成：
// - 状态、假设：和标注逐字比较；
// - 参数：把翻译结果和标准参数都用实验室的严格解析合并成模型，比较模型是否相同
//   （写法不同但意思相同，例如库存同时写 perKind 和 total，算对）；
// - 最终数字：本系统按翻译结果的模型算理论值，“直接问大模型”取模型自己给的数，
//   都和按标准参数算出的理论值比较。

import {
  LEVEL_SUMMARIES,
  exactHeadline,
  prepareFreeCondition,
  resolveModel,
  type BlindBoxParams,
  type FreeConditionLevel,
  type HeadlineKind,
  type ParameterChanges,
  type Question,
} from "../core/blindbox"
import { MAX_CONDITION_LENGTH, type AssumptionId } from "../lib/translator-client"

export type ExpectedStatus = "translated" | "parameter-only" | "clarify" | "out-of-scope"

/** 测试集表格里“期望状态”一列的写法。 */
export const STATUS_LABELS: Readonly<Record<ExpectedStatus, string>> = {
  translated: "能翻译",
  "parameter-only": "只改数字",
  clarify: "追问",
  "out-of-scope": "超出范围",
}

export const TEST_SET_COLUMNS = ["编号", "条件原文", "来源", "期望状态", "打破的假设", "标准参数", "备注"] as const

/** 编号以“示例”开头的行是模板里的写法示范，默认不参加评测。 */
export const EXAMPLE_PREFIX = "示例"

/** 每条假设对应的参数（研究方案 7.2）；标注和这里不一致时提醒，不算错。 */
const ASSUMPTION_KEYS: Readonly<Record<AssumptionId, readonly string[]>> = {
  A1: ["kinds"],
  A2: ["question"],
  A3: ["stock"],
  A4: ["pity"],
  A5: ["goal", "prices"],
  A6: ["kindsKnown"],
}

export const DIRECT_PROMPT_VERSION = "direct-v1"

export interface TestItem {
  readonly id: string
  readonly text: string
  readonly source: string
  readonly note: string
  readonly expected: {
    readonly status: ExpectedStatus
    readonly assumption: AssumptionId | null
    readonly changes: ParameterChanges | null
  }
  /**
   * 能翻译、只改数字时程序按标准参数算出的答案。问的是“一共几款”（反问题），
   * 或者这组参数没有理论值时为 null，这条不计入数字正确率。
   */
  readonly truth: {
    readonly level: FreeConditionLevel
    readonly kind: HeadlineKind
    readonly question: string
    readonly unit: string
    readonly probability: boolean
    readonly value: number
  } | null
  /** “直接问大模型”时发出的提示词；truth 为 null 时不问。 */
  readonly direct: { readonly system: string; readonly user: string } | null
}

export interface CheckedTestSet {
  readonly version: 1
  readonly checkedAt: string
  readonly sourceFile: string
  readonly directPromptVersion: string
  readonly items: readonly TestItem[]
}

export interface RowProblem {
  /** 表格里的行号（第 1 行是表头）。 */
  readonly row: number
  readonly id: string
  readonly message: string
}

export interface CheckResult {
  readonly items: readonly TestItem[]
  readonly errors: readonly RowProblem[]
  readonly warnings: readonly RowProblem[]
  readonly skippedExamples: number
}

// ---------------------------------------------------------------------------
// CSV

/** 解析 CSV：支持双引号、引号里的逗号和换行、开头的 BOM；全空的行去掉。 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^﻿/u, "")
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  let fieldStarted = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input.charAt(index)
    if (quoted) {
      if (char === '"') {
        if (input.charAt(index + 1) === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
    } else if (char === '"' && !fieldStarted) {
      quoted = true
      fieldStarted = true
    } else if (char === ",") {
      row.push(field)
      field = ""
      fieldStarted = false
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input.charAt(index + 1) === "\n") index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      fieldStarted = false
    } else {
      field += char
      fieldStarted = true
    }
  }
  if (fieldStarted || field !== "" || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""))
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  const cell = (value: string) => (/[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value)
  return `﻿${rows.map((cells) => cells.map(cell).join(",")).join("\r\n")}\r\n`
}

// ---------------------------------------------------------------------------
// 检查测试集

export function checkTestSet(csvText: string, options: { readonly includeExamples?: boolean } = {}): CheckResult {
  const rows = parseCsv(csvText)
  const errors: RowProblem[] = []
  const warnings: RowProblem[] = []
  const items: TestItem[] = []
  let skippedExamples = 0

  const header = (rows[0] ?? []).map((cell) => cell.trim())
  const column = (name: string) => header.indexOf(name)
  const required = ["编号", "条件原文", "期望状态", "打破的假设", "标准参数"]
  const missing = required.filter((name) => column(name) < 0)
  if (missing.length > 0) {
    return {
      items: [],
      errors: [{ row: 1, id: "", message: `表头缺少：${missing.join("、")}。表头应当是：${TEST_SET_COLUMNS.join(",")}` }],
      warnings: [],
      skippedExamples: 0,
    }
  }

  const seen = new Set<string>()
  rows.slice(1).forEach((cells, index) => {
    const row = index + 2
    const get = (name: string) => (column(name) < 0 ? "" : (cells[column(name)] ?? "").trim())
    const id = get("编号")
    const problem = (message: string) => errors.push({ row, id, message })
    const warn = (message: string) => warnings.push({ row, id, message })

    if (id === "") return problem("编号不能为空。")
    if (id.startsWith(EXAMPLE_PREFIX) && !options.includeExamples) {
      skippedExamples += 1
      return
    }
    if (seen.has(id)) return problem(`编号 ${id} 重复了。`)
    seen.add(id)

    const text = get("条件原文")
    if (text === "") return problem("条件原文不能为空。")
    if (text.length > MAX_CONDITION_LENGTH) return problem(`条件原文超过 ${MAX_CONDITION_LENGTH} 字。`)

    const status = parseStatus(get("期望状态"))
    if (status === null) {
      return problem(`期望状态写成了“${get("期望状态")}”，只能是：${Object.values(STATUS_LABELS).join("、")}。`)
    }
    const assumptionText = get("打破的假设")
    const assumption = parseAssumption(assumptionText)
    if (assumptionText !== "" && assumption === null) return problem(`打破的假设写成了“${assumptionText}”，只能是 A1–A6 或空着。`)

    const changesText = get("标准参数")
    const needsChanges = status === "translated" || status === "parameter-only"
    if (status === "translated" && assumption === null) return problem("能翻译的条件要写打破了哪条假设（A1–A6）。")
    if ((status === "parameter-only" || status === "out-of-scope") && assumption !== null) {
      return problem(`${STATUS_LABELS[status]}的条件，打破的假设要空着。`)
    }
    if (!needsChanges) {
      if (changesText !== "" && changesText !== "{}") return problem(`${STATUS_LABELS[status]}的条件，标准参数要空着。`)
      items.push(item(id, text, get("来源"), get("备注"), status, assumption, null, null))
      return
    }
    if (changesText === "") return problem(`${STATUS_LABELS[status]}的条件要写标准参数。`)

    const changes = parseChangesCell(changesText)
    if (changes === null) return problem("标准参数不是合法的 JSON。可以照着说明里的例子写，注意要用英文双引号。")
    const prepared = prepareFreeCondition(changes)
    if (!prepared.ok) return problem(`标准参数没有通过实验室的严格检查：${prepared.issues.join("、")}`)

    const keys = Object.keys(changes)
    const kinds = changes.kinds
    if (status === "parameter-only" && (keys.join(",") !== "kinds" || (typeof kinds === "object" && kinds !== null && "special" in kinds))) {
      warn("只改数字时，标准参数一般只写 kinds 的 total（每款仍然一样难抽）。")
    }
    if (assumption !== null) {
      const expectedKeys = ASSUMPTION_KEYS[assumption]
      const others = keys.filter((key) => !expectedKeys.includes(key))
      if (others.length > 0) warn(`${assumption} 一般改 ${expectedKeys.join(" 或 ")}，这里还改了 ${others.join("、")}。`)
    }

    const headline = exactHeadline(prepared)
    if (headline === null) warn("这一问没有理论值（或问的是一共几款），不计入最终数字正确率。")
    const truth =
      headline === null
        ? null
        : {
            level: prepared.level,
            kind: headline.spec.kind,
            question: headline.spec.label,
            unit: headline.spec.unit,
            probability: headline.spec.probability,
            value: headline.value,
          }
    items.push(item(id, text, get("来源"), get("备注"), status, assumption, changes as ParameterChanges, truth))
  })

  return { items, errors, warnings, skippedExamples }
}

function item(
  id: string,
  text: string,
  source: string,
  note: string,
  status: ExpectedStatus,
  assumption: AssumptionId | null,
  changes: ParameterChanges | null,
  truth: TestItem["truth"],
): TestItem {
  return {
    id,
    text,
    source,
    note,
    expected: { status, assumption, changes },
    truth,
    direct: truth === null ? null : directPrompt(text, truth),
  }
}

/**
 * “直接问大模型”的提示词：交代原来的情况（和翻译器、实验室用的同一级）、学生的条件和
 * 要回答的问题，允许先推理，最后只给一个数。问题按标准答案写出，对直接问一方是有利的。
 */
export function directPrompt(text: string, truth: NonNullable<TestItem["truth"]>): { system: string; user: string } {
  const unit = truth.probability ? "概率写成 0 到 1 之间的小数" : `单位：${truth.unit}`
  return {
    system: "你是一位细心的数学老师，擅长概率问题。请解答学生提出的盲盒问题。",
    user: [
      `原来的情况：一个盲盒系列，${LEVEL_SUMMARIES[truth.level]}`,
      `现在多了一个条件：${text}`,
      `问题：${truth.question}？（${unit}）`,
      '请先简要写出思路，再给出最终答案。只输出一个 JSON 对象：{"思路": "……", "答案": 数字}。' +
        '"答案" 只写一个数字，不带单位；如果无法回答，写 null。',
    ].join("\n"),
  }
}

export function parseStatus(text: string): ExpectedStatus | null {
  const value = text.trim()
  const entry = (Object.entries(STATUS_LABELS) as [ExpectedStatus, string][]).find(
    ([status, label]) => label === value || status === value,
  )
  return entry?.[0] ?? null
}

export function parseAssumption(text: string): AssumptionId | null {
  const value = text.normalize("NFKC").trim().toUpperCase()
  return /^A[1-6]$/u.test(value) ? (value as AssumptionId) : null
}

/** 标准参数一格：容忍中文引号、全角标点。 */
export function parseChangesCell(text: string): Record<string, unknown> | null {
  const normalized = text.replace(/[“”]/gu, '"').replace(/[‘’]/gu, "'").normalize("NFKC").trim()
  try {
    const value: unknown = JSON.parse(normalized)
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// 评测运行记录（由 data/experiments/translator-eval/run.mjs 写出）

export interface TranslatorRecord {
  readonly id: string
  readonly repeat: number
  readonly kind: "translator"
  readonly durationMs: number
  /** 通过了翻译服务的格式校验和数字回查。 */
  readonly ok: boolean
  readonly status: ExpectedStatus | null
  readonly translation: {
    readonly brokenAssumption: AssumptionId | null
    readonly parameterChanges: unknown
  } | null
  readonly issues: readonly string[]
  /** 调用出错（断网、超时、限流）；这样的记录不计入正确率，再跑一次会重做。 */
  readonly error: string | null
}

export interface DirectRecord {
  readonly id: string
  readonly repeat: number
  readonly kind: "direct"
  readonly durationMs: number
  readonly answer: number | null
  /** 回复了但没有给出数字的原因（例如不是 JSON）。 */
  readonly problem?: string | null
  /** 调用出错（断网、超时、限流）；这样的记录不计入正确率。 */
  readonly error: string | null
}

export type RunRecord = TranslatorRecord | DirectRecord

export interface EvalRun {
  readonly model: string
  readonly endpoint: string
  readonly settings: string
  readonly startedAt: string
  readonly repeat: number
  readonly records: readonly RunRecord[]
}

// ---------------------------------------------------------------------------
// 打分

export interface Rate {
  readonly k: number
  readonly n: number
  readonly rate: number | null
  /** Wilson 95% 区间。 */
  readonly ci95: readonly [number, number] | null
}

export interface RunScore {
  readonly repeat: number
  readonly status: ExpectedStatus | null
  readonly assumption: AssumptionId | null
  readonly statusCorrect: boolean
  readonly assumptionCorrect: boolean | null
  readonly paramsCorrect: boolean | null
  readonly pipelineValue: number | null
  readonly pipelineCorrect: boolean | null
  readonly directValue: number | null
  readonly directCorrect: boolean | null
  readonly problem: string | null
}

export interface ItemScore {
  readonly item: TestItem
  readonly runs: readonly RunScore[]
  /** 几次翻译的状态、假设和参数完全一样。 */
  readonly consistent: boolean | null
}

export interface CategoryScore {
  readonly category: string
  readonly items: number
  readonly status: Rate
  readonly assumption: Rate
  readonly parameters: Rate
  readonly pipelineNumber: Rate
  readonly directNumber: Rate
}

export interface EvalReport {
  readonly model: string
  readonly endpoint: string
  readonly settings: string
  readonly startedAt: string
  readonly repeat: number
  readonly itemCount: number
  readonly sources: Readonly<Record<string, number>>
  readonly missingRecords: number
  readonly metrics: {
    readonly status: Rate
    readonly assumption: Rate
    readonly parameters: Rate
    readonly outOfScope: Rate
    readonly clarify: Rate
    readonly falseOutOfScope: Rate
    readonly pipelineNumber: Rate
    readonly directNumber: Rate
    readonly consistency: Rate
  }
  /** 同一条件同一次的本系统和直接问配对比较。 */
  readonly paired: { readonly bothRight: number; readonly onlyPipeline: number; readonly onlyDirect: number; readonly bothWrong: number }
  /** rejected：翻译服务拒收；errors：调用出错（不计入）；directNoAnswer：直接问时回复了但没有数字。 */
  readonly failures: { readonly rejected: number; readonly errors: number; readonly directNoAnswer: number }
  readonly latency: {
    readonly translator: { readonly median: number; readonly p90: number } | null
    readonly direct: { readonly median: number; readonly p90: number } | null
  }
  readonly categories: readonly CategoryScore[]
  readonly items: readonly ItemScore[]
}

/** 数字算对：概率差不超过 1 个百分点；其他差不超过 1%（至少 0.05）。 */
export function numberMatches(value: number, truth: NonNullable<TestItem["truth"]>): boolean {
  if (!Number.isFinite(value)) return false
  const tolerance = truth.probability ? 0.01 : Math.max(0.01 * Math.abs(truth.value), 0.05)
  return Math.abs(value - truth.value) <= tolerance
}

/** 直接问时模型偶尔把概率写成百分数（36.5 表示 36.5%），按百分数换算。 */
export function normalizeDirectAnswer(answer: number | null, truth: NonNullable<TestItem["truth"]>): number | null {
  if (answer === null || !Number.isFinite(answer)) return null
  return truth.probability && answer > 1 && answer <= 100 ? answer / 100 : answer
}

export function scoreRun(testSet: CheckedTestSet, run: EvalRun): EvalReport {
  const translatorRecords = new Map<string, TranslatorRecord>()
  const directRecords = new Map<string, DirectRecord>()
  for (const record of run.records) {
    if (record.error !== null) continue
    const key = `${record.id}#${record.repeat}`
    if (record.kind === "translator") translatorRecords.set(key, record)
    else directRecords.set(key, record)
  }

  let missingRecords = 0
  const items: ItemScore[] = testSet.items.map((testItem) => {
    const runs: RunScore[] = []
    for (let repeat = 1; repeat <= run.repeat; repeat += 1) {
      const translator = translatorRecords.get(`${testItem.id}#${repeat}`)
      const direct = directRecords.get(`${testItem.id}#${repeat}`)
      if (testItem.direct !== null && direct === undefined) missingRecords += 1
      if (translator === undefined) {
        missingRecords += 1
        continue
      }
      runs.push(scoreOne(testItem, repeat, translator, direct))
    }
    return { item: testItem, runs, consistent: consistencyOf(testItem, translatorRecords, run.repeat) }
  })

  const all = items.flatMap((entry) => entry.runs.map((score) => ({ item: entry.item, score })))
  const translatable = all.filter(({ item: testItem }) => isTranslatable(testItem.expected.status))
  const numbered = all.filter(({ item: testItem }) => testItem.truth !== null)
  const count = <T>(list: readonly T[], test: (value: T) => boolean) => rate(list.filter(test).length, list.length)

  const pairs = numbered.filter(({ score }) => score.directCorrect !== null && score.pipelineCorrect !== null)
  const translatorDurations = run.records.filter((record) => record.kind === "translator" && record.error === null).map((record) => record.durationMs)
  const directDurations = run.records.filter((record) => record.kind === "direct" && record.error === null).map((record) => record.durationMs)

  return {
    model: run.model,
    endpoint: run.endpoint,
    settings: run.settings,
    startedAt: run.startedAt,
    repeat: run.repeat,
    itemCount: testSet.items.length,
    sources: tally(testSet.items.map((testItem) => testItem.source || "未注明")),
    missingRecords,
    metrics: {
      status: count(all, ({ score }) => score.statusCorrect),
      assumption: count(translatable, ({ score }) => score.assumptionCorrect === true),
      parameters: count(translatable, ({ score }) => score.paramsCorrect === true),
      outOfScope: count(all.filter(({ item: testItem }) => testItem.expected.status === "out-of-scope"), ({ score }) => score.status === "out-of-scope"),
      clarify: count(all.filter(({ item: testItem }) => testItem.expected.status === "clarify"), ({ score }) => score.status === "clarify"),
      falseOutOfScope: count(all.filter(({ item: testItem }) => testItem.expected.status !== "out-of-scope"), ({ score }) => score.status === "out-of-scope"),
      pipelineNumber: count(numbered, ({ score }) => score.pipelineCorrect === true),
      directNumber: count(numbered.filter(({ score }) => score.directCorrect !== null), ({ score }) => score.directCorrect === true),
      consistency: count(items.filter((entry) => entry.consistent !== null), (entry) => entry.consistent === true),
    },
    paired: {
      bothRight: pairs.filter(({ score }) => score.pipelineCorrect && score.directCorrect).length,
      onlyPipeline: pairs.filter(({ score }) => score.pipelineCorrect && !score.directCorrect).length,
      onlyDirect: pairs.filter(({ score }) => !score.pipelineCorrect && score.directCorrect).length,
      bothWrong: pairs.filter(({ score }) => !score.pipelineCorrect && !score.directCorrect).length,
    },
    failures: {
      rejected: run.records.filter((record) => record.kind === "translator" && !record.ok && record.error === null).length,
      errors: run.records.filter((record) => record.error !== null).length,
      directNoAnswer: run.records.filter((record) => record.kind === "direct" && record.error === null && record.answer === null).length,
    },
    latency: { translator: spread(translatorDurations), direct: spread(directDurations) },
    categories: categoriesOf(items),
    items,
  }
}

function scoreOne(testItem: TestItem, repeat: number, translator: TranslatorRecord, direct: DirectRecord | undefined): RunScore {
  const expected = testItem.expected
  const status = translator.ok ? translator.status : null
  const assumption = translator.translation?.brokenAssumption ?? null
  const translatable = isTranslatable(expected.status)
  let paramsCorrect: boolean | null = translatable ? false : null
  let pipelineValue: number | null = null
  let problem: string | null = translator.ok ? null : `翻译服务拒收：${translator.issues.join("、")}`

  if (translator.ok && isTranslatable(status) && translator.translation !== null) {
    const prepared = prepareFreeCondition(translator.translation.parameterChanges)
    if (!prepared.ok) {
      problem = `没有通过实验室的严格检查：${prepared.issues.join("、")}`
    } else {
      if (translatable && expected.changes !== null) {
        const reference = prepareFreeCondition(expected.changes)
        paramsCorrect = reference.ok && sameModel(prepared, reference)
      }
      const headline = exactHeadline(prepared)
      if (headline !== null && testItem.truth !== null && headline.spec.kind === testItem.truth.kind) {
        pipelineValue = headline.value
      }
    }
  }

  const truth = testItem.truth
  const directValue = truth === null || direct === undefined ? null : normalizeDirectAnswer(direct.answer, truth)
  return {
    repeat,
    status,
    assumption,
    statusCorrect: status === expected.status,
    assumptionCorrect: translatable ? translator.ok && assumption === expected.assumption : null,
    paramsCorrect,
    pipelineValue,
    pipelineCorrect: truth === null ? null : pipelineValue !== null && numberMatches(pipelineValue, truth),
    directValue,
    directCorrect: truth === null || direct === undefined ? null : directValue !== null && numberMatches(directValue, truth),
    problem,
  }
}

function consistencyOf(testItem: TestItem, records: ReadonlyMap<string, TranslatorRecord>, repeat: number): boolean | null {
  const outcomes: string[] = []
  for (let index = 1; index <= repeat; index += 1) {
    const record = records.get(`${testItem.id}#${index}`)
    if (record === undefined) continue
    outcomes.push(
      record.ok
        ? stableJson({ status: record.status, assumption: record.translation?.brokenAssumption ?? null, model: modelOf(record) })
        : "rejected",
    )
  }
  return outcomes.length < 2 ? null : outcomes.every((outcome) => outcome === outcomes[0])
}

function modelOf(record: TranslatorRecord): unknown {
  if (!isTranslatable(record.status) || record.translation === null) return null
  const prepared = prepareFreeCondition(record.translation.parameterChanges)
  return prepared.ok ? canonicalModel(prepared) : "invalid"
}

interface MergedModel {
  readonly params: BlindBoxParams
  readonly question: Question
}

/**
 * 两个合并后的模型是否相同。比较展开后的模型（各款概率、每款库存、目标、保底……）和问题，
 * 不比较写法：库存写 {perKind: 2} 和 {perKind: 2, total: 12} 是同一个模型。浮点数按 12 位有效数字比较。
 */
export function sameModel(left: MergedModel, right: MergedModel): boolean {
  return stableJson(canonicalModel(left)) === stableJson(canonicalModel(right))
}

function canonicalModel(model: MergedModel): unknown {
  const { params: _written, ...resolved } = resolveModel(model.params)
  return {
    resolved,
    hidden: model.params.kinds.map((kind) => kind.hidden === true),
    kindsKnown: model.params.kindsKnown,
    question: model.question,
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item === "number") return Number(item.toPrecision(12))
    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)))
    }
    return item
  })
}

function categoriesOf(items: readonly ItemScore[]): CategoryScore[] {
  const order = ["A1", "A2", "A3", "A4", "A5", "A6", "只改数字", "追问", "超出范围"]
  const categoryOf = (testItem: TestItem) =>
    testItem.expected.status === "translated" ? (testItem.expected.assumption ?? "?") : STATUS_LABELS[testItem.expected.status]
  return order.flatMap((category) => {
    const members = items.filter((entry) => categoryOf(entry.item) === category)
    if (members.length === 0) return []
    const runs = members.flatMap((entry) => entry.runs.map((score) => ({ item: entry.item, score })))
    const translatable = runs.filter(({ item: testItem }) => isTranslatable(testItem.expected.status))
    const numbered = runs.filter(({ item: testItem }) => testItem.truth !== null)
    const count = <T>(list: readonly T[], test: (value: T) => boolean) => rate(list.filter(test).length, list.length)
    return [
      {
        category,
        items: members.length,
        status: count(runs, ({ score }) => score.statusCorrect),
        assumption: count(translatable, ({ score }) => score.assumptionCorrect === true),
        parameters: count(translatable, ({ score }) => score.paramsCorrect === true),
        pipelineNumber: count(numbered, ({ score }) => score.pipelineCorrect === true),
        directNumber: count(numbered.filter(({ score }) => score.directCorrect !== null), ({ score }) => score.directCorrect === true),
      },
    ]
  })
}

function isTranslatable(status: ExpectedStatus | null): boolean {
  return status === "translated" || status === "parameter-only"
}

export function rate(k: number, n: number): Rate {
  if (n === 0) return { k, n, rate: null, ci95: null }
  const z = 1.959_963_984_540_054
  const p = k / n
  const denominator = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / denominator
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator
  return { k, n, rate: p, ci95: [Math.max(0, center - half), Math.min(1, center + half)] }
}

function tally(values: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const value of values) result[value] = (result[value] ?? 0) + 1
  return result
}

function spread(values: readonly number[]): { median: number; p90: number } | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const at = (level: number) => sorted[Math.max(0, Math.ceil(level * sorted.length) - 1)] ?? 0
  return { median: at(0.5), p90: at(0.9) }
}

// ---------------------------------------------------------------------------
// 报告

export function renderReport(report: EvalReport): string {
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`
  const show = (value: Rate) =>
    value.rate === null || value.ci95 === null
      ? "—"
      : `${value.k}/${value.n}（${percent(value.rate)}，95% 区间 ${percent(value.ci95[0])}–${percent(value.ci95[1])}）`
  const short = (value: Rate) => (value.rate === null ? "—" : `${value.k}/${value.n}（${percent(value.rate)}）`)
  const seconds = (value: number) => `${(value / 1000).toFixed(1)} 秒`
  const { metrics, paired } = report
  const lines: string[] = []

  lines.push("# 翻译器评测报告（研究方案 8.2）", "")
  lines.push(`- 模型：${report.model}（${report.endpoint}），${report.settings}`)
  lines.push(`- 开始时间：${report.startedAt}`)
  lines.push(
    `- 测试集：${report.itemCount} 条（${Object.entries(report.sources).map(([source, count]) => `${source} ${count}`).join("，")}），每条重复 ${report.repeat} 次`,
  )
  if (report.missingRecords > 0) {
    lines.push(`- **注意：有 ${report.missingRecords} 次调用没有可用的记录（运行没跑完，或调用出错），下面只统计已有的记录。用同样的命令再跑一次会补上。**`)
  }
  lines.push(
    "- 判分全部由程序完成：参数按实验室的严格解析合并成模型再比较；最终数字和按标准参数算出的理论值比较，概率差不超过 1 个百分点、其他差不超过 1% 算对。",
    "- “直接问大模型”用同一个模型，告诉它原来的情况、学生的条件和要回答的问题，允许先推理，最后只给一个数；不用模拟器，也不做检验。问题按标准答案写出，这一点对直接问一方是有利的。",
    "",
  )

  lines.push("## 总体结果", "")
  lines.push("| 指标 | 本系统（翻译器 + 程序计算） | 直接问大模型 |", "|---|---|---|")
  lines.push(`| 状态判断正确（全部条件） | ${show(metrics.status)} | — |`)
  lines.push(`| 假设识别正确（能翻译、只改数字） | ${show(metrics.assumption)} | — |`)
  lines.push(`| 参数正确（能翻译、只改数字） | ${show(metrics.parameters)} | — |`)
  lines.push(`| 超出范围的条件答“需要新增假设” | ${show(metrics.outOfScope)} | — |`)
  lines.push(`| 该追问的条件追问了 | ${show(metrics.clarify)} | — |`)
  lines.push(`| 不该超出范围却答“超出范围” | ${show(metrics.falseOutOfScope)} | — |`)
  lines.push(`| **最终数字正确** | **${show(metrics.pipelineNumber)}** | **${show(metrics.directNumber)}** |`)
  lines.push(`| 同一条件几次翻译完全一致 | ${show(metrics.consistency)} | — |`, "")

  lines.push("## 最终数字：同一条件同一次的配对比较", "")
  lines.push("| | 直接问：对 | 直接问：错 |", "|---|---|---|")
  lines.push(`| 本系统：对 | ${paired.bothRight} | ${paired.onlyPipeline} |`)
  lines.push(`| 本系统：错 | ${paired.onlyDirect} | ${paired.bothWrong} |`, "")
  lines.push(
    `翻译服务拒收 ${report.failures.rejected} 次（算作翻译失败）；直接问时回复了但没有给出数字 ${report.failures.directNoAnswer} 次（算作答错）；调用出错 ${report.failures.errors} 次（断网、超时、限流，不计入）。`,
    "",
  )

  lines.push("## 按条件类别", "")
  lines.push("| 类别 | 条数 | 状态 | 假设 | 参数 | 本系统数字 | 直接问数字 |", "|---|---|---|---|---|---|---|")
  for (const category of report.categories) {
    lines.push(
      `| ${category.category} | ${category.items} | ${short(category.status)} | ${short(category.assumption)} | ${short(category.parameters)} | ${short(category.pipelineNumber)} | ${short(category.directNumber)} |`,
    )
  }
  lines.push("")

  const wrong = report.items.filter((entry) =>
    entry.runs.some((score) => !score.statusCorrect || score.assumptionCorrect === false || score.paramsCorrect === false || score.pipelineCorrect === false || score.directCorrect === false),
  )
  lines.push("## 出错的条件", "")
  if (wrong.length === 0) lines.push("没有。", "")
  for (const entry of wrong) {
    const { item: testItem } = entry
    const expected = `${STATUS_LABELS[testItem.expected.status]}${testItem.expected.assumption ? ` ${testItem.expected.assumption}` : ""}`
    const truth = testItem.truth === null ? "" : `；标准答案 ${formatTruth(testItem.truth.value, testItem.truth.probability)}`
    lines.push(`- **${testItem.id}** ${testItem.text}（期望：${expected}${truth}）`)
    for (const score of entry.runs) {
      const got = score.status === null ? "没有结果" : `${STATUS_LABELS[score.status]}${score.assumption ? ` ${score.assumption}` : ""}`
      const parts = [`第 ${score.repeat} 次：${got}`]
      if (score.paramsCorrect === false) parts.push("参数不对")
      if (score.pipelineCorrect !== null) parts.push(`本系统 ${score.pipelineValue === null ? "无数字" : formatTruth(score.pipelineValue, testItem.truth?.probability ?? false)}${score.pipelineCorrect ? "" : "✗"}`)
      if (score.directCorrect !== null) parts.push(`直接问 ${score.directValue === null ? "无数字" : formatTruth(score.directValue, testItem.truth?.probability ?? false)}${score.directCorrect ? "" : "✗"}`)
      if (score.problem !== null) parts.push(score.problem)
      lines.push(`  - ${parts.join("，")}`)
    }
  }
  lines.push("")

  lines.push("## 耗时", "")
  if (report.latency.translator) lines.push(`- 翻译器：中位数 ${seconds(report.latency.translator.median)}，九成在 ${seconds(report.latency.translator.p90)} 以内`)
  if (report.latency.direct) lines.push(`- 直接问：中位数 ${seconds(report.latency.direct.median)}，九成在 ${seconds(report.latency.direct.p90)} 以内`)
  lines.push("")
  return lines.join("\n")
}

function formatTruth(value: number, probability: boolean): string {
  return probability ? `${(value * 100).toFixed(2)}%` : String(Number(value.toFixed(2)))
}
