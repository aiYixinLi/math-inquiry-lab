// 研究方案 8.3 的找错练习：真实回放记录和项目作者编写的“翻错的记录”混在一起，学生对照自己的原话
// 检查程序的复述，把 AI 翻错的那几条点“不对”。这里是练习记录的类型、学生自己的判断该选什么，
// 以及把关指标要用的计数。练习数据（spot-the-error-records.ts）由 scripts/spot-the-error.ts
// 从 user-trial/spot-the-error/ 下的练习表生成。

import type { AssumptionId, TranslationStatus, TranslatorResult } from "../../../lib/translator-client"

export interface SpotExpected {
  readonly status: TranslationStatus
  /** 能翻译时是打破的那条；追问时看得出是哪条就写，否则为 null；只改数字、超出范围为 null。 */
  readonly brokenAssumption: AssumptionId | null
  /** 能翻译、只改数字时的标准参数；追问、超出范围为 null。 */
  readonly parameterChanges: Readonly<Record<string, unknown>> | null
}

export interface SpotRecord {
  /** 练习表里的编号。 */
  readonly id: string
  readonly text: string
  /** 真实回放：离线回放里那一条的编号；翻错的记录为 null。 */
  readonly replayId: string | null
  /** 学生看到的 AI 回复。真实回放原样带过来；翻错的由项目作者仿照 AI 的回复编写。 */
  readonly result: TranslatorResult
  readonly wrong: boolean
  /** 标准答案。真实回放的标准答案就是 AI 的翻译。 */
  readonly expected: SpotExpected
  /** 翻错的记录错在哪里，公布答案时显示；真实回放为 null。 */
  readonly whatIsWrong: string | null
}

/** 学生先自己选的：打破了哪条、都没打破（只换了数字）、说不准。 */
export type SpotPick = AssumptionId | "none" | "unsure"

export type SpotDecision = "confirmed" | "rejected"

/** 学生自己的判断应当选什么；超出范围、追问又看不出是哪条时没有标准答案，返回 null。 */
export function expectedPick(expected: SpotExpected): SpotPick | null {
  if (expected.status === "parameter-only") return "none"
  if (expected.status === "out-of-scope") return null
  return expected.brokenAssumption
}

/**
 * 一条记录的结果。翻错的记录：点“不对”是找出来了（caught），确认了是没找出来（missed）；
 * 翻对的记录：确认了是 accepted，点“不对”是误拒（false-reject）。
 */
export type SpotOutcome = "caught" | "missed" | "accepted" | "false-reject"

export function spotOutcome(wrong: boolean, decision: SpotDecision): SpotOutcome {
  if (wrong) return decision === "rejected" ? "caught" : "missed"
  return decision === "confirmed" ? "accepted" : "false-reject"
}

export interface SpotJudgement {
  readonly id: string
  readonly pick: SpotPick
  readonly decision: SpotDecision
}

/**
 * 一位学生做一次练习的计数，只算已经判断过的记录，每条只算第一次判断。研究方案 8.3 的
 * 四个比例由项目作者汇总各人的记录后再算：自主判断正确率 = ownPickRight / ownPickScored，
 * 找错检出率 = caught / wrong，盲从率 = blindFollow / wrongWithOwnPickRight，误拒率 = falseRejects / correct。
 */
export interface SpotSummary {
  readonly total: number
  readonly judged: number
  /** 已判断的翻错记录条数，以及其中点了“不对”的条数。 */
  readonly wrong: number
  readonly caught: number
  /** 已判断的翻对记录条数，以及其中点了“不对”的条数。 */
  readonly correct: number
  readonly falseRejects: number
  /** 有标准答案的记录条数，以及看 AI 之前自己就选对的条数。 */
  readonly ownPickScored: number
  readonly ownPickRight: number
  /** 翻错的记录里自己先选对了的条数，以及其中仍然确认了错误复述的条数。 */
  readonly wrongWithOwnPickRight: number
  readonly blindFollow: number
}

export function firstJudgements(judgements: readonly SpotJudgement[]): ReadonlyMap<string, SpotJudgement> {
  const first = new Map<string, SpotJudgement>()
  for (const judgement of judgements) if (!first.has(judgement.id)) first.set(judgement.id, judgement)
  return first
}

export function summarizeSpot(records: readonly SpotRecord[], judgements: readonly SpotJudgement[]): SpotSummary {
  const first = firstJudgements(judgements)
  const summary = {
    total: records.length,
    judged: 0,
    wrong: 0,
    caught: 0,
    correct: 0,
    falseRejects: 0,
    ownPickScored: 0,
    ownPickRight: 0,
    wrongWithOwnPickRight: 0,
    blindFollow: 0,
  }
  for (const record of records) {
    const judgement = first.get(record.id)
    if (judgement === undefined) continue
    summary.judged += 1
    const outcome = spotOutcome(record.wrong, judgement.decision)
    const pick = expectedPick(record.expected)
    const pickRight = pick !== null && judgement.pick === pick
    if (pick !== null) summary.ownPickScored += 1
    if (pickRight) summary.ownPickRight += 1
    if (record.wrong) {
      summary.wrong += 1
      if (outcome === "caught") summary.caught += 1
      if (pickRight) {
        summary.wrongWithOwnPickRight += 1
        if (outcome === "missed") summary.blindFollow += 1
      }
    } else {
      summary.correct += 1
      if (outcome === "false-reject") summary.falseRejects += 1
    }
  }
  return summary
}
