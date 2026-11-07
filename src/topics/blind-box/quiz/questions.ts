import type { QuizDefinition } from "../../../shared/assessment"

export const BLIND_BOX_QUIZ: QuizDefinition = {
  id: "blind-box-core-v1",
  version: "1.0.0",
  questions: [
    {
      id: "blind-q01-model",
      type: "single-choice",
      prompt: "下列哪一项符合本课题使用的盲盒数学模型？",
      points: 5,
      knowledgeTags: ["等可能概率", "模型边界"],
      learningStepId: "blind-model",
      explanation:
        "模型包含六款等概率、各次独立、允许重复，并以首次集齐六款作为一轮的停止条件；真实销售中的隐藏款或保底机制不在模型内。",
      rule: {
        type: "single-choice",
        correctOptionId: "equiprobable-independent",
        options: [
          { id: "equiprobable-independent", label: "六款等概率，各次独立且允许重复" },
          { id: "without-replacement", label: "抽到某款后，该款从后续抽取中移除" },
          { id: "guaranteed", label: "每购买六盒必定得到六种不同款式" },
          { id: "hidden", label: "含隐藏款与保底机制，且概率随购买次数变化" },
        ],
      },
    },
    {
      id: "blind-q02-independence",
      type: "multiple-choice",
      prompt: "关于独立重复抽取，下列结论哪些正确？",
      points: 5,
      knowledgeTags: ["独立重复", "重复款"],
      learningStepId: "blind-independent",
      explanation:
        "独立性表示此前结果不改变下一次各款概率，并不排除重复。购买次数与已收集的不同款式数是两个不同变量。",
      rule: {
        type: "multiple-choice",
        correctOptionIds: ["same-probability", "repeat-possible", "distinct-not-draws"],
        scoring: "proportional-without-wrong-selections",
        options: [
          { id: "same-probability", label: "连续得到 A 款后，下一次 A 款概率仍为 1/6" },
          { id: "repeat-possible", label: "相互独立的抽取仍然可能出现重复款" },
          { id: "distinct-not-draws", label: "购买六盒时，不同款式数可能少于六" },
          { id: "no-repeat", label: "独立意味着相邻两次结果必定不同" },
        ],
      },
    },
    {
      id: "blind-q03-six-boxes",
      type: "single-choice",
      prompt: "恰好购买六盒就集齐六款的概率约为多少？",
      points: 5,
      knowledgeTags: ["等可能概率", "排列"],
      learningStepId: "blind-independent",
      explanation:
        "六次抽取共有 6⁶ 个等可能序列；恰好集齐要求六款各出现一次，有 6! 个序列，因此概率为 6!/6⁶≈1.54%。",
      rule: {
        type: "single-choice",
        correctOptionId: "one-point-five-four",
        options: [
          { id: "one-point-five-four", label: "约 1.54%" },
          { id: "sixteen-point-seven", label: "约 16.67%" },
          { id: "fifty", label: "50%" },
          { id: "certain", label: "100%" },
        ],
      },
    },
    {
      id: "blind-q04-theory-mean",
      type: "single-choice",
      prompt: "对理论平均集齐次数 14.70 的解释，哪一项正确？",
      points: 5,
      knowledgeTags: ["平均等待", "理论平均"],
      learningStepId: "blind-waiting",
      explanation:
        "14.70 是六个阶段理论平均等待次数之和，描述大量独立重复实验的平均趋势，不是每一轮的固定结果或上限。",
      rule: {
        type: "single-choice",
        correctOptionId: "long-run-mean",
        options: [
          { id: "long-run-mean", label: "大量独立实验中每轮购买次数的理论平均" },
          { id: "every-round", label: "每一轮都必须购买 14.70 盒" },
          { id: "maximum", label: "任意一轮购买次数都不会超过 14.70" },
          { id: "minimum", label: "集齐六款至少需要购买 14.70 盒" },
        ],
      },
    },
    {
      id: "blind-q05-sample-conclusion",
      type: "single-choice",
      prompt: "某次 10 轮模拟的平均集齐次数为 16.2。由此可以得到什么结论？",
      points: 5,
      knowledgeTags: ["随机波动", "数据与理论"],
      learningStepId: "blind-data-theory",
      explanation:
        "有限样本均值会随样本发生随机波动。单个小样本与 14.70 不相等，不能单独否定理论推导。",
      rule: {
        type: "single-choice",
        correctOptionId: "finite-variation",
        options: [
          { id: "finite-variation", label: "该样本出现了随机波动，尚不足以否定理论平均" },
          { id: "theory-false", label: "理论平均 14.70 必定错误" },
          { id: "all-future", label: "今后每组 10 轮的平均都将等于 16.2" },
          { id: "single-round", label: "每一轮的集齐次数都是 16.2" },
        ],
      },
    },
    {
      id: "blind-q06-stage-probability",
      type: "numeric",
      prompt: "已经收集 4 种不同款式。下一盒得到新款的概率是多少？",
      points: 10,
      knowledgeTags: ["阶段概率", "分数与百分数"],
      learningStepId: "blind-stage-probability",
      explanation:
        "尚未收集的款式有 6−4=2 种，因此 P(新款)=2/6=1/3。可用分数、小数或百分数表示。",
      rule: {
        type: "numeric",
        acceptedValues: ["1/3"],
        tolerance: { absolute: 0.001, relative: 0 },
      },
    },
    {
      id: "blind-q07-sample-mean",
      type: "numeric",
      prompt: "8 轮实验的集齐次数为 12、14、16、9、15、18、13、11。计算平均集齐次数。",
      points: 10,
      knowledgeTags: ["算术平均数", "实验数据"],
      learningStepId: "blind-data-theory",
      explanation:
        "八个数据之和为 108，算术平均数为 108÷8=13.5 盒/轮。",
      rule: {
        type: "numeric",
        acceptedValues: [13.5],
        tolerance: { absolute: 0.0001, relative: 0 },
        unit: { acceptedUnits: ["盒/轮", "盒每轮"], required: false, scoreWeight: 0.1 },
      },
    },
    {
      id: "blind-q08-repeat-rate",
      type: "numeric",
      prompt: "某轮购买 17 盒后首次集齐六款。以购买次数为分母，该轮重复款比例是多少？",
      points: 10,
      knowledgeTags: ["重复款", "比例"],
      learningStepId: "blind-independent",
      explanation:
        "首次集齐时有 6 次用于获得六种新款，其余 17−6=11 次为重复款；重复款比例为 11/17≈64.7%。",
      rule: {
        type: "numeric",
        acceptedValues: ["11/17"],
        tolerance: { absolute: 0.001, relative: 0 },
      },
    },
    {
      id: "blind-q09-last-stage",
      type: "structured",
      prompt: "已有 5 款时，分项说明下一盒获得最后一款的概率及其模型条件。",
      points: 20,
      knowledgeTags: ["阶段概率", "平均等待", "模型边界"],
      learningStepId: "blind-waiting",
      explanation:
        "从一般公式代入 k=5 得 P(新款)=1/6，对应平均等待 6 盒。结论仅在六款等概率、各次独立且允许重复的模型中成立。",
      fields: [
        {
          id: "formula",
          label: "一般公式",
          points: 5,
          knowledgeTags: ["阶段概率"],
          explanation: "规范公式为 P(新款)=(6−k)/6。",
          rule: {
            type: "exact-text",
            acceptedAnswers: ["P(新款)=(6-k)/6", "(6-k)/6"],
            normalization: { whitespace: "remove" },
          },
        },
        {
          id: "probability",
          label: "代入 k=5 的概率",
          points: 5,
          knowledgeTags: ["阶段概率"],
          explanation: "(6−5)/6=1/6。",
          rule: { type: "numeric", acceptedValues: ["1/6"] },
        },
        {
          id: "waiting",
          label: "平均等待结论",
          points: 5,
          knowledgeTags: ["平均等待"],
          explanation: "成功概率为 1/6，所以平均等待 1÷(1/6)=6 盒。",
          rule: {
            type: "single-choice",
            correctOptionId: "six-boxes-average",
            options: [
              { id: "six-boxes-average", label: "平均等待 6 盒，但单轮可能更多或更少" },
              { id: "six-boxes-certain", label: "再买 6 盒一定得到最后一款" },
              { id: "no-limit-mean", label: "不存在理论平均等待次数" },
            ],
          },
        },
        {
          id: "conditions",
          label: "适用条件",
          points: 5,
          knowledgeTags: ["模型边界"],
          explanation: "等概率与独立重复是使用该公式的必要模型条件。",
          rule: {
            type: "multiple-choice",
            correctOptionIds: ["equal", "independent"],
            scoring: "proportional-without-wrong-selections",
            options: [
              { id: "equal", label: "六款概率均为 1/6" },
              { id: "independent", label: "各次抽取相互独立" },
              { id: "guarantee", label: "存在六盒保底" },
              { id: "exchange", label: "允许抽取后交换款式" },
            ],
          },
        },
      ],
    },
    {
      id: "blind-q10-data-theory",
      type: "structured",
      prompt: "30 轮模拟均值为 16.20，而理论平均为 14.70。分项完成比较、解释与改进方案。",
      points: 25,
      knowledgeTags: ["数据与理论", "随机波动", "证据边界"],
      learningStepId: "blind-data-theory",
      explanation:
        "样本均值比理论平均高 1.50 盒。它是有限模拟样本的统计量，偏差可能来自随机波动；应在保持同一模型的前提下增加独立轮数并比较分布与累计均值。",
      fields: [
        {
          id: "difference",
          label: "均值差（模拟均值−理论平均）",
          points: 5,
          knowledgeTags: ["数据与理论"],
          explanation: "16.20−14.70=1.50 盒/轮。",
          rule: {
            type: "numeric",
            acceptedValues: [1.5],
            tolerance: { absolute: 0.0001, relative: 0 },
          },
        },
        {
          id: "source",
          label: "数值性质",
          points: 5,
          knowledgeTags: ["证据边界"],
          explanation: "16.20 是有限模拟数据的样本均值，14.70 是由模型推导的理论平均。",
          rule: {
            type: "single-choice",
            correctOptionId: "sample-vs-theory",
            options: [
              { id: "sample-vs-theory", label: "16.20 是样本统计量，14.70 是理论量" },
              { id: "both-theory", label: "两者都是不依赖数据的理论量" },
              { id: "both-single", label: "两者都表示某一轮的固定结果" },
            ],
          },
        },
        {
          id: "conclusion",
          label: "解释结论",
          points: 7,
          knowledgeTags: ["随机波动"],
          explanation: "30 轮仍是有限样本，均值偏离 14.70 不能单独否定理论结果。",
          rule: {
            type: "single-choice",
            correctOptionId: "variation",
            options: [
              { id: "variation", label: "偏差可能来自有限样本的随机波动" },
              { id: "disprove", label: "偏差已经证明理论推导错误" },
              { id: "guarantee", label: "下一组 30 轮必定低于 14.70" },
            ],
          },
        },
        {
          id: "improvement",
          label: "进一步检验",
          points: 8,
          knowledgeTags: ["证据边界", "随机波动"],
          explanation: "在模型条件不变时增加独立轮数，并同时观察分布和累计均值。",
          rule: {
            type: "multiple-choice",
            correctOptionIds: ["more-rounds", "same-model", "inspect-distribution"],
            scoring: "proportional-without-wrong-selections",
            options: [
              { id: "more-rounds", label: "增加独立模拟轮数" },
              { id: "same-model", label: "比较时保持概率与停止条件一致" },
              { id: "inspect-distribution", label: "同时观察直方图与累计均值" },
              { id: "remove-high", label: "删除所有高于 14.70 的轮次" },
            ],
          },
        },
      ],
    },
  ],
} as const
