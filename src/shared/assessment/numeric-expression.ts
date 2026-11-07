export type NumericParseErrorCode =
  | "EMPTY_EXPRESSION"
  | "EXPRESSION_TOO_LONG"
  | "EXPRESSION_TOO_COMPLEX"
  | "INVALID_TOKEN"
  | "UNEXPECTED_TOKEN"
  | "DIVISION_BY_ZERO"
  | "NON_FINITE_RESULT"

export interface NumericParseSuccess {
  readonly ok: true
  readonly value: number
  readonly normalizedExpression: string
}

export interface NumericParseError {
  readonly ok: false
  readonly errorCode: NumericParseErrorCode
}

export type NumericParseResult = NumericParseSuccess | NumericParseError

type TokenKind =
  | "number"
  | "pi"
  | "plus"
  | "minus"
  | "multiply"
  | "divide"
  | "power"
  | "percent"
  | "left-parenthesis"
  | "right-parenthesis"
  | "end"

interface Token {
  readonly kind: TokenKind
  readonly value?: number
}

class ParseFailure extends Error {
  constructor(readonly code: NumericParseErrorCode) {
    super(code)
  }
}

const MAX_EXPRESSION_LENGTH = 160
const MAX_TOKEN_COUNT = 96
const MAX_NESTING_DEPTH = 24

const superscriptDigits: Readonly<Record<string, string>> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
}

function normalizeExpression(source: string): string {
  return source
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) =>
      `^${[...run].map((character) => superscriptDigits[character]).join("")}`,
    )
    .normalize("NFKC")
    .replace(/[−–—]/g, "-")
    .replace(/[×·⋅]/g, "*")
    .replace(/÷/g, "/")
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  let cursor = 0

  const push = (token: Token) => {
    tokens.push(token)
    if (tokens.length > MAX_TOKEN_COUNT) {
      throw new ParseFailure("EXPRESSION_TOO_COMPLEX")
    }
  }

  while (cursor < expression.length) {
    const character = expression[cursor]
    if (/\s/u.test(character)) {
      cursor += 1
      continue
    }

    const numberMatch = expression
      .slice(cursor)
      .match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/)
    if (numberMatch) {
      const value = Number(numberMatch[0])
      if (!Number.isFinite(value)) {
        throw new ParseFailure("NON_FINITE_RESULT")
      }
      push({ kind: "number", value })
      cursor += numberMatch[0].length
      continue
    }

    if (character === "π") {
      push({ kind: "pi" })
      cursor += 1
      continue
    }

    const identifierMatch = expression.slice(cursor).match(/^[A-Za-z]+/)
    if (identifierMatch) {
      if (identifierMatch[0].toLowerCase() !== "pi") {
        throw new ParseFailure("INVALID_TOKEN")
      }
      push({ kind: "pi" })
      cursor += identifierMatch[0].length
      continue
    }

    const operatorKinds: Readonly<Record<string, TokenKind>> = {
      "+": "plus",
      "-": "minus",
      "*": "multiply",
      "/": "divide",
      "^": "power",
      "%": "percent",
      "(": "left-parenthesis",
      ")": "right-parenthesis",
    }
    const kind = operatorKinds[character]
    if (!kind) {
      throw new ParseFailure("INVALID_TOKEN")
    }
    push({ kind })
    cursor += 1
  }

  tokens.push({ kind: "end" })
  return tokens
}

class RestrictedNumericParser {
  private cursor = 0
  private nestingDepth = 0

  constructor(private readonly tokens: readonly Token[]) {}

  parse(): number {
    const value = this.parseExpression()
    if (this.peek().kind !== "end") {
      throw new ParseFailure("UNEXPECTED_TOKEN")
    }
    return this.ensureFinite(value)
  }

  private parseExpression(): number {
    let value = this.parseTerm()
    while (this.peek().kind === "plus" || this.peek().kind === "minus") {
      const operator = this.take().kind
      const right = this.parseTerm()
      value = this.ensureFinite(operator === "plus" ? value + right : value - right)
    }
    return value
  }

  private parseTerm(): number {
    let value = this.parseUnary()
    while (true) {
      const nextKind = this.peek().kind
      if (nextKind === "multiply" || nextKind === "divide") {
        this.take()
        const right = this.parseUnary()
        if (nextKind === "divide" && right === 0) {
          throw new ParseFailure("DIVISION_BY_ZERO")
        }
        value = this.ensureFinite(
          nextKind === "multiply" ? value * right : value / right,
        )
        continue
      }

      // Conventional unambiguous implicit multiplication: 24π and 2(3 + 4).
      if (nextKind === "pi" || nextKind === "left-parenthesis") {
        value = this.ensureFinite(value * this.parseUnary())
        continue
      }
      return value
    }
  }

  private parseUnary(): number {
    if (this.peek().kind === "plus") {
      this.take()
      return this.withNesting(() => this.parseUnary())
    }
    if (this.peek().kind === "minus") {
      this.take()
      return this.ensureFinite(-this.withNesting(() => this.parseUnary()))
    }
    return this.parsePower()
  }

  private parsePower(): number {
    const base = this.parsePostfix()
    if (this.peek().kind !== "power") {
      return base
    }
    this.take()
    const exponent = this.withNesting(() => this.parseUnary())
    return this.ensureFinite(base ** exponent)
  }

  private parsePostfix(): number {
    let value = this.parsePrimary()
    if (this.peek().kind === "percent") {
      this.take()
      value /= 100
      if (this.peek().kind === "percent") {
        throw new ParseFailure("UNEXPECTED_TOKEN")
      }
    }
    return this.ensureFinite(value)
  }

  private parsePrimary(): number {
    const token = this.take()
    if (token.kind === "number") {
      return token.value as number
    }
    if (token.kind === "pi") {
      return Math.PI
    }
    if (token.kind === "left-parenthesis") {
      const value = this.withNesting(() => this.parseExpression())
      if (this.take().kind !== "right-parenthesis") {
        throw new ParseFailure("UNEXPECTED_TOKEN")
      }
      return value
    }
    throw new ParseFailure("UNEXPECTED_TOKEN")
  }

  private withNesting<T>(operation: () => T): T {
    this.nestingDepth += 1
    if (this.nestingDepth > MAX_NESTING_DEPTH) {
      throw new ParseFailure("EXPRESSION_TOO_COMPLEX")
    }
    try {
      return operation()
    } finally {
      this.nestingDepth -= 1
    }
  }

  private ensureFinite(value: number): number {
    if (!Number.isFinite(value)) {
      throw new ParseFailure("NON_FINITE_RESULT")
    }
    return value
  }

  private peek(): Token {
    return this.tokens[this.cursor]
  }

  private take(): Token {
    const token = this.peek()
    if (token.kind !== "end") {
      this.cursor += 1
    }
    return token
  }
}

/**
 * Parses only numeric literals, pi, +, -, *, /, ^, %, parentheses, and the
 * implicit products `24π` / `2(3 + 4)`. It never executes JavaScript.
 */
export function parseNumericExpression(
  input: string | number,
): NumericParseResult {
  if (typeof input === "number") {
    return Number.isFinite(input)
      ? { ok: true, value: input, normalizedExpression: String(input) }
      : { ok: false, errorCode: "NON_FINITE_RESULT" }
  }

  if (input.trim() === "") {
    return { ok: false, errorCode: "EMPTY_EXPRESSION" }
  }
  if (input.length > MAX_EXPRESSION_LENGTH) {
    return { ok: false, errorCode: "EXPRESSION_TOO_LONG" }
  }

  const normalizedExpression = normalizeExpression(input)
  try {
    const tokens = tokenize(normalizedExpression)
    const value = new RestrictedNumericParser(tokens).parse()
    return { ok: true, value, normalizedExpression }
  } catch (error) {
    if (error instanceof ParseFailure) {
      return { ok: false, errorCode: error.code }
    }
    return { ok: false, errorCode: "INVALID_TOKEN" }
  }
}

/** Unit aliases remain an explicit part of each question's rule. */
export function normalizeUnit(unit: string): string {
  return unit.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/gu, "")
}
