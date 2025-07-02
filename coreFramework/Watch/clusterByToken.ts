/**
 * clusterByToken.ts
 * Groups transactions or data points by token mint.
 */

export interface TransactionRecord {
  txId: string
  tokenMint: string
  amount: number
  timestamp: number
}

export interface TokenCluster {
  tokenMint: string
  totalAmount: number
  txCount: number
  records: TransactionRecord[]
}

export function clusterByToken(records: TransactionRecord[]): TokenCluster[] {
  const map = new Map<string, TokenCluster>()

  for (const rec of records) {
    if (!map.has(rec.tokenMint)) {
      map.set(rec.tokenMint, {
        tokenMint: rec.tokenMint,
        totalAmount: 0,
        txCount: 0,
        records: []
      })
    }
    const cluster = map.get(rec.tokenMint)!
    cluster.totalAmount += rec.amount
    cluster.txCount += 1
    cluster.records.push(rec)
  }

  return Array.from(map.values())
}

export function clusterByTokenTimeWindow(
  records: TransactionRecord[],
  windowMs: number
): Record<string, TokenCluster[]> {
  const now = Date.now()
  const grouped: Record<string, TokenCluster[]> = {}

  records.forEach(rec => {
    const key = rec.tokenMint
    if (!grouped[key]) grouped[key] = []
    // window-based grouping
    const windowStart = now - windowMs
    if (rec.timestamp >= windowStart) {
      // find current cluster or create
      let clusters = grouped[key]
      let last = clusters[clusters.length - 1]
      if (!last || rec.timestamp - last.records[0].timestamp > windowMs) {
        last = { tokenMint: key, totalAmount: 0, txCount: 0, records: [] }
        clusters.push(last)
      }
      last.totalAmount += rec.amount
      last.txCount += 1
      last.records.push(rec)
    }
  })

  return grouped
}
