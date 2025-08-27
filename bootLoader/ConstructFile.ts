/**
 * Scan configuration (all values in milliseconds or counts)
 * Provides strongly-typed defaults + optional env/override loading.
 */

export interface ScanConfig {
  /** Poll interval between scans (ms) */
  scanIntervalMs: number
  /** Max number of transactions to scan back per run */
  maxTxLookback: number
  /** Minimum token amount to flag whale movement */
  minWhaleThreshold: number
}

/** Default constants (do not mutate directly) */
export const DEFAULTS: Readonly<ScanConfig> = Object.freeze({
  scanIntervalMs: 10 * 60 * 1000, // 10 minutes
  maxTxLookback: 200,
  minWhaleThreshold: 10_000,
})

/** Safe integer parser with bounds & fallback */
function parseIntSafe(
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
  if (i < min) return min
  if (i > max) return max
  return i
}

/**
 * Load a final immutable config from:
 * 1) DEFAULTS
 * 2) environment variables (optional)
 * 3) runtime overrides (highest precedence)
 */
export function loadScanConfig(overrides: Partial<ScanConfig> = {}): Readonly<ScanConfig> {
  const fromEnv: Partial<ScanConfig> = {
    scanIntervalMs: parseIntSafe(process.env.SCAN_INTERVAL_MS, DEFAULTS.scanIntervalMs, { min: 250 }),
    maxTxLookback: parseIntSafe(process.env.MAX_TX_LOOKBACK, DEFAULTS.maxTxLookback, { min: 1 }),
    minWhaleThreshold: parseIntSafe(process.env.MIN_WHALE_THRESHOLD, DEFAULTS.minWhaleThreshold, { min: 1 }),
  }

  const merged: ScanConfig = {
    scanIntervalMs: overrides.scanIntervalMs ?? fromEnv.scanIntervalMs ?? DEFAULTS.scanIntervalMs,
    maxTxLookback: overrides.maxTxLookback ?? fromEnv.maxTxLookback ?? DEFAULTS.maxTxLookback,
    minWhaleThreshold: overrides.minWhaleThreshold ?? fromEnv.minWhaleThreshold ?? DEFAULTS.minWhaleThreshold,
  }

  return Object.freeze(merged)
}

/**
 * Alert channel identifiers
 * Keep as runtime string enum for log/topic routing.
 */
export enum AlertChannel {
  WhaleMoves        = "alerts/whales",
  SuspiciousTokens  = "alerts/tokens",
  FlashPumps        = "alerts/flash",
}

/**
 * Immutable map of alert channels for convenience with narrow literal types
 */
export const ALERT_CHANNELS = Object.freeze({
  whaleMoves:       AlertChannel.WhaleMoves,
  suspiciousTokens: AlertChannel.SuspiciousTokens,
  flashPumps:       AlertChannel.FlashPumps,
} as const satisfies Readonly<Record<"whaleMoves" | "suspiciousTokens" | "flashPumps", AlertChannel>>)
