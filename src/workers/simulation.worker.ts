/// <reference lib="webworker" />

import {
  DotNetRandom,
  simulateRound,
  summarizeRounds,
} from "../core"
import type { RoundResult } from "../types"
import type {
  SimulationWorkerRequest,
  SimulationWorkerResponse,
  StartWorkerMessage,
} from "./protocol"

interface ActiveTask {
  runId: string
  plannedRounds: number
  batchSize: number
  delayMs: number
  random: DotNetRandom
  results: RoundResult[]
  state: "running" | "paused" | "cancelled"
}

const workerScope = self as DedicatedWorkerGlobalScope
let activeTask: ActiveTask | undefined

workerScope.addEventListener(
  "message",
  (event: MessageEvent<SimulationWorkerRequest>) => {
    const message = event.data

    switch (message.type) {
      case "start":
        start(message)
        break
      case "pause":
        pause(message.runId)
        break
      case "resume":
        resume(message.runId)
        break
      case "cancel":
        cancel(message.runId)
        break
    }
  },
)

function start(message: StartWorkerMessage): void {
  try {
    validateStartMessage(message)

    if (activeTask !== undefined) {
      activeTask.state = "cancelled"
    }

    const task: ActiveTask = {
      runId: message.runId,
      plannedRounds: message.rounds,
      batchSize: normalizeBatchSize(message.batchSize),
      delayMs: normalizeDelay(message.delayMs),
      random: new DotNetRandom(message.seed),
      results: [],
      state: "running",
    }

    activeTask = task
    void execute(task)
  } catch (error) {
    post({
      type: "error",
      runId: message.runId,
      message: errorMessage(error),
    })
  }
}

function pause(runId: string): void {
  const task = matchingTask(runId)

  if (task === undefined || task.state !== "running") {
    return
  }

  task.state = "paused"
  post({
    type: "paused",
    runId,
    completedRounds: task.results.length,
    plannedRounds: task.plannedRounds,
  })
}

function resume(runId: string): void {
  const task = matchingTask(runId)

  if (task === undefined || task.state !== "paused") {
    return
  }

  task.state = "running"
  post({
    type: "resumed",
    runId,
    completedRounds: task.results.length,
    plannedRounds: task.plannedRounds,
  })
}

function cancel(runId: string): void {
  const task = matchingTask(runId)

  if (task !== undefined) {
    task.state = "cancelled"
  }
}

async function execute(task: ActiveTask): Promise<void> {
  try {
    while (task.results.length < task.plannedRounds) {
      while (task.state === "paused") {
        await yieldToWorkerQueue(40)
      }

      if (task.state === "cancelled") {
        postCancelled(task)
        clearIfActive(task)
        return
      }

      const remaining = task.plannedRounds - task.results.length
      const count = Math.min(task.batchSize, remaining)
      const batch: RoundResult[] = []

      for (let offset = 0; offset < count; offset += 1) {
        const roundIndex = task.results.length + 1
        const result = simulateRound(task.random, roundIndex)
        task.results.push(result)
        batch.push(result)
      }

      post({
        type: "progress",
        runId: task.runId,
        completedRounds: task.results.length,
        plannedRounds: task.plannedRounds,
        batch,
        rounds: [...task.results],
        summary: summarizeRounds(task.results),
      })

      await yieldToWorkerQueue(task.delayMs)
    }

    if (task.state === "cancelled") {
      postCancelled(task)
    } else {
      post({
        type: "complete",
        runId: task.runId,
        completedRounds: task.results.length,
        plannedRounds: task.plannedRounds,
        rounds: [...task.results],
        summary: summarizeRounds(task.results),
      })
    }
  } catch (error) {
    post({
      type: "error",
      runId: task.runId,
      message: errorMessage(error),
    })
  } finally {
    clearIfActive(task)
  }
}

function postCancelled(task: ActiveTask): void {
  post({
    type: "cancelled",
    runId: task.runId,
    completedRounds: task.results.length,
    plannedRounds: task.plannedRounds,
    rounds: [...task.results],
    summary: summarizeRounds(task.results),
  })
}

function post(message: SimulationWorkerResponse): void {
  workerScope.postMessage(message)
}

function matchingTask(runId: string): ActiveTask | undefined {
  return activeTask?.runId === runId ? activeTask : undefined
}

function clearIfActive(task: ActiveTask): void {
  if (activeTask === task) {
    activeTask = undefined
  }
}

function validateStartMessage(message: StartWorkerMessage): void {
  if (message.runId.trim() === "") {
    throw new RangeError("runId must not be empty")
  }

  if (!Number.isInteger(message.rounds) || message.rounds < 1) {
    throw new RangeError("rounds must be a positive integer")
  }
}

function normalizeBatchSize(batchSize: number | undefined): number {
  if (batchSize === undefined) {
    return 10
  }

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError("batchSize must be a positive integer")
  }

  return Math.min(batchSize, 1_000)
}

function normalizeDelay(delayMs: number | undefined): number {
  if (delayMs === undefined) {
    return 0
  }

  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new RangeError("delayMs must be a non-negative number")
  }

  return Math.min(Math.trunc(delayMs), 1_000)
}

function yieldToWorkerQueue(delayMs = 0): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
