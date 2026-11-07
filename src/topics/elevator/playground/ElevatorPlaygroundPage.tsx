import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { TopicShell } from "../../../app/layouts"
import { useModuleProgress } from "../../../shared/progress"
import {
  enumerateCandidateStatistics,
  findOptimalFloors,
  generateWeightedCallSample,
  weightedMedianCandidateFloors,
  type CandidateFloorStatistics,
  type ElevatorModelInput,
  type ElevatorOptimizationObjective,
  type FloorFrequency,
} from "./model"
import {
  buildElevatorCsv,
  buildElevatorExportPayload,
  downloadElevatorText,
  type ElevatorExportSnapshot,
  type ElevatorSourceType,
} from "./export"
import "../topic.css"

type PresetId = "morning" | "evening" | "all-day" | "custom"

interface FrequencyPreset {
  readonly id: Exclude<PresetId, "custom">
  readonly label: string
  readonly description: string
  readonly frequencies: readonly number[]
}

export const ELEVATOR_FREQUENCY_PRESETS: readonly FrequencyPreset[] = [
  {
    id: "morning",
    label: "早高峰",
    description: "合成示例：中高楼层出行呼叫较集中。",
    frequencies: [1, 2, 4, 6, 9, 13, 16, 14, 11, 8, 5, 3],
  },
  {
    id: "evening",
    label: "晚高峰",
    description: "合成示例：入口层呼叫较集中，其他楼层保留少量呼叫。",
    frequencies: [18, 10, 7, 6, 5, 4, 4, 3, 3, 2, 2, 1],
  },
  {
    id: "all-day",
    label: "全天",
    description: "合成示例：合并两个时段后比较整体频数分布。",
    frequencies: [19, 12, 11, 12, 14, 17, 20, 17, 14, 10, 7, 4],
  },
]

function presetById(id: Exclude<PresetId, "custom">): FrequencyPreset {
  const preset = ELEVATOR_FREQUENCY_PRESETS.find((item) => item.id === id)
  if (!preset) throw new Error(`Unknown elevator preset: ${id}`)
  return preset
}

function frequenciesFromValues(values: readonly number[]): FloorFrequency[] {
  return values.map((frequency, index) => ({ floor: index + 1, frequency }))
}

function frequenciesFromCalls(floorCount: number, calls: readonly number[]): FloorFrequency[] {
  const counts = Array.from({ length: floorCount }, () => 0)
  calls.forEach((floor) => {
    counts[floor - 1] += 1
  })
  return frequenciesFromValues(counts)
}

export function createSeededElevatorRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function objectiveValue(
  item: CandidateFloorStatistics,
  objective: ElevatorOptimizationObjective,
): number {
  if (objective === "total") return item.totalTime
  if (objective === "mean") return item.meanTime
  return item.maxTime
}

function objectiveLabel(objective: ElevatorOptimizationObjective): string {
  if (objective === "total") return "总估计响应时间"
  if (objective === "mean") return "平均估计响应时间"
  return "最大估计响应时间"
}

function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function FrequencyChart({ frequencies }: { readonly frequencies: readonly FloorFrequency[] }) {
  const maximum = Math.max(1, ...frequencies.map(({ frequency }) => frequency))

  return (
    <div className="elevator-frequency-chart" role="img" aria-label="楼层呼叫频数柱状图">
      {frequencies.map(({ floor, frequency }) => (
        <div key={floor}>
          <span>{floor}F</span>
          <i><b style={{ height: `${frequency / maximum * 100}%` }} /></i>
          <strong>{frequency}</strong>
        </div>
      ))}
    </div>
  )
}

function ObjectiveChart({
  statistics,
  objective,
  optimalFloors,
}: {
  readonly statistics: readonly CandidateFloorStatistics[]
  readonly objective: ElevatorOptimizationObjective
  readonly optimalFloors: readonly number[]
}) {
  const values = statistics.map((item) => objectiveValue(item, objective))
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum || 1
  const x = (index: number) => 32 + index * (496 / Math.max(1, statistics.length - 1))
  const y = (value: number) => 142 - (value - minimum) / span * 108

  return (
    <svg
      className="elevator-objective-chart"
      viewBox="0 0 560 174"
      role="img"
      aria-label={`${objectiveLabel(objective)}目标函数图`}
    >
      <line x1="32" x2="528" y1="142" y2="142" />
      <polyline points={values.map((value, index) => `${x(index)},${y(value)}`).join(" ")} />
      {statistics.map((item, index) => (
        <g key={item.candidateFloor} className={optimalFloors.includes(item.candidateFloor) ? "is-optimal" : undefined}>
          <circle cx={x(index)} cy={y(values[index])} r={optimalFloors.includes(item.candidateFloor) ? 5 : 3}>
            <title>{`${item.candidateFloor} 层：${formatMetric(values[index])} 秒`}</title>
          </circle>
          <text x={x(index)} y="162">{item.candidateFloor}</text>
        </g>
      ))}
    </svg>
  )
}

export default function ElevatorPlaygroundPage() {
  const initialPreset = presetById("morning")
  const { markStarted, markCompleted } = useModuleProgress("elevator", "playground")
  const [presetId, setPresetId] = useState<PresetId>(initialPreset.id)
  const [frequencyValues, setFrequencyValues] = useState<number[]>([
    ...initialPreset.frequencies,
  ])
  const [sourceType, setSourceType] = useState<ElevatorSourceType>(
    "deterministic_calculation",
  )
  const [secondsPerFloor, setSecondsPerFloor] = useState(2)
  const [fixedTime, setFixedTime] = useState(4)
  const [seed, setSeed] = useState(20_260_815)
  const [sampleSize, setSampleSize] = useState(80)
  const [sampleCalls, setSampleCalls] = useState<number[]>([])
  const [objective, setObjective] = useState<ElevatorOptimizationObjective>("total")
  const [predictedFloor, setPredictedFloor] = useState(6)
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [predictedObjective, setPredictedObjective] = useState<ElevatorOptimizationObjective>("total")
  const [hypothesisSubmittedAt, setHypothesisSubmittedAt] = useState("")
  const [comparedAt, setComparedAt] = useState("")
  const [theoryViewedAt, setTheoryViewedAt] = useState<string | null>(null)
  const sessionIdRef = useRef(
    globalThis.crypto?.randomUUID?.() ?? `elevator-${Date.now()}`,
  )
  const startedAtRef = useRef(new Date().toISOString())

  useEffect(() => markStarted(), [markStarted])

  const baseFrequencies = useMemo(
    () => frequenciesFromValues(frequencyValues),
    [frequencyValues],
  )
  const activeFrequencies = useMemo(
    () => sourceType === "synthetic_simulation" && sampleCalls.length > 0
      ? frequenciesFromCalls(frequencyValues.length, sampleCalls)
      : baseFrequencies,
    [baseFrequencies, frequencyValues.length, sampleCalls, sourceType],
  )
  const modelInput = useMemo<ElevatorModelInput>(
    () => ({
      floorCount: frequencyValues.length,
      frequencies: activeFrequencies,
      secondsPerFloor,
      fixedTime,
    }),
    [activeFrequencies, fixedTime, frequencyValues.length, secondsPerFloor],
  )
  const hasBaseCalls = frequencyValues.some((frequency) => frequency > 0)
  const dataReady = hasBaseCalls && (
    sourceType === "deterministic_calculation" || sampleCalls.length > 0
  )
  const statistics = useMemo(
    () => dataReady ? enumerateCandidateStatistics(modelInput) : [],
    [dataReady, modelInput],
  )
  const optimalFloors = useMemo(
    () => dataReady ? findOptimalFloors(modelInput, objective) : [],
    [dataReady, modelInput, objective],
  )
  const weightedMedians = useMemo(
    () => dataReady ? weightedMedianCandidateFloors(modelInput) : [],
    [dataReady, modelInput],
  )
  const comparisonComplete = comparedAt !== ""

  const resetInquiry = () => {
    setPredictionLocked(false)
    setHypothesisSubmittedAt("")
    setComparedAt("")
    setTheoryViewedAt(null)
  }

  const choosePreset = (id: Exclude<PresetId, "custom">) => {
    const preset = presetById(id)
    setPresetId(id)
    setFrequencyValues([...preset.frequencies])
    setSampleCalls([])
    resetInquiry()
  }

  const updateFrequency = (floor: number, frequency: number) => {
    setPresetId("custom")
    setFrequencyValues((current) => current.map((value, index) =>
      index === floor - 1 ? frequency : value,
    ))
    setSampleCalls([])
    resetInquiry()
  }

  const changeSourceType = (next: ElevatorSourceType) => {
    setSourceType(next)
    setSampleCalls([])
    resetInquiry()
  }

  const generateSample = () => {
    const calls = generateWeightedCallSample(
      { floorCount: frequencyValues.length, frequencies: baseFrequencies },
      sampleSize,
      createSeededElevatorRng(seed),
    )
    setSampleCalls(calls)
    resetInquiry()
  }

  const updateSecondsPerFloor = (value: number) => {
    setSecondsPerFloor(Math.max(0.1, value || 0.1))
    resetInquiry()
  }

  const updateFixedTime = (value: number) => {
    setFixedTime(Math.max(0, value || 0))
    resetInquiry()
  }

  const lockPrediction = () => {
    setPredictionLocked(true)
    setPredictedObjective(objective)
    setHypothesisSubmittedAt(new Date().toISOString())
  }

  const compareAllFloors = () => {
    const timestamp = new Date().toISOString()
    setComparedAt(timestamp)
    markCompleted()
  }

  const snapshot = (): ElevatorExportSnapshot => ({
    sessionId: sessionIdRef.current,
    sourceType,
    presetId,
    seed: sourceType === "synthetic_simulation" ? seed : null,
    startedAt: startedAtRef.current,
    endedAt: comparedAt,
    hypothesisSubmittedAt,
    theoryViewedAt,
    predictedFloor,
    predictedObjective,
    objective,
    modelInput,
    rawCalls: sampleCalls,
    statistics,
    optimalFloors,
  })

  const exportJson = () => {
    const payload = buildElevatorExportPayload(snapshot())
    downloadElevatorText(
      `电梯停层实验_${sessionIdRef.current}.json`,
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8",
    )
  }

  const exportCsv = () => {
    const payload = buildElevatorExportPayload(snapshot())
    downloadElevatorText(
      `电梯停层实验_${sessionIdRef.current}.csv`,
      `\uFEFF${buildElevatorCsv(payload)}`,
      "text/csv;charset=utf-8",
    )
  }

  const currentPresetDescription = presetId === "custom"
    ? "自定义匿名楼层频数。"
    : presetById(presetId).description

  return (
    <TopicShell topicId="elevator" module="playground">
      <section className="elevator-page elevator-playground">
        <h1 className="sr-only">电梯停在哪一层最合理？模拟实验 Playground</h1>
        <header className="elevator-lab-intro">
          <div>
            <span>实验目标</span>
            <strong>比较全部候选停靠层，检验预测并解释评价指标的影响</strong>
          </div>
          <p><b>操作说明：</b>选择或录入数据 → 选择指标并锁定预测 → 使用同一组记录比较全部楼层 → 查看图表与导出。</p>
          <div className={`elevator-source-badge is-${sourceType}`}>
            <span>数据来源</span>
            <strong>{sourceType === "deterministic_calculation" ? "数据表计算" : "随机模拟 · 合成样本"}</strong>
          </div>
        </header>

        <div className="elevator-workbench">
          <aside className="elevator-panel elevator-setup-panel">
            <header><span>CONTROL</span><div><strong>实验数据</strong><small>匿名频数或合成样本</small></div></header>
            <div className="elevator-preset-tabs" aria-label="频数数据集">
              {ELEVATOR_FREQUENCY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={presetId === preset.id ? "is-active" : undefined}
                  disabled={predictionLocked}
                  onClick={() => choosePreset(preset.id)}
                >{preset.label}</button>
              ))}
              <button
                type="button"
                className={presetId === "custom" ? "is-active" : undefined}
                disabled={predictionLocked}
                onClick={() => {
                  setPresetId("custom")
                  setSampleCalls([])
                  resetInquiry()
                }}
              >自定义</button>
            </div>
            <p className="elevator-preset-note">{currentPresetDescription}</p>

            <div className="elevator-frequency-inputs" aria-label="各层呼叫频数">
              {frequencyValues.map((frequency, index) => (
                <label key={index + 1}>
                  <span>{index + 1}F</span>
                  <input
                    aria-label={`${index + 1} 层呼叫频数`}
                    type="number"
                    min="0"
                    max="999"
                    value={frequency}
                    disabled={predictionLocked}
                    onChange={(event) => updateFrequency(
                      index + 1,
                      Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                    )}
                  />
                </label>
              ))}
            </div>

            <div className="elevator-source-switch" aria-label="计算来源类型">
              <button
                type="button"
                className={sourceType === "deterministic_calculation" ? "is-active" : undefined}
                disabled={predictionLocked}
                onClick={() => changeSourceType("deterministic_calculation")}
              >数据表计算</button>
              <button
                type="button"
                className={sourceType === "synthetic_simulation" ? "is-active" : undefined}
                disabled={predictionLocked}
                onClick={() => changeSourceType("synthetic_simulation")}
              >随机模拟</button>
            </div>

            <div className="elevator-model-parameters" aria-label="响应时间参数">
              <label>
                <span>每层时间 τ</span>
                <input
                  aria-label="每层运行时间"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={secondsPerFloor}
                  disabled={predictionLocked}
                  onChange={(event) => updateSecondsPerFloor(Number(event.target.value))}
                />
              </label>
              <label>
                <span>固定时间 t₀</span>
                <input
                  aria-label="固定响应时间"
                  type="number"
                  min="0"
                  step="0.1"
                  value={fixedTime}
                  disabled={predictionLocked}
                  onChange={(event) => updateFixedTime(Number(event.target.value))}
                />
              </label>
            </div>

            {sourceType === "synthetic_simulation" && (
              <div className="elevator-sampling-controls">
                <label><span>种子</span><input aria-label="随机种子" type="number" value={seed} disabled={predictionLocked} onChange={(event) => setSeed(Math.trunc(Number(event.target.value) || 1))} /></label>
                <label><span>样本量</span><input aria-label="随机样本量" type="number" min="1" max="500" value={sampleSize} disabled={predictionLocked} onChange={(event) => setSampleSize(Math.max(1, Math.min(500, Math.trunc(Number(event.target.value) || 1))))} /></label>
                <button type="button" disabled={predictionLocked || !hasBaseCalls} onClick={generateSample}>生成固定样本</button>
                <small>{sampleCalls.length > 0 ? `已固定 ${sampleCalls.length} 条呼叫；全部方案复用该样本。` : "生成样本后才能锁定预测。"}</small>
              </div>
            )}
          </aside>

          <section className="elevator-panel elevator-chart-panel">
            <header><span>LIVE DATA</span><div><strong>数据与目标函数</strong><small>同一数据集 · 全部候选层</small></div></header>
            <div className="elevator-chart-grid">
              <section>
                <div><strong>楼层呼叫频数</strong><span>Σfᵢ={activeFrequencies.reduce((sum, item) => sum + item.frequency, 0)}</span></div>
                <FrequencyChart frequencies={activeFrequencies} />
              </section>
              <section>
                <div><strong>{objectiveLabel(objective)}</strong><span>{comparisonComplete ? "已完成枚举" : "锁定预测后显示"}</span></div>
                {comparisonComplete ? (
                  <ObjectiveChart
                    statistics={statistics}
                    objective={objective}
                    optimalFloors={optimalFloors}
                  />
                ) : (
                  <div className="elevator-chart-placeholder">
                    <span aria-hidden="true">∑</span>
                    <p>比较前不显示最低点，避免预测受到答案提示。</p>
                  </div>
                )}
              </section>
            </div>
          </section>

          <aside className="elevator-panel elevator-inquiry-panel">
            <header><span>INQUIRY</span><div><strong>猜想与比较</strong><small>先预测，后检验</small></div></header>
            <div className="elevator-objective-tabs" aria-label="优化指标">
              {(["total", "mean", "max"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={objective === item ? "is-active" : undefined}
                  disabled={predictionLocked && !comparisonComplete}
                  onClick={() => setObjective(item)}
                >{item === "total" ? "总量" : item === "mean" ? "平均" : "最大值"}</button>
              ))}
            </div>

            <div className="elevator-hypothesis">
              <label>
                <span>预测最佳空闲停靠层</span>
                <input
                  aria-label="预测最佳空闲停靠层"
                  type="range"
                  min="1"
                  max={frequencyValues.length}
                  value={predictedFloor}
                  disabled={predictionLocked}
                  onChange={(event) => setPredictedFloor(Number(event.target.value))}
                />
                <strong>{predictedFloor} 层</strong>
              </label>
              {!predictionLocked ? (
                <button type="button" disabled={!dataReady} onClick={lockPrediction}>锁定预测</button>
              ) : (
                <div className="elevator-locked-hypothesis">
                  <span>已锁定</span>
                  <strong>{predictedFloor} 层 · {objectiveLabel(predictedObjective)}</strong>
                </div>
              )}
              <button
                className="is-primary"
                type="button"
                disabled={!predictionLocked || comparisonComplete}
                onClick={compareAllFloors}
              >比较全部候选层</button>
              {predictionLocked && (
                <button className="is-subtle" type="button" onClick={resetInquiry}>
                  {comparisonComplete ? "开始新一轮比较" : "修改数据或预测"}
                </button>
              )}
            </div>

            {comparisonComplete && (
              <div className="elevator-result" role="status">
                <span>{objectiveLabel(objective)}最优</span>
                <strong>{optimalFloors.join("、")} 层</strong>
                <p>{optimalFloors.includes(predictedFloor) ? "本次预测属于最优集合。" : `本次预测为 ${predictedFloor} 层，可依据曲线修正。`}</p>
                {theoryViewedAt === null ? (
                  <button
                    className="elevator-theory-toggle"
                    type="button"
                    onClick={() => setTheoryViewedAt(new Date().toISOString())}
                  >揭示并核对数学规律</button>
                ) : (
                  <small className="elevator-theory-copy">
                    总量与平均量最小时，加权中位数候选为 {weightedMedians.join("、")} 层；最大值指标需要另行比较最坏情形。
                  </small>
                )}
              </div>
            )}

            <section className="elevator-model-note">
              <strong>模型假设与边界</strong>
              <p>每次呼叫前电梯均空闲于 p 层；τ 与 t₀ 对全部方案相同。模型未包含多梯调度、同时呼叫、方向、容量、排队和故障。</p>
              <small>数据仅含楼层、时段和次数；本页结果称为“模型估计响应时间”。</small>
            </section>
          </aside>
        </div>

        <section className="elevator-panel elevator-records-panel">
          <header>
            <span>RESULT MATRIX</span>
            <div><strong>候选层比较记录</strong><small>楼层横向排列，指标纵向对照</small></div>
            <div className="elevator-export-actions">
              <button type="button" disabled={!comparisonComplete} onClick={exportCsv}>导出 CSV</button>
              <button type="button" disabled={!comparisonComplete} onClick={exportJson}>导出 JSON</button>
            </div>
          </header>
          {comparisonComplete ? (
            <div className="elevator-record-table-wrap">
              <table aria-label="候选层指标横向比较表">
                <thead>
                  <tr>
                    <th scope="col">指标 / 候选层 p</th>
                    {statistics.map((item) => (
                      <th
                        key={item.candidateFloor}
                        scope="col"
                        className={optimalFloors.includes(item.candidateFloor) ? "is-optimal" : undefined}
                      >{item.candidateFloor} 层</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">总距离 D(p)</th>
                    {statistics.map((item) => (
                      <td key={item.candidateFloor} className={optimalFloors.includes(item.candidateFloor) ? "is-optimal" : undefined}>
                        {item.totalDistance}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">总响应时间</th>
                    {statistics.map((item) => (
                      <td key={item.candidateFloor} className={optimalFloors.includes(item.candidateFloor) ? "is-optimal" : undefined}>
                        {formatMetric(item.totalTime)} 秒
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">平均响应时间</th>
                    {statistics.map((item) => (
                      <td key={item.candidateFloor} className={optimalFloors.includes(item.candidateFloor) ? "is-optimal" : undefined}>
                        {formatMetric(item.meanTime)} 秒
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">最大响应时间</th>
                    {statistics.map((item) => (
                      <td key={item.candidateFloor} className={optimalFloors.includes(item.candidateFloor) ? "is-optimal" : undefined}>
                        {formatMetric(item.maxTime)} 秒
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <th scope="row">当前指标</th>
                    {statistics.map((item) => (
                      <td key={item.candidateFloor} className={optimalFloors.includes(item.candidateFloor) ? "is-optimal" : undefined}>
                        {formatMetric(objectiveValue(item, objective))}{optimalFloors.includes(item.candidateFloor) ? " · 最优" : ""}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="elevator-records-empty">锁定预测并完成比较后，系统将在此保留全部候选层记录。</div>
          )}
        </section>
      </section>
    </TopicShell>
  )
}
