import { TopicShell } from "../../../app/layouts"
import {
  QuizRunner,
  type QuizDefinition,
} from "../../../shared/assessment"
import "../topic.css"

export const ELEVATOR_QUIZ: QuizDefinition = {
  id: "elevator-idle-floor-quiz",
  version: "1.0.0",
  questions: [
    {
      id: "elevator-choice-1",
      type: "single-choice",
      prompt: "本课题中的“电梯停在 p 层”表示什么？",
      points: 5,
      knowledgeTags: ["模型定义"],
      learningStepId: "elevator-data",
      explanation: "p 表示电梯无任务时等待下一次呼叫的空闲停靠层，不表示取消其他楼层的正常停靠。",
      rule: {
        type: "single-choice",
        correctOptionId: "idle",
        options: [
          { id: "idle", label: "电梯无任务时的空闲停靠层" },
          { id: "only", label: "电梯唯一允许停靠的楼层" },
          { id: "destination", label: "所有乘客的目的楼层" },
          { id: "average", label: "楼层编号的算术平均数" },
        ],
      },
    },
    {
      id: "elevator-choice-2",
      type: "single-choice",
      prompt: "呼叫发生在 9 层，电梯空闲停在 4 层。楼层距离的正确表示是哪个？",
      points: 5,
      knowledgeTags: ["绝对值", "楼层距离"],
      learningStepId: "elevator-distance",
      explanation: "楼层距离必须为非负数，因此 d(9,4)=|9−4|=5。",
      rule: {
        type: "single-choice",
        correctOptionId: "absolute",
        options: [
          { id: "subtract", label: "4−9=−5" },
          { id: "absolute", label: "|9−4|=5" },
          { id: "sum", label: "9+4=13" },
          { id: "product", label: "9×4=36" },
        ],
      },
    },
    {
      id: "elevator-choice-3",
      type: "multiple-choice",
      prompt: "比较不同空闲停靠层时，选择所有符合本模型的做法。",
      points: 5,
      knowledgeTags: ["频数加权", "公平比较", "模型假设"],
      learningStepId: "elevator-weighting",
      explanation: "方案比较必须复用同一数据集，并对每层距离按频数加权；每个候选层重新抽样会混入抽样波动。",
      rule: {
        type: "multiple-choice",
        correctOptionIds: ["same-data", "weight", "absolute"],
        scoring: "proportional-without-wrong-selections",
        options: [
          { id: "same-data", label: "全部候选层使用同一组呼叫记录" },
          { id: "weight", label: "用 fᵢ 乘以该层的楼层距离" },
          { id: "absolute", label: "向上与向下距离都取绝对值" },
          { id: "resample", label: "每个候选层重新生成一批随机呼叫" },
        ],
      },
    },
    {
      id: "elevator-choice-4",
      type: "single-choice",
      prompt: "累计频数在 5 层恰好达到总频数的一半，下一个正频数楼层是 8 层。总距离最优的整数楼层是哪些？",
      points: 5,
      knowledgeTags: ["加权中位数", "并列最优"],
      learningStepId: "elevator-optimum",
      explanation: "半权重恰好落在两个正频数楼层之间时，5、6、7、8 层的加权绝对距离和相同且均为最小值。",
      rule: {
        type: "single-choice",
        correctOptionId: "interval",
        options: [
          { id: "lower", label: "只有 5 层" },
          { id: "middle", label: "只有 6 层和 7 层" },
          { id: "upper", label: "只有 8 层" },
          { id: "interval", label: "5、6、7、8 层" },
        ],
      },
    },
    {
      id: "elevator-choice-5",
      type: "single-choice",
      prompt: "关于“总估计响应时间最小”和“最大估计响应时间最小”，哪项结论正确？",
      points: 5,
      knowledgeTags: ["评价指标", "方案优化"],
      learningStepId: "elevator-objective",
      explanation: "总量考虑全部呼叫及频数，最大值只关注最不利的一次呼叫，因此两个目标可能给出不同的最优楼层。",
      rule: {
        type: "single-choice",
        correctOptionId: "different",
        options: [
          { id: "same", label: "两个目标在任何数据下都给出同一楼层" },
          { id: "different", label: "两个目标可能给出不同的最优楼层" },
          { id: "fixed", label: "固定时间越大，加权中位数一定越高" },
          { id: "frequency-free", label: "总量目标与楼层频数无关" },
        ],
      },
    },
    {
      id: "elevator-numeric-1",
      type: "numeric",
      prompt: "2 层有 4 次呼叫，7 层有 2 次呼叫。若 p=4，计算加权总距离 D(p)。",
      points: 10,
      knowledgeTags: ["频数加权", "加权总距离"],
      learningStepId: "elevator-weighting",
      explanation: "D(4)=4×|2−4|+2×|7−4|=4×2+2×3=14。",
      rule: { type: "numeric", acceptedValues: [14] },
    },
    {
      id: "elevator-numeric-2",
      type: "numeric",
      prompt: "沿用上一题数据。每层运行时间 τ=2 秒，固定时间 t₀=3 秒，计算总估计响应时间 T(4)。",
      points: 10,
      knowledgeTags: ["总估计响应时间", "代数计算"],
      learningStepId: "elevator-weighting",
      explanation: "共有 6 次呼叫，T(4)=6×3+2×14=46 秒。",
      rule: {
        type: "numeric",
        acceptedValues: [46],
        unit: { acceptedUnits: ["秒", "s"], required: false, scoreWeight: 0.1 },
      },
    },
    {
      id: "elevator-numeric-3",
      type: "numeric",
      prompt: "沿用上一题结果，计算 p=4 时的平均估计响应时间（秒，结果可写分数或近似小数）。",
      points: 10,
      knowledgeTags: ["平均数", "平均估计响应时间"],
      learningStepId: "elevator-objective",
      explanation: "平均估计响应时间为 46÷6=23/3≈7.67 秒。",
      rule: {
        type: "numeric",
        acceptedValues: ["23/3"],
        tolerance: { absolute: 0.01, relative: 0 },
        unit: { acceptedUnits: ["秒", "s"], required: false, scoreWeight: 0.1 },
      },
    },
    {
      id: "elevator-structured-1",
      type: "structured",
      prompt: "某楼有 4 层。1 层、3 层、4 层的呼叫频数分别为 2、3、1。检验候选停靠层 p=3。",
      points: 20,
      knowledgeTags: ["数学表达", "加权总距离", "模型估计响应时间"],
      learningStepId: "elevator-weighting",
      explanation: "先写出加权绝对距离模型，再逐层计算 D(3)=2×2+3×0+1×1=5；若 τ=2、t₀=4，则 T(3)=6×4+2×5=34 秒。",
      fields: [
        {
          id: "formula",
          label: "写出加权总距离公式",
          points: 5,
          knowledgeTags: ["数学表达"],
          explanation: "规范表达为 D(p)=Σfᵢ|i−p|。",
          rule: {
            type: "exact-text",
            acceptedAnswers: ["D(p)=Σfᵢ|i−p|", "D(p)=Σfi|i-p|"],
            normalization: { whitespace: "remove" },
          },
        },
        {
          id: "distance",
          label: "计算 D(3)",
          points: 8,
          knowledgeTags: ["加权总距离"],
          explanation: "2×|1−3|+3×|3−3|+1×|4−3|=5。",
          rule: { type: "numeric", acceptedValues: [5] },
        },
        {
          id: "time",
          label: "当 τ=2 秒、t₀=4 秒时计算 T(3)",
          points: 7,
          knowledgeTags: ["模型估计响应时间"],
          explanation: "T(3)=6×4+2×5=34 秒。",
          rule: { type: "numeric", acceptedValues: [34] },
        },
      ],
    },
    {
      id: "elevator-structured-2",
      type: "structured",
      prompt: "1 层有 8 次呼叫，9 层有 1 次呼叫。分别判断总量目标和最大值目标的最佳整数停靠层，并说明模型边界。",
      points: 25,
      knowledgeTags: ["评价指标", "加权中位数", "模型边界"],
      learningStepId: "elevator-objective",
      explanation: "总量受频数影响，加权中位数为 1 层；最大值由 1 层与 9 层的最远距离决定，中点 5 层最优。结论只适用于声明的简化模型。",
      fields: [
        {
          id: "total-floor",
          label: "总量目标的最佳楼层",
          points: 8,
          knowledgeTags: ["加权中位数"],
          explanation: "超过一半的呼叫位于 1 层，因此加权中位数为 1。",
          rule: { type: "numeric", acceptedValues: [1] },
        },
        {
          id: "max-floor",
          label: "最大值目标的最佳楼层",
          points: 8,
          knowledgeTags: ["评价指标"],
          explanation: "5 层到 1 层和 9 层的最远距离均为 4 层。",
          rule: { type: "numeric", acceptedValues: [5] },
        },
        {
          id: "boundary",
          label: "选择符合模型边界的结论",
          points: 9,
          knowledgeTags: ["模型边界"],
          explanation: "该模型忽略真实调度因素，不能直接据此修改真实电梯系统。",
          rule: {
            type: "single-choice",
            correctOptionId: "limited",
            options: [
              { id: "limited", label: "结论只适用于给定简化条件，真实系统还需更多数据与调度模型" },
              { id: "universal", label: "结论可直接用于任何多电梯建筑" },
              { id: "private", label: "必须记录居民姓名和门牌号才能计算" },
            ],
          },
        },
      ],
    },
  ],
}

export default function ElevatorQuizPage() {
  return (
    <TopicShell topicId="elevator" module="quiz">
      <QuizRunner topicId="elevator" quiz={ELEVATOR_QUIZ} />
    </TopicShell>
  )
}
