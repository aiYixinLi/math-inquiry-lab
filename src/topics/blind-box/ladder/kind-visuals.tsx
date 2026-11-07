// 建模阶梯里“一款盲盒”长什么样：前 6 款常规款沿用模拟实验里的六神兽，
// 第 7–12 款常规款是新增的六只神兽（九尾狐、白泽、鲲鹏、獬豸、重明鸟、九色鹿），
// 隐藏款是一颗金色的星，超过 12 款的常规款（L6 最多 20 款）用彩色字母徽章。

import type { CSSProperties } from "react"
import { BeastGlyph, EXTRA_BEAST_VISUALS, getStyleVisual, StyleGlyph, type BeastArt } from "../../../components/StyleGlyph"
import type { StyleId } from "../../../types"

export interface KindVisual {
  readonly index: number
  readonly id: string
  readonly label: string
  readonly name: string
  readonly color: string
  readonly hidden: boolean
  /** 前 6 款常规款（六神兽）；其余为 null。 */
  readonly styleId: StyleId | null
  /** 第 7–12 款常规款的神兽图片；其余为 null。 */
  readonly beast: BeastArt | null
}

const HIDDEN_COLOR = "#ffc857"

export function buildKindVisuals(kinds: readonly { readonly id: string; readonly hidden: boolean }[]): KindVisual[] {
  let regular = 0
  return kinds.map((kind, index) => {
    if (kind.hidden) {
      return { index, id: kind.id, label: "★", name: "隐藏款", color: HIDDEN_COLOR, hidden: true, styleId: null, beast: null }
    }
    const order = regular
    regular += 1
    if (order < 6) {
      const styleId = (order + 1) as StyleId
      const visual = getStyleVisual(styleId)
      return { index, id: kind.id, label: visual.label, name: visual.name, color: visual.color, hidden: false, styleId, beast: null }
    }
    const beast = EXTRA_BEAST_VISUALS[order - 6]
    if (beast !== undefined) {
      return { index, id: kind.id, label: kind.id, name: beast.name, color: beast.color, hidden: false, styleId: null, beast }
    }
    return {
      index,
      id: kind.id,
      label: kind.id,
      name: `第 ${order + 1} 款`,
      color: `hsl(${(order * 47 + 190) % 360} 72% 62%)`,
      hidden: false,
      styleId: null,
      beast: null,
    }
  })
}

/** 有名字的款（六神兽、新增六只、隐藏款）返回名字；字母徽章款返回 null。 */
export function kindNameLabel(visual: KindVisual): string | null {
  return visual.styleId !== null || visual.beast !== null || visual.hidden ? visual.name : null
}

interface KindGlyphProps {
  readonly visual: KindVisual
  readonly size?: "small" | "medium" | "large"
  readonly muted?: boolean
}

export function KindGlyph({ visual, size = "medium", muted = false }: KindGlyphProps) {
  if (visual.styleId !== null) {
    return <StyleGlyph styleId={visual.styleId} size={size} muted={muted} trimTransparentPadding equalizeVisualSize />
  }
  if (visual.beast !== null) {
    return <BeastGlyph visual={visual.beast} label={visual.label} size={size} muted={muted} trimTransparentPadding equalizeVisualSize />
  }
  const style = { "--accent": visual.color } as CSSProperties
  return (
    <span
      className={`style-glyph style-glyph--${size} kind-glyph${muted ? " is-muted" : ""}${visual.hidden ? " is-hidden-kind" : ""}`}
      style={style}
      role="img"
      aria-label={visual.hidden ? "隐藏款" : `${visual.label}款`}
    >
      {visual.hidden ? <HiddenStar /> : <LetterBadge letter={visual.label} />}
    </span>
  )
}

function HiddenStar() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="kind-hidden-fill" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#fff4bd" />
          <stop offset=".5" stopColor="#ffc857" />
          <stop offset="1" stopColor="#e58a1b" />
        </linearGradient>
        <radialGradient id="kind-hidden-glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffd978" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffd978" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="52" r="46" fill="url(#kind-hidden-glow)" />
      <path
        d="M50 10 62 38 92 41 69 61 76 91 50 75 24 91 31 61 8 41 38 38Z"
        fill="url(#kind-hidden-fill)"
        stroke="#fff6cf"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M50 10 62 38 50 52 38 38Z" fill="#fff" fillOpacity=".34" />
      <path d="M86 14v10M81 19h10M16 74v8M12 78h8" stroke="#fff6cf" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

function LetterBadge({ letter }: { readonly letter: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect x="12" y="12" width="76" height="76" rx="22" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="4" />
      <text x="50" y="64" textAnchor="middle" fontSize="44" fontWeight="800" fill="currentColor">{letter}</text>
    </svg>
  )
}
