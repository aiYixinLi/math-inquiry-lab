// “问题情境”面板顶上的货架：一排整整齐齐摆着同一个系列的盲盒，随机有一两盒已经拆开，
// 露出里面的神兽。拆哪几盒、拆出哪一款，在刚打开这一级时抽好，之后参数怎么改都不再变。

import { useMemo, useState, type CSSProperties } from "react"
import { resolveModel, type BlindBoxParams } from "../../../core/blindbox"
import blindBoxPackage from "../../../../assets/00.png"
import { KindGlyph, buildKindVisuals, kindNameLabel, type KindVisual } from "./kind-visuals"

/** 一整架摆一排 10 盒：再多每盒就太小了。 */
const FULL_SHELF = 10
/** L6 猜完之前不能透露一共有几款，这时只从固定的前 6 只神兽里拆。 */
const SECRET_BEASTS = 6

interface Draw {
  /** 0 到 FULL_SHELF−1 的随机排列，拆开的盒子取其中靠前的位置。 */
  readonly order: readonly number[]
  readonly count: 1 | 2
  readonly picks: readonly [number, number]
}

function drawOpening(): Draw {
  const order = Array.from({ length: FULL_SHELF }, (_, index) => index)
  for (let index = order.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[order[index], order[other]] = [order[other] ?? 0, order[index] ?? 0]
  }
  return { order, count: Math.random() < 0.5 ? 1 : 2, picks: [Math.random(), Math.random()] }
}

interface SituationShelfProps {
  readonly params: BlindBoxParams
  readonly secret?: boolean
}

export function SituationShelf({ params, secret = false }: SituationShelfProps) {
  const [draw] = useState(drawOpening)
  const stockTotal = useMemo(() => {
    try {
      return resolveModel(params).stock?.reduce((sum, count) => sum + count, 0) ?? null
    } catch {
      return null
    }
  }, [params])
  const beasts = useMemo(() => {
    const named = buildKindVisuals(params.kinds.map((kind) => ({ id: kind.id, hidden: kind.hidden === true })))
      .filter((visual) => !visual.hidden && kindNameLabel(visual) !== null)
    return secret ? named.slice(0, SECRET_BEASTS) : named
  }, [params, secret])

  // 库存有限时货架上就是剩下的盒数（最多画一整架）；货源不限就摆满一整架。
  const total = stockTotal === null ? FULL_SHELF : Math.max(1, Math.min(stockTotal, FULL_SHELF))

  const opened = new Map<number, KindVisual>()
  if (beasts.length > 0) {
    const slots = draw.order.filter((slot) => slot < total).slice(0, draw.count)
    let previous = -1
    slots.forEach((slot, index) => {
      let pick = Math.floor((draw.picks[index] ?? 0) * beasts.length)
      if (pick === previous && beasts.length > 1) pick = (pick + 1) % beasts.length
      previous = pick
      const beast = beasts[pick]
      if (beast !== undefined) opened.set(slot, beast)
    })
  }

  const shelf = Array.from({ length: total }, (_, slot) => slot)
  const openedNames = [...opened.values()].map((visual) => visual.name)

  return (
    <div
      className="situation-shelf"
      role="img"
      aria-label={`货架上整整齐齐摆着 ${total} 盒盲盒${openedNames.length > 0 ? `，其中 ${openedNames.length} 盒已经拆开：${openedNames.join("、")}` : ""}`}
    >
      <div className="situation-shelf__row" style={{ "--cols": total } as CSSProperties}>
        {shelf.map((slot) => {
          const beast = opened.get(slot)
          if (beast === undefined) {
            return (
              <span key={slot} className="situation-shelf__slot">
                <img src={blindBoxPackage} alt="" decoding="async" draggable="false" />
              </span>
            )
          }
          return (
            <span key={slot} className="situation-shelf__slot is-open" style={{ "--accent": beast.color } as CSSProperties}>
              <KindGlyph visual={beast} size="medium" />
              <em>{beast.name}</em>
            </span>
          )
        })}
      </div>
    </div>
  )
}
