interface ActivityPoint {
  timestamp: number  // Unix timestamp in ms
  txCount: number    // Number of transactions during this time block
}

export interface HeatmapResult {
  totalTx: number
  hourlyAverage: number
  mostActiveHourUTC: number
  distribution: Record<number, number> // hour -> tx count
}

export class TokenActivityHeatmap {
  private readonly points: ActivityPoint[]

  constructor(points: ActivityPoint[]) {
    if (!Array.isArray(points)) {
      throw new TypeError(`points must be an array, got ${typeof points}`)
    }
    this.points = points.map(p => {
      if (
        typeof p.timestamp !== 'number' ||
        isNaN(p.timestamp) ||
        typeof p.txCount !== 'number' ||
        isNaN(p.txCount) ||
        p.txCount < 0
      ) {
        throw new Error(`Invalid ActivityPoint: ${JSON.stringify(p)}`)
      }
      return p
    })
  }

  public generate(): HeatmapResult {
    // Initialize distribution for all 24 hours
    const distribution: Record<number, number> = {}
    for (let h = 0; h < 24; h++) {
      distribution[h] = 0
    }

    let totalTx = 0

    for (const { timestamp, txCount } of this.points) {
      const date = new Date(timestamp)
      const hour = date.getUTCHours()
      distribution[hour] += txCount
      totalTx += txCount
    }

    const hourlyAverage = totalTx / 24

    // Determine most active hour (in case of ties, earliest hour)
    let mostActiveHourUTC = 0
    let maxCount = distribution[0]
    for (let h = 1; h < 24; h++) {
      if (distribution[h] > maxCount) {
        maxCount = distribution[h]
        mostActiveHourUTC = h
      }
    }

    return {
      totalTx,
      hourlyAverage,
      mostActiveHourUTC,
      distribution,
    }
  }
}
