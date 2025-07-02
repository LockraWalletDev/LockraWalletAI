/**
 * vaultTaskEngine.ts
 * Provides a high-level API for executing vault operations in sequence.
 */

import { VaultTasksHandler } from "./vaultTasksHandler"
import type { TaskResult } from "./vaultTasksHandler"
import type { TransferOptions } from "./vaultCoreEngine"

export class VaultTaskEngine {
  private handler: VaultTasksHandler

  constructor(handler: VaultTasksHandler) {
    this.handler = handler
  }

  async runDepositThenTransfer(
    depositAmount: number,
    transferOpts: TransferOptions
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = []
    // Step 1: Initialize vault
    results.push(await this.handler.initializeVault())
    // Step 2: Deposit
    results.push(await this.handler.deposit(depositAmount))
    // Step 3: Transfer
    results.push(await this.handler.transfer(transferOpts))
    return results
  }

  async runFullCycle(
    depositAmount: number,
    transferOpts: TransferOptions
  ): Promise<TaskResult[]> {
    return this.runDepositThenTransfer(depositAmount, transferOpts)
  }
}
