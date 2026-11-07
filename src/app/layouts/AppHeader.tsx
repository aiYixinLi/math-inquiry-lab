import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  applyTheme,
  getInitialTheme,
  persistTheme,
  type Theme,
} from "../../lib/theme"

interface AppHeaderProps {
  readonly navigation?: ReactNode
}
function HeaderIcon({ name }: { name: "home" | "sun" | "moon" | "fullscreen" }) {
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4Z" />
      </svg>
    )
  }
  if (name === "sun") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    )
  }
  if (name === "moon") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 15.4A8.3 8.3 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  )
}

export function AppHeader({ navigation }: AppHeaderProps) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => applyTheme(theme), [theme])
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", update)
    return () => document.removeEventListener("fullscreenchange", update)
  }, [])

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    persistTheme(next)
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }

  return (
    <header className={navigation ? "math-header" : "math-header math-header--simple"}>
      <Link className="math-header__brand" to="/" aria-label="返回数学探究实验室首页">
        <span className="math-header__mark" aria-hidden="true">
          <i /><i /><i />
        </span>
        <span className="math-header__titles">
          <strong>数学探究实验室</strong>
          <small lang="en">MATH INQUIRY LAB</small>
        </span>
      </Link>

      {navigation && <div className="math-header__navigation">{navigation}</div>}

      <nav className="math-header__actions" aria-label="全局页面操作">
        <Link className="math-icon-button" to="/" aria-label="返回首页" title="返回首页">
          <HeaderIcon name="home" />
        </Link>
        <button
          className="math-icon-button"
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "切换为浅色主题" : "切换为暗色主题"}
          aria-pressed={theme === "light"}
          title={theme === "dark" ? "切换为浅色主题" : "切换为暗色主题"}
        >
          <HeaderIcon name={theme === "dark" ? "sun" : "moon"} />
        </button>
        <button
          className="math-icon-button"
          type="button"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "退出全屏" : "进入全屏"}
          title={fullscreen ? "退出全屏" : "进入全屏"}
        >
          <HeaderIcon name="fullscreen" />
        </button>
      </nav>
    </header>
  )
}
