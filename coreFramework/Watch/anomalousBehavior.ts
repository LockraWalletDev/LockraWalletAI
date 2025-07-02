
import { BehaviorMetrics } from "./walletBehaviorCore"
import { BurstPrediction, predictBurstPattern } from "./burstPatternPredictor"
import { calculateEntropy } from "./entropyAnalyzer"

export interface AnomalyResult {
  type: string
  score: number
  details: any
}

export interface TimeSeriesPoint {
  timestamp: number
  value: number
}

export class AnomalousBehavior {
  constructor(
    private thresholdPercent: number = 50,
    private entropyThreshold: number = 1.5
  ) {}

  analyzeTransfers(metrics: BehaviorMetrics): AnomalyResult[] {
    const results: AnomalyResult[] = []

    // 1. Large transfer anomaly
    if (metrics.largestTxValue > metrics.averageTxValue * (this.thresholdPercent / 100)) {
      results.push({
        type: "LargeTransfer",
        score: metrics.largestTxValue / metrics.averageTxValue,
        details: metrics
      })
    }

    // 2. Burst pattern anomaly
    const burstPrediction: BurstPrediction = predictBurstPattern({ timestamps: [] })
    if (burstPrediction.probability > 0.7) {
      results.push({
        type: "BurstPattern",
        score: burstPrediction.probability,
        details: burstPrediction
      })
    }

    return results
  }

  analyzeTimeSeries(data: TimeSeriesPoint[]): AnomalyResult[] {
    const results: AnomalyResult[] = []
    const values = data.map(d => d.value)
    const entropy = calculateEntropy(values)

    if (entropy > this.entropyThreshold) {
      results.push({
        type: "HighEntropy",
        score: entropy,
        details: { entropy }
      })
    }

    // detect extreme spikes
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const spikes = data.filter(d => Math.abs(d.value - avg) / avg > this.thresholdPercent / 100)
    if (spikes.length) {
      spikes.forEach(spike =>
        results.push({
          type: "Spike",
          score: Math.abs(spike.value - avg) / avg,
          details: spike
        })
      )
    }

    return results
  }
}