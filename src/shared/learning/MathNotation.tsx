import katex from "katex"

interface MathNotationProps {
  readonly plain: string
  readonly latex: string
}

export function MathNotation({ plain, latex }: MathNotationProps) {
  const markup = katex.renderToString(latex, {
    displayMode: false,
    output: "htmlAndMathml",
    throwOnError: false,
    strict: "ignore",
    trust: false,
  })

  return (
    <span
      className="learning-math-notation"
      role="math"
      aria-label={plain}
      data-notation-source={latex}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}
