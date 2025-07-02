/**
 * burstPatternPredictor.ts
 * Predicts burst transfer patterns using simple threshold and trend analysis.
 */

export interface BurstData {
  timestamps: number[]
}

export interface BurstPrediction {
  nextBurstInMs: number
  probability: number  // 0–1
}

export function predictBurstPattern(data: BurstData): BurstPrediction {
  const diffs = data.timestamps
    .slice(1)
    .map((t, i) => t - data.timestamps[i])
  const avgInterval = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const variance =
    diffs.reduce((a, b) => a + (b - avgInterval) ** 2, 0) / diffs.length
  const probability = Math.min(1, 1 / (1 + variance / avgInterval))
  return {
    nextBurstInMs: avgInterval,
    probability: parseFloat(probability.toFixed(2))
  }
}
