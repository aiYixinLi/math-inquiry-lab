import type { CSSProperties } from "react"
import type { StyleId, StyleLabel } from "../types"
import qinglongImage from "../../assets/01.png"
import baihuImage from "../../assets/02.png"
import zhuqueImage from "../../assets/03.png"
import xuanwuImage from "../../assets/04.png"
import qilinImage from "../../assets/05.png"
import pixiuImage from "../../assets/06.png"
import jiuweihuImage from "../../assets/07.png"
import baizeImage from "../../assets/08.png"
import kunpengImage from "../../assets/09.png"
import xiezhiImage from "../../assets/10.png"
import chongmingImage from "../../assets/11.png"
import jiuseluImage from "../../assets/12.png"

/** 一只神兽的图片和配色；六款常规款（StyleVisual）和建模阶梯里多出来的六只（EXTRA_BEAST_VISUALS）共用。 */
export interface BeastArt {
  name: string
  color: string
  softColor: string
  iconName: string
  imageUrl: string
  imageScale: string
  imageOffsetX: string
  imageOffsetY: string
  imageSize: readonly [width: number, height: number]
  figureBounds: readonly [x: number, y: number, width: number, height: number]
}

export interface StyleVisual extends BeastArt {
  id: StyleId
  label: StyleLabel
}

// Normalize every PNG to the same 98% non-transparent figure height even though
// the source canvases contain different amounts of vertical padding.
// figureBounds are the measured non-transparent pixel bounds; recalculate them
// whenever one of the six source PNGs is replaced.
export const STYLE_VISUALS: readonly StyleVisual[] = [
  { id: 1, label: "A", name: "青龙", color: "var(--style-a, #42ded1)", softColor: "var(--style-a-soft, #135a59)", iconName: "青龙神兽", imageUrl: qinglongImage, imageScale: ".981382", imageOffsetX: "0%", imageOffsetY: "0%", imageSize: [426, 710], figureBounds: [0, 0, 426, 709] },
  { id: 2, label: "B", name: "白虎", color: "var(--style-b, #c7d6f0)", softColor: "var(--style-b-soft, #4b5d79)", iconName: "白虎神兽", imageUrl: baihuImage, imageScale: "1.260507", imageOffsetX: "-4%", imageOffsetY: "9%", imageSize: [474, 710], figureBounds: [71, 81, 388, 552] },
  { id: 3, label: "C", name: "朱雀", color: "var(--style-c, #ff6e55)", softColor: "var(--style-c-soft, #7c3228)", iconName: "朱雀神兽", imageUrl: zhuqueImage, imageScale: ".98", imageOffsetX: "0%", imageOffsetY: "0%", imageSize: [574, 710], figureBounds: [1, 0, 573, 710] },
  { id: 4, label: "D", name: "玄武", color: "var(--style-d, #64a782)", softColor: "var(--style-d-soft, #275543)", iconName: "玄武神兽", imageUrl: xuanwuImage, imageScale: "1.094025", imageOffsetX: "0%", imageOffsetY: "0%", imageSize: [496, 710], figureBounds: [0, 73, 496, 636] },
  { id: 5, label: "E", name: "麒麟", color: "var(--style-e, #f5c85a)", softColor: "var(--style-e-soft, #765716)", iconName: "麒麟神兽", imageUrl: qilinImage, imageScale: "1.095748", imageOffsetX: "-1.5%", imageOffsetY: "2%", imageSize: [474, 710], figureBounds: [54, 39, 383, 635] },
  { id: 6, label: "F", name: "貔貅", color: "var(--style-f, #55d596)", softColor: "var(--style-f-soft, #176147)", iconName: "貔貅神兽", imageUrl: pixiuImage, imageScale: ".981382", imageOffsetX: "0%", imageOffsetY: "0%", imageSize: [498, 710], figureBounds: [0, 0, 498, 709] },
] as const

// 建模阶梯里第 7–12 款常规款用的神兽（图片 07–12 号）；模拟实验只有前六款，不用这六只。
// figureBounds 同样是量出来的不透明像素范围，换图后要重新量。
export const EXTRA_BEAST_VISUALS: readonly BeastArt[] = [
  { name: "九尾狐", color: "#ff8fb1", softColor: "#7a2f4c", iconName: "九尾狐神兽", imageUrl: jiuweihuImage, imageScale: ".98", imageOffsetX: "0%", imageOffsetY: "0%", imageSize: [473, 710], figureBounds: [8, 52, 463, 556] },
  { name: "白泽", color: "#b79bff", softColor: "#4b3a86", iconName: "白泽神兽", imageUrl: baizeImage, imageScale: ".98", imageOffsetX: "0%", imageOffsetY: "0%", imageSize: [473, 710], figureBounds: [8, 42, 458, 637] },
  { name: "鲲鹏", color: "#5b8dff", softColor: "#1d3a8a", iconName: "鲲鹏神兽", imageUrl: kunpengImage, imageScale: ".98", imageOffsetX: "0%", imageOffsetY: "0%", imageSize: [473, 710], figureBounds: [4, 72, 467, 572] },
  { name: "獬豸", color: "#e0a24e", softColor: "#7a4a14", iconName: "獬豸神兽", imageUrl: xiezhiImage, imageScale: ".98", imageOffsetX: "0%", imageOffsetY: "0%", imageSize: [473, 710], figureBounds: [23, 22, 422, 645] },
  { name: "重明鸟", color: "#7fd8ec", softColor: "#1d6677", iconName: "重明鸟神兽", imageUrl: chongmingImage, imageScale: ".98", imageOffsetX: "0%", imageOffsetY: "0%", imageSize: [473, 710], figureBounds: [17, 6, 446, 680] },
  { name: "九色鹿", color: "#86e3b4", softColor: "#1f6a4a", iconName: "九色鹿神兽", imageUrl: jiuseluImage, imageScale: ".98", imageOffsetX: "0%", imageOffsetY: "0%", imageSize: [473, 710], figureBounds: [11, 11, 438, 674] },
] as const

export function getStyleVisual(id: StyleId): StyleVisual {
  return STYLE_VISUALS[id - 1]
}

export type AccentStyle = CSSProperties & {
  "--accent": string
  "--accent-soft"?: string
  "--image-scale"?: string
  "--image-x"?: string
  "--image-y"?: string
}

interface GlyphOptions {
  size?: "small" | "medium" | "large"
  muted?: boolean
  showLabel?: boolean
  trimTransparentPadding?: boolean
  /** 按轮廓面积统一视觉大小（只对 trimTransparentPadding 生效）：细高的和矮胖的神兽看起来一样大，脚底对齐。 */
  equalizeVisualSize?: boolean
}

// 轮廓面积的平方根占方框边长的比例；取 .72 时十二只都放得进方框（最高的约占 .93）。
const EQUAL_SIZE_RATIO = 0.72

interface StyleGlyphProps extends GlyphOptions {
  styleId: StyleId
}

interface BeastGlyphProps extends GlyphOptions {
  visual: BeastArt
  /** 角标和 aria-label 里显示的字母；不给就用神兽名字。 */
  label?: string
}

export function StyleGlyph({ styleId, ...options }: StyleGlyphProps) {
  const visual = getStyleVisual(styleId)
  return <BeastGlyph visual={visual} label={visual.label} {...options} />
}

export function BeastGlyph({
  visual,
  label,
  size = "medium",
  muted = false,
  showLabel = false,
  trimTransparentPadding = false,
  equalizeVisualSize = false,
}: BeastGlyphProps) {
  const [sourceWidth, sourceHeight] = visual.imageSize
  const [figureX, figureY, figureWidth, figureHeight] = visual.figureBounds
  const accentStyle: AccentStyle = {
    "--accent": visual.color,
    "--accent-soft": visual.softColor,
    "--image-scale": visual.imageScale,
    "--image-x": visual.imageOffsetX,
    "--image-y": visual.imageOffsetY,
  }

  const equalized = trimTransparentPadding && equalizeVisualSize
  const equalizedStyle: CSSProperties | undefined = equalized
    ? {
        width: `${EQUAL_SIZE_RATIO * 100 * Math.sqrt(figureWidth / figureHeight)}%`,
        height: `${EQUAL_SIZE_RATIO * 100 * Math.sqrt(figureHeight / figureWidth)}%`,
        alignSelf: "end",
        transform: "none",
      }
    : undefined

  return (
    <span
      className={`style-glyph style-glyph--${size}${trimTransparentPadding ? " is-trimmed" : ""}${muted ? " is-muted" : ""}`}
      style={accentStyle}
      data-style={label?.toLowerCase()}
      aria-label={label === undefined ? visual.iconName : `${label}款，${visual.iconName}`}
      role="img"
    >
      {trimTransparentPadding ? (
        <svg
          viewBox={`${figureX} ${figureY} ${figureWidth} ${figureHeight}`}
          width={figureWidth}
          height={figureHeight}
          style={equalizedStyle}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
        >
          <image
            href={visual.imageUrl}
            width={sourceWidth}
            height={sourceHeight}
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      ) : (
        <img
          src={visual.imageUrl}
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable="false"
        />
      )}
      {showLabel && label !== undefined && <strong>{label}</strong>}
    </span>
  )
}
