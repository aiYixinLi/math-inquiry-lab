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
  calculateCandidateStatistics,
  enumerateCandidateStatistics,
  findOptimalFloors,
  type CandidateFloorStatistics,
  type ElevatorOptimizationObjective,
} from "../playground/model"
import "../topic.css"

const ELEVATOR_INLINE_MATH = defineInlineMath(
  ["Dₘᵢₙ=minₚD(p)", "D_{\\min}=\\min_p D(p)"],
  ["P*=arg minₚD(p)", "P^*=\\operatorname*{arg\\,min}_p D(p)"],
  ["Σᵢ<ₚfᵢ≤N/2", "\\sum_{i<p}f_i\\le\\frac{N}{2}"],
  ["Σᵢ>ₚfᵢ≤N/2", "\\sum_{i>p}f_i\\le\\frac{N}{2}"],
  ["d̄(p)=Σp̂ᵢ|i−p|", "\\bar d(p)=\\sum_i\\hat p_i\\lvert i-p\\rvert"],
  ["d̄(p)=D(p)/N", "\\bar d(p)=\\frac{D(p)}{N}"],
  ["Dᵢ(p)=fᵢ|i−p|", "D_i(p)=f_i\\lvert i-p\\rvert"],
  ["D(p)=Σfᵢ|i−p|", "D(p)=\\sum_i f_i\\lvert i-p\\rvert"],
  ["Σfᵢ|i−p|", "\\sum_i f_i\\lvert i-p\\rvert"],
  ["Σ|xₖ−p|", "\\sum_k\\lvert x_k-p\\rvert"],
  ["|6 − 12| = 12", "\\lvert6-12\\rvert=12"],
  ["f₁₂ = 6", "f_{12}=6"],
  ["f₆ = 12", "f_6=12"],
  ["f₆=12", "f_6=12"],
  ["f₂=0", "f_2=0"],
  ["xₖ=Xₖ(ω)", "x_k=X_k(\\omega)"],
  ["x=(x₁,…,xᴺ)", "\\mathbf x=(x_1,\\ldots,x_N)"],
  ["p̂ᵢ=fᵢ/N", "\\hat p_i=\\frac{f_i}{N}"],
  ["N=Σfᵢ>0", "N=\\sum_i f_i>0"],
  ["fᵢ≥0", "f_i\\ge0"],
  ["Σfᵢ=N", "\\sum_i f_i=N"],
  ["Σp̂ᵢ=1", "\\sum_i\\hat p_i=1"],
  ["1{xₖ=i}", "\\mathbf 1_{\\{x_k=i\\}}"],
  ["d(i,p)=d(p,i)", "d(i,p)=d(p,i)"],
  ["d(i,p)=0", "d(i,p)=0"],
  ["d(i,p)≥0", "d(i,p)\\ge0"],
  ["d(i,p)", "d(i,p)"],
  ["d(8,3)=|8−3|=5", "d(8,3)=\\lvert8-3\\rvert=5"],
  ["|i−p|", "\\lvert i-p\\rvert"],
  ["i−p", "i-p"],
  ["D(4)=D(5)=D(6)=D最小", "D(4)=D(5)=D(6)=D_{\\min}"],
  ["4、5、6 层", "4,5,6\\text{ 层}"],
  ["4 层到 6 层", "4\\text{ 层到 }6\\text{ 层}"],
  ["N/2", "\\frac{N}{2}"],
  ["N=Σfᵢ", "N=\\sum_i f_i"],
  ["D(p)/N", "\\frac{D(p)}{N}"],
  ["fᵢ|i−p|=7×3=21", "f_i\\lvert i-p\\rvert=7\\times3=21"],
  ["f₈|8−5|=7×3=21", "f_8\\lvert8-5\\rvert=7\\times3=21"],
  ["7×3=21", "7\\times3=21"],
  ["Tₖ(p)", "T_k(p)"],
  ["T(p)=t₀Σfᵢ+τD(p)", "T(p)=t_0\\sum_i f_i+\\tau D(p)"],
  ["T(p)", "T(p)"],
  ["T总", "T_{\\mathrm{total}}"],
  ["T均", "T_{\\mathrm{mean}}"],
  ["T最大", "T_{\\max}"],
  ["Ttotal", "T_{\\mathrm{total}}"],
  ["Tmean", "T_{\\mathrm{mean}}"],
  ["Tmax", "T_{\\max}"],
  ["t₀≥0", "t_0\\ge0"],
  ["τ>0", "\\tau>0"],
  ["t₀", "t_0"],
  ["τ", "\\tau"],
  ["Dₘᵢₙ", "D_{\\min}"],
  ["Dmin", "D_{\\min}"],
  ["arg min", "\\operatorname*{arg\\,min}"],
  ["min", "\\min"],
  ["D最小", "D_{\\min}"],
  ["P*", "P^*"],
  ["Dᵢ(p)", "D_i(p)"],
  ["D(p)", "D(p)"],
  ["D", "D"],
  ["d̄(p)", "\\bar d(p)"],
  ["fᵢ", "f_i"],
  ["f₆", "f_6"],
  ["f₂", "f_2"],
  ["p̂ᵢ", "\\hat p_i"],
  ["Xₖ", "X_k"],
  ["xₖ", "x_k"],
  ["xᴺ", "x_N"],
  ["N", "N"],
  ["F", "\\mathcal F"],
  ["ω", "\\omega"],
  ["i,p∈F", "i,p\\in\\mathcal F"],
  ["i=p", "i=p"],
  ["p∈F", "p\\in\\mathcal F"],
  ["p∈{1,…,m}", "p\\in\\{1,\\ldots,m\\}"],
  ["D:F→R≥0", "D:\\mathcal F\\to\\mathbb R_{\\ge0}"],
  ["1 到 m", "1\\text{ 到 }m"],
  ["层·次", "\\text{层}\\cdot\\text{次}"],
  ["i", "i"],
  ["p", "p"],
  ["k", "k"],
  ["m", "m"],
  ["0", "0"],
  ["1", "1"],
  ["2", "2"],
  ["3", "3"],
  ["4", "4"],
  ["5", "5"],
  ["6", "6"],
  ["7", "7"],
  ["8", "8"],
  ["10", "10"],
  ["11", "11"],
  ["12", "12"],
  ["21", "21"],
)

export const ELEVATOR_LEARNING_STEPS: readonly LearningStep[] = [
  {
    id: "elevator-data",
    inlineMath: ELEVATOR_INLINE_MATH,
    shortTitle: "确定数据",
    title: "用楼层频数表示呼叫数据",
    objective: "将逐次呼叫记录整理为楼层频数，并说明频数的统计意义。",
    definition: "楼层频数 fᵢ 表示统计时段内第 i 层产生的呼叫次数。没有呼叫的楼层频数为 0。",
    mathConcepts: [
      {
        term: "观测与观测值",
        definition: "观测是按统一规则记录一次事件；记录得到的具体结果叫观测值。",
        context: "一次呼叫是一个观测单位，第 k 次实际记录到的楼层 xₖ 是观测值。",
        notation: "xₖ=Xₖ(ω)",
        notationLatex: "x_k=X_k(\\omega)",
      },
      {
        term: "变量与随机变量",
        definition: "变量是会随观测对象改变的特征；事件发生前，用随机变量表示尚未确定的结果，发生后得到确定的观测值。",
        context: "Xₖ 表示第 k 次呼叫在发生前尚未确定的楼层，取值范围是 1 到 m 层；xₖ 表示实际楼层。",
        notation: "Xₖ:Ω→F，F={1,…,m}",
        notationLatex: "X_k:\\Omega\\to F,\\quad F=\\{1,\\ldots,m\\}",
      },
      {
        term: "数据集、样本与样本量",
        definition: "多个观测值组成数据集；若用它认识更广泛或未来的规律，就把它看作样本，记录数叫样本量。",
        context: "x=(x₁,…,xᴺ) 是选定时段的呼叫数据，N 是样本量；它只代表该数据边界内的呼叫情况。",
        notation: "x=(x₁,…,xᴺ)，N=记录数",
        notationLatex: "\\mathbf x=(x_1,\\ldots,x_N),\\quad N=\\text{记录数}",
      },
      {
        term: "频数、相对频数与经验分布",
        definition: "某个取值出现的次数叫频数；频数除以样本量得到相对频数，所有取值的相对频数组成经验分布。",
        context: "fᵢ 是第 i 层呼叫次数，p̂ᵢ=fᵢ/N 是该层在当前数据中的比例；它不是预先假定的理论概率。",
        notation: "Σfᵢ=N，Σp̂ᵢ=1",
        notationLatex: "\\sum_i f_i=N,\\quad \\sum_i\\hat p_i=1",
      },
    ],
    formula: "F={1,…,m}；Xₖ:Ω→F；xₖ=Xₖ(ω)；fᵢ=Σₖ₌₁ᴺ1{xₖ=i}；p̂ᵢ=fᵢ/N",
    formulaLatex: "\\begin{aligned}\\mathcal F&=\\{1,\\ldots,m\\},\\qquad X_k:\\Omega\\to\\mathcal F\\\\ x_k&=X_k(\\omega),\\quad k=1,\\ldots,N\\\\ f_i&=\\sum_{k=1}^{N}\\mathbf 1_{\\{x_k=i\\}},\\qquad \\widehat p_i=\\frac{f_i}{N}\\\\ \\sum_{i=1}^{m}f_i&=N,\\qquad \\sum_{i=1}^{m}\\widehat p_i=1\\end{aligned}",
    formulaExplanation: {
      formal:
        "固定观测时段内共有 N 次呼叫。Xₖ 是第 k 次呼叫楼层的随机变量，xₖ=Xₖ(ω) 是实际观测值。指示量 1{xₖ=i} 在第 k 次呼叫来自 i 层时取 1，否则取 0；求和得到频数 fᵢ，相对频数 p̂ᵢ=fᵢ/N，且 Σfᵢ=N、Σp̂ᵢ=1。",
      intuitive:
        "给每层放一个计数盒；每来一次呼叫，就在对应楼层的盒子里放一枚筹码。第 i 层盒里的筹码数就是 fᵢ，所有盒子的筹码加起来就是总呼叫数 N。",
    },
    interpretation: "频数保留了每层呼叫的数量信息，同时不需要保存姓名、门牌号等个人信息。",
    principleLabel: "性质",
    principleTitle: "频数的统计意义",
    workedExample:
      "某时段第 6 层有 12 次呼叫，因此记为 f₆=12；第 2 层没有呼叫，则记为 f₂=0。下标表示楼层，数值表示次数。",
    workedExampleFormula: "f₆=12，f₂=0",
    workedExampleLatex: "f_6=12,\\qquad f_2=0",
    boundary: "频数只描述选定时段内的数据；不同日期、时段或楼栋的数据不能直接混合。",
    visualTitle: "可调楼层频数图",
    visualCaption: "选择楼层并改变频数，观察柱长与总呼叫次数同步变化。",
    check: {
      prompt: "某时段第 6 层记录到 12 次呼叫，规范表示是什么？",
      options: [
        { id: "a", label: "f₆ = 12" },
        { id: "b", label: "f₁₂ = 6" },
        { id: "c", label: "|6 − 12| = 12" },
      ],
      correctOptionId: "a",
      explanation: "下标表示楼层，数值表示该楼层的呼叫次数，因此写作 f₆=12。",
    },
  },
  {
    id: "elevator-distance",
    inlineMath: ELEVATOR_INLINE_MATH,
    shortTitle: "表示距离",
    title: "用绝对值表示楼层距离",
    objective: "计算呼叫楼层与空闲停靠层之间的楼层距离。",
    definition: "若呼叫发生在 i 层，电梯空闲停在 p 层，则楼层距离等于两楼层编号之差的绝对值。",
    mathConcepts: [
      {
        term: "定义域与变量",
        definition: "定义域说明变量允许取哪些值；变量的含义与取值范围必须在计算前明确。",
        context: "呼叫层 i 与候选停靠层 p 都只能取楼层集合 F 中的整数。",
        notation: "i,p∈F={1,…,m}",
        notationLatex: "i,p\\in F=\\{1,\\ldots,m\\}",
      },
      {
        term: "差、绝对值与距离",
        definition: "差可以表示方向；绝对值去掉方向只保留大小。距离表示两个位置相隔多少个单位，因此不能为负。",
        context: "i−p 的正负表示呼叫在停靠层上方或下方，|i−p| 表示两者相隔的楼层数。",
        notation: "d(i,p)=|i−p|≥0",
        notationLatex: "d(i,p)=\\lvert i-p\\rvert\\ge0",
      },
      {
        term: "距离函数的性质",
        definition: "距离满足非负性、同一点距离为零、交换两点距离不变，以及绕路不会比直达更短。",
        context: "楼层编号差满足 d(i,p)=d(p,i)、d(i,p)=0 当且仅当 i=p，并满足三角不等式。",
        notation: "d(i,q)≤d(i,p)+d(p,q)",
        notationLatex: "d(i,q)\\le d(i,p)+d(p,q)",
      },
    ],
    formula: "d:F×F→N₀，d(i,p)=|i−p|",
    formulaLatex: "\\begin{aligned}d&:\\mathcal F\\times\\mathcal F\\to\\mathbb N_0\\\\ d(i,p)&=\\lvert i-p\\rvert\\end{aligned}",
    formulaExplanation: {
      formal:
        "对任意呼叫层 i 和候选停靠层 p∈F，d(i,p) 定义为楼层编号之差的绝对值。它满足 d(i,p)≥0、d(i,p)=d(p,i)，并且 d(i,p)=0 当且仅当 i=p。",
      intuitive:
        "把楼层画成一把刻度尺：从 p 层到 i 层要跨过几格，距离就是几层。向上或向下只改变方向，不改变格数，所以要取绝对值。",
    },
    interpretation: "绝对值保证向上或向下移动得到的距离均为非负数。",
    principleLabel: "性质",
    principleTitle: "绝对距离非负且与方向无关",
    workedExample:
      "呼叫发生在 8 层，电梯空闲停在 3 层。楼层编号相差 5，因此无论把移动看作向上还是向下，距离都是 5 层。",
    workedExampleFormula: "d(8,3)=|8−3|=5",
    workedExampleLatex: "d(8,3)=\\lvert 8-3\\rvert=5",
    boundary: "此处的距离是楼层编号差，不等于物理高度、运行时间或真实调度路径；也不包含开关门、排队和运行方向。",
    visualTitle: "楼层距离路径",
    visualCaption: "分别调整呼叫层 i 与停靠层 p，路径长度始终等于 |i−p|。",
    check: {
      prompt: "呼叫在 8 层，电梯空闲停在 3 层，楼层距离是多少？",
      options: [
        { id: "a", label: "−5 层" },
        { id: "b", label: "5 层" },
        { id: "c", label: "11 层" },
      ],
      correctOptionId: "b",
      explanation: "d(8,3)=|8−3|=5，距离不能为负数。",
    },
  },
  {
    id: "elevator-weighting",
    inlineMath: ELEVATOR_INLINE_MATH,
    shortTitle: "频数加权",
    title: "把每层距离按呼叫频数加权",
    objective: "解释高频楼层为何对总距离产生更大影响，并计算加权总距离。",
    definition: "同一楼层的每次呼叫具有相同距离，因此该层对总距离的贡献为频数乘楼层距离。",
    mathConcepts: [
      {
        term: "权重",
        definition: "权重表示一个数需要被计算多少次，或它对总量具有多大影响。",
        context: "fᵢ 是第 i 层距离的权重，表示这段距离在当前数据中重复出现了多少次；这里的权重是次数，不是理论概率。",
        notation: "权重 fᵢ≥0",
        notationLatex: "f_i\\ge0\\quad(\\text{权重})",
      },
      {
        term: "加权贡献",
        definition: "单项数值乘以它的权重，得到该项对总量的贡献。",
        context: "第 i 层每次距 p 层 |i−p| 层，共出现 fᵢ 次，因此贡献 Dᵢ(p)=fᵢ|i−p|。",
        notation: "Dᵢ(p)=fᵢ|i−p|",
        notationLatex: "D_i(p)=f_i\\lvert i-p\\rvert",
      },
      {
        term: "加权和",
        definition: "把所有单项的加权贡献相加，得到加权和。",
        context: "按楼层频数汇总与逐条呼叫相加得到同一个总距离，频数表压缩数据但未丢失本模型需要的信息。",
        notation: "D(p)=Σᵢfᵢ|i−p|=Σₖ|xₖ−p|",
        notationLatex: "D(p)=\\sum_i f_i\\lvert i-p\\rvert=\\sum_k\\lvert x_k-p\\rvert",
      },
      {
        term: "加权平均",
        definition: "加权和除以总权重，得到每个观测单位的平均水平。",
        context: "D(p)/N 是当前样本中每次呼叫的平均楼层距离，也可用相对频数 p̂ᵢ 计算。",
        notation: "d̄(p)=D(p)/N=Σᵢp̂ᵢ|i−p|",
        notationLatex: "\\bar d(p)=\\frac{D(p)}{N}=\\sum_i\\hat p_i\\lvert i-p\\rvert",
      },
    ],
    formula: "Dᵢ(p)=fᵢ|i−p|；D(p)=Σᵢfᵢ|i−p|=Σₖ|xₖ−p|；d̄(p)=D(p)/N",
    formulaLatex: "\\begin{aligned}D_i(p)&=f_i\\lvert i-p\\rvert\\\\ D(p)&=\\sum_{i=1}^{m}f_i\\lvert i-p\\rvert=\\sum_{k=1}^{N}\\lvert x_k-p\\rvert\\\\ \\bar d(p)&=\\frac{D(p)}{N}=\\sum_{i=1}^{m}\\widehat p_i\\lvert i-p\\rvert\\end{aligned}",
    formulaExplanation: {
      formal:
        "设 fᵢ≥0、N=Σfᵢ>0，且 p∈F。Dᵢ(p) 是第 i 层的加权距离贡献。按楼层求和 Σfᵢ|i−p| 与按 N 条观测逐项求和 Σ|xₖ−p| 相等，记为 D(p)，单位是“层·次”；再除以 N 得样本平均距离 d̄(p)=Σp̂ᵢ|i−p|。",
      intuitive:
        "如果某层离 p 层 3 格，又呼叫了 7 次，就相当于把这段 3 格的路重复走 7 遍，共贡献 21。把每层这样的“重复路程”相加，就是 D(p)。",
    },
    interpretation: "频数 fᵢ 越大，该层距离变化对总量 D(p) 的影响越明显。",
    principleLabel: "性质",
    principleTitle: "频数决定楼层距离的权重",
    workedExample:
      "若第 8 层有 7 次呼叫，空闲停靠层为 5 层，那么每次相距 3 层；第 8 层对加权总距离的贡献为 7×3=21。",
    workedExampleFormula: "f₈|8−5|=7×3=21",
    workedExampleLatex: "f_8\\lvert 8-5\\rvert=7\\times3=21",
    boundary: "该式假设每次呼叫发生前电梯均重新空闲于 p 层，并且每次呼叫权重相同。",
    visualTitle: "各层加权距离贡献",
    visualCaption: "楼层条同时编码频数与 fᵢ|i−p|，用于比较各层对总量的贡献。",
    check: {
      prompt: "某层频数为 7，与停靠层相距 3 层，该层对 D(p) 的贡献是多少？",
      options: [
        { id: "a", label: "10" },
        { id: "b", label: "21" },
        { id: "c", label: "4" },
      ],
      correctOptionId: "b",
      explanation: "该层贡献为 fᵢ|i−p|=7×3=21。",
    },
  },
  {
    id: "elevator-optimum",
    inlineMath: ELEVATOR_INLINE_MATH,
    shortTitle: "寻找最优",
    title: "枚举候选层并识别广义加权中位数",
    objective: "比较所有候选停靠层的 D(p)，识别一个或多个同样最优的楼层。",
    definition: "使加权绝对距离和 D(p) 最小的全部整数楼层组成最优解集合；它对应广义加权中位数条件。",
    mathConcepts: [
      {
        term: "目标函数",
        definition: "目标函数给每个候选方案计算一个评价分数，并规定分数越大越好或越小越好。",
        context: "D 把每个候选停靠层 p 映射为非负总距离，本课希望这个分数尽可能小。",
        notation: "D:F→R≥0",
        notationLatex: "D:F\\to\\mathbb R_{\\ge0}",
      },
      {
        term: "离散优化与枚举",
        definition: "离散优化是在有限或可数的候选方案中寻找最好方案；枚举就是逐个计算每个候选。",
        context: "候选只有 1 到 m 层，可以依次算出所有 D(p)，再比较最低值。",
        notation: "p∈{1,…,m}",
        notationLatex: "p\\in\\{1,\\ldots,m\\}",
      },
      {
        term: "最小值与最优解集合",
        definition: "min 返回最小分数；arg min 返回取得该分数的全部方案，两者一个是数值，一个是集合。",
        context: "Dₘᵢₙ 是最短总距离，P* 是一个或多个并列最优楼层，不能把并列方案丢掉。",
        notation: "Dₘᵢₙ=minₚD(p)，P*=arg minₚD(p)",
        notationLatex: "D_{\\min}=\\min_p D(p),\\quad P^*=\\operatorname*{arg\\,min}_p D(p)",
      },
      {
        term: "广义加权中位数",
        definition: "若一个位置两侧的总权重都不超过全部权重的一半，它就能使加权绝对距离和最小。",
        context: "最优整数楼层可能位于两个有呼叫楼层之间，甚至自身频数为 0，因此这里称为广义加权中位数最优集合。",
        notation: "Σᵢ<ₚfᵢ≤N/2 且 Σᵢ>ₚfᵢ≤N/2",
        notationLatex: "\\sum_{i<p}f_i\\le\\frac{N}{2}\\quad\\text{且}\\quad\\sum_{i>p}f_i\\le\\frac{N}{2}",
      },
    ],
    formula: "Dmin=minₚ∈F D(p)；P*=arg minₚ∈F D(p)；p∈P* ⇔ 两侧频数均≤N/2",
    formulaLatex: "\\begin{aligned}D_{\\min}&=\\min_{p\\in\\mathcal F}D(p)\\\\ \\mathcal P^{*}&=\\operatorname*{arg\\,min}_{p\\in\\mathcal F}D(p)=\\{p\\in\\mathcal F:D(p)=D_{\\min}\\}\\\\ p\\in\\mathcal P^{*}&\\iff\\begin{cases}\\displaystyle\\sum_{i<p}f_i\\le\\frac N2,\\\\[3pt]\\displaystyle\\sum_{i>p}f_i\\le\\frac N2.\\end{cases}\\end{aligned}",
    formulaExplanation: {
      formal:
        "Dmin 是 D(p) 的最小数值，P* 是使 D(p) 取得该数值的全部整数楼层集合。总频数 N=Σfᵢ；一个候选层 p 最优，当且仅当它下方与上方的呼叫频数分别都不超过 N/2，这正是广义加权中位数条件。",
      intuitive:
        "把每次呼叫看成放在对应楼层的一枚砝码。最优位置不能让超过一半的砝码全压在同一侧；若中间出现平衡区，区间里的多个整数楼层就可能同样低。",
    },
    interpretation: "累计频数恰好达到总频数一半时，当前正频数楼层至下一正频数楼层之间的候选整数层会全部并列最优。",
    principleLabel: "定理",
    principleTitle: "广义加权中位数最小化绝对距离和",
    workedExample:
      "若枚举得到 4、5、6 层的 D(p) 完全相同，并且都小于其他候选层，那么这三个楼层共同组成最优集合，不能只保留其中一个。",
    workedExampleFormula: "D(4)=D(5)=D(6)=D最小",
    workedExampleLatex: "D(4)=D(5)=D(6)=D_{\\min}",
    boundary: "加权中位数只对应总距离或平均距离最小，不自动保证最大响应时间最小。",
    visualTitle: "D(p) 目标函数曲线",
    visualCaption: "曲线最低点可能有一个，也可能形成由多个整数楼层组成的平台。",
    lockedUntilExperiment: true,
    check: {
      prompt: "若 4 层到 6 层的 D(p) 完全相同且均为最小值，最优楼层应怎样报告？",
      options: [
        { id: "a", label: "只报告 4 层" },
        { id: "b", label: "只报告 5 层" },
        { id: "c", label: "报告 4、5、6 层全部并列最优" },
      ],
      correctOptionId: "c",
      explanation: "目标函数相同且均达到最小值时，必须保留全部并列最优方案。",
    },
  },
  {
    id: "elevator-objective",
    inlineMath: ELEVATOR_INLINE_MATH,
    shortTitle: "比较目标",
    title: "先声明评价指标，再判断合理方案",
    objective: "区分总量、平均值与最大值三个评价目标，并比较各自的最优楼层。",
    definition: "总估计响应时间衡量全部呼叫的总量；平均值衡量每次呼叫的平均水平；最大值衡量最不利的一次呼叫。",
    mathConcepts: [
      {
        term: "模型与参数",
        definition: "模型用公式保留现实问题中的关键关系；参数是在一次比较中预先给定、暂时保持不变的数。",
        context: "t₀ 是一次呼叫的固定时间，τ 是每跨一层的时间；在比较不同 p 时它们保持不变。",
        notation: "t₀≥0，τ>0",
        notationLatex: "t_0\\ge0,\\quad\\tau>0",
      },
      {
        term: "总量、平均值与最大值",
        definition: "总量把全部结果相加，平均值表示每个观测的平均水平，最大值关注最不利的一个结果。",
        context: "三种指标分别回答“全部要多久”“每次平均多久”和“最慢一次多久”，研究目标不同。",
        notation: "Ttotal，Tmean，Tmax",
        notationLatex: "T_{\\mathrm{total}},\\quad T_{\\mathrm{mean}},\\quad T_{\\max}",
      },
      {
        term: "等价优化与极小化最大值",
        definition: "若目标函数只乘同一个正数或加同一个常数，最优方案不变；最小化所有结果中的最大值叫极小化最大值。",
        context: "总量、平均值和 D(p) 有相同最优层；Tmax 的极小化最大值目标更照顾最远端，答案可能不同。",
        notation: "minimize max（minimax）",
        notationLatex: "\\min\\max\\quad(\\text{minimax})",
      },
      {
        term: "模型假设与边界",
        definition: "数学结论只在模型假设内成立；公式未包含的现实因素不能由模型直接推出。",
        context: "本课假设每次呼叫都从同一空闲层出发，t₀、τ 固定；排队、多电梯、方向和容量需另建模型。",
      },
    ],
    formula: "Tₖ(p)=t₀+τ|xₖ−p|；T总=ΣₖTₖ=Nt₀+τD(p)；T均=T总/N；T最大=maxₖTₖ",
    formulaLatex: "\\begin{aligned}T_k(p)&=t_0+\\tau\\lvert x_k-p\\rvert,\\quad k=1,\\ldots,N\\\\ T_{\\mathrm{total}}(p)&=\\sum_{k=1}^{N}T_k(p)=Nt_0+\\tau D(p)\\\\ T_{\\mathrm{mean}}(p)&=\\frac{T_{\\mathrm{total}}(p)}{N}=t_0+\\frac{\\tau}{N}D(p)\\\\ T_{\\max}(p)&=\\max_{1\\le k\\le N}T_k(p)\\end{aligned}",
    formulaExplanation: {
      formal:
        "令 N=Σfᵢ>0，t₀≥0 是每次呼叫的固定时间，τ>0 是每跨一层的时间。第 k 次观测的估计响应时间为 Tₖ(p)。总量与样本平均都可写成 D(p) 乘以正常数，再加上与 p 无关的常数，所以它们与 D(p) 有相同最优层；最大值则在 N 次观测中取最坏一次。",
      intuitive:
        "总量把所有呼叫的预计时间加起来；平均值只是再除以固定的呼叫总数，所以最佳楼层不变。最大值只盯着“最倒霉的那次呼叫”，会更照顾最远端，因此答案可能不同。",
    },
    interpretation: "在同一数据集上，总量与平均值的最优层一致；最大值最优层可能不同。",
    principleLabel: "结论",
    principleTitle: "评价指标决定最优方案",
    workedExample:
      "对同一组呼叫数据，呼叫总数、固定时间 t₀ 和每层时间 τ 都不随候选层 p 改变。因此固定时间只增加相同的总量，最小化 T(p) 与最小化 D(p) 得到相同的最优层；改用最大值指标时答案可能改变。",
    workedExampleFormula: "T(p)=t₀Σfᵢ+τD(p)",
    workedExampleLatex: "T(p)=t_0\\sum_i f_i+\\tau D(p)",
    boundary: "模型未包含多部电梯、同时呼叫、方向、容量、排队、故障与真实调度策略。",
    visualTitle: "三种评价指标对照",
    visualCaption: "切换评价指标，观察目标函数数值和并列最优楼层是否改变。",
    lockedUntilExperiment: true,
    check: {
      prompt: "高频呼叫集中在低层、少量呼叫位于最高层时，哪项表述正确？",
      options: [
        { id: "a", label: "总量最优层与最大值最优层一定相同" },
        { id: "b", label: "两种指标的最优层可能不同" },
        { id: "c", label: "评价指标不会影响方案比较" },
      ],
      correctOptionId: "b",
      explanation: "总量受频数影响；最大值只关注最不利距离，因此两者的最优层可能不同。",
    },
  },
]

const INITIAL_FREQUENCIES = [4, 6, 10, 14, 12, 8, 5, 3] as const

function metricValue(
  statistics: CandidateFloorStatistics,
  objective: ElevatorOptimizationObjective,
): number {
  if (objective === "total") return statistics.totalTime
  if (objective === "mean") return statistics.meanTime
  return statistics.maxTime
}

function ObjectiveMiniChart({
  statistics,
  objective,
}: {
  readonly statistics: readonly CandidateFloorStatistics[]
  readonly objective: ElevatorOptimizationObjective
}) {
  const values = statistics.map((item) => metricValue(item, objective))
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum || 1
  const x = (index: number) => 24 + index * (292 / Math.max(1, statistics.length - 1))
  const y = (value: number) => 116 - ((value - minimum) / span) * 88
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ")

  return (
    <svg
      className="elevator-mini-chart"
      viewBox="0 0 340 142"
      role="img"
      aria-label="候选停靠层目标函数图"
    >
      <line x1="24" x2="316" y1="116" y2="116" />
      <polyline points={points} />
      {statistics.map((item, index) => (
        <g key={item.candidateFloor}>
          <circle cx={x(index)} cy={y(values[index])} r={values[index] === minimum ? 5 : 3}>
            <title>{`${item.candidateFloor} 层：${values[index].toFixed(1)}`}</title>
          </circle>
          <text x={x(index)} y="134">{item.candidateFloor}</text>
        </g>
      ))}
    </svg>
  )
}

function ElevatorLearningVisual({ stepIndex }: { readonly stepIndex: number }) {
  const [frequencies, setFrequencies] = useState<number[]>([...INITIAL_FREQUENCIES])
  const [selectedFloor, setSelectedFloor] = useState(6)
  const [standbyFloor, setStandbyFloor] = useState(4)
  const [objective, setObjective] = useState<ElevatorOptimizationObjective>("total")
  const input = useMemo(
    () => ({
      floorCount: frequencies.length,
      frequencies: frequencies.map((frequency, index) => ({
        floor: index + 1,
        frequency,
      })),
      secondsPerFloor: 2,
      fixedTime: 4,
    }),
    [frequencies],
  )
  const selectedStatistics = calculateCandidateStatistics(input, standbyFloor)
  const statistics = enumerateCandidateStatistics(input)
  const optimalFloors = findOptimalFloors(input, objective)
  const totalCalls = frequencies.reduce((sum, frequency) => sum + frequency, 0)
  const maxFrequency = Math.max(...frequencies)
  const maxContribution = Math.max(
    1,
    ...frequencies.map((frequency, index) =>
      frequency * Math.abs(index + 1 - standbyFloor),
    ),
  )

  const updateSelectedFrequency = (frequency: number) => {
    setFrequencies((current) => {
      const next = current.map((value, index) =>
        index === selectedFloor - 1 ? frequency : value,
      )
      return next.some((value) => value > 0) ? next : current
    })
  }

  return (
    <div className="elevator-learning-model">
      <div className="elevator-learning-tools">
        <label>
          <span><MathText text="选中楼层 i" inlineMath={ELEVATOR_INLINE_MATH} /></span>
          <input
            aria-label="选中楼层"
            type="range"
            min="1"
            max={frequencies.length}
            value={selectedFloor}
            onChange={(event) => setSelectedFloor(Number(event.target.value))}
          />
          <strong>{selectedFloor} 层</strong>
        </label>
        <label>
          <span><MathText text="空闲停靠层 p" inlineMath={ELEVATOR_INLINE_MATH} /></span>
          <input
            aria-label="空闲停靠层"
            type="range"
            min="1"
            max={frequencies.length}
            value={standbyFloor}
            onChange={(event) => setStandbyFloor(Number(event.target.value))}
          />
          <strong>{standbyFloor} 层</strong>
        </label>
        {stepIndex === 0 && (
          <label>
            <span>{selectedFloor} 层呼叫次数</span>
            <input
              aria-label={`${selectedFloor} 层呼叫次数`}
              type="range"
              min="0"
              max="20"
              value={frequencies[selectedFloor - 1]}
              onChange={(event) => updateSelectedFrequency(Number(event.target.value))}
            />
            <strong>{frequencies[selectedFloor - 1]} 次</strong>
          </label>
        )}
        {stepIndex === 4 && (
          <div className="elevator-learning-objectives" aria-label="评价指标">
            {(["total", "mean", "max"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={objective === item ? "is-active" : undefined}
                onClick={() => setObjective(item)}
              >{item === "total" ? "总量" : item === "mean" ? "平均" : "最大值"}</button>
            ))}
          </div>
        )}
      </div>

      <div className="elevator-learning-stage">
        <div className="elevator-building" role="group" aria-label="楼层频数可视化">
          {[...frequencies].reverse().map((frequency, reverseIndex) => {
            const floor = frequencies.length - reverseIndex
            const distance = Math.abs(floor - standbyFloor)
            const contribution = frequency * distance
            const isSelected = floor === selectedFloor
            const isStandby = floor === standbyFloor
            const width = stepIndex >= 2
              ? contribution / maxContribution * 100
              : frequency / maxFrequency * 100
            return (
              <button
                key={floor}
                type="button"
                className={`${isSelected ? "is-selected" : ""} ${isStandby ? "is-standby" : ""}`}
                onClick={() => setSelectedFloor(floor)}
                aria-label={`${floor} 层，频数 ${frequency}`}
              >
                <span>{floor}F</span>
                <i><b style={{ width: `${width}%` }} /></i>
                <strong>{stepIndex >= 2 ? contribution : frequency}</strong>
              </button>
            )
          })}
        </div>

        {stepIndex < 3 ? (
          <div className="elevator-learning-readout">
            <span>{stepIndex === 0 ? "频数汇总" : stepIndex === 1 ? "绝对距离" : "加权贡献"}</span>
            {stepIndex === 0 && <strong><InlineMath
              plain={"Σfᵢ = " + totalCalls + " 次"}
              latex={"\\sum_i f_i=" + totalCalls + "\\text{ 次}"}
            /></strong>}
            {stepIndex === 1 && (
              <strong><InlineMath
                plain={"|" + selectedFloor + " − " + standbyFloor + "| = "
                  + Math.abs(selectedFloor - standbyFloor) + " 层"}
                latex={"\\lvert" + selectedFloor + "-" + standbyFloor + "\\rvert="
                  + Math.abs(selectedFloor - standbyFloor) + "\\text{ 层}"}
              /></strong>
            )}
            {stepIndex === 2 && (
              <strong><InlineMath
                plain={frequencies[selectedFloor - 1] + " × |" + selectedFloor + " − "
                  + standbyFloor + "| = "
                  + frequencies[selectedFloor - 1] * Math.abs(selectedFloor - standbyFloor)}
                latex={frequencies[selectedFloor - 1] + "\\times\\lvert" + selectedFloor
                  + "-" + standbyFloor + "\\rvert="
                  + frequencies[selectedFloor - 1] * Math.abs(selectedFloor - standbyFloor)}
              /></strong>
            )}
            <small>当前 <InlineMath
              plain={"p=" + standbyFloor}
              latex={"p=" + standbyFloor}
            /> 时，<InlineMath
              plain={"D(p)=" + selectedStatistics.totalDistance}
              latex={"D(p)=" + selectedStatistics.totalDistance}
            /></small>
          </div>
        ) : (
          <div className="elevator-learning-chart-wrap">
            <ObjectiveMiniChart
              statistics={statistics}
              objective={stepIndex === 3 ? "total" : objective}
            />
            <div>
              <span>并列最优楼层</span>
              <strong>{optimalFloors.join("、")} 层</strong>
              <small>{stepIndex === 3 ? "加权中位数与枚举最低点一致" : "先声明指标，再解释方案"}</small>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ElevatorLearningPage() {
  return (
    <TopicShell topicId="elevator" module="learn">
      <div className="elevator-page elevator-page--learning">
        <LearningScreen
          topicId="elevator"
          steps={ELEVATOR_LEARNING_STEPS}
          renderVisual={(_step, stepIndex) => (
            <ElevatorLearningVisual stepIndex={stepIndex} />
          )}
        />
      </div>
    </TopicShell>
  )
}
