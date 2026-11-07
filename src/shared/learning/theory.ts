import type {
  LearningStep,
  LearningTheoryBlock,
  LearningTheoryKind,
} from "./types"

function principleKind(label: LearningStep["principleLabel"]): LearningTheoryKind {
  return label === "定理" ? "theorem" : "property"
}

export function getLearningTheoryBlocks(step: LearningStep): readonly LearningTheoryBlock[] {
  const principleLabel = step.principleLabel ?? "性质"
  const blocks: LearningTheoryBlock[] = [
    {
      id: `${step.id}-concept-overview`,
      kind: "concept",
      label: "概念导读",
      title: `${step.shortTitle}的核心概念`,
      body: step.definition,
    },
  ]

  step.mathConcepts.forEach((concept, index) => {
    blocks.push({
      id: `${step.id}-concept-${index + 1}-definition`,
      kind: "concept",
      label: `概念 ${index + 1}/${step.mathConcepts.length} · 定义`,
      title: concept.term,
      concepts: [concept],
      conceptFocus: "definition",
    })
    blocks.push({
      id: `${step.id}-concept-${index + 1}-context`,
      kind: "concept",
      label: `概念 ${index + 1}/${step.mathConcepts.length} · 应用`,
      title: `${concept.term}的课题含义`,
      concepts: [concept],
      conceptFocus: "context",
    })
  })

  if (step.formula && step.formulaLatex) {
    blocks.push({
      id: `${step.id}-formula`,
      kind: "formula",
      label: "公式",
      title: `${step.shortTitle}的数学表达`,
      formula: {
        plain: step.formula,
        latex: step.formulaLatex,
      },
    })
    if (step.formulaExplanation) {
      blocks.push({
        id: `${step.id}-formula-formal`,
        kind: "formula",
        label: "公式说明 1/2",
        title: "形式化表述",
        body: step.formulaExplanation.formal,
      })
      blocks.push({
        id: `${step.id}-formula-intuitive`,
        kind: "formula",
        label: "公式说明 2/2",
        title: "直观理解",
        body: step.formulaExplanation.intuitive,
      })
    }
  }

  if (step.interpretation) {
    blocks.push({
      id: `${step.id}-principle`,
      kind: principleKind(step.principleLabel),
      label: principleLabel,
      title: step.principleTitle ?? "性质与结论",
      body: step.interpretation,
    })
  }

  blocks.push({
    id: `${step.id}-example`,
    kind: "example",
    label: "例题",
    title: "用一个具体情形理解",
    body: step.workedExample,
    formula: step.workedExampleFormula && step.workedExampleLatex
      ? {
          plain: step.workedExampleFormula,
          latex: step.workedExampleLatex,
        }
      : undefined,
  })

  blocks.push({
    id: `${step.id}-boundary`,
    kind: "boundary",
    label: "边界",
    title: "适用条件与模型边界",
    body: step.boundary,
  })

  return blocks
}
