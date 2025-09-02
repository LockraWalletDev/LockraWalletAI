/**
 * testUtils.ts
 * Deterministic helpers for unit and integration testing.
 * - Deep structural equality (no JSON.stringify pitfalls)
 * - Stable diff-friendly stringification
 * - Async assertions and timeouts
 * - Deterministic ID / wallet address factory (no randomness)
 */

/* --------------------------- Equality helpers --------------------------- */

export function assertEqual<T>(actual: T, expected: T, msg?: string): void {
  if (deepEqual(actual, expected)) return
  const a = stableStringify(actual)
  const e = stableStringify(expected)
  const header = msg ? `${msg}\n` : ""
  throw new Error(
    `${header}Assertion failed: values are not equal\n` +
      `expected: ${e}\n` +
      `actual  : ${a}`
  )
}

/** Numeric assertion with absolute/relative tolerance. */
export function assertApproxEqual(
  actual: number,
  expected: number,
  opts: { abs?: number; rel?: number } = {}
): void {
  const { abs = 1e-9, rel = 1e-9 } = opts
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    throw new Error(`assertApproxEqual requires finite numbers (got ${actual}, ${expected})`)
  }
  const diff = Math.abs(actual - expected)
  const scale = Math.max(1, Math.abs(expected))
  if (diff <= abs || diff / scale <= rel) return
  throw new Error(
    `Assertion failed: ${actual} ≉ ${expected} (abs=${diff}, absTol=${abs}, rel=${diff /
      scale}, relTol=${rel})`
  )
}

/** Deep structural equality that handles Maps/Sets/Dates/RegExps/TypedArrays/NaN/-0 and cycles. */
export function deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false

  const aStack = new WeakMap<object, object>()
  const bStack = new WeakMap<object, object>()

  const eq = (x: any, y: any): boolean => {
    if (Object.is(x, y)) return true
    if (typeof x !== "object" || x === null || typeof y !== "object" || y === null) return false

    // Cycle check
    const ax = aStack.get(x)
    if (ax && ax === y) return true
    aStack.set(x, y)
    bStack.set(y, x)

    // Buffer
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(x) && Buffer.isBuffer?.(y)) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return x.equals(y)
    }

    // Typed arrays
    if (ArrayBuffer.isView(x) && ArrayBuffer.isView(y)) {
      if (x.constructor !== y.constructor || x.length !== y.length) return false
      for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) return false
      return true
    }

    // Date
    if (x instanceof Date && y instanceof Date) return x.getTime() === y.getTime()

    // RegExp
    if (x instanceof RegExp && y instanceof RegExp)
      return x.source === y.source && x.flags === y.flags

    // Set
    if (x instanceof Set && y instanceof Set) {
      if (x.size !== y.size) return false
      const used = new Array(y.size).fill(false)
      const yArr = Array.from(y)
      outer: for (const xv of x) {
        for (let i = 0; i < yArr.length; i++) {
          if (!used[i] && eq(xv, yArr[i])) {
            used[i] = true
            continue outer
          }
        }
        return false
      }
      return true
    }

    // Map (keys may be objects)
    if (x instanceof Map && y instanceof Map) {
      if (x.size !== y.size) return false
      const yEntries = Array.from(y.entries())
      const used = new Array(yEntries.length).fill(false)
      outerMap: for (const [kx, vx] of x.entries()) {
        for (let i = 0; i < yEntries.length; i++) {
          if (used[i]) continue
          const [ky, vy] = yEntries[i]
          if (eq(kx, ky) && eq(vx, vy)) {
            used[i] = true
            continue outerMap
          }
        }
        return false
      }
      return true
    }

    // Plain objects / arrays
    if (Object.getPrototypeOf(x) !== Object.getPrototypeOf(y)) return false
    const kx = [...Object.keys(x), ...Object.getOwnPropertySymbols(x) as any[]]
    const ky = [...Object.keys(y), ...Object.getOwnPropertySymbols(y) as any[]]
    if (kx.length !== ky.length) return false
    // Sort keys deterministically for comparison
    const sortKey = (k: any) => (typeof k === "symbol" ? k.description ?? "" : String(k))
    kx.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0))
    ky.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0))
    for (let i = 0; i < kx.length; i++) {
      if (!Object.is(kx[i], ky[i])) return false
      const key = kx[i]
      if (!eq(x[key], y[key])) return false
    }
    return true
  }

  return eq(a, b)
}

/* --------------------------- Async test helpers --------------------------- */

export function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms))
}

/** Rejects if the promise resolves; passes if it rejects (optionally validate the error). */
export async function assertRejects<T = unknown>(
  p: Promise<unknown>,
  validate?: (err: any) => void
): Promise<void> {
  try {
    await p
  } catch (err) {
    if (validate) validate(err)
    return
  }
  throw new Error("Assertion failed: promise resolved but was expected to reject")
}

/** Enforce a timeout on an async operation. */
export async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  msg = `Operation timed out after ${ms}ms`
): Promise<T> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(msg)), ms)
  })
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return await Promise.race([p, timeout])
  } finally {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    clearTimeout(timer)
  }
}

/* ------------------------- Deterministic ID helpers ------------------------ */

/**
 * Create a deterministic ID factory for tests (no randomness).
 * Example:
 *   const nextWallet = makeIdFactory("MockWallet");
 *   nextWallet(); // "MockWallet1"
 *   nextWallet(); // "MockWallet2"
 */
export function makeIdFactory(prefix = "id", start = 1): () => string {
  let n = Math.floor(start)
  if (!Number.isFinite(n)) n = 1
  return () => `${prefix}${n++}`
}

const nextMockWallet = makeIdFactory("MockWallet")

/** Deterministic mock wallet address (increments each call) */
export function mockWalletAddress(): string {
  return nextMockWallet()
}

/* ---------------------------- Stable stringify ---------------------------- */

/** Stable, cycle-safe stringify with sorted keys and truncation for diffs. */
export function stableStringify(
  value: unknown,
  opts: { maxLength?: number } = {}
): string {
  const { maxLength = 10_000 } = opts
  const seen = new WeakSet<object>()
  const sym = (s: symbol) => (s.description ? `Symbol(${s.description})` : "Symbol()")

  const replacer = (_k: string, v: any) => {
    if (typeof v === "object" && v !== null) {
      if (seen.has(v)) return "[Circular]"
      seen.add(v)
      if (v instanceof Date) return `Date(${isFinite(v.getTime()) ? v.toISOString() : "Invalid"})`
      if (v instanceof RegExp) return `RegExp(${v.source}/${v.flags})`
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(v)) return `Buffer(len=${v.length})`
      if (ArrayBuffer.isView(v)) return `${v.constructor.name}(len=${(v as any).length})`
      if (v instanceof Set) return { __set__: Array.from(v.values()).sort() }
      if (v instanceof Map) {
        const arr = Array.from(v.entries()).map(([k, val]) => [k, val])
        arr.sort(([a], [b]) => {
          const sa = typeof a === "symbol" ? sym(a) : String(a)
          const sb = typeof b === "symbol" ? sym(b) : String(b)
          return sa < sb ? -1 : sa > sb ? 1 : 0
        })
        return { __map__: arr }
      }
      const keys = [
        ...Object.keys(v),
        ...Object.getOwnPropertySymbols(v).map(sym)
      ].sort()
      const out: Record<string, any> = {}
      for (const k of keys) {
        const key = typeof k === "symbol" ? sym(k) : k
        out[key] = (v as any)[k as any]
      }
      return out
    }
    if (typeof v === "symbol") return sym(v)
    if (typeof v === "number" && !Number.isFinite(v)) return String(v)
    if (typeof v === "bigint") return `BigInt(${v.toString()})`
    return v
  }

  const s = JSON.stringify(value, replacer)
  return s.length <= maxLength ? s : s.slice(0, maxLength) + "…(truncated)"
}
