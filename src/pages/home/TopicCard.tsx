import type { CSSProperties } from "react"
import { Link } from "react-router-dom"
import type { TopicDefinition, TopicModule } from "../../app/topic-registry"
import type { TopicProgress } from "../../shared/progress"
import blindBoxIllustration from "../../../assets/homepage-topics/topic-blind-box.webp"
import cakeCuttingIllustration from "../../../assets/homepage-topics/topic-cake-cutting.webp"
import elevatorIllustration from "../../../assets/homepage-topics/topic-elevator.webp"

const TOPIC_VISUALS: Readonly<Record<TopicDefinition["id"], {
  src: string
  alt: string
}>> = {
  "blind-box": {
    src: blindBoxIllustration,
    alt: "装着多种玩具的彩色盲盒插画",
  },
  elevator: {
    src: elevatorIllustration,
    alt: "带上下箭头与楼层色块的电梯插画",
  },
  "cake-cutting": {
    src: cakeCuttingIllustration,
    alt: "用水果和蛋糕块展示等分的蛋糕插画",
  },
}

const MODULES: readonly {
  id: TopicModule
  number: string
  label: string
  detail: string
}[] = [
  { id: "learn", number: "1", label: "互动学习", detail: "概念 · 图示 · 即时检查" },
  { id: "playground", number: "2", label: "模拟实验", detail: "猜想 · 操作 · 数据解释" },
  { id: "quiz", number: "3", label: "测试与反馈", detail: "作答 · 评分 · 学习建议" },
]

const EXTRA_DETAILS = {
  ladder: "逐级改变假设 · 比较模型",
  "free-condition": import.meta.env.VITE_OFFLINE_DEMO === "true"
    ? "选择录制情境 · 探究影响"
    : "提出条件 · 探究影响",
} as const

interface TopicCardProps {
  readonly topic: TopicDefinition
  readonly progress: TopicProgress
}

export function TopicCard({ topic, progress }: TopicCardProps) {
  const isComplete = MODULES.every(({ id }) => progress[id].status === "completed")
  const visual = TOPIC_VISUALS[topic.id]
  const style = {
    "--card-accent": topic.accent,
    "--card-accent-rgb": topic.accentRgb,
  } as CSSProperties

  return (
    <article className="topic-card" style={style} data-topic={topic.id}>
      <div className="topic-card__head">
        <span className="topic-card__index">课题 {topic.index}</span>
        {isComplete && (
          <span
            className="completion-icon completion-icon--topic"
            role="img"
            aria-label={`${topic.title}课题已完成`}
          >
            <span aria-hidden="true">✓</span>
          </span>
        )}
      </div>

      <div className="topic-card__title">
        <div className="topic-card__symbol" aria-hidden="true">
          {topic.id === "blind-box" ? "⬡" : topic.id === "elevator" ? "↕" : "◔"}
        </div>
        <div>
          <h2>{topic.title}</h2>
          <p>{topic.question}</p>
        </div>
      </div>

      <div className="topic-card__tags" aria-label="知识标签">
        {topic.knowledgeTags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>

      <p className="topic-card__summary">{topic.summary}</p>

      <figure className="topic-card__visual">
        <img
          src={visual.src}
          alt={visual.alt}
          width="512"
          height="512"
          decoding="async"
        />
      </figure>

      <div className="topic-card__path" aria-label="建议学习路径">
        {MODULES.map((item, index) => (
          <div key={item.id} className="topic-card__path-item">
            <Link to={topic.routes[item.id]}>
              <span>{item.number}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <span className="topic-card__path-actions">
                {progress[item.id].status === "completed" && (
                  <em
                    className="completion-icon completion-icon--module"
                    role="img"
                    aria-label={`${item.label}已完成`}
                  >
                    <span aria-hidden="true">✓</span>
                  </em>
                )}
                <i aria-hidden="true">→</i>
              </span>
            </Link>
            {(index < MODULES.length - 1 || (topic.extraPages?.length ?? 0) > 0) && <b aria-hidden="true" />}
          </div>
        ))}
        {topic.extraPages?.map((page, index, pages) => (
          <div key={page.id} className="topic-card__path-item">
            <Link to={page.route}>
              <span>{MODULES.length + index + 1}</span>
              <span>
                <strong>{page.label}</strong>
                <small>{EXTRA_DETAILS[page.id]}</small>
              </span>
              <span className="topic-card__path-actions"><i aria-hidden="true">→</i></span>
            </Link>
            {index < pages.length - 1 && <b aria-hidden="true" />}
          </div>
        ))}
      </div>

    </article>
  )
}
