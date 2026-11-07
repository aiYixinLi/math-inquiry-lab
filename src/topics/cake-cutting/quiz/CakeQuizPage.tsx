import { TopicShell } from "../../../app/layouts"
import { QuizRunner, type QuizDefinition } from "../../../shared/assessment"
import "../topic.css"

export const CAKE_QUIZ: QuizDefinition = {
  id: "cake-cutting-foundations",
  version: "1.0.0",
  questions: [
    {
      id: "cake-choice-criterion",
      type: "single-choice",
      prompt: "比较两种蛋糕切法是否公平之前，首先必须确定什么？",
      points: 5,
      knowledgeTags: ["公平指标", "模型表达"],
      learningStepId: "cake-fairness-definition",
      explanation: "公平不是未加说明的单一数值。必须先声明比较面积、原外边界、整块周长还是切割成本，再依据相应数据作结论。",
      rule: {
        type: "single-choice",
        correctOptionId: "criterion",
        options: [
          { id: "criterion", label: "采用的公平评价指标" },
          { id: "color", label: "每块蛋糕的颜色" },
          { id: "order", label: "参与者选择蛋糕的顺序" },
          { id: "drawing", label: "图形在屏幕上的显示大小" },
        ],
      },
    },
    {
      id: "cake-choice-sector-ratio",
      type: "single-choice",
      prompt: "在同一个圆中，两个圆心扇形的面积比等于下列哪一个比？",
      points: 5,
      knowledgeTags: ["扇形面积", "比例"],
      learningStepId: "cake-circle-sector",
      explanation: "Aᵢ=(θᵢ/360°)πr²。同一个圆的 πr²/360° 相同，因此面积比等于圆心角之比。",
      rule: {
        type: "single-choice",
        correctOptionId: "angles",
        options: [
          { id: "angles", label: "圆心角之比" },
          { id: "radii", label: "半径之比" },
          { id: "diameters", label: "直径之比" },
          { id: "cuts", label: "切口条数之比" },
        ],
      },
    },
    {
      id: "cake-choice-perimeter-identity",
      type: "single-choice",
      prompt: "设原蛋糕外周长为 P原，内部切线总长为 L。所有小块周长之和应为多少？",
      points: 5,
      knowledgeTags: ["周长组成", "内部切线"],
      learningStepId: "cake-boundary-composition",
      explanation: "原外边界在全部小块中合计一次；每条内部切线属于相邻两块，在小块周长总和中合计两次。",
      rule: {
        type: "single-choice",
        correctOptionId: "outer-plus-two-cuts",
        options: [
          { id: "outer-plus-two-cuts", label: "P原 + 2L" },
          { id: "outer-plus-cuts", label: "P原 + L" },
          { id: "twice-outer-plus-cuts", label: "2P原 + L" },
          { id: "outer-only", label: "P原" },
        ],
      },
    },
    {
      id: "cake-choice-equal-sectors",
      type: "multiple-choice",
      prompt: "同一圆形蛋糕从圆心切成四个等角扇形。下列哪些量对四块分别相等？",
      points: 5,
      knowledgeTags: ["扇形面积", "外边界", "周长组成"],
      learningStepId: "cake-circle-sector",
      explanation: "半径相同且圆心角相等，使面积与外圆弧相等；每块新增两条半径，所以整块周长也相等。",
      rule: {
        type: "multiple-choice",
        correctOptionIds: ["area", "arc", "perimeter"],
        scoring: "proportional-without-wrong-selections",
        options: [
          { id: "area", label: "面积" },
          { id: "arc", label: "原蛋糕外圆弧" },
          { id: "perimeter", label: "整块周长" },
          { id: "radius", label: "圆的半径会因切分而改变" },
        ],
      },
    },
    {
      id: "cake-choice-model-boundary",
      type: "single-choice",
      prompt: "程序用面积表示每人分得的蛋糕份量时，需要下列哪项模型假设？",
      points: 5,
      knowledgeTags: ["模型边界", "面积份额"],
      learningStepId: "cake-area-share",
      explanation: "只有厚度、密度、馅料与装饰分布足够均匀时，相等面积才可近似代表相等食用量；否则应比较体积或质量。",
      rule: {
        type: "single-choice",
        correctOptionId: "uniform",
        options: [
          { id: "uniform", label: "厚度、密度、馅料和装饰分布均匀" },
          { id: "screen", label: "屏幕上每块使用相同颜色" },
          { id: "random", label: "每次切割位置必须随机" },
          { id: "freehand", label: "切线必须由手绘产生" },
        ],
      },
    },
    {
      id: "cake-fill-sector-area",
      type: "numeric",
      prompt: "半径为 12 cm 的圆形蛋糕平均切成 6 个圆心扇形。每块面积是多少？",
      points: 10,
      knowledgeTags: ["扇形面积", "面积单位"],
      learningStepId: "cake-circle-sector",
      explanation: "整圆面积为 144π cm²，六等分后每块面积为 144π÷6=24π cm²。",
      rule: {
        type: "numeric",
        acceptedValues: ["24π"],
        unit: {
          acceptedUnits: ["cm²", "平方厘米"],
          scoreWeight: 0.2,
        },
      },
    },
    {
      id: "cake-fill-strip-area",
      type: "numeric",
      prompt: "边长为 12 cm 的正方形蛋糕沿同一方向切成 4 条等宽条带。每条面积是多少？",
      points: 10,
      knowledgeTags: ["矩形面积", "平行条带"],
      learningStepId: "cake-area-share",
      explanation: "每条宽 12÷4=3 cm，长度为 12 cm，所以每条面积为 3×12=36 cm²。",
      rule: {
        type: "numeric",
        acceptedValues: [36],
        unit: {
          acceptedUnits: ["cm²", "平方厘米"],
          scoreWeight: 0.2,
        },
      },
    },
    {
      id: "cake-fill-grid-perimeter-sum",
      type: "numeric",
      prompt: "边长 12 cm 的正方形蛋糕切成 2×2 网格。原外周长为 48 cm，内部切线总长为 24 cm。四块周长之和是多少？",
      points: 10,
      knowledgeTags: ["周长恒等式", "矩形网格"],
      learningStepId: "cake-boundary-composition",
      explanation: "ΣPᵢ=P原+2L内部=48+2×24=96 cm。",
      rule: {
        type: "numeric",
        acceptedValues: [96],
        unit: {
          acceptedUnits: ["cm", "厘米"],
          scoreWeight: 0.2,
        },
      },
    },
    {
      id: "cake-structured-four-sectors",
      type: "structured",
      prompt: "半径 12 cm 的圆形蛋糕平均切成 4 个圆心扇形。提交公式、每块面积与面积公平结论。",
      points: 20,
      knowledgeTags: ["扇形面积", "面积公平", "数学表达"],
      learningStepId: "cake-plan-comparison",
      explanation: "四等角扇形的圆心角均为 90°，每块面积为 (90/360)×144π=36π cm²，因此在面积指标下相等。",
      fields: [
        {
          id: "formula",
          label: "扇形面积公式",
          points: 5,
          knowledgeTags: ["扇形面积", "数学表达"],
          explanation: "公式必须同时包含圆心角占 360° 的比例和整圆面积 πr²。",
          rule: {
            type: "exact-text",
            acceptedAnswers: ["A=θ/360°·πr²", "A=θ/360*πr²", "A=θ÷360×πr²"],
            normalization: { whitespace: "remove" },
          },
        },
        {
          id: "area",
          label: "每块面积",
          points: 8,
          knowledgeTags: ["扇形面积", "面积单位"],
          explanation: "90° 占整圆的四分之一，所以每块面积为 36π cm²。",
          rule: {
            type: "numeric",
            acceptedValues: ["36π"],
            unit: { acceptedUnits: ["cm²", "平方厘米"] },
          },
        },
        {
          id: "conclusion",
          label: "面积公平结论",
          points: 7,
          knowledgeTags: ["面积公平"],
          explanation: "四块面积均等于目标面积 36π cm²。",
          rule: {
            type: "single-choice",
            correctOptionId: "equal",
            options: [
              { id: "equal", label: "四块面积相等" },
              { id: "not-equal", label: "四块面积不相等" },
            ],
          },
        },
      ],
    },
    {
      id: "cake-structured-square-strips",
      type: "structured",
      prompt: "边长 12 cm 的正方形蛋糕切成 4 条等宽竖直条带。判断哪些分块指标相等，并核对周长恒等式。",
      points: 25,
      knowledgeTags: ["平行条带", "公平指标", "周长恒等式", "模型结论"],
      learningStepId: "cake-plan-comparison",
      explanation: "每条均为 3×12 的矩形，面积与总周长相等；外侧条带保留的原边界比中间条带长。四块周长之和为 120 cm。",
      fields: [
        {
          id: "equal-indicators",
          label: "选择分别相等的指标",
          points: 10,
          knowledgeTags: ["公平指标", "平行条带"],
          explanation: "四块面积均为 36 cm²，总周长均为 30 cm；原外边界分别为 18、6、6、18 cm。",
          rule: {
            type: "multiple-choice",
            correctOptionIds: ["area", "perimeter"],
            scoring: "proportional-without-wrong-selections",
            options: [
              { id: "area", label: "面积" },
              { id: "perimeter", label: "整块周长" },
              { id: "outer", label: "原蛋糕外边界" },
            ],
          },
        },
        {
          id: "perimeter-sum",
          label: "四块周长之和",
          points: 8,
          knowledgeTags: ["周长恒等式"],
          explanation: "原外周长 48 cm，三条内部切线共 36 cm，所以总和为 48+2×36=120 cm。",
          rule: {
            type: "numeric",
            acceptedValues: [120],
            unit: { acceptedUnits: ["cm", "厘米"] },
          },
        },
        {
          id: "boundary-conclusion",
          label: "规范结论",
          points: 7,
          knowledgeTags: ["模型结论"],
          explanation: "面积公平与外沿公平是不同标准，不能由一个指标相等推断另一个指标也相等。",
          rule: {
            type: "exact-text",
            acceptedAnswers: ["面积相等不代表外沿相等", "面积相等不一定外沿相等", "面积相等不必然使外沿相等"],
            normalization: { whitespace: "remove" },
          },
        },
      ],
    },
  ],
}

export default function CakeQuizPage() {
  return (
    <TopicShell topicId="cake-cutting" module="quiz">
      <QuizRunner topicId="cake-cutting" quiz={CAKE_QUIZ} />
    </TopicShell>
  )
}
