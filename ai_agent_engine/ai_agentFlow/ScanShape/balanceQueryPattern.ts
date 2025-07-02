
import { z } from "zod"

export const BalanceQueryPattern = z.object({
  accountAddress: z.string().nonempty(),
  tokenMints: z.array(z.string()).optional(),
  minBalance: z.number().int().nonnegative().optional(),
  maxBalance: z.number().int().nonnegative().optional(),
  includeZeroBalances: z.boolean().default(false),
})

export type BalanceQueryPattern = z.infer<typeof BalanceQueryPattern>

/**
 * Matches a balance query against a wallet's balances.
 * Returns true if the balance matches the pattern criteria.
 */
export function matchesBalancePattern(
  balances: Record<string, number>,
  pattern: BalanceQueryPattern
): boolean {
  const { tokenMints, minBalance, maxBalance, includeZeroBalances } = pattern
  for (const [mint, amount] of Object.entries(balances)) {
    if (tokenMints && !tokenMints.includes(mint)) continue
    if (!includeZeroBalances && amount === 0) return false
    if (minBalance != null && amount < minBalance) return false
    if (maxBalance != null && amount > maxBalance) return false
  }
  return true
}

/**
 * Builds a query pattern from raw parameters.
 */
export function buildBalanceQueryPattern(params: Partial<BalanceQueryPattern>) {
  return BalanceQueryPattern.parse(params)
}
