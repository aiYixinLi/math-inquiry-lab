// “自由提条件”（研究方案 7.6、7.8）：学生用自己的话提出一个现实条件，先自己判断它打破了
// 哪条假设，再看 AI 的翻译；程序按解析后的参数用白话回读，学生确认、猜想之后，程序计算
// 并做三道检验。AI 只负责理解，数字全部来自通用盲盒模型。翻译服务连不上时用离线回放。
// “找错练习”（研究方案 8.3）把翻错的记录和真实回放混在一起，学生通过程序复述找出翻错的。

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { TopicShell } from "../../../app/layouts"
import {
  EXAMPLE_UNKNOWN_KINDS,
  currentModelConditions,
  evaluateFreeCondition,
  formatNumber,
  formatProbability,
  headlineSpec,
  prepareFreeCondition,
  readBack,
  sampleProblem,
  type CheckKind,
  type CheckResult,
  type FreeConditionReport,
  type FreeConditionSetup,
  type HeadlineSpec,
  type KindsSample,
  type PreparedFreeCondition,
  type Relation,
} from "../../../core/blindbox"
import { triggerBrowserDownload } from "../../../lib/export"
import {
  getTranslatorInfo,
  MAX_CONDITION_LENGTH,
  translateCondition,
  TranslatorError,
  type AssumptionId,
  type TranslatorErrorCode,
  type TranslatorInfo,
  type TranslatorResult,
} from "../../../lib/translator-client"
import type { FreeConditionWorkerResponse } from "../../../workers"
import FreeConditionWorker from "../../../workers/free-condition.worker.ts?worker&inline"
import { ASSUMPTIONS } from "../assumptions"
import { summarizeChecks, ThreeChecks } from "../ThreeChecks"
import { REPLAY_RECORDS, REPLAY_SOURCE } from "./replay-records"
import {
  expectedPick,
  firstJudgements,
  spotOutcome,
  summarizeSpot,
  type SpotExpected,
  type SpotJudgement,
  type SpotOutcome,
  type SpotPick,
  type SpotRecord,
} from "./spot-the-error"
import { SPOT_RECORDS, SPOT_SOURCE } from "./spot-the-error-records"
import "./free-condition.css"

type Mode = "live" | "replay" | "exercise"
/** 学生自己先判断：打破了哪条、都没打破（只换了数字）、说不准。 */
type Pick = SpotPick
type Guess = Relation | "unsure"

const SPOT_OUTCOME_TEXT: Readonly<Record<SpotOutcome, string>> = {
  caught: "你点了“不对”，找出来了",
  missed: "你确认了，没找出来",
  accepted: "你确认了，判断正确",
  "false-reject": "你点了“不对”，其实这条翻对了",
}

const EXAMPLES = [
  { id: "A1-fraction", label: "隐藏款" },
  { id: "A3", label: "限量库存" },
  { id: "A4", label: "保底规则" },
  { id: "A5-goal", label: "合买交换" },
  { id: "A2-within", label: "限定盒数" },
  { id: "A6-sample", label: "未知款数" },
]

const ERROR_TEXT: Readonly<Record<TranslatorErrorCode, string>> = {
  unavailable: "翻译服务暂不可用，可以改用离线回放。",
  rejected: "AI 的回复没有通过格式或数字检查，换个说法再试。",
  timeout: "AI 回复太慢，超时了，可以再试一次。",
  upstream: "大模型服务出错或限流了，等一分钟再试。",
  "upstream-auth": "翻译服务暂时无法调用模型，可以改用离线回放。",
  "invalid-request": `条件不能为空，也不能超过 ${MAX_CONDITION_LENGTH} 字。`,
  "invalid-response": "收到的回复格式不对。",
  network: "连不上翻译服务，请重试或改用离线回放。",
}

const CONNECTION_ERRORS: readonly TranslatorErrorCode[] = [
  "unavailable",
  "timeout",
  "upstream",
  "upstream-auth",
  "network",
  "invalid-response",
]

interface Attempt {
  readonly id: number
  readonly mode: Mode
  readonly text: string
  readonly pick: Pick
  readonly result: TranslatorResult
  /** 能翻译、只改数字时的严格解析结果；追问和超出范围时为 null。 */
  readonly prepared: PreparedFreeCondition | null
  readonly durationMs: number
  readonly at: string
  /** 找错练习的这一条；其余方式为 null。 */
  readonly spot: SpotRecord | null
}

/** 导出的记录：只有条件、判断和结果，不含任何个人信息。 */
interface HistoryEntry {
  readonly attemptId: number
  readonly at: string
  readonly mode: Mode
  readonly condition: string
  readonly studentPick: Pick
  readonly ai: TranslatorResult
  readonly durationMs: number
  readonly strict: { readonly ok: boolean; readonly level: string; readonly issues: readonly string[] } | null
  readonly readBack: "confirmed" | "rejected" | null
  readonly guess: Guess | null
  readonly result: {
    readonly label: string
    readonly value: number
    readonly reference: { readonly label: string; readonly value: number }
    readonly relation: Relation
    readonly source: FreeConditionReport["source"]
    readonly runs: number
    readonly seed: number
    readonly checks: readonly { readonly kind: CheckKind; readonly name: string; readonly status: CheckResult["status"] }[]
  } | null
  /** 找错练习（研究方案 8.3）：是不是翻错的记录、标准答案、学生自己先选对没有。其余方式为 null。 */
  readonly spot: {
    readonly id: string
    readonly wrong: boolean
    readonly expected: SpotExpected
    /** 这一条没有标准答案（超出范围，或追问又看不出是哪条）时为 null。 */
    readonly ownPickRight: boolean | null
  } | null
}

function pickLabel(pick: Pick): string {
  if (pick === "none") return "都没打破，只换了数字"
  if (pick === "unsure") return "说不准"
  const assumption = ASSUMPTIONS.find((item) => item.id === pick)
  return `${pick} ${assumption?.short ?? ""}`
}

function aiPick(result: TranslatorResult): Pick | null {
  if (result.status === "parameter-only") return "none"
  if (result.status === "translated") return result.translation.brokenAssumption
  return null
}

function aiVerdict(result: TranslatorResult): string {
  const { brokenAssumption } = result.translation
  switch (result.status) {
    case "translated":
      return `AI 认为打破了 ${pickLabel(brokenAssumption ?? "unsure")}`
    case "parameter-only":
      return "AI 认为没有打破假设，只换了理想模型里的数字"
    case "clarify":
      return brokenAssumption === null
        ? "AI 需要你补充信息"
        : `AI 认出可能和 ${pickLabel(brokenAssumption)} 有关，但还缺信息`
    case "out-of-scope":
      return "AI 认为这超出了通用模型的范围"
  }
}

function pickComparison(pick: Pick, result: TranslatorResult): { readonly text: string; readonly match: boolean | null } | null {
  const ai = aiPick(result)
  if (ai === null) return { text: `你的判断：${pickLabel(pick)}。`, match: null }
  if (pick === "unsure") return { text: "你选了“说不准”，先核对下面的计算条件。", match: null }
  if (pick === ai) return { text: `和你的判断一致：${pickLabel(ai)}。`, match: true }
  return {
    text: `和你的判断不同：你选的是 ${pickLabel(pick)}。请核对下面的条件。`,
    match: false,
  }
}

function formatValue(value: number, spec: HeadlineSpec): string {
  return spec.probability ? formatProbability(value) : `${formatNumber(value)} ${spec.unit}`
}

function relationText(relation: Relation, spec: HeadlineSpec): string {
  if (relation === "higher") return spec.higher
  if (relation === "lower") return spec.lower
  return "差不多"
}

function parseCount(text: string): number | null {
  if (!/^\s*\d+\s*$/u.test(text)) return null
  return Number(text)
}

/** 公布答案时，正确的翻译用程序复述写出来。 */
function expectedText(expected: SpotExpected): string {
  if (expected.status === "clarify") return "AI 应当追问缺的信息，不能自己补数字。"
  if (expected.status === "out-of-scope") return "AI 应当说明这超出了通用模型，需要新增一条假设。"
  const prepared = prepareFreeCondition(expected.parameterChanges ?? {})
  return prepared.ok ? readBack(prepared).map((line) => line.text).join(" ") : ""
}

function spotJudgements(history: readonly HistoryEntry[]): SpotJudgement[] {
  return history.flatMap((entry) =>
    entry.spot !== null && entry.readBack !== null
      ? [{ id: entry.spot.id, pick: entry.studentPick, decision: entry.readBack }]
      : [],
  )
}

function timestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

/** 在 Worker 里计算；测试环境没有 Worker 时退回主线程。返回取消函数。 */
function startEvaluation(
  setup: FreeConditionSetup,
  sample: KindsSample | null,
  onDone: (response: FreeConditionWorkerResponse) => void,
): () => void {
  if (typeof Worker === "undefined") {
    const timer = window.setTimeout(() => {
      try {
        onDone({ id: 0, ok: true, report: evaluateFreeCondition(setup, sample) })
      } catch (error: unknown) {
        onDone({ id: 0, ok: false, message: error instanceof Error ? error.message : String(error) })
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }
  const worker = new FreeConditionWorker()
  worker.addEventListener("message", (event: MessageEvent<FreeConditionWorkerResponse>) => {
    onDone(event.data)
    worker.terminate()
  })
  worker.addEventListener("error", () => {
    onDone({ id: 0, ok: false, message: "计算没能启动，请重试。" })
    worker.terminate()
  })
  worker.postMessage({ id: 0, setup, sample })
  return () => worker.terminate()
}

export default function FreeConditionPage() {
  // 公开演示版只使用预录结果，既不展示实时入口，也不请求翻译服务。
  const offlineDemo = import.meta.env.VITE_OFFLINE_DEMO === "true"
  const [mode, setMode] = useState<Mode>(offlineDemo ? "replay" : "live")
  const [service, setService] = useState<TranslatorInfo | null | "checking">(offlineDemo ? null : "checking")
  const [text, setText] = useState("")
  const [replayId, setReplayId] = useState<string | null>(null)
  const [spotId, setSpotId] = useState<string | null>(null)
  const [spotRevealedAt, setSpotRevealedAt] = useState<string | null>(null)
  const [pick, setPick] = useState<Pick | null>(null)
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState<TranslatorErrorCode | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [decision, setDecision] = useState<"confirmed" | "rejected" | null>(null)
  const [guess, setGuess] = useState<Guess | null>(null)
  const [sampleInput, setSampleInput] = useState({ singletons: "", doubletons: "" })
  const [computing, setComputing] = useState(false)
  const [report, setReport] = useState<FreeConditionReport | null>(null)
  const [computeError, setComputeError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const cancelEvaluationRef = useRef<(() => void) | null>(null)
  const attemptCounter = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const checkService = useCallback((signal?: AbortSignal, switchIfMissing = false) => {
    setService("checking")
    getTranslatorInfo(signal)
      .then((info) => {
        setService(info)
        if (info === null && switchIfMissing) setMode("replay")
      })
      .catch(() => {
        // 页面已离开，忽略。
      })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    if (!offlineDemo) checkService(controller.signal, true)
    return () => {
      controller.abort()
      abortRef.current?.abort()
      cancelEvaluationRef.current?.()
    }
  }, [checkService, offlineDemo])

  const selectedRecord = REPLAY_RECORDS.find((record) => record.id === replayId) ?? null
  const selectedSpot = SPOT_RECORDS.find((record) => record.id === spotId) ?? null
  const condition =
    mode === "replay" ? selectedRecord?.text ?? "" : mode === "exercise" ? selectedSpot?.text ?? "" : text.trim()
  const judgements = useMemo(() => spotJudgements(history), [history])
  const judged = useMemo(() => firstJudgements(judgements), [judgements])
  const spotLocked = mode === "exercise" && selectedSpot !== null && (judged.has(selectedSpot.id) || spotRevealedAt !== null)
  const prepared = attempt?.prepared ?? null
  const setup: FreeConditionSetup | null = prepared !== null && prepared.ok ? prepared : null

  const needsSample =
    setup !== null &&
    setup.question.kind === "unknown-kinds" &&
    setup.question.observedKinds !== null &&
    setup.question.draws !== null
  const singletons = parseCount(sampleInput.singletons)
  const doubletons = parseCount(sampleInput.doubletons)
  const sample: KindsSample | null =
    needsSample && singletons !== null && doubletons !== null ? { singletons, doubletons } : null
  const sampleError = !needsSample || setup === null
    ? null
    : sample === null
      ? "填好这两个数，才能用 Chao1 估计。"
      : sampleProblem(setup.question, sample)

  const spec = useMemo(() => {
    if (setup === null) return null
    try {
      return headlineSpec(setup, needsSample ? { singletons: 0, doubletons: 0 } : null)
    } catch {
      return null
    }
  }, [setup, needsSample])

  const lines = useMemo(() => (setup === null ? [] : readBack(setup)), [setup])

  const updateEntry = useCallback((attemptId: number, patch: Partial<HistoryEntry>) => {
    setHistory((items) => items.map((item) => (item.attemptId === attemptId ? { ...item, ...patch } : item)))
  }, [])

  const resetDownstream = () => {
    cancelEvaluationRef.current?.()
    cancelEvaluationRef.current = null
    setDecision(null)
    setGuess(null)
    setSampleInput({ singletons: "", doubletons: "" })
    setComputing(false)
    setReport(null)
    setComputeError(null)
  }

  const finishTranslation = (
    conditionText: string,
    result: TranslatorResult,
    durationMs: number,
    from: Mode,
    studentPick: Pick,
    spot: SpotRecord | null = null,
  ) => {
    const translatedPrepared =
      result.status === "translated" || result.status === "parameter-only"
        ? prepareFreeCondition(result.translation.parameterChanges)
        : null
    attemptCounter.current += 1
    const next: Attempt = {
      id: attemptCounter.current,
      mode: from,
      text: conditionText,
      pick: studentPick,
      result,
      prepared: translatedPrepared,
      durationMs,
      at: new Date().toISOString(),
      spot,
    }
    const rightPick = spot === null ? null : expectedPick(spot.expected)
    setAttempt(next)
    setHistory((items) => [
      ...items,
      {
        attemptId: next.id,
        at: next.at,
        mode: from,
        condition: conditionText,
        studentPick,
        ai: result,
        durationMs,
        strict:
          translatedPrepared === null
            ? null
            : {
                ok: translatedPrepared.ok,
                level: translatedPrepared.level,
                issues: translatedPrepared.ok ? [] : translatedPrepared.issues,
              },
        readBack: null,
        guess: null,
        result: null,
        spot:
          spot === null
            ? null
            : {
                id: spot.id,
                wrong: spot.wrong,
                expected: spot.expected,
                ownPickRight: rightPick === null ? null : studentPick === rightPick,
              },
      },
    ])
  }

  const submit = async () => {
    if (pick === null || condition.length === 0 || translating) return
    resetDownstream()
    setTranslateError(null)
    setAttempt(null)

    if (mode === "replay") {
      if (selectedRecord !== null) {
        finishTranslation(selectedRecord.text, selectedRecord.result, selectedRecord.durationMs, "replay", pick)
      }
      return
    }
    if (mode === "exercise") {
      if (selectedSpot !== null && !spotLocked) finishTranslation(selectedSpot.text, selectedSpot.result, 0, "exercise", pick, selectedSpot)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setTranslating(true)
    const started = performance.now()
    try {
      const result = await translateCondition(condition, controller.signal)
      if (!controller.signal.aborted) {
        finishTranslation(condition, result, Math.round(performance.now() - started), "live", pick)
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setTranslateError(error instanceof TranslatorError ? error.code : "upstream")
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setTranslating(false)
      }
    }
  }

  const cancelTranslation = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setTranslating(false)
  }

  const switchMode = (next: Mode) => {
    if (offlineDemo && next === "live") return
    if (next === mode) return
    cancelTranslation()
    setMode(next)
    setTranslateError(null)
    if (next === "live") checkService()
  }

  const confirm = () => {
    if (attempt === null || setup === null || guess === null || sampleError !== null) return
    setDecision("confirmed")
    setComputing(true)
    setComputeError(null)
    updateEntry(attempt.id, { readBack: "confirmed", guess })
    const attemptId = attempt.id
    cancelEvaluationRef.current = startEvaluation(setup, needsSample ? sample : null, (response) => {
      cancelEvaluationRef.current = null
      setComputing(false)
      if (!response.ok) {
        setComputeError(response.message)
        return
      }
      const { report: computed } = response
      setReport(computed)
      updateEntry(attemptId, {
        result: {
          label: computed.spec.label,
          value: computed.value,
          reference: computed.spec.reference,
          relation: computed.relation,
          source: computed.source,
          runs: computed.runs,
          seed: computed.seed,
          checks: computed.checks.map(({ kind, name, status }) => ({ kind, name, status })),
        },
      })
    })
  }

  const reject = () => {
    if (attempt === null) return
    setDecision("rejected")
    updateEntry(attempt.id, { readBack: "rejected" })
    if (mode === "live") textareaRef.current?.focus()
  }

  const selectSpot = (id: string) => {
    setSpotId(id)
    // 每一条都要先自己判断，不沿用上一条的选择。
    setPick(null)
  }

  const exportHistory = () => {
    const now = new Date()
    const usedSpot = history.some((entry) => entry.spot !== null)
    const payload = {
      app: "数学探究实验室 · 自由提条件",
      exportedAt: now.toISOString(),
      translator: typeof service === "object" && service !== null ? service : null,
      replaySource: REPLAY_SOURCE,
      note: "只记录条件、判断和结果，不含姓名、学校等个人信息。",
      spot: usedSpot
        ? {
            note: "找错练习（研究方案 8.3）：spot.wrong 为 true 的是翻错的记录；每条只算第一次判断。",
            source: SPOT_SOURCE,
            revealedAt: spotRevealedAt,
            summary: summarizeSpot(SPOT_RECORDS, judgements),
          }
        : null,
      entries: history,
    }
    triggerBrowserDownload(
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
      `自由提条件记录_${timestamp(now)}.json`,
    )
  }

  const comparison = attempt === null ? null : pickComparison(attempt.pick, attempt.result)
  const canSubmit = pick !== null && condition.length > 0 && !translating && !spotLocked
  const spotSummary = summarizeSpot(SPOT_RECORDS, judgements)
  const spotIndex = (record: SpotRecord) => SPOT_RECORDS.indexOf(record) + 1
  const currentStep = report !== null || computing ? 3 : attempt !== null && decision !== "rejected" ? 2 : 1

  return (
    <TopicShell topicId="blind-box" module="free-condition">
      <section className="free-page">
        <header className="free-intro">
          <div className="free-intro__title">
            <h1>换个条件，答案会怎样？</h1>
          </div>
          <ol aria-label="学习流程">
            {["提出条件", "核对与猜想", "查看结果"].map((label, index) => (
              <li key={label} className={index + 1 < currentStep ? "is-complete" : ""} aria-current={index + 1 === currentStep ? "step" : undefined}>
                <span>{index + 1 < currentStep ? "✓" : `0${index + 1}`}</span>{label}
              </li>
            ))}
          </ol>
        </header>

        <div className="free-workbench">
          <section className="free-panel free-panel--input" aria-labelledby="free-input-title">
            <header>
              <span className="free-panel__number">01</span>
              <div><h2 id="free-input-title">提出你的条件</h2><small>从一条生活中的规则开始</small></div>
            </header>
            <div className="free-panel__body">
              <div className="free-mode" role="group" aria-label="翻译方式">
                {!offlineDemo && <button type="button" aria-pressed={mode === "live"} onClick={() => switchMode("live")}>实时翻译</button>}
                <button type="button" aria-pressed={mode === "replay"} onClick={() => switchMode("replay")}>离线回放</button>
                {(!offlineDemo || SPOT_RECORDS.length > 0) && <button type="button" aria-pressed={mode === "exercise"} onClick={() => switchMode("exercise")}>找错练习</button>}
              </div>
              {offlineDemo && <p className="free-status is-replay">公开演示使用预先录制的 AI 翻译，请选择已有的条件进行探究。</p>}

              <details className="free-service">
                <summary className={`free-connection${mode === "exercise" || (mode === "live" && service === null) ? " is-warning" : ""}`}>
                  <span aria-hidden="true" />
                  {mode === "live" ? service === "checking" ? "正在连接…" : service === null ? "服务暂不可用" : "实时翻译已就绪" : mode === "replay" ? "使用已录制的翻译" : SPOT_RECORDS.length === 0 ? "练习暂未开放" : "找出翻译中的问题"}
                  <small>详情</small>
                </summary>
                {mode === "live" ? (
                  <p className={`free-status${service === null ? " is-warning" : ""}`} role="status">
                    {service === "checking"
                      ? "正在检查翻译服务……"
                      : service === null
                        ? "翻译服务暂不可用，可重新检查或选择离线回放。"
                        : `已连接翻译服务，模型：${service.model}`}
                    {service === null && (
                      <button type="button" className="free-link" onClick={() => checkService()}>重新检查</button>
                    )}
                  </p>
                ) : mode === "replay" ? (
                  <p className="free-status is-replay" role="status">
                    回放：{REPLAY_SOURCE.model} 在 {REPLAY_SOURCE.ranAt[0]?.slice(0, 10)} 真实翻译过的 {REPLAY_RECORDS.length} 条条件，不连网。
                  </p>
                ) : SPOT_RECORDS.length === 0 ? (
                  <p className="free-status is-warning" role="status">
                    找错练习还没有准备好：翻错的记录由项目作者编写，完成后即可使用。
                  </p>
                ) : (
                  <p className="free-status is-exercise" role="status">
                    {SPOT_RECORDS.length} 条翻译中有几条存在错误。核对程序复述，发现错误就点“不对”；全部完成后查看答案。
                  </p>
                )}
              </details>

              {mode === "live" ? (
                <div className="free-field">
                  <label htmlFor="free-condition-text">你的条件</label>
                  <textarea
                    id="free-condition-text"
                    ref={textareaRef}
                    rows={2}
                    maxLength={MAX_CONDITION_LENGTH}
                    value={text}
                    placeholder="例如：店里这个系列只剩 12 盒了，每款 2 盒。"
                    onChange={(event) => setText(event.target.value)}
                  />
                  <small className="free-field__meta"><span>不填写姓名、学校等个人信息</span><span>{text.length}/{MAX_CONDITION_LENGTH}</span></small>
                  <div className="free-examples" aria-label="例子">
                    <span>试试这些</span>
                    {EXAMPLES.map(({ id, label }) => {
                      const record = REPLAY_RECORDS.find((item) => item.id === id)
                      return record === undefined ? null : (
                        <button key={id} type="button" aria-label={record.text} title={record.text} onClick={() => setText(record.text)}>{label}</button>
                      )
                    })}
                  </div>
                </div>
              ) : mode === "exercise" ? (
                SPOT_RECORDS.length > 0 && (
                  <div className="free-field">
                    <span className="free-field__label" id="free-spot-label">
                      选一条练习<small>已判断 {spotSummary.judged}/{spotSummary.total}</small>
                    </span>
                    <ul className="free-replay-list free-spot-list" aria-labelledby="free-spot-label">
                      {SPOT_RECORDS.map((record, index) => (
                        <li key={record.id}>
                          <button type="button" aria-pressed={spotId === record.id} onClick={() => selectSpot(record.id)}>
                            <b>{index + 1}</b>
                            <span>{record.text}</span>
                            {judged.has(record.id) && <small>已判断</small>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              ) : (
                <div className="free-field">
                  <label htmlFor="free-replay-condition">选一条录好的条件</label>
                  <select id="free-replay-condition" value={replayId ?? ""} onChange={(event) => setReplayId(event.target.value || null)}>
                    <option value="">选择一个情境…</option>
                    {REPLAY_RECORDS.map((record) => <option key={record.id} value={record.id}>{record.text}</option>)}
                  </select>
                  {selectedRecord !== null && <p className="free-selected-condition">{selectedRecord.text}</p>}
                </div>
              )}

              <fieldset className="free-picks">
                <legend>你觉得，哪条假设变了？<small>先自己选，再看 AI 的判断</small></legend>
                {ASSUMPTIONS.map((item) => (
                  <button key={item.id} type="button" aria-pressed={pick === item.id} onClick={() => setPick(item.id)}>
                    <b>{item.id}</b> {item.short}
                  </button>
                ))}
                <button type="button" aria-label="都没打破，只换了数字" aria-pressed={pick === "none"} onClick={() => setPick("none")}>只换了数字</button>
                <button type="button" aria-pressed={pick === "unsure"} onClick={() => setPick("unsure")}>说不准</button>
              </fieldset>

              {mode === "exercise" && SPOT_RECORDS.length > 0 && (
                spotRevealedAt === null ? (
                  spotSummary.judged === spotSummary.total && (
                    <button type="button" className="is-primary" onClick={() => setSpotRevealedAt(new Date().toISOString())}>
                      公布答案
                    </button>
                  )
                ) : (
                  <SpotAnswers judgements={judgements} />
                )
              )}
              {translating && <p className="free-progress" role="status">AI 正在理解条件，请稍候。</p>}
              {translateError !== null && (
                <div className="free-error" role="alert">
                  <p>{ERROR_TEXT[translateError]}</p>
                  {CONNECTION_ERRORS.includes(translateError) && (
                    <button type="button" onClick={() => switchMode("replay")}>改用离线回放</button>
                  )}
                </div>
              )}
            </div>
            <footer className="free-input-footer">
              <div className="free-actions">
                <button type="button" className="is-primary" disabled={!canSubmit} onClick={() => void submit()}>
                  {translating ? "正在翻译…" : mode === "live" ? "交给 AI 翻译" : mode === "exercise" ? "看 AI 的翻译" : "回放 AI 的翻译"}
                  {!translating && <span aria-hidden="true">→</span>}
                </button>
                {translating && <button type="button" onClick={cancelTranslation}>取消</button>}
              </div>
              {!canSubmit && !translating && !(mode === "exercise" && SPOT_RECORDS.length === 0) && (
                <small className="free-hint">
                  {condition.length === 0
                    ? mode === "live" ? "先写一条条件。" : mode === "exercise" ? "先选一条练习。" : "先选一条条件。"
                    : spotLocked
                      ? spotRevealedAt !== null ? "练习做完了，答案在下面。" : "这一条已经判断过了，选下一条。"
                      : "先选你自己的判断。"}
                </small>
              )}
              <div className="free-history">
                <span>本次已提 {history.length} 条条件</span>
                <button type="button" aria-label="导出记录（JSON）" disabled={history.length === 0} onClick={exportHistory}>导出记录 ↗</button>
              </div>
            </footer>
          </section>

          <section className="free-panel free-panel--readback" aria-labelledby="free-readback-title">
            <header>
              <span className="free-panel__number">02</span>
              <div><h2 id="free-readback-title">核对理解，做个猜想</h2><small>确认程序理解了你的意思</small></div>
              <span className={`free-panel__state${attempt !== null ? " is-ready" : ""}`}>{attempt === null ? "待提交" : decision === "confirmed" ? "已确认" : decision === "rejected" ? "待修改" : "待核对"}</span>
            </header>
            <div className="free-panel__body">
              {attempt === null ? (
                <div className="free-empty">
                  <EmptyIllustration kind="readback" />
                  <h3>让想法变成可计算的条件</h3>
                  <p>提交后，核对 AI 的判断和程序复述，<br />再猜一猜答案会怎样变化。</p>
                </div>
              ) : (
                <>
                  <p className={`free-source is-${attempt.mode}`}>
                    {attempt.mode === "replay"
                      ? `回放 · ${REPLAY_SOURCE.model} 录制 · 当时用时 ${formatNumber(attempt.durationMs / 1000)} 秒`
                      : attempt.mode === "exercise" && attempt.spot !== null
                        ? `找错练习 · 第 ${spotIndex(attempt.spot)} 条 · 这条 AI 可能翻对了，也可能翻错了`
                        : `实时 · 用时 ${formatNumber(attempt.durationMs / 1000)} 秒`}
                  </p>
                  <section className={`free-ai is-${attempt.result.status}`}>
                    <strong>{aiVerdict(attempt.result)}</strong>
                    {comparison !== null && (
                      <p className={comparison.match === true ? "is-match" : comparison.match === false ? "is-mismatch" : undefined}>
                        {comparison.text}
                      </p>
                    )}
                    <details className="free-ai__explanation">
                      <summary>为什么这样判断</summary>
                      <blockquote>
                        {attempt.result.translation.explanationForStudent}
                      </blockquote>
                    </details>
                    {attempt.result.status === "clarify" && attempt.result.translation.clarifyingQuestion !== null && (
                      <p className="free-ask"><b>AI 追问：</b>{attempt.result.translation.clarifyingQuestion}</p>
                    )}
                    {attempt.result.status === "clarify" && (
                      <p className="free-next">把缺的信息补进条件里，再提交一次。</p>
                    )}
                    {attempt.result.status === "out-of-scope" && (
                      <p className="free-next">当前模型暂时无法计算。这条条件已保存，可用于后续扩展模型。</p>
                    )}
                  </section>

                  {prepared !== null && !prepared.ok && (
                    <div className="free-error" role="alert">
                      <p>AI 的翻译没有通过实验室的严格检查，程序没法按它计算。请换个说法再试。</p>
                      <details>
                        <summary>检查发现的问题</summary>
                        <ul>{prepared.issues.map((issue) => <li key={issue}><code>{issue}</code></li>)}</ul>
                      </details>
                    </div>
                  )}

                  {setup !== null && (
                    <section className="free-readback" aria-label="程序复述">
                      <h3>程序将这样计算</h3>
                      <dl>
                        {lines.map((line) => (
                          <div key={line.topic}>
                            <dt>{line.topic}</dt>
                            <dd>{line.text.startsWith(`${line.topic}：`) ? line.text.slice(line.topic.length + 1) : line.text}</dd>
                          </div>
                        ))}
                      </dl>
                      <details className="free-disclosure free-base-conditions">
                        <summary>{setup.question.kind === "unknown-kinds" ? "估计方法与模拟条件" : "完整模型条件"}</summary>
                        {setup.question.kind === "unknown-kinds" ? (
                          <div>
                            <p className="free-note">用 Chao1 从样本估计款数，再用真实 {EXAMPLE_UNKNOWN_KINDS} 款等概率的示例检验估计。</p>
                          </div>
                        ) : (
                          <p className="free-note">{currentModelConditions(setup)}</p>
                        )}
                      {setup.level === "L1" && (
                        <p className="free-note">涉及隐藏款的规则，以含隐藏款的 L1 模型为基础。</p>
                      )}
                      </details>

                      {needsSample && setup.question.kind === "unknown-kinds" && (
                        <fieldset className="free-sample" disabled={decision !== null}>
                          <legend>要估计一共几款，还要知道你见到的 {setup.question.observedKinds} 款里：</legend>
                          <label>
                            <span>只买到过 1 次的有几款</span>
                            <input
                              inputMode="numeric"
                              value={sampleInput.singletons}
                              onChange={(event) => setSampleInput((value) => ({ ...value, singletons: event.target.value }))}
                            />
                          </label>
                          <label>
                            <span>只买到过 2 次的有几款</span>
                            <input
                              inputMode="numeric"
                              value={sampleInput.doubletons}
                              onChange={(event) => setSampleInput((value) => ({ ...value, doubletons: event.target.value }))}
                            />
                          </label>
                          {sampleError !== null && <small>{sampleError}</small>}
                        </fieldset>
                      )}

                      {spec !== null && decision === null && (
                        <fieldset className="free-guess">
                          <legend>
                            先猜一猜<small>{spec.label}，相比{spec.reference.label}（{formatValue(spec.reference.value, spec)}）会怎样？</small>
                          </legend>
                          {(["higher", "lower", "similar", "unsure"] as const).map((value) => (
                            <button key={value} type="button" aria-pressed={guess === value} onClick={() => setGuess(value)}>
                              {value === "unsure" ? "说不准" : relationText(value, spec)}
                            </button>
                          ))}
                        </fieldset>
                      )}

                      {decision === null ? (
                        <div className="free-actions">
                          <button
                            type="button"
                            className="is-primary"
                            disabled={guess === null || sampleError !== null}
                            onClick={confirm}
                          >对，按这个计算</button>
                          <button type="button" onClick={reject}>不对，重新说</button>
                        </div>
                      ) : (
                        <p className="free-decision">
                          {attempt.mode === "exercise"
                            ? decision === "confirmed"
                              ? "你认为 AI 翻对了，确认了程序的复述。"
                              : "你认为 AI 翻错了。选下一条继续找。"
                            : decision === "confirmed"
                              ? "你确认了程序的复述。"
                              : "你认为复述不对。换个说法，重新提交。"}
                        </p>
                      )}
                      {decision === null && guess === null && <small className="free-hint">先猜一猜，再确认。</small>}
                    </section>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="free-panel free-panel--result" aria-labelledby="free-result-title">
            <header>
              <span className="free-panel__number">03</span>
              <div><h2 id="free-result-title">看看答案怎么变</h2><small>程序计算，三道检验</small></div>
              <span className={`free-panel__state${report !== null ? " is-ready" : ""}`}>{report !== null ? "已完成" : computing ? "计算中" : "待确认"}</span>
            </header>
            <div className="free-panel__body" aria-live="polite">
              {computing ? (
                <p className="free-progress" role="status">正在计算并检验结果…</p>
              ) : computeError !== null ? (
                <div className="free-error" role="alert"><p>计算出错：{computeError}</p></div>
              ) : report === null ? (
                <div className="free-empty">
                  <EmptyIllustration kind="result" />
                  <h3>一个新条件，一个新答案</h3>
                  <p>核对并确认条件后，<br />在这里查看结果、对比与检验。</p>
                </div>
              ) : (
                <ResultView report={report} guess={guess} />
              )}
            </div>
          </section>
        </div>
      </section>
    </TopicShell>
  )
}

function EmptyIllustration({ kind }: { readonly kind: "readback" | "result" }) {
  return (
    <div className={`free-empty__art is-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 112 96" fill="none">
        {kind === "readback" ? (
          <>
            <rect x="17" y="15" width="69" height="58" rx="12" />
            <path d="M31 33h37M31 44h28M31 55h18" />
            <rect x="65" y="53" width="30" height="30" rx="10" />
            <path className="free-empty__accent" d="m73 68 5 5 10-11" />
          </>
        ) : (
          <>
            <path d="M21 76h72" />
            <rect x="29" y="47" width="14" height="29" rx="4" />
            <rect x="50" y="33" width="14" height="43" rx="4" />
            <rect x="71" y="17" width="14" height="59" rx="4" />
            <path className="free-empty__accent" d="m26 32 20-13 14 3M52 14l8 8-9 5" />
          </>
        )}
      </svg>
    </div>
  )
}

/** 找错练习的答案：每一条翻对还是翻错、学生找没找出来，翻错的给出错在哪里和正确的复述。 */
function SpotAnswers({ judgements }: { readonly judgements: readonly SpotJudgement[] }) {
  const summary = summarizeSpot(SPOT_RECORDS, judgements)
  const first = firstJudgements(judgements)
  return (
    <section className="free-spot-answers" aria-label="找错练习的答案">
      <h2>答案</h2>
      <p>
        翻错的 {summary.wrong} 条，你找出了 {summary.caught} 条；翻对的 {summary.correct} 条，你点了“不对”的有 {summary.falseRejects} 条。
      </p>
      <ol>
        {SPOT_RECORDS.map((record) => {
          const judgement = first.get(record.id)
          const outcome = judgement === undefined ? null : spotOutcome(record.wrong, judgement.decision)
          const good = outcome === "caught" || outcome === "accepted"
          return (
            <li key={record.id} className={record.wrong ? "is-wrong" : "is-right"}>
              <strong>{record.text}</strong>
              <span className={good ? "is-match" : "is-mismatch"}>
                {record.wrong ? "AI 翻错了" : "AI 翻对了"} · {outcome === null ? "你没有判断" : SPOT_OUTCOME_TEXT[outcome]}
              </span>
              {record.whatIsWrong !== null && <p>错在哪里：{record.whatIsWrong}</p>}
              {record.wrong && <p>正确的应当是：{expectedText(record.expected)}</p>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function ResultView({ report, guess }: { readonly report: FreeConditionReport; readonly guess: Guess | null }) {
  const { spec } = report
  const difference = report.value - spec.reference.value
  const { passed, failed, unchecked } = summarizeChecks(report.checks)
  const comparisonMax = Math.max(report.value, spec.reference.value)
  const canCompare = Number.isFinite(comparisonMax) && Number.isFinite(report.value) && Number.isFinite(spec.reference.value)
    && report.value >= 0 && spec.reference.value >= 0 && comparisonMax > 0
  const checkGroups = [
    { kind: "degeneracy", label: "退化检验" },
    { kind: "dual-path", label: "双路验证" },
    { kind: "direction", label: "方向检验" },
  ] as const

  return (
    <>
      <section className="free-headline" aria-label="结果">
        <div className="free-headline__label"><span>{spec.label}</span><small>{report.source === "exact" ? "理论值" : "模拟值"}</small></div>
        <strong>{formatValue(report.value, spec)}</strong>
        <span className="free-headline__change">
          {relationText(report.relation, spec)}
          {!spec.probability && Number.isFinite(difference) && ` · ${difference > 0 ? "+" : ""}${formatNumber(difference)} ${spec.unit}`}
        </span>
      </section>
      <section className="free-comparison" aria-label="条件变化前后对比">
        <h3>结果对比</h3>
        <p className="free-note">基准：{spec.reference.label}</p>
        {canCompare ? (
          <div className="free-comparison__chart">
            {[{ label: "基准", value: spec.reference.value }, { label: "新条件", value: report.value }].map((item) => (
              <div key={item.label} className="free-comparison__row">
                <span>{item.label}</span>
                <div><i style={{ width: `${item.value / comparisonMax * 100}%` }} /></div>
                <b><span>{spec.probability ? formatProbability(item.value) : formatNumber(item.value)}</span>{!spec.probability && <small>{spec.unit}</small>}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="free-compare">基准值：{formatValue(spec.reference.value, spec)}</p>
        )}
      </section>
      {guess !== null && (
        <p className={`free-verdict${guess === report.relation ? " is-match" : guess === "unsure" ? "" : " is-mismatch"}`}>
          {guess === "unsure"
            ? "现在有了结果，想想它为什么这样变。"
            : guess === report.relation
              ? `你猜的是“${relationText(guess, spec)}”，猜对了。`
              : `你猜的是“${relationText(guess, spec)}”，再想想为什么不同。`}
        </p>
      )}

      {report.notes.map((note) => <p key={note} className="free-note">{note}</p>)}
      <section className="free-check-summary" aria-label="检验概览">
        <h3>三道检验</h3>
        <div>
          {checkGroups.map((group) => {
            const checks = report.checks.filter((check) => check.kind === group.kind)
            const status = checks.some((check) => check.status === "failed") ? "failed"
              : checks.length === 0 || checks.some((check) => check.status === "no-theory") ? "unchecked" : "passed"
            return (
              <div key={group.kind} className={`is-${status}`}>
                <span aria-hidden="true">{status === "passed" ? "✓" : status === "failed" ? "!" : "−"}</span>
                <strong>{group.label}</strong>
                <small>{status === "passed" ? "通过" : status === "failed" ? "不通过" : "未检验"}</small>
              </div>
            )
          })}
        </div>
      </section>
      <div className="free-result-details">
        <details className="free-disclosure">
          <summary>完整计算数据<span>{report.rows.length} 项</span></summary>
          <dl className="free-rows">
            {report.rows.map((row) => (
              <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
            ))}
          </dl>
          <p className="free-note">{report.source === "exact" ? "理论值来自公式或精确递推。" : "这一问没有理论值。"}模拟共 {report.runs} 轮，固定种子 {report.seed}。</p>
        </details>
        <details className="free-disclosure" open={failed > 0}>
          <summary>查看检验过程<span>{passed} 项通过{failed > 0 ? ` · ${failed} 项不通过` : ""}{unchecked > 0 ? ` · ${unchecked} 项未检验` : ""}</span></summary>
          <ThreeChecks checks={report.checks} />
        </details>
      </div>
      <p className="free-footnote">AI 理解条件 · 数字由程序计算与检验</p>
    </>
  )
}
