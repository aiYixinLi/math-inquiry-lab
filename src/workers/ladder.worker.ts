/// <reference lib="webworker" />

// 建模阶梯的模拟实验和三道检验放在 Worker 里，免得一万轮模拟卡住界面。
import { handleLadderRequest } from "./ladder-handler"
import type { LadderWorkerRequest } from "./protocol"

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.addEventListener("message", (event: MessageEvent<LadderWorkerRequest>) => {
  workerScope.postMessage(handleLadderRequest(event.data))
})
