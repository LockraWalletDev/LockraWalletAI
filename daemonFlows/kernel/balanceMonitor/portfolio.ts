import type { PricePoint } from "./tokenSpreadAnalyzer"

/**
 * portfolioValuator.ts
 * Computes portfolio value and ROI over time based on price snapshots
 */

export interface PortfolioAsset {
  symbol: string
  quantity: number
  priceHistory: PricePoint[]
}

export interface PortfolioValuation {
  totalValue: number
  assetBreakdown: Record<string, number>
  roiPercent: number
}

export function portfolioValuator(
  assets: PortfolioAsset[]
): PortfolioValuation {
  let initialValue = 0
  let currentValue = 0
  const breakdown: Record<string, number> = {}

  assets.forEach(({ symbol, quantity, priceHistory }) => {
    if (priceHistory.length < 2) return
    const first = priceHistory[0].price
    const last = priceHistory[priceHistory.length - 1].price
    const initial = first * quantity
    const current = last * quantity
    initialValue += initial
    currentValue += current
    breakdown[symbol] = parseFloat(current.toFixed(2))
  })

  const roiPercent = initialValue
    ? parseFloat((((currentValue - initialValue) / initialValue) * 100).toFixed(2))
    : 0

  return {
    totalValue: parseFloat(currentValue.toFixed(2)),
    assetBreakdown: breakdown,
    roiPercent,
  }
}
