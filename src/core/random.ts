const INT32_MIN = -2_147_483_648
const INT32_MAX = 2_147_483_647
const MSEED = 161_803_398
const SAMPLE_SCALE = 1 / INT32_MAX

export interface RandomSource {
  next(minInclusive: number, maxExclusive: number): number
}

/**
 * The seeded, subtractive System.Random algorithm used by the existing
 * PowerShell experiment. Keeping this implementation versioned and isolated
 * lets browser runs reproduce the research CSV files exactly.
 */
export class DotNetRandom implements RandomSource {
  private readonly seedArray = new Array<number>(56).fill(0)

  private inext = 0

  private inextp = 21

  constructor(seed: number) {
    assertInt32(seed, "seed")

    const subtraction = seed === INT32_MIN ? INT32_MAX : Math.abs(seed)
    let mj = MSEED - subtraction
    this.seedArray[55] = mj
    let mk = 1

    for (let i = 1; i < 55; i += 1) {
      const ii = (21 * i) % 55
      this.seedArray[ii] = mk
      mk = mj - mk

      if (mk < 0) {
        mk += INT32_MAX
      }

      mj = this.seedArray[ii]
    }

    for (let pass = 1; pass < 5; pass += 1) {
      for (let i = 1; i < 56; i += 1) {
        // System.Random performs this subtraction as an unchecked Int32.
        // The explicit wrap is required for large seeds where JS numbers
        // would otherwise retain values above Int32.MaxValue.
        this.seedArray[i] = (
          this.seedArray[i] - this.seedArray[1 + ((i + 30) % 55)]
        ) | 0

        if (this.seedArray[i] < 0) {
          this.seedArray[i] += INT32_MAX
        }
      }
    }
  }

  next(): number

  next(maxExclusive: number): number

  next(minInclusive: number, maxExclusive: number): number

  next(first?: number, second?: number): number {
    if (first === undefined) {
      return this.internalSample()
    }

    if (second === undefined) {
      assertInt32(first, "maxExclusive")

      if (first < 0) {
        throw new RangeError("maxExclusive must be non-negative")
      }

      return Math.trunc(this.sample() * first)
    }

    assertInt32(first, "minInclusive")
    assertInt32(second, "maxExclusive")

    if (first > second) {
      throw new RangeError("minInclusive must be less than or equal to maxExclusive")
    }

    const range = second - first
    const scaled =
      range <= INT32_MAX ? this.sample() : this.sampleForLargeRange()

    return Math.trunc(scaled * range) + first
  }

  nextDouble(): number {
    return this.sample()
  }

  private sample(): number {
    return this.internalSample() * SAMPLE_SCALE
  }

  private internalSample(): number {
    let nextIndex = this.inext + 1
    let nextPartnerIndex = this.inextp + 1

    if (nextIndex >= 56) {
      nextIndex = 1
    }

    if (nextPartnerIndex >= 56) {
      nextPartnerIndex = 1
    }

    let result = this.seedArray[nextIndex] - this.seedArray[nextPartnerIndex]

    if (result === INT32_MAX) {
      result -= 1
    }

    if (result < 0) {
      result += INT32_MAX
    }

    this.seedArray[nextIndex] = result
    this.inext = nextIndex
    this.inextp = nextPartnerIndex

    return result
  }

  private sampleForLargeRange(): number {
    let result = this.internalSample()

    if (this.internalSample() % 2 === 0) {
      result = -result
    }

    let sample = result
    sample += INT32_MAX - 1
    sample /= 2 * INT32_MAX - 1
    return sample
  }
}

function assertInt32(value: number, name: string): void {
  if (
    !Number.isInteger(value) ||
    value < INT32_MIN ||
    value > INT32_MAX
  ) {
    throw new RangeError(`${name} must be a 32-bit integer`)
  }
}
