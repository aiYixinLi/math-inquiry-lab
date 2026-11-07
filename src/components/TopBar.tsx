import type { ExperimentMode, ExperimentStatus } from "../types"
import type { Theme } from "../lib/theme"
import { NavLink } from "react-router-dom"

export interface TopBarProps {
  status: ExperimentStatus
  mode: ExperimentMode
  completedRounds: number
  plannedRounds: number
  currentRoundIndex?: number
  isFullscreen?: boolean
  canExport?: boolean
  isExportOpen?: boolean
  theme?: Theme
  soundEnabled?: boolean
  onToggleFullscreen?: () => void
  onToggleTheme?: () => void
  onToggleSound?: () => void
  onExport?: () => void
  onReset?: () => void
}

const STATUS_COPY: Record<ExperimentStatus, string> = {
  idle: "等待启动",
  opening: "正在开盒",
  running: "实验运行中",
  paused: "实验已暂停",
  completed: "实验已完成",
  cancelled: "实验已结束",
}

function ActionIcon({ name }: { name: "fullscreen" | "export" | "reset" | "sun" | "moon" | "sound-on" | "sound-off" }) {
  if (name === "sun") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.6" />
        <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56m11.02 11.02 1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
      </svg>
    )
  }
  if (name === "moon") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 15.2A8 8 0 0 1 8.8 4a8.1 8.1 0 1 0 11.2 11.2Z" />
      </svg>
    )
  }
  if (name === "fullscreen") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      </svg>
    )
  }
  if (name === "sound-on") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 10v4h3l4 3V7L8 10H5Z" />
        <path d="M15 9.2a4 4 0 0 1 0 5.6M17.8 6.5a7.6 7.6 0 0 1 0 11" />
      </svg>
    )
  }
  if (name === "sound-off") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 10v4h3l4 3V7L8 10H5Z" />
        <path d="m16 10 4 4m0-4-4 4" />
      </svg>
    )
  }
  if (name === "export") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v12m-4-4 4 4 4-4M5 18v2h14v-2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.8 9A8 8 0 1 1 4 14m.8-5H9M4.8 9V4" />
    </svg>
  )
}

export function TopBar({
  status,
  mode,
  completedRounds,
  plannedRounds,
  currentRoundIndex,
  isFullscreen = false,
  canExport = false,
  isExportOpen = false,
  theme = "dark",
  soundEnabled = false,
  onToggleFullscreen,
  onToggleTheme,
  onToggleSound,
  onExport,
  onReset,
}: TopBarProps) {
  const progressText = mode === "batch"
    ? `${completedRounds}/${Math.max(plannedRounds, completedRounds)} 轮`
    : `第 ${Math.max(1, currentRoundIndex ?? completedRounds + 1)} 轮`

  return (
    <header className="top-bar">
      <div className="top-bar__brand">
        <span className="top-bar__mark" aria-hidden="true">
          <i /><i /><i />
        </span>
        <div>
          <div className="top-bar__title-line">
            <h1>盲盒概率实验舱</h1>
            <span className="top-bar__version">LAB 06</span>
          </div>
          <p>集齐一套到底有多难？</p>
        </div>
      </div>

      <nav className="top-bar__topic-tabs" aria-label="盲盒集齐课题导航">
        <NavLink to="/topics/blind-box/learn">学习</NavLink>
        <NavLink to="/topics/blind-box/playground">实验</NavLink>
        <NavLink to="/topics/blind-box/quiz">测试</NavLink>
      </nav>

      <div className="top-bar__model" aria-label="当前实验模型">
        <span className="top-bar__model-die" aria-hidden="true">
          <i /><i /><i /><i /><i /><i />
        </span>
        <div>
          <strong>六神兽等概率模型</strong>
          <small>每款概率 1/6 · 抽取后放回</small>
        </div>
      </div>

      <div className="top-bar__state" aria-live="polite">
        <span className={`status-beacon status-beacon--${status}`} aria-hidden="true" />
        <div>
          <strong>{STATUS_COPY[status]}</strong>
          <small>{mode === "manual" ? "手动实验" : "批量实验"} · {progressText}</small>
        </div>
      </div>

      <nav className="top-bar__actions" aria-label="页面操作">
        <a
          className="icon-action"
          href="#/"
          aria-label="返回数学探究实验室首页"
          title="返回首页"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4Z" />
          </svg>
        </a>
        {onToggleSound && (
          <button
            className={`icon-action icon-action--sound${soundEnabled ? " is-active" : ""}`}
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? "关闭音效" : "开启音效"}
            aria-pressed={soundEnabled}
            title={soundEnabled ? "关闭音效" : "开启音效"}
          >
            <ActionIcon name={soundEnabled ? "sound-on" : "sound-off"} />
          </button>
        )}
        {onToggleTheme && (
          <button
            className="icon-action icon-action--theme"
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "切换为浅色主题" : "切换为暗色主题"}
            aria-pressed={theme === "light"}
            title={theme === "dark" ? "切换为浅色主题" : "切换为暗色主题"}
          >
            <ActionIcon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        )}
        {onToggleFullscreen && (
          <button
            className="icon-action"
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "退出全屏" : "进入全屏"}
            title={isFullscreen ? "退出全屏" : "进入全屏"}
          >
            <ActionIcon name="fullscreen" />
          </button>
        )}
        {onExport && (
          <button
            className="icon-action"
            type="button"
            onClick={onExport}
            disabled={!canExport}
            aria-label="导出完整实验数据"
            aria-controls="export-menu"
            aria-expanded={isExportOpen}
            title="导出数据"
          >
            <ActionIcon name="export" />
          </button>
        )}
        {onReset && (
          <button
            className="icon-action icon-action--danger"
            type="button"
            onClick={onReset}
            aria-label="重置实验"
            title="重置实验"
          >
            <ActionIcon name="reset" />
          </button>
        )}
      </nav>
    </header>
  )
}
