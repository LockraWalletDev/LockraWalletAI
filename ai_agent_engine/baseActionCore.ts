export interface ActionContext<P = Record<string, any>, M = Record<string, any>> {
  payload: P
  meta?: M
}

export type ActionResult<O = unknown> = {
  success: boolean
  output?: O
  error?: string
  /** Optional machine-readable code (e.g., "VALIDATION_FAILED", "ABORTED", "TIMEOUT") */
  code?: string
  /** Execution duration in milliseconds (includes retries, if any) */
  durationMs?: number
}

export class ActionError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = "ActionError"
    this.code = code
  }
}

export interface RunOptions {
  /** Abort signal to cancel execution */
  signal?: AbortSignal
  /** Abort after this many ms (default: no timeout) */
  timeoutMs?: number
  /** Number of retries on retryable errors (default: 0) */
  retries?: number
  /** Base backoff (ms); actual delay = base * attempt^2 (default: 250) */
  backoffMs?: number
  /** Custom retry predicate (return true to retry) */
  shouldRetry?: (err: unknown) => boolean
}

/**
 * Abstract action core with strong validation, optional timeout/abort, and deterministic retries.
 * Generic params:
 *  P: payload type, O: output type, M: meta type
 */
export abstract class BaseActionCore<
  P = Record<string, any>,
  O = unknown,
  M = Record<string, any>
> {
  protected context: ActionContext<P, M>
  private running = false

  constructor(initialContext: ActionContext<P, M>) {
    this.context = { payload: initialContext.payload, meta: initialContext.meta }
  }

  /**
   * Validate input/context. Return `true` when valid,
   * or a string / string[] with human-readable errors.
   */
  abstract validate(): true | string | string[]

  /**
   * Execute the action. If your implementation supports abort/timeout,
   * you can read an optional `{ signal }` argument (it will be passed by run()).
   */
  abstract execute(...args: any[]): Promise<O>

  /**
   * Run the action with validation, optional timeout/abort and retries.
   * Prevents re-entrancy: concurrent run() calls will be rejected.
   */
  async run(opts: RunOptions = {}): Promise<ActionResult<O>> {
    const startedAt = Date.now()
    if (this.running) {
      return {
        success: false,
        error: "Action is already running",
        code: "ALREADY_RUNNING",
        durationMs: 0,
      }
    }

    // 1) Validation
    const validation = this.validate()
    if (validation !== true) {
      const msg =
        Array.isArray(validation) ? validation.join("; ") :
        typeof validation === "string" ? validation :
        "Validation failed"
      return {
        success: false,
        error: msg,
        code: "VALIDATION_FAILED",
        durationMs: Date.now() - startedAt,
      }
    }

    // 2) Execute with retries / timeout / abort
    const retries = Math.max(0, opts.retries ?? 0)
    const backoffMs = Math.max(0, opts.backoffMs ?? 250)
    const shouldRetry = opts.shouldRetry ?? defaultShouldRetry
    const signal = opts.signal
    const timeoutMs = opts.timeoutMs ?? 0

    this.running = true
    try {
      let lastErr: any = null
      for (let attempt = 1; attempt <= retries + 1; attempt++) {
        if (signal?.aborted) {
          return {
            success: false,
            error: String(signal.reason ?? "Aborted"),
            code: "ABORTED",
            durationMs: Date.now() - startedAt,
          }
        }
        try {
          const out = await withTimeout(
            Promise.resolve((this as any).execute({ signal })),
            timeoutMs,
            signal
          )
          return {
            success: true,
            output: out,
            durationMs: Date.now() - startedAt,
          }
        } catch (err) {
          lastErr = err
          if (attempt <= retries && shouldRetry(err)) {
            const delay = backoffMs * attempt * attempt
            await sleep(delay)
            continue
          }
          // not retrying anymore
          const { message, code } = toActionError(err)
          return {
            success: false,
            error: message,
            code,
            durationMs: Date.now() - startedAt,
          }
        }
      }
      // Should be unreachable
      const { message, code } = toActionError(lastErr)
      return { success: false, error: message, code, durationMs: Date.now() - startedAt }
    } finally {
      this.running = false
    }
  }

  /**
   * Shallow-update context; payload/meta are merged shallowly to preserve other keys.
   */
  updateContext(updates: Partial<ActionContext<P, M>>): void {
    const next: ActionContext<P, M> = {
      payload: {
        ...(this.context.payload as any),
        ...(updates.payload as any),
      },
      meta: {
        ...(this.context.meta as any),
        ...(updates.meta as any),
      } as M | undefined,
    }
    this.context = next
  }

  /** Replace the whole context (use with care). */
  setContext(next: ActionContext<P, M>): void {
    this.context = { payload: next.payload, meta: next.meta }
  }

  /** Get a defensive copy of the current context to avoid accidental outside mutation. */
  getContext(): ActionContext<P, M> {
    return {
      payload: clonePlain(this.context.payload),
      meta: this.context.meta ? clonePlain(this.context.meta) : undefined,
    }
  }

  /** Convenience getters/setters */
  getPayload(): P {
    return this.context.payload
  }
  setPayload(p: P): void {
    this.context = { ...this.context, payload: p }
  }
  getMeta(): M | undefined {
    return this.context.meta
  }
  setMeta(m: M | undefined): void {
    this.context = { ...this.context, meta: m }
  }
}

// -------------------- helpers --------------------

function sleep(ms: number): Promise<void> {
  if (!ms || ms <= 0) return Promise.resolve()
  return new Promise(res => setTimeout(res, ms))
}

function withTimeout<T>(p: Promise<T>, ms: number, external?: AbortSignal): Promise<T> {
  if (!ms && !external) return p
  return new Promise<T>((resolve, reject) => {
    let timer: any
    const onAbort = () => reject(new ActionError(String(external?.reason ?? "Aborted"), "ABORTED"))
    if (ms && ms > 0) {
      timer = setTimeout(() => reject(new ActionError("Execution timed out", "TIMEOUT")), ms)
    }
    if (external) {
      if (external.aborted) return onAbort()
      external.addEventListener("abort", onAbort, { once: true })
    }
    p.then(v => {
      if (timer) clearTimeout(timer)
      if (external) external.removeEventListener("abort", onAbort)
      resolve(v)
    }).catch(err => {
      if (timer) clearTimeout(timer)
      if (external) external.removeEventListener("abort", onAbort)
      reject(err)
    })
  })
}

function defaultShouldRetry(err: unknown): boolean {
  const e = err as any
  const code = (e && (e.code ?? e.status)) as string | number | undefined
  const msg = String(e?.message ?? e ?? "").toLowerCase()
  if (code === "TIMEOUT" || code === "ETIMEDOUT" || code === 408) return true
  if (code === 429 || msg.includes("rate limit") || msg.includes("too many requests")) return true
  if (typeof code === "number" && code >= 500 && code < 600) return true
  return (
    msg.includes("timeout") ||
    msg.includes("temporar") ||
    msg.includes("econnreset") ||
    msg.includes("network")
  )
}

function toActionError(err: unknown): { message: string; code?: string } {
  if (err instanceof ActionError) return { message: err.message, code: err.code }
  const anyErr = err as any
  const message = String(anyErr?.message ?? anyErr ?? "Execution error")
  const code = typeof anyErr?.code === "string" ? anyErr.code : undefined
  return { message, code }
}

function clonePlain<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch {
    return obj
  }
}
