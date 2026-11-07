import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react"
import { canUnlockTheory } from "../lib/discovery"
import {
  THEORY_EXACT_SIX_RATE,
  THEORY_MEAN,
  type DiscoveryState,
  type TheoryUnlockMethod,
} from "../types"

export interface DiscoveryDialogProps {
  open: boolean
  discovery: DiscoveryState
  completedRounds: number
  experimentMean: number
  onSubmitHypothesis: (meanPurchases: number, reason: string) => void
  onUnlockTheory: (method: TheoryUnlockMethod) => void
  onClose: () => void
}

const focusableSelector =
  'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'

export function DiscoveryDialog({
  open,
  discovery,
  completedRounds,
  experimentMean,
  onSubmitHypothesis,
  onUnlockTheory,
  onClose,
}: DiscoveryDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [meanInput, setMeanInput] = useState("")
  const [reasonInput, setReasonInput] = useState("")
  const [formError, setFormError] = useState("")
  const phase = !discovery.hypothesis
    ? "hypothesis"
    : discovery.theoryUnlocked === true
      ? "revealed"
      : "gate"

  useEffect(() => {
    if (!open) return

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const dialog = dialogRef.current
    const firstTarget = dialog?.querySelector<HTMLElement>(
      discovery.hypothesis ? "button" : "input",
    )
    firstTarget?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== "Tab" || !dialog) return
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ].filter((element) => element.getClientRects().length > 0)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      returnFocusRef.current?.focus()
      returnFocusRef.current = null
    }
  }, [onClose, open])

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    const target =
      dialog?.querySelector<HTMLElement>("[data-discovery-autofocus]") ??
      dialog?.querySelector<HTMLElement>(focusableSelector)
    target?.focus()
  }, [open, phase])

  useEffect(() => {
    if (!discovery.hypothesis) return
    setFormError("")
  }, [discovery.hypothesis])

  if (!open) return null

  const hypothesis = discovery.hypothesis
  const canRevealTheory = canUnlockTheory(discovery, completedRounds)
  const completedRoundsAfterSubmission = hypothesis
    ? Math.max(0, completedRounds - hypothesis.completedRoundsAtSubmission)
    : 0
  const differenceFromGuess = hypothesis
    ? THEORY_MEAN - hypothesis.meanPurchases
    : 0

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const meanPurchases = Number(meanInput)
    const reason = reasonInput.trim()

    if (!Number.isFinite(meanPurchases) || meanPurchases <= 0 || meanPurchases > 999) {
      setFormError("请填写 0～999 之间的有效数字。")
      return
    }
    if (!reason) {
      setFormError("请写下作出这个猜想的理由。")
      return
    }

    setFormError("")
    onSubmitHypothesis(meanPurchases, reason)
  }

  const requestUnlock = (method: TheoryUnlockMethod) => {
    if (!canRevealTheory) return
    const message =
      method === "teacher"
        ? "确认由教师揭示理论答案吗？揭示后，本次研究将保留解锁记录。"
        : "确认已经完成观察，要比较猜想并揭示理论答案吗？揭示后不能重新隐藏。"
    if (window.confirm(message)) {
      onUnlockTheory(method)
    }
  }

  return (
    <div className="discovery-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <div
        ref={dialogRef}
        className="discovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discovery-title"
        aria-describedby="discovery-description"
      >
        <header className="discovery-dialog__header">
          <div>
            <span>DISCOVERY MODE</span>
            <h2 id="discovery-title">发现模式</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭发现模式">
            ×
          </button>
        </header>

        <p id="discovery-description" className="discovery-dialog__lead">
          先记录自己的判断，再用实验数据检验。理论答案会一直保持隐藏，直到猜想提交并明确揭示。
        </p>

        {!hypothesis ? (
          <form className="discovery-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="hypothesis-mean">
              <span>我猜平均需要多少盒才能集齐？</span>
              <span className="discovery-number-field">
                <input
                  data-discovery-autofocus
                  id="hypothesis-mean"
                  type="number"
                  min="0.1"
                  max="999"
                  step="0.1"
                  inputMode="decimal"
                  aria-label="我猜平均需要多少盒才能集齐？"
                  value={meanInput}
                  onChange={(event) => setMeanInput(event.target.value)}
                  aria-describedby={formError ? "discovery-form-error" : undefined}
                  required
                />
                <b>盒</b>
              </span>
            </label>
            <label htmlFor="hypothesis-reason">
              <span>我的理由</span>
              <textarea
                id="hypothesis-reason"
                rows={3}
                maxLength={240}
                aria-label="我的理由"
                value={reasonInput}
                onChange={(event) => setReasonInput(event.target.value)}
                placeholder="例如：开始时很容易抽到新款，但越到后面重复款可能越多。"
                aria-describedby={formError ? "discovery-form-error" : undefined}
                required
              />
            </label>
            {formError && (
              <p id="discovery-form-error" className="discovery-form__error" role="alert">
                {formError}
              </p>
            )}
            <div className="discovery-dialog__actions">
              <button type="submit" className="discovery-primary">
                提交并锁定猜想
              </button>
              <button type="button" className="discovery-secondary" onClick={onClose}>
                暂不填写
              </button>
            </div>
          </form>
        ) : (
          <div className="discovery-workflow">
            <section className="hypothesis-record" aria-label="已提交的学生猜想">
              <span>学生猜想 · 已保存</span>
              <strong>平均需要 {hypothesis.meanPurchases.toFixed(1)} 盒</strong>
              <p>{hypothesis.reason}</p>
              <small>提交后已锁定；重置整个研究后才能重新填写。</small>
            </section>

            {discovery.theoryUnlocked !== true ? (
              <section
                className="theory-gate"
                aria-label="理论答案尚未解锁"
                tabIndex={-1}
                data-discovery-autofocus
              >
                <div className="theory-gate__lock" aria-hidden="true">?</div>
                <div>
                  <strong>理论答案仍隐藏</strong>
                  <p>
                    {completedRoundsAfterSubmission > 0
                      ? `猜想锁定后已完成 ${completedRoundsAfterSubmission} 轮，可以比较猜想与理论。`
                      : "请在锁定猜想后至少完成 1 轮新实验。"}
                  </p>
                </div>
                <button
                  type="button"
                  className="discovery-primary"
                  disabled={!canRevealTheory}
                  onClick={() => requestUnlock("student")}
                >
                  {canRevealTheory ? "完成观察，揭示理论" : "完成 1 轮新实验后可揭示"}
                </button>
                <details className="teacher-reveal">
                  <summary>教师操作</summary>
                  <p>{canRevealTheory ? "用于课堂讲解或教师控制的揭示时点。" : "教师与学生使用相同门槛：猜想后至少完成 1 轮新实验。"}</p>
                  <button
                    type="button"
                    className="discovery-secondary"
                    disabled={!canRevealTheory}
                    onClick={() => requestUnlock("teacher")}
                  >
                    教师揭示理论
                  </button>
                </details>
              </section>
            ) : (
              <section
                className="theory-reveal"
                aria-label="已解锁的理论答案"
                tabIndex={-1}
                data-discovery-autofocus
              >
                <div className="theory-reveal__answer">
                  <span>理论平均值</span>
                  <strong>{THEORY_MEAN.toFixed(2)}<small> 盒</small></strong>
                  <p>
                    比你的猜想{differenceFromGuess === 0
                      ? "相同"
                      : `${differenceFromGuess > 0 ? "多" : "少"} ${Math.abs(differenceFromGuess).toFixed(2)} 盒`}
                  </p>
                </div>
                <div className="theory-reveal__formula">
                  <strong>为什么是这个结果？</strong>
                  <p>
                    <span aria-label="六除以六，加六除以五，加六除以四，加六除以三，加六除以二，加六除以一，等于十四点七零">
                      6/6 ＋ 6/5 ＋ 6/4 ＋ 6/3 ＋ 6/2 ＋ 6/1 ＝ 14.70
                    </span>
                  </p>
                  <small>从第 1 款到最后 1 款，各阶段等待时间依次变长。</small>
                </div>
                <div className="theory-reveal__six">
                  <span>恰好 6 盒集齐</span>
                  <strong>6! / 6⁶ ＝ {(THEORY_EXACT_SIX_RATE * 100).toFixed(2)}%</strong>
                </div>
                {completedRounds > 0 && Number.isFinite(experimentMean) && (
                  <p className="theory-reveal__comparison">
                    当前 {completedRounds} 轮实验平均值为 {experimentMean.toFixed(2)} 盒，与理论值相差 {Math.abs(experimentMean - THEORY_MEAN).toFixed(2)} 盒。
                  </p>
                )}
                <small className="theory-reveal__audit">
                  {discovery.theoryUnlockMethod === "teacher" ? "由教师揭示" : "由学生明确揭示"}
                </small>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
