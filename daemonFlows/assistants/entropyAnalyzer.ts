/**
 * entropyAnalyzer.ts
 * Calculates Shannon entropy for transaction data sequences.
 */

export function calculateEntropy(values: number[]): number {
  const counts: Record<number, number> = {}
  values.forEach(v => (counts[v] = (counts[v] || 0) + 1))
  const total = values.length
  return -Object.values(counts)
    .map(c => {
      const p = c / total
      return p * Math.log2(p)
    })
    .reduce((a, b) => a + b, 0)
}
