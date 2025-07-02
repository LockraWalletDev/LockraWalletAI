
export interface TestFundsConfig {
  expectedBalance: number
  actualBalance: number
}

export function testFunds(config: TestFundsConfig): boolean {
  const { expectedBalance, actualBalance } = config
  console.log(
    `Testing funds: expected=${expectedBalance}, actual=${actualBalance}`
  )
  return actualBalance >= expectedBalance
}
