// 研究方案 7.5 的三道检验结果：按退化检验、双路验证、方向检验分组列出。
// 建模阶梯和“自由提条件”共用。

import type { CheckKind, CheckResult } from "../../core/blindbox"
import "./three-checks.css"

const CHECK_GROUPS: readonly { readonly kind: CheckKind; readonly title: string; readonly hint: string }[] = [
  { kind: "degeneracy", title: "① 退化检验", hint: "新参数取特殊值，必须退回已知的结果" },
  { kind: "dual-path", title: "② 双路验证", hint: "理论值和模拟值必须在误差范围内一致" },
  { kind: "direction", title: "③ 方向检验", hint: "参数往一个方向变，结果必须往该变的方向走" },
]

const STATUS_TEXT: Readonly<Record<CheckResult["status"], string>> = {
  passed: "通过",
  failed: "不通过",
  "no-theory": "无法检验",
}

export function summarizeChecks(checks: readonly CheckResult[]): {
  readonly passed: number
  readonly failed: number
  readonly unchecked: number
} {
  const passed = checks.filter((check) => check.status === "passed").length
  const failed = checks.filter((check) => check.status === "failed").length
  return { passed, failed, unchecked: checks.length - passed - failed }
}

export function ThreeChecks({ checks }: { readonly checks: readonly CheckResult[] }) {
  const { passed, failed, unchecked } = summarizeChecks(checks)

  return (
    <section className="three-checks" aria-label="三道检验">
      <h2>
        三道检验
        <small>{passed} 项通过{failed > 0 ? `，${failed} 项不通过` : ""}{unchecked > 0 ? `，${unchecked} 项无法检验` : ""}</small>
      </h2>
      {CHECK_GROUPS.map((group) => {
        const items = checks.filter((check) => check.kind === group.kind)
        return (
          <div key={group.kind} className="three-checks__group">
            <h3>{group.title}<small>{group.hint}</small></h3>
            {items.length === 0 ? (
              <p className="three-checks__empty">这里没有可做的这项检验。</p>
            ) : (
              <ul>
                {items.map((check) => (
                  <li key={check.name} className={`is-${check.status}`}>
                    <em>{STATUS_TEXT[check.status]}</em>
                    <strong>{check.name}</strong>
                    <small>{check.detail}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </section>
  )
}
