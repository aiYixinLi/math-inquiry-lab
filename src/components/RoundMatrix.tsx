import { useRef, type CSSProperties, type KeyboardEvent } from "react"
import type { RoundResult } from "../types"
import { PanelHeading } from "./PanelHeading"

export interface RoundMatrixProps {
  rounds: readonly RoundResult[]
  plannedRounds: number
  selectedRoundIndex?: number | null
  onSelectRound: (roundIndex: number) => void
}

const BUCKETS = [
  { label: "6-9", className: "bucket--swift" },
  { label: "10-13", className: "bucket--quick" },
  { label: "14-17", className: "bucket--average" },
  { label: "18-21", className: "bucket--patient" },
  { label: "22-25", className: "bucket--long" },
  { label: "26+", className: "bucket--rare" },
] as const

function bucketFor(totalPurchases: number) {
  if (totalPurchases <= 9) return BUCKETS[0]
  if (totalPurchases <= 13) return BUCKETS[1]
  if (totalPurchases <= 17) return BUCKETS[2]
  if (totalPurchases <= 21) return BUCKETS[3]
  if (totalPurchases <= 25) return BUCKETS[4]
  return BUCKETS[5]
}

function matrixColumns(total: number) {
  if (total <= 10) return Math.max(1, total)
  if (total <= 100) return 10
  if (total <= 200) return 20
  if (total <= 500) return 25
  return 40
}

export function RoundMatrix({
  rounds,
  plannedRounds,
  selectedRoundIndex,
  onSelectRound,
}: RoundMatrixProps) {
  const cellCount = Math.min(1000, Math.max(1, plannedRounds, rounds.length))
  const columns = matrixColumns(cellCount)
  const density = cellCount > 500 ? "ultra" : cellCount > 100 ? "dense" : cellCount > 50 ? "medium" : "relaxed"
  const roundMap = new Map(rounds.map((round) => [round.roundIndex, round]))
  const matrixStyle = { "--matrix-columns": columns } as CSSProperties
  const selected = selectedRoundIndex ? roundMap.get(selectedRoundIndex) : undefined
  const matrixRef = useRef<HTMLDivElement | null>(null)

  const moveFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    roundIndex: number,
  ) => {
    let target = roundIndex
    switch (event.key) {
      case "ArrowLeft": target -= 1; break
      case "ArrowRight": target += 1; break
      case "ArrowUp": target -= columns; break
      case "ArrowDown": target += columns; break
      case "Home": target = 1; break
      case "End": target = rounds.length; break
      default: return
    }

    event.preventDefault()
    target = Math.max(1, Math.min(rounds.length, target))
    onSelectRound(target)
    matrixRef.current
      ?.querySelector<HTMLButtonElement>(`[data-round-index="${target}"]`)
      ?.focus()
  }

  return (
    <section className="glass-panel matrix-panel" aria-label="每一轮实验结果矩阵">
      <PanelHeading
        eyebrow="ROUND MAP"
        title="逐轮结果矩阵"
        detail={<span>完成 {rounds.length}/{Math.max(plannedRounds, rounds.length)} 轮</span>}
        action={
          selected
            ? <span className="selected-round-chip">第 {selected.roundIndex} 轮 · <strong>{selected.totalPurchases} 盒</strong></span>
            : <span className="selected-round-chip is-empty">点击色块查看完整过程</span>
        }
      />

      <div className="matrix-legend" aria-label="颜色表示集齐所需盒数区间">
        {BUCKETS.map((bucket) => (
          <span key={bucket.label}><i className={bucket.className} />{bucket.label}</span>
        ))}
      </div>

      <div
        ref={matrixRef}
        className={`round-matrix round-matrix--${density}`}
        style={matrixStyle}
        role="grid"
        aria-rowcount={Math.ceil(cellCount / columns)}
        aria-colcount={columns}
        aria-label={`${cellCount} 个轮次位置，其中已经完成 ${rounds.length} 轮`}
      >
        {Array.from({ length: cellCount }, (_, index) => {
          const roundIndex = index + 1
          const round = roundMap.get(roundIndex)
          if (!round) {
            return (
              <span
                key={roundIndex}
                className="round-cell is-pending"
                role="gridcell"
                aria-label={`第 ${roundIndex} 轮，尚未完成`}
              ><i /></span>
            )
          }
          const bucket = bucketFor(round.totalPurchases)
          return (
            <button
              key={roundIndex}
              type="button"
              className={`round-cell ${bucket.className}${selectedRoundIndex === roundIndex ? " is-selected" : ""}`}
              onClick={() => onSelectRound(roundIndex)}
              onKeyDown={(event) => moveFocus(event, roundIndex)}
              data-round-index={roundIndex}
              tabIndex={
                selectedRoundIndex === roundIndex ||
                (!selectedRoundIndex && roundIndex === rounds[0]?.roundIndex)
                  ? 0
                  : -1
              }
              role="gridcell"
              aria-selected={selectedRoundIndex === roundIndex}
              aria-label={`第 ${roundIndex} 轮，购买 ${round.totalPurchases} 盒集齐，重复 ${round.duplicateCount} 盒`}
              title={`第 ${roundIndex} 轮：${round.totalPurchases} 盒集齐`}
            >
              <small>{roundIndex}</small>
              <strong>{round.totalPurchases}</strong>
            </button>
          )
        })}
      </div>
    </section>
  )
}
