/**
 * Scan configuration (all values in milliseconds or counts)
 */
export const DEFAULT_SCAN_INTERVAL_MS = 10 * 60 * 1000     // 10 minutes
export const MAX_TX_LOOKBACK = 200                         // max number of transactions to scan back
export const MIN_WHALE_THRESHOLD = 10_000                  // minimum token amount to flag whale movement

/**
 * Alert channel identifiers
 */
export enum AlertChannel {
  WhaleMoves        = "alerts/whales",
  SuspiciousTokens  = "alerts/tokens",
  FlashPumps        = "alerts/flash",
}

/**
 * Immutable map of alert channels for convenience
 */
export const ALERT_CHANNELS = Object.freeze({
  whaleMoves:       AlertChannel.WhaleMoves,
  suspiciousTokens: AlertChannel.SuspiciousTokens,
  flashPumps:       AlertChannel.FlashPumps,
}) as Readonly<Record<string, AlertChannel>>
