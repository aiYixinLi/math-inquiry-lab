import { useMemo, useState } from "react"
import { InlineMath, MathText } from "../../../shared/learning"
import { BLIND_BOX_INLINE_MATH } from "./content"

const STYLE_NAMES = ["A", "B", "C", "D", "E", "F"] as const

function ModelVisual() {
  const [face, setFace] = useState(1)
  return (
    <div className="blind-learn-visual blind-model-visual">
      <div className="blind-model-visual__result" aria-live="polite">
        <span className="blind-die" aria-label={`骰子点数 ${face}`}>{face}</span>
        <i aria-hidden="true">→</i>
        <span className="blind-style-token">{STYLE_NAMES[face - 1]}</span>
        <p><strong>当前基本结果</strong>点数 {face} 对应 {STYLE_NAMES[face - 1]} 款</p>
      </div>
      <div className="blind-face-picker" aria-label="选择骰子点数">
        {STYLE_NAMES.map((style, index) => (
          <button
            key={style}
            type="button"
            className={face === index + 1 ? "is-active" : undefined}
            aria-pressed={face === index + 1}
            onClick={() => setFace(index + 1)}
          >
            <span>{index + 1}</span><strong>{style}</strong>
            <small><InlineMath plain="1/6" latex={"\\frac{1}{6}"} /></small>
          </button>
        ))}
      </div>
      <div className="blind-equal-strip" aria-label="六款概率均为六分之一">
        {STYLE_NAMES.map((style) => <i key={style}><span>{style}</span></i>)}
      </div>
    </div>
  )
}

const SHORT_SEQUENCES = [
  ["A", "D", "A", "C", "F", "D", "B", "E"],
  ["B", "B", "E", "A", "E", "C", "F", "D"],
  ["F", "C", "D", "C", "A", "F", "E", "B"],
] as const

function SequenceVisual() {
  const [sequenceIndex, setSequenceIndex] = useState(0)
  const sequence = SHORT_SEQUENCES[sequenceIndex]
  const seen = new Set<string>()
  const annotated = sequence.map((style) => {
    const repeated = seen.has(style)
    seen.add(style)
    return { style, repeated }
  })
  const distinctCount = new Set(sequence).size

  return (
    <div className="blind-learn-visual blind-sequence-visual">
      <header>
        <div><span>购买次数</span><strong>{sequence.length}</strong></div>
        <div><span>不同款式</span><strong>{distinctCount}</strong></div>
        <div><span>重复款</span><strong>{sequence.length - distinctCount}</strong></div>
        <button
          type="button"
          onClick={() => setSequenceIndex((current) => (current + 1) % SHORT_SEQUENCES.length)}
        >切换短序列</button>
      </header>
      <ol className="blind-sequence" aria-label="抽取短序列">
        {annotated.map(({ style, repeated }, index) => (
          <li key={`${sequenceIndex}-${index}`} className={repeated ? "is-repeat" : "is-new"}>
            <span>{index + 1}</span><strong>{style}</strong>
            <small>{repeated ? "重复款" : "新款"}</small>
          </li>
        ))}
      </ol>
      <p className="blind-sequence-rule"><i /><MathText
        text="前次结果不改变下一次 A—F 各款的概率：仍均为 1/6。"
        inlineMath={BLIND_BOX_INLINE_MATH}
      /></p>
    </div>
  )
}

function StageProbabilityVisual() {
  const [collected, setCollected] = useState(3)
  const remaining = 6 - collected
  const probability = remaining / 6
  return (
    <div className="blind-learn-visual blind-stage-visual">
      <header>
        <label htmlFor="blind-collected-count"><MathText
          text="已有不同款式数 k"
          inlineMath={BLIND_BOX_INLINE_MATH}
        /></label>
        <output htmlFor="blind-collected-count">
          <InlineMath plain={"k = " + collected} latex={"k=" + collected} />
        </output>
      </header>
      <input
        id="blind-collected-count"
        aria-label="已有不同款式数 k"
        type="range"
        min="0"
        max="6"
        step="1"
        value={collected}
        onChange={(event) => setCollected(Number(event.target.value))}
      />
      <div className="blind-stage-scale" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((value) => <span key={value}>{value}</span>)}
      </div>
      <div className="blind-collection-row" aria-label={`已收集 ${collected} 款，尚缺 ${remaining} 款`}>
        {STYLE_NAMES.map((style, index) => (
          <span key={style} className={index < collected ? "is-collected" : "is-missing"}>
            {style}<small>{index < collected ? "已有" : "未有"}</small>
          </span>
        ))}
      </div>
      <div className="blind-probability-comparison">
        <section>
          <header><span>下一盒为新款</span><strong>
            <InlineMath
              plain={remaining + "/6"}
              latex={"\\frac{" + remaining + "}{6}"}
            />
          </strong></header>
          <div><i style={{ width: `${probability * 100}%` }} /></div>
          <small><InlineMath
            plain={(probability * 100).toFixed(1) + "%"}
            latex={(probability * 100).toFixed(1) + "\\%"}
          /></small>
        </section>
        <section>
          <header><span>下一盒为重复款</span><strong>
            <InlineMath
              plain={collected + "/6"}
              latex={"\\frac{" + collected + "}{6}"}
            />
          </strong></header>
          <div><i style={{ width: `${(1 - probability) * 100}%` }} /></div>
          <small><InlineMath
            plain={((1 - probability) * 100).toFixed(1) + "%"}
            latex={((1 - probability) * 100).toFixed(1) + "\\%"}
          /></small>
        </section>
      </div>
    </div>
  )
}

const WAITING_STAGES = [
  { from: "0→1", probability: "6/6", waiting: 1 },
  { from: "1→2", probability: "5/6", waiting: 1.2 },
  { from: "2→3", probability: "4/6", waiting: 1.5 },
  { from: "3→4", probability: "3/6", waiting: 2 },
  { from: "4→5", probability: "2/6", waiting: 3 },
  { from: "5→6", probability: "1/6", waiting: 6 },
] as const

function WaitingVisual() {
  const [revealed, setRevealed] = useState(1)
  const subtotal = WAITING_STAGES.slice(0, revealed).reduce(
    (sum, stage) => sum + stage.waiting,
    0,
  )
  return (
    <div className="blind-learn-visual blind-waiting-visual">
      <header>
        <div><span>已展开阶段</span><strong>
          <InlineMath plain={revealed + "/6"} latex={"\\frac{" + revealed + "}{6}"} />
        </strong></div>
        <div><span>当前合计</span><strong>
          <InlineMath plain={subtotal.toFixed(2)} latex={subtotal.toFixed(2)} />
        </strong><small>盒</small></div>
        <button
          type="button"
          onClick={() => setRevealed((current) => current === 6 ? 1 : current + 1)}
        >{revealed === 6 ? "重新展开" : "展开下一阶段"}</button>
      </header>
      <ol className="blind-waiting-stairs">
        {WAITING_STAGES.map((stage, index) => (
          <li
            key={stage.from}
            className={index < revealed ? "is-revealed" : undefined}
            style={{ height: `${31 + index * 9}%` }}
          >
            <span><InlineMath
              plain={stage.from}
              latex={stage.from.replace("→", "\\to")}
            /> 款</span>
            <strong><InlineMath
              plain={String(stage.waiting)}
              latex={String(stage.waiting)}
            /></strong>
            <small><InlineMath
              plain={"p=" + stage.probability}
              latex={"p=\\frac{" + stage.probability.replace("/", "}{") + "}"}
            /></small>
          </li>
        ))}
      </ol>
      <div className="blind-waiting-sum">
        <span>分阶段平均等待可相加</span>
        <strong>{revealed === 6
          ? <InlineMath
              plain="1 + 1.2 + 1.5 + 2 + 3 + 6 = 14.70"
              latex="1+1.2+1.5+2+3+6=14.70"
            />
          : "继续展开以显示完整总和"}</strong>
      </div>
    </div>
  )
}

function makeTeachingSample(size: number): number[] {
  let state = 20_260_815
  const next = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 2 ** 32
  }
  return Array.from({ length: size }, () => {
    const collected = new Set<number>()
    let purchases = 0
    while (collected.size < 6) {
      collected.add(Math.floor(next() * 6))
      purchases += 1
    }
    return purchases
  })
}

const TEACHING_SAMPLE = makeTeachingSample(100)
const HISTOGRAM_BINS = [
  { label: "6—9", min: 6, max: 9 },
  { label: "10—13", min: 10, max: 13 },
  { label: "14—17", min: 14, max: 17 },
  { label: "18—23", min: 18, max: 23 },
  { label: "24+", min: 24, max: Number.POSITIVE_INFINITY },
] as const

function DataTheoryVisual() {
  const [sampleSize, setSampleSize] = useState(30)
  const data = TEACHING_SAMPLE.slice(0, sampleSize)
  const cumulativeMeans = useMemo(() => {
    let total = 0
    return data.map((value, index) => {
      total += value
      return total / (index + 1)
    })
  }, [data])
  const mean = cumulativeMeans.at(-1) ?? 0
  const counts = HISTOGRAM_BINS.map((bin) =>
    data.filter((value) => value >= bin.min && value <= bin.max).length,
  )
  const maxCount = Math.max(...counts, 1)
  const points = cumulativeMeans.map((value, index) => {
    const x = cumulativeMeans.length === 1 ? 0 : index / (cumulativeMeans.length - 1) * 300
    const y = 96 - Math.max(0, Math.min(1, (value - 8) / 14)) * 78
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  const theoryY = 96 - (14.7 - 8) / 14 * 78

  return (
    <div className="blind-learn-visual blind-data-visual">
      <header>
        <div className="blind-sample-switch" aria-label="选择教学模拟样本量">
          {[10, 30, 100].map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={sampleSize === size}
              className={sampleSize === size ? "is-active" : undefined}
              onClick={() => setSampleSize(size)}
            >{size} 轮</button>
          ))}
        </div>
        <p><span>样本均值</span><strong>
          <InlineMath plain={mean.toFixed(2)} latex={mean.toFixed(2)} />
        </strong><small>理论平均 <InlineMath plain="14.70" latex="14.70" /></small></p>
      </header>
      <div className="blind-data-charts">
        <section aria-label={`完成次数直方图，共 ${sampleSize} 轮`}>
          <h3>集齐次数直方图 <small>频数</small></h3>
          <div className="blind-histogram">
            {HISTOGRAM_BINS.map((bin, index) => (
              <div key={bin.label}>
                <i style={{ height: `${counts[index] / maxCount * 100}%` }}><span>{counts[index]}</span></i>
                <small>{bin.label}</small>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3>累计均值 <small>盒/轮</small></h3>
          <svg viewBox="0 0 300 108" role="img" aria-label={`第 ${sampleSize} 轮累计均值为 ${mean.toFixed(2)}`}>
            <line x1="0" x2="300" y1={theoryY} y2={theoryY} className="is-theory" />
            <polyline points={points} />
            <text x="296" y={theoryY - 4} textAnchor="end">14.70 理论平均</text>
          </svg>
        </section>
      </div>
      <footer><i />数据来源：固定种子教学模拟；仅用于观察有限样本波动。</footer>
    </div>
  )
}

export function renderBlindBoxLearningVisual(_step: unknown, stepIndex: number) {
  switch (stepIndex) {
    case 0: return <ModelVisual />
    case 1: return <SequenceVisual />
    case 2: return <StageProbabilityVisual />
    case 3: return <WaitingVisual />
    case 4: return <DataTheoryVisual />
    default: return null
  }
}
