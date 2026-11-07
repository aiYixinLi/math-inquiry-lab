import type { ReactNode } from "react"

export interface LabLayoutProps {
  controls: ReactNode
  stage: ReactNode
  shelf: ReactNode
  stats: ReactNode
  matrix: ReactNode
  replay: ReactNode
}
export function LabLayout({ controls, stage, shelf, stats, matrix, replay }: LabLayoutProps) {
  return (
    <>
      <section className="lab-shell" aria-label="盲盒概率模拟实验">
        <section className="lab-main-grid" aria-label="实验操作与实时结果">
          <aside className="lab-main-grid__controls">{controls}</aside>
          <section className="lab-main-grid__experiment">
            <div className="lab-main-grid__stage">{stage}</div>
            <div className="lab-main-grid__shelf">{shelf}</div>
          </section>
          <aside className="lab-main-grid__stats">{stats}</aside>
        </section>
        <section className="lab-data-deck" aria-label="实验记录与回放">
          <div className="lab-data-deck__matrix">{matrix}</div>
          <div className="lab-data-deck__replay">{replay}</div>
        </section>
      </section>

      <div className="portrait-lock" role="status" aria-live="polite">
        <div className="portrait-lock__device" aria-hidden="true"><i /></div>
        <strong>请横屏观看实验</strong>
        <span>旋转设备，完整进入盲盒概率实验舱</span>
      </div>
    </>
  )
}
