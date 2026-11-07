import type {
  KnowledgeTagMastery,
  MasteryRecommendationCode,
  QuestionGrade,
} from "./types"

const SCORE_PRECISION = 1_000_000_000_000

function roundScore(value: number): number {
  return Math.round(value * SCORE_PRECISION) / SCORE_PRECISION
}

function classifyMastery(scoreRatio: number): Pick<
  KnowledgeTagMastery,
  "level" | "recommendationCode"
> {
  if (scoreRatio < 0.6) {
    return {
      level: "review",
      recommendationCode: "REVIEW_LEARNING_STEP",
    }
  }
  if (scoreRatio < 0.8) {
    return {
      level: "practice",
      recommendationCode: "REVIEW_ERRORS_AND_RETRY",
    }
  }
  return {
    level: "extend",
    recommendationCode: "TRY_EXTENSION_OR_TRANSFER",
  }
}

/**
 * Aggregates criterion points under their declared knowledge tags. A criterion
 * carrying two tags contributes its full score to both tag summaries.
 */
export function calculateMasteryByKnowledgeTag(
  questionGrades: readonly QuestionGrade[],
): KnowledgeTagMastery[] {
  const totals = new Map<string, { earnedPoints: number; possiblePoints: number }>()

  for (const questionGrade of questionGrades) {
    for (const criterion of questionGrade.criteria) {
      for (const knowledgeTag of new Set(criterion.knowledgeTags)) {
        const total = totals.get(knowledgeTag) ?? {
          earnedPoints: 0,
          possiblePoints: 0,
        }
        total.earnedPoints += criterion.earnedPoints
        total.possiblePoints += criterion.possiblePoints
        totals.set(knowledgeTag, total)
      }
    }
  }

  return [...totals.entries()].map(([knowledgeTag, total]) => {
    const earnedPoints = roundScore(total.earnedPoints)
    const possiblePoints = roundScore(total.possiblePoints)
    const scoreRatio = possiblePoints === 0 ? 0 : earnedPoints / possiblePoints
    return {
      knowledgeTag,
      earnedPoints,
      possiblePoints,
      scoreRatio,
      percentage: scoreRatio * 100,
      ...classifyMastery(scoreRatio),
    }
  })
}

export function uniqueRecommendationCodes(
  mastery: readonly KnowledgeTagMastery[],
): MasteryRecommendationCode[] {
  return [...new Set(mastery.map(({ recommendationCode }) => recommendationCode))]
}
