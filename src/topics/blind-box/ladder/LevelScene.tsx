// 每一级的情境示意图：把这一级的盲盒系列画出来，而不只是用文字描述。
// 一张柱状图：纵轴 0–100%，柱子高度就是每盒抽到这一款的概率，神兽和概率数值叠在柱顶上；
// 库存有限时换成摞起来的盒子，保底、合买、不知道一共几款各有各的画法。
// 随参数实时变化，所以“设置参数”一步也放在这里。

import { useMemo, type CSSProperties } from "react"
import { formatPercent, resolveModel, type BlindBoxParams, type ResolvedModel } from "../../../core/blindbox"
import { KindGlyph, buildKindVisuals, kindNameLabel, type KindVisual } from "./kind-visuals"
import { L6_SAMPLE, type LadderLevelId } from "./levels"

interface LevelSceneProps {
  readonly levelId: LadderLevelId
  readonly params: BlindBoxParams
  /** L6 在学生猜完之前不能透露例子世界有几款，这时画情境里的样本。 */
  readonly secret?: boolean
  /** L2 问的“买几盒”，画在一条尺子上。 */
  readonly withinDraws?: number | null
}

const PLAYER_NAMES = ["甲", "乙", "丙", "丁", "戊", "己"] as const

function safeModel(params: BlindBoxParams): ResolvedModel | null {
  try {
    return resolveModel(params)
  } catch {
    return null
  }
}

export function LevelScene({ levelId, params, secret = false, withinDraws = null }: LevelSceneProps) {
  const model = useMemo(() => safeModel(params), [params])
  const visuals = useMemo(() => buildKindVisuals(params.kinds.map((kind) => ({ id: kind.id, hidden: kind.hidden === true }))), [params])

  if (levelId === "L6" && secret) return <MysterySample />
  if (model === null) return null

  const finite = model.stock !== null
  const players = model.players
  const caption = [
    finite
      ? "店里每款只剩这么多盒：买走一盒，剩下的机会就变了。"
      : visuals.some((visual) => visual.hidden)
        ? "柱子越高，每盒越容易抽到；金色的星是隐藏款。"
        : "",
    model.need.some((count) => count === 0) ? "颜色变淡的款不在这次的目标里。" : "",
  ].join("")

  return (
    <figure className="ladder-scene" aria-label="情境示意图">
      {finite && (
        <div className="ladder-scene__row" role="presentation">
          {visuals.map((visual) => {
            const stock = model.stock?.[visual.index] ?? 0
            const needed = (model.need[visual.index] ?? 0) > 0
            const style = { "--accent": visual.color } as CSSProperties
            return (
              <div key={visual.id} className={`ladder-scene__kind${needed ? "" : " is-unneeded"}${visual.hidden ? " is-hidden-kind" : ""}`} style={style}>
                <span className="ladder-scene__stack" aria-hidden="true">
                  {Array.from({ length: Math.min(stock, 5) }, (_, index) => <i key={index} />)}
                  {stock > 5 && <em>+{stock - 5}</em>}
                </span>
                <KindGlyph visual={visual} size="medium" />
                <KindName visual={visual} />
                <small>{`${stock} 盒`}</small>
              </div>
            )
          })}
        </div>
      )}

      {!finite && (
        <div
          className="ladder-scene__chart"
          role="img"
          aria-label={`每盒抽到各款的概率：${visuals.map((visual) => `${visual.name} ${formatPercent(model.probabilities[visual.index] ?? 0)}`).join("，")}`}
        >
          <div className="ladder-scene__axis" aria-hidden="true">
            <span>100%</span>
            <span>0</span>
          </div>
          <div className="ladder-scene__plot" aria-hidden="true">
            {visuals.map((visual) => {
              const probability = model.probabilities[visual.index] ?? 0
              const needed = (model.need[visual.index] ?? 0) > 0
              const height = `${Math.min(100, probability * 100)}%`
              return (
                <div
                  key={visual.id}
                  className={`ladder-scene__col${needed ? "" : " is-unneeded"}${visual.hidden ? " is-hidden-kind" : ""}`}
                  style={{ "--accent": visual.color } as CSSProperties}
                >
                  <div className="ladder-scene__pin" style={{ bottom: height }}>
                    <KindGlyph visual={visual} size="medium" />
                    <KindName visual={visual} />
                    <b>{formatPercent(probability)}</b>
                  </div>
                  <i style={{ height }} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {model.pity !== null && (
        <div className="ladder-scene__pity">
          <span>没出隐藏款时，每买一盒，离保底近一步</span>
          <div aria-hidden="true"><i /><b>★</b></div>
          <small>最多连续 {model.pity.within - 1} 盒没出，第 {model.pity.within} 盒一定是隐藏款</small>
        </div>
      )}

      {levelId === "L2" && withinDraws !== null && (
        <div className="ladder-scene__ruler">
          <div aria-hidden="true">
            <i style={{ left: `${Math.min(100, (withinDraws / 300) * 100)}%` }} />
          </div>
          <small>在 0–300 盒的尺子上，先看看 {withinDraws} 盒的位置</small>
        </div>
      )}

      {players > 1 && (
        <div className="ladder-scene__team">
          {Array.from({ length: players }, (_, index) => (
            <span key={index}><b>{PLAYER_NAMES[index] ?? index + 1}</b>要 {visuals.length} 款</span>
          ))}
          <small>重复的盒子互相交换</small>
        </div>
      )}

      {caption !== "" && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

function KindName({ visual }: { readonly visual: KindVisual }) {
  const name = kindNameLabel(visual)
  return name === null ? null : <span className="ladder-scene__name">{name}</span>
}

/** L6 情境里的样本：买了 15 盒，见到 9 款，一共几款不知道。 */
function MysterySample() {
  const { draws, observed, singletons, doubletons } = L6_SAMPLE
  const heavy = observed - singletons - doubletons
  const repeats = [
    ...Array.from({ length: singletons }, () => 1),
    ...Array.from({ length: doubletons }, () => 2),
    ...Array.from({ length: heavy }, () => 3),
  ]
  const visuals = buildKindVisuals(repeats.map((_, index) => ({ id: String.fromCharCode(65 + index), hidden: false })))
  return (
    <figure className="ladder-scene is-mystery" aria-label="情境示意图">
      <div className="ladder-scene__row" role="presentation">
        {visuals.map((visual, index) => (
          <div key={visual.id} className="ladder-scene__kind" style={{ "--accent": visual.color } as CSSProperties}>
            <KindGlyph visual={visual} size="medium" />
            <KindName visual={visual} />
            <small>×{repeats[index]}</small>
          </div>
        ))}
        <div className="ladder-scene__kind is-unknown">
          <span aria-hidden="true">?</span>
          <small>没见过的呢</small>
        </div>
      </div>
      <figcaption>买了 {draws} 盒，见到的每一款旁边写着出现的次数；右边虚线框里，还有没有没见过的款？</figcaption>
    </figure>
  )
}
