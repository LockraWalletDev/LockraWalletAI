import { z } from "zod"

/**
 * balanceQuerySchema.ts
 * Zod schema for constructing balance query parameters
 */
export const balanceQuerySchema = z.object({
  accountAddress: z.string().nonempty(),
  includeSplTokens: z.boolean().default(true),
  minBalance: z.number().int().nonnegative().optional(),
  maxResults: z.number().int().positive().default(100),
})

export type BalanceQuery = z.infer<typeof balanceQuerySchema>

export function defineBalanceQuery(params: BalanceQuery): BalanceQuery {
  return balanceQuerySchema.parse(params)
}
