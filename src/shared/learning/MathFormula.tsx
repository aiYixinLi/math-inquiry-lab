import { useId } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import { MathText } from "./MathText"
import type { LearningInlineMath, LearningTheoryFormula } from "./types"

interface MathFormulaProps {
  readonly formula: LearningTheoryFormula
  readonly inlineMath?: readonly LearningInlineMath[]
}

export function MathFormula({ formula, inlineMath }: MathFormulaProps) {
  const explanationId = useId()
  const formalId = `${explanationId}-formal`
  const intuitiveId = `${explanationId}-intuitive`
  const markup = katex.renderToString(formula.latex, {
    displayMode: true,
    output: "htmlAndMathml",
    throwOnError: false,
    strict: "ignore",
    trust: false,
  })

  return (
    <figure className="learning-formula-group">
      <div
        className="learning-formula"
        role="math"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.stopPropagation()
          }
        }}
        aria-label={formula.plain}
        aria-describedby={formula.explanation ? `${formalId} ${intuitiveId}` : undefined}
        data-formula-source={formula.latex}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      {formula.explanation && (
        <figcaption className="learning-formula-explanations">
          <dl>
            <div data-explanation-kind="formal">
              <dt><i aria-hidden="true">∀</i><span>形式化表述<small>FORMAL</small></span></dt>
              <dd id={formalId}>
                <MathText text={formula.explanation.formal} inlineMath={inlineMath} />
              </dd>
            </div>
            <div data-explanation-kind="intuitive">
              <dt><i aria-hidden="true">↔</i><span>直观理解<small>INTUITION</small></span></dt>
              <dd id={intuitiveId}>
                <MathText text={formula.explanation.intuitive} inlineMath={inlineMath} />
              </dd>
            </div>
          </dl>
        </figcaption>
      )}
    </figure>
  )
}
