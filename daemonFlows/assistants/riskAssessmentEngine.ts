/**
 * riskAssessmentEngine.ts
 * Computes risk score for wallets or tokens based on configurable metrics.
 */

export interface RiskMetrics {
  volatility: number
  transactionCount: number
  averageTransferSize: number
}

export interface RiskResult {
  score: number       // 0–100
  level: "Low" | "Medium" | "High"
  details: Partial<RiskMetrics>
}

export function assessRisk(metrics: RiskMetrics): RiskResult {
  const { volatility, transactionCount, averageTransferSize } = metrics
  let score = Math.min(
    100,
    Math.round(
      volatility * 0.4 +
      Math.log10(transactionCount + 1) * 20 +
      (averageTransferSize / 1_000_000) * 40
    )
  )
  const level = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low"
  return { score, level, details: metrics }
}
