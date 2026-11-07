// 建模阶梯实验台和页面共用的小工具。放在单独的 .ts 里，
// 这样 LadderLab.tsx 只导出组件，改它时 Vite 才能热更新（Fast Refresh）。

import { formatNumber } from "../../../core/blindbox"
import type { LadderControls, LevelAnswer } from "./levels"

export function formatAnswer(value: number, unit: LevelAnswer["unit"]): string {
  return unit === "%" ? `${formatNumber(value)}%` : `${formatNumber(value)} ${unit}`
}

export function sameControls(left: LadderControls, right: LadderControls): boolean {
  return (Object.keys(left) as (keyof LadderControls)[]).every((key) => left[key] === right[key])
}
