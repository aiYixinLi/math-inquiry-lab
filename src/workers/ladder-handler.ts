// 建模阶梯的计算请求：Worker 里调用；测试环境没有 Worker 时界面在主线程直接调用。
import { freeConditionChecks, runExperiment, runUnknownKindsExperiment } from "../core/blindbox"
import type { LadderWorkerRequest, LadderWorkerResponse } from "./protocol"

export function handleLadderRequest(request: LadderWorkerRequest): LadderWorkerResponse {
  const { id } = request
  try {
    if (request.op === "experiment") {
      const { params, runs, seed, withinDraws, fixedDraws } = request
      const result =
        fixedDraws === null
          ? runExperiment(params, { runs, seed, withinDraws })
          : runUnknownKindsExperiment(params, { runs, seed, draws: fixedDraws })
      return { id, ok: true, op: "experiment", result }
    }
    return { id, ok: true, op: "checks", checks: freeConditionChecks(request.setup) }
  } catch (error: unknown) {
    return { id, ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
