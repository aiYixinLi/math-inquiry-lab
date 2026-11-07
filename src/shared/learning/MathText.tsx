import { Fragment } from "react"
import katex from "katex"
import type { LearningInlineMath } from "./types"

interface MathTextProps {
  readonly text: string
  readonly inlineMath?: readonly LearningInlineMath[]
}

interface InlineMathProps {
  readonly plain: string
  readonly latex: string
}

interface Match {
  readonly expression: LearningInlineMath
  readonly index: number
}

const ASCII_WORD = /^[A-Za-z0-9]+$/u
const ASCII_WORD_CHARACTER = /[A-Za-z0-9]/u

function hasTokenBoundaries(text: string, index: number, plain: string) {
  if (!ASCII_WORD.test(plain)) return true
  const before = text[index - 1]
  const after = text[index + plain.length]
  return (!before || !ASCII_WORD_CHARACTER.test(before))
    && (!after || !ASCII_WORD_CHARACTER.test(after))
}

function findNextMatch(
  text: string,
  offset: number,
  expressions: readonly LearningInlineMath[],
): Match | undefined {
  let nearest: Match | undefined

  for (const expression of expressions) {
    let index = text.indexOf(expression.plain, offset)
    while (index >= 0 && !hasTokenBoundaries(text, index, expression.plain)) {
      index = text.indexOf(expression.plain, index + expression.plain.length)
    }
    if (index < 0) continue
    if (
      !nearest
      || index < nearest.index
      || (index === nearest.index && expression.plain.length > nearest.expression.plain.length)
    ) {
      nearest = { expression, index }
    }
  }

  return nearest
}

export function defineInlineMath(
  ...entries: readonly (readonly [plain: string, latex: string])[]
): readonly LearningInlineMath[] {
  return entries.map(([plain, latex]) => ({ plain, latex }))
}

export function InlineMath({ plain, latex }: InlineMathProps) {
  const markup = katex.renderToString(latex, {
    displayMode: false,
    output: "htmlAndMathml",
    throwOnError: false,
    strict: "ignore",
    trust: false,
  })

  return (
    <span
      className="learning-math-inline"
      role="math"
      aria-label={plain}
      data-inline-math-source={latex}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

export function MathText({ text, inlineMath = [] }: MathTextProps) {
  if (inlineMath.length === 0) return text

  const expressions = [...new Map(
    inlineMath
      .filter(({ plain }) => plain.length > 0)
      .map((expression) => [expression.plain, expression]),
  ).values()]
  const content = []
  let offset = 0
  let mathIndex = 0

  while (offset < text.length) {
    const match = findNextMatch(text, offset, expressions)
    if (!match) {
      content.push(text.slice(offset))
      break
    }
    if (match.index > offset) content.push(text.slice(offset, match.index))

    const { plain, latex } = match.expression
    content.push(
      <InlineMath
        key={String(match.index) + "-" + String(mathIndex)}
        plain={plain}
        latex={latex}
      />,
    )
    offset = match.index + plain.length
    mathIndex += 1
  }

  return <Fragment>{content}</Fragment>
}
