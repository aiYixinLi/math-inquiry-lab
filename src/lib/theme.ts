export type Theme = "light" | "dark"

export const THEME_STORAGE_KEY = "blind-box-math-lab:theme"

export const THEME_COLOR: Record<Theme, string> = {
  light: "#eef4ff",
  dark: "#111333",
}

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark"
}

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark"

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (isTheme(storedTheme)) return storedTheme
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  try {
    return window.matchMedia?.("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark"
  } catch {
    return "dark"
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return

  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme

  let themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )
  if (!themeColor) {
    themeColor = document.createElement("meta")
    themeColor.name = "theme-color"
    document.head.append(themeColor)
  }
  themeColor.content = THEME_COLOR[theme]
}

export function persistTheme(theme: Theme): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Applying the visual theme still succeeds when persistence is blocked.
  }
}
