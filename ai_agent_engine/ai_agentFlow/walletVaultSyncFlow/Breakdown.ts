

export interface TxRecord {
  id: string
  type: string
  amount: number
  timestamp: number
}

export interface BreakdownResult {
  totalAmount: number
  byType: Record<string, { count: number; amount: number }>
  timeSeries: { [hour: string]: number }
}

export class BreakdownAnalyzer {
  analyze(records: TxRecord[]): BreakdownResult {
    const result: BreakdownResult = {
      totalAmount: 0,
      byType: {},
      timeSeries: {}
    }

    for (const rec of records) {
      result.totalAmount += rec.amount

      // byType
      if (!result.byType[rec.type]) {
        result.byType[rec.type] = { count: 0, amount: 0 }
      }
      result.byType[rec.type].count += 1
      result.byType[rec.type].amount += rec.amount

      // timeSeries (hour bucket)
      const hour = new Date(rec.timestamp).toISOString().slice(0, 13) + ":00"
      result.timeSeries[hour] = (result.timeSeries[hour] || 0) + rec.amount
    }

    return result
  }

  printSummary(breakdown: BreakdownResult): void {
    console.log("=== Breakdown Summary ===")
    console.log(`Total Amount: ${breakdown.totalAmount}`)
    console.log("By Type:")
    for (const [type, stats] of Object.entries(breakdown.byType)) {
      console.log(`  - ${type}: ${stats.count} txs, ${stats.amount} total`)
    }
    console.log("By Hour:")
    for (const [hour, amt] of Object.entries(breakdown.timeSeries)) {
      console.log(`  - ${hour}: ${amt}`)
    }
  }
}

// Example usage:
// const analyzer = new BreakdownAnalyzer()
// const result = analyzer.analyze(txRecords)
// analyzer.printSummary(result)
