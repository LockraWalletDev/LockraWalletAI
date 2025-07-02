/**
 * activityHeatmapGenerator.ts
 * Generates a heatmap data structure from token activity timestamps.
 */

export interface TimeBucket {
  label: string
  count: number
}

export function generateActivityHeatmap(
  timestamps: number[],   // epoch ms values
  buckets: number = 24    // number of hourly buckets
): TimeBucket[] {
  const now = Date.now()
  const interval = (60 * 60 * 1000) // 1 hour
  const heatmap: TimeBucket[] = Array.from({ length: buckets }, (_, i) => ({
    label: `${i}:00`,
    count: 0
  }))

  timestamps.forEach(ts => {
    const diff = now - ts
    const hourIndex = Math.min(buckets - 1, Math.floor(diff / interval))
    heatmap[hourIndex].count += 1
  })

  return heatmap.reverse()
}
