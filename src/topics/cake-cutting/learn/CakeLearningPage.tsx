import { useMemo, useState } from "react"
import { TopicShell } from "../../../app/layouts"
import {
  defineInlineMath,
  InlineMath,
  LearningScreen,
  MathText,
  type LearningStep,
} from "../../../shared/learning"
import {
  CirclePartitionSvg,
  type BoundaryMode,
} from "../components/CakePartitionSvg"
import {
  createCircularSectorPartition,
  createEqualParallelStripPartition,
  createEqualRectangularGridPartition,
} from "../playground/geometry"
import "../topic.css"

const CAKE_INLINE_MATH = defineInlineMath(
  ["A总=ΣAᵢ>0", "A_{\\text{总}}=\\sum_i A_i>0"],
  ["A*=A总/n", "A^*=\\frac{A_{\\text{总}}}{n}"],
  ["Aᵢ/A总", "\\frac{A_i}{A_{\\text{总}}}"],
  ["sᵢ=Aᵢ/A总", "s_i=\\frac{A_i}{A_{\\text{总}}}"],
  ["Aᵢ=A*", "A_i=A^*"],
  ["sᵢ=1/n", "s_i=\\frac{1}{n}"],
  ["100%÷n", "\\frac{100\\%}{n}"],
  ["A*=144÷4=36 cm²", "A^*=\\frac{144}{4}=36\\,\\mathrm{cm}^2"],
  ["144÷4=36 cm²", "\\frac{144}{4}=36\\,\\mathrm{cm}^2"],
  ["1/4", "\\frac{1}{4}"],
  ["25%", "25\\%"],
  ["100%", "100\\%"],
  ["θᵢ∈(0°,360°]", "\\theta_i\\in(0^{\\circ},360^{\\circ}]"],
  ["y=kx", "y=kx"],
  ["θᵢ/360°", "\\frac{\\theta_i}{360^{\\circ}}"],
  ["Aᵢ=(θᵢ/360°)πr²", "A_i=\\frac{\\theta_i}{360^{\\circ}}\\pi r^2"],
  ["25π cm²", "25\\pi\\,\\mathrm{cm}^2"],
  ["5π cm", "5\\pi\\,\\mathrm{cm}"],
  ["90°", "90^{\\circ}"],
  ["360°", "360^{\\circ}"],
  ["ΣBᵢ=P原", "\\sum_i B_i=P_{\\text{原}}"],
  ["ΣCᵢ=2L内部", "\\sum_i C_i=2L_{\\text{内部}}"],
  ["Pᵢ=Bᵢ+Cᵢ", "P_i=B_i+C_i"],
  ["80+2×30=140 cm", "80+2\\times30=140\\,\\mathrm{cm}"],
  ["2L内部", "2L_{\\text{内部}}"],
  ["E_A=maxᵢ|Aᵢ−A*|/A*", "E_A=\\frac{\\max_i\\lvert A_i-A^*\\rvert}{A^*}"],
  ["R_X=maxᵢXᵢ−minᵢXᵢ", "R_X=\\max_i X_i-\\min_i X_i"],
  ["X∈{A,B,P}", "X\\in\\{A,B,P\\}"],
  ["(E_A,R_B,R_P,L内部)", "\\left(E_A,R_B,R_P,L_{\\text{内部}}\\right)"],
  ["100E_A%", "100E_A\\%"],
  ["E_A=0", "E_A=0"],
  ["R_A、R_B、R_P", "R_A,R_B,R_P"],
  ["R_P", "R_P"],
  ["R_X", "R_X"],
  ["E_A", "E_A"],
  ["R_A", "R_A"],
  ["R_B", "R_B"],
  ["Aᵢ、Bᵢ、Pᵢ", "A_i,B_i,P_i"],
  ["Ω₁,…,Ωₙ", "\\Omega_1,\\ldots,\\Omega_n"],
  ["Ωᵢ", "\\Omega_i"],
  ["Ω", "\\Omega"],
  ["∩、∪、∖", "\\cap,\\cup,\\setminus"],
  ["Aᵢ", "A_i"],
  ["Bᵢ", "B_i"],
  ["Cᵢ", "C_i"],
  ["Pᵢ", "P_i"],
  ["L内部", "L_{\\text{内部}}"],
  ["A总", "A_{\\text{总}}"],
  ["A*", "A^*"],
  ["sᵢ", "s_i"],
  ["θᵢ", "\\theta_i"],
  ["πr²", "\\pi r^2"],
  ["π", "\\pi"],
  ["r", "r"],
  ["n", "n"],
  ["i", "i"],
  ["k", "k"],
  ["x", "x"],
  ["y", "y"],
  ["0 到 1", "0\\text{ 到 }1"],
  ["1/n", "\\frac{1}{n}"],
  ["cm²", "\\mathrm{cm}^2"],
  ["cm", "\\mathrm{cm}"],
  ["12×12", "12\\times12"],
  ["2×2", "2\\times2"],
  ["0°", "0^{\\circ}"],
  ["10", "10"],
  ["30", "30"],
  ["36", "36"],
  ["48", "48"],
  ["80", "80"],
  ["140", "140"],
  ["144", "144"],
  ["0", "0"],
  ["1", "1"],
  ["2", "2"],
  ["4", "4"],
)

export const CAKE_LEARNING_STEPS: readonly LearningStep[] = [
  {
    id: "cake-fairness-definition",
    inlineMath: CAKE_INLINE_MATH,
    shortTitle: "定义公平",
    title: "先确定公平的评价标准",
    objective: "区分份量公平、外边界公平、整块周长公平与切割成本。",
    definition: "同一切分方案可以在某一指标上相等，而在另一指标上不相等。因此，比较方案前必须先声明评价指标。",
    mathConcepts: [
      {
        term: "观测对象、变量与指标",
        definition: "观测对象是要记录和比较的对象；变量是会随对象或方案改变的量；指标是按固定规则得到的比较数值。",
        context: "观测对象是整个切分方案及每一块蛋糕。Aᵢ、Bᵢ、Pᵢ 是块级指标，L内部 是方案级指标。",
        notation: "方案 P={Ω₁,…,Ωₙ}",
        notationLatex: "\\mathcal P=\\{\\Omega_1,\\ldots,\\Omega_n\\}",
      },
      {
        term: "集合、区域与边界",
        definition: "集合是一组对象；平面区域是一组平面点；区域的边界是区域内部与外部的分界线。",
        context: "Ω 表示整块蛋糕的俯视区域，Ωᵢ 表示第 i 块；∩、∪、∖ 分别表示共同部分、合并和去掉。",
        notation: "Ω⊂R²，边界记为 ∂Ω",
        notationLatex: "\\Omega\\subset\\mathbb R^2,\\quad\\partial\\Omega=\\text{边界}",
      },
      {
        term: "划分",
        definition: "划分把整体完整分成若干块：所有块合起来覆盖整体，各块内部两两不相交，但相邻块可以共用边界。",
        context: "蛋糕不能重叠分给两人，也不能留下空隙；相邻蛋糕块可以共用同一段切口。",
        notation: "∪ᵢΩᵢ=Ω，int(Ωᵢ)∩int(Ωⱼ)=∅",
        notationLatex: "\\bigcup_i\\Omega_i=\\Omega,\\quad \\operatorname{int}(\\Omega_i)\\cap\\operatorname{int}(\\Omega_j)=\\varnothing",
      },
      {
        term: "面积、长度与周长",
        definition: "面积度量二维区域的大小；长度度量线段或曲线的大小；周长是一个区域全部边界的长度。",
        context: "Aᵢ 量份量，Bᵢ 只量保留的原外沿，Pᵢ 量整块全部边界，L内部 量去重后的内部切口。",
        notation: "面积单位 cm²；长度、周长单位 cm",
        notationLatex: "\\text{面积：}\\mathrm{cm}^2;\\quad\\text{长度、周长：}\\mathrm{cm}",
      },
    ],
    formula: "Aᵢ=Area(Ωᵢ)，Bᵢ=Len(∂Ωᵢ∩∂Ω)，Pᵢ=Len(∂Ωᵢ)，L内部=内部切口总长",
    formulaLatex: "\\begin{aligned}A_i&:=\\operatorname{Area}(\\Omega_i)\\\\ B_i&:=\\operatorname{Len}(\\partial\\Omega_i\\cap\\partial\\Omega)\\\\ P_i&:=\\operatorname{Len}(\\partial\\Omega_i)\\\\ L_{\\mathrm{internal}}&:=\\operatorname{Len}\\!\\left(\\left(\\bigcup_{i=1}^{n}\\partial\\Omega_i\\right)\\setminus\\partial\\Omega\\right)\\end{aligned}",
    formulaExplanation: {
      formal:
        "设蛋糕区域 Ω 被分成 n 个内部两两不相交、并集为 Ω 的部分 Ω₁,…,Ωₙ，相邻部分允许共用边界。Aᵢ 是第 i 块面积，Bᵢ 是它保留的原蛋糕外边界长度，Pᵢ 是它的全部周长；L内部 是所有内部切口按位置去重后的总长度。",
      intuitive:
        "像用四把不同的尺子量同一切法：Aᵢ 看分到多少，Bᵢ 只量原来的外圈，Pᵢ 量这块全部边缘，L内部 量整次切割形成多长的内部切口。尺子不同，“公平”的答案也可能不同。",
    },
    interpretation: "四个指标分别回答“分得多少”“保留多少外沿”“整块边界多长”和“需要切多长”。",
    principleLabel: "方法",
    principleTitle: "先声明指标，再判断公平",
    workedExample:
      "两个方案都把总面积平均分成四份，但方案甲的内部切口总长更短，方案乙的各块外沿更接近。采用面积指标时二者都公平；改用切口总长或外沿指标，判断可能不同。",
    boundary: "数学指标只描述已声明的标准，不代表所有人对公平具有相同偏好。",
    visualTitle: "同一方案的四种观察方式",
    visualCaption: "切换评价指标，观察同一组蛋糕块的判断依据如何改变。",
    check: {
      prompt: "比较两种切法前，首先应完成哪一步？",
      options: [
        { id: "declare", label: "声明采用的公平指标" },
        { id: "guess", label: "凭图形外观直接判断" },
        { id: "combine", label: "把所有指标任意相加" },
      ],
      correctOptionId: "declare",
      explanation: "只有先声明指标，方案比较的结论才具有明确含义。",
    },
  },
  {
    id: "cake-area-share",
    inlineMath: CAKE_INLINE_MATH,
    shortTitle: "面积份额",
    title: "用面积份额比较份量",
    objective: "计算每块面积占总面积的比例，并与目标份额 1/n 比较。",
    definition: "若蛋糕总面积为 A总，分给 n 人，则每人的目标面积为 A*=A总/n。第 i 块的面积份额为 Aᵢ/A总。",
    mathConcepts: [
      {
        term: "面积可加性与守恒",
        definition: "没有重叠、空隙和损耗时，各部分面积之和等于整体面积。",
        context: "满足划分条件时，所有蛋糕块的面积相加恰好得到整块蛋糕面积。",
        notation: "A总=ΣᵢAᵢ",
        notationLatex: "A_{\\text{总}}=\\sum_i A_i",
      },
      {
        term: "比、份额与归一化",
        definition: "两个同类量相除得到比；除以总量叫归一化，它把不同大小的整体换成 0 到 1 之间的份额。",
        context: "sᵢ=Aᵢ/A总 没有单位，表示第 i 块占整块蛋糕的比例；乘 100% 后得到百分比。",
        notation: "sᵢ=Aᵢ/A总，Σᵢsᵢ=1",
        notationLatex: "s_i=\\frac{A_i}{A_{\\text{总}}},\\quad\\sum_i s_i=1",
      },
      {
        term: "目标值与等面积判据",
        definition: "目标值是评价前预先声明的标准；人人等份时目标份额为 1/n，必须每一块都达到目标才算等面积。",
        context: "每人目标面积 A*=A总/n；对所有 i 都有 Aᵢ=A*，等价于所有面积份额都等于 1/n。",
        notation: "Aᵢ=A* ⇔ sᵢ=1/n（对所有 i）",
        notationLatex: "A_i=A^*\\iff s_i=\\frac{1}{n}\\quad(\\forall i)",
      },
      {
        term: "代理指标与模型假设",
        definition: "代理指标是用容易测量的量近似表示难以直接测量的目标，它是否合适取决于明确的假设。",
        context: "用俯视面积代表“份量”，需假设厚度、密度、馅料与装饰均匀且无切割损耗；否则应考虑体积或质量。",
      },
    ],
    formula: "A总=ΣAᵢ，A*=A总/n，sᵢ=Aᵢ/A总；等面积 ⇔ sᵢ=1/n（∀i）",
    formulaLatex: "\\begin{aligned}A_{\\mathrm{total}}&=\\sum_{i=1}^{n}A_i\\\\ A^{*}&=\\frac{A_{\\mathrm{total}}}{n}\\\\ s_i&=\\frac{A_i}{A_{\\mathrm{total}}},\\qquad \\sum_{i=1}^{n}s_i=1\\\\ A_i=A^{*}\ (\\forall i)&\\iff s_i=\\frac1n\ (\\forall i)\\end{aligned}",
    formulaExplanation: {
      formal:
        "设 n 为人数，A总=ΣAᵢ>0。目标面积 A* 是总面积的 1/n；无单位的 sᵢ 表示第 i 块占总面积的比例。等面积切分当且仅当每个 Aᵢ=A*，等价于每个 sᵢ=1/n。",
      intuitive:
        "把整块蛋糕看成 100%，分给 n 人时，每人的目标线就是 100%÷n。所有面积份额都落在这条目标线上，才叫等面积；只看某一块接近目标还不够。",
    },
    interpretation: "面积相等要求每块面积份额均等于 1/n。面积单位必须保持一致。",
    principleLabel: "性质",
    principleTitle: "等面积切分的判定条件",
    workedExample:
      "总面积为 144 cm²，平均分给 4 人。每人的目标面积是 144÷4=36 cm²，对应的目标面积份额是 1/4，也就是 25%。",
    workedExampleFormula: "A*=144÷4=36 cm²，sᵢ=1/4=25%",
    workedExampleLatex: "A^{*}=\\frac{144}{4}=36\\,\\mathrm{cm}^2,\\qquad s_i=\\frac{1}{4}=25\\%",
    boundary: "以面积代表份量，需要假设蛋糕厚度、密度、馅料和装饰分布均匀。",
    visualTitle: "可调面积份额",
    visualCaption: "拖动分界位置，同时读取两块的面积份额与目标线。",
    check: {
      prompt: "总面积为 144 cm²，平均分给 4 人，目标面积是多少？",
      options: [
        { id: "24", label: "24 cm²" },
        { id: "36", label: "36 cm²" },
        { id: "48", label: "48 cm²" },
      ],
      correctOptionId: "36",
      explanation: "目标面积 A*=144÷4=36 cm²。",
    },
  },
  {
    id: "cake-circle-sector",
    inlineMath: CAKE_INLINE_MATH,
    shortTitle: "圆形蛋糕",
    title: "圆心扇形的面积与圆心角成正比",
    objective: "由圆心角精确计算扇形面积和原蛋糕外圆弧长度。",
    definition: "半径相同时，扇形面积和弧长都等于整圆对应量乘以圆心角占 360° 的比例。",
    mathConcepts: [
      {
        term: "扇形与圆心角",
        definition: "扇形是由两条半径和它们之间的圆弧围成的区域；两条半径在圆心形成的角叫圆心角。",
        context: "每块 Ωᵢ 是半径相同、圆心角为 θᵢ 的扇形。",
        notation: "半径 r，圆心角 θᵢ",
        notationLatex: "r=\\text{半径},\\quad\\theta_i=\\text{圆心角}",
      },
      {
        term: "周角与角度划分",
        definition: "绕圆心一整圈是 360°；从圆心切出的所有扇形必须刚好补成一整圈。",
        context: "每个 θᵢ 都大于 0，所有圆心角之和为 360°；一块角度改变后，其余块必须相应补足。",
        notation: "θᵢ>0，Σᵢθᵢ=360°",
        notationLatex: "\\theta_i>0,\\quad\\sum_i\\theta_i=360^{\\circ}",
      },
      {
        term: "正比例关系",
        definition: "当 y=kx 且比例常数 k 不变时，y 与 x 成正比；x 变为几倍，y 也变为几倍。",
        context: "固定半径 r 后，扇形面积和原外圆弧长度都与圆心角成正比。",
        notation: "Aᵢ∝θᵢ，Bᵢ∝θᵢ（r 固定）",
        notationLatex: "A_i\\propto\\theta_i,\\quad B_i\\propto\\theta_i\\quad(r\\text{ 固定})",
      },
      {
        term: "自变量、控制量与响应量",
        definition: "主动改变的量叫自变量，保持不变的条件叫控制量，随自变量变化而重新计算的量叫响应量。",
        context: "滑块改变 θᵢ，半径 r 保持不变，Aᵢ 与 Bᵢ 随角度变化；固定半径是正比结论的重要条件。",
      },
    ],
    formula: "Σθᵢ=360°；Aᵢ=(θᵢ/360°)πr²；Bᵢ=(θᵢ/360°)2πr",
    formulaLatex: "\\begin{aligned}\\sum_{i=1}^{n}\\theta_i&=360^{\\circ},\\qquad r>0\\\\ A_i&=\\frac{\\theta_i}{360^{\\circ}}\\pi r^2\\\\ B_i&=\\frac{\\theta_i}{360^{\\circ}}2\\pi r\\end{aligned}",
    formulaExplanation: {
      formal:
        "设 θᵢ∈(0°,360°] 是第 i 个圆心扇形的圆心角，所有 θᵢ 之和为 360°，且各扇形来自同一个半径 r 的圆。Aᵢ 是扇形面积，Bᵢ 仅指它保留的原蛋糕外圆弧长度。",
      intuitive:
        "θᵢ/360° 表示这块占“整整一圈”的份数。它占一圈的几分之几，就同时拿到整圆面积和原外圆周的几分之几；所以角度相等时，这两项也相等。",
    },
    interpretation: "圆心角之和必须为 360°。等角扇形同时具有相等面积和相等外圆弧。",
    principleLabel: "性质",
    principleTitle: "圆心扇形的比例性质",
    workedExample:
      "半径为 10 cm、圆心角为 90° 的扇形占整圆的 1/4，因此面积为 25π cm²，原蛋糕外圆弧长为 5π cm。",
    workedExampleFormula: "A=(90°/360°)·π·10²=25π，B=(90°/360°)·2π·10=5π",
    workedExampleLatex: "A=\\frac{90^{\\circ}}{360^{\\circ}}\\pi\\cdot10^2=25\\pi,\\qquad B=\\frac{90^{\\circ}}{360^{\\circ}}2\\pi\\cdot10=5\\pi",
    boundary: "这里研究从圆心出发的受控扇形切法，不以屏幕像素近似面积。",
    visualTitle: "可调圆心角",
    visualCaption: "调整第一块的圆心角；另一块自动补足到 360°，面积与弧长按公式重算。",
    check: {
      prompt: "半径相同的两个圆心扇形，其面积比等于什么？",
      options: [
        { id: "angle", label: "圆心角之比" },
        { id: "radius", label: "半径之比" },
        { id: "perimeter", label: "整块周长之比" },
      ],
      correctOptionId: "angle",
      explanation: "同一圆中 Aᵢ=(θᵢ/360°)πr²，公共因子相同，面积比等于圆心角之比。",
    },
  },
  {
    id: "cake-boundary-composition",
    inlineMath: CAKE_INLINE_MATH,
    shortTitle: "周长组成",
    title: "区分原外沿与新增切口",
    objective: "把每块总周长分解为原蛋糕外边界和切割产生的新边界。",
    definition: "每块总周长由其保留的原蛋糕外沿与切割后新增的边界共同组成。内部切口属于相邻两块，会在各块周长之和中计算两次。",
    mathConcepts: [
      {
        term: "边界分解",
        definition: "一个区域的边界可以按来源分成互不重叠的若干部分，再把各部分长度相加。",
        context: "第 i 块的边界分为原蛋糕外沿 Bᵢ 与切割新增边界 Cᵢ，所以 Pᵢ=Bᵢ+Cᵢ。",
        notation: "Pᵢ=Bᵢ+Cᵢ",
        notationLatex: "P_i=B_i+C_i",
      },
      {
        term: "长度可加性",
        definition: "一条边界被无重叠地分成若干段时，各段长度之和等于原边界长度。",
        context: "原蛋糕外圈只是被分配给各块，没有新增或消失，因此各块保留的原外沿总和仍是原周长。",
        notation: "ΣᵢBᵢ=P原",
        notationLatex: "\\sum_i B_i=P_{\\text{原}}",
      },
      {
        term: "双重计数",
        definition: "同一个对象若同时属于两个统计单位，逐单位相加时会被计算两次。",
        context: "同一段内部切口分别计入相邻两块的周长，所以 ΣCᵢ=2L内部；物理切口本身仍只有一段。",
        notation: "ΣᵢPᵢ=P原+2L内部",
        notationLatex: "\\sum_iP_i=P_{\\text{原}}+2L_{\\text{内部}}",
      },
      {
        term: "理想切分假设",
        definition: "理想模型通过忽略较小的现实因素，使几何关系可以精确计算；结论必须连同假设一起使用。",
        context: "假设无重叠、无空隙，每段内部边界恰好邻接两块，刀口宽度为 0，并忽略碎屑与材料损耗。",
      },
    ],
    formula: "Pᵢ=Bᵢ+Cᵢ；Σᵢ₌₁ⁿPᵢ=P原+2L内部",
    formulaLatex: "\\begin{aligned}P_i&=B_i+C_i\\\\ \\sum_{i=1}^{n}P_i&=P_{\\mathrm{original}}+2L_{\\mathrm{internal}}\\end{aligned}",
    formulaExplanation: {
      formal:
        "Cᵢ 表示第 i 块由切割新增的边界长度。若各块无重叠、无空隙，且每段内部切口恰由相邻两块共享，则 ΣBᵢ=P原、ΣCᵢ=2L内部，从而得到全部小块周长之和。",
      intuitive:
        "原来的蛋糕外圈分给各块后，总共仍只数一次；同一段内部切口分别成为相邻两块的一条边，所以把所有小块周长相加时会计算两次。",
    },
    interpretation: "Bᵢ 为原外边界，Cᵢ 为新增切口边界，L内部 为不重复计算的内部切口总长。",
    principleLabel: "结论",
    principleTitle: "内部切口的双重计数",
    workedExample:
      "若原蛋糕外周长为 80 cm，内部切口总长为 30 cm，那么所有小块周长之和为 80+2×30=140 cm。内部切口的每一段分别属于两侧的小块。",
    workedExampleFormula: "ΣPᵢ=80+2×30=140 cm",
    workedExampleLatex: "\\sum_i P_i=80+2\\times30=140\\,\\mathrm{cm}",
    boundary: "公式假设切分无重叠、无空隙，且忽略刀口宽度与材料损耗。",
    visualTitle: "边界组成高亮",
    visualCaption: "分别高亮原外沿和新增切口，核对一块扇形的周长组成。",
    check: {
      prompt: "为什么所有小块周长之和要加上 2L内部？",
      options: [
        { id: "twice", label: "每段内部切口属于相邻两块" },
        { id: "curve", label: "曲线长度总是直线的两倍" },
        { id: "loss", label: "切割必然损失两倍面积" },
      ],
      correctOptionId: "twice",
      explanation: "同一条内部边界分别计入其两侧蛋糕块的周长，因此出现两次。",
    },
  },
  {
    id: "cake-plan-comparison",
    inlineMath: CAKE_INLINE_MATH,
    shortTitle: "多方案比较",
    title: "用极差与偏差比较切分方案",
    objective: "分别计算面积、外边界和周长的差异，并用内部切口总长作为切割成本的代理指标。",
    definition: "面积最大相对偏差衡量各块偏离目标面积的最大程度；极差衡量同一指标最大值与最小值之差。各指标应分别呈现。",
    mathConcepts: [
      {
        term: "绝对偏差与相对偏差",
        definition: "绝对偏差表示实际值与目标值相差多少；相对偏差再除以目标值，表示相差目标的几分之几。",
        context: "先算每块面积与目标面积的差，再取最大的相对偏差 E_A；100E_A% 才是百分数。",
        notation: "E_A=maxᵢ|Aᵢ−A*|/A*",
        notationLatex: "E_A=\\frac{\\max_i\\lvert A_i-A^*\\rvert}{A^*}",
      },
      {
        term: "极差",
        definition: "极差是同一指标的最大值减最小值；极差为 0 表示各块在该指标上相等，但只反映两个极端。",
        context: "R_A、R_B、R_P 分别量面积、原外沿和总周长的最大差异，不能用其中一个代替其余指标。",
        notation: "R_X=maxᵢXᵢ−minᵢXᵢ",
        notationLatex: "R_X=\\max_i X_i-\\min_i X_i",
      },
      {
        term: "多指标比较与可比性",
        definition: "一个方案可由一组指标描述；只有观测对象、单位与控制条件一致时，才能比较同一列数值。",
        context: "两种切法必须作用于同一块蛋糕。不同单位的指标不能直接相加；若综合评分，需先归一化并公开方向与权重。",
        notation: "指标向量 (E_A,R_B,R_P,L内部)",
        notationLatex: "\\left(E_A,R_B,R_P,L_{\\text{内部}}\\right)",
      },
      {
        term: "代理指标与成本模型",
        definition: "代理指标只能近似研究目标，不能与目标本身完全画等号。",
        context: "L内部 只近似“切割成本”；实际成本还可能受下刀次数、直切或曲切、转向、移刀与材料影响。",
      },
    ],
    formula: "E_A=maxᵢ|Aᵢ−A*|/A*；R_X=maxᵢXᵢ−minᵢXᵢ（X∈{A,B,P}）",
    formulaLatex: "\\begin{aligned}I&=\\{1,\\ldots,n\\}\\\\ E_A&=\\frac{\\max_{i\\in I}\\lvert A_i-A^{*}\\rvert}{A^{*}}\\\\ R_X&=\\max_{i\\in I}X_i-\\min_{i\\in I}X_i\\\\ X&\\in\\{A,B,P\\}\\end{aligned}",
    formulaExplanation: {
      formal:
        "E_A 取所有蛋糕块中相对目标面积偏差最大的一个，是无量纲比例。对 X∈{A,B,P}，R_X 是该指标的最大值减最小值，分别得到面积极差 R_A、外沿极差 R_B 和周长极差 R_P；L内部 另作切口总长指标。",
      intuitive:
        "E_A 找“离目标面积最远的那一块”，看它偏了百分之多少；R_X 找同一把尺子下最大与最小的差距。某一项等于 0，只说明这把尺子量得一样，不代表其他指标也公平。",
    },
    interpretation: "面积相等不必然使外沿相等。这里用内部切口总长度近似比较切割成本，数值越小表示所需切口越短。",
    principleLabel: "结论",
    principleTitle: "面积公平不推出边界公平",
    workedExample:
      "若两个方案的每块面积都等于目标面积，则二者的面积最大相对偏差都为 0；但它们的外沿极差、周长极差和内部切口总长仍可能不同，必须按选定指标继续比较。",
    workedExampleFormula: "面积相等时 E_A=0，但 R_P 与 L内部仍需计算",
    workedExampleLatex: "E_A=0,\\qquad R_P\\text{ 与 }L_{\\mathrm{internal}}\\text{ 仍需分别计算}",
    boundary: "只比较同一原始蛋糕、同一单位与同一控制条件下的方案；本模型不把不同量纲直接相加。若综合评价，必须先归一化并公开方向与权重。",
    visualTitle: "已保存方案的指标矩阵",
    visualCaption: "实验完成后，在同一块 12×12 方形蛋糕上比较四等宽条带与 2×2 等面积网格。",
    lockedUntilExperiment: true,
    check: {
      prompt: "面积均相等时，哪一项仍需要独立计算？",
      options: [
        { id: "boundary", label: "各块原外边界" },
        { id: "target", label: "目标面积仍未知" },
        { id: "sum", label: "面积之和不再守恒" },
      ],
      correctOptionId: "boundary",
      explanation: "面积相等只确定份量指标，外边界、总周长和切割成本仍需分别计算。",
    },
  },
]

const FAIRNESS_METRICS = [
  { id: "area", label: "面积份额", value: "Aᵢ/A总", note: "比较每块分得多少" },
  { id: "outer", label: "原外边界", value: "Bᵢ", note: "比较每块保留的外沿" },
  { id: "perimeter", label: "整块周长", value: "Pᵢ", note: "比较每块全部边界" },
  { id: "cost", label: "切割长度", value: "L内部", note: "内部切口总长，作为成本代理" },
] as const

function CakeLearningVisual({ stepIndex }: { readonly stepIndex: number }) {
  const [metric, setMetric] = useState<(typeof FAIRNESS_METRICS)[number]["id"]>("area")
  const [share, setShare] = useState(50)
  const [angle, setAngle] = useState(120)
  const [boundaryMode, setBoundaryMode] = useState<BoundaryMode>("all")
  const circle = useMemo(
    () => createCircularSectorPartition({ radius: 12, anglesDegrees: [angle, 360 - angle] }),
    [angle],
  )

  if (stepIndex === 0) {
    const selected = FAIRNESS_METRICS.find((item) => item.id === metric) ?? FAIRNESS_METRICS[0]
    return (
      <div className="cake-learning-visual cake-learning-criteria">
        <div className="cake-criteria-pieces" aria-label="同一切法的三块蛋糕">
          {[42, 31, 27].map((value, index) => (
            <i key={value} style={{ flex: value }}><span>{index + 1}</span></i>
          ))}
        </div>
        <div className="cake-metric-switch" role="group" aria-label="选择公平指标">
          {FAIRNESS_METRICS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === metric ? "is-active" : undefined}
              onClick={() => setMetric(item.id)}
            >
              <span>{item.label}</span><strong>
                <MathText text={item.value} inlineMath={CAKE_INLINE_MATH} />
              </strong>
            </button>
          ))}
        </div>
        <p><strong>{selected.label}</strong>{selected.note}；当前只按这一标准作判断。</p>
      </div>
    )
  }

  if (stepIndex === 1) {
    return (
      <div className="cake-learning-visual cake-share-visual">
        <div className="cake-share-block" aria-label="两块矩形蛋糕的面积份额">
          <i style={{ width: `${share}%` }}><span>
            <InlineMath plain={share + "%"} latex={share + "\\%"} />
          </span></i>
          <i style={{ width: `${100 - share}%` }}><span>
            <InlineMath plain={100 - share + "%"} latex={100 - share + "\\%"} />
          </span></i>
          <b style={{ left: "50%" }}><span>目标 <InlineMath plain="50%" latex={"50\\%"} /></span></b>
        </div>
        <label>
          <span>第一块面积份额</span>
          <input
            aria-label="第一块面积份额"
            type="range"
            min="20"
            max="80"
            value={share}
            onChange={(event) => setShare(Number(event.target.value))}
          />
          <strong><InlineMath plain={share + "%"} latex={share + "\\%"} /></strong>
        </label>
        <div className="cake-share-readout">
          <span>目标面积份额<strong><InlineMath plain="50%" latex={"50\\%"} /></strong></span>
          <span>最大相对偏差<strong><InlineMath
            plain={Math.abs(share - 50) * 2 + "%"}
            latex={Math.abs(share - 50) * 2 + "\\%"}
          /></strong></span>
        </div>
      </div>
    )
  }

  if (stepIndex === 2) {
    return (
      <div className="cake-learning-visual cake-angle-visual">
        <CirclePartitionSvg anglesDegrees={[angle, 360 - angle]} title="可调圆心角扇形" />
        <div className="cake-visual-controls">
          <label>
            <span>第一块圆心角</span>
            <input
              aria-label="第一块圆心角"
              type="range"
              min="30"
              max="330"
              step="5"
              value={angle}
              onChange={(event) => setAngle(Number(event.target.value))}
            />
            <strong><InlineMath
              plain={angle + "°"}
              latex={angle + "^{\\circ}"}
            /></strong>
          </label>
          <dl>
            <div><dt>第一块面积</dt><dd><InlineMath
              plain={circle.pieces[0].area.toFixed(2) + " cm²"}
              latex={circle.pieces[0].area.toFixed(2) + "\\,\\mathrm{cm}^2"}
            /></dd></div>
            <div><dt>第一块外圆弧</dt><dd><InlineMath
              plain={circle.pieces[0].arcLength.toFixed(2) + " cm"}
              latex={circle.pieces[0].arcLength.toFixed(2) + "\\,\\mathrm{cm}"}
            /></dd></div>
          </dl>
        </div>
      </div>
    )
  }

  if (stepIndex === 3) {
    const sector = createCircularSectorPartition({ radius: 12, anglesDegrees: [120, 240] })
    return (
      <div className="cake-learning-visual cake-boundary-visual">
        <CirclePartitionSvg
          anglesDegrees={[120, 240]}
          boundaryMode={boundaryMode}
          title="扇形原外沿与新增切口边界"
        />
        <div className="cake-visual-controls">
          <div className="cake-boundary-switch" role="group" aria-label="边界高亮方式">
            {([
              ["outer", "原蛋糕外沿"],
              ["cut", "新增切口"],
              ["all", "全部周长"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={boundaryMode === value ? "is-active" : undefined}
                onClick={() => setBoundaryMode(value)}
              >{label}</button>
            ))}
          </div>
          <dl>
            <div><dt>第1块原外沿</dt><dd><InlineMath
              plain={sector.pieces[0].originalOuterBoundary.toFixed(2) + " cm"}
              latex={sector.pieces[0].originalOuterBoundary.toFixed(2) + "\\,\\mathrm{cm}"}
            /></dd></div>
            <div><dt>第1块新增切口</dt><dd><InlineMath
              plain={sector.pieces[0].newCutBoundary.toFixed(2) + " cm"}
              latex={sector.pieces[0].newCutBoundary.toFixed(2) + "\\,\\mathrm{cm}"}
            /></dd></div>
            <div><dt>第1块总周长</dt><dd><InlineMath
              plain={sector.pieces[0].totalPerimeter.toFixed(2) + " cm"}
              latex={sector.pieces[0].totalPerimeter.toFixed(2) + "\\,\\mathrm{cm}"}
            /></dd></div>
          </dl>
        </div>
      </div>
    )
  }

  const strips = createEqualParallelStripPartition({
    width: 12,
    height: 12,
    orientation: "vertical",
    pieceCount: 4,
  })
  const grid = createEqualRectangularGridPartition({
    width: 12,
    height: 12,
    rows: 2,
    columns: 2,
  })
  return (
    <div className="cake-learning-visual cake-comparison-visual">
      <table>
        <thead><tr><th scope="col"><MathText text="同一块 12×12 蛋糕" inlineMath={CAKE_INLINE_MATH} /></th><th scope="col">最大相对面积偏差</th><th scope="col">外沿极差 / <InlineMath plain="cm" latex={"\\mathrm{cm}"} /></th><th scope="col">周长极差 / <InlineMath plain="cm" latex={"\\mathrm{cm}"} /></th><th scope="col">内部切口 / <InlineMath plain="cm" latex={"\\mathrm{cm}"} /></th></tr></thead>
        <tbody>
          <tr><th scope="row">四等宽条带</th><td><InlineMath plain={(strips.metrics.maxRelativeAreaDeviation * 100).toFixed(1) + "%"} latex={(strips.metrics.maxRelativeAreaDeviation * 100).toFixed(1) + "\\%"} /></td><td><InlineMath plain={strips.metrics.outerBoundaryRange.toFixed(2)} latex={strips.metrics.outerBoundaryRange.toFixed(2)} /></td><td><InlineMath plain={strips.metrics.perimeterRange.toFixed(2)} latex={strips.metrics.perimeterRange.toFixed(2)} /></td><td><InlineMath plain={strips.internalCutLength.toFixed(2)} latex={strips.internalCutLength.toFixed(2)} /></td></tr>
          <tr><th scope="row"><MathText text="2×2 等面积网格" inlineMath={CAKE_INLINE_MATH} /></th><td><InlineMath plain={(grid.metrics.maxRelativeAreaDeviation * 100).toFixed(1) + "%"} latex={(grid.metrics.maxRelativeAreaDeviation * 100).toFixed(1) + "\\%"} /></td><td><InlineMath plain={grid.metrics.outerBoundaryRange.toFixed(2)} latex={grid.metrics.outerBoundaryRange.toFixed(2)} /></td><td><InlineMath plain={grid.metrics.perimeterRange.toFixed(2)} latex={grid.metrics.perimeterRange.toFixed(2)} /></td><td><InlineMath plain={grid.internalCutLength.toFixed(2)} latex={grid.internalCutLength.toFixed(2)} /></td></tr>
        </tbody>
      </table>
      <p>两个方案作用于同一块蛋糕且都满足面积相等；其外沿、周长与切口指标仍需分列比较。</p>
    </div>
  )
}

export default function CakeLearningPage() {
  return (
    <TopicShell topicId="cake-cutting" module="learn">
      <LearningScreen
        topicId="cake-cutting"
        steps={CAKE_LEARNING_STEPS}
        renderVisual={(_, stepIndex) => <CakeLearningVisual stepIndex={stepIndex} />}
      />
    </TopicShell>
  )
}
