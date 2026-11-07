export type TopicId = "blind-box" | "elevator" | "cake-cutting"

export type TopicModule = "learn" | "playground" | "quiz"

/** 三个模块之外、只属于某个课题的页面，例如盲盒课题的“自由提条件”。 */
export interface TopicExtraPage {
  readonly id: "ladder" | "free-condition"
  readonly label: string
  /** 导航标签上的小字。 */
  readonly badge: string
  readonly route: string
}

export type TopicPage = TopicModule | TopicExtraPage["id"]

export interface TopicDefinition {
  readonly id: TopicId
  readonly index: string
  readonly title: string
  readonly shortTitle: string
  readonly question: string
  readonly summary: string
  readonly knowledgeTags: readonly string[]
  readonly accent: string
  readonly accentRgb: string
  readonly modelVersion: string
  readonly routes: Readonly<Record<TopicModule, string>>
  readonly extraPages?: readonly TopicExtraPage[]
}
export const TOPICS: readonly TopicDefinition[] = [
  {
    id: "blind-box",
    index: "01",
    title: "盲盒集齐一套到底有多难？",
    shortTitle: "盲盒集齐",
    question: "重复款怎样改变集齐一套所需的购买次数？",
    summary: "通过逐盒抽取与批量模拟，比较单次结果、实验分布和理论平均。",
    knowledgeTags: ["等可能概率", "独立重复", "平均数", "随机波动"],
    accent: "#62e6ff",
    accentRgb: "98 230 255",
    modelVersion: "blind-box-equiprobable-v1",
    routes: {
      learn: "/topics/blind-box/learn",
      playground: "/topics/blind-box/playground",
      quiz: "/topics/blind-box/quiz",
    },
    extraPages: [
      { id: "ladder", label: "建模阶梯", badge: "L0–L6", route: "/topics/blind-box/ladder" },
      { id: "free-condition", label: "自由提条件", badge: "AI", route: "/topics/blind-box/free-condition" },
    ],
  },
  {
    id: "elevator",
    index: "02",
    title: "电梯停在哪一层最合理？",
    shortTitle: "电梯停层",
    question: "怎样利用居民呼叫频数确定电梯的空闲停靠层？",
    summary: "比较不同楼层的加权距离，理解评价指标与最优方案之间的关系。",
    knowledgeTags: ["绝对值", "频数加权", "统计图", "方案优化"],
    accent: "#9c8cff",
    accentRgb: "156 140 255",
    modelVersion: "idle-floor-response-v1",
    routes: {
      learn: "/topics/elevator/learn",
      playground: "/topics/elevator/playground",
      quiz: "/topics/elevator/quiz",
    },
  },
  {
    id: "cake-cutting",
    index: "03",
    title: "怎样切蛋糕最公平？",
    shortTitle: "切蛋糕公平",
    question: "面积相等时，各块的外沿和周长也一定相等吗？",
    summary: "精确计算圆形与方形切法，按面积、边界和切割成本比较公平性。",
    knowledgeTags: ["面积比例", "扇形", "周长组成", "公平指标"],
    accent: "#ffad68",
    accentRgb: "255 173 104",
    modelVersion: "controlled-partition-v1",
    routes: {
      learn: "/topics/cake-cutting/learn",
      playground: "/topics/cake-cutting/playground",
      quiz: "/topics/cake-cutting/quiz",
    },
  },
] as const

export const TOPIC_BY_ID = Object.fromEntries(
  TOPICS.map((topic) => [topic.id, topic]),
) as Record<TopicId, TopicDefinition>

export function getTopic(topicId: TopicId): TopicDefinition {
  return TOPIC_BY_ID[topicId]
}
