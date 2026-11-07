import type { CSSProperties, ReactNode } from "react"
import type { TopicId } from "../topic-registry"
import { AppHeader } from "./AppHeader"
import { ViewportGuard } from "./ViewportGuard"

interface AppFrameProps {
  readonly children: ReactNode
  readonly navigation?: ReactNode
  readonly accent?: string
  readonly accentRgb?: string
  readonly pageLabel: string
  readonly topicId?: TopicId
}
export function AppFrame({
  children,
  navigation,
  accent = "#62e6ff",
  accentRgb = "98 230 255",
  pageLabel,
  topicId,
}: AppFrameProps) {
  const style = {
    "--topic-accent": accent,
    "--topic-accent-rgb": accentRgb,
  } as CSSProperties

  return (
    <div className="math-app" style={style} data-topic={topicId}>
      <div className="math-app__ambient" aria-hidden="true">
        <i className="math-app__orb math-app__orb--one" />
        <i className="math-app__orb math-app__orb--two" />
        <i className="math-app__grid" />
        <i className="math-app__stars" />
      </div>
      <AppHeader navigation={navigation} />
      <main className="math-app__main" aria-label={pageLabel}>{children}</main>
      <ViewportGuard />
    </div>
  )
}
