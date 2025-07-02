
import { VaultTasksHandler, TaskResult } from "./vaultTasksHandler"
import { TransferOptions } from "./vaultCoreEngine"

export interface ProcessorConfig {
  handler: VaultTasksHandler
  depositAmount?: number
  transferOpts?: TransferOptions
}

export class VaultTasksProcessor {
  constructor(private config: ProcessorConfig) {}

  async run(): Promise<TaskResult[]> {
    const results: TaskResult[] = []

    // Initialize Vault
    results.push(await this.config.handler.initializeVault())

    // Optional deposit
    if (this.config.depositAmount != null) {
      results.push(await this.config.handler.deposit(this.config.depositAmount))
    }

    // Optional transfer
    if (this.config.transferOpts) {
      results.push(await this.config.handler.transfer(this.config.transferOpts))
    }

    return results
  }

  async runLoop(intervalMs: number): Promise<void> {
    await this.run()
    setInterval(() => this.run(), intervalMs)
  }
}

// Example usage:
// const handler = new VaultTasksHandler({...})
// const processor = new VaultTasksProcessor({ handler, depositAmount: 500, transferOpts: {...} })
// processor.runLoop(60000)
