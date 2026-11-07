// 建模阶梯里按钮、徽章和提示条上的小图标：都只做装饰，颜色和字号跟着所在的元素走。

import type { ReactNode } from "react"

function Svg({ children, spinning = false }: { readonly children: ReactNode; readonly spinning?: boolean }) {
  return (
    <svg className={spinning ? "ladder-icon is-spinning" : "ladder-icon"} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export function PlayIcon() {
  return (
    <Svg>
      <path d="M8.5 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L10.02 4.75a1 1 0 0 0-1.52.85Z" fill="currentColor" />
    </Svg>
  )
}

export function PauseIcon() {
  return (
    <Svg>
      <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
    </Svg>
  )
}

export function ForwardIcon() {
  return (
    <Svg>
      <path d="M4 6.2v11.6a.8.8 0 0 0 1.25.66l7.6-5.8a.8.8 0 0 0 0-1.32l-7.6-5.8A.8.8 0 0 0 4 6.2Zm9 0v11.6a.8.8 0 0 0 1.25.66l7.6-5.8a.8.8 0 0 0 0-1.32l-7.6-5.8A.8.8 0 0 0 13 6.2Z" fill="currentColor" />
    </Svg>
  )
}

export function ReplayIcon() {
  return (
    <Svg>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5v4.6h4.6" />
    </Svg>
  )
}

export function SpinnerIcon() {
  return (
    <Svg spinning>
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
    </Svg>
  )
}

export function DiceIcon() {
  return (
    <Svg>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <g fill="currentColor" stroke="none">
        <circle cx="9" cy="9" r="1.3" />
        <circle cx="15" cy="9" r="1.3" />
        <circle cx="12" cy="12" r="1.3" />
        <circle cx="9" cy="15" r="1.3" />
        <circle cx="15" cy="15" r="1.3" />
      </g>
    </Svg>
  )
}

export function BoxIcon() {
  return (
    <Svg>
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9" />
    </Svg>
  )
}

export function SlidersIcon() {
  return (
    <Svg>
      <path d="M4 7h9M19 7h1M4 17h1M11 17h9" />
      <circle cx="16" cy="7" r="2.3" />
      <circle cx="8" cy="17" r="2.3" />
    </Svg>
  )
}

export function BulbIcon() {
  return (
    <Svg>
      <path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
    </Svg>
  )
}

export function LockIcon() {
  return (
    <Svg>
      <rect x="5" y="11" width="14" height="9" rx="2.2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  )
}

export function CheckCircleIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.4 2.7 2.7L16.2 9.6" />
    </Svg>
  )
}

export function InfoIcon() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </Svg>
  )
}

export function PencilIcon() {
  return (
    <Svg>
      <path d="m4 20 1-4.2L16.6 4.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19 4 20ZM14.5 6.3l3.2 3.2" />
    </Svg>
  )
}

export function ShieldIcon() {
  return (
    <Svg>
      <path d="M12 3 5 6v5.5c0 4.4 2.9 7.7 7 9.5 4.1-1.8 7-5.1 7-9.5V6l-7-3Z" />
      <path d="m8.8 12.2 2.3 2.3 4.1-4.3" />
    </Svg>
  )
}

export function ArrowRightIcon() {
  return (
    <Svg>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  )
}
