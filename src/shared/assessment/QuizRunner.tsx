import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { Link } from "react-router-dom"
import { getTopic, type TopicId } from "../../app/topic-registry"
import { APPLICATION_VERSION } from "../../app/version"
import { useModuleProgress } from "../progress"
import { gradeQuiz } from "./quiz"
import type {
  AssessmentQuestion,
  ChoiceOption,
  ExplainableValue,
  QuestionResponse,
  QuizDefinition,
  QuizGrade,
  QuizResponses,
  StructuredFieldDefinition,
  StructuredFieldResponse,
  StructuredFieldRule,
  StructuredResponse,
} from "./types"

export const QUIZ_ATTEMPT_STORAGE_KEY = "math-inquiry-lab:quiz-attempts:v1"
export const QUIZ_ATTEMPT_SCHEMA_VERSION = "1.0.0" as const
export const MAX_RETAINED_FOLLOWUP_ATTEMPTS = 30

export interface QuizAttemptRecord {
  readonly schemaVersion: typeof QUIZ_ATTEMPT_SCHEMA_VERSION
  readonly appVersion: typeof APPLICATION_VERSION
  readonly attemptId: string
  readonly topicId: TopicId
  readonly quizId: string
  readonly quizVersion: string
  readonly questionSelectionSeed: "fixed-default-order"
  readonly startedAt: string
  readonly submittedAt: string
  readonly parentAttemptId: string | null
  readonly retryIndex: number
  readonly responses: QuizResponses
  readonly grade: QuizGrade
}

interface AttemptContext {
  readonly startedAt: string
  readonly parentAttemptId: string | null
  readonly retryIndex: number
}

const FEEDBACK_COPY: Record<string, string> = {
  SINGLE_CHOICE_CORRECT: "所选答案正确。",
  SINGLE_CHOICE_INCORRECT: "所选答案与标准结论不一致。",
  SINGLE_CHOICE_UNANSWERED: "本题尚未作答。",
  MULTIPLE_CHOICE_CORRECT: "全部正确选项均已选出。",
  MULTIPLE_CHOICE_PARTIAL: "已选内容正确，但答案尚不完整。",
  MULTIPLE_CHOICE_WRONG_SELECTION: "答案中包含错误选项。",
  NUMERIC_VALUE_CORRECT: "数值与标准答案等价。",
  NUMERIC_VALUE_INCORRECT: "数值超出本题允许误差。",
  NUMERIC_VALUE_INVALID: "表达式无法按受限数学规则解析。",
  NUMERIC_VALUE_UNANSWERED: "数值尚未填写。",
  UNIT_CORRECT: "单位正确。",
  UNIT_INCORRECT: "数值与单位需要分别核对。",
  UNIT_UNANSWERED: "单位尚未填写。",
  EXACT_TEXT_CORRECT: "规范表达正确。",
  EXACT_TEXT_INCORRECT: "规范表达与量规要求不一致。",
}

const RECOMMENDATION_COPY = {
  REVIEW_LEARNING_STEP: "返回对应学习步骤，重新完成即时检查。",
  REVIEW_ERRORS_AND_RETRY: "阅读错题解析后，完成同构重试。",
  TRY_EXTENSION_OR_TRANSFER: "尝试变量变化题或跨课题迁移题。",
} as const

function choices(options: readonly ChoiceOption[] | undefined, ids: readonly string[] = []) {
  return options ?? ids.map((id) => ({ id, label: id }))
}

function responseExists(response: QuestionResponse | undefined): boolean {
  if (!response) return false
  if (response.type === "single-choice") return Boolean(response.selectedOptionId)
  if (response.type === "multiple-choice") return response.selectedOptionIds.length > 0
  if (response.type === "numeric") return String(response.value).trim() !== ""
  return Object.values(response.fields).some(Boolean)
}

function attemptScopeKey(attempt: unknown): string {
  if (typeof attempt !== "object" || attempt === null) return "unscoped"
  const candidate = attempt as Record<string, unknown>
  const quizId = typeof candidate.quizId === "string"
    ? candidate.quizId
    : "unknown-quiz"
  const topicId = typeof candidate.topicId === "string"
    ? candidate.topicId
    : "legacy-topic"
  return `${topicId}\u0000${quizId}`
}

function retainAttempts(attempts: readonly unknown[]): unknown[] {
  const firstAttemptIndexes = new Set<number>()
  const seenScopes = new Set<string>()

  attempts.forEach((attempt, index) => {
    const scope = attemptScopeKey(attempt)
    if (seenScopes.has(scope)) return
    seenScopes.add(scope)
    firstAttemptIndexes.add(index)
  })

  const followupIndexes = attempts
    .map((_, index) => index)
    .filter((index) => !firstAttemptIndexes.has(index))
    .slice(-MAX_RETAINED_FOLLOWUP_ATTEMPTS)
  const retainedIndexes = new Set([...firstAttemptIndexes, ...followupIndexes])

  return attempts.filter((_, index) => retainedIndexes.has(index))
}

function saveAttempt(
  topicId: TopicId,
  quiz: QuizDefinition,
  responses: QuizResponses,
  grade: QuizGrade,
  context: AttemptContext,
): QuizAttemptRecord {
  const attempt: QuizAttemptRecord = {
    schemaVersion: QUIZ_ATTEMPT_SCHEMA_VERSION,
    appVersion: APPLICATION_VERSION,
    attemptId: globalThis.crypto?.randomUUID?.() ??
      `attempt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    topicId,
    quizId: quiz.id,
    quizVersion: quiz.version,
    questionSelectionSeed: "fixed-default-order",
    startedAt: context.startedAt,
    submittedAt: new Date().toISOString(),
    parentAttemptId: context.parentAttemptId,
    retryIndex: context.retryIndex,
    responses,
    grade,
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(QUIZ_ATTEMPT_STORAGE_KEY) ?? "[]",
    )
    const attempts = Array.isArray(stored) ? stored : []
    attempts.push(attempt)
    window.localStorage.setItem(
      QUIZ_ATTEMPT_STORAGE_KEY,
      JSON.stringify(retainAttempts(attempts)),
    )
  } catch {
    // Assessment still works when storage is unavailable.
  }

  return attempt
}

interface ChoiceFieldProps {
  readonly prompt: string
  readonly options: readonly ChoiceOption[]
  readonly multiple: boolean
  readonly selected: readonly string[]
  readonly onChange: (ids: string[]) => void
}

function ChoiceField({ prompt, options, multiple, selected, onChange }: ChoiceFieldProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = options.findIndex((option) => selected.includes(option.id))
  const tabStopIndex = selectedIndex >= 0 ? selectedIndex : 0

  const handleRadioKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    if (multiple || options.length === 0) return

    let nextIndex: number | undefined
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % options.length
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + options.length) % options.length
    } else if (event.key === "Home") {
      nextIndex = 0
    } else if (event.key === "End") {
      nextIndex = options.length - 1
    }

    if (nextIndex === undefined) return
    event.preventDefault()
    onChange([options[nextIndex].id])
    optionRefs.current[nextIndex]?.focus()
  }

  return (
    <div className="quiz-options" role={multiple ? "group" : "radiogroup"} aria-label={prompt}>
      {options.map((option, index) => {
        const active = selected.includes(option.id)
        return (
          <button
            key={option.id}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={active}
            tabIndex={multiple || index === tabStopIndex ? 0 : -1}
            ref={(element) => {
              optionRefs.current[index] = element
            }}
            className={active ? "is-selected" : undefined}
            onKeyDown={(event) => handleRadioKeyDown(event, index)}
            onClick={() => {
              if (!multiple) onChange([option.id])
              else if (active) onChange(selected.filter((id) => id !== option.id))
              else onChange([...selected, option.id])
            }}
          >
            <span>{String.fromCharCode(65 + index)}</span>
            <strong>{option.label}</strong>
            <i aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

function StructuredFieldEditor({
  field,
  response,
  onChange,
}: {
  readonly field: StructuredFieldDefinition
  readonly response?: StructuredFieldResponse | null
  readonly onChange: (response: StructuredFieldResponse) => void
}) {
  if (field.rule.type === "single-choice") {
    const selected = response?.type === "single-choice" && response.selectedOptionId
      ? [response.selectedOptionId]
      : []
    return (
      <ChoiceField
        prompt={field.label}
        options={choices(field.rule.options, [field.rule.correctOptionId])}
        multiple={false}
        selected={selected}
        onChange={(ids) => onChange({ type: "single-choice", selectedOptionId: ids[0] ?? null })}
      />
    )
  }
  if (field.rule.type === "multiple-choice") {
    const selected = response?.type === "multiple-choice" ? response.selectedOptionIds : []
    return (
      <ChoiceField
        prompt={field.label}
        options={choices(field.rule.options, field.rule.correctOptionIds)}
        multiple
        selected={selected}
        onChange={(ids) => onChange({ type: "multiple-choice", selectedOptionIds: ids })}
      />
    )
  }
  if (field.rule.type === "numeric") {
    const value = response?.type === "numeric" ? response.value : ""
    const unit = response?.type === "numeric" ? response.unit ?? "" : ""
    return (
      <div className="quiz-numeric quiz-numeric--structured">
        <input
          value={value}
          onChange={(event) => onChange({ type: "numeric", value: event.target.value, unit })}
          aria-label={field.label}
          placeholder="填写数值或数学表达式"
        />
        {field.rule.unit && (
          <input
            className="quiz-unit"
            value={unit}
            onChange={(event) => onChange({ type: "numeric", value, unit: event.target.value })}
            aria-label={`${field.label}的单位`}
            placeholder="单位"
          />
        )}
      </div>
    )
  }
  const value = response?.type === "exact-text" ? response.value : ""
  return (
    <input
      className="quiz-text-field"
      value={value}
      onChange={(event) => onChange({ type: "exact-text", value: event.target.value })}
      aria-label={field.label}
      placeholder="填写规范的数学表达或结论"
    />
  )
}

function QuestionEditor({
  question,
  response,
  onChange,
}: {
  readonly question: AssessmentQuestion
  readonly response?: QuestionResponse
  readonly onChange: (response: QuestionResponse) => void
}) {
  if (question.type === "single-choice") {
    const selected = response?.type === "single-choice" && response.selectedOptionId
      ? [response.selectedOptionId]
      : []
    return (
      <ChoiceField
        prompt={question.prompt}
        options={choices(question.rule.options, [question.rule.correctOptionId])}
        multiple={false}
        selected={selected}
        onChange={(ids) => onChange({ type: "single-choice", selectedOptionId: ids[0] ?? null })}
      />
    )
  }
  if (question.type === "multiple-choice") {
    const selected = response?.type === "multiple-choice" ? response.selectedOptionIds : []
    return (
      <ChoiceField
        prompt={question.prompt}
        options={choices(question.rule.options, question.rule.correctOptionIds)}
        multiple
        selected={selected}
        onChange={(ids) => onChange({ type: "multiple-choice", selectedOptionIds: ids })}
      />
    )
  }
  if (question.type === "numeric") {
    const value = response?.type === "numeric" ? response.value : ""
    const unit = response?.type === "numeric" ? response.unit ?? "" : ""
    return (
      <div className="quiz-numeric">
        <label>
          <span>数值或表达式</span>
          <input
            value={value}
            onChange={(event) => onChange({ type: "numeric", value: event.target.value, unit })}
            aria-label="数值或表达式"
            placeholder="支持分数、小数、百分数和含 π 的表达式"
          />
        </label>
        {question.rule.unit && (
          <label className="quiz-unit-field">
            <span>单位</span>
            <input
              value={unit}
              onChange={(event) => onChange({ type: "numeric", value, unit: event.target.value })}
              aria-label="单位"
              placeholder="填写单位"
            />
          </label>
        )}
      </div>
    )
  }

  const structured = response?.type === "structured" ? response : undefined
  return (
    <div className="quiz-structured">
      {question.fields.map((field) => (
        <section key={field.id}>
          <header><strong>{field.label}</strong><span>{field.points} 分</span></header>
          <StructuredFieldEditor
            field={field}
            response={structured?.fields[field.id]}
            onChange={(fieldResponse) => onChange({
              type: "structured",
              fields: { ...structured?.fields, [field.id]: fieldResponse },
            })}
          />
          {field.explanation && <small>{field.explanation}</small>}
        </section>
      ))}
    </div>
  )
}

interface QuizRunnerProps {
  readonly topicId: TopicId
  readonly quiz: QuizDefinition
}

const QUIZ_QUESTION_GROUPS = [
  { id: "choice", label: "选择题" },
  { id: "numeric", label: "填空题" },
  { id: "structured", label: "简答题" },
] as const

type QuizQuestionGroupId = typeof QUIZ_QUESTION_GROUPS[number]["id"]

function questionGroupId(question: AssessmentQuestion): QuizQuestionGroupId {
  if (question.type === "single-choice" || question.type === "multiple-choice") {
    return "choice"
  }
  return question.type === "numeric" ? "numeric" : "structured"
}

function questionTypeShortLabel(question: AssessmentQuestion) {
  if (question.type === "single-choice") return "单选"
  if (question.type === "multiple-choice") return "多选"
  return question.type === "numeric" ? "填空" : "简答"
}

function criterionRule(
  question: AssessmentQuestion,
  criterionId: string,
): StructuredFieldRule {
  if (question.type !== "structured") return question.rule
  const field = question.fields.find(({ id }) =>
    criterionId === id || criterionId.startsWith(`${id}.`),
  )
  return field?.rule ?? question.fields[0].rule
}

function formatAnalysisValue(
  value: ExplainableValue,
  rule: StructuredFieldRule,
  emptyLabel: string,
): string {
  const values = Array.isArray(value)
    ? value
    : value === null || value === ""
      ? []
      : [value]
  if (values.length === 0) return emptyLabel

  const options = rule.type === "single-choice" || rule.type === "multiple-choice"
    ? rule.options
    : undefined
  return values.map((item) => {
    const optionIndex = options?.findIndex(({ id }) => id === String(item)) ?? -1
    if (!options || optionIndex < 0) return String(item)
    return `${String.fromCharCode(65 + optionIndex)}. ${options[optionIndex].label}`
  }).join("；")
}

function analysisChoiceGroups(question: AssessmentQuestion): Array<{
  readonly id: string
  readonly label: string
  readonly options: readonly ChoiceOption[]
}> {
  if (question.type === "single-choice" || question.type === "multiple-choice") {
    return question.rule.options
      ? [{ id: "question-options", label: "题目选项", options: question.rule.options }]
      : []
  }
  if (question.type !== "structured") return []
  return question.fields.flatMap((field) => {
    if (
      (field.rule.type !== "single-choice" && field.rule.type !== "multiple-choice") ||
      !field.rule.options
    ) return []
    return [{ id: field.id, label: field.label, options: field.rule.options }]
  })
}

export function QuizRunner({ topicId, quiz }: QuizRunnerProps) {
  const topic = getTopic(topicId)
  const { markStarted, markCompleted } = useModuleProgress(topicId, "quiz")
  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({})
  const [grade, setGrade] = useState<QuizGrade>()
  const resultContentRef = useRef<HTMLDivElement>(null)
  const [attemptContext, setAttemptContext] = useState<AttemptContext>(() => ({
    startedAt: new Date().toISOString(),
    parentAttemptId: null,
    retryIndex: 0,
  }))
  const [submittedAttempt, setSubmittedAttempt] = useState<QuizAttemptRecord>()
  const question = quiz.questions[index]
  const questionGroups = useMemo(() => QUIZ_QUESTION_GROUPS.map((group) => ({
    ...group,
    questions: quiz.questions
      .map((item, questionIndex) => ({ item, questionIndex }))
      .filter(({ item }) => questionGroupId(item) === group.id),
  })).filter(({ questions }) => questions.length > 0), [quiz.questions])
  const answered = useMemo(
    () => quiz.questions.filter((item) => responseExists(responses[item.id])).length,
    [quiz.questions, responses],
  )

  useEffect(() => markStarted(), [markStarted])

  useEffect(() => {
    if (!grade || !resultContentRef.current) return
    resultContentRef.current.scrollTop = 0
  }, [grade, index])

  const submit = () => {
    const nextGrade = gradeQuiz(quiz, responses)
    const attempt = saveAttempt(
      topicId,
      quiz,
      responses,
      nextGrade,
      attemptContext,
    )
    setGrade(nextGrade)
    setSubmittedAttempt(attempt)
    setIndex(0)
    markCompleted()
  }

  const retry = () => {
    setAttemptContext({
      startedAt: new Date().toISOString(),
      parentAttemptId: submittedAttempt?.attemptId ?? null,
      retryIndex: (submittedAttempt?.retryIndex ?? attemptContext.retryIndex) + 1,
    })
    setResponses({})
    setGrade(undefined)
    setSubmittedAttempt(undefined)
    setIndex(0)
  }

  if (grade) {
    const item = grade.questionGrades[index]
    const source = quiz.questions[index]
    const choiceGroups = analysisChoiceGroups(source)
    return (
      <section className="quiz-screen quiz-screen--results">
        <aside className="quiz-map" aria-label="试题导航">
          <div className="quiz-score">
            <span>本次成绩</span>
            <strong>{Math.round(grade.percentage)}<small>分</small></strong>
            <p>{grade.earnedPoints}/{grade.possiblePoints} 分</p>
          </div>
          <div className="quiz-map__groups">
            {questionGroups.map((group) => (
              <section className="quiz-map__group" key={group.id} aria-labelledby={`quiz-result-group-${group.id}`}>
                <h3 id={`quiz-result-group-${group.id}`} aria-label={`${group.label}，${group.questions.length} 题`}><span>{group.label}</span><small>{group.questions.length} 题</small></h3>
                <ol>
                  {group.questions.map(({ item: groupedQuestion, questionIndex }) => {
                    const result = grade.questionGrades[questionIndex]
                    return (
                      <li key={groupedQuestion.id}>
                        <button
                          type="button"
                          className={`${questionIndex === index ? "is-active" : ""} is-${result.status}`}
                          onClick={() => setIndex(questionIndex)}
                        >
                          <span>{questionIndex + 1}</span>
                          <strong>{result.earnedPoints}/{result.possiblePoints} 分</strong>
                          <i aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        </aside>

        <article className="quiz-result-detail">
          <header>
            <div><span>第 {index + 1} 题解析</span><h1>作答结果与答案解析</h1></div>
            <strong className={`quiz-result-state is-${item.status}`}>{item.earnedPoints}/{item.possiblePoints} 分</strong>
          </header>
          <div className="quiz-result-content" ref={resultContentRef}>
            <section className="quiz-analysis-section quiz-analysis-question">
              <h2>完整题目</h2>
              <p>{source.prompt}</p>
              {choiceGroups.length > 0 && (
                <div className="quiz-analysis-choice-groups">
                  <h3>完整选项</h3>
                  {choiceGroups.map((group) => (
                    <section key={group.id}>
                      {source.type === "structured" && <h4>{group.label}</h4>}
                      <ol className="quiz-analysis-options">
                        {group.options.map((option, optionIndex) => (
                          <li key={option.id}>
                            <span>{String.fromCharCode(65 + optionIndex)}</span>
                            <strong>{option.label}</strong>
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              )}
            </section>

            <section className="quiz-analysis-section quiz-analysis-answers">
              <h2>作答情况与正确答案</h2>
              <div className="quiz-criteria">
                {item.criteria.map((criterion) => {
                  const rule = criterionRule(source, criterion.id)
                  return (
                    <section key={criterion.id} className={`is-${criterion.status}`}>
                      <header><strong>{criterion.label}</strong><span>{criterion.earnedPoints}/{criterion.possiblePoints} 分</span></header>
                      <dl>
                        <div>
                          <dt>你的作答</dt>
                          <dd>{formatAnalysisValue(criterion.received, rule, "未作答")}</dd>
                        </div>
                        <div>
                          <dt>正确答案</dt>
                          <dd>{formatAnalysisValue(criterion.expected, rule, "—")}</dd>
                        </div>
                      </dl>
                    </section>
                  )
                })}
              </div>
            </section>

            <section className="quiz-analysis-section quiz-explanation">
              <span>分步解析</span>
              <h2>解题思路与步骤</h2>
              <ol>
                <li>
                  <strong>第一步：识别考点与条件</strong>
                  <p>本题考查{source.knowledgeTags.map((tag) => `「${tag}」`).join("、")}。先确认题目给出的条件与适用的数学模型。</p>
                </li>
                {item.criteria.map((criterion, criterionIndex) => {
                  const rule = criterionRule(source, criterion.id)
                  const expected = formatAnalysisValue(criterion.expected, rule, "—")
                  return (
                    <li key={criterion.id}>
                      <strong>第 {criterionIndex + 2} 步：核对{criterion.label}</strong>
                      <p>本项的标准结论是“{expected}”。{criterion.explanation ?? FEEDBACK_COPY[criterion.feedbackCode] ?? "请根据评分量规核对本项。"}</p>
                    </li>
                  )
                })}
                <li>
                  <strong>第 {item.criteria.length + 2} 步：得出结论并检查边界</strong>
                  <p>{source.explanation ?? "依据定义、公式和模型条件逐项复核，确认结论与题意一致。"}</p>
                </li>
              </ol>
            </section>
          </div>
        </article>

        <aside className="quiz-advice">
          <section>
            <span>KNOWLEDGE DIAGNOSIS</span>
            <h2>知识标签诊断</h2>
            {grade.mastery.map((mastery) => (
              <div className="mastery-row" key={mastery.knowledgeTag}>
                <span>{mastery.knowledgeTag}</span><strong>{Math.round(mastery.percentage)}%</strong>
                <i><b style={{ width: `${mastery.percentage}%` }} /></i>
              </div>
            ))}
          </section>
          <section className="quiz-recommendations">
            <span>学习建议</span>
            {grade.recommendationCodes.map((code) => <p key={code}>{RECOMMENDATION_COPY[code]}</p>)}
          </section>
          <div className="quiz-result-actions">
            <Link to={`${topic.routes.learn}?step=${source.learningStepId ?? ""}`}>返回本题学习步骤</Link>
            <button type="button" onClick={retry}>重新测试</button>
          </div>
        </aside>

        <footer className="quiz-controls">
          <button className="quiz-analysis-nav" type="button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>← 上一题解析</button>
          <span>{submittedAttempt && submittedAttempt.retryIndex > 0
            ? `第 ${submittedAttempt.retryIndex} 次重试已保留；首次提交不会被覆盖`
            : "本次提交已保留；重新测试将另存新记录"}</span>
          <button className="quiz-analysis-nav" type="button" onClick={() => setIndex(Math.min(quiz.questions.length - 1, index + 1))} disabled={index === quiz.questions.length - 1}>下一题解析 →</button>
        </footer>
      </section>
    )
  }

  return (
    <section className="quiz-screen">
      <aside className="quiz-map" aria-label="试题导航">
        <div className="quiz-map__heading">
          <span>ASSESSMENT</span>
          <strong>测试进度</strong>
          <small>题库 {quiz.version}</small>
        </div>
        <div className="quiz-map__groups">
          {questionGroups.map((group) => (
            <section className="quiz-map__group" key={group.id} aria-labelledby={`quiz-group-${group.id}`}>
              <h3 id={`quiz-group-${group.id}`} aria-label={`${group.label}，${group.questions.length} 题`}><span>{group.label}</span><small>{group.questions.length} 题</small></h3>
              <ol>
                {group.questions.map(({ item, questionIndex }) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`${questionIndex === index ? "is-active" : ""} ${responseExists(responses[item.id]) ? "is-answered" : ""}`}
                      onClick={() => setIndex(questionIndex)}
                    >
                      <span>{questionIndex + 1}</span>
                      <strong>{questionTypeShortLabel(item)}</strong>
                      <i aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        <div className="quiz-map__progress"><span>已作答</span><strong>{answered}/{quiz.questions.length}</strong><i><b style={{ width: `${answered / quiz.questions.length * 100}%` }} /></i></div>
      </aside>

      <article className="quiz-question">
        <header>
          <div>
            <span>第 {index + 1} 题 · {question.points} 分</span>
            <div>{question.knowledgeTags.map((tag) => <small key={tag}>{tag}</small>)}</div>
          </div>
          <strong>{question.type === "single-choice" ? "单项选择题" : question.type === "multiple-choice" ? "多项选择题" : question.type === "numeric" ? "填空题" : "结构化简答题"}</strong>
        </header>
        <h1>{question.prompt}</h1>
        <div className="quiz-answer-area">
          <QuestionEditor
            question={question}
            response={responses[question.id]}
            onChange={(response) => setResponses((current) => ({ ...current, [question.id]: response }))}
          />
        </div>
      </article>

      <aside className="quiz-guidance">
        <section>
          <span>ANSWER GUIDE</span>
          <h2>作答要求</h2>
          <p>{question.type === "structured"
            ? "公式、计算、结论和模型限制分别填写，各项独立计分。"
            : question.type === "numeric"
              ? "可以输入分数、小数、百分数或含 π 的受限数学表达式。"
              : "先判断题目中的模型条件，再选择与条件一致的结论。"}</p>
        </section>
        <section className="quiz-boundary-note">
          <span>评分说明</span>
          <p>本测试采用确定性量规评分。整卷提交后显示标准答案、分项得分和学习建议。</p>
        </section>
        <div className="quiz-draft-state">
          <span>当前题状态</span>
          <strong>{responseExists(responses[question.id]) ? "已记录答案" : "尚未作答"}</strong>
          <small>切换题目不会丢失当前答案</small>
        </div>
      </aside>

      <footer className="quiz-controls">
        <button type="button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>← 上一题</button>
        <div><span>{index + 1} / {quiz.questions.length}</span><i><b style={{ width: `${(index + 1) / quiz.questions.length * 100}%` }} /></i></div>
        {index < quiz.questions.length - 1 ? (
          <button type="button" onClick={() => setIndex(index + 1)}>下一题 →</button>
        ) : (
          <button className="is-primary" type="button" onClick={submit}>提交整份测试</button>
        )}
      </footer>
    </section>
  )
}
