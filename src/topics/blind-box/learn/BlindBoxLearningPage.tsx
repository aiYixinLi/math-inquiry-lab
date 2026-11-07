import { TopicShell } from "../../../app/layouts"
import { LearningScreen } from "../../../shared/learning"
import { BLIND_BOX_LEARNING_STEPS } from "./content"
import { renderBlindBoxLearningVisual } from "./visuals"
import "./learning.css"

export default function BlindBoxLearningPage() {
  return (
    <TopicShell topicId="blind-box" module="learn">
      <LearningScreen
        topicId="blind-box"
        steps={BLIND_BOX_LEARNING_STEPS}
        renderVisual={renderBlindBoxLearningVisual}
      />
    </TopicShell>
  )
}
