import type { ReactNode } from "react"
import type { ExperimentMode, ExperimentStatus } from "../types"
import { PanelHeading } from "./PanelHeading"

export type ExperimentSpeed = "observe" | "fast" | "turbo"

export interface ExperimentControlsProps {
  mode: ExperimentMode
  status: ExperimentStatus
  batchRounds: number
  seed: number
  speed: ExperimentSpeed
  currentPurchases?: number
  distinctCount?: number
  completedRounds?: number
  currentRoundIndex?: number
  disabled?: boolean
  hypothesisLocked?: boolean
  theoryUnlocked?: boolean
  configurationLocked?: boolean
  utilities?: ReactNode
  onOpenDiscovery?: () => void
  onModeChange: (mode: ExperimentMode) => void
  onBatchRoundsChange: (rounds: number) => void
  onSeedChange: (seed: number) => void
  onSpeedChange: (speed: ExperimentSpeed) => void
  onOpenOne: () => void
  onStartBatch: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

const ROUND_PRESETS = [10, 50, 100, 200] as const

const STATUS_COPY: Record<ExperimentStatus, string> = {
  idle: "等待启动",
  opening: "正在开盒",
  running: "实验运行中",
  paused: "实验已暂停",
  completed: "实验已完成",
  cancelled: "实验已结束",
}

export function ExperimentControls({
  mode,
  status,
  batchRounds,
  seed,
  speed,
  currentPurchases = 0,
  distinctCount = 0,
  completedRounds = 0,
  currentRoundIndex,
  disabled = false,
  hypothesisLocked = true,
  theoryUnlocked = false,
  configurationLocked = false,
  utilities,
  onOpenDiscovery,
  onModeChange,
  onBatchRoundsChange,
  onSeedChange,
  onSpeedChange,
  onOpenOne,
  onStartBatch,
  onPause,
  onResume,
  onStop,
}: ExperimentControlsProps) {
  const experimentActive = disabled || status === "running" || status === "paused" || status === "opening"
  const setupLocked = experimentActive || configurationLocked
  const manualBusy = status === "opening"
  const batchRunning = status === "running"
  const batchPaused = status === "paused"
  const safeRounds = Math.min(1000, Math.max(1, Math.round(batchRounds || 1)))
  const progressText = mode === "batch"
    ? `${completedRounds}/${Math.max(safeRounds, completedRounds)} 轮`
    : `第 ${Math.max(1, currentRoundIndex ?? completedRounds + 1)} 轮`

  return (
    <section className="glass-panel controls-panel" aria-labelledby="controls-title">
      <PanelHeading
        eyebrow="CONTROL"
        title="实验操作台"
        detail={(
          <span className="experiment-status" aria-live="polite">
            <i className={`status-beacon status-beacon--${status}`} aria-hidden="true" />
            <strong>{STATUS_COPY[status]}</strong>
            <small>{mode === "manual" ? "手动实验" : "批量实验"} · {progressText}</small>
            <span id="controls-title" className="sr-only">选择并控制盲盒实验</span>
          </span>
        )}
        action={utilities}
      />

      <div className="mode-switch" role="group" aria-label="实验模式">
        <button
          type="button"
          className={mode === "manual" ? "is-active" : ""}
          onClick={() => onModeChange("manual")}
          disabled={experimentActive}
          aria-pressed={mode === "manual"}
        >
          <span className="mode-switch__icon" aria-hidden="true">✦</span>
          <span><strong>手动开盒</strong><small>一次购买一盒</small></span>
        </button>
        <button
          type="button"
          className={mode === "batch" ? "is-active" : ""}
          onClick={() => onModeChange("batch")}
          disabled={experimentActive}
          aria-pressed={mode === "batch"}
        >
          <span className="mode-switch__icon mode-switch__icon--batch" aria-hidden="true">▦</span>
          <span><strong>批量实验</strong><small>自动完成多轮</small></span>
        </button>
      </div>

      {!hypothesisLocked && (
        <div className="discovery-prerequisite" role="status">
          <div>
            <strong>请先写下并锁定猜想</strong>
            <span>猜想锁定前，手动开盒和批量实验都不会启动。</span>
          </div>
          {onOpenDiscovery && (
            <button type="button" onClick={onOpenDiscovery}>写下猜想</button>
          )}
        </div>
      )}

      {mode === "manual" ? (
        <div className="manual-controls">
          <div className="manual-controls__readout" aria-live="polite">
            <div>
              <span>本轮已购买</span>
              <strong>{currentPurchases}<small> 盒</small></strong>
            </div>
            <i aria-hidden="true" />
            <div>
              <span>已经收集</span>
              <strong>{distinctCount}<small> / 6 款</small></strong>
            </div>
          </div>
          {theoryUnlocked ? (
            <div className="probability-ladder" aria-label={`下一盒获得新款的概率为 ${(6 - distinctCount)}/6`}>
              <span>下一盒获得新款概率</span>
              <div className="probability-ladder__track" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <i key={index} className={index < 6 - distinctCount ? "is-on" : ""} />
                ))}
              </div>
              <strong>{6 - distinctCount}/6</strong>
            </div>
          ) : (
            <div className="probability-ladder probability-ladder--locked" aria-label="阶段概率尚未揭示">
              <span>阶段概率保持隐藏</span>
              <strong aria-hidden="true">?</strong>
            </div>
          )}
          <button
            type="button"
            className="primary-command primary-command--manual"
            onClick={onOpenOne}
            disabled={disabled || manualBusy || !hypothesisLocked}
          >
            <span className="primary-command__shine" aria-hidden="true" />
            <span className="primary-command__symbol" aria-hidden="true">?</span>
            <span>
              <strong>{!hypothesisLocked ? "请先锁定猜想" : manualBusy ? "盲盒开启中…" : distinctCount >= 6 ? "开始下一轮" : "购买并打开一盒"}</strong>
              <small>{!hypothesisLocked ? "进入发现模式填写后即可实验" : distinctCount >= 6 ? "清空收藏架，继续进行实验" : "每次抽取相互独立"}</small>
            </span>
          </button>
        </div>
      ) : (
        <div className="batch-controls">
          <div className="field-block">
            <div className="field-block__label">
              <label htmlFor="batch-rounds">实验轮数</label>
              <span>每轮从空收藏开始</span>
            </div>
            <div className="number-field">
              <button
                type="button"
                onClick={() => onBatchRoundsChange(Math.max(1, safeRounds - 10))}
                disabled={setupLocked || safeRounds <= 1}
                aria-label="减少十轮"
              >−</button>
              <input
                id="batch-rounds"
                type="number"
                min="1"
                max="1000"
                value={batchRounds}
                disabled={setupLocked}
                onChange={(event) => onBatchRoundsChange(Math.min(1000, Math.max(1, Number(event.target.value) || 1)))}
              />
              <span>轮</span>
              <button
                type="button"
                onClick={() => onBatchRoundsChange(Math.min(1000, safeRounds + 10))}
                disabled={setupLocked || safeRounds >= 1000}
                aria-label="增加十轮"
              >＋</button>
            </div>
            <div className="preset-row" aria-label="常用实验轮数">
              {ROUND_PRESETS.map((rounds) => (
                <button
                  key={rounds}
                  type="button"
                  className={safeRounds === rounds ? "is-active" : ""}
                  onClick={() => onBatchRoundsChange(rounds)}
                  disabled={setupLocked}
                  aria-pressed={safeRounds === rounds}
                >{rounds}</button>
              ))}
            </div>
          </div>

          <div className="batch-controls__row">
            <label className="compact-field">
              <span>随机种子</span>
              <input
                type="number"
                value={seed}
                disabled={setupLocked}
                onChange={(event) => onSeedChange(Math.trunc(Number(event.target.value) || 0))}
              />
            </label>
            <fieldset className="speed-field" disabled={experimentActive}>
              <legend>演示速度</legend>
              <div>
                {(["observe", "fast", "turbo"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={speed === value ? "is-active" : ""}
                    onClick={() => onSpeedChange(value)}
                    aria-pressed={speed === value}
                  >{value === "observe" ? "观察" : value === "fast" ? "快速" : "极速"}</button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="batch-command-row">
            {!batchRunning && !batchPaused && (
              <button
                type="button"
                className="primary-command primary-command--batch"
                onClick={onStartBatch}
                disabled={disabled || configurationLocked || !hypothesisLocked}
              >
                <span className="primary-command__shine" aria-hidden="true" />
                <span className="primary-command__play" aria-hidden="true" />
                <span>
                  <strong>{!hypothesisLocked ? "请先锁定猜想" : configurationLocked ? "请先新建实验" : `开始 ${safeRounds} 轮实验`}</strong>
                  <small>{!hypothesisLocked ? "批量参数可先配置" : configurationLocked ? "当前结果与种子已锁定" : "逐轮同步记录完整数据"}</small>
                </span>
              </button>
            )}
            {batchRunning && (
              <>
                <button type="button" className="primary-command primary-command--batch" onClick={onPause}>
                  <span className="primary-command__pause" aria-hidden="true" />
                  <span><strong>暂停实验</strong><small>已完成的数据不会丢失</small></span>
                </button>
                <button type="button" className="secondary-command" onClick={onStop}>结束</button>
              </>
            )}
            {batchPaused && (
              <>
                <button type="button" className="primary-command primary-command--batch" onClick={onResume}>
                  <span className="primary-command__play" aria-hidden="true" />
                  <span><strong>继续实验</strong><small>从暂停位置继续运行</small></span>
                </button>
                <button type="button" className="secondary-command" onClick={onStop}>结束</button>
              </>
            )}
          </div>
        </div>
      )}

      <footer className="controls-panel__footnote">
        <span aria-hidden="true">i</span>
        <p><strong>六神兽等概率模型</strong>：每款概率 1/6，抽取后放回；一轮从 0 款开始，直到集齐 A～F。</p>
      </footer>
    </section>
  )
}
