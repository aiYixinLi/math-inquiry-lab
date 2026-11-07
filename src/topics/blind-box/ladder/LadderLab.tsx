// 建模阶梯的实验台：当前参数（程序回读）、可调的参数、固定种子的模拟实验和直方图。
// 理论值在学生走到“看理论”之前不显示，免得影响猜想。

import {
  formatNumber,
  formatPercent,
  type ExperimentResult,
  type ReadBackLine,
  type UnknownKindsSummary,
} from "../../../core/blindbox"
import { DiceIcon, PlayIcon, SpinnerIcon } from "./ladder-icons"
import { formatAnswer, sameControls } from "./lab-format"
import { goalWord, type LadderControls, type LadderLevel, type LevelAnswer } from "./levels"

export interface LabExperiment {
  readonly result: ExperimentResult
  /** 做这次实验时的参数，用来判断参数后来有没有改过。 */
  readonly controls: LadderControls
}

const RUN_OPTIONS = [100, 1_000, 10_000] as const

interface LadderLabProps {
  readonly level: LadderLevel
  readonly controls: LadderControls
  readonly editable: boolean
  /** L0–L5 共用的款数现在能不能改：只有锁定猜想之前能改。 */
  readonly kindsEditable: boolean
  /** 参数区下面的一句提示：现在能不能改、为什么。 */
  readonly note: string
  /** “恢复”按钮要回到的参数，以及按钮上的字。 */
  readonly baseline: LadderControls
  readonly baselineLabel: string
  readonly onChange: <K extends keyof LadderControls>(key: K, value: LadderControls[K]) => void
  readonly onReset: () => void
  readonly setting: readonly ReadBackLine[]
  readonly experimentAllowed: boolean
  readonly running: boolean
  readonly runs: number
  readonly onRunsChange: (runs: number) => void
  readonly onRun: () => void
  readonly onReseed: () => void
  readonly experiment: LabExperiment | null
  readonly guess: number | null
  /** 猜想是按几款做的（L0–L5）；没有猜想或者 L6 为 null。 */
  readonly guessKinds: number | null
  readonly answer: LevelAnswer | null
  readonly theoryVisible: boolean
  readonly withinDraws: number | null
}

export function LadderLab(props: LadderLabProps) {
  const { level, controls, editable, kindsEditable, experiment, answer, theoryVisible, guess, guessKinds } = props
  const stale = experiment !== null && !sameControls(experiment.controls, controls)
  const changed = !sameControls(controls, props.baseline)
  // 猜想和理论值是“盒”或“款”时画在直方图上；概率（L2）画不上去。
  const onAxis = level.guess.unit !== "%"

  return (
    <>
      <section className="ladder-lab__block is-setting" aria-label="当前参数">
        <h3>当前模型<small>程序按参数复述</small></h3>
        <dl className="ladder-setting">
          {props.setting.map((line) => (
            <div key={line.topic}><dt>{line.topic}</dt><dd>{line.text}</dd></div>
          ))}
        </dl>
      </section>

      <section className="ladder-lab__block is-controls" aria-label="设置参数">
        <h3>
          设置参数
          {changed && (
            <button type="button" className="ladder-link" onClick={props.onReset}>{props.baselineLabel}</button>
          )}
        </h3>
        <p className="ladder-muted">{props.note}</p>
        {level.controls.map((spec) => {
          if (spec.kind === "range") {
            const value = controls[spec.key]
            // L0–L5 的“款数”每一级共用，什么时候能改和别的参数不一样；L6 的款数是例子世界的，按普通参数处理。
            const shared = spec.key === "kinds" && level.id !== "L6"
            const disabled = shared ? !kindsEditable : !editable
            return (
              <label key={spec.key} className="ladder-control">
                <span>{spec.label}<b>{spec.secret === true && !editable ? "?" : value} {spec.unit}</b></span>
                <input
                  type="range"
                  min={spec.min}
                  max={spec.max}
                  value={value}
                  disabled={disabled}
                  aria-label={spec.label}
                  onChange={(event) => props.onChange(spec.key, Number(event.target.value))}
                />
                {shared && <small className="ladder-muted">{kindsEditable ? "这个款数 L0–L5 每一级都沿用。" : "已经锁定猜想，这一级的款数不再改了。"}</small>}
              </label>
            )
          }
          if (spec.kind === "fraction") {
            return (
              <div key={spec.key} className="ladder-control" role="group" aria-label={spec.label}>
                <span>{spec.label}</span>
                <div className="ladder-chips">
                  {spec.options.map((denominator) => (
                    <button
                      key={denominator}
                      type="button"
                      disabled={!editable}
                      aria-pressed={controls.hiddenDenominator === denominator}
                      onClick={() => props.onChange("hiddenDenominator", denominator)}
                    >{denominator === 0 ? "不加" : `1/${denominator}`}</button>
                  ))}
                </div>
              </div>
            )
          }
          return (
            <div key={spec.key} className="ladder-control" role="group" aria-label={spec.label}>
              <span>{spec.label}</span>
              <div className="ladder-chips">
                {spec.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!editable}
                    aria-pressed={controls.target === option.value}
                    onClick={() => props.onChange("target", option.value)}
                  >{option.label}</button>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <section className="ladder-lab__block is-run" aria-label="模拟实验">
        <h3>做实验<small>固定种子，可以重复</small></h3>
        {!props.experimentAllowed ? (
          <p className="ladder-muted">先锁定猜想、找出假设，再做实验。</p>
        ) : (
          <div className="ladder-run">
            <div className="ladder-segmented" role="group" aria-label="模拟轮数">
              {RUN_OPTIONS.map((option) => (
                <button key={option} type="button" aria-pressed={props.runs === option} onClick={() => props.onRunsChange(option)}>
                  {option.toLocaleString("zh-CN")} 轮
                </button>
              ))}
            </div>
            <button type="button" className="ladder-go" disabled={props.running} onClick={props.onRun}>
              {props.running ? <SpinnerIcon /> : <PlayIcon />}
              {props.running ? "正在模拟……" : "开始实验"}
            </button>
            <button type="button" className="ladder-ghost" disabled={props.running || experiment === null} onClick={props.onReseed}>
              <DiceIcon />换个种子再做一次
            </button>
          </div>
        )}

        {experiment !== null && (
          <>
            {stale && <p className="ladder-warning">参数改过了，这是改之前的实验结果。点“开始实验”重新做。</p>}
            <Histogram
              result={experiment.result}
              guess={onAxis ? guess : null}
              theory={onAxis && theoryVisible && answer !== null && !stale ? answer.value : null}
              withinDraws={props.withinDraws}
              caption={
                experiment.result.unknownKinds === null
                  ? `每一轮买了几盒才${goalWord(level.id, experiment.controls)}：柱子越高，这样的轮越多。`
                  : `每一轮买 ${experiment.result.unknownKinds.draws} 盒后，Chao1 估计一共几款：柱子越高，这样的轮越多。`
              }
            />
            {experiment.result.unknownKinds === null ? (
              <dl className="ladder-stats">
                <div><dt>平均</dt><dd>{formatNumber(experiment.result.mean)} 盒<small>95% 置信区间 {formatNumber(experiment.result.ci95[0])}–{formatNumber(experiment.result.ci95[1])}</small></dd></div>
                <div><dt>一半的人</dt><dd>{experiment.result.p50} 盒内</dd></div>
                <div><dt>90% 的人</dt><dd>{experiment.result.p90} 盒内</dd></div>
                <div><dt>最少 / 最多</dt><dd>{experiment.result.min} / {experiment.result.max} 盒</dd></div>
                {experiment.result.notReachedShare !== null && (
                  <div className="is-highlight">
                    <dt>买 {experiment.controls.withinDraws} 盒还没达成</dt>
                    <dd>{formatPercent(experiment.result.notReachedShare)}<small>{experiment.result.runs.toLocaleString("zh-CN")} 轮里</small></dd>
                  </div>
                )}
              </dl>
            ) : (
              <UnknownKindsStats result={experiment.result} summary={experiment.result.unknownKinds} />
            )}
            <p className="ladder-muted">{experiment.result.runs.toLocaleString("zh-CN")} 轮，随机种子 {experiment.result.seed}。</p>
          </>
        )}
      </section>

      {theoryVisible && answer !== null && (
        <section className="ladder-lab__block ladder-theory-box" aria-label="理论值">
          <h3>理论值<small>当前参数，程序精确计算</small></h3>
          <p><span>{answer.label}</span><strong>{formatAnswer(answer.value, answer.unit)}</strong></p>
          {guess !== null && (
            <p className="ladder-muted">
              你的猜想：{formatAnswer(guess, level.guess.unit)}
              {guessKinds !== null && guessKinds !== controls.kinds ? `（按 ${guessKinds} 款猜的，现在实验台上是 ${controls.kinds} 款）` : "（对应设置参数里定下的）"}
            </p>
          )}
        </section>
      )}
    </>
  )
}

function UnknownKindsStats({ result, summary }: { readonly result: ExperimentResult; readonly summary: UnknownKindsSummary }) {
  return (
    <dl className="ladder-stats">
      <div><dt>真实款数</dt><dd>{summary.trueKinds} 款<small>例子世界，程序知道</small></dd></div>
      <div><dt>平均见到</dt><dd>{formatNumber(summary.observedMean)} 款<small>95% 置信区间 {formatNumber(summary.observedCi95[0])}–{formatNumber(summary.observedCi95[1])}</small></dd></div>
      <div className="is-highlight"><dt>Chao1 平均估计</dt><dd>{formatNumber(result.mean)} 款<small>95% 置信区间 {formatNumber(result.ci95[0])}–{formatNumber(result.ci95[1])}</small></dd></div>
      <div><dt>Chao1 估少了</dt><dd>{formatPercent(summary.underestimateShare)}<small>估计比真实款数少的轮</small></dd></div>
      <div><dt>Chao1 最少 / 最多</dt><dd>{formatNumber(result.min)} / {formatNumber(result.max)} 款</dd></div>
    </dl>
  )
}

interface HistogramProps {
  readonly result: ExperimentResult
  readonly guess: number | null
  readonly theory: number | null
  readonly withinDraws: number | null
  readonly caption: string
}

const WIDTH = 360
const HEIGHT = 170
// 上边留出三行，给猜想、理论值和“买几盒”的标注。
const PAD = { left: 8, right: 8, top: 36, bottom: 22 }

function Histogram({ result, guess, theory, withinDraws, caption }: HistogramProps) {
  const unit = result.unknownKinds === null ? "盒" : "款"
  const truth = result.unknownKinds?.trueKinds ?? null
  const { bins } = result
  const first = bins[0]?.from ?? result.min
  const last = (bins.at(-1)?.to ?? result.max) + 1
  const peak = Math.max(1, ...bins.map((bin) => bin.count))
  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const x = (value: number) => PAD.left + ((Math.min(Math.max(value, first), last) - first) / (last - first)) * plotWidth
  const markers = [
    guess !== null ? { key: "guess", value: guess, label: `猜想 ${formatNumber(guess)}` } : null,
    theory !== null ? { key: "theory", value: theory, label: `理论 ${formatNumber(theory)}` } : null,
    withinDraws !== null ? { key: "within", value: withinDraws + 1, label: `${withinDraws} 盒` } : null,
    truth !== null ? { key: "truth", value: truth, label: `真实 ${truth} 款` } : null,
  ].filter((marker): marker is { key: string; value: number; label: string } => marker !== null)

  return (
    <figure className="ladder-histogram">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          result.unknownKinds === null
            ? `每轮盒数的分布：${result.runs} 轮，最少 ${result.min} 盒，最多 ${result.max} 盒`
            : `每轮 Chao1 估计的分布：${result.runs} 轮，最少 ${formatNumber(result.min)} 款，最多 ${formatNumber(result.max)} 款`
        }
      >
        <defs>
          <linearGradient id="ladder-bar-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="ladder-histogram__stop is-top" />
            <stop offset="1" className="ladder-histogram__stop is-bottom" />
          </linearGradient>
          <linearGradient id="ladder-bar-warn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="ladder-histogram__stop is-warn-top" />
            <stop offset="1" className="ladder-histogram__stop is-warn-bottom" />
          </linearGradient>
        </defs>
        {bins.map((bin, index) => {
          const height = (bin.count / peak) * plotHeight
          const left = x(bin.from)
          const right = x(bin.to + 1)
          const notReached = withinDraws !== null && bin.from > withinDraws
          return (
            <rect
              key={bin.from}
              className={notReached ? "is-not-reached" : undefined}
              style={{ animationDelay: `${Math.min(index * 14, 420)}ms` }}
              x={left + 0.5}
              y={PAD.top + plotHeight - height}
              width={Math.max(1, right - left - 1)}
              height={height}
              rx={Math.min(2.5, Math.max(0.5, (right - left - 1) / 3))}
            />
          )
        })}
        <line className="ladder-histogram__axis" x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + plotHeight} y2={PAD.top + plotHeight} />
        {markers.map((marker, index) => (
          <g key={marker.key} className={`ladder-histogram__marker is-${marker.key}`}>
            <line x1={x(marker.value)} x2={x(marker.value)} y1={12 + index * 11} y2={PAD.top + plotHeight} />
            <text
              x={x(marker.value)}
              y={9 + index * 11}
              textAnchor={x(marker.value) > WIDTH * 0.7 ? "end" : "start"}
              dx={x(marker.value) > WIDTH * 0.7 ? -3 : 3}
            >
              {marker.label}
            </text>
          </g>
        ))}
        <text className="ladder-histogram__tick" x={PAD.left} y={HEIGHT - 6}>{first}</text>
        <text className="ladder-histogram__tick" x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end">
          {last - 1}{result.overflow > 0 ? "+" : ""} {unit}
        </text>
      </svg>
      <figcaption>
        {caption}
        {result.overflow > 0 && `另有 ${result.overflow} 轮超过 ${last - 1} ${unit}，没有画出。`}
      </figcaption>
    </figure>
  )
}
