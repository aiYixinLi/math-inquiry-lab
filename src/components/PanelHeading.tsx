import type { ReactNode } from "react"

interface PanelHeadingProps {
  eyebrow?: string
  title: string
  detail?: ReactNode
  action?: ReactNode
}
export function PanelHeading({ eyebrow, title, detail, action }: PanelHeadingProps) {
  return (
    <header className="panel-heading">
      <div className="panel-heading__copy">
        <div className="panel-heading__line">
          {eyebrow && <span className="panel-heading__eyebrow">{eyebrow}</span>}
          <h2>{title}</h2>
          {detail && <span className="panel-heading__detail">{detail}</span>}
        </div>
      </div>
      {action && <div className="panel-heading__action">{action}</div>}
    </header>
  )
}
