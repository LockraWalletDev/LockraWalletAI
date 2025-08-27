/**
 * Scan configuration (all values in milliseconds or counts)
 * Strongly-typed defaults + flexible env/override loading with validation.
 */

export interface ScanConfig {
  /** Poll interval between scans (ms) */
  scanIntervalMs: number
  /** Max number of transactions to scan back per run */
  maxTxLookback: number
  /** Minimum token amount to flag whale movement */
  minWhaleThreshold: number
}

/** Default constants (immutable) */
export const DEFAULTS: Readonly<ScanConfig> = Object.freeze({
  scanIntervalMs: 10 * 60 * 1000, // 10 minutes
  maxTxLookback: 200,
  minWhaleThreshold: 10_000,
})

/** Canonical env variable names */
export const ENV_KEYS = Object.freeze({
  scanIntervalMs: "SCAN_INTERVAL_MS",
  maxTxLookback: "MAX_TX_LOOKBACK",
  minWhaleThreshold: "MIN_WHALE_THRESHOLD",
} as const)

/** Parse duration like "10m", "5s", "250ms", or raw number/string (ms) */
export function parseDuration(input: unknown, fallbackMs: number, minMs = 0): number {
  if (typeof input === "number" && Number.isFinite(input)) return Math.max(minMs, Math.trunc(input))
  if (typeof input !== "string") return fallbackMs
  const s = input.trim().toLowerCase()
  if (!s) return fallbackMs

  const m = s.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/)
  if (!m) return safeInt(input, fallbackMs, { min: minMs })

  const value = Number(m[1])
  const unit = m[2] ?? "ms"
  const factor = unit === "h" ? 3_600_000 : unit === "m" ? 60_000 : unit === "s" ? 1_000 : 1
  const out = Math.round(value * factor)
  return Math.max(minMs, out)
}

/** Parse numbers like "12_000", "10k", "1.5m" → int */
export function parseHumanInt(input: unknown, fallback: number, min = 0): number {
  if (typeof input === "number" && Number.isFinite(input)) return Math.max(min, Math.trunc(input))
  if (typeof input !== "string") return fallback
  const s = input.replace(/_/g, "").trim().toLowerCase()
  const m = s.match(/^(\d+(?:\.\d+)?)([km]?)$/)
  if (!m) return safeInt(input, fallback, { min })
  const n = Number(m[1]) * (m[2] === "m" ? 1_000_000 : m[2] === "k" ? 1_000 : 1)
  return Math.max(min, Math.trunc(n))
}

/** Strict integer parser with bounds & fallback */
function safeInt(
  v: unknown,
  fallback: number,
  { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {}
): number {
  const n =
    typeof v === "number" ? v :
    typeof v === "string" && v.trim() !== "" ? Number(v) :
    NaN
  if (!Number.isFinite(n)) return fallback
  const i = Math.trunc(n)
  return Math.max(min, Math.min(max, i))
}

/** Validate a ScanConfig (throws on invalid) */
export function validateScanConfig(cfg: ScanConfig): Readonly<ScanConfig> {
  const err: string[] = []
  const { scanIntervalMs, maxTxLookback, minWhaleThreshold } = cfg

  if (!Number.isFinite(scanIntervalMs) || scanIntervalMs < 250) err.push("scanIntervalMs must be ≥ 250 ms")
  if (!Number.isInteger(maxTxLookback) || maxTxLookback < 1) err.push("maxTxLookback must be an integer ≥ 1")
  if (!Number.isFinite(minWhaleThreshold) || minWhaleThreshold < 1) err.push("minWhaleThreshold must be ≥ 1")

  if (err.length) throw new Error(`Invalid ScanConfig: ${err.join("; ")}`)
  return Object.freeze({ scanIntervalMs, maxTxLookback, minWhaleThreshold })
}

/**
 * Load a config from DEFAULTS + env + overrides (highest precedence).
 * You may pass a custom env object (default: process.env).
 */
export function loadScanConfig(
  overrides: Partial<ScanConfig> = {},
  env: Record<string, string | undefined> = typeof process !== "undefined" ? (process.env as any) : {}
): Readonly<ScanConfig> {
  const fromEnv: Partial<ScanConfig> = {
    scanIntervalMs: parseDuration(env[ENV_KEYS.scanIntervalMs], DEFAULTS.scanIntervalMs, 250),
    maxTxLookback: parseHumanInt(env[ENV_KEYS.maxTxLookback], DEFAULTS.maxTxLookback, 1),
    minWhaleThreshold: parseHumanInt(env[ENV_KEYS.minWhaleThreshold], DEFAULTS.minWhaleThreshold, 1),
  }

  const merged: ScanConfig = {
    scanIntervalMs: overrides.scanIntervalMs ?? fromEnv.scanIntervalMs ?? DEFAULTS.scanIntervalMs,
    maxTxLookback: overrides.maxTxLookback ?? fromEnv.maxTxLookback ?? DEFAULTS.maxTxLookback,
    minWhaleThreshold: overrides.minWhaleThreshold ?? fromEnv.minWhaleThreshold ?? DEFAULTS.minWhaleThreshold,
  }

  return validateScanConfig(merged)
}

/**
 * Alert channel identifiers (runtime string enum for log/topic routing).
 */
export enum AlertChannel {
  WhaleMoves       = "alerts/whales",
  SuspiciousTokens = "alerts/tokens",
  FlashPumps       = "alerts/flash",
}

/** Immutable map of alert channels with narrow literal keys */
export const ALERT_CHANNELS = Object.freeze({
  whaleMoves:       AlertChannel.WhaleMoves,
  suspiciousTokens: AlertChannel.SuspiciousTokens,
  flashPumps:       AlertChannel.FlashPumps,
} as const satisfies Readonly<Record<"whaleMoves" | "suspiciousTokens" | "flashPumps", AlertChannel>>)

/** Export config to stringified env values (handy for subprocesses) */
export function toEnv(cfg: ScanConfig): Record<string, string> {
  return {
    [ENV_KEYS.scanIntervalMs]: String(cfg.scanIntervalMs),
    [ENV_KEYS.maxTxLookback]: String(cfg.maxTxLookback),
    [ENV_KEYS.minWhaleThreshold]: String(cfg.minWhaleThreshold),
  }
}
