export interface BalanceQueryShape {
  accountAddress: string
  includeTokens?: boolean
  minBalance?: number
  maxResults?: number
}

export function defineBalanceQuerySchema(
  address: string,
  options?: Partial<Omit<BalanceQueryShape, "accountAddress">>
): BalanceQueryShape {
  return {
    accountAddress: address,
    includeTokens: options?.includeTokens ?? true,
    minBalance: options?.minBalance ?? 0,
    maxResults: options?.maxResults ?? 100,
  }
}