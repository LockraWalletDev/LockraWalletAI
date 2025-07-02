export const DEFAULT_SCAN_INTERVAL = 600_000  // 10 minutes in milliseconds
export const MAX_TX_LOOKBACK = 200           // Maximum number of transactions to look back
export const MIN_WHALE_THRESHOLD = 10_000     // Minimum token amount to consider as whale movement


export const ALERT_CHANNELS = {
  whaleMoves: "alerts/whales",
  suspiciousTokens: "alerts/tokens",
  flashPumps: "alerts/flash",
}