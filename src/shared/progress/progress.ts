import { useCallback, useSyncExternalStore } from "react"
import type { TopicId, TopicModule } from "../../app/topic-registry"

export type ModuleProgressStatus = "not-started" | "in-progress" | "completed"

export interface ModuleProgress {
  readonly status: ModuleProgressStatus
  readonly updatedAt?: string
}
export interface TopicProgress {
  readonly learn: ModuleProgress
  readonly playground: ModuleProgress
  readonly quiz: ModuleProgress
}

export type ProgressState = Readonly<Record<TopicId, TopicProgress>>

export const PROGRESS_STORAGE_KEY = "math-inquiry-lab:progress:v1"
const PROGRESS_EVENT = "math-inquiry-lab:progress-change"

const EMPTY_MODULE: ModuleProgress = { status: "not-started" }

const EMPTY_PROGRESS: ProgressState = {
  "blind-box": {
    learn: EMPTY_MODULE,
    playground: EMPTY_MODULE,
    quiz: EMPTY_MODULE,
  },
  elevator: {
    learn: EMPTY_MODULE,
    playground: EMPTY_MODULE,
    quiz: EMPTY_MODULE,
  },
  "cake-cutting": {
    learn: EMPTY_MODULE,
    playground: EMPTY_MODULE,
    quiz: EMPTY_MODULE,
  },
}

let cachedRaw: string | null | undefined
let cachedState: ProgressState = EMPTY_PROGRESS

function isStatus(value: unknown): value is ModuleProgressStatus {
  return value === "not-started" || value === "in-progress" || value === "completed"
}

function normalizeModule(value: unknown): ModuleProgress {
  if (!value || typeof value !== "object") return EMPTY_MODULE
  const candidate = value as { status?: unknown; updatedAt?: unknown }
  if (!isStatus(candidate.status)) return EMPTY_MODULE
  return {
    status: candidate.status,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined,
  }
}

function normalizeProgress(value: unknown): ProgressState {
  const source = value && typeof value === "object"
    ? value as Partial<Record<TopicId, Partial<Record<TopicModule, unknown>>>>
    : {}

  return {
    "blind-box": {
      learn: normalizeModule(source["blind-box"]?.learn),
      playground: normalizeModule(source["blind-box"]?.playground),
      quiz: normalizeModule(source["blind-box"]?.quiz),
    },
    elevator: {
      learn: normalizeModule(source.elevator?.learn),
      playground: normalizeModule(source.elevator?.playground),
      quiz: normalizeModule(source.elevator?.quiz),
    },
    "cake-cutting": {
      learn: normalizeModule(source["cake-cutting"]?.learn),
      playground: normalizeModule(source["cake-cutting"]?.playground),
      quiz: normalizeModule(source["cake-cutting"]?.quiz),
    },
  }
}

export function readProgress(): ProgressState {
  if (typeof window === "undefined") return EMPTY_PROGRESS
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY)
    if (raw === cachedRaw) return cachedState
    cachedRaw = raw
    cachedState = raw ? normalizeProgress(JSON.parse(raw)) : EMPTY_PROGRESS
    return cachedState
  } catch {
    return EMPTY_PROGRESS
  }
}

function publish(next: ProgressState): void {
  cachedState = next
  try {
    const raw = JSON.stringify(next)
    cachedRaw = raw
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, raw)
  } catch {
    cachedRaw = undefined
  }
  window.dispatchEvent(new Event(PROGRESS_EVENT))
}

export function setModuleProgress(
  topicId: TopicId,
  module: TopicModule,
  status: Exclude<ModuleProgressStatus, "not-started">,
): void {
  if (typeof window === "undefined") return
  const current = readProgress()
  if (current[topicId][module].status === "completed" && status === "in-progress") {
    return
  }
  publish({
    ...current,
    [topicId]: {
      ...current[topicId],
      [module]: { status, updatedAt: new Date().toISOString() },
    },
  })
}

export function topicStatus(progress: TopicProgress): ModuleProgressStatus {
  const values = [progress.learn.status, progress.playground.status, progress.quiz.status]
  if (values.every((status) => status === "completed")) return "completed"
  if (values.some((status) => status !== "not-started")) return "in-progress"
  return "not-started"
}

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined
  window.addEventListener(PROGRESS_EVENT, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(PROGRESS_EVENT, listener)
    window.removeEventListener("storage", listener)
  }
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, readProgress, () => EMPTY_PROGRESS)
}

export function useModuleProgress(topicId: TopicId, module: TopicModule) {
  const progress = useProgress()[topicId][module]
  const markStarted = useCallback(
    () => setModuleProgress(topicId, module, "in-progress"),
    [module, topicId],
  )
  const markCompleted = useCallback(
    () => setModuleProgress(topicId, module, "completed"),
    [module, topicId],
  )
  return { progress, markStarted, markCompleted }
}
