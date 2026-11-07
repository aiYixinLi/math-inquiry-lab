// 研究方案 8.3 的找错练习：检查练习表（项目作者编写的翻错记录，加上选来混在一起的真实回放记录），
// 生成实验室用的练习数据。翻错的记录由学生本人编写和标注（研究方案第十节）；这里只做格式
// 检查，把真实回放的 AI 回复原样带过来，不改标注。
// 网页不用这个模块，只有 scripts/spot-the-error.ts 用到；放在 src/ 里是为了参加类型检查和测试。
//
// 练习检验的是“回读确认”这道防线，所以每一条都要有程序复述：AI 的回复只能是“能翻译”或
// “只改数字”，参数要能通过实验室的严格解析；翻错的记录和正确答案合并出的模型必须不同，
// 否则程序复述一模一样，学生没法从复述里看出错。

import { prepareFreeCondition } from "../core/blindbox"
import { MAX_CONDITION_LENGTH, parseTranslatorResult, type TranslatorResult } from "../lib/translator-client"
import type { ReplayRecord } from "../topics/blind-box/free-condition/replay-records"
import type { SpotExpected, SpotRecord } from "../topics/blind-box/free-condition/spot-the-error"
import {
  EXAMPLE_PREFIX,
  STATUS_LABELS,
  parseAssumption,
  parseChangesCell,
  parseCsv,
  parseStatus,
  sameModel,
  type RowProblem,
} from "./translator-eval"

export const SPOT_COLUMNS = [
  "编号",
  "类型",
  "回放编号",
  "条件原文",
  "AI状态",
  "AI打破的假设",
  "AI参数",
  "AI解释",
  "正确状态",
  "正确的假设",
  "正确参数",
  "错在哪里",
  "备注",
] as const

export const SPOT_KINDS = { replay: "真实回放", wrong: "翻错" } as const

/** 研究方案 8.3：3–4 条翻错的记录，和真实回放记录混在一起共约 8 条。 */
const SUGGESTED_WRONG = [3, 4] as const
const SUGGESTED_TOTAL = [6, 10] as const

/**
 * 实时翻译时翻译服务做的检查（格式、数字回查、数字白名单），返回问题代码，没有问题时为空。
 * 由 scripts/spot-the-error.ts 从 agent/ 接进来；翻错的记录被它拦下时只提醒，不算错。
 */
export type ServerCheck = (text: string, translation: TranslatorResult["translation"]) => readonly string[]

export interface SpotCheckResult {
  readonly records: readonly SpotRecord[]
  /** row 为 0 的是整张表的问题。 */
  readonly errors: readonly RowProblem[]
  readonly warnings: readonly RowProblem[]
  readonly skippedExamples: number
}

export function checkSpotSheet(
  csvText: string,
  options: {
    readonly replays: readonly ReplayRecord[]
    readonly serverCheck?: ServerCheck
    readonly includeExamples?: boolean
  },
): SpotCheckResult {
  const rows = parseCsv(csvText)
  const errors: RowProblem[] = []
  const warnings: RowProblem[] = []
  const records: SpotRecord[] = []
  let skippedExamples = 0

  const header = (rows[0] ?? []).map((cell) => cell.trim())
  const missing = SPOT_COLUMNS.filter((name) => name !== "备注" && !header.includes(name))
  if (missing.length > 0) {
    return {
      records: [],
      errors: [{ row: 1, id: "", message: `表头缺少：${missing.join("、")}。表头应当是：${SPOT_COLUMNS.join(",")}` }],
      warnings: [],
      skippedExamples: 0,
    }
  }

  const seen = new Set<string>()
  rows.slice(1).forEach((cells, index) => {
    const row = index + 2
    const get = (name: (typeof SPOT_COLUMNS)[number]) => (cells[header.indexOf(name)] ?? "").trim()
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

    const kind = get("类型")
    const aiFilled = (["AI状态", "AI打破的假设", "AI参数", "AI解释"] as const).some((name) => get(name) !== "")
    const expectedCells = { status: get("正确状态"), assumption: get("正确的假设"), changes: get("正确参数") }

    if (kind === SPOT_KINDS.replay) {
      const replayId = get("回放编号")
      if (replayId === "") return problem("真实回放要写回放编号（离线回放里那一条的编号，例如 A3）。")
      const replay = options.replays.find((item) => item.id === replayId)
      if (replay === undefined) {
        return problem(`回放编号 ${replayId} 不在离线回放里。可用的有：${options.replays.map((item) => item.id).join("、")}`)
      }
      const { status } = replay.result
      if (status !== "translated" && status !== "parameter-only") {
        return problem(`回放 ${replayId} 的 AI 回复是“${STATUS_LABELS[status]}”，没有程序复述，找错练习用不了。`)
      }
      const text = get("条件原文")
      if (text !== "" && text !== replay.text) {
        return problem(`条件原文和回放 ${replayId} 的不一样（回放里是“${replay.text}”）。真实回放的条件原文可以空着。`)
      }
      if (aiFilled) return problem("真实回放的 AI 回复从录好的记录里带过来，AI状态、AI打破的假设、AI参数、AI解释都要空着。")
      if (get("错在哪里") !== "") {
        return problem("真实回放是翻对的记录，错在哪里要空着。如果你认为这条 AI 翻错了，就不要把它选作翻对的记录。")
      }
      const aiAnswer = answerOf(replay.result)
      let expected = aiAnswer
      if (expectedCells.status !== "" || expectedCells.assumption !== "" || expectedCells.changes !== "") {
        const parsed = parseAnswer(expectedCells, "正确")
        if ("error" in parsed) return problem(parsed.error)
        if (!sameAnswer(parsed.answer, aiAnswer)) {
          return problem("你标的正确答案和 AI 的翻译不一样。要么这条 AI 翻错了（那就不要选它作翻对的记录），要么是标注写错了。")
        }
        expected = parsed.answer
      }
      records.push({ id, text: replay.text, replayId, result: replay.result, wrong: false, expected, whatIsWrong: null })
      return
    }

    if (kind !== SPOT_KINDS.wrong) {
      return problem(`类型写成了“${kind}”，只能是：${SPOT_KINDS.replay}、${SPOT_KINDS.wrong}。`)
    }
    if (get("回放编号") !== "") return problem("翻错的记录不用写回放编号；条件原文写在“条件原文”一列。")
    const text = get("条件原文")
    if (text === "") return problem("条件原文不能为空。")
    if (text.length > MAX_CONDITION_LENGTH) return problem(`条件原文超过 ${MAX_CONDITION_LENGTH} 字。`)

    const aiStatus = parseStatus(get("AI状态"))
    if (aiStatus !== "translated" && aiStatus !== "parameter-only") {
      return problem(
        `AI状态写成了“${get("AI状态")}”。找错练习检验的是回读确认，翻错的记录要有程序复述，AI状态只能是：` +
          `${STATUS_LABELS.translated}、${STATUS_LABELS["parameter-only"]}。`,
      )
    }
    const parsedAi = parseAnswer({ status: get("AI状态"), assumption: get("AI打破的假设"), changes: get("AI参数") }, "AI")
    if ("error" in parsedAi) return problem(parsedAi.error)
    const explanation = get("AI解释")
    if (explanation === "") return problem("AI解释不能为空：仿照 AI 的口气写一句给学生的解释。")
    const result = parseTranslatorResult({
      status: aiStatus,
      translation: {
        brokenAssumption: parsedAi.answer.brokenAssumption,
        parameterChanges: parsedAi.answer.parameterChanges,
        explanationForStudent: explanation,
        outOfScope: false,
        clarifyingQuestion: null,
      },
    })
    if (result === null) return problem("AI 的回复不符合翻译器的格式。")

    if (expectedCells.status === "") return problem("翻错的记录要写正确状态（正确的翻译应当是什么）。")
    const parsedExpected = parseAnswer(expectedCells, "正确")
    if ("error" in parsedExpected) return problem(parsedExpected.error)
    const expected = parsedExpected.answer
    const whatIsWrong = get("错在哪里")
    if (whatIsWrong === "") return problem("翻错的记录要写错在哪里，公布答案时给同学看。")

    if (sameAnswer(parsedAi.answer, expected)) return problem("AI 的回复和正确答案一样，这条并没有翻错。")
    if (expected.status === aiStatus && sameModelOf(parsedAi.answer, expected)) {
      return problem("AI参数和正确参数合并出的是同一个模型，只有假设编号不同。程序复述一模一样，同学没法从复述里看出错。")
    }

    const issues = options.serverCheck?.(text, result.translation) ?? []
    if (issues.length > 0) {
      warn(
        `实时翻译时，翻译服务会拦下这条（${issues.map(describeServerIssue).join("；")}），同学根本看不到程序复述。` +
          "练习里仍然可以用，但它检验的是“假如这道检查漏掉了”的情形，写报告时要说明。",
      )
    }
    records.push({ id, text, replayId: null, result, wrong: true, expected, whatIsWrong })
  })

  const wrong = records.filter((record) => record.wrong).length
  if (errors.length === 0) {
    if (wrong === 0) errors.push({ row: 0, id: "", message: "表里还没有翻错的记录，至少要有一条。" })
    if (records.length === wrong && wrong > 0) {
      warnings.push({ row: 0, id: "", message: "表里只有翻错的记录。研究方案 8.3 要求和真实回放记录混在一起。" })
    }
    if (wrong > 0 && (wrong < SUGGESTED_WRONG[0] || wrong > SUGGESTED_WRONG[1])) {
      warnings.push({ row: 0, id: "", message: `翻错的记录有 ${wrong} 条；研究方案 8.3 计划 ${SUGGESTED_WRONG.join("–")} 条。` })
    }
    if (records.length < SUGGESTED_TOTAL[0] || records.length > SUGGESTED_TOTAL[1]) {
      warnings.push({ row: 0, id: "", message: `一共 ${records.length} 条；研究方案 8.3 计划约 8 条（每人 10 分钟）。` })
    }
  }
  return { records, errors, warnings, skippedExamples }
}

/** 生成实验室读的练习数据（spot-the-error-records.ts）。 */
export function renderSpotModule(records: readonly SpotRecord[], sourceFile: string): string {
  return `// 由 scripts/spot-the-error.ts 从 user-trial/spot-the-error/${sourceFile} 生成，不要手改。
// 研究方案 8.3 的找错练习：真实回放记录和项目作者编写的翻错记录混在一起，界面上标明“找错练习”。

import type { SpotRecord } from "./spot-the-error"

export const SPOT_SOURCE: { readonly file: string } | null = ${JSON.stringify({ file: sourceFile })}

export const SPOT_RECORDS: readonly SpotRecord[] = ${JSON.stringify(records, null, 2)}
`
}

/** 翻译服务的问题代码换成白话（代码见 agent/src/translator/condition-translator.ts）。 */
export function describeServerIssue(issue: string): string {
  const [code, numbers] = issue.split(":")
  if (code === "student-number-missing") return `数字回查：原话里的 ${numbers} 没有出现在参数里（分数、百分数按小数比较）`
  if (code === "invented-number") return `数字白名单：解释里的 ${numbers} 在原话和参数里都没有`
  if (code === "parameter-assumption-mismatch") return "格式检查：参数改的不是这条假设对应的那一项"
  if (code === "invalid-explanation") return "格式检查：解释为空或超过 80 字"
  return `格式检查：${issue}`
}

function answerOf(result: TranslatorResult): SpotExpected {
  const translatable = result.status === "translated" || result.status === "parameter-only"
  return {
    status: result.status,
    brokenAssumption: result.translation.brokenAssumption,
    parameterChanges: translatable ? result.translation.parameterChanges : null,
  }
}

/** 解析一组“状态、假设、参数”，规则和测试集的标注相同（data/experiments/translator-eval/README.md）。 */
function parseAnswer(
  cells: { readonly status: string; readonly assumption: string; readonly changes: string },
  prefix: "AI" | "正确",
): { readonly answer: SpotExpected } | { readonly error: string } {
  const columns = prefix === "AI"
    ? { status: "AI状态", assumption: "AI打破的假设", changes: "AI参数" }
    : { status: "正确状态", assumption: "正确的假设", changes: "正确参数" }
  const status = parseStatus(cells.status)
  if (status === null) {
    return { error: `${columns.status}写成了“${cells.status}”，只能是：${Object.values(STATUS_LABELS).join("、")}。` }
  }
  const assumption = parseAssumption(cells.assumption)
  if (cells.assumption !== "" && assumption === null) {
    return { error: `${columns.assumption}写成了“${cells.assumption}”，只能是 A1–A6 或空着。` }
  }
  if (status === "translated" && assumption === null) return { error: `能翻译时要写${columns.assumption}（A1–A6）。` }
  if ((status === "parameter-only" || status === "out-of-scope") && assumption !== null) {
    return { error: `${STATUS_LABELS[status]}时，${columns.assumption}要空着。` }
  }
  if (status === "clarify" || status === "out-of-scope") {
    if (cells.changes !== "" && cells.changes !== "{}") return { error: `${STATUS_LABELS[status]}时，${columns.changes}要空着。` }
    return { answer: { status, brokenAssumption: assumption, parameterChanges: null } }
  }
  if (cells.changes === "") return { error: `${STATUS_LABELS[status]}时要写${columns.changes}。` }
  const changes = parseChangesCell(cells.changes)
  if (changes === null) return { error: `${columns.changes}不是合法的 JSON。照着说明里的例子写，注意要用英文双引号。` }
  const prepared = prepareFreeCondition(changes)
  if (!prepared.ok) return { error: `${columns.changes}没有通过实验室的严格检查：${prepared.issues.join("、")}` }
  return { answer: { status, brokenAssumption: assumption, parameterChanges: changes } }
}

function sameAnswer(left: SpotExpected, right: SpotExpected): boolean {
  return left.status === right.status && left.brokenAssumption === right.brokenAssumption && sameModelOf(left, right)
}

/** 参数合并出的模型是否相同；都没有参数（追问、超出范围）也算相同。 */
function sameModelOf(left: SpotExpected, right: SpotExpected): boolean {
  if (left.parameterChanges === null || right.parameterChanges === null) {
    return left.parameterChanges === right.parameterChanges
  }
  const a = prepareFreeCondition(left.parameterChanges)
  const b = prepareFreeCondition(right.parameterChanges)
  return a.ok && b.ok && sameModel(a, b)
}
