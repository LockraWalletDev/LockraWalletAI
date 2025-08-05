import type { VaultTasksHandler, TaskResult } from "./vaultTasksHandler"
import type { TransferOptions } from "./vaultCoreEngine"

/** Options to control engine behavior */
export interface VaultTaskEngineOptions {
  /** If true, abort on first error */
  abortOnError?: boolean
  /** Optional callback for progress updates */
  onStep?: (step: string, result: TaskResult) => void
  /** Optional callback on errors */
  onError?: (step: string, error: Error) => void
}

export class VaultTaskEngine {
  constructor(
    private handler: VaultTasksHandler,
    private opts: VaultTaskEngineOptions = {}
  ) {}

  /** Run the full deposit → transfer sequence */
  public async runFullCycle(
    depositAmount: number,
    transferOpts: TransferOptions
  ): Promise<TaskResult[]> {
    return this.runSteps([
      { name: "initializeVault", fn: () => this.handler.initializeVault() },
      { name: "deposit", fn: () => this.handler.deposit(depositAmount) },
      { name: "transfer", fn: () => this.handler.transfer(transferOpts) },
    ])
  }

  /** Run deposit then transfer only */
  public async runDepositThenTransfer(
    depositAmount: number,
    transferOpts: TransferOptions
  ): Promise<TaskResult[]> {
    return this.runSteps([
      { name: "deposit", fn: () => this.handler.deposit(depositAmount) },
      { name: "transfer", fn: () => this.handler.transfer(transferOpts) },
    ])
  }

  /** Internal helper to execute named steps in sequence */
  private async runSteps(
    steps: Array<{ name: string; fn: () => Promise<TaskResult> }>
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = []
    for (const step of steps) {
      try {
        const res = await step.fn()
        results.push(res)
        this.opts.onStep?.(step.name, res)
      } catch (err: any) {
        this.opts.onError?.(step.name, err)
        if (this.opts.abortOnError) {
          throw new Error(`Step "${step.name}" failed: ${err.message}`)
        }
      }
    }
    return results
  }
}
