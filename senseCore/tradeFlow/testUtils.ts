/**
 * testUtils.ts
 * Simple helpers for unit and integration testing
 */

export function assertEqual<T>(actual: T, expected: T, msg?: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(msg || `Assertion failed: ${expected} !== ${actual}`)
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms))
}

export function mockWalletAddress(): string {
  return "MockWallet" + Math.random().toString(36).slice(2, 10)
}
