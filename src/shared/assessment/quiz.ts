import { gradeQuestion } from "./grading"
import {
  calculateMasteryByKnowledgeTag,
  uniqueRecommendationCodes,
} from "./mastery"
import type { QuizDefinition, QuizGrade, QuizResponses } from "./types"

const SCORE_PRECISION = 1_000_000_000_000

function roundScore(value: number): number {
  return Math.round(value * SCORE_PRECISION) / SCORE_PRECISION
}

/** Grades a versioned quiz in its declared question order. */
export function gradeQuiz(
  quiz: QuizDefinition,
  responses: QuizResponses,
): QuizGrade {
  const questionIds = quiz.questions.map(({ id }) => id)
  if (new Set(questionIds).size !== questionIds.length) {
    throw new Error(`Quiz '${quiz.id}' has duplicate question ids.`)
  }

  const questionGrades = quiz.questions.map((question) =>
    gradeQuestion(question, responses[question.id]),
  )
  const earnedPoints = roundScore(
    questionGrades.reduce((sum, grade) => sum + grade.earnedPoints, 0),
  )
  const possiblePoints = roundScore(
    questionGrades.reduce((sum, grade) => sum + grade.possiblePoints, 0),
  )
  const scoreRatio = possiblePoints === 0 ? 0 : earnedPoints / possiblePoints
  const mastery = calculateMasteryByKnowledgeTag(questionGrades)

  return {
    quizId: quiz.id,
    quizVersion: quiz.version,
    earnedPoints,
    possiblePoints,
    scoreRatio,
    percentage: scoreRatio * 100,
    questionGrades,
    mastery,
    recommendationCodes: uniqueRecommendationCodes(mastery),
  }
}
