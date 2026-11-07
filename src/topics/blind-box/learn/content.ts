import { defineInlineMath, type LearningStep } from "../../../shared/learning"

export const BLIND_BOX_INLINE_MATH = defineInlineMath(
  ["P(Nₙ₊₁|Kₙ=k)=(6−k)/6", "P(N_{n+1}\\mid K_n=k)=\\frac{6-k}{6}"],
  ["P(新款)=(6−4)/6=2/6=1/3", "P(\\text{新款})=\\frac{6-4}{6}=\\frac{2}{6}=\\frac{1}{3}"],
  ["t̄ₙ=(1/n)Σtᵣ", "\\bar t_n=\\frac{1}{n}\\sum_r t_r"],
  ["P(6 盒恰好集齐)=6!/6⁶≈1.54%", "P(T=6)=\\frac{6!}{6^6}\\approx1.54\\%"],
  ["P(Wₖ=m)=(1−pₖ)ᵐ⁻¹pₖ", "P(W_k=m)=(1-p_k)^{m-1}p_k"],
  ["X<ₙ=(X₁,…,Xₙ₋₁)", "X_{<n}=(X_1,\\ldots,X_{n-1})"],
  ["k∈{0,…,min(n,5)}", "k\\in\\{0,\\ldots,\\min(n,5)\\}"],
  ["P(Xₙ=j)=1/6", "P(X_n=j)=\\frac{1}{6}"],
  ["P(Kₙ=k)>0", "P(K_n=k)>0"],
  ["E[Wₖ]=1/pₖ", "\\mathbb E[W_k]=\\frac{1}{p_k}"],
  ["E[Tᵣ]=14.70", "\\mathbb E[T_r]=14.70"],
  ["X₁、X₂、…", "X_1,X_2,\\ldots"],
  ["X₁,…,Xₙ", "X_1,\\ldots,X_n"],
  ["x₁,…,xₙ", "x_1,\\ldots,x_n"],
  ["T₁、…、Tₙ", "T_1,\\ldots,T_n"],
  ["t₁、…、tₙ", "t_1,\\ldots,t_n"],
  ["t₁,…,tₙ", "t_1,\\ldots,t_n"],
  ["1、1.2、1.5、2、3、6", "1,\\ 1.2,\\ 1.5,\\ 2,\\ 3,\\ 6"],
  ["P(A|B)", "P(A\\mid B)"],
  ["X<ₙ=x<ₙ", "X_{<n}=x_{<n}"],
  ["Kₙ=|Cₙ|", "K_n=\\lvert C_n\\rvert"],
  ["P(新款)", "P(\\text{新款})"],
  ["pₖ=(6−k)/6", "p_k=\\frac{6-k}{6}"],
  ["(6−k)/6", "\\frac{6-k}{6}"],
  ["(6−4)/6", "\\frac{6-4}{6}"],
  ["2/6=1/3", "\\frac{2}{6}=\\frac{1}{3}"],
  ["E[T]=14.70", "\\mathbb E[T]=14.70"],
  ["E[Wₖ]", "\\mathbb E[W_k]"],
  ["1/pₖ", "\\frac{1}{p_k}"],
  ["1/p", "\\frac{1}{p}"],
  ["1/n", "\\frac{1}{n}"],
  ["k/6", "\\frac{k}{6}"],
  ["2/6", "\\frac{2}{6}"],
  ["1/6", "\\frac{1}{6}"],
  ["1/3", "\\frac{1}{3}"],
  ["2/3", "\\frac{2}{3}"],
  ["6!", "6!"],
  ["6⁶", "6^6"],
  ["1.54%", "1.54\\%"],
  ["100%", "100\\%"],
  ["14.70", "14.70"],
  ["16.2", "16.2"],
  ["T=∞", "T=\\infty"],
  ["C₀=∅", "C_0=\\varnothing"],
  ["n≥1", "n\\ge1"],
  ["n≥0", "n\\ge0"],
  ["n−1", "n-1"],
  ["k+1", "k+1"],
  ["k=6", "k=6"],
  ["j∈S", "j\\in\\mathcal S"],
  ["A—F", "A\\text{--}F"],
  ["1—6", "1\\text{--}6"],
  ["Nₙ₊₁", "N_{n+1}"],
  ["Hₙ₋₁", "H_{n-1}"],
  ["Xₙ₋₁", "X_{n-1}"],
  ["Xₙ", "X_n"],
  ["xₙ", "x_n"],
  ["Cₙ", "C_n"],
  ["Kₙ", "K_n"],
  ["Wₖ", "W_k"],
  ["pₖ", "p_k"],
  ["Tᵣ", "T_r"],
  ["t̄ₙ", "\\bar t_n"],
  ["T̄ₙ", "\\bar T_n"],
  ["E[T]", "\\mathbb E[T]"],
  ["S", "\\mathcal S"],
  ["T", "T"],
  ["n", "n"],
  ["k", "k"],
  ["j", "j"],
  ["p", "p"],
  ["m", "m"],
  ["r", "r"],
  ["A", "A"],
  ["B", "B"],
  ["D", "D"],
  ["0", "0"],
  ["1", "1"],
  ["2", "2"],
  ["3", "3"],
  ["4", "4"],
  ["5", "5"],
  ["6", "6"],
  ["10", "10"],
)

export const BLIND_BOX_LEARNING_STEPS: readonly LearningStep[] = [
  {
    id: "blind-model",
    inlineMath: BLIND_BOX_INLINE_MATH,
    shortTitle: "建立模型",
    title: "建立等可能的盲盒抽取模型",
    objective: "明确样本空间、等可能条件与一轮实验的停止条件。",
    definition:
      "一次抽取的结果集合由 A—F 六种款式组成，每次得到其中一款；整轮实验由连续抽取的结果序列构成，从空收藏开始，在首次集齐六款时结束。",
    mathConcepts: [
      {
        term: "随机试验与观测",
        definition: "在相同条件下可以重复、可能结果已知但单次结果事先不能确定的过程叫随机试验；试验后实际看到并记录结果叫观测。",
        context: "打开第 n 盒是一次随机试验。开盒前结果未知；开盒后看到 A—F 中的一款，就是一次观测。",
        notation: "观测前：Xₙ；观测后：xₙ",
        notationLatex: "\\text{观测前：}\\ X_n;\\quad \\text{观测后：}\\ x_n",
      },
      {
        term: "样本空间与基本结果",
        definition: "一次随机试验所有可能结果组成样本空间，其中每一个单独结果叫基本结果。",
        context: "单次抽取的样本空间是 A—F 六款；每个字母都是一个基本结果。",
        notation: "S={A,B,C,D,E,F}",
        notationLatex: "\\mathcal S=\\{A,B,C,D,E,F\\}",
      },
      {
        term: "随机变量",
        definition: "随机变量是在试验前取值不确定、试验后取得一个确定值的量；通常用大写字母表示，实际观测值用对应小写字母表示。",
        context: "Xₙ 表示第 n 盒的款式，T 表示首次集齐所需盒数；观测到的具体款式记为 xₙ。",
        notation: "Xₙ∈S，T∈{6,7,…}",
        notationLatex: "X_n\\in\\mathcal S,\\quad T\\in\\{6,7,\\ldots\\}",
      },
      {
        term: "事件与概率",
        definition: "由一个或多个基本结果组成、可以判断是否发生的条件叫事件；概率是 0 到 1 之间的数，表示事件发生的可能性。",
        context: "“第 n 盒为 A”是事件；等可能模型中，每个单款事件的概率都是 1/6，六种结果的概率和为 1。",
        notation: "P(Xₙ=A)=1/6",
        notationLatex: "P(X_n=A)=\\frac{1}{6}",
      },
    ],
    formula: "S={A,…,F}；P(Xₙ=j)=1/6；Cₙ={X₁,…,Xₙ}；T=inf{n≥1:Cₙ=S}",
    formulaLatex: "\\begin{aligned}\\mathcal S&=\\{A,B,C,D,E,F\\}\\\\ P(X_n=j)&=\\frac{1}{6}\\\\[-2pt] &n\\in\\mathbb N_{+},\\quad j\\in\\mathcal S\\\\ C_n&=\\{X_1,\\ldots,X_n\\}\\\\ T&=\\inf\\{n\\ge1:C_n=\\mathcal S\\}\\end{aligned}",
    formulaExplanation: {
      formal:
        "设款式集合为 S，Xₙ 表示第 n 次抽取的款式。对任意正整数 n 和任意 j∈S，都有 P(Xₙ=j)=1/6。T 表示已出现款式的集合首次等于 S 时的抽取次数；若始终未集齐，则约定 T=∞。",
      intuitive:
        "每一盒都像重新掷一次公平六面骰，六个字母机会相同。T 就是从第一盒数起，直到收藏架第一次填满六格时一共开的盒数。",
    },
    interpretation:
      "六个基本结果互不重叠且概率之和为 1。公平骰子的 1—6 与六款一一对应，因而能表示这个等可能随机试验。",
    principleLabel: "性质",
    principleTitle: "等可能模型的基本性质",
    workedExample:
      "若骰子掷出 4，就记为得到 D 款。无论前面已经得到哪些款式，这一次试验的六个基本结果仍各占 1/6。",
    boundary:
      "本模型不包含隐藏款、保底机制、交换行为与不等概率设置。",
    visualTitle: "骰子点数与六种款式",
    visualCaption:
      "选择任一点数可核对对应款式；六个基本结果在模型中具有相同概率。",
    check: {
      prompt: "下列哪一项完整描述了一轮实验的停止条件？",
      options: [
        { id: "six-boxes", label: "购买六盒后立即停止" },
        { id: "first-complete", label: "首次同时拥有 A—F 六款时停止" },
        { id: "no-repeat", label: "第一次出现重复款时停止" },
      ],
      correctOptionId: "first-complete",
      explanation:
        "购买盒数不是预先固定的；停止时刻由首次集齐六种不同款式决定。",
    },
  },
  {
    id: "blind-independent",
    inlineMath: BLIND_BOX_INLINE_MATH,
    shortTitle: "独立重复",
    title: "区分抽取次数与不同款式数",
    objective: "理解独立重复抽取允许出现重复款，并解释六盒不能保证集齐。",
    definition:
      "各次抽取相互独立，即前次结果不改变下一次各款的概率。独立不表示结果互不重复。",
    mathConcepts: [
      {
        term: "概率分布",
        definition: "离散随机变量的概率分布列出全部可能取值及其概率，并且各概率之和为 1。",
        context: "每个 Xₙ 都在 A—F 上服从同一个等可能分布。分布相同，不表示有限次观测中六款出现次数一定相同。",
        notation: "P(Xₙ=j)=1/6，ΣⱼP(Xₙ=j)=1",
        notationLatex: "P(X_n=j)=\\frac{1}{6},\\quad \\sum_{j\\in\\mathcal S}P(X_n=j)=1",
      },
      {
        term: "独立同分布样本",
        definition: "在同一规则下重复试验，若各次随机变量互不改变彼此的概率且服从同一分布，就称它们独立同分布。",
        context: "X₁,…,Xₙ 是生成样本的独立同分布随机变量；x₁,…,xₙ 是实际观测到的样本值。“独立”不等于“不重复”。",
        notation: "X₁,…,Xₙ i.i.d.",
        notationLatex: "X_1,\\ldots,X_n\\ \\text{i.i.d.}",
      },
      {
        term: "条件概率与独立性",
        definition: "条件概率 P(A|B) 表示已知 B 发生时 A 的概率。若 A 与 B 独立，知道 B 不会改变 A 的概率。",
        context: "给定前 n−1 盒的完整历史，下一盒得到任意指定款式 j 的概率仍为 1/6。",
        notation: "P(A|B)=P(A∩B)/P(B)",
        notationLatex: "P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}",
      },
    ],
    formula: "Hₙ₋₁={X<ₙ=x<ₙ}；x<ₙ∈Sⁿ⁻¹；P(Xₙ=j | Hₙ₋₁)=1/6",
    formulaLatex: "\\begin{aligned}H_{n-1}&:=\\{X_{<n}=x_{<n}\\}\\\\ P(X_n=j\\mid H_{n-1})&=\\frac{1}{6}\\\\ n&\\ge2,\\quad j\\in\\mathcal S,\\quad x_{<n}\\in\\mathcal S^{n-1}\\end{aligned}",
    formulaExplanation: {
      formal:
        "随机变量 X₁、X₂、… 独立且服从同一个等可能分布。记 X<ₙ=(X₁,…,Xₙ₋₁)，Hₙ₋₁ 表示已经观测到完整历史 X<ₙ=x<ₙ；给定任意这样的历史，第 n 次得到指定款式 j 的条件概率仍为 1/6。",
      intuitive:
        "前面开出了什么，不会偷偷改变下一盒。即使连续出现很多 A，下一盒仍有 1/6 的机会是 A；“独立”不等于“不会重复”。",
    },
    interpretation:
      "独立表示前面的结果不改变下一次的概率分布，不表示每次结果都不同。因此，抽取次数增加时，已有不同款式数可能暂时不变。",
    principleLabel: "性质",
    principleTitle: "独立不等于不重复",
    workedExample:
      "已连续得到两次 A 款。独立性告诉我们：下一次得到 A 的概率仍是 1/6，得到其他任意指定款的概率也是 1/6。",
    boundary:
      "独立性是模型假设；若实际销售存在联动、保底或批次差异，则需重新建模。",
    visualTitle: "短序列中的新款与重复款",
    visualCaption:
      "切换固定教学序列，观察购买次数增加时不同款式数可能保持不变。",
    check: {
      prompt: "已连续两次得到 A 款。在本模型中，下一次得到 A 款的概率是多少？",
      options: [
        { id: "zero", label: "0" },
        { id: "one-sixth", label: "1/6" },
        { id: "one-third", label: "1/3" },
      ],
      correctOptionId: "one-sixth",
      explanation:
        "抽取相互独立，因此已有结果不改变下一次 A 款的概率。",
    },
  },
  {
    id: "blind-stage-probability",
    inlineMath: BLIND_BOX_INLINE_MATH,
    shortTitle: "阶段概率",
    title: "计算下一盒得到新款的概率",
    objective: "根据已有不同款式数 k，计算新款数与下一次成功概率。",
    definition:
      "已有 k 种不同款式时，六种结果中有 6−k 种尚未收集，因此下一次得到新款的概率等于有利结果数除以全部等可能结果数。",
    mathConcepts: [
      {
        term: "集合、基数与状态变量",
        definition: "集合只记录不同元素，重复元素不会重复计数；集合的基数表示其中不同元素的个数。状态变量用一个量概括系统当前状态。",
        context: "Cₙ 记录前 n 盒出现过的款式，Kₙ=|Cₙ| 记录已有不同款式数；抽到重复款时 Kₙ 不增加。",
        notation: "Cₙ={X₁,…,Xₙ}，Kₙ=|Cₙ|",
        notationLatex: "C_n=\\{X_1,\\ldots,X_n\\},\\quad K_n=\\lvert C_n\\rvert",
      },
      {
        term: "互补事件",
        definition: "两个事件若不能同时发生，并且必有一个发生，就互为补事件；它们的概率之和为 1。",
        context: "一轮尚未结束时，下一盒不是新款就是重复款，两种情况互为补事件。",
        notation: "P(新款|Kₙ=k)+P(重复|Kₙ=k)=1",
        notationLatex: "P(\\text{新款}\\mid K_n=k)+P(\\text{重复}\\mid K_n=k)=1",
      },
      {
        term: "等可能计数法",
        definition: "有限个基本结果等可能时，事件概率等于有利结果数除以全部结果数。",
        context: "已有 k 款时，六个等可能结果中有 6−k 个是新款，所以新款概率为 (6−k)/6。",
        notation: "P(A)=有利结果数/全部结果数",
        notationLatex: "P(A)=\\frac{\\text{有利结果数}}{\\text{全部结果数}}",
      },
    ],
    formula: "C₀=∅；Kₙ=|Cₙ|；Nₙ₊₁={Xₙ₊₁∉Cₙ}；P(Nₙ₊₁ | Kₙ=k)=(6−k)/6",
    formulaLatex: "\\begin{gathered}C_0=\\varnothing,\\qquad C_n=\\{X_1,\\ldots,X_n\\}\ (n\\ge1)\\\\ K_n=\\lvert C_n\\rvert\\\\ N_{n+1}=\\{X_{n+1}\\notin C_n\\}\\\\ n\\ge0,\\quad k\\in\\{0,\\ldots,\\min(n,5)\\}\\\\ P(K_n=k)>0\\\\ P(N_{n+1}\\mid K_n=k)=\\frac{6-k}{6}\\end{gathered}",
    formulaExplanation: {
      formal:
        "令 C₀=∅；对 n≥1，Cₙ 是前 n 次已经出现过的款式集合，Kₙ=|Cₙ| 是不同款式数，Nₙ₊₁ 表示下一次得到新款。对任意 n≥0 与 k∈{0,…,min(n,5)}，只要 P(Kₙ=k)>0，就有 P(Nₙ₊₁|Kₙ=k)=(6−k)/6。",
      intuitive:
        "Kₙ 数的是收藏架填了几格，不是买了几盒。六个同样大的机会格中，已有 k 格会得到重复款，剩下 6−k 格才会带来新款。",
    },
    interpretation:
      "当 k 从 0 增大到 5 时，新款概率每次下降 1/6；相应地，重复款概率 k/6 逐步上升。k=6 表示一轮已经结束。",
    principleLabel: "性质",
    principleTitle: "阶段概率的单调变化",
    workedExample:
      "已有 4 款时尚缺 2 款。六个等可能结果中有 2 个是新款，所以下一盒得到新款的概率为 2/6=1/3。",
    workedExampleFormula: "P(新款\mid k=4)=2/6=1/3",
    workedExampleLatex: "P(\\text{新款}\\mid k=4)=\\frac{2}{6}=\\frac{1}{3}",
    boundary:
      "公式依赖六款等概率且每次独立的条件，不可直接用于不等概率款式。",
    visualTitle: "k 与新款概率联动",
    visualCaption:
      "拖动 k，收藏架、未收集款数和概率条同步更新。",
    check: {
      prompt: "已经收集 4 款时，下一盒得到新款的概率是多少？",
      options: [
        { id: "one-sixth", label: "1/6" },
        { id: "one-third", label: "1/3" },
        { id: "two-thirds", label: "2/3" },
      ],
      correctOptionId: "one-third",
      explanation: "尚缺 2 款，所以 P(新款)=(6−4)/6=2/6=1/3。",
    },
  },
  {
    id: "blind-waiting",
    inlineMath: BLIND_BOX_INLINE_MATH,
    shortTitle: "平均等待",
    title: "分阶段求理论平均集齐次数",
    objective: "把每一阶段获得下一新款的平均等待次数相加。",
    definition:
      "若某阶段每次得到新款的概率为 p，则获得下一新款的理论平均等待次数为 1/p。六个阶段的等待次数可以相加。",
    mathConcepts: [
      {
        term: "等待时间随机变量",
        definition: "从某阶段开始到第一次成功所经历的试验次数叫等待时间，成功的那次也计入。",
        context: "Wₖ 表示已有 k 款后，等到下一款新品所需的盒数，所以可能取 1、2、3……。",
        notation: "Wₖ∈{1,2,3,…}",
        notationLatex: "W_k\\in\\{1,2,3,\\ldots\\}",
      },
      {
        term: "几何分布",
        definition: "独立重复试验中，若每次成功概率始终为 p，首次成功的等待时间就服从几何分布。",
        context: "已有 k 款时，每盒得到新款的概率固定为 pₖ=(6−k)/6，因此 Wₖ 服从参数 pₖ 的几何分布。",
        notation: "P(Wₖ=m)=(1−pₖ)ᵐ⁻¹pₖ",
        notationLatex: "P(W_k=m)=(1-p_k)^{m-1}p_k",
      },
      {
        term: "期望",
        definition: "离散随机变量的期望是所有可能取值按概率加权得到的理论平均，不是对单次结果的保证。",
        context: "几何分布的平均等待为 E[Wₖ]=1/pₖ；E[T]=14.70 不表示每轮恰好开 14.70 盒。",
        notation: "E[Y]=Σᵧ yP(Y=y)",
        notationLatex: "E[Y]=\\sum_y yP(Y=y)",
      },
      {
        term: "期望的可加性",
        definition: "若各随机变量期望存在，和的期望等于各项期望之和；这一性质本身不要求各项独立。",
        context: "总盒数 T 是六个阶段等待时间之和，所以可以把六段平均等待相加。",
        notation: "E[ΣWₖ]=ΣE[Wₖ]",
        notationLatex: "E\\!\\left[\\sum_k W_k\\right]=\\sum_k E[W_k]",
      },
    ],
    formula: "pₖ=(6−k)/6；P(Wₖ=m)=(1−pₖ)ᵐ⁻¹pₖ；T=Σₖ₌₀⁵Wₖ；E[T]=14.70",
    formulaLatex: "\\begin{aligned}p_k&=\\frac{6-k}{6},\\quad k=0,\\ldots,5\\\\ P(W_k=m)&=(1-p_k)^{m-1}p_k,\\quad m=1,2,\\ldots\\\\ W_k&\\sim\\operatorname{Geom}(p_k),\\qquad \\mathbb E[W_k]=\\frac1{p_k}\\\\ T&=\\sum_{k=0}^{5}W_k\\\\ \\mathbb E[T]&=\\sum_{k=0}^{5}\\frac{6}{6-k}=6\\sum_{r=1}^{6}\\frac1r=\\frac{147}{10}=14.70\\end{aligned}",
    formulaExplanation: {
      formal:
        "Wₖ 表示已有 k 款时，等到第 k+1 款所需的盒数，成功的那盒也计入；它服从成功概率 (6−k)/6 的几何分布。总盒数 T 是六个阶段等待量之和，利用期望的可加性得到 E[T]=14.70。",
      intuitive:
        "把“集齐六款”拆成六段路：每段都等到下一款出现，再把六段的平均步数相加。越接近集齐，新款出口越少，最后一段平均最久。",
    },
    interpretation:
      "期望具有可加性：总等待次数的期望等于六个阶段期望之和。最后一款对应成功概率 1/6，平均等待 6 盒，是平均等待最长的阶段。",
    principleLabel: "性质",
    principleTitle: "期望的可加性",
    workedExample:
      "已有 5 款时，每盒抽中最后一款的概率是 1/6。这意味着“平均还要等 6 盒”，不是说第 6 盒一定成功。",
    boundary:
      "14.70 是理论平均数，不是单轮保证；单轮购买次数没有固定的有限上限。",
    visualTitle: "六阶段平均等待阶梯",
    visualCaption:
      "逐级展开 1、1.2、1.5、2、3、6，阶梯总和为 14.70。",
    lockedUntilExperiment: true,
    check: {
      prompt: "为什么等待最后一款通常最困难？",
      options: [
        { id: "smallest-p", label: "此阶段新款概率最低，为 1/6" },
        { id: "memory", label: "盲盒会记住此前的购买结果" },
        { id: "impossible", label: "最后一款不可能出现" },
      ],
      correctOptionId: "smallest-p",
      explanation: "成功概率越低，获得下一新款的平均等待次数 1/p 越大。",
    },
  },
  {
    id: "blind-data-theory",
    inlineMath: BLIND_BOX_INLINE_MATH,
    shortTitle: "数据与理论",
    title: "区分实验均值与理论平均",
    objective: "读取直方图和累计均值，并解释有限样本中的随机波动。",
    definition:
      "理论平均数 14.70 由模型推导；实验均值是有限轮观测值的算术平均。概率和期望属于模型，频数、频率和样本均值来自实验数据，两类量不能混为一谈。",
    mathConcepts: [
      {
        term: "频数、频率与经验分布",
        definition: "某结果出现的次数叫频数，频数除以总轮数叫频率；用各结果或区间的频率描述样本，得到经验分布。",
        context: "直方图展示集齐盒数的频数或频率，是 T 的经验分布；模型给出的概率构成理论分布，二者不能混称。",
        notation: "频率=频数/n",
        notationLatex: "\\text{频率}=\\frac{\\text{频数}}{n}",
      },
      {
        term: "样本均值与理论期望",
        definition: "样本均值是观测数据的算术平均，会随样本改变；期望是由概率模型确定的理论量。",
        context: "观测 t₁,…,tₙ 后计算样本均值；理论期望 E[T]=14.70 由模型推导。",
        notation: "t̄ₙ=(1/n)Σᵣtᵣ，E[T]=14.70",
        notationLatex: "\\bar t_n=\\frac{1}{n}\\sum_r t_r,\\quad E[T]=14.70",
      },
      {
        term: "大数定律与随机波动",
        definition: "独立同分布且期望有限时，样本均值会随样本量增大而趋近理论期望；有限样本仍会随机偏离。",
        context: "重复完整实验并每轮重置收藏后，累计均值总体趋近 14.70，但不必逐轮单调靠近，也不必在有限轮时恰好相等。",
        notation: "T̄ₙ→E[T]（n 增大）",
        notationLatex: "\\bar T_n\\to E[T]\\quad(n\\text{ 增大})",
      },
    ],
    formula: "T̄ₙ=(1/n)Σᵣ₌₁ⁿTᵣ",
    formulaLatex: "\\bar T_n=\\frac1n\\sum_{r=1}^{n}T_r",
    formulaExplanation: {
      formal:
        "Tᵣ 表示第 r 轮首次集齐所用的盒数；在相同模型下独立重复 n 轮时，T₁、…、Tₙ 是相互独立同分布的随机变量，且 E[Tᵣ]=14.70。观测到具体数值 t₁、…、tₙ 后，样本均值就是 t̄ₙ=(1/n)Σtᵣ。",
      intuitive:
        "每轮实验都会得到一个“用了多少盒”的成绩。把 n 轮成绩全部相加再除以 n，就是累计平均；14.70 是长期平均所趋近的理论值，不要求某一轮恰好等于它。",
    },
    interpretation:
      "在模型条件不变、各轮独立时，大数定律说明样本均值通常会随轮数增多而趋近理论平均数。它不保证累计均值单调接近，也不保证有限样本恰好等于 14.70。",
    principleLabel: "定理",
    principleTitle: "大数定律（直观表述）",
    workedExample:
      "恰好购买 6 盒就集齐，要求六次抽取中 A—F 各出现一次。可行排列有 6!种，全部等可能序列有 6⁶种，所以这个概率约为 1.54%。",
    workedExampleFormula: "P(6 盒恰好集齐)=6!/6⁶≈1.54%",
    workedExampleLatex: "P(T=6)=\\frac{6!}{6^6}\\approx1.54\\%",
    boundary:
      "模拟用于观察与检验，不替代理论推导；固定种子教学样本不构成学生实测证据。",
    visualTitle: "样本分布与累计均值",
    visualCaption:
      "切换样本量，比较直方图、累计均值末值与理论平均数 14.70。",
    lockedUntilExperiment: true,
    check: {
      prompt: "10 轮实验的平均数为 16.2，能否据此否定理论平均数 14.70？",
      options: [
        { id: "reject", label: "能，因为两个数不相等" },
        { id: "not-reject", label: "不能，有限样本均值会发生随机波动" },
        { id: "guarantee", label: "能，因为每轮都应等于 14.70" },
      ],
      correctOptionId: "not-reject",
      explanation:
        "理论平均数描述大量独立重复实验的平均趋势，少量样本偏离属于可能的随机波动。",
    },
  },
] as const
