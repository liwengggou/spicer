type TestFn = () => void | Promise<void>

type Expectation<T> = {
  toBe(value: T): void
  toMatch(value: RegExp): void
  toContain(value: unknown): void
  toHaveProperty(key: string): void
  toBeTruthy(): void
  toBeGreaterThan(value: number): void
}

type TestResult = {
  passed: number
  failed: number
  logs: string[]
}

const results: TestResult = {
  passed: 0,
  failed: 0,
  logs: [],
}

const suiteStack: string[] = []

function record(success: boolean, name: string, error?: unknown) {
  if (success) {
    results.passed += 1
  } else {
    results.failed += 1
    const message = error instanceof Error ? error.message : String(error)
    results.logs.push(`${name}: ${message}`)
  }
}

function fullName(name: string) {
  return [...suiteStack, name].filter(Boolean).join(" > ")
}

export function describe(name: string, fn: () => void) {
  suiteStack.push(name)
  try {
    fn()
  } finally {
    suiteStack.pop()
  }
}

export function it(name: string, fn: TestFn) {
  const label = fullName(name)
  try {
    const out = fn()
    if (out && typeof (out as Promise<unknown>).then === "function") {
      return (out as Promise<unknown>)
        .then(() => record(true, label))
        .catch((err) => record(false, label, err))
    }
    record(true, label)
  } catch (err) {
    record(false, label, err)
  }
}

function makeError(message: string) {
  return new Error(message)
}

export function expect<T>(actual: T): Expectation<T> {
  return {
    toBe(value: T) {
      if (actual !== value) throw makeError(`Expected ${String(actual)} to be ${String(value)}`)
    },
    toMatch(value: RegExp) {
      if (typeof actual !== "string" || !value.test(actual)) {
        throw makeError(`Expected ${String(actual)} to match ${String(value)}`)
      }
    },
    toContain(value: unknown) {
      if (typeof (actual as unknown as { includes?: (v: unknown) => boolean })?.includes !== "function") {
        throw makeError("Actual value is not iterable")
      }
      if (!(actual as unknown as { includes: (v: unknown) => boolean }).includes(value)) {
        throw makeError(`Expected ${String(actual)} to contain ${String(value)}`)
      }
    },
    toHaveProperty(key: string) {
      if (actual === null || typeof actual !== "object" || !(key in (actual as object))) {
        throw makeError(`Expected object to have property ${key}`)
      }
    },
    toBeTruthy() {
      if (!actual) throw makeError("Expected value to be truthy")
    },
    toBeGreaterThan(value: number) {
      if (typeof (actual as unknown) !== "number" || (actual as unknown as number) <= value) {
        throw makeError(`Expected ${String(actual)} to be greater than ${value}`)
      }
    },
  }
}

export function resetResults() {
  results.passed = 0
  results.failed = 0
  results.logs = []
}

export function getResults() {
  return { ...results }
}
