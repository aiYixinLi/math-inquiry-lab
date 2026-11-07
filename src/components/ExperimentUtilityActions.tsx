interface ExperimentUtilityActionsProps {
  readonly soundEnabled: boolean
  readonly canExport: boolean
  readonly isExportOpen: boolean
  readonly onToggleSound: () => void
  readonly onExport: () => void
  readonly onReset: () => void
}

function UtilityIcon({ name }: { name: "sound-on" | "sound-off" | "export" | "reset" }) {
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

export function ExperimentUtilityActions({
  soundEnabled,
  canExport,
  isExportOpen,
  onToggleSound,
  onExport,
  onReset,
}: ExperimentUtilityActionsProps) {
  return (
    <nav className="experiment-utility-actions" aria-label="实验页面操作">
      <button
        className={`experiment-utility-action experiment-utility-action--sound${soundEnabled ? " is-active" : ""}`}
        type="button"
        onClick={onToggleSound}
        aria-label={soundEnabled ? "关闭音效" : "开启音效"}
        aria-pressed={soundEnabled}
        title={soundEnabled ? "关闭音效" : "开启音效"}
      >
        <UtilityIcon name={soundEnabled ? "sound-on" : "sound-off"} />
      </button>
      <button
        className="experiment-utility-action"
        type="button"
        onClick={onExport}
        disabled={!canExport}
        aria-label="导出完整实验数据"
        aria-controls="export-menu"
        aria-expanded={isExportOpen}
        title="导出数据"
      >
        <UtilityIcon name="export" />
      </button>
      <button
        className="experiment-utility-action experiment-utility-action--danger"
        type="button"
        onClick={onReset}
        aria-label="重置实验"
        title="重置实验"
      >
        <UtilityIcon name="reset" />
      </button>
    </nav>
  )
}
