import type { CSSProperties } from "react"
import { STYLE_IDS, type RoundResult, type StyleId } from "../types"
import { PanelHeading } from "./PanelHeading"
import { getStyleVisual, StyleGlyph, type AccentStyle } from "./StyleGlyph"

export interface ReplayPanelProps {
  round: RoundResult | null
  step: number
  isPlaying: boolean
  theoryUnlocked?: boolean
  onStepChange: (step: number) => void
  onTogglePlaying: () => void
  onClose?: () => void
}

export function ReplayPanel({
  round,
  step,
  isPlaying,
  theoryUnlocked = false,
  onStepChange,
  onTogglePlaying,
  onClose,
}: ReplayPanelProps) {
  if (!round) {
    return (
      <section className="glass-panel replay-panel replay-panel--empty" aria-label="轮次过程回放">
        <PanelHeading eyebrow="REPLAY" title="单轮过程回放" detail={<span>等待选择</span>} />
        <div className="replay-empty">
          <span aria-hidden="true"><i /><i /><i /></span>
          <div><strong>选择一个已完成轮次</strong><small>{theoryUnlocked ? "这里将逐盒还原收藏数量、缺少款式和新款概率" : "这里将逐盒还原收藏数量和缺少款式"}</small></div>
        </div>
      </section>
    )
  }

  const safeStep = Math.min(round.events.length, Math.max(0, Math.round(step)))
  const currentEvent = safeStep > 0 ? round.events[safeStep - 1] : undefined
  const counts = currentEvent?.countsAfter ?? [0, 0, 0, 0, 0, 0]
  const missing = currentEvent?.missingAfter ?? [...STYLE_IDS]
  const currentVisual = currentEvent ? getStyleVisual(currentEvent.styleId) : null
  const timelineStyle = { "--event-count": Math.max(1, round.events.length) } as CSSProperties

  return (
    <section className="glass-panel replay-panel" aria-label={`第 ${round.roundIndex} 轮完整过程回放`}>
      <PanelHeading
        eyebrow="REPLAY"
        title={`第 ${round.roundIndex} 轮过程`}
        detail={<span>{round.totalPurchases} 盒集齐 · {round.duplicateCount} 个重复</span>}
        action={onClose && (
          <button type="button" className="replay-close" onClick={onClose} aria-label="关闭本轮回放">×</button>
        )}
      />

      <div className="replay-body">
        <div className="replay-now" aria-live="polite">
          <button
            type="button"
            className={`replay-play${isPlaying ? " is-playing" : ""}`}
            onClick={onTogglePlaying}
            aria-label={isPlaying ? "暂停回放" : safeStep >= round.events.length ? "从头播放" : "播放本轮过程"}
          >
            <i aria-hidden="true" />
          </button>
          <div className="replay-now__event">
            {currentEvent && currentVisual ? (
              <>
                <StyleGlyph styleId={currentEvent.styleId} size="small" />
                <span><small>第 {safeStep} 盒抽中</small><strong>{currentVisual.label} · {currentVisual.name} · {currentEvent.isNew ? "新款" : "重复"}</strong></span>
                <em className={currentEvent.isNew ? "is-new" : "is-repeat"}>{currentEvent.isNew ? "NEW" : "+1"}</em>
              </>
            ) : (
              <span className="replay-now__start"><small>初始状态</small><strong>还没有购买盲盒</strong></span>
            )}
          </div>
          {theoryUnlocked && (
            <div className="replay-now__probability">
              <span>抽取前新款概率</span>
              <strong>{currentEvent ? `${Math.round(currentEvent.newProbabilityBefore * 6)}/6` : "6/6"}</strong>
            </div>
          )}
        </div>

        <div className="replay-collection" aria-label="当前步骤各款数量">
          {STYLE_IDS.map((styleId, index) => {
            const visual = getStyleVisual(styleId)
            const isMissing = (missing as readonly StyleId[]).includes(styleId)
            const accentStyle: AccentStyle = { "--accent": visual.color, "--accent-soft": visual.softColor }
            return (
              <span
                key={styleId}
                className={isMissing ? "is-missing" : ""}
                style={accentStyle}
                aria-label={`${visual.label}款${visual.name} ${counts[index] ?? 0} 个`}
              >
                <b>{visual.label}</b><strong>{counts[index] ?? 0}</strong>
              </span>
            )
          })}
          <div className="replay-missing">
            <span>还缺少</span>
            <strong>{missing.length ? missing.map((id) => {
              const visual = getStyleVisual(id)
              return `${visual.label}${visual.name}`
            }).join(" · ") : "无，已经集齐"}</strong>
          </div>
        </div>
      </div>

      <div className="replay-timeline-wrap">
        <div className="replay-timeline" style={timelineStyle} aria-label="完整抽取顺序">
          {round.events.map((event, eventIndex) => {
            const visual = getStyleVisual(event.styleId)
            const eventStyle: AccentStyle = { "--accent": visual.color, "--accent-soft": visual.softColor }
            const eventStep = eventIndex + 1
            return (
              <button
                key={eventStep}
                type="button"
                className={`${eventStep <= safeStep ? "is-past" : ""}${eventStep === safeStep ? " is-current" : ""}${event.isNew ? " is-new" : " is-repeat"}`}
                style={eventStyle}
                onClick={() => onStepChange(eventStep)}
                aria-label={`第 ${eventStep} 盒，${visual.label}款${visual.name}，${event.isNew ? "新款" : "重复款"}`}
                aria-current={eventStep === safeStep ? "step" : undefined}
                title={`${eventStep}. ${visual.label}${visual.name}${event.isNew ? " 新" : " 重复"}`}
              ><i /></button>
            )
          })}
        </div>
        <div className="replay-slider-row">
          <span>0</span>
          <input
            type="range"
            min="0"
            max={round.events.length}
            step="1"
            value={safeStep}
            onChange={(event) => onStepChange(Number(event.target.value))}
            aria-label="选择回放到第几盒"
          />
          <strong>{safeStep}<small> / {round.events.length} 盒</small></strong>
        </div>
      </div>
    </section>
  )
}
