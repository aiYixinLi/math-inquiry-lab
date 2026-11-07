import { TopicShell } from "../../../app/layouts"
import { QuizRunner } from "../../../shared/assessment"
import { BLIND_BOX_QUIZ } from "./questions"

export default function BlindBoxQuizPage() {
  return (
    <TopicShell topicId="blind-box" module="quiz">
      <QuizRunner topicId="blind-box" quiz={BLIND_BOX_QUIZ} />
    </TopicShell>
  )
}
