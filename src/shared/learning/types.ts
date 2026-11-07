import type { ReactNode } from "react"

export interface LearningCheckOption {
  readonly id: string
  readonly label: string
}

export interface LearningCheck {
  readonly prompt: string
  readonly options: readonly LearningCheckOption[]
  readonly correctOptionId: string
  readonly explanation: string
}

export interface LearningInlineMath {
  readonly plain: string
  readonly latex: string
}

export type LearningTheoryKind =
  | "concept"
  | "formula"
  | "property"
  | "theorem"
  | "example"
  | "boundary"

export interface LearningFormulaExplanation {
  readonly formal: string
  readonly intuitive: string
}

export interface LearningTheoryFormula {
  readonly plain: string
  readonly latex: string
  readonly explanation?: LearningFormulaExplanation
}

export interface LearningMathConcept {
  readonly term: string
  readonly definition: string
  readonly context: string
  readonly notation?: string
  readonly notationLatex?: string
}

export interface LearningTheoryBlock {
  readonly id: string
  readonly kind: LearningTheoryKind
  readonly label: string
  readonly title: string
  readonly body?: string
  readonly concepts?: readonly LearningMathConcept[]
  readonly conceptFocus?: "definition" | "context"
  readonly formula?: LearningTheoryFormula
}

export interface LearningStep {
  readonly id: string
  readonly shortTitle: string
  readonly title: string
  readonly objective: string
  readonly definition: string
  readonly inlineMath: readonly LearningInlineMath[]
  readonly mathConcepts: readonly LearningMathConcept[]
  readonly formula?: string
  readonly formulaLatex?: string
  readonly formulaExplanation?: LearningFormulaExplanation
  readonly interpretation?: string
  readonly principleLabel?: "性质" | "定理" | "结论" | "方法"
  readonly principleTitle?: string
  readonly workedExample: string
  readonly workedExampleFormula?: string
  readonly workedExampleLatex?: string
  readonly boundary: string
  readonly visualTitle: string
  readonly visualCaption: string
  readonly check: LearningCheck
  readonly lockedUntilExperiment?: boolean
}

export type LearningVisualRenderer = (
  step: LearningStep,
  stepIndex: number,
) => ReactNode
