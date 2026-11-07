import { normalizeUnit, parseNumericExpression } from "./numeric-expression"
import type {
  AssessmentQuestion,
  CriterionGrade,
  CriterionStatus,
  ExactTextResponse,
  ExactTextRule,
  ExplainableValue,
  MultipleChoiceResponse,
  MultipleChoiceRule,
  NumericResponse,
  NumericRule,
  QuestionGrade,
  QuestionResponse,
  SingleChoiceResponse,
  SingleChoiceRule,
  StructuredFieldResponse,
  StructuredFieldRule,
  TextNormalization,
} from "./types"

const SCORE_PRECISION = 1_000_000_000_000
const DEFAULT_NUMERIC_TOLERANCE = 1e-9
const DEFAULT_UNIT_WEIGHT = 0.2

export class AssessmentDefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AssessmentDefinitionError"
  }
}

interface AtomicGradeContext {
  readonly criterionId: string
  readonly label: string
  readonly points: number
  readonly knowledgeTags: readonly string[]
  readonly explanation?: string
}

function roundScore(value: number): number {
  return Math.round(value * SCORE_PRECISION) / SCORE_PRECISION
}

function sameScore(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1 / SCORE_PRECISION
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function expectedDisplay(values: readonly (string | number)[]): ExplainableValue {
  const display = values.map(String)
  return display.length === 1 ? display[0] : display
}

function criterion(
  context: AtomicGradeContext,
  attributes: Omit<CriterionGrade, "id" | "label" | "possiblePoints" | "knowledgeTags" | "explanation">,
): CriterionGrade {
  return {
    id: context.criterionId,
    label: context.label,
    possiblePoints: context.points,
    knowledgeTags: context.knowledgeTags,
    explanation: context.explanation,
    ...attributes,
    earnedPoints: roundScore(attributes.earnedPoints),
  }
}

function assertFinitePositive(value: number, description: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new AssessmentDefinitionError(`${description} must be a positive finite number.`)
  }
}

function validateOptions(
  options: SingleChoiceRule["options"],
  correctOptionIds: readonly string[],
  description: string,
): void {
  if (!options) return
  const optionIds = options.map(({ id }) => id)
  if (new Set(optionIds).size !== optionIds.length) {
    throw new AssessmentDefinitionError(`${description} has duplicate option ids.`)
  }
  for (const correctOptionId of correctOptionIds) {
    if (!optionIds.includes(correctOptionId)) {
      throw new AssessmentDefinitionError(
        `${description} refers to unknown correct option '${correctOptionId}'.`,
      )
    }
  }
}

function validateRule(rule: StructuredFieldRule, description: string): void {
  if (rule.type === "single-choice") {
    if (rule.correctOptionId === "") {
      throw new AssessmentDefinitionError(`${description} has an empty correct option id.`)
    }
    validateOptions(rule.options, [rule.correctOptionId], description)
    return
  }

  if (rule.type === "multiple-choice") {
    if (rule.correctOptionIds.length === 0) {
      throw new AssessmentDefinitionError(`${description} needs at least one correct option.`)
    }
    if (new Set(rule.correctOptionIds).size !== rule.correctOptionIds.length) {
      throw new AssessmentDefinitionError(`${description} has duplicate correct options.`)
    }
    if (
      rule.scoring !== "all-or-nothing" &&
      rule.scoring !== "proportional-without-wrong-selections"
    ) {
      throw new AssessmentDefinitionError(`${description} has an invalid scoring rule.`)
    }
    validateOptions(rule.options, rule.correctOptionIds, description)
    return
  }

  if (rule.type === "exact-text") {
    if (
      rule.acceptedAnswers.length === 0 ||
      rule.acceptedAnswers.some((answer) => answer.trim() === "")
    ) {
      throw new AssessmentDefinitionError(`${description} needs an accepted text answer.`)
    }
    return
  }

  if (rule.acceptedValues.length === 0) {
    throw new AssessmentDefinitionError(`${description} needs an accepted numeric value.`)
  }
  for (const acceptedValue of rule.acceptedValues) {
    const parsed = parseNumericExpression(acceptedValue)
    if (!parsed.ok) {
      throw new AssessmentDefinitionError(
        `${description} contains an invalid expected numeric expression.`,
      )
    }
  }

  const { absolute, relative } = rule.tolerance ?? {}
  for (const [name, value] of [
    ["absolute", absolute],
    ["relative", relative],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new AssessmentDefinitionError(
        `${description} has an invalid ${name} tolerance.`,
      )
    }
  }

  if (rule.unit) {
    if (
      rule.unit.acceptedUnits.length === 0 ||
      rule.unit.acceptedUnits.some((unit) => normalizeUnit(unit) === "")
    ) {
      throw new AssessmentDefinitionError(`${description} needs an accepted unit.`)
    }
    const weight = rule.unit.scoreWeight ?? DEFAULT_UNIT_WEIGHT
    if (!Number.isFinite(weight) || weight <= 0 || weight >= 1) {
      throw new AssessmentDefinitionError(
        `${description} unit scoreWeight must be greater than 0 and less than 1.`,
      )
    }
  }
}

function validateQuestion(question: AssessmentQuestion): void {
  if (question.id === "") {
    throw new AssessmentDefinitionError("Question id must not be empty.")
  }
  assertFinitePositive(question.points, `Question '${question.id}' points`)

  if (question.type !== "structured") {
    if (question.rule.type !== question.type) {
      throw new AssessmentDefinitionError(
        `Question '${question.id}' type does not match its rule.`,
      )
    }
    validateRule(question.rule, `Question '${question.id}'`)
    return
  }

  if (question.fields.length === 0) {
    throw new AssessmentDefinitionError(
      `Structured question '${question.id}' needs at least one field.`,
    )
  }
  const fieldIds = question.fields.map(({ id }) => id)
  if (new Set(fieldIds).size !== fieldIds.length) {
    throw new AssessmentDefinitionError(
      `Structured question '${question.id}' has duplicate field ids.`,
    )
  }

  let fieldPointTotal = 0
  for (const field of question.fields) {
    if (field.id === "") {
      throw new AssessmentDefinitionError(
        `Structured question '${question.id}' has an empty field id.`,
      )
    }
    assertFinitePositive(field.points, `Field '${question.id}.${field.id}' points`)
    validateRule(field.rule, `Field '${question.id}.${field.id}'`)
    fieldPointTotal += field.points
  }
  if (!sameScore(fieldPointTotal, question.points)) {
    throw new AssessmentDefinitionError(
      `Structured question '${question.id}' field points must sum to ${question.points}.`,
    )
  }
}

function mismatchCriteria(
  rule: StructuredFieldRule,
  response: { readonly type: string },
  context: AtomicGradeContext,
): CriterionGrade[] {
  return gradeAtomicRule(rule, undefined, context).map((item) => ({
    ...item,
    earnedPoints: 0,
    status: "invalid",
    feedbackCode: "RESPONSE_TYPE_MISMATCH",
    received: response.type,
  }))
}

function gradeSingleChoice(
  rule: SingleChoiceRule,
  response: SingleChoiceResponse | undefined,
  context: AtomicGradeContext,
): CriterionGrade[] {
  const selected = response?.selectedOptionId
  const unanswered = selected === undefined || selected === null || selected === ""
  const correct = selected === rule.correctOptionId
  return [
    criterion(context, {
      earnedPoints: correct ? context.points : 0,
      status: unanswered ? "unanswered" : correct ? "correct" : "incorrect",
      feedbackCode: unanswered
        ? "SINGLE_CHOICE_UNANSWERED"
        : correct
          ? "SINGLE_CHOICE_CORRECT"
          : "SINGLE_CHOICE_INCORRECT",
      expected: rule.correctOptionId,
      received: selected ?? null,
    }),
  ]
}

function gradeMultipleChoice(
  rule: MultipleChoiceRule,
  response: MultipleChoiceResponse | undefined,
  context: AtomicGradeContext,
): CriterionGrade[] {
  const selectedIds = unique(response?.selectedOptionIds ?? [])
  const correctIds = new Set(rule.correctOptionIds)
  const wrongSelections = selectedIds.filter((id) => !correctIds.has(id))
  const selectedCorrectCount = selectedIds.filter((id) => correctIds.has(id)).length
  const missingCount = correctIds.size - selectedCorrectCount

  let earnedPoints = 0
  let status: CriterionStatus = "incorrect"
  let feedbackCode = "MULTIPLE_CHOICE_INCOMPLETE"

  if (selectedIds.length === 0) {
    status = "unanswered"
    feedbackCode = "MULTIPLE_CHOICE_UNANSWERED"
  } else if (wrongSelections.length > 0) {
    feedbackCode = "MULTIPLE_CHOICE_WRONG_SELECTION"
  } else if (missingCount === 0) {
    earnedPoints = context.points
    status = "correct"
    feedbackCode = "MULTIPLE_CHOICE_CORRECT"
  } else if (rule.scoring === "proportional-without-wrong-selections") {
    earnedPoints = context.points * (selectedCorrectCount / correctIds.size)
    status = "partial"
    feedbackCode = "MULTIPLE_CHOICE_PARTIAL"
  }

  return [
    criterion(context, {
      earnedPoints,
      status,
      feedbackCode,
      expected: rule.correctOptionIds,
      received: selectedIds,
      details: {
        selectedCorrectCount,
        missingCorrectCount: missingCount,
        wrongSelectionCount: wrongSelections.length,
        wrongSelectionIds: wrongSelections.join(","),
      },
    }),
  ]
}

function toleranceFor(expectedValue: number, rule: NumericRule): number {
  const absolute = rule.tolerance?.absolute ?? DEFAULT_NUMERIC_TOLERANCE
  const relative = rule.tolerance?.relative ?? DEFAULT_NUMERIC_TOLERANCE
  return Math.max(absolute, relative * Math.abs(expectedValue))
}

function gradeNumericValue(
  rule: NumericRule,
  response: NumericResponse | undefined,
  context: AtomicGradeContext,
): CriterionGrade {
  const expectedResults = rule.acceptedValues.map((expected) => {
    const parsed = parseNumericExpression(expected)
    if (!parsed.ok) {
      // validateRule has already converted this into a definition error.
      throw new AssessmentDefinitionError("Invalid expected numeric expression.")
    }
    return { value: parsed.value }
  })
  const parsedResponse = parseNumericExpression(response?.value ?? "")

  if (!parsedResponse.ok) {
    const unanswered = parsedResponse.errorCode === "EMPTY_EXPRESSION"
    return criterion(context, {
      earnedPoints: 0,
      status: unanswered ? "unanswered" : "invalid",
      feedbackCode: unanswered ? "NUMERIC_UNANSWERED" : "NUMERIC_INVALID_EXPRESSION",
      expected: expectedDisplay(rule.acceptedValues),
      received: response?.value ?? null,
      details: { parseErrorCode: parsedResponse.errorCode },
    })
  }

  const comparisons = expectedResults.map((expected) => ({
    ...expected,
    difference: Math.abs(parsedResponse.value - expected.value),
    allowedTolerance: toleranceFor(expected.value, rule),
  }))
  const matching = comparisons.find(
    ({ difference, allowedTolerance }) => difference <= allowedTolerance,
  )
  const nearest = comparisons.reduce((best, current) =>
    current.difference < best.difference ? current : best,
  )

  return criterion(context, {
    earnedPoints: matching ? context.points : 0,
    status: matching ? "correct" : "incorrect",
    feedbackCode: matching ? "NUMERIC_VALUE_CORRECT" : "NUMERIC_OUTSIDE_TOLERANCE",
    expected: expectedDisplay(rule.acceptedValues),
    received: response?.value ?? null,
    details: {
      parsedValue: parsedResponse.value,
      nearestExpectedValue: nearest.value,
      difference: nearest.difference,
      allowedTolerance: nearest.allowedTolerance,
    },
  })
}

function gradeUnit(
  rule: NumericRule,
  response: NumericResponse | undefined,
  context: AtomicGradeContext,
): CriterionGrade | undefined {
  if (!rule.unit) return undefined

  const receivedUnit = response?.unit?.trim() ?? ""
  const isMissing = receivedUnit === ""
  const valueParse = parseNumericExpression(response?.value ?? "")
  const whollyUnanswered =
    isMissing && (!valueParse.ok && valueParse.errorCode === "EMPTY_EXPRESSION")
  const required = rule.unit.required ?? true
  const normalizedAcceptedUnits = rule.unit.acceptedUnits.map(normalizeUnit)
  const matches =
    !whollyUnanswered &&
    ((!required && isMissing) ||
      (!isMissing && normalizedAcceptedUnits.includes(normalizeUnit(receivedUnit))))
  const status: CriterionStatus = matches
    ? "correct"
    : whollyUnanswered || isMissing
      ? "unanswered"
      : "incorrect"
  let feedbackCode: string
  if (whollyUnanswered) {
    feedbackCode = "UNIT_UNANSWERED"
  } else if (matches) {
    feedbackCode = isMissing ? "UNIT_OPTIONAL_OMITTED" : "UNIT_CORRECT"
  } else {
    feedbackCode = isMissing ? "UNIT_REQUIRED" : "UNIT_INCORRECT"
  }

  return criterion(context, {
    earnedPoints: matches ? context.points : 0,
    status,
    feedbackCode,
    expected: rule.unit.acceptedUnits,
    received: isMissing ? null : receivedUnit,
  })
}

function gradeNumeric(
  rule: NumericRule,
  response: NumericResponse | undefined,
  context: AtomicGradeContext,
): CriterionGrade[] {
  if (!rule.unit) {
    return [gradeNumericValue(rule, response, context)]
  }

  const unitWeight = rule.unit.scoreWeight ?? DEFAULT_UNIT_WEIGHT
  const valuePoints = roundScore(context.points * (1 - unitWeight))
  const unitPoints = roundScore(context.points - valuePoints)
  const valueCriterion = gradeNumericValue(rule, response, {
    ...context,
    criterionId: `${context.criterionId}.value`,
    label: `${context.label}：数值`,
    points: valuePoints,
  })
  const unitCriterion = gradeUnit(rule, response, {
    ...context,
    criterionId: `${context.criterionId}.unit`,
    label: `${context.label}：单位`,
    points: unitPoints,
  })
  return unitCriterion ? [valueCriterion, unitCriterion] : [valueCriterion]
}

function normalizeText(value: string, normalization: TextNormalization = {}): string {
  let normalized =
    normalization.unicodeCompatibility === false ? value : value.normalize("NFKC")
  switch (normalization.whitespace ?? "collapse") {
    case "trim":
      normalized = normalized.trim()
      break
    case "collapse":
      normalized = normalized.trim().replace(/\s+/gu, " ")
      break
    case "remove":
      normalized = normalized.replace(/\s+/gu, "")
      break
    case "preserve":
      break
  }
  return normalization.caseSensitive ? normalized : normalized.toLocaleLowerCase("zh-CN")
}

function gradeExactText(
  rule: ExactTextRule,
  response: ExactTextResponse | undefined,
  context: AtomicGradeContext,
): CriterionGrade[] {
  const received = response?.value ?? ""
  const unanswered = received.trim() === ""
  const normalizedReceived = normalizeText(received, rule.normalization)
  const correct = rule.acceptedAnswers.some(
    (expected) => normalizeText(expected, rule.normalization) === normalizedReceived,
  )

  return [
    criterion(context, {
      earnedPoints: correct ? context.points : 0,
      status: unanswered ? "unanswered" : correct ? "correct" : "incorrect",
      feedbackCode: unanswered
        ? "EXACT_TEXT_UNANSWERED"
        : correct
          ? "EXACT_TEXT_CORRECT"
          : "EXACT_TEXT_INCORRECT",
      expected: rule.acceptedAnswers,
      received: unanswered ? null : received,
    }),
  ]
}

function gradeAtomicRule(
  rule: StructuredFieldRule,
  response: StructuredFieldResponse | undefined,
  context: AtomicGradeContext,
): CriterionGrade[] {
  if (response && response.type !== rule.type) {
    return mismatchCriteria(rule, response, context)
  }
  switch (rule.type) {
    case "single-choice":
      return gradeSingleChoice(rule, response as SingleChoiceResponse | undefined, context)
    case "multiple-choice":
      return gradeMultipleChoice(rule, response as MultipleChoiceResponse | undefined, context)
    case "numeric":
      return gradeNumeric(rule, response as NumericResponse | undefined, context)
    case "exact-text":
      return gradeExactText(rule, response as ExactTextResponse | undefined, context)
  }
}

function finishQuestionGrade(
  question: AssessmentQuestion,
  criteria: readonly CriterionGrade[],
): QuestionGrade {
  const earnedPoints = roundScore(
    criteria.reduce((sum, item) => sum + item.earnedPoints, 0),
  )
  const allUnanswered = criteria.every(({ status }) => status === "unanswered")
  const isCorrect = sameScore(earnedPoints, question.points)
  const status = allUnanswered
    ? "unanswered"
    : isCorrect
      ? "correct"
      : earnedPoints > 0
        ? "partial"
        : "incorrect"

  return {
    questionId: question.id,
    questionType: question.type,
    earnedPoints,
    possiblePoints: question.points,
    scoreRatio: earnedPoints / question.points,
    status,
    isCorrect,
    knowledgeTags: question.knowledgeTags,
    criteria,
    feedbackCodes: unique(criteria.map(({ feedbackCode }) => feedbackCode)),
    explanation: question.explanation,
    learningStepId: question.learningStepId,
  }
}

/** Grades one question without randomness, I/O, dynamic code, or hidden state. */
export function gradeQuestion(
  question: AssessmentQuestion,
  response?: QuestionResponse | null,
): QuestionGrade {
  validateQuestion(question)

  if (question.type === "structured") {
    if (response && response.type !== "structured") {
      const criteria = question.fields.flatMap((field) =>
        mismatchCriteria(field.rule, response, {
          criterionId: field.id,
          label: field.label,
          points: field.points,
          knowledgeTags: field.knowledgeTags ?? question.knowledgeTags,
          explanation: field.explanation,
        }),
      )
      return finishQuestionGrade(question, criteria)
    }

    const structuredResponse = response?.type === "structured" ? response : undefined
    const criteria = question.fields.flatMap((field) =>
      gradeAtomicRule(field.rule, structuredResponse?.fields[field.id] ?? undefined, {
        criterionId: field.id,
        label: field.label,
        points: field.points,
        knowledgeTags: field.knowledgeTags ?? question.knowledgeTags,
        explanation: field.explanation,
      }),
    )
    return finishQuestionGrade(question, criteria)
  }

  const atomicResponse: StructuredFieldResponse | undefined =
    response?.type === "structured" ? undefined : response ?? undefined
  const context: AtomicGradeContext = {
    criterionId: "answer",
    label: "答案",
    points: question.points,
    knowledgeTags: question.knowledgeTags,
    explanation: question.explanation,
  }
  const criteria =
    response && response.type !== question.type
      ? mismatchCriteria(question.rule, response, context)
      : gradeAtomicRule(question.rule, atomicResponse, context)
  return finishQuestionGrade(question, criteria)
}
