// 建模阶梯“做实验”一步的开盒演示：复用“模拟实验”的开盒舱（立体盲盒、抽中卡片、收藏卡）。
// 演示的就是实验台上“开始实验”的第 k 轮——同一个种子，抽出来的盒子一样；
// 点盒子一盒一盒地开，或者自动开、快进，看清一轮是怎么来的，再去看几百几千轮的分布。

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { formatNumber, traceRound, type BlindBoxParams, type RoundTrace } from "../../../core/blindbox"
import blindBoxPackage from "../../../../assets/00.png"
import { KindGlyph, buildKindVisuals } from "./kind-visuals"
import { BoxIcon, ForwardIcon, PauseIcon, PlayIcon, ReplayIcon } from "./ladder-icons"
import type { AnswerUnit, LadderLevelId } from "./levels"
import "./ladder-stage.css"

type SpeedId = "slow" | "fast" | "turbo"

/** open：开一盒要等多久（打开动画的时间）；gap：自动开盒时两盒之间的间隔。 */
const SPEEDS: Record<SpeedId, { readonly label: string; readonly open: number; readonly gap: number }> = {
  slow: { label: "慢", open: 820, gap: 420 },
  fast: { label: "快", open: 320, gap: 120 },
  turbo: { label: "极速", open: 60, gap: 30 },
}

interface RoundSummary {
  readonly round: number
  readonly boxes: number
  readonly reached: boolean
  readonly observed: number | null
  readonly estimate: number | null
}

export interface LadderStageProps {
  readonly levelId: LadderLevelId
  readonly params: BlindBoxParams
  /** L6：每轮固定买几盒；其余各级为 null。 */
  readonly fixedDraws: number | null
  /** L2：问的“买几盒”；其余各级为 null。 */
  readonly withinDraws: number | null
  readonly seed: number
  /** “集齐”“集齐全套”“抽到隐藏款”等，跟着当前目标变。 */
  readonly goalWord: string
  readonly guess: number | null
  readonly guessUnit: AnswerUnit
}

function safeTrace(params: BlindBoxParams, seed: number, round: number, fixedDraws: number | null): RoundTrace | null {
  try {
    return traceRound(params, { seed, round, draws: fixedDraws })
  } catch {
    return null
  }
}

export function LadderStage({ levelId, params, fixedDraws, withinDraws, seed, goalWord, guess, guessUnit }: LadderStageProps) {
  const [round, setRound] = useState(0)
  const [shown, setShown] = useState(0)
  const [phase, setPhase] = useState<"idle" | "opening">("idle")
  const [auto, setAuto] = useState(false)
  const [speed, setSpeed] = useState<SpeedId>("fast")
  const [history, setHistory] = useState<readonly RoundSummary[]>([])

  const trace = useMemo(() => safeTrace(params, seed, round, fixedDraws), [params, seed, round, fixedDraws])
  const visuals = useMemo(() => buildKindVisuals(trace?.kinds ?? []), [trace])
  const total = trace?.steps.length ?? 0
  const finished = total > 0 && shown >= total
  const step = trace !== null && shown > 0 ? (trace.steps[shown - 1] ?? null) : null
  const mystery = fixedDraws !== null
  const wobble = SPEEDS[speed].open >= 300

  useEffect(() => {
    if (phase !== "opening") return undefined
    const timer = window.setTimeout(() => {
      setShown((count) => Math.min(total, count + 1))
      setPhase("idle")
    }, SPEEDS[speed].open)
    return () => window.clearTimeout(timer)
  }, [phase, speed, total])

  useEffect(() => {
    if (!auto) return undefined
    if (finished || total === 0) {
      setAuto(false)
      return undefined
    }
    if (phase !== "idle") return undefined
    const timer = window.setTimeout(() => setPhase("opening"), SPEEDS[speed].gap)
    return () => window.clearTimeout(timer)
  }, [auto, finished, phase, shown, speed, total])

  useEffect(() => {
    if (!finished || trace === null) return
    setHistory((previous) =>
      previous.some((item) => item.round === round)
        ? previous
        : [
            ...previous,
            {
              round,
              boxes: total,
              reached: trace.reached,
              observed: trace.fixed?.observed ?? null,
              estimate: trace.fixed?.chao1 ?? null,
            },
          ].slice(-12),
    )
  }, [finished, round, total, trace])

  if (trace === null || total === 0) {
    return <p className="ladder-muted">这组参数没法演示开盒，请换一组参数再试。</p>
  }

  const openOne = () => {
    if (finished || phase !== "idle") return
    setAuto(false)
    setPhase("opening")
  }
  const skipToEnd = () => {
    setAuto(false)
    setPhase("idle")
    setShown(total)
  }
  const nextRound = () => {
    setAuto(false)
    setPhase("idle")
    setShown(0)
    setRound((value) => value + 1)
  }

  const counts = step?.counts ?? trace.kinds.map(() => 0)
  const isOpening = phase === "opening"
  const lastVisual = step === null ? null : (visuals[step.kind] ?? null)
  const lastKind = step === null ? null : (trace.kinds[step.kind] ?? null)
  const goalDone = trace.needTotal - (step?.stillNeeded ?? trace.needTotal)
  const progress = mystery ? (shown / total) * 100 : (goalDone / trace.needTotal) * 100
  const stockTotal = trace.kinds.every((kind) => kind.stock !== null)
    ? trace.kinds.reduce((sum, kind) => sum + (kind.stock ?? 0), 0)
    : null
  const boxesLeft = step?.boxesLeft ?? stockTotal
  const sincePity = step?.sincePity ?? 0
  const teamNeed = trace.kinds.find((kind) => kind.need > 0)?.need ?? 1

  const sceneClass = [
    "blind-box-stage",
    "ladder-stage__scene",
    isOpening && wobble ? "is-opening" : "",
    step?.isNew ? "has-new-result" : step ? "has-duplicate-result" : "",
    lastVisual?.hidden ? "has-hidden-result" : "",
    step?.pityForced ? "has-pity-result" : "",
    finished ? "is-complete" : "",
  ].filter(Boolean).join(" ")

  const cardNote = (() => {
    if (step === null || lastKind === null) return ""
    if (step.pityForced) return "保底触发 ✦"
    if (!mystery && lastKind.need === 0) return "不在目标里"
    if (step.isNew) return mystery ? "NEW  又见到一款" : "NEW  新款入藏"
    if (teamNeed > 1 && (counts[step.kind] ?? 0) > lastKind.need) return "REPEAT  多的拿去交换"
    return "REPEAT  重复款"
  })()

  const chips: { readonly key: string; readonly text: string; readonly tone?: "warn" | "gold" }[] = []
  if (mystery && trace.fixed !== null) {
    const seen = counts.filter((count) => count > 0).length
    chips.push({ key: "seen", text: `买 ${trace.fixed.draws} 盒，已经见到 ${seen} 款` })
  }
  if (boxesLeft !== null) chips.push({ key: "stock", text: `店里还剩 ${boxesLeft}/${stockTotal ?? boxesLeft} 盒` })
  if (trace.pity !== null) {
    chips.push({ key: "pity", text: `保底：最迟再买 ${trace.pity.within - sincePity} 盒必出隐藏款`, tone: "gold" })
  }
  if (teamNeed > 1) chips.push({ key: "team", text: `${teamNeed} 个人合买：每款要 ${teamNeed} 个` })
  if (withinDraws !== null) {
    const over = shown > withinDraws && !finished
    chips.push({
      key: "within",
      text: over ? `已经超过 ${withinDraws} 盒，还没${goalWord}` : `看看 ${withinDraws} 盒内能不能${goalWord}`,
      tone: over ? "warn" : undefined,
    })
  }

  const summary = (() => {
    if (!finished) return null
    if (trace.fixed !== null) {
      return (
        `买了 ${trace.fixed.draws} 盒，见到 ${trace.fixed.observed} 款；只见过 1 次的 ${trace.fixed.singletons} 款，` +
        `只见过 2 次的 ${trace.fixed.doubletons} 款，按 Chao1 估计一共 ${formatNumber(trace.fixed.chao1)} 款。`
      )
    }
    const base = `这一轮买了 ${total} 盒才${goalWord}。`
    if (withinDraws !== null) {
      return `${base}${total <= withinDraws ? `在 ${withinDraws} 盒之内做到了。` : `没能在 ${withinDraws} 盒之内做到。`}`
    }
    if (guess !== null && guessUnit === "盒") {
      return `${base}你猜的是 ${formatNumber(guess)} 盒，一轮的运气可大可小，再演示几轮看看。`
    }
    return base
  })()

  const showCards = mystery ? visuals.filter((visual) => (counts[visual.index] ?? 0) > 0) : visuals
  const cardHeight = visuals.length > 6 ? 88 : 98

  return (
    <section className="ladder-stage" aria-label="开盒演示">
      <header className="ladder-stage__head">
        <span className="ladder-stage__eyebrow">LIVE OPENING</span>
        <strong>开盒演示</strong>
        <span className="ladder-stage__tag">第 {round + 1} 轮 · 已开 {shown} 盒</span>
        <span className={`live-chip${isOpening || auto ? " is-live" : ""}`}>
          <i aria-hidden="true" />{auto ? "自动开盒中" : isOpening ? "正在开" : finished ? "这一轮结束了" : "点盲盒开一盒"}
        </span>
      </header>

      <div className={sceneClass}>
        <div className="stage-radar" aria-hidden="true"><i /><i /><i /></div>
        <div className="stage-beam" aria-hidden="true" />
        <button
          type="button"
          className="blind-box-trigger"
          onClick={openOne}
          disabled={finished || isOpening || auto}
          aria-label={finished ? "这一轮已经结束" : isOpening ? "正在打开盲盒" : "点击打开一个盲盒"}
        >
          <span className="blind-box-object" aria-hidden="true">
            <span className="blind-box-object__shadow" />
            <img className="blind-box-object__art" src={blindBoxPackage} alt="" aria-hidden="true" decoding="async" draggable="false" />
            <span className="blind-box-object__sparkles"><i /><i /><i /><i /><i /></span>
          </span>
        </button>

        <div className="draw-result" aria-live="polite" aria-atomic="true">
          {step !== null && lastVisual !== null ? (
            <div
              key={`${round}-${step.index}`}
              className={`draw-result__card${step.isNew ? " is-new" : " is-duplicate"}${lastVisual.hidden ? " is-hidden-kind" : ""}`}
            >
              <span className="draw-result__figure">
                <span className="draw-result__halo" aria-hidden="true" />
                <KindGlyph visual={lastVisual} size="large" />
              </span>
              <span className="draw-result__copy">
                <small>第 {step.index} 盒抽中</small>
                <strong>{lastVisual.hidden ? "隐藏款" : `${lastVisual.label} · ${lastVisual.name}`}</strong>
                <em>{cardNote}</em>
              </span>
            </div>
          ) : (
            <div className="draw-result__waiting">
              <span aria-hidden="true">⌁</span>
              <p>
                <strong>等待第一次开盒</strong>
                <small>点立体盲盒，或点下面的“自动开盒”</small>
              </p>
            </div>
          )}
        </div>

        {finished && (
          <div className="completion-flare" role="status">
            <span aria-hidden="true">✦</span>
            <strong>{mystery ? "买完了！" : `${goalWord}了！`}</strong>
            <small>本轮共 {total} 盒</small>
          </div>
        )}
      </div>

      <div className="ladder-stage__status">
        <div className="collection-progress" aria-label={mystery ? `已经开了 ${shown} 盒，共 ${total} 盒` : `目标进度 ${goalDone}/${trace.needTotal}`}>
          <i style={{ "--progress": `${progress}%` } as CSSProperties} aria-hidden="true"><b /></i>
          <span>{mystery ? `${shown}/${total} 盒` : `${goalDone}/${trace.needTotal}`}</span>
        </div>
        {chips.length > 0 && (
          <ul className="ladder-stage__chips">
            {chips.map((chip) => (
              <li key={chip.key} className={chip.tone === undefined ? undefined : `is-${chip.tone}`}>{chip.text}</li>
            ))}
          </ul>
        )}
        {trace.pity !== null && (
          <div className="ladder-stage__pity" aria-hidden="true">
            <i style={{ width: `${(sincePity / trace.pity.within) * 100}%` }} />
          </div>
        )}
      </div>

      <div
        className="collection-shelf ladder-shelf"
        role="list"
        aria-label="收藏架"
        style={{ "--shelf-card-height": `${cardHeight}px` } as CSSProperties}
      >
        {showCards.map((visual) => {
          const kind = trace.kinds[visual.index]
          const count = counts[visual.index] ?? 0
          const missing = count === 0
          const latest = step !== null && step.kind === visual.index
          const need = kind?.need ?? 0
          const accent = { "--accent": visual.color, "--accent-soft": visual.color } as CSSProperties
          return (
            <div
              key={visual.id}
              className={`collection-card${missing ? " is-missing" : " is-collected"}${latest ? " is-latest" : ""}${!mystery && need === 0 ? " is-unneeded" : ""}${visual.hidden ? " is-hidden-kind" : ""}`}
              style={accent}
              role="listitem"
              aria-label={`${visual.hidden ? "隐藏款" : `${visual.label}款${visual.name}`}，${missing ? "还没抽到" : `抽到 ${count} 个`}`}
            >
              <span className="collection-card__scan" aria-hidden="true" />
              <div className="collection-card__topline">
                <strong>{visual.hidden ? "★" : visual.label}<small>{visual.hidden ? "隐藏" : visual.name}</small></strong>
              </div>
              <div className="collection-card__figure">
                <KindGlyph visual={visual} size="medium" muted={missing} />
              </div>
              <div className="collection-card__count">
                <strong>{count}</strong>
                <small>{need > 1 ? `/ ${need}` : "个"}</small>
              </div>
              {kind?.stock != null && <span className="ladder-shelf__left">店里剩 {kind.stock - count}</span>}
              {latest && <em className={step.isNew ? "is-new" : "is-repeat"}>{step.isNew ? "NEW" : "+1"}</em>}
            </div>
          )
        })}
        {mystery && (
          <div className="collection-card is-missing ladder-shelf__ghost" role="listitem" aria-label="可能还有没见到的款">
            <span aria-hidden="true">?</span>
            <small>还有没见到的吗</small>
          </div>
        )}
      </div>

      <div className="ladder-stage__actions" role="group" aria-label="开盒操作">
        {finished ? (
          <button type="button" className="ladder-go" onClick={nextRound}><ReplayIcon />再演示一轮</button>
        ) : (
          <button type="button" className="ladder-go" disabled={isOpening || auto} onClick={openOne}><BoxIcon />开一盒</button>
        )}
        <button
          type="button"
          className="ladder-ghost"
          aria-pressed={auto}
          disabled={finished}
          onClick={() => setAuto((value) => !value)}
        >{auto ? <PauseIcon /> : <PlayIcon />}{auto ? "暂停" : "自动开盒"}</button>
        <button type="button" className="ladder-ghost" disabled={finished} onClick={skipToEnd}><ForwardIcon />快进到结果</button>
        <span className="ladder-segmented ladder-stage__speed" role="group" aria-label="开盒速度">
          {(Object.keys(SPEEDS) as SpeedId[]).map((id) => (
            <button key={id} type="button" aria-pressed={speed === id} onClick={() => setSpeed(id)}>{SPEEDS[id].label}</button>
          ))}
        </span>
      </div>

      {summary !== null && <p className="ladder-feedback ladder-stage__summary" role="status">{summary}</p>}
      <p className="ladder-muted ladder-stage__note">
        {`${levelId} 的这一轮就是右边“开始实验”的第 ${round + 1} 轮（种子 ${seed}）：同一个种子，抽出来的盒子一模一样。`}
      </p>

      {history.length > 0 && (
        <div className="ladder-stage__history">
          <span>已演示的轮</span>
          <ul>
            {history.map((item) => (
              <li key={item.round} className={item.round === round ? "is-current" : undefined}>
                <small>第 {item.round + 1} 轮</small>
                <b>{item.observed === null ? `${item.boxes} 盒` : `${item.observed} 款`}</b>
                {item.estimate !== null && <small>估计 {formatNumber(item.estimate)}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
