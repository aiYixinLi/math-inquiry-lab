export type QuestionType =
  | "single-choice"
  | "multiple-choice"
  | "numeric"
  | "structured"

export interface ChoiceOption {
  readonly id: string
  readonly label: string
}

export interface SingleChoiceRule {
  readonly type: "single-choice"
  readonly correctOptionId: string
  readonly options?: readonly ChoiceOption[]
}

export type MultipleChoiceScoring =
  | "all-or-nothing"
  | "proportional-without-wrong-selections"

export interface MultipleChoiceRule {
  readonly type: "multiple-choice"
  readonly correctOptionIds: readonly string[]
  /**
   * A wrong selection always earns zero. This setting only controls whether a
   * proper subset of the correct selections earns proportional credit.
   */
  readonly scoring: MultipleChoiceScoring
  readonly options?: readonly ChoiceOption[]
}

export interface NumericTolerance {
  /** Maximum absolute error. Defaults to 1e-9. */
  readonly absolute?: number
  /** Maximum error relative to the expected magnitude. Defaults to 1e-9. */
  readonly relative?: number
}

export interface UnitRule {
  /** Equivalent spellings must be declared explicitly, for example cm² and 平方厘米. */
  readonly acceptedUnits: readonly string[]
  /** Defaults to true. */
  readonly required?: boolean
  /** Fraction of the field's points assigned to the unit. Defaults to 0.2. */
  readonly scoreWeight?: number
}

export type NumericExpectedValue = number | string

export interface NumericRule {
  readonly type: "numeric"
  /** Strings are parsed with the same restricted parser used for responses. */
  readonly acceptedValues: readonly NumericExpectedValue[]
  readonly tolerance?: NumericTolerance
  readonly unit?: UnitRule
}

export interface TextNormalization {
  /** Defaults to false. */
  readonly caseSensitive?: boolean
  /** Defaults to "collapse". */
  readonly whitespace?: "preserve" | "trim" | "collapse" | "remove"
  /** Unicode compatibility normalization is enabled unless explicitly false. */
  readonly unicodeCompatibility?: boolean
}

/** Deterministic text matching for low-ambiguity structured fields. */
export interface ExactTextRule {
  readonly type: "exact-text"
  readonly acceptedAnswers: readonly string[]
  readonly normalization?: TextNormalization
}

export type StructuredFieldRule =
  | SingleChoiceRule
  | MultipleChoiceRule
  | NumericRule
  | ExactTextRule

export interface StructuredFieldDefinition {
  readonly id: string
  readonly label: string
  readonly points: number
  /** Overrides the question tags for this field when supplied. */
  readonly knowledgeTags?: readonly string[]
  readonly rule: StructuredFieldRule
  readonly explanation?: string
}

export interface QuestionBase {
  readonly id: string
  readonly prompt: string
  readonly points: number
  readonly knowledgeTags: readonly string[]
  readonly explanation?: string
  readonly learningStepId?: string
}

export interface SingleChoiceQuestion extends QuestionBase {
  readonly type: "single-choice"
  readonly rule: SingleChoiceRule
}

export interface MultipleChoiceQuestion extends QuestionBase {
  readonly type: "multiple-choice"
  readonly rule: MultipleChoiceRule
}

export interface NumericQuestion extends QuestionBase {
  readonly type: "numeric"
  readonly rule: NumericRule
}

export interface StructuredQuestion extends QuestionBase {
  readonly type: "structured"
  readonly fields: readonly StructuredFieldDefinition[]
}

export type AssessmentQuestion =
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | NumericQuestion
  | StructuredQuestion

export interface SingleChoiceResponse {
  readonly type: "single-choice"
  readonly selectedOptionId: string | null
}

export interface MultipleChoiceResponse {
  readonly type: "multiple-choice"
  readonly selectedOptionIds: readonly string[]
}

export interface NumericResponse {
  readonly type: "numeric"
  readonly value: string | number
  readonly unit?: string | null
}

export interface ExactTextResponse {
  readonly type: "exact-text"
  readonly value: string
}

export type StructuredFieldResponse =
  | SingleChoiceResponse
  | MultipleChoiceResponse
  | NumericResponse
  | ExactTextResponse

export interface StructuredResponse {
  readonly type: "structured"
  readonly fields: Readonly<
    Record<string, StructuredFieldResponse | null | undefined>
  >
}

export type QuestionResponse =
  | SingleChoiceResponse
  | MultipleChoiceResponse
  | NumericResponse
  | StructuredResponse

export type CriterionStatus =
  | "correct"
  | "partial"
  | "incorrect"
  | "unanswered"
  | "invalid"

export type ExplainableValue =
  | string
  | number
  | null
  | readonly string[]

export type CriterionDetails = Readonly<
  Record<string, string | number | boolean | null>
>

export interface CriterionGrade {
  readonly id: string
  readonly label: string
  readonly earnedPoints: number
  readonly possiblePoints: number
  readonly status: CriterionStatus
  readonly feedbackCode: string
  readonly knowledgeTags: readonly string[]
  readonly expected: ExplainableValue
  readonly received: ExplainableValue
  readonly explanation?: string
  readonly details?: CriterionDetails
}

export type QuestionGradeStatus =
  | "correct"
  | "partial"
  | "incorrect"
  | "unanswered"

export interface QuestionGrade {
  readonly questionId: string
  readonly questionType: QuestionType
  readonly earnedPoints: number
  readonly possiblePoints: number
  readonly scoreRatio: number
  readonly status: QuestionGradeStatus
  readonly isCorrect: boolean
  readonly knowledgeTags: readonly string[]
  readonly criteria: readonly CriterionGrade[]
  readonly feedbackCodes: readonly string[]
  readonly explanation?: string
  readonly learningStepId?: string
}

export interface QuizDefinition {
  readonly id: string
  readonly version: string
  readonly questions: readonly AssessmentQuestion[]
}

export type QuizResponses = Readonly<
  Record<string, QuestionResponse | null | undefined>
>

export type MasteryLevel = "review" | "practice" | "extend"

export type MasteryRecommendationCode =
  | "REVIEW_LEARNING_STEP"
  | "REVIEW_ERRORS_AND_RETRY"
  | "TRY_EXTENSION_OR_TRANSFER"

export interface KnowledgeTagMastery {
  readonly knowledgeTag: string
  readonly earnedPoints: number
  readonly possiblePoints: number
  readonly scoreRatio: number
  readonly percentage: number
  readonly level: MasteryLevel
  readonly recommendationCode: MasteryRecommendationCode
}

export interface QuizGrade {
  readonly quizId: string
  readonly quizVersion: string
  readonly earnedPoints: number
  readonly possiblePoints: number
  readonly scoreRatio: number
  readonly percentage: number
  readonly questionGrades: readonly QuestionGrade[]
  readonly mastery: readonly KnowledgeTagMastery[]
  readonly recommendationCodes: readonly MasteryRecommendationCode[]
}
