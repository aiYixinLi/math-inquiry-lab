import { useEffect, useMemo, useState, type KeyboardEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { getTopic, type TopicId } from "../../app/topic-registry"
import { useModuleProgress, useProgress } from "../progress"
import { MathFormula } from "./MathFormula"
import { MathNotation } from "./MathNotation"
import { MathText } from "./MathText"
import { StepArrow } from "./StepArrow"
import { getLearningTheoryBlocks } from "./theory"
import type { LearningStep, LearningVisualRenderer } from "./types"

interface LearningScreenProps {
  readonly topicId: TopicId
  readonly steps: readonly LearningStep[]
  readonly renderVisual: LearningVisualRenderer
}

const THEORY_PAGE_VERSION = 3

function getLegacyTheoryBlockCount(step: LearningStep) {
  return 3
    + (step.formula && step.formulaLatex ? 1 : 0)
    + (step.interpretation ? 1 : 0)
}

function getVersionTwoTheoryBlockCount(step: LearningStep) {
  return 3
    + step.mathConcepts.length * 2
    + (step.formula && step.formulaLatex ? 1 : 0)
    + (step.interpretation ? 1 : 0)
}

function migrateTheoryPages(
  value: unknown,
  version: unknown,
  steps: readonly LearningStep[],
) {
  if (!value || typeof value !== "object") return {}
  const pages = value as Record<string, unknown>

  return Object.fromEntries(steps.flatMap((item) => {
    const savedPage = pages[item.id]
    if (typeof savedPage !== "number" || !Number.isFinite(savedPage)) return []
    const pageCount = getLearningTheoryBlocks(item).length
    const versionTwoPageCount = getVersionTwoTheoryBlockCount(item)
    const formulaPage = 1 + item.mathConcepts.length * 2
    const migratedPage = version === THEORY_PAGE_VERSION
      ? savedPage
      : version === 2
        ? savedPage >= versionTwoPageCount
          ? pageCount
          : savedPage > formulaPage
            ? savedPage + 2
            : savedPage
        : savedPage >= getLegacyTheoryBlockCount(item)
          ? pageCount
          : savedPage
    return [[item.id, Math.max(0, Math.min(pageCount, migratedPage))]]
  }))
}

export function LearningScreen({
  topicId,
  steps,
  renderVisual,
}: LearningScreenProps) {
  const topic = getTopic(topicId)
  const [searchParams] = useSearchParams()
  const requestedStepIndex = steps.findIndex(
    ({ id }) => id === searchParams.get("step"),
  )
  const { progress, markStarted, markCompleted } = useModuleProgress(topicId, "learn")
  const experimentComplete = useProgress()[topicId].playground.status === "completed"
  const storageKey = `math-inquiry-lab:learning-state:${topicId}:v1`
  const initialState = useMemo(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as {
        stepIndex?: unknown
        answers?: unknown
        checked?: unknown
        theoryPages?: unknown
        theoryPageVersion?: unknown
      } | null
      return {
        stepIndex: typeof parsed?.stepIndex === "number" ? parsed.stepIndex : 0,
        answers: parsed?.answers && typeof parsed.answers === "object"
          ? parsed.answers as Record<string, string>
          : {},
        checked: parsed?.checked && typeof parsed.checked === "object"
          ? parsed.checked as Record<string, boolean>
          : {},
        theoryPages: migrateTheoryPages(
          parsed?.theoryPages,
          parsed?.theoryPageVersion,
          steps,
        ),
      }
    } catch {
      return { stepIndex: 0, answers: {}, checked: {}, theoryPages: {} }
    }
  }, [steps, storageKey])
  const [stepIndex, setStepIndex] = useState(
    requestedStepIndex >= 0
      ? requestedStepIndex
      : Math.max(0, Math.min(steps.length - 1, initialState.stepIndex)),
  )
  const [answers, setAnswers] = useState<Record<string, string>>(initialState.answers)
  const [checked, setChecked] = useState<Record<string, boolean>>(initialState.checked)
  const [theoryPages, setTheoryPages] = useState<Record<string, number>>(initialState.theoryPages)
  const [theoryFlipDirection, setTheoryFlipDirection] = useState<"forward" | "backward">("forward")
  const step = steps[stepIndex]
  const theoryBlocks = useMemo(() => getLearningTheoryBlocks(step), [step])
  const savedTheoryPage = theoryPages[step.id]
  const theoryPage = Math.max(
    0,
    Math.min(
      theoryBlocks.length,
      Number.isFinite(savedTheoryPage) ? savedTheoryPage : 0,
    ),
  )
  const theoryComplete = theoryPage >= theoryBlocks.length
  const theoryBlock = theoryBlocks[Math.min(theoryPage, theoryBlocks.length - 1)]
  const isLocked = Boolean(step.lockedUntilExperiment && !experimentComplete)
  const selected = answers[step.id]
  const hasChecked = checked[step.id] === true
  const isCorrect = hasChecked && selected === step.check.correctOptionId
  const allChecksCorrect = useMemo(
    () => steps.every((item) =>
      checked[item.id] === true && answers[item.id] === item.check.correctOptionId,
    ),
    [answers, checked, steps],
  )
  const checkedCount = steps.filter((item) => checked[item.id] === true).length

  useEffect(() => markStarted(), [markStarted])

  useEffect(() => {
    if (requestedStepIndex >= 0) setStepIndex(requestedStepIndex)
  }, [requestedStepIndex])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        stepIndex,
        answers,
        checked,
        theoryPages,
        theoryPageVersion: THEORY_PAGE_VERSION,
        updatedAt: new Date().toISOString(),
      }))
    } catch {
      // The page remains usable in storage-restricted browser contexts.
    }
  }, [answers, checked, stepIndex, storageKey, theoryPages])

  const move = (next: number) => {
    setStepIndex(Math.max(0, Math.min(steps.length - 1, next)))
  }

  const moveTheory = (next: number) => {
    setTheoryFlipDirection(next >= theoryPage ? "forward" : "backward")
    setTheoryPages((current) => ({
      ...current,
      [step.id]: Math.max(0, Math.min(theoryBlocks.length, next)),
    }))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return
    if (event.key === "ArrowLeft") move(stepIndex - 1)
    if (event.key === "ArrowRight") move(stepIndex + 1)
  }

  return (
    <section className="learning-screen" onKeyDown={onKeyDown} tabIndex={0} aria-label="互动学习步骤">
      <aside className="learning-rail" aria-label="学习步骤">
        <div className="learning-rail__heading learning-panel-heading">
          <span>LEARNING MAP</span>
          <strong>知识路径</strong>
        </div>
        <ol>
          {steps.map((item, index) => {
            const correct = checked[item.id] && answers[item.id] === item.check.correctOptionId
            const itemTheoryBlocks = getLearningTheoryBlocks(item)
            const itemTheoryPage = Math.max(
              0,
              Math.min(itemTheoryBlocks.length, theoryPages[item.id] ?? 0),
            )
            const itemStatus = item.lockedUntilExperiment && !experimentComplete
              ? "实验后揭示"
              : correct
                ? "检查通过"
                : itemTheoryPage >= itemTheoryBlocks.length
                  ? "待检查"
                  : itemTheoryPage > 0
                    ? `理论 ${itemTheoryPage + 1}/${itemTheoryBlocks.length}`
                    : "待学习"
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={index === stepIndex ? "is-active" : undefined}
                  onClick={() => move(index)}
                  aria-current={index === stepIndex ? "step" : undefined}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{item.shortTitle}</strong>
                    <small>{itemStatus}</small>
                  </span>
                  <i className={correct ? "is-done" : undefined} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ol>
        <div className="learning-rail__progress">
          <span>学习进度</span>
          <strong>{checkedCount}/{steps.length}</strong>
          <div><i style={{ width: `${checkedCount / steps.length * 100}%` }} /></div>
        </div>
      </aside>

      <aside className="learning-notes" aria-label="教材式数学理论">
        <header className="learning-notes__heading learning-panel-heading">
          <span>TEXTBOOK THEORY</span>
          <strong>理论知识</strong>
        </header>
        {isLocked ? (
          <section className="learning-theory learning-theory--locked">
            <div className="learning-theory__topline">
              <span>学习进度</span>
              <span>待解锁</span>
            </div>
            <div className="learning-theory-stack">
              <div className="learning-theory-card">
                <span className="learning-theory-card__kind">待解锁</span>
                <h2>数学理论尚未揭示</h2>
                <p>先完成前置猜想与模拟实验，再回到这里按内容块逐步学习。</p>
              </div>
            </div>
          </section>
        ) : theoryComplete ? (
          <section className="learning-check learning-check--standalone">
            <div className="learning-theory__topline">
              <span className="learning-notes__eyebrow">QUICK CHECK</span>
              <span>理论学习完成</span>
            </div>
            <div className="learning-theory-stack">
              <div className="learning-theory-card learning-theory-card--check">
                <span className="learning-theory-card__kind">即时检查</span>
                <h2>用一道题检查理解</h2>
                <p><MathText text={step.check.prompt} inlineMath={step.inlineMath} /></p>
                <div role="radiogroup" aria-label={step.check.prompt}>
                  {step.check.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected === option.id}
                      className={selected === option.id ? "is-selected" : undefined}
                      onClick={() => {
                        setAnswers((current) => ({ ...current, [step.id]: option.id }))
                        setChecked((current) => ({ ...current, [step.id]: false }))
                      }}
                    >
                      <i aria-hidden="true" />
                      <MathText text={option.label} inlineMath={step.inlineMath} />
                    </button>
                  ))}
                </div>
                <button
                  className="learning-check__submit"
                  type="button"
                  disabled={!selected}
                  onClick={() => setChecked((current) => ({ ...current, [step.id]: true }))}
                >核对答案</button>
                {hasChecked && (
                  <p className={`learning-check__feedback ${isCorrect ? "is-correct" : "is-wrong"}`} role="status">
                    <strong>{isCorrect ? "回答正确" : "需要订正"}</strong>
                    <MathText text={step.check.explanation} inlineMath={step.inlineMath} />
                  </p>
                )}
              </div>
            </div>
            <div className="learning-theory__controls learning-theory__controls--single">
              <button type="button" onClick={() => moveTheory(theoryBlocks.length - 1)}>← 回看理论</button>
            </div>
          </section>
        ) : (
          <section className="learning-theory" aria-live="polite">
            <div className="learning-theory__topline">
              <span>学习进度</span>
              <span aria-label={`理论内容块 ${theoryPage + 1}，共 ${theoryBlocks.length} 块`}>
                {theoryPage + 1}/{theoryBlocks.length}
              </span>
            </div>
            <div className="learning-theory-stack">
              <article
                key={theoryBlock.id}
                className="learning-theory-card"
                data-theory-kind={theoryBlock.kind}
                data-flip-direction={theoryFlipDirection}
              >
                <span className="learning-theory-card__kind">{theoryBlock.label}</span>
                <h2><MathText text={theoryBlock.title} inlineMath={step.inlineMath} /></h2>
                {theoryBlock.body && (
                  <p className={theoryBlock.concepts?.length ? "learning-theory-card__lead" : undefined}>
                    <MathText text={theoryBlock.body} inlineMath={step.inlineMath} />
                  </p>
                )}
                {Boolean(theoryBlock.concepts?.length) && (
                  <ol
                    className={`learning-math-concepts${theoryBlock.concepts?.length === 1 ? " learning-math-concepts--paged" : ""}`}
                    aria-label="本步数学概念"
                  >
                    {theoryBlock.concepts?.map((concept, index) => (
                      <li key={`${theoryBlock.id}-${concept.term}`}>
                        {theoryBlock.concepts && theoryBlock.concepts.length > 1 && (
                          <header>
                            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                            <h3><MathText text={concept.term} inlineMath={step.inlineMath} /></h3>
                          </header>
                        )}
                        {concept.notation && concept.notationLatex && theoryBlock.conceptFocus !== "context" && (
                          <p className="learning-math-concepts__notation">
                            <span>符号</span>
                            <MathNotation plain={concept.notation} latex={concept.notationLatex} />
                          </p>
                        )}
                        <dl>
                          {theoryBlock.conceptFocus !== "context" && (
                            <div>
                              <dt>标准定义</dt>
                              <dd><MathText text={concept.definition} inlineMath={step.inlineMath} /></dd>
                            </div>
                          )}
                          {theoryBlock.conceptFocus !== "definition" && (
                            <div>
                              <dt>本课题含义</dt>
                              <dd><MathText text={concept.context} inlineMath={step.inlineMath} /></dd>
                            </div>
                          )}
                        </dl>
                      </li>
                    ))}
                  </ol>
                )}
                {theoryBlock.formula && (
                  <MathFormula formula={theoryBlock.formula} inlineMath={step.inlineMath} />
                )}
              </article>
            </div>
            <div className="learning-theory__controls">
              <button
                type="button"
                onClick={() => moveTheory(theoryPage - 1)}
                disabled={theoryPage === 0}
              >← 回看</button>
              <div
                className="learning-theory__progress"
                role="progressbar"
                aria-label="本步理论学习进度"
                aria-valuemin={1}
                aria-valuemax={theoryBlocks.length}
                aria-valuenow={theoryPage + 1}
              >
                {theoryBlocks.map((item, index) => (
                  <i key={item.id} className={index <= theoryPage ? "is-active" : undefined} />
                ))}
              </div>
              <button
                type="button"
                className="is-primary"
                onClick={() => moveTheory(theoryPage + 1)}
              >{theoryPage === theoryBlocks.length - 1 ? "进入即时检查" : "继续学习"}</button>
            </div>
          </section>
        )}
      </aside>

      <article className="learning-canvas">
        <header className="learning-canvas__panel-heading learning-panel-heading">
          <span>INTERACTIVE MODEL</span>
          <strong>互动模型</strong>
        </header>
        <header className="learning-canvas__heading">
          <div>
            <span>步骤 {stepIndex + 1}/{steps.length}</span>
            <h1><MathText text={step.title} inlineMath={step.inlineMath} /></h1>
          </div>
          <p><strong>学习目标</strong><MathText text={step.objective} inlineMath={step.inlineMath} /></p>
        </header>

        <div className="learning-visual">
          <div className="learning-visual__label">
            <span>本步互动</span>
            <strong><MathText text={step.visualTitle} inlineMath={step.inlineMath} /></strong>
          </div>
          {isLocked ? (
            <div className="learning-lock">
              <span aria-hidden="true">◇</span>
              <strong>规律解释尚未揭示</strong>
              <p>先在 Playground 中锁定猜想并完成规定实验，再回到本步骤核对数学规律。</p>
              <Link to={topic.routes.playground}>进入模拟实验</Link>
            </div>
          ) : renderVisual(step, stepIndex)}
          <p className="learning-visual__caption">
            {isLocked
              ? "结论揭示状态由本课题的实验进度决定。"
              : <MathText text={step.visualCaption} inlineMath={step.inlineMath} />}
          </p>
        </div>
      </article>

      <footer className="learning-controls">
        <button type="button" className="has-step-icon" onClick={() => move(stepIndex - 1)} disabled={stepIndex === 0}><StepArrow direction="prev" />上一步</button>
        <div>
          <span>{stepIndex + 1} / {steps.length}</span>
          <i><b style={{ width: `${(stepIndex + 1) / steps.length * 100}%` }} /></i>
        </div>
        {stepIndex < steps.length - 1 ? (
          <button type="button" className="has-step-icon" onClick={() => move(stepIndex + 1)} disabled={!isCorrect}>下一学习步骤<StepArrow direction="next" /></button>
        ) : (
          <button
            type="button"
            className="is-primary"
            disabled={!allChecksCorrect}
            onClick={markCompleted}
          >{progress.status === "completed" ? "学习已完成" : "完成学习"}</button>
        )}
      </footer>
    </section>
  )
}
