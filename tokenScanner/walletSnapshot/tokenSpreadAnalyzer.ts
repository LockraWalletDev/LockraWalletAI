export interface PricePoint {
  timestamp: number // ms since epoch
  price: number     // price in USD
}

export interface SpreadResult {
  minPrice: number
  maxPrice: number
  absoluteSpread: number
  percentageSpread: number
  startTime: number
  endTime: number
}

export function calculateTokenSpread(points: PricePoint[]): SpreadResult | null {
  if (points.length < 2) return null

  let minPoint = points[0]
  let maxPoint = points[0]

  for (const p of points) {
    if (p.price < minPoint.price) minPoint = p
    if (p.price > maxPoint.price) maxPoint = p
  }

  const absoluteSpread = maxPoint.price - minPoint.price
  const percentageSpread = (absoluteSpread / minPoint.price) * 100

  return {
    minPrice: minPoint.price,
    maxPrice: maxPoint.price,
    absoluteSpread,
    percentageSpread: parseFloat(percentageSpread.toFixed(2)),
    startTime: minPoint.timestamp,
    endTime: maxPoint.timestamp,
  }
}