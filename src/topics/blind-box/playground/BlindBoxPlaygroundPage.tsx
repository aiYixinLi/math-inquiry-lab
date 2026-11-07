import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  BlindBoxStage,
  CollectionShelf,
  DiscoveryDialog,
  ExperimentControls,
  ExperimentUtilityActions,
  LabLayout,
  ReplayPanel,
  RoundMatrix,
  StatsPanel,
} from "../../../components"
import { TopicShell } from "../../../app/layouts"
import {
  DotNetRandom,
  createActiveRound,
  drawNext,
  replaySnapshot,
  simulateRounds,
  summarizeRounds,
  toRoundResult,
} from "../../../core"
import {
  canUnlockTheory,
  downloadDetailCsv,
  downloadJson,
  downloadSummaryCsv,
  LabAudioEngine,
  normalizeDiscoveryState,
} from "../../../lib"
import {
  STYLE_IDS,
  type ActiveRound,
  type DiscoveryState,
  type ExperimentMode,
  type ExperimentSession,
  type ExperimentStatus,
  type RoundResult,
  type StyleId,
  type TheoryUnlockMethod,
} from "../../../types"
import { setModuleProgress } from "../../../shared/progress"
// 以内联方式引入批量模拟 Worker：产物不再依赖独立的 worker 文件 URL，
// 因此单文件构建、file:// 直接打开等场景下批量实验同样可用。
import SimulationWorker from "../../../workers/simulation.worker.ts?worker&inline"
import {
  clearBlindBoxSession,
  loadBlindBoxSession,
  saveBlindBoxSession,
} from "./data"

type SimulationSpeed = "observe" | "fast" | "turbo"

interface BatchSpeedProfile {
  batchSize: number
  delayMs: number
}

// Keep visible progress updates long enough for the result and collection
// animations to settle. Turbo remains the calculation-first option.
export const BATCH_SPEED_PROFILES = {
  observe: { batchSize: 1, delayMs: 600 },
  fast: { batchSize: 5, delayMs: 500 },
  turbo: { batchSize: 25, delayMs: 120 },
} as const satisfies Record<SimulationSpeed, BatchSpeedProfile>

type WorkerOutput =
  | {
      type: "progress"
      runId: string
      batch: RoundResult[]
      completedRounds: number
    }
  | {
      type: "complete"
      runId: string
      rounds: RoundResult[]
    }
  | { type: "paused" | "resumed" | "cancelled"; runId: string }
  | { type: "error"; runId: string; message: string }

const makeSeed = () => {
  const value = Date.now() % 2_147_483_646
  return Math.max(1, value)
}

const toActiveRound = (round: RoundResult): ActiveRound => ({
  roundIndex: round.roundIndex,
  sequence: [...round.sequence],
  events: [...round.events],
  countsByStyle: [...round.countsByStyle],
  collected: [...STYLE_IDS],
  missing: [],
  stageWaits: [...round.stageWaits],
  stageStartedAt: round.totalPurchases,
  completed: true,
})

const createSessionId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  'session-' + Date.now() + '-' + Math.random().toString(16).slice(2)

const announceDuration = 2600
const createDiscoveryState = (): DiscoveryState => ({
  theoryUnlocked: false,
})

export default function BlindBoxPlaygroundPage() {
  const initialSeed = useMemo(makeSeed, [])
  const [mode, setMode] = useState<ExperimentMode>("manual")
  const [status, setStatus] = useState<ExperimentStatus>("idle")
  const [batchRounds, setBatchRounds] = useState(100)
  const [seed, setSeed] = useState(initialSeed)
  const [speed, setSpeed] = useState<SimulationSpeed>("fast")
  const [rounds, setRounds] = useState<RoundResult[]>([])
  const [activeRound, setActiveRound] = useState<ActiveRound>(() =>
    createActiveRound(1),
  )
  const [selectedRoundIndex, setSelectedRoundIndex] = useState<number>()
  const [replayStep, setReplayStep] = useState(0)
  const [isReplayPlaying, setIsReplayPlaying] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [notice, setNotice] = useState("")
  const [hydrated, setHydrated] = useState(false)
  const [endedAt, setEndedAt] = useState<string>()
  const [discovery, setDiscovery] = useState<DiscoveryState>(createDiscoveryState)
  const [discoveryOpen, setDiscoveryOpen] = useState(false)

  const rngRef = useRef(new DotNetRandom(initialSeed))
  const workerRef = useRef<Worker | null>(null)
  const runIdRef = useRef("")
  const sessionMetaRef = useRef({
    id: createSessionId(),
    startedAt: new Date().toISOString(),
  })
  const openingTimerRef = useRef<number | undefined>(undefined)
  const openingLockRef = useRef(false)
  const noticeTimerRef = useRef<number | undefined>(undefined)
  const hydrationStartedRef = useRef(false)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const audioEngineRef = useRef<LabAudioEngine | null>(null)

  const summary = useMemo(() => summarizeRounds(rounds), [rounds])
  const hypothesisLocked = Boolean(discovery.hypothesis)
  const theoryUnlocked = discovery.theoryUnlocked === true
  const selectedRound = useMemo(
    () => rounds.find((round) => round.roundIndex === selectedRoundIndex),
    [rounds, selectedRoundIndex],
  )
  const lastEvent = activeRound.events.at(-1)

  const session = useMemo<ExperimentSession>(
    () => ({
      id: sessionMetaRef.current.id,
      mode,
      plannedRounds: mode === "batch" ? batchRounds : 0,
      completedRounds: rounds.length,
      seed,
      randomAlgorithm: "System.Random-compatible",
      randomAlgorithmVersion: "1",
      status,
      startedAt: sessionMetaRef.current.startedAt,
      endedAt,
      rounds,
      activeRound:
        mode === "manual" &&
        activeRound.sequence.length > 0 &&
        !activeRound.completed
          ? activeRound
          : undefined,
      summary,
      discovery,
    }),
    [
      activeRound,
      batchRounds,
      discovery,
      endedAt,
      mode,
      rounds,
      seed,
      status,
      summary,
    ],
  )

  const showNotice = useCallback((message: string) => {
    window.clearTimeout(noticeTimerRef.current)
    setNotice(message)
    noticeTimerRef.current = window.setTimeout(
      () => setNotice(""),
      announceDuration,
    )
  }, [])

  const persistSession = useCallback((snapshot: ExperimentSession) => {
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveBlindBoxSession(snapshot))
  }, [])

  const closeExportMenu = useCallback(() => {
    document
      .querySelector<HTMLButtonElement>('[aria-controls="export-menu"]')
      ?.focus()
    setExportOpen(false)
  }, [])

  const openDiscovery = useCallback(() => setDiscoveryOpen(true), [])
  const closeDiscovery = useCallback(() => setDiscoveryOpen(false), [])

  const playTone = useCallback((kind: "new" | "repeat" | "complete") => {
    void audioEngineRef.current?.play(kind)
  }, [])

  const resetSession = useCallback(
    (
      nextMode: ExperimentMode = mode,
      nextSeed: number = seed,
      nextBatchRounds: number = batchRounds,
      nextDiscovery: DiscoveryState = discovery,
    ) => {
      workerRef.current?.terminate()
      workerRef.current = null
      runIdRef.current = ""
      window.clearTimeout(openingTimerRef.current)
      openingLockRef.current = false
      sessionMetaRef.current = {
        id: createSessionId(),
        startedAt: new Date().toISOString(),
      }
      rngRef.current = new DotNetRandom(nextSeed)
      setMode(nextMode)
      setSeed(nextSeed)
      setBatchRounds(nextBatchRounds)
      setRounds([])
      setActiveRound(createActiveRound(1))
      setSelectedRoundIndex(undefined)
      setReplayStep(0)
      setIsReplayPlaying(false)
      setStatus("idle")
      setEndedAt(undefined)
      setExportOpen(false)
      setDiscovery(normalizeDiscoveryState(nextDiscovery, 0))
      setDiscoveryOpen(false)
    },
    [batchRounds, discovery, mode, seed],
  )

  useEffect(() => {
    if (hydrationStartedRef.current) return
    hydrationStartedRef.current = true
    void loadBlindBoxSession()
      .then((saved) => {
        if (!saved) return
        const savedActiveRound =
          saved.mode === "manual" &&
          saved.activeRound &&
          saved.activeRound.sequence.length > 0
            ? saved.activeRound
            : undefined
        if (
          !saved.rounds.length &&
          !savedActiveRound &&
          !saved.discovery?.hypothesis
        ) return
        const restoredStatus: ExperimentStatus =
          saved.status === "running" || saved.status === "paused"
            ? "cancelled"
            : saved.status === "opening" ||
                (saved.mode === "manual" && saved.status === "completed")
              ? "idle"
            : saved.status
        sessionMetaRef.current = {
          id: saved.id,
          startedAt: saved.startedAt,
        }
        setMode(saved.mode)
        setSeed(saved.seed)
        setBatchRounds(saved.plannedRounds || 100)
        setRounds(saved.rounds)
        setDiscovery(normalizeDiscoveryState(saved.discovery, saved.rounds.length))
        setStatus(restoredStatus)
        setEndedAt(
          restoredStatus === "cancelled"
            ? saved.endedAt ?? new Date().toISOString()
            : saved.endedAt,
        )
        const restoredRandom = new DotNetRandom(saved.seed)
        for (const round of saved.rounds) {
          for (let index = 0; index < round.totalPurchases; index += 1) {
            restoredRandom.next(1, 7)
          }
        }
        if (savedActiveRound) {
          for (let index = 0; index < savedActiveRound.sequence.length; index += 1) {
            restoredRandom.next(1, 7)
          }
        }
        rngRef.current = restoredRandom
        const last = saved.rounds.at(-1)
        if (saved.mode === "manual") {
          setActiveRound(
            savedActiveRound ?? createActiveRound(saved.rounds.length + 1),
          )
          setSelectedRoundIndex(undefined)
          setReplayStep(0)
        } else if (last) {
          setActiveRound(toActiveRound(last))
          setSelectedRoundIndex(last.roundIndex)
          setReplayStep(last.totalPurchases)
        }
        showNotice("已恢复上次实验记录")
      })
      .catch(() => {
        showNotice("本地记录未能恢复，已开始新实验")
      })
      .finally(() => setHydrated(true))
  }, [showNotice])

  useEffect(() => {
    setModuleProgress("blind-box", "playground", "in-progress")
  }, [])

  useEffect(() => {
    if (rounds.length > 0) {
      setModuleProgress("blind-box", "playground", "completed")
    }
  }, [rounds.length])

  useEffect(() => {
    if (!hydrated) return
    persistSession(session)
  }, [hydrated, persistSession, session])

  useEffect(() => {
    if (!exportOpen) return

    const firstButton = exportMenuRef.current?.querySelector<HTMLButtonElement>(
      "button",
    )
    firstButton?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeExportMenu()
        return
      }

      if (event.key === "Tab") {
        const buttons = [
          ...(exportMenuRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) ?? []),
        ]
        const first = buttons[0]
        const last = buttons.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [closeExportMenu, exportOpen])

  useEffect(() => {
    if (!isReplayPlaying || !selectedRound) return
    if (replayStep >= selectedRound.totalPurchases) {
      setIsReplayPlaying(false)
      return
    }
    const interval = window.setInterval(() => {
      setReplayStep((current) => {
        if (current >= selectedRound.totalPurchases) {
          setIsReplayPlaying(false)
          return current
        }
        return current + 1
      })
    }, speed === "observe" ? 620 : speed === "fast" ? 300 : 120)
    return () => window.clearInterval(interval)
  }, [isReplayPlaying, replayStep, selectedRound, speed])

  useEffect(() => {
    const audioEngine = new LabAudioEngine()
    audioEngineRef.current = audioEngine
    return () => {
      workerRef.current?.terminate()
      window.clearTimeout(openingTimerRef.current)
      window.clearTimeout(noticeTimerRef.current)
      audioEngine.dispose()
      if (audioEngineRef.current === audioEngine) {
        audioEngineRef.current = null
      }
    }
  }, [])

  const handleOpenOne = useCallback(() => {
    if (!discovery.hypothesis) {
      openDiscovery()
      showNotice("请先写下并锁定猜想，再开始实验")
      return
    }

    if (
      mode !== "manual" ||
      !hydrated ||
      openingLockRef.current ||
      status === "opening" ||
      status === "running"
    ) {
      return
    }

    if (activeRound.completed) {
      setActiveRound(createActiveRound(rounds.length + 1))
      setStatus("idle")
      setEndedAt(undefined)
      setSelectedRoundIndex(undefined)
      setReplayStep(0)
      showNotice("新一轮已准备好")
      return
    }

    void audioEngineRef.current?.play("opening")

    setSelectedRoundIndex(undefined)
    setReplayStep(0)
    setIsReplayPlaying(false)
    setEndedAt(undefined)
    openingLockRef.current = true
    setStatus("opening")
    openingTimerRef.current = window.setTimeout(() => {
      const styleId = rngRef.current.next(1, 7) as StyleId
      const nextRound = drawNext(activeRound, styleId)
      const event = nextRound.events.at(-1)
      setActiveRound(nextRound)
      if (nextRound.completed) {
        const result = toRoundResult(nextRound)
        setRounds((current) => [...current, result])
        setSelectedRoundIndex(result.roundIndex)
        setReplayStep(result.totalPurchases)
        setStatus("completed")
        setEndedAt(new Date().toISOString())
        playTone("complete")
        showNotice(
          '第 ' + result.roundIndex + ' 轮集齐！共购买 ' + result.totalPurchases + ' 盒',
        )
      } else {
        setStatus("idle")
        playTone(event?.isNew ? "new" : "repeat")
      }
      openingLockRef.current = false
    }, speed === "observe" ? 820 : 620)
  }, [
    activeRound,
    discovery.hypothesis,
    hydrated,
    mode,
    openDiscovery,
    playTone,
    rounds.length,
    showNotice,
    speed,
    status,
  ])

  const handleWorkerMessage = useCallback(
    (event: MessageEvent<WorkerOutput>) => {
      const message = event.data
      if (!message || message.runId !== runIdRef.current) return

      if (message.type === "progress") {
        setRounds((current) => {
          const byRound = new Map(
            current.map((round) => [round.roundIndex, round]),
          )
          for (const round of message.batch) {
            byRound.set(round.roundIndex, round)
          }
          return [...byRound.values()].sort(
            (left, right) => left.roundIndex - right.roundIndex,
          )
        })
        const latest = message.batch.at(-1)
        if (latest) {
          setActiveRound(toActiveRound(latest))
          setSelectedRoundIndex(latest.roundIndex)
          setReplayStep(latest.totalPurchases)
        }
        return
      }

      if (message.type === "complete") {
        setRounds(message.rounds)
        const latest = message.rounds.at(-1)
        if (latest) {
          setActiveRound(toActiveRound(latest))
          setSelectedRoundIndex(latest.roundIndex)
          setReplayStep(latest.totalPurchases)
        }
        setStatus("completed")
        setEndedAt(new Date().toISOString())
        playTone("complete")
        showNotice('批量实验完成：共 ' + message.rounds.length + ' 轮')
        workerRef.current?.terminate()
        workerRef.current = null
        return
      }

      if (message.type === "paused") {
        setStatus("paused")
        return
      }

      if (message.type === "resumed") {
        setStatus("running")
        return
      }

      if (message.type === "cancelled") {
        setStatus("cancelled")
        setEndedAt(new Date().toISOString())
        showNotice("批量实验已结束，已完成轮次仍被保留")
        workerRef.current?.terminate()
        workerRef.current = null
        return
      }

      if (message.type === "error") {
        setStatus("cancelled")
        setEndedAt(new Date().toISOString())
        showNotice('批量实验发生错误：' + message.message)
      }
    },
    [playTone, showNotice],
  )

  const handleStartBatch = useCallback(() => {
    if (!discovery.hypothesis) {
      openDiscovery()
      showNotice("请先写下并锁定猜想，再开始实验")
      return
    }
    if (mode !== "batch" || status === "running") return
    void audioEngineRef.current?.play("opening")
    const safeRounds = Math.max(1, Math.min(1000, Math.trunc(batchRounds)))
    const safeSeed = Math.max(
      -2_147_483_648,
      Math.min(2_147_483_647, Math.trunc(seed)),
    )
    resetSession("batch", safeSeed, safeRounds)
    setStatus("running")
    const runId = createSessionId()
    runIdRef.current = runId
    const { batchSize, delayMs } = BATCH_SPEED_PROFILES[speed]

    if (typeof Worker === "undefined") {
      const results = simulateRounds(safeRounds, safeSeed)
      setRounds(results)
      const latest = results.at(-1)
      if (latest) {
        setActiveRound(toActiveRound(latest))
        setSelectedRoundIndex(latest.roundIndex)
        setReplayStep(latest.totalPurchases)
      }
      setStatus("completed")
      setEndedAt(new Date().toISOString())
      playTone("complete")
      showNotice('批量实验完成：共 ' + results.length + ' 轮')
      return
    }

    const worker = new SimulationWorker()
    workerRef.current = worker
    worker.addEventListener("message", handleWorkerMessage)
    worker.addEventListener("error", () => {
      setStatus("cancelled")
      setEndedAt(new Date().toISOString())
      showNotice("批量计算未能启动，请重试")
    })
    worker.postMessage({
      type: "start",
      runId,
      rounds: safeRounds,
      seed: safeSeed,
      batchSize,
      delayMs,
    })
  }, [
    batchRounds,
    discovery.hypothesis,
    handleWorkerMessage,
    mode,
    openDiscovery,
    playTone,
    resetSession,
    seed,
    showNotice,
    speed,
    status,
  ])

  const handlePause = useCallback(() => {
    if (!workerRef.current || !runIdRef.current) return
    workerRef.current.postMessage({
      type: "pause",
      runId: runIdRef.current,
    })
  }, [])

  const handleResume = useCallback(() => {
    if (!workerRef.current || !runIdRef.current) return
    workerRef.current.postMessage({
      type: "resume",
      runId: runIdRef.current,
    })
  }, [])

  const handleStop = useCallback(() => {
    if (!workerRef.current || !runIdRef.current) {
      setStatus("cancelled")
      setEndedAt(new Date().toISOString())
      return
    }
    workerRef.current.postMessage({
      type: "cancel",
      runId: runIdRef.current,
    })
  }, [])

  const handleModeChange = useCallback(
    (nextMode: ExperimentMode) => {
      if (nextMode === mode) return
      if (
        (rounds.length > 0 || activeRound.sequence.length > 0) &&
        !window.confirm("切换模式将开始一个新实验，当前数据仍可先导出。继续吗？")
      ) {
        return
      }
      resetSession(nextMode, seed, batchRounds)
    },
    [
      activeRound.sequence.length,
      batchRounds,
      mode,
      resetSession,
      rounds.length,
      seed,
    ],
  )

  const handleSeedChange = useCallback(
    (value: number) => {
      const nextSeed = Number.isFinite(value) ? Math.trunc(value) : makeSeed()
      setSeed(nextSeed)
      if (!rounds.length && !activeRound.sequence.length) {
        rngRef.current = new DotNetRandom(nextSeed)
      }
    },
    [activeRound.sequence.length, rounds.length],
  )

  const handleReset = useCallback(() => {
    if (
      (rounds.length > 0 ||
        activeRound.sequence.length > 0 ||
        Boolean(discovery.hypothesis)) &&
      !window.confirm("确定开始全新的研究吗？实验数据、学生猜想和理论解锁状态都会清除。")
    ) {
      return
    }
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => clearBlindBoxSession())
    resetSession(mode, makeSeed(), batchRounds, createDiscoveryState())
    showNotice("新的发现研究已经准备好")
  }, [
    activeRound.sequence.length,
    batchRounds,
    discovery.hypothesis,
    mode,
    resetSession,
    rounds.length,
    showNotice,
  ])

  const handleSubmitHypothesis = useCallback(
    (meanPurchases: number, reason: string) => {
      setDiscovery({
        hypothesis: {
          meanPurchases,
          reason,
          submittedAt: new Date().toISOString(),
          completedRoundsAtSubmission: rounds.length,
        },
        theoryUnlocked: false,
      })
      showNotice("学生猜想已保存，理论答案继续隐藏")
    },
    [rounds.length, showNotice],
  )

  const handleUnlockTheory = useCallback(
    (method: TheoryUnlockMethod) => {
      if (!canUnlockTheory(discovery, rounds.length)) {
        showNotice("请在锁定猜想后至少完成 1 轮新实验")
        return
      }
      setDiscovery((current) => {
        if (!canUnlockTheory(current, rounds.length)) return current
        return {
          ...current,
          theoryUnlocked: true,
          theoryUnlockedAt: new Date().toISOString(),
          theoryUnlockMethod: method,
        }
      })
      showNotice(method === "teacher" ? "教师已揭示理论答案" : "理论答案已解锁")
    },
    [discovery, rounds.length, showNotice],
  )

  const handleToggleSound = useCallback(() => {
    const nextEnabled = !soundEnabled
    setSoundEnabled(nextEnabled)
    audioEngineRef.current?.setEnabled(nextEnabled)
  }, [soundEnabled])

  const handleSelectRound = useCallback((roundIndex: number) => {
    setSelectedRoundIndex(roundIndex)
    setIsReplayPlaying(false)
    const round = rounds.find((item) => item.roundIndex === roundIndex)
    setReplayStep(round?.totalPurchases ?? 0)
  }, [rounds])

  const handleReplayToggle = useCallback(() => {
    if (!selectedRound) return
    if (replayStep >= selectedRound.totalPurchases) {
      setReplayStep(0)
      setIsReplayPlaying(true)
      return
    }
    setIsReplayPlaying((current) => !current)
  }, [replayStep, selectedRound])

  const replayState = selectedRound
    ? replaySnapshot(selectedRound, replayStep)
    : undefined

  const hasSessionData =
    rounds.length > 0 || activeRound.sequence.length > 0

  const shelfCounts = replayState
    ? replayState.countsByStyle
    : activeRound.countsByStyle
  const shelfMissing = replayState ? replayState.missing : activeRound.missing
  const shelfEvent = replayState
    ? replayState.currentEvent
    : activeRound.events.at(-1)

  return (
    <TopicShell topicId="blind-box" module="playground">
      <LabLayout
        controls={
          <ExperimentControls
            mode={mode}
            status={status}
            batchRounds={batchRounds}
            seed={seed}
            speed={speed}
            currentPurchases={activeRound.sequence.length}
            distinctCount={activeRound.collected.length}
            completedRounds={rounds.length}
            currentRoundIndex={activeRound.roundIndex}
            disabled={!hydrated}
            hypothesisLocked={hypothesisLocked}
            theoryUnlocked={theoryUnlocked}
            configurationLocked={hasSessionData}
            utilities={(
              <ExperimentUtilityActions
                soundEnabled={soundEnabled}
                canExport={hasSessionData}
                isExportOpen={exportOpen}
                onToggleSound={handleToggleSound}
                onExport={() => setExportOpen((current) => !current)}
                onReset={handleReset}
              />
            )}
            onOpenDiscovery={openDiscovery}
            onModeChange={handleModeChange}
            onBatchRoundsChange={(value) =>
              setBatchRounds(Math.max(1, Math.min(1000, Math.trunc(value))))
            }
            onSeedChange={handleSeedChange}
            onSpeedChange={setSpeed}
            onOpenOne={handleOpenOne}
            onStartBatch={handleStartBatch}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
          />
        }
        stage={
          <BlindBoxStage
            round={activeRound}
            lastEvent={lastEvent}
            status={status}
            onOpen={handleOpenOne}
            disabled={!hydrated || !hypothesisLocked || mode !== "manual" || status === "opening"}
            hypothesisLocked={hypothesisLocked}
          />
        }
        shelf={
          <CollectionShelf
            countsByStyle={shelfCounts}
            missing={shelfMissing}
            lastEvent={shelfEvent}
            theoryUnlocked={theoryUnlocked}
          />
        }
        stats={
          <StatsPanel
            summary={summary}
            plannedRounds={mode === "batch" ? batchRounds : 0}
            discovery={discovery}
            onOpenDiscovery={openDiscovery}
          />
        }
        matrix={
          <RoundMatrix
            rounds={rounds}
            plannedRounds={mode === "batch" ? batchRounds : Math.max(10, rounds.length)}
            selectedRoundIndex={selectedRoundIndex}
            onSelectRound={handleSelectRound}
          />
        }
        replay={
          <ReplayPanel
            round={selectedRound ?? null}
            step={replayStep}
            isPlaying={isReplayPlaying}
            theoryUnlocked={theoryUnlocked}
            onStepChange={(value) => {
              setIsReplayPlaying(false)
              setReplayStep(value)
            }}
            onTogglePlaying={handleReplayToggle}
            onClose={() => {
              setSelectedRoundIndex(undefined)
              setReplayStep(0)
              setIsReplayPlaying(false)
            }}
          />
        }
      />

      <DiscoveryDialog
        open={discoveryOpen}
        discovery={discovery}
        completedRounds={rounds.length}
        experimentMean={summary.meanPurchases}
        onSubmitHypothesis={handleSubmitHypothesis}
        onUnlockTheory={handleUnlockTheory}
        onClose={closeDiscovery}
      />

      {exportOpen && hasSessionData && (
        <div
          id="export-menu"
          ref={exportMenuRef}
          className="export-menu"
          role="dialog"
          aria-modal="true"
          aria-label="导出实验数据"
        >
          <strong>导出实验数据</strong>
          <button
            type="button"
            onClick={() => {
              downloadSummaryCsv(session)
              closeExportMenu()
            }}
          >
            轮次汇总 CSV
          </button>
          <button
            type="button"
            onClick={() => {
              downloadDetailCsv(session)
              closeExportMenu()
            }}
          >
            逐次明细 CSV
          </button>
          <button
            type="button"
            onClick={() => {
              downloadJson(session)
              closeExportMenu()
            }}
          >
            完整记录 JSON
          </button>
          <button
            type="button"
            className="export-close"
            onClick={closeExportMenu}
          >
            取消
          </button>
        </div>
      )}

      {notice && (
        <div className="lab-toast" role="status" aria-live="polite">
          {notice}
        </div>
      )}
    </TopicShell>
  )
}
