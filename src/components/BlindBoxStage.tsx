import type { ActiveRound, DrawEvent, ExperimentStatus } from "../types"
import blindBoxPackage from "../../assets/00.png"
import { PanelHeading } from "./PanelHeading"
import { getStyleVisual, StyleGlyph } from "./StyleGlyph"

export interface BlindBoxStageProps {
  round: ActiveRound | null
  lastEvent?: DrawEvent
  status: ExperimentStatus
  disabled?: boolean
  hypothesisLocked?: boolean
  onOpen?: () => void
}
export function BlindBoxStage({
  round,
  lastEvent,
  status,
  disabled = false,
  hypothesisLocked = true,
  onOpen,
}: BlindBoxStageProps) {
  const isOpening = status === "opening" || status === "running"
  const completed = round?.completed ?? false
  const purchaseCount = round?.sequence.length ?? 0
  const resultVisual = lastEvent ? getStyleVisual(lastEvent.styleId) : null
  const stageClass = [
    "blind-box-stage",
    isOpening ? "is-opening" : "",
    lastEvent?.isNew ? "has-new-result" : lastEvent ? "has-duplicate-result" : "",
    completed ? "is-complete" : "",
  ].filter(Boolean).join(" ")

  return (
    <section className="glass-panel stage-panel" aria-labelledby="stage-title">
      <PanelHeading
        eyebrow="LIVE OPENING"
        title="实时开盒舱"
        detail={<span id="stage-title">第 {round?.roundIndex ?? 1} 轮 · 第 {purchaseCount} 盒</span>}
        action={
          <span className={`live-chip${isOpening ? " is-live" : ""}`}>
            <i aria-hidden="true" />{!hypothesisLocked ? "等待猜想" : isOpening ? "模拟中" : completed ? "已集齐" : "准备就绪"}
          </span>
        }
      />

      <div className={stageClass}>
        <div className="stage-radar" aria-hidden="true">
          <i /><i /><i />
        </div>
        <div className="stage-beam" aria-hidden="true" />

        <button
          type="button"
          className="blind-box-trigger"
          onClick={onOpen}
          disabled={disabled || !onOpen || isOpening || completed}
          aria-label={!hypothesisLocked ? "请先写下并锁定猜想，再打开盲盒" : completed ? "本轮已集齐六款" : isOpening ? "正在打开盲盒" : "点击打开一个盲盒"}
        >
          <span className="blind-box-object" aria-hidden="true">
            <span className="blind-box-object__shadow" />
            <img
              className="blind-box-object__art"
              src={blindBoxPackage}
              alt=""
              aria-hidden="true"
              decoding="async"
              draggable="false"
            />
            <span className="blind-box-object__sparkles">
              <i /><i /><i /><i /><i />
            </span>
          </span>
        </button>

        <div className="draw-result" aria-live="polite" aria-atomic="true">
          {lastEvent && resultVisual ? (
            <div
              key={`${lastEvent.index}-${lastEvent.styleId}`}
              className={`draw-result__card${lastEvent.isNew ? " is-new" : " is-duplicate"}`}
            >
              <span className="draw-result__figure">
                <span className="draw-result__halo" aria-hidden="true" />
                <StyleGlyph
                  styleId={lastEvent.styleId}
                  size="large"
                  trimTransparentPadding
                />
              </span>
              <span className="draw-result__copy">
                <small>本次抽中</small>
                <strong>{resultVisual.label} · {resultVisual.name}</strong>
                <em>{lastEvent.isNew ? "NEW  新款入藏" : "REPEAT  重复款"}</em>
              </span>
            </div>
          ) : (
            <div className="draw-result__waiting">
              <span aria-hidden="true">⌁</span>
              <p>
                <strong>{hypothesisLocked ? "等待第一次开盒" : "请先写下并锁定猜想"}</strong>
                <small>{hypothesisLocked ? "点击立体盲盒，观察随机结果" : "锁定前开盒功能保持关闭"}</small>
              </p>
            </div>
          )}
        </div>

        {completed && (
          <div className="completion-flare" role="status">
            <span aria-hidden="true">✦</span>
            <strong>六款集齐！</strong>
            <small>本轮共购买 {purchaseCount} 盒</small>
          </div>
        )}
      </div>
    </section>
  )
}
