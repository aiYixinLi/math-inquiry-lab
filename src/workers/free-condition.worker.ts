/// <reference lib="webworker" />

// “自由提条件”的计算放在 Worker 里：平均盒数很大时模拟要一两秒，不能卡住界面。
import { evaluateFreeCondition } from "../core/blindbox"
import type { FreeConditionWorkerRequest, FreeConditionWorkerResponse } from "./protocol"

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.addEventListener("message", (event: MessageEvent<FreeConditionWorkerRequest>) => {
  const { id, setup, sample } = event.data
  let message: FreeConditionWorkerResponse
  try {
    message = { id, ok: true, report: evaluateFreeCondition(setup, sample) }
  } catch (error: unknown) {
    message = { id, ok: false, message: error instanceof Error ? error.message : String(error) }
  }
  workerScope.postMessage(message)
})
