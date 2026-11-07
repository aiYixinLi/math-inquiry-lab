// 浏览器访问条件翻译器的唯一入口，这里不含任何密钥。
// 改编自 StereometryLab 的 packages/tutor/src/index.ts。
// 请求发往同源的 /api/translator：开发时由 vite.config.ts 代理到 agent/ 的翻译服务。
// 单文件版（双击打开）没有服务端，调用会以 "network" 失败，界面应退回本地流程。

export type AssumptionId = "A1" | "A2" | "A3" | "A4" | "A5" | "A6"
/** parameter-only：只把理想模型里的数字换了（例如一共 12 款、仍然等可能），没有打破任何假设。 */
export type TranslationStatus = "translated" | "parameter-only" | "clarify" | "out-of-scope"

export interface ConditionTranslation {
  readonly brokenAssumption: AssumptionId | null
  readonly parameterChanges: Readonly<Record<string, unknown>>
  readonly explanationForStudent: string
  readonly outOfScope: boolean
  readonly clarifyingQuestion: string | null
}

export interface TranslatorResult {
  readonly status: TranslationStatus
  readonly translation: ConditionTranslation
}

export interface TranslatorInfo {
  readonly provider: string
  readonly model: string
}

export type TranslatorErrorCode =
  | "unavailable"
  | "rejected"
  | "timeout"
  | "upstream"
  | "upstream-auth"
  | "invalid-request"
  | "invalid-response"
  | "network"

export class TranslatorError extends Error {
  readonly code: TranslatorErrorCode

  constructor(code: TranslatorErrorCode) {
    super(`translator-${code}`)
    this.name = "TranslatorError"
    this.code = code
  }
}

export const MAX_CONDITION_LENGTH = 300
const SERVER_ERROR_CODES: readonly TranslatorErrorCode[] = [
  "unavailable",
  "rejected",
  "timeout",
  "upstream",
  "upstream-auth",
  "invalid-request",
]

/** 翻译服务已配置模型时返回模型名和第三方接口域名，用于界面上的数据出网说明；否则返回 null。 */
export async function getTranslatorInfo(signal?: AbortSignal): Promise<TranslatorInfo | null> {
  try {
    const response = await fetch("/api/translator/info", signal ? { signal } : {})
    if (!response.ok) return null
    const data: unknown = await response.json()
    if (typeof data !== "object" || data === null) return null
    const { provider, model } = data as Record<string, unknown>
    if (typeof provider !== "string" || !/^[a-z0-9.-]{1,255}$/i.test(provider)) return null
    if (typeof model !== "string" || model.length === 0 || model.length > 120) return null
    return { provider, model }
  } catch (error: unknown) {
    if (signal?.aborted) throw error
    return null
  }
}

export async function translateCondition(text: string, signal?: AbortSignal): Promise<TranslatorResult> {
  if (text.trim().length === 0 || text.length > MAX_CONDITION_LENGTH) {
    throw new TranslatorError("invalid-request")
  }
  let response: Response
  try {
    response = await fetch("/api/translator", {
      method: "POST",
      headers: { "content-type": "application/json", "x-translator-request": "1" },
      body: JSON.stringify({ text }),
      ...(signal ? { signal } : {}),
    })
  } catch (error: unknown) {
    if (signal?.aborted) throw error
    throw new TranslatorError("network")
  }
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const code = (data as Record<string, unknown> | null)?.error
    throw new TranslatorError(
      SERVER_ERROR_CODES.includes(code as TranslatorErrorCode) ? (code as TranslatorErrorCode) : "upstream",
    )
  }
  const result = parseTranslatorResult(data)
  if (!result) throw new TranslatorError("invalid-response")
  return result
}

/** 服务端已做完整校验，这里只复核形状，防止异常回复进入界面。 */
export function parseTranslatorResult(value: unknown): TranslatorResult | null {
  if (typeof value !== "object" || value === null) return null
  const { status, translation } = value as Record<string, unknown>
  if (status !== "translated" && status !== "parameter-only" && status !== "clarify" && status !== "out-of-scope") {
    return null
  }
  if (typeof translation !== "object" || translation === null) return null
  const item = translation as Record<string, unknown>
  const assumption = item.brokenAssumption
  const validAssumption =
    assumption === null || (typeof assumption === "string" && /^A[1-6]$/.test(assumption))
  if (
    !validAssumption ||
    typeof item.parameterChanges !== "object" ||
    item.parameterChanges === null ||
    Array.isArray(item.parameterChanges) ||
    typeof item.explanationForStudent !== "string" ||
    typeof item.outOfScope !== "boolean" ||
    (item.clarifyingQuestion !== null && typeof item.clarifyingQuestion !== "string")
  ) {
    return null
  }
  const expectedStatus: TranslationStatus = item.outOfScope
    ? "out-of-scope"
    : item.clarifyingQuestion !== null
      ? "clarify"
      : assumption === null
        ? "parameter-only"
        : "translated"
  if (status !== expectedStatus) return null
  return {
    status,
    translation: {
      brokenAssumption: assumption as AssumptionId | null,
      parameterChanges: item.parameterChanges as Record<string, unknown>,
      explanationForStudent: item.explanationForStudent,
      outOfScope: item.outOfScope,
      clarifyingQuestion: item.clarifyingQuestion as string | null,
    },
  }
}
