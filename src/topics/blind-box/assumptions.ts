// 理想模型 L0 里藏着的 6 条假设（研究方案第五节）。建模阶梯每一级打破其中一条，
// “自由提条件”让学生先自己判断打破了哪一条。

import type { AssumptionId } from "../../lib/translator-client"

export interface Assumption {
  readonly id: AssumptionId
  /** 按钮上的短名。 */
  readonly short: string
  readonly text: string
  /** 打破它的真实情形。 */
  readonly brokenBy: string
}

export const ASSUMPTIONS: readonly Assumption[] = [
  { id: "A1", short: "每款概率相同", text: "每款被抽到的概率相同", brokenBy: "隐藏款" },
  { id: "A2", short: "看平均数就够", text: "平均数就能说明问题", brokenBy: "“我会不会特别倒霉？”" },
  { id: "A3", short: "货买不完", text: "货无限多，买走一盒不影响下一盒", brokenBy: "店里只剩几盒、端盒、限量" },
  { id: "A4", short: "每次互不影响", text: "每次购买互不影响", brokenBy: "保底机制" },
  { id: "A5", short: "一个人集一套", text: "目标是自己一个人集齐一套", brokenBy: "和朋友合买交换、二手市场" },
  { id: "A6", short: "知道一共几款", text: "知道一共有几款", brokenBy: "厂家不公布款数；野外物种调查" },
]

export function assumptionById(id: AssumptionId): Assumption {
  const found = ASSUMPTIONS.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown assumption: ${id}`)
  return found
}
