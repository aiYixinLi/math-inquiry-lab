import { useEffect, useMemo, useRef, useState } from "react"
import { TopicShell } from "../../../app/layouts"
import { useModuleProgress } from "../../../shared/progress"
import {
  CirclePartitionSvg,
  RectanglePartitionSvg,
} from "../components/CakePartitionSvg"
import {
  cakePlanSignature,
  createCakeExperiment,
  divisors,
  planCriterionValue,
  type CakeExperimentTemplate,
  type CakeFairnessCriterion,
  type CakeShape,
  type SavedCakePlan,
} from "./experiment"
import {
  createCakeExportPayload,
  downloadCakeCsv,
  downloadCakeJson,
} from "./export"
import "../topic.css"

const CRITERIA: readonly {
  id: CakeFairnessCriterion
  label: string
  short: string
}[] = [
  { id: "area", label: "面积公平", short: "面积偏差" },
  { id: "outer", label: "外沿公平", short: "外沿极差" },
  { id: "perimeter", label: "总周长公平", short: "周长极差" },
  { id: "cost", label: "切割成本", short: "内部切线" },
]

const makeId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `cake-plan-${Date.now()}-${Math.random().toString(16).slice(2)}`

function MetricChart({
  label,
  values,
  target,
}: {
  readonly label: string
  readonly values: readonly number[]
  readonly target?: number
}) {
  const maximum = Math.max(...values, target ?? 0, 1)
  const width = 260
  const height = 86
  const gap = 5
  const barWidth = (width - 20 - gap * (values.length - 1)) / values.length
  const targetY = target === undefined ? undefined : 65 - (target / maximum) * 49

  return (
    <figure className="cake-metric-chart">
      <figcaption>{label}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}柱形图`}>
        <line x1="10" y1="65" x2={width - 10} y2="65" className="cake-chart-axis" />
        {targetY !== undefined && (
          <g>
            <line x1="10" y1={targetY} x2={width - 10} y2={targetY} className="cake-chart-target" />
            <text x={width - 11} y={Math.max(9, targetY - 3)} className="cake-chart-target-label">目标</text>
          </g>
        )}
        {values.map((value, index) => {
          const barHeight = (value / maximum) * 49
          const x = 10 + index * (barWidth + gap)
          return (
            <g key={`${label}-${index}`}>
              <rect x={x} y={65 - barHeight} width={barWidth} height={barHeight} rx="2" className={`cake-chart-bar cake-chart-bar--${index % 8}`} />
              <text x={x + barWidth / 2} y="77" className="cake-chart-label">{index + 1}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

export default function CakePlaygroundPage() {
  const { progress, markStarted, markCompleted } = useModuleProgress(
    "cake-cutting",
    "playground",
  )
  const sessionStartedAt = useRef(new Date().toISOString())
  const sessionId = useRef(makeId())
  const [shape, setShape] = useState<CakeShape>("circle")
  const [people, setPeople] = useState(4)
  const [circleTemplate, setCircleTemplate] = useState<CakeExperimentTemplate>("adjustable-sectors")
  const [squareTemplate, setSquareTemplate] = useState<CakeExperimentTemplate>("parallel-strips")
  const [firstSectorAngle, setFirstSectorAngle] = useState(90)
  const [firstStripPercent, setFirstStripPercent] = useState(25)
  const [gridRows, setGridRows] = useState(2)
  const [firstRowPercent, setFirstRowPercent] = useState(50)
  const [firstColumnPercent, setFirstColumnPercent] = useState(50)
  const [criterion, setCriterion] = useState<CakeFairnessCriterion>("area")
  const [allowedDeviationPercent, setAllowedDeviationPercent] = useState(5)
  const [predictedTemplate, setPredictedTemplate] = useState<
    CakeExperimentTemplate | ""
  >("")
  const [predictionReason, setPredictionReason] = useState("")
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [hypothesisSubmittedAt, setHypothesisSubmittedAt] = useState("")
  const [savedPlans, setSavedPlans] = useState<SavedCakePlan[]>([])
  const [comparisonActive, setComparisonActive] = useState(false)
  const [comparisonCompletedAt, setComparisonCompletedAt] = useState("")
  const [theoryViewedAt, setTheoryViewedAt] = useState<string | null>(null)
  const [notice, setNotice] = useState("先选择一种较优切法并锁定预测理由。")

  useEffect(() => markStarted(), [markStarted])

  const template = shape === "circle" ? circleTemplate : squareTemplate
  const availableRows = useMemo(() => divisors(people), [people])
  const effectiveGridRows = availableRows.includes(gridRows) ? gridRows : 1
  const parameters = useMemo(() => ({
    shape,
    template,
    size: 12,
    people,
    firstSectorAngle,
    firstStripPercent,
    gridRows: effectiveGridRows,
    firstRowPercent,
    firstColumnPercent,
    criterion,
    allowedDeviationPercent,
  }), [
    allowedDeviationPercent,
    criterion,
    effectiveGridRows,
    firstColumnPercent,
    firstRowPercent,
    firstSectorAngle,
    firstStripPercent,
    people,
    shape,
    template,
  ])
  const snapshot = useMemo(() => createCakeExperiment(parameters), [parameters])
  const criterionDefinition = CRITERIA.find((item) => item.id === criterion) ?? CRITERIA[0]
  const bestPlan = comparisonActive && savedPlans.length >= 2
    ? savedPlans.reduce((best, plan) =>
        planCriterionValue(plan, criterion) < planCriterionValue(best, criterion)
          ? plan
          : best,
      )
    : undefined

  const invalidateComparison = () => {
    setComparisonActive(false)
    setComparisonCompletedAt("")
    setTheoryViewedAt(null)
  }

  const updatePeople = (nextPeople: number) => {
    setPeople(nextPeople)
    const nextRows = divisors(nextPeople)
    if (!nextRows.includes(gridRows)) {
      setGridRows(nextRows.find((value) => value > 1 && value < nextPeople) ?? 1)
    }
    invalidateComparison()
  }

  const lockPrediction = () => {
    const reason = predictionReason.trim()
    if (!predictedTemplate || reason.length < 4) {
      setNotice("请选择预测切法，并填写不少于 4 个字的理由。")
      return
    }

    setPredictionReason(reason)
    setPredictionLocked(true)
    setHypothesisSubmittedAt(new Date().toISOString())
    setNotice("预测已锁定；现在可以调整参数并保存第一种方案。")
  }

  const saveCurrentPlan = () => {
    if (!predictionLocked) {
      setNotice("请先选择较优切法、填写理由并锁定预测。")
      return
    }

    const signature = cakePlanSignature(parameters)
    if (savedPlans.some((plan) => plan.signature === signature)) {
      setNotice("当前参数与已保存方案相同，请先调整切法。")
      return
    }

    const nextPlan: SavedCakePlan = {
      id: makeId(),
      name: `方案 ${String.fromCharCode(65 + savedPlans.length)}`,
      savedAt: new Date().toISOString(),
      signature,
      snapshot,
    }
    setSavedPlans((current) => [...current, nextPlan].slice(-4))
    invalidateComparison()
    setNotice(savedPlans.length === 0
      ? "方案 A 已保存；请调整参数后保存第二种方案。"
      : "第二种方案已保存，可以开始指标比较。")
  }

  const comparePlans = () => {
    if (savedPlans.length < 2) {
      setNotice("至少保存两种不同方案后才能比较。")
      return
    }
    const completedAt = new Date().toISOString()
    setComparisonActive(true)
    setComparisonCompletedAt(completedAt)
    markCompleted()
    setNotice("比较完成：实验进度已记录，可返回学习页查看规律总结。")
  }

  const exportPayload = () => createCakeExportPayload(snapshot, {
    sessionId: sessionId.current,
    sessionStartedAt: sessionStartedAt.current,
    sessionEndedAt: comparisonCompletedAt || undefined,
    hypothesisSubmittedAt: hypothesisSubmittedAt || null,
    theoryViewedAt,
    hypothesis: predictionLocked && predictedTemplate
      ? {
          predicted_template: predictedTemplate,
          reason: predictionReason,
        }
      : null,
    savedPlans,
  })

  const pieces = snapshot.partition.pieces
  const areaValues = pieces.map((piece) => piece.area)
  const perimeterValues = pieces.map((piece) => piece.totalPerimeter)

  return (
    <TopicShell topicId="cake-cutting" module="playground">
      <section className="cake-lab" aria-label="蛋糕公平切分模拟实验">
        <aside className="cake-lab-panel cake-lab-controls">
          <header className="cake-panel-heading">
            <span>EXPERIMENT BRIEF</span>
            <h1>公平切分工作台</h1>
          </header>

          <div className="cake-brief-grid">
            <section><strong>实验目标</strong><p>比较不同切法在面积、外沿、总周长和切割成本上的差异。</p></section>
            <section><strong>操作说明</strong><p>选择模型 → 预测 → 调整 → 保存两案 → 比较并导出。</p></section>
            <section><strong>模型假设</strong><p>厚度、密度和馅料均匀；切割无损耗、无重叠和空隙。</p></section>
            <section><strong>数据来源</strong><p>浏览器按确定性几何公式生成的候选记录，不是食物实测或学习证据。</p></section>
          </div>

          <section className="cake-hypothesis" aria-label="实验前预测">
            <header>
              <strong>实验前预测</strong>
              <small>{predictionLocked ? "已锁定" : "锁定后才可保存方案"}</small>
            </header>
            {!predictionLocked ? (
              <div className="cake-hypothesis-form">
                <select
                  aria-label="预测较优切法"
                  value={predictedTemplate}
                  onChange={(event) => setPredictedTemplate(
                    event.target.value as CakeExperimentTemplate | "",
                  )}
                >
                  <option value="">选择较优切法</option>
                  <option value="equal-sectors">等角扇形</option>
                  <option value="adjustable-sectors">可调圆心角扇形</option>
                  <option value="parallel-strips">平行条带</option>
                  <option value="rectangular-grid">矩形网格</option>
                </select>
                <input
                  aria-label="预测理由"
                  type="text"
                  maxLength={36}
                  value={predictionReason}
                  placeholder="说明依据（至少 4 个字）"
                  onChange={(event) => setPredictionReason(event.target.value)}
                />
                <button
                  type="button"
                  disabled={!predictedTemplate || predictionReason.trim().length < 4}
                  onClick={lockPrediction}
                >锁定预测</button>
              </div>
            ) : predictedTemplate && (
              <p>
                <span>预测：</span>
                <strong>{{
                  "equal-sectors": "等角扇形",
                  "adjustable-sectors": "可调圆心角扇形",
                  "parallel-strips": "平行条带",
                  "rectangular-grid": "矩形网格",
                }[predictedTemplate]}</strong>
                <span>；理由：{predictionReason}</span>
              </p>
            )}
          </section>

          <div className="cake-control-stack">
            <fieldset>
              <legend>蛋糕形状</legend>
              <div className="cake-segmented" role="group" aria-label="蛋糕形状">
                <button type="button" className={shape === "circle" ? "is-active" : undefined} onClick={() => { setShape("circle"); invalidateComparison() }}>圆形</button>
                <button type="button" className={shape === "square" ? "is-active" : undefined} onClick={() => { setShape("square"); invalidateComparison() }}>正方形</button>
              </div>
            </fieldset>

            <label className="cake-range-control">
              <span>分配人数<strong>{people} 人</strong></span>
              <input aria-label="分配人数" type="range" min="2" max="8" step="1" value={people} onChange={(event) => updatePeople(Number(event.target.value))} />
            </label>

            <label className="cake-select-control">
              <span>切分模板</span>
              {shape === "circle" ? (
                <select aria-label="圆形切分模板" value={circleTemplate} onChange={(event) => { setCircleTemplate(event.target.value as CakeExperimentTemplate); invalidateComparison() }}>
                  <option value="equal-sectors">等角扇形</option>
                  <option value="adjustable-sectors">可调圆心角扇形</option>
                </select>
              ) : (
                <select aria-label="正方形切分模板" value={squareTemplate} onChange={(event) => { setSquareTemplate(event.target.value as CakeExperimentTemplate); invalidateComparison() }}>
                  <option value="parallel-strips">平行条带</option>
                  <option value="rectangular-grid">矩形网格</option>
                </select>
              )}
            </label>

            {shape === "circle" && circleTemplate === "adjustable-sectors" && (
              <label className="cake-range-control">
                <span>第1块圆心角<strong>{firstSectorAngle}°</strong></span>
                <input aria-label="实验中的第一块圆心角" type="range" min="30" max="330" step="5" value={firstSectorAngle} onChange={(event) => { setFirstSectorAngle(Number(event.target.value)); invalidateComparison() }} />
              </label>
            )}

            {shape === "square" && squareTemplate === "parallel-strips" && (
              <label className="cake-range-control">
                <span>首条带宽度占比<strong>{firstStripPercent}%</strong></span>
                <input aria-label="首条带宽度占比" type="range" min="10" max="70" step="1" value={firstStripPercent} onChange={(event) => { setFirstStripPercent(Number(event.target.value)); invalidateComparison() }} />
              </label>
            )}

            {shape === "square" && squareTemplate === "rectangular-grid" && (
              <div className="cake-grid-controls">
                <label className="cake-select-control"><span>网格行列</span><select aria-label="矩形网格行数" value={effectiveGridRows} onChange={(event) => { setGridRows(Number(event.target.value)); invalidateComparison() }}>{availableRows.map((rows) => <option key={rows} value={rows}>{rows} 行 × {people / rows} 列</option>)}</select></label>
                {effectiveGridRows > 1 && <label className="cake-range-control"><span>首行高度<strong>{firstRowPercent}%</strong></span><input aria-label="首行高度占比" type="range" min="10" max="70" value={firstRowPercent} onChange={(event) => { setFirstRowPercent(Number(event.target.value)); invalidateComparison() }} /></label>}
                {people / effectiveGridRows > 1 && <label className="cake-range-control"><span>首列宽度<strong>{firstColumnPercent}%</strong></span><input aria-label="首列宽度占比" type="range" min="10" max="70" value={firstColumnPercent} onChange={(event) => { setFirstColumnPercent(Number(event.target.value)); invalidateComparison() }} /></label>}
              </div>
            )}

            <fieldset>
              <legend>当前公平指标</legend>
              <div className="cake-criterion-grid" role="group" aria-label="公平指标">
                {CRITERIA.map((item) => <button key={item.id} type="button" className={criterion === item.id ? "is-active" : undefined} onClick={() => { setCriterion(item.id); invalidateComparison() }}>{item.label}</button>)}
              </div>
            </fieldset>

            <label className="cake-range-control">
              <span>允许偏差<strong>{allowedDeviationPercent}%</strong></span>
              <input aria-label="允许偏差" type="range" min="0" max="20" step="1" value={allowedDeviationPercent} onChange={(event) => setAllowedDeviationPercent(Number(event.target.value))} disabled={criterion === "cost"} />
            </label>
          </div>
        </aside>

        <section className="cake-lab-panel cake-lab-stage">
          <header className="cake-stage-heading">
            <div><span>EXACT GEOMETRY</span><h2>{shape === "circle" ? "半径 12 cm 的圆形蛋糕" : "边长 12 cm 的正方形蛋糕"}</h2></div>
            <p className={snapshot.meetsAllowedDeviation === false ? "is-warning" : "is-ok"}>
              {criterion === "cost"
                ? `内部切线 ${snapshot.partition.internalCutLength.toFixed(2)} cm`
                : `${criterionDefinition.label}：${snapshot.meetsAllowedDeviation ? "在允许偏差内" : "超过允许偏差"}`}
            </p>
          </header>

          <div className="cake-stage-visual">
            <div className="cake-stage-svg">
              {shape === "circle" ? (
                <CirclePartitionSvg anglesDegrees={snapshot.layout.circleAngles ?? []} title="当前圆形蛋糕精确切分图" />
              ) : (
                <RectanglePartitionSvg width={12} height={12} rowHeights={snapshot.layout.rowHeights ?? [12]} columnWidths={snapshot.layout.columnWidths ?? [12]} title="当前正方形蛋糕精确切分图" />
              )}
              <div className="cake-svg-legend"><span><i className="is-outer" />原蛋糕外沿</span><span><i className="is-cut" />新增切口</span></div>
            </div>
            <div className="cake-metric-cards">
              <article><span>目标面积</span><strong>{snapshot.partition.metrics.targetArea.toFixed(2)}</strong><small>cm²/块</small></article>
              <article><span>最大相对偏差</span><strong>{(snapshot.partition.metrics.maxRelativeAreaDeviation * 100).toFixed(1)}%</strong><small>面积指标</small></article>
              <article><span>外沿极差</span><strong>{snapshot.partition.metrics.outerBoundaryRange.toFixed(2)}</strong><small>cm</small></article>
              <article><span>周长极差</span><strong>{snapshot.partition.metrics.perimeterRange.toFixed(2)}</strong><small>cm</small></article>
              <article><span>内部切线</span><strong>{snapshot.partition.internalCutLength.toFixed(2)}</strong><small>cm</small></article>
              <article><span>守恒核验</span><strong>{snapshot.partition.metrics.areaConserved && snapshot.partition.metrics.perimeterIdentitySatisfied ? "通过" : "异常"}</strong><small>面积与周长恒等式</small></article>
            </div>
          </div>

          <div className="cake-charts" aria-label="面积与周长图表">
            <MetricChart label="各块面积" values={areaValues} target={snapshot.partition.metrics.targetArea} />
            <MetricChart label="各块总周长" values={perimeterValues} />
          </div>
        </section>

        <aside className="cake-lab-panel cake-lab-analysis">
          <section className="cake-detail-section">
            <header><div><span>RAW RECORDS</span><h2>分块明细</h2></div><small>{pieces.length} 条确定性记录</small></header>
            <div className="cake-table-wrap">
              <table aria-label="当前方案分块明细">
                <thead><tr><th>块</th><th>面积</th><th>外沿</th><th>切口</th><th>总周长</th></tr></thead>
                <tbody>{pieces.map((piece, index) => <tr key={piece.id}><th>{index + 1}</th><td>{piece.area.toFixed(2)}</td><td>{piece.originalOuterBoundary.toFixed(2)}</td><td>{piece.newCutBoundary.toFixed(2)}</td><td>{piece.totalPerimeter.toFixed(2)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="cake-saved-section">
            <header><div><span>PLAN MATRIX</span><h2>已保存方案</h2></div><small>{savedPlans.length}/2 至少</small></header>
            {savedPlans.length === 0 ? <p className="cake-empty-plans">尚未保存方案。调整参数后保存至少两种不同切法。</p> : (
              <table aria-label="已保存方案比较">
                <thead><tr><th>方案</th><th>面积偏差</th><th>外沿极差</th><th>周长极差</th><th>切线</th></tr></thead>
                <tbody>{savedPlans.map((plan) => <tr key={plan.id} className={bestPlan?.id === plan.id ? "is-best" : undefined}><th>{plan.name}</th><td>{(plan.snapshot.partition.metrics.maxRelativeAreaDeviation * 100).toFixed(1)}%</td><td>{plan.snapshot.partition.metrics.outerBoundaryRange.toFixed(1)}</td><td>{plan.snapshot.partition.metrics.perimeterRange.toFixed(1)}</td><td>{plan.snapshot.partition.internalCutLength.toFixed(1)}</td></tr>)}</tbody>
              </table>
            )}
            {comparisonActive && bestPlan && (
              <div className="cake-best-plan" role="status">
                <p><strong>{criterionDefinition.short}较小：</strong>{bestPlan.name}。结论仅适用于当前所选指标。</p>
                {theoryViewedAt === null ? (
                  <button type="button" onClick={() => setTheoryViewedAt(new Date().toISOString())}>
                    揭示并核对几何规律
                  </button>
                ) : (
                  <small>等面积只说明份量指标相同；原外沿、整块周长与内部切线仍须分别计算。</small>
                )}
              </div>
            )}
          </section>
        </aside>

        <footer className="cake-lab-footer">
          <div className="cake-lab-notice" role="status"><i className={progress.status === "completed" ? "is-complete" : undefined} /><span>{notice}</span></div>
          <div className="cake-lab-actions">
            <button type="button" onClick={saveCurrentPlan} disabled={!predictionLocked}>保存当前方案</button>
            <button type="button" onClick={comparePlans} disabled={savedPlans.length < 2}>比较已存方案</button>
            <button type="button" onClick={() => downloadCakeJson(exportPayload())}>导出 JSON</button>
            <button type="button" onClick={() => downloadCakeCsv(exportPayload())}>导出 CSV</button>
          </div>
        </footer>
      </section>
    </TopicShell>
  )
}
