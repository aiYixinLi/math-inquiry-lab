// 建模阶梯 L0–L6（研究方案 6.2–6.8、7.6）：每一级按“设置参数 → 情境 → 猜想 → 找假设 → 做实验
// → 看理论 → 做检验”走一遍，做完检验才能完成这一级。猜想锁定之前看不到实验和理论值；数字全部
// 由通用盲盒模型算出。学习记录存在本机，可以导出给研究日志和同学试用。

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { TopicShell } from "../../../app/layouts"
import { getTopic } from "../../../app/topic-registry"
import { DEFAULT_SEED, readBack, type CheckResult } from "../../../core/blindbox"
import { triggerBrowserDownload } from "../../../lib/export"
import { MathFormula } from "../../../shared/learning/MathFormula"
import { StepArrow } from "../../../shared/learning/StepArrow"
import type { LadderWorkerRequest, LadderWorkerResponse } from "../../../workers"
import { handleLadderRequest } from "../../../workers/ladder-handler"
import LadderWorker from "../../../workers/ladder.worker.ts?worker&inline"
import { ASSUMPTIONS, assumptionById } from "../assumptions"
import { ThreeChecks, summarizeChecks } from "../ThreeChecks"
import { formatAnswer, sameControls } from "./lab-format"
import {
  ArrowRightIcon,
  BulbIcon,
  CheckCircleIcon,
  InfoIcon,
  LockIcon,
  PencilIcon,
  PlayIcon,
  ShieldIcon,
  SlidersIcon,
  SpinnerIcon,
} from "./ladder-icons"
import { LadderLab, type LabExperiment } from "./LadderLab"
import { LadderStage } from "./LadderStage"
import { LevelScene } from "./LevelScene"
import { SituationShelf } from "./SituationShelf"
import {
  DEFAULT_KINDS,
  L0_STATEMENT_ORDER,
  LADDER_LEVELS,
  LADDER_STEPS,
  describeSituation,
  goalWord,
  guessSpec,
  l0AssumptionStatements,
  ladderLevel,
  levelAnswer,
  levelInsight,
  levelModel,
  levelSetup,
  sanitizeKinds,
  type LadderControls,
  type LadderLevelId,
  type LevelAnswer,
  type LevelModel,
} from "./levels"
import {
  EMPTY_LEVEL_RECORD,
  loadLadderRecord,
  saveLadderRecord,
  type AssumptionPick,
  type LadderRecord,
  type LevelRecord,
} from "./progress"
import "./ladder.css"

const STEP_INDEX = Object.fromEntries(LADDER_STEPS.map((step, index) => [step.id, index])) as Record<
  (typeof LADDER_STEPS)[number]["id"],
  number
>

type ByLevel<T> = Record<LadderLevelId, T>

function byLevel<T>(make: (id: LadderLevelId) => T): ByLevel<T> {
  return { L0: make("L0"), L1: make("L1"), L2: make("L2"), L3: make("L3"), L4: make("L4"), L5: make("L5"), L6: make("L6") }
}

const LAST_LEVEL_ID: LadderLevelId = LADDER_LEVELS.at(-1)?.id ?? "L0"

/** 在 Worker 里计算；测试环境没有 Worker 时退回主线程。 */
function runTask(request: LadderWorkerRequest): { readonly done: Promise<LadderWorkerResponse>; readonly cancel: () => void } {
  if (typeof Worker === "undefined") {
    let timer = 0
    const done = new Promise<LadderWorkerResponse>((resolve) => {
      timer = window.setTimeout(() => resolve(handleLadderRequest(request)), 0)
    })
    return { done, cancel: () => window.clearTimeout(timer) }
  }
  const worker = new LadderWorker()
  const done = new Promise<LadderWorkerResponse>((resolve) => {
    worker.addEventListener("message", (event: MessageEvent<LadderWorkerResponse>) => {
      resolve(event.data)
      worker.terminate()
    })
    worker.addEventListener("error", () => {
      resolve({ id: request.id, ok: false, message: "计算没能启动，请重试。" })
      worker.terminate()
    })
  })
  worker.postMessage(request)
  return { done, cancel: () => worker.terminate() }
}

function safeAnswer(id: LadderLevelId, controls: LadderControls): LevelAnswer | null {
  try {
    return levelAnswer(id, controls)
  } catch {
    return null
  }
}

/** 这一级按几款算：L6 不用；已经猜过的固定为锁定猜想那时的款数，还没猜的跟着共用的款数走。 */
function situationKindsOf(id: LadderLevelId, levelRecord: LevelRecord, current: number): number {
  if (id === "L6") return DEFAULT_KINDS
  return levelRecord.guess !== null ? (levelRecord.guessKinds ?? DEFAULT_KINDS) : current
}

/** 这一级实验台的起点：“设置参数”里定下的；还没动过的按默认参数。 */
function initialControls(id: LadderLevelId, record: LadderRecord): LadderControls {
  const levelRecord = record.levels[id]
  return levelRecord.controls ?? ladderLevel(id, situationKindsOf(id, levelRecord, record.kinds)).defaults
}

function parseNumber(text: string): number | null {
  const value = Number(text.trim())
  return text.trim() !== "" && Number.isFinite(value) ? value : null
}

/** 退化检验的预测和程序结果是否算“一致”。 */
function closeEnough(prediction: number, value: number, unit: LevelAnswer["unit"]): boolean {
  const tolerance = unit === "%" ? 1 : Math.max(0.1, 0.02 * Math.abs(value))
  return Math.abs(prediction - value) <= tolerance
}

function timestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

/** 这一级的“找假设”交过答案、看到了对错和解释；在这之前，页面上不能出现“这一级打破哪一条”。 */
function levelJudged(record: LevelRecord): boolean {
  return record.listPicks !== null || record.assumptionPick !== null
}

function levelStatus(record: LevelRecord): string {
  if (record.completedAt !== null) return "已完成"
  if (record.reachedStep === 0 && record.guess === null) return "未开始"
  return `第 ${record.reachedStep + 1}/${LADDER_STEPS.length} 步`
}

/** 一级的 7 步走到哪了：已走过的亮着，做完整级全部亮着。 */
function LevelPips({ record }: { readonly record: LevelRecord }) {
  const started = record.reachedStep > 0 || record.guess !== null
  const lit = record.completedAt !== null ? LADDER_STEPS.length : started ? record.reachedStep + 1 : 0
  return (
    <span className="ladder-pips" aria-hidden="true">
      {LADDER_STEPS.map((item, index) => <i key={item.id} className={index < lit ? "is-lit" : undefined} />)}
    </span>
  )
}

/** “重新开始”按钮里的回转箭头：随按钮文字的颜色和字号走，只做装饰。 */
function RestartIcon() {
  return (
    <svg className="ladder-restart__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5v4.6h4.6" />
    </svg>
  )
}

export default function LadderPage() {
  const [record, setRecord] = useState<LadderRecord>(loadLadderRecord)
  const [viewSteps, setViewSteps] = useState<ByLevel<number>>(() => byLevel((id) => record.levels[id].reachedStep))
  const [controlsByLevel, setControlsByLevel] = useState<ByLevel<LadderControls>>(() => byLevel((id) => initialControls(id, record)))
  const [experiments, setExperiments] = useState<Partial<ByLevel<LabExperiment>>>({})
  const [checksByLevel, setChecksByLevel] = useState<Partial<ByLevel<readonly CheckResult[]>>>({})
  const [running, setRunning] = useState<"experiment" | "checks" | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [runs, setRuns] = useState(1_000)
  const [seedOffset, setSeedOffset] = useState(0)
  const [guessDraft, setGuessDraft] = useState("")
  const [editingGuess, setEditingGuess] = useState(false)
  const [listDraft, setListDraft] = useState<readonly number[]>([])
  const [pickDraft, setPickDraft] = useState<AssumptionPick | null>(null)
  const [degeneracyDraft, setDegeneracyDraft] = useState("")
  const [confirmReset, setConfirmReset] = useState(false)
  const cancels = useRef(new Set<() => void>())
  const requestId = useRef(0)

  useEffect(() => saveLadderRecord(record), [record])
  useEffect(() => {
    const pending = cancels.current
    return () => pending.forEach((cancel) => cancel())
  }, [])

  const kindCount = record.kinds
  const levelId = record.current
  const levelRecord = record.levels[levelId]
  // 这一级按几款算：锁定猜想之后固定为那时的款数，之后别的级再改共用的款数，这一级也不跟着变。
  const levelKinds = situationKindsOf(levelId, levelRecord, kindCount)
  const level = ladderLevel(levelId, levelKinds)
  const controls = controlsByLevel[levelId]
  const step = viewSteps[levelId]
  const reached = levelRecord.reachedStep
  const stepId = LADDER_STEPS[step]?.id ?? "situation"
  const answer = useMemo(() => safeAnswer(levelId, controls), [levelId, controls])
  // 猜想要和“设置参数”里定下的参数算出的理论值比；锁定猜想之后参数就固定了，实验台上再动（比如退化检验）也不影响这里。
  const situationControls = levelRecord.guess === null ? controls : (levelRecord.controls ?? level.defaults)
  const situationAnswer = useMemo(() => safeAnswer(levelId, situationControls), [levelId, situationControls])
  // 猜想的题面、提示和范围都按定下的参数写。
  const guess = useMemo(() => guessSpec(level, situationControls), [level, situationControls])
  // 参数在锁定猜想之前定下来，之后沿用；只有 L6 的例子世界要等找完假设揭晓，之后才能自己调着试。
  const paramsEditable = levelId === "L6" ? reached >= STEP_INDEX.experiment : levelRecord.guess === null
  // L0–L5 共用的款数：锁定猜想之前随时能改，锁定之后这一级就固定了。
  const kindsEditable = levelId !== "L6" && levelRecord.guess === null
  const setting = useMemo(() => {
    try {
      return readBack(levelSetup(levelId, controls))
    } catch {
      return []
    }
  }, [levelId, controls])
  // 集全套又有很大的保底时要逐盒推进几千步，只在看理论这一步、参数变了才重算。
  const insight = useMemo(() => (stepId === "theory" ? levelInsight(levelId, controls) : ""), [stepId, levelId, controls])
  const modelNow = useMemo<LevelModel | null>(() => {
    try {
      return levelModel(levelId, controls)
    } catch {
      return null
    }
  }, [levelId, controls])
  const experiment = experiments[levelId] ?? null
  const checks = checksByLevel[levelId] ?? null
  const theoryVisible = reached >= STEP_INDEX.theory
  const listRevealed = record.levels.L0.listPicks !== null
  // 交答案之前，假设清单、左侧的级别条目和标题都不透露这一级打破哪一条；之后才亮出来。
  const assumptionJudged = levelJudged(levelRecord)

  const updateLevel = useCallback((id: LadderLevelId, patch: (previous: LevelRecord) => Partial<LevelRecord>) => {
    setRecord((previous) => ({
      ...previous,
      levels: { ...previous.levels, [id]: { ...previous.levels[id], ...patch(previous.levels[id]) } },
    }))
  }, [])

  // 和 LADDER_STEPS 一一对应：设置参数、情境、猜想、找假设、做实验、看理论、做检验。
  const stepDone = [
    true,
    true,
    levelRecord.guess !== null,
    level.assumption.kind === "list" ? levelRecord.listPicks !== null : levelRecord.assumptionPick !== null,
    levelRecord.experiments.length > 0,
    true,
    levelRecord.degeneracyValue !== null && levelRecord.checks !== null,
  ]

  const goToStep = (index: number) => {
    if (index > reached) return
    setViewSteps((previous) => ({ ...previous, [levelId]: index }))
  }

  const advance = () => {
    if (!stepDone[step] || step >= LADDER_STEPS.length - 1) return
    const next = step + 1
    setViewSteps((previous) => ({ ...previous, [levelId]: next }))
    updateLevel(levelId, (previous) => ({ reachedStep: Math.max(previous.reachedStep, next) }))
  }

  const openLevel = (id: LadderLevelId) => {
    setRecord((previous) => ({ ...previous, current: id }))
    setGuessDraft("")
    setEditingGuess(false)
    setListDraft([])
    setPickDraft(null)
    setDegeneracyDraft("")
    setTaskError(null)
  }

  /** L0–L5 共用的款数：写进记录，也同步到还没锁定猜想的各级（锁定了的已经按那时的款数定下来了）。 */
  const setKinds = (value: number) => {
    const kinds = sanitizeKinds(value)
    const open = (id: LadderLevelId) => id !== "L6" && record.levels[id].guess === null
    setRecord((previous) => ({
      ...previous,
      kinds,
      levels: byLevel((id) => {
        const item = previous.levels[id]
        return open(id) && item.controls !== null ? { ...item, controls: { ...item.controls, kinds } } : item
      }),
    }))
    setControlsByLevel((previous) => byLevel((id) => (open(id) ? { ...previous[id], kinds } : previous[id])))
  }

  const setControl = <K extends keyof LadderControls>(key: K, value: LadderControls[K]) => {
    if (key === "kinds" && levelId !== "L6") {
      setKinds(Number(value))
      return
    }
    const next = { ...controls, [key]: value }
    setControlsByLevel((previous) => ({ ...previous, [levelId]: next }))
    // 锁定猜想之前改的参数就是这一级定下来的参数，存进记录；L6 例子世界里的调整只是试一试，不存。
    if (levelRecord.guess === null) updateLevel(levelId, () => ({ controls: next }))
  }

  const startTask = (request: LadderWorkerRequest, onDone: (response: LadderWorkerResponse) => void) => {
    const task = runTask(request)
    cancels.current.add(task.cancel)
    void task.done.then((response) => {
      cancels.current.delete(task.cancel)
      onDone(response)
    })
  }

  const runExperiment = (offset = seedOffset) => {
    if (running !== null) return
    const id = levelId
    const snapshot = controls
    const { params, withinDraws, fixedDraws } = levelModel(id, snapshot)
    const settingText = setting.map((line) => line.text).join(" ")
    requestId.current += 1
    setRunning("experiment")
    setTaskError(null)
    startTask(
      { id: requestId.current, op: "experiment", params, runs, seed: DEFAULT_SEED + offset, withinDraws, fixedDraws },
      (response) => {
        setRunning(null)
        if (!response.ok || response.op !== "experiment") {
          setTaskError(response.ok ? "收到的结果不对。" : response.message)
          return
        }
        const { result } = response
        setExperiments((previous) => ({ ...previous, [id]: { result, controls: snapshot } }))
        updateLevel(id, (previous) => ({
          experiments: [
            ...previous.experiments,
            {
              at: new Date().toISOString(),
              runs: result.runs,
              seed: result.seed,
              setting: settingText,
              mean: result.mean,
              notReachedShare: result.notReachedShare,
              observedKinds: result.unknownKinds?.observedMean ?? null,
            },
          ].slice(-30),
        }))
      },
    )
  }

  const reseed = () => {
    const next = seedOffset + 1
    setSeedOffset(next)
    runExperiment(next)
  }

  const runChecks = () => {
    if (running !== null) return
    const id = levelId
    requestId.current += 1
    setRunning("checks")
    setTaskError(null)
    startTask({ id: requestId.current, op: "checks", setup: levelSetup(id, situationControls) }, (response) => {
      setRunning(null)
      if (!response.ok || response.op !== "checks") {
        setTaskError(response.ok ? "收到的结果不对。" : response.message)
        return
      }
      setChecksByLevel((previous) => ({ ...previous, [id]: response.checks }))
      updateLevel(id, () => ({ checks: summarizeChecks(response.checks) }))
    })
  }

  const guessDraftValid = (() => {
    const value = parseNumber(guessDraft)
    return value !== null && value >= guess.min && value <= guess.max
  })()

  /** 第一次是锁定；已经锁定后再点是修改：旧猜想记进 guessRevisions，新猜想按现在的款数算。 */
  const lockGuess = () => {
    const value = parseNumber(guessDraft)
    if (value === null || !guessDraftValid) return
    const guessKinds = levelId === "L6" ? null : levelKinds
    const at = new Date().toISOString()
    updateLevel(levelId, (previous) => {
      if (previous.guess === null) return { guess: value, guessKinds, controls }
      if (previous.guess === value && previous.guessKinds === guessKinds) return {}
      const revision = {
        at,
        guess: previous.guess,
        guessKinds: previous.guessKinds,
        seenResults: previous.experiments.length > 0 || previous.reachedStep >= STEP_INDEX.theory,
      }
      return { guess: value, guessKinds, guessRevisions: [...previous.guessRevisions, revision].slice(-20) }
    })
    setEditingGuess(false)
  }

  const startEditGuess = () => {
    setGuessDraft(levelRecord.guess === null ? "" : String(levelRecord.guess))
    setEditingGuess(true)
  }

  const cancelEditGuess = () => {
    setGuessDraft("")
    setEditingGuess(false)
  }

  const applyDegeneracy = () => {
    const prediction = parseNumber(degeneracyDraft)
    if (prediction === null) return
    const special = { ...controls, ...level.degeneracy.apply }
    const value = safeAnswer(levelId, special)?.value ?? null
    setControlsByLevel((previous) => ({ ...previous, [levelId]: special }))
    updateLevel(levelId, () => ({ degeneracyPrediction: prediction, degeneracyValue: value }))
  }

  const completeLevel = () => {
    if (!stepDone[STEP_INDEX.check]) return
    const index = LADDER_LEVELS.findIndex((item) => item.id === levelId)
    const next = LADDER_LEVELS[index + 1]
    updateLevel(levelId, (previous) => ({ completedAt: previous.completedAt ?? new Date().toISOString() }))
    if (next !== undefined) openLevel(next.id)
  }

  const exportRecord = () => {
    const now = new Date()
    const payload = {
      app: "数学探究实验室 · 建模阶梯",
      exportedAt: now.toISOString(),
      note: "只记录猜想、判断、实验和结论，不含姓名、学校等个人信息。",
      steps: LADDER_STEPS.map((item) => item.label),
      kinds: record.kinds,
      levels: LADDER_LEVELS.map((item) => ({
        id: item.id,
        title: item.title,
        breaks: item.breaks,
        situationAnswer: safeAnswer(item.id, initialControls(item.id, record)),
        ...record.levels[item.id],
      })),
    }
    triggerBrowserDownload(JSON.stringify(payload, null, 2), "application/json;charset=utf-8", `建模阶梯记录_${timestamp(now)}.json`)
  }

  /** 重新开始当前这一级：只清这一级的记录、实验结果和参数，别的级和共用的款数都不动。 */
  const resetLevel = () => {
    const id = levelId
    cancels.current.forEach((cancel) => cancel())
    cancels.current.clear()
    setRecord((previous) => ({ ...previous, levels: { ...previous.levels, [id]: EMPTY_LEVEL_RECORD } }))
    setViewSteps((previous) => ({ ...previous, [id]: 0 }))
    setControlsByLevel((previous) => ({ ...previous, [id]: ladderLevel(id, kindCount).defaults }))
    setExperiments(({ [id]: _experiment, ...rest }) => rest)
    setChecksByLevel(({ [id]: _checks, ...rest }) => rest)
    setRunning(null)
    setConfirmReset(false)
    setGuessDraft("")
    setEditingGuess(false)
    setListDraft([])
    setPickDraft(null)
    setDegeneracyDraft("")
    setTaskError(null)
  }

  /** 实验台上“恢复”按钮：猜想锁定之前回到默认参数，锁定之后回到设置参数时定下的。 */
  const resetControls = () => {
    const target = levelRecord.guess === null ? level.defaults : situationControls
    setControlsByLevel((previous) => ({ ...previous, [levelId]: target }))
    if (levelRecord.guess === null) updateLevel(levelId, () => ({ controls: target }))
  }
  const labNote =
    levelId === "L6"
      ? paramsEditable ? "例子世界揭晓了，可以自己调着试。" : "例子世界的真实款数先保密，找完“找假设”之后揭晓，再自己调。"
      : paramsEditable ? "在“设置参数”这一步定下参数；锁定猜想之后，参数就固定了。" : "参数已经定下来了，后面的步骤都用这些设定。想换参数，点标题栏右边的“重新开始”。"

  const allDone = LADDER_LEVELS.every((item) => record.levels[item.id].completedAt !== null)
  const freeConditionRoute = getTopic("blind-box").extraPages?.find((page) => page.id === "free-condition")?.route

  const renderStep = () => {
    switch (stepId) {
      case "situation": {
        const situation = describeSituation(levelId, controls)
        return (
          <div className="ladder-step">
            {modelNow !== null && (
              <LevelScene levelId={levelId} params={modelNow.params} secret={levelId === "L6" && reached < STEP_INDEX.experiment} />
            )}
            {level.situation.recap && <p className="ladder-recap">{level.situation.recap}</p>}
            <section className="ladder-situation" aria-label="问题情境">
              <span className="ladder-situation__tag" aria-hidden="true">问题情境</span>
              {modelNow !== null && (
                <SituationShelf key={levelId} params={modelNow.params} secret={levelId === "L6" && reached < STEP_INDEX.experiment} />
              )}
              <div className="ladder-story__bubbles">
                {situation.story.map((line) => <p key={line}>{line}</p>)}
              </div>
              <p className="ladder-question">{situation.question}</p>
              {level.situation.note && (level.situation.noteOnlyAtDefaults !== true || sameControls(situationControls, level.defaults)) && (
                <p className="ladder-muted">{level.situation.note}</p>
              )}
            </section>
          </div>
        )
      }
      case "guess": {
        const resultsSeen = levelRecord.experiments.length > 0 || reached >= STEP_INDEX.theory
        const lastRevision = levelRecord.guessRevisions.at(-1)
        const guessInput = (submitLabel: string, cancellable: boolean) => (
          <div className="ladder-guess">
            <input
              inputMode="decimal"
              aria-label={guess.prompt}
              value={guessDraft}
              onChange={(event) => setGuessDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && lockGuess()}
            />
            <span>{level.guess.unit}</span>
            <button type="button" className="is-primary" onClick={lockGuess} disabled={!guessDraftValid}>{submitLabel}</button>
            {cancellable && <button type="button" onClick={cancelEditGuess}>取消</button>}
          </div>
        )
        return (
          <div className="ladder-step">
            <p className="ladder-question">{guess.prompt}</p>
            {levelRecord.guess === null ? (
              <>
                {guessInput("锁定猜想", false)}
                <p className="ladder-muted">{guess.hint}锁定之后才能看实验和理论值；想改的话可以点“修改猜想”，改过的会记在学习记录里。</p>
              </>
            ) : editingGuess ? (
              <>
                {guessInput("保存新猜想", true)}
                <p className="ladder-muted">
                  {guess.hint}
                  {resultsSeen
                    ? "你已经做过实验或看过理论值了，改后的猜想会标上“看过结果后修改”，原来的猜想也会留在学习记录里。"
                    : "原来的猜想会留在学习记录里。"}
                </p>
              </>
            ) : (
              <>
                <p className="ladder-locked">
                  你的猜想：<b>{formatAnswer(levelRecord.guess, level.guess.unit)}</b>（已锁定）
                  <button type="button" className="ladder-link" onClick={startEditGuess}>修改猜想</button>
                </p>
                {lastRevision !== undefined && (
                  <p className="ladder-muted">
                    已修改 {levelRecord.guessRevisions.length} 次，上一个猜想是 {formatAnswer(lastRevision.guess, level.guess.unit)}
                    {lastRevision.seenResults ? "（看过结果后修改）" : ""}。
                  </p>
                )}
              </>
            )}
          </div>
        )
      }
      case "assumption":
        return level.assumption.kind === "list" ? renderListStep() : renderPickStep(level.assumption)
      case "parameters": {
        const paramsFixed = levelId !== "L6" && levelRecord.guess !== null
        return (
          <div className="ladder-step">
            {modelNow !== null && (
              <LevelScene levelId={levelId} params={modelNow.params} withinDraws={modelNow.withinDraws} secret={levelId === "L6" && reached < STEP_INDEX.experiment} />
            )}
            <section className="ladder-brief" aria-label="本级任务">
              <span className="ladder-brief__badge"><SlidersIcon /></span>
              <div className="ladder-brief__body">
                <span className="ladder-brief__tag">本级任务</span>
                <p>{level.parametersIntro}</p>
              </div>
            </section>
            <p className={paramsFixed ? "ladder-tip is-fixed" : "ladder-tip"}>
              <span className="ladder-tip__icon">{paramsFixed ? <LockIcon /> : <BulbIcon />}</span>
              <span>{levelId === "L6" ? "点“下一步”先看情境。" : paramsFixed ? "参数已经定下来了，后面的每一步都用这些设定。想换参数，点标题栏右边的“重新开始”。" : "实验台上的“当前模型”会用白话复述你定下的条件。定好了点“下一步”；锁定猜想之后参数就固定了。"}</span>
            </p>
          </div>
        )
      }
      case "experiment":
        return (
          <div className="ladder-step">
            <p>{level.experimentIntro ?? "在实验台上选好轮数，点“开始实验”。看看实验的平均盒数和你的猜想差多少。"}</p>
            {modelNow !== null && (
              <LadderStage
                key={`${levelId}:${seedOffset}:${Object.values(controls).join(",")}`}
                levelId={levelId}
                params={modelNow.params}
                fixedDraws={modelNow.fixedDraws}
                withinDraws={modelNow.withinDraws}
                seed={DEFAULT_SEED + seedOffset}
                goalWord={goalWord(levelId, controls)}
                guess={levelRecord.guess}
                guessUnit={level.guess.unit}
              />
            )}
            <p className="ladder-tip is-run">
              <span className="ladder-tip__icon"><BulbIcon /></span>
              <span>再换个种子做一次：每轮的结果不一样，平均数会怎样？轮数越多，平均数越稳定吗？</span>
            </p>
            {experiment !== null && levelRecord.guess !== null && (
              <ExperimentComparison situation={situationControls} experiment={experiment} guess={levelRecord.guess} unit={level.guess.unit} />
            )}
          </div>
        )
      case "theory":
        return (
          <div className="ladder-step">
            <ul className="ladder-ideas">
              {level.theory.ideas.map((idea) => <li key={idea}>{idea}</li>)}
            </ul>
            {level.theory.formula && (
              <div className="ladder-formula">
                <span className="ladder-formula__tag">公式</span>
                <MathFormula formula={level.theory.formula} />
              </div>
            )}
            <p className="ladder-insight">
              <span className="ladder-insight__icon"><BulbIcon /></span>
              <span>{insight}</span>
            </p>
            {situationAnswer !== null && levelRecord.guess !== null && (
              <dl className="ladder-compare">
                <div><dt>你的猜想</dt><dd>{formatAnswer(levelRecord.guess, level.guess.unit)}</dd></div>
                <div>
                  <dt>最近一次实验</dt>
                  <dd>{levelRecord.experiments.length > 0 ? lastExperimentText(levelRecord, level.guess.unit) : "—"}</dd>
                </div>
                <div><dt>理论值</dt><dd>{formatAnswer(situationAnswer.value, situationAnswer.unit)}<small>设置参数里定下的</small></dd></div>
              </dl>
            )}
            {levelId === "L0" && <p className="ladder-muted">完整的推导见 <Link to={getTopic("blind-box").routes.learn}>互动学习</Link>。</p>}
          </div>
        )
      case "check":
        return renderCheckStep()
    }
  }

  const renderListStep = () => {
    const submitted = levelRecord.listPicks
    const picks = submitted ?? listDraft
    const statements = l0AssumptionStatements(levelKinds)
    return (
      <div className="ladder-step">
        <p className="ladder-question">下面哪些是理想模型“偷偷默认”的条件？把它们都选出来。</p>
        <ul className="ladder-statements">
          {L0_STATEMENT_ORDER.map((index) => {
            const statement = statements[index]
            const chosen = picks.includes(index)
            const verdict = submitted === null ? "" : (statement.assumption !== null) === chosen ? " is-right" : " is-wrong"
            return (
              <li key={statement.text}>
                <button
                  type="button"
                  className={verdict}
                  aria-pressed={chosen}
                  disabled={submitted !== null}
                  onClick={() => setListDraft((previous) => previous.includes(index) ? previous.filter((item) => item !== index) : [...previous, index])}
                >
                  {statement.text}
                  {submitted !== null && <small>{statement.assumption ?? "不是"}</small>}
                </button>
              </li>
            )
          })}
        </ul>
        {submitted === null ? (
          <button type="button" className="is-primary" disabled={listDraft.length === 0} onClick={() => updateLevel(levelId, () => ({ listPicks: [...listDraft].sort((left, right) => left - right) }))}>
            提交
          </button>
        ) : (
          <p className="ladder-feedback">
            理想模型里藏着 6 条假设（A1–A6），已经写进左下角的“假设清单”。后面每一级只打破其中一条。
            {statements.every((statement, index) => (statement.assumption !== null) === submitted.includes(index))
              ? "你全部选对了。"
              : "标红的句子选错或漏选了，对照清单再看一看。"}
          </p>
        )}
      </div>
    )
  }

  const renderPickStep = (spec: Extract<typeof level.assumption, { kind: "pick" }>) => {
    const submitted = levelRecord.assumptionPick
    const pick = submitted ?? pickDraft
    const answer = assumptionById(spec.answer)
    return (
      <div className="ladder-step">
        <p className="ladder-question">这个情境打破了理想模型的哪一条假设？</p>
        <div className="ladder-picks" role="group" aria-label="选择被打破的假设">
          {ASSUMPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={pick === item.id}
              disabled={submitted !== null}
              onClick={() => setPickDraft(item.id)}
            ><b>{item.id}</b> {item.text}</button>
          ))}
          <button type="button" aria-pressed={pick === "unsure"} disabled={submitted !== null} onClick={() => setPickDraft("unsure")}>说不准</button>
        </div>
        {submitted === null ? (
          <button type="button" className="is-primary" disabled={pickDraft === null} onClick={() => updateLevel(levelId, () => ({ assumptionPick: pickDraft }))}>
            确认
          </button>
        ) : (
          <div className={`ladder-feedback ${submitted === spec.answer ? "is-right" : "is-wrong"}`}>
            <strong>
              {submitted === spec.answer ? `对了：${answer.id} ${answer.text}` : `这一级打破的是 ${answer.id} ${answer.text}`}
            </strong>
            <p>{spec.explanation}</p>
            {spec.nearMiss && submitted === spec.nearMiss.id && <p>{spec.nearMiss.note}</p>}
          </div>
        )}
      </div>
    )
  }

  const renderCheckStep = () => {
    const { degeneracy } = level
    const predicted = levelRecord.degeneracyPrediction
    const value = levelRecord.degeneracyValue
    const done = levelRecord.completedAt !== null
    const predictionRight = predicted !== null && value !== null && closeEnough(predicted, value, degeneracy.unit)
    return (
      <div className="ladder-step">
        <section className="ladder-subsection is-card" aria-label="退化检验：你来试">
          <h3>
            <span className="ladder-subsection__icon"><PencilIcon /></span>
            退化检验：你来试
          </h3>
          <p className="ladder-subsection__prompt">{degeneracy.prompt}</p>
          {value === null ? (
            <div className="ladder-guess">
              <input
                inputMode="decimal"
                aria-label="退化检验的预测"
                value={degeneracyDraft}
                onChange={(event) => setDegeneracyDraft(event.target.value)}
              />
              <span>{degeneracy.unit}</span>
              <button type="button" className="ladder-go" disabled={parseNumber(degeneracyDraft) === null} onClick={applyDegeneracy}>
                <PlayIcon />调过去看看
              </button>
            </div>
          ) : (
            <div className={`ladder-feedback ${predictionRight ? "is-right" : "is-wrong"}`}>
              <strong>
                {predictionRight ? <CheckCircleIcon /> : <InfoIcon />}
                你预测 {predicted === null ? "—" : formatAnswer(predicted, degeneracy.unit)}，程序算出 {formatAnswer(value, degeneracy.unit)}
                {predictionRight ? "，一致。" : "。"}
              </strong>
              <p>{degeneracy.explanation}</p>
              <p className="ladder-muted">实验台上的参数已经调成这个特殊值，可以再做一次实验看看；点“恢复设定的参数”回到你设置的参数。</p>
            </div>
          )}
        </section>

        <section className="ladder-subsection is-card" aria-label="程序的三道检验">
          <h3>
            <span className="ladder-subsection__icon is-shield"><ShieldIcon /></span>
            程序的三道检验<small>针对这一级的新模型（情境里的参数）</small>
          </h3>
          {checks === null ? (
            <button type="button" className="ladder-go" disabled={running !== null} onClick={runChecks}>
              {running === "checks" ? <SpinnerIcon /> : <ShieldIcon />}
              {running === "checks" ? "正在检验……" : "运行三道检验"}
            </button>
          ) : (
            <ThreeChecks checks={checks} />
          )}
          {checks === null && levelRecord.checks !== null && (
            <p className="ladder-muted">上次检验：{levelRecord.checks.passed} 项通过，{levelRecord.checks.failed} 项不通过。</p>
          )}
        </section>

        <div className="ladder-finish">
          {done ? (
            <p className="ladder-feedback is-right">
              <strong><CheckCircleIcon />这一级已经完成。</strong>
            </p>
          ) : (
            <button type="button" className="ladder-go is-wide" disabled={!stepDone[STEP_INDEX.check]} onClick={completeLevel}>
              {levelId === LAST_LEVEL_ID ? `完成 ${levelId}` : `完成 ${levelId}，进入下一级`}
              <ArrowRightIcon />
            </button>
          )}
          {!stepDone[STEP_INDEX.check] && <small className="ladder-muted">先做退化检验，再运行三道检验。</small>}
        </div>
      </div>
    )
  }

  return (
    <TopicShell topicId="blind-box" module="ladder">
      <section className="ladder-page">
        <h1 className="sr-only">建模阶梯：每一级打破理想模型的一条假设</h1>
        <div className="ladder-workbench">
          <aside className="ladder-panel ladder-rail">
            <header><span>LADDER</span><div><strong>建模阶梯</strong><small>每一级只打破一条假设</small></div></header>
            <div className="ladder-panel__body">
              <nav aria-label="建模阶梯各级">
                <ol className="ladder-levels">
                  {LADDER_LEVELS.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-current={item.id === levelId ? "step" : undefined}
                        className={record.levels[item.id].completedAt !== null ? "is-done" : undefined}
                        onClick={() => openLevel(item.id)}
                      >
                        <b>{item.id}</b>
                        <span>{item.title}<small>{[item.breaks === null ? "理想模型" : levelJudged(record.levels[item.id]) ? `打破 ${item.breaks}` : null, levelStatus(record.levels[item.id])].filter(Boolean).join(" · ")}</small></span>
                        <LevelPips record={record.levels[item.id]} />
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>

              <section className="ladder-assumptions" aria-label="假设清单">
                <h2>
                  假设清单
                  <small>
                    {!listRevealed ? "还没揭晓" : !assumptionJudged ? "这一级还没判断" : `不满足 ${ASSUMPTIONS.filter((item) => item.id === level.breaks).length}/${ASSUMPTIONS.length}`}
                  </small>
                </h2>
                {!listRevealed ? (
                  <p className="ladder-muted">完成 L0 的“找假设”之后，这里会列出理想模型的 6 条假设。</p>
                ) : (
                  <ul>
                    {ASSUMPTIONS.map((item) => {
                      const breaker = LADDER_LEVELS.find((candidate) => candidate.breaks === item.id)
                      return (
                        <li key={item.id}>
                          <b>{item.id}</b>
                          <span>
                            {item.text}
                            {(breaker === undefined ? assumptionJudged : levelJudged(record.levels[breaker.id])) && (
                              <small>{breaker !== undefined ? `${breaker.id} 研究：${item.brokenBy}` : item.brokenBy}</small>
                            )}
                          </span>
                          {!assumptionJudged ? (
                            <i className="ladder-assumption-mark is-unknown" role="img" aria-label="这一级还没判断">?</i>
                          ) : level.breaks === item.id ? (
                            <i className="ladder-assumption-mark is-broken" role="img" aria-label="这一级不满足">✕</i>
                          ) : (
                            <i className="ladder-assumption-mark is-held" role="img" aria-label="这一级满足">✓</i>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </aside>

          <section className="ladder-panel ladder-main" aria-labelledby="ladder-level-title">
            <header className="ladder-main__head">
              <span>{level.id}</span>
              <div>
                <h2 id="ladder-level-title">{level.title}</h2>
                {(level.breaks === null || assumptionJudged) && <small>{level.subtitle}</small>}
              </div>
              {(level.breaks === null || assumptionJudged) && (
                <em className={`ladder-main__break${level.breaks === null ? " is-ideal" : ""}`}>
                  {level.breaks === null ? "理想模型" : `打破 ${level.breaks}`}
                </em>
              )}
              <div className="ladder-restart">
                <button
                  type="button"
                  className="ladder-restart__button has-step-icon"
                  aria-expanded={confirmReset}
                  onClick={() => setConfirmReset((open) => !open)}
                >
                  <RestartIcon />重新开始
                </button>
                {confirmReset && (
                  <div className="ladder-restart__confirm" role="alertdialog" aria-label={`清空 ${level.id} 的记录`}>
                    <p>清空 {level.id} 的记录？<small>只清这一级的猜想、实验和检验，其他级不动。</small></p>
                    <div>
                      <button type="button" className="is-danger" onClick={resetLevel}>清空记录</button>
                      <button type="button" onClick={() => setConfirmReset(false)}>不清空</button>
                    </div>
                  </div>
                )}
              </div>
            </header>
            <nav className="ladder-steps" aria-label={`${level.id} 学习步骤`}>
              {LADDER_STEPS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  data-step={item.id}
                  disabled={index > reached}
                  aria-current={index === step ? "step" : undefined}
                  className={index < reached ? "is-done" : undefined}
                  onClick={() => goToStep(index)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="ladder-panel__body" aria-live="polite">
              {renderStep()}
              {taskError !== null && <p className="ladder-warning" role="alert">计算出错：{taskError}</p>}
              {allDone && levelId === LAST_LEVEL_ID && stepId === "check" && (
                <div className="ladder-feedback is-right">
                  <strong>L0–{LAST_LEVEL_ID} 全部完成。</strong>
                  <p>
                    接下来可以到
                    {freeConditionRoute ? <Link to={freeConditionRoute}>“自由提条件”</Link> : "“自由提条件”"}
                    用自己的话提出新的条件，例如店里只剩几盒、又有保底，或者合买时还要算钱。
                  </p>
                </div>
              )}
            </div>
            <footer className="ladder-main__footer">
              <button type="button" className="has-step-icon" disabled={step === 0} onClick={() => goToStep(step - 1)}><StepArrow direction="prev" />上一步</button>
              <span>{step + 1} / {LADDER_STEPS.length}</span>
              {step < LADDER_STEPS.length - 1 && (
                <button type="button" className="is-primary has-step-icon" disabled={!stepDone[step]} onClick={advance}>下一步<StepArrow direction="next" /></button>
              )}
            </footer>
          </section>

          <section className="ladder-panel ladder-lab" aria-labelledby="ladder-lab-title">
            <header><span>LAB</span><div><strong id="ladder-lab-title">实验台</strong><small>参数 · 模拟 · 理论值</small></div></header>
            <div className="ladder-panel__body">
              <LadderLab
                level={level}
                controls={controls}
                editable={paramsEditable}
                kindsEditable={kindsEditable}
                note={labNote}
                baseline={levelRecord.guess === null ? level.defaults : situationControls}
                baselineLabel={levelRecord.guess === null ? "恢复默认参数" : "恢复设定的参数"}
                onChange={setControl}
                onReset={resetControls}
                setting={setting}
                experimentAllowed={reached >= STEP_INDEX.experiment}
                running={running === "experiment"}
                runs={runs}
                onRunsChange={setRuns}
                onRun={() => runExperiment()}
                onReseed={reseed}
                experiment={experiment}
                guess={levelRecord.guess}
                guessKinds={levelId === "L6" || levelRecord.guess === null ? null : levelKinds}
                answer={answer}
                theoryVisible={theoryVisible}
                withinDraws={experiment === null ? null : levelModel(levelId, experiment.controls).withinDraws}
              />
            </div>
            <footer className="ladder-lab__footer">
              <button type="button" onClick={exportRecord}>导出学习记录（JSON）</button>
            </footer>
          </section>
        </div>
      </section>
    </TopicShell>
  )
}

function lastExperimentText(record: LevelRecord, unit: LevelAnswer["unit"]): string {
  const last = record.experiments.at(-1)
  if (last === undefined) return "—"
  const value = unit === "%" && last.notReachedShare !== null ? last.notReachedShare * 100 : last.mean
  return `${formatAnswer(value, unit)}（${last.runs.toLocaleString("zh-CN")} 轮）`
}

function ExperimentComparison({
  situation: situationControls,
  experiment,
  guess,
  unit,
}: {
  readonly situation: LadderControls
  readonly experiment: LabExperiment
  readonly guess: number
  readonly unit: LevelAnswer["unit"]
}) {
  const situation = sameControls(experiment.controls, situationControls)
  const value = unit === "%" ? (experiment.result.notReachedShare ?? 0) * 100 : experiment.result.mean
  return (
    <div className="ladder-vs" role="group" aria-label="猜想和实验的对比">
      <div className="ladder-vs__side is-guess">
        <span>你的猜想</span>
        <b>{formatAnswer(guess, unit)}</b>
      </div>
      <span className="ladder-vs__mid" aria-hidden="true">VS</span>
      <div className="ladder-vs__side is-result">
        <span>这次实验</span>
        <b>{formatAnswer(value, unit)}</b>
      </div>
      {!situation && <p className="ladder-vs__note">实验用的参数和情境不同，比较时要注意。</p>}
    </div>
  )
}
