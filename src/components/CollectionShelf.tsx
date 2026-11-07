import type { CSSProperties } from "react"
import { STYLE_IDS, type DrawEvent, type StyleId } from "../types"
import { PanelHeading } from "./PanelHeading"
import { getStyleVisual, StyleGlyph, type AccentStyle } from "./StyleGlyph"

export interface CollectionShelfProps {
  countsByStyle: readonly number[]
  missing: readonly StyleId[]
  lastEvent?: DrawEvent
  theoryUnlocked?: boolean
}

export function CollectionShelf({ countsByStyle, missing, lastEvent, theoryUnlocked = false }: CollectionShelfProps) {
  const missingSet = new Set<StyleId>(missing)
  const distinctCount = 6 - missing.length
  const purchaseCount = countsByStyle.reduce((sum, count) => sum + (count ?? 0), 0)
  const progressStyle = { "--progress": `${(distinctCount / 6) * 100}%` } as CSSProperties

  return (
    <section className="glass-panel collection-panel" aria-label="六神兽盲盒收藏架">
      <PanelHeading
        eyebrow="COLLECTION"
        title="六神兽收藏架"
        detail={<><strong className="collection-progress__number">{distinctCount}</strong><span>/6 款</span></>}
        action={<span className="purchase-chip">累计 {purchaseCount} 盒</span>}
      />

      <div className="collection-progress" aria-label={`已经收集 ${distinctCount} 款，共六款`}>
        <i style={progressStyle} aria-hidden="true"><b /></i>
        <span>{distinctCount === 6 ? "收藏完成" : `还差 ${missing.length} 款`}</span>
      </div>

      <div className="collection-shelf" role="list" aria-label="六神兽收藏数量">
        {STYLE_IDS.map((styleId, index) => {
          const visual = getStyleVisual(styleId)
          const count = countsByStyle[index] ?? 0
          const isMissing = missingSet.has(styleId)
          const isLatest = lastEvent?.styleId === styleId
          const accentStyle: AccentStyle = {
            "--accent": visual.color,
            "--accent-soft": visual.softColor,
          }
          return (
            <div
              key={styleId}
              className={`collection-card${isMissing ? " is-missing" : " is-collected"}${isLatest ? " is-latest" : ""}`}
              style={accentStyle}
              role="listitem"
              aria-label={`${visual.label}款${visual.name}${isMissing ? "，尚未收集" : `，已经抽到 ${count} 个`}${isLatest ? "，是本次抽中款式" : ""}`}
            >
              <span className="collection-card__scan" aria-hidden="true" />
              <div className="collection-card__topline">
                <strong>{visual.label}<small>{visual.name}</small></strong>
                <span>{isMissing ? "缺少" : "已解锁"}</span>
              </div>
              <div className="collection-card__figure">
                <StyleGlyph
                  styleId={styleId}
                  size="medium"
                  muted={isMissing}
                  trimTransparentPadding
                />
              </div>
              <div className="collection-card__count">
                <span>数量</span>
                <strong>{count}</strong>
                <small>个</small>
              </div>
              {isLatest && (
                <em className={lastEvent?.isNew ? "is-new" : "is-repeat"}>
                  {lastEvent?.isNew ? "NEW" : "+1"}
                </em>
              )}
            </div>
          )
        })}
      </div>

      <footer className="collection-panel__footer">
        <div>
          <span>尚未收集</span>
          <strong>
            {missing.length === 0
              ? "已全部集齐"
              : missing.map((styleId) => {
                const visual = getStyleVisual(styleId)
                return `${visual.label}${visual.name}`
              }).join(" · ")}
          </strong>
        </div>
        {theoryUnlocked ? (
          <div>
            <span>下一盒是新款的概率</span>
            <strong>{missing.length}/6 <small>≈ {((missing.length / 6) * 100).toFixed(1)}%</small></strong>
          </div>
        ) : (
          <div aria-label="阶段概率尚未揭示">
            <span>阶段概率</span>
            <strong>待揭示</strong>
          </div>
        )}
      </footer>
    </section>
  )
}
