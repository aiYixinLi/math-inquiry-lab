import type { CSSProperties } from "react"
import {
  HISTOGRAM_LABELS,
  THEORY_EXACT_SIX_RATE,
  THEORY_MEAN,
  type DiscoveryState,
  type ExperimentSummary,
} from "../types"
import { PanelHeading } from "./PanelHeading"

export interface StatsPanelProps {
  summary: ExperimentSummary
  plannedRounds: number
  discovery?: DiscoveryState
  onOpenDiscovery?: () => void
}

const DEFAULT_DISCOVERY: DiscoveryState = { theoryUnlocked: false }

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

function countText(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.round(value).toString() : "—"
}

function TrendChart({
  values,
  theoryUnlocked,
}: {
  values: readonly number[]
  theoryUnlocked: boolean
}) {
  const width = 300
  const height = 74
  const padX = 7
  const padY = 8
  const data = values.filter(Number.isFinite)
  const domain = data.length
    ? theoryUnlocked
      ? [...data, THEORY_MEAN]
      : data
    : theoryUnlocked
      ? [10, THEORY_MEAN, 20]
      : [10, 20]
  const min = Math.min(...domain) - 0.5
  const max = Math.max(...domain) + 0.5
  const span = Math.max(1, max - min)
  const xFor = (index: number) => padX + (data.length <= 1 ? 0 : index / (data.length - 1)) * (width - padX * 2)
  const yFor = (value: number) => padY + ((max - value) / span) * (height - padY * 2)
  const points = data.map((value, index) => `${xFor(index)},${yFor(value)}`).join(" ")
  const areaPoints = data.length
    ? `${padX},${height - padY} ${points} ${xFor(data.length - 1)},${height - padY}`
    : ""
  const theoryY = yFor(THEORY_MEAN)

  return (
    <svg
      className="trend-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={data.length ? `累计平均值趋势，最新为 ${data[data.length - 1].toFixed(2)} 盒` : "等待实验数据后显示累计平均趋势"}
    >
      <defs>
        <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--chart-cyan, #5ce7ff)" stopOpacity=".35" />
          <stop offset="1" stopColor="var(--chart-cyan, #5ce7ff)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--chart-violet, #8b7bff)" />
          <stop offset="1" stopColor="var(--chart-cyan, #5ce7ff)" />
        </linearGradient>
      </defs>
      <path className="trend-chart__grid" d={`M0 ${height * .25}H${width}M0 ${height * .5}H${width}M0 ${height * .75}H${width}`} />
      {theoryUnlocked && (
        <line className="trend-chart__theory" x1="0" x2={width} y1={theoryY} y2={theoryY} />
      )}
      {areaPoints && <polygon className="trend-chart__area" points={areaPoints} />}
      {points && <polyline className="trend-chart__line" points={points} />}
      {data.length > 0 && (
        <circle className="trend-chart__point" cx={xFor(data.length - 1)} cy={yFor(data[data.length - 1])} r="3.4" />
      )}
    </svg>
  )
}

function DuplicateDonut({ rate, count }: { rate: number; count: number }) {
  const normalizedRate = Math.min(1, Math.max(0, finite(rate)))
  const circumference = 2 * Math.PI * 24
  const dash = circumference * normalizedRate
  return (
    <div className="duplicate-donut" aria-label={`重复款共 ${count} 个，重复率 ${(normalizedRate * 100).toFixed(1)}%`}>
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <circle className="duplicate-donut__base" cx="30" cy="30" r="24" />
        <circle
          className="duplicate-donut__value"
          cx="30"
          cy="30"
          r="24"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <span><strong>{(normalizedRate * 100).toFixed(1)}</strong><small>%</small></span>
    </div>
  )
}

export function StatsPanel({
  summary,
  plannedRounds,
  discovery = DEFAULT_DISCOVERY,
  onOpenDiscovery,
}: StatsPanelProps) {
  const histogramMax = Math.max(1, ...summary.histogram)
  const isManualTotal = plannedRounds <= 0
  const completedRate = isManualTotal
    ? (summary.completedRounds > 0 ? 1 : 0)
    : Math.min(1, summary.completedRounds / plannedRounds)
  const mean = finite(summary.meanPurchases)
  const delta = finite(summary.meanMinusTheory)
  const theoryUnlocked = discovery.theoryUnlocked === true
  const discoveryLabel = theoryUnlocked
    ? "理论已解锁"
    : discovery.hypothesis
      ? "理论待揭示"
      : "先写猜想"

  return (
    <section className="glass-panel stats-panel" aria-label="全部实验的实时统计结果">
      <PanelHeading
        eyebrow="LIVE DATA"
        title="总体实验结果"
        detail={<span>{isManualTotal ? `已完成 ${summary.completedRounds} 轮` : `${summary.completedRounds}/${Math.max(plannedRounds, summary.completedRounds)} 轮`}</span>}
        action={
          <button
            type="button"
            className={`theory-chip discovery-chip${theoryUnlocked ? " is-unlocked" : ""}`}
            onClick={onOpenDiscovery}
            aria-label={`打开发现模式，${discoveryLabel}`}
          >
            <i aria-hidden="true" />
            发现模式 <strong>{discoveryLabel}</strong>
          </button>
        }
      />

      <div className="stats-progress" aria-label={isManualTotal ? `手动实验累计完成 ${summary.completedRounds} 轮` : `实验进度 ${(completedRate * 100).toFixed(0)}%`}>
        <i><b style={{ width: `${completedRate * 100}%` }} /></i>
        <span>{isManualTotal ? "累计" : `${(completedRate * 100).toFixed(0)}%`}</span>
      </div>

      <div className="kpi-grid">
        <article className="kpi-card kpi-card--primary">
          <span>平均集齐</span>
          <strong>{summary.completedRounds ? mean.toFixed(2) : "—"}<small> 盒</small></strong>
          <em className={theoryUnlocked ? (delta > 0 ? "is-up" : delta < 0 ? "is-down" : "") : ""}>
            {summary.completedRounds
              ? theoryUnlocked
                ? `${delta > 0 ? "+" : ""}${delta.toFixed(2)} 对比理论`
                : "先观察实验平均值"
              : "等待实验数据"}
          </em>
        </article>
        <article className="kpi-card">
          <span>最少 / 最多</span>
          <strong>{countText(summary.minPurchases)}<small> / </small>{countText(summary.maxPurchases)}</strong>
          <em>极差 {summary.completedRounds ? summary.range : "—"}</em>
        </article>
        <article className="kpi-card">
          <span>全部购买</span>
          <strong>{summary.totalPurchases || 0}<small> 盒</small></strong>
          <em>完成 {summary.completedRounds} 轮</em>
        </article>
        <article className="kpi-card">
          <span>恰好 6 盒集齐</span>
          <strong>{summary.exactSixCount || 0}<small> 轮</small></strong>
          <em>
            实验 {(finite(summary.exactSixRate) * 100).toFixed(2)}%
            {theoryUnlocked && ` · 理论 ${(THEORY_EXACT_SIX_RATE * 100).toFixed(2)}%`}
          </em>
        </article>
      </div>

      <div className="stats-chart stats-chart--trend">
        <div className="stats-chart__heading">
          <div>
            <strong>累计平均值趋势</strong>
            <span>{theoryUnlocked ? "观察与理论线的距离" : "观察实验平均值如何变化"}</span>
          </div>
          {theoryUnlocked && <span className="legend-line"><i />理论 14.70</span>}
        </div>
        <TrendChart
          values={summary.cumulativeMeans}
          theoryUnlocked={theoryUnlocked}
        />
      </div>

      <div className="stats-bottom-row">
        <div className="stats-chart stats-chart--histogram">
          <div className="stats-chart__heading">
            <div><strong>集齐盒数分布</strong><span>各区间轮数</span></div>
          </div>
          <div className="histogram" role="img" aria-label={`集齐盒数区间频数：${summary.histogram.join("、")}`}>
            {summary.histogram.map((count, index) => {
              const barStyle = { "--bar-height": `${Math.max(count ? 9 : 2, (count / histogramMax) * 100)}%` } as CSSProperties
              return (
                <div className="histogram__item" key={HISTOGRAM_LABELS[index]}>
                  <span>{count || ""}</span>
                  <i style={barStyle}><b /></i>
                  <small>{HISTOGRAM_LABELS[index].replace("～", "-")}</small>
                </div>
              )
            })}
          </div>
        </div>

        <div className="duplicate-summary">
          <DuplicateDonut rate={summary.duplicateRate} count={summary.totalDuplicates} />
          <div>
            <span>重复款</span>
            <strong>{summary.totalDuplicates || 0}<small> 个</small></strong>
            <em>平均 {finite(summary.meanDuplicates).toFixed(2)} 个/轮</em>
          </div>
        </div>
      </div>
    </section>
  )
}
