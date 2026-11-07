import type { CSSProperties, ReactNode } from "react"
import { NavLink } from "react-router-dom"
import {
  getTopic,
  type TopicId,
  type TopicModule,
  type TopicPage,
} from "../topic-registry"
import { AppFrame } from "./AppFrame"

const MODULE_LABELS: Record<TopicModule, string> = {
  learn: "互动学习",
  playground: "模拟实验",
  quiz: "测试与反馈",
}
interface TopicShellProps {
  readonly topicId: TopicId
  readonly module: TopicPage
  readonly children: ReactNode
}

export function TopicShell({ topicId, module, children }: TopicShellProps) {
  const topic = getTopic(topicId)
  const extraPages = topic.extraPages ?? []
  const pageLabel = module === "learn" || module === "playground" || module === "quiz"
    ? MODULE_LABELS[module]
    : extraPages.find((page) => page.id === module)?.label ?? ""

  const navigation = (
    <>
      <div className="topic-context">
        <span>{topic.index}</span>
        <strong>{topic.shortTitle}</strong>
        <small className="topic-context__question" title={topic.question}>
          {topic.question}
        </small>
      </div>
      <nav
        className={extraPages.length > 0 ? "topic-tabs topic-tabs--extra" : "topic-tabs"}
        style={extraPages.length > 0 ? ({ "--tab-count": 3 + extraPages.length } as CSSProperties) : undefined}
        aria-label={`${topic.shortTitle}课题导航`}
      >
        {(Object.keys(MODULE_LABELS) as TopicModule[]).map((item) => (
          <NavLink
            key={item}
            to={topic.routes[item]}
            className={({ isActive }) => isActive ? "is-active" : undefined}
            aria-current={item === module ? "page" : undefined}
          >
            <span>{item === "learn" ? "学习" : item === "playground" ? "实验" : "测试"}</span>
            <strong>{MODULE_LABELS[item]}</strong>
          </NavLink>
        ))}
        {extraPages.map((page) => (
          <NavLink
            key={page.id}
            to={page.route}
            className={({ isActive }) => isActive ? "is-active" : undefined}
            aria-current={page.id === module ? "page" : undefined}
          >
            <span>{page.badge}</span>
            <strong>{page.label}</strong>
          </NavLink>
        ))}
      </nav>
    </>
  )

  return (
    <AppFrame
      navigation={navigation}
      accent={topic.accent}
      accentRgb={topic.accentRgb}
      pageLabel={`${topic.title}：${pageLabel}`}
      topicId={topicId}
    >
      {children}
    </AppFrame>
  )
}
