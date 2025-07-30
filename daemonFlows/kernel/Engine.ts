// executionEngine.ts
import {
  Connection,
  Transaction,
  Commitment,
  RpcResponseAndContext,
  SignatureResult,
} from "@solana/web3.js"
import { VaultCoreEngine } from "./vaultCoreEngine"

/** Hooks for instrumentation */
export interface ExecutionHooks {
  onBeforeSend?: (tx: Transaction) => void
  onAfterConfirm?: (signature: string, result: SignatureResult) => void
  onError?: (error: Error, context: { phase: string }) => void
}

/** Options for transaction execution */
export interface ExecutionOptions {
  /** Commitment level for confirmation */
  commitment?: Commitment
  /** Number of retry attempts for send+confirm */
  retryAttempts?: number
  /** Timeout for confirmTransaction (ms) */
  timeoutMs?: number
  /** Hooks for lifecycle events */
  hooks?: ExecutionHooks
}

/** Default values for execution options */
const DEFAULT_OPTIONS: Required<ExecutionOptions> = {
  commitment: "confirmed",
  retryAttempts: 3,
  timeoutMs: 30_000,
  hooks: {}
}

/** Simple structured logger */
const logger = {
  info: (msg: string, meta: any = {}) => console.log({ level: "info", msg, ...meta }),
  warn: (msg: string, meta: any = {}) => console.warn({ level: "warn", msg, ...meta }),
  error: (msg: string, meta: any = {}) => console.error({ level: "error", msg, ...meta }),
}

/**
 * Engine to execute raw Solana transactions and Vault operations
 * with retries, timeouts, and logging.
 */
export class ExecutionEngine {
  constructor(private connection: Connection) {}

  /**
   * Sends and confirms a transaction, with retries and timeout.
   */
  public async executeTransaction(
    tx: Transaction,
    opts: ExecutionOptions = {}
  ): Promise<string> {
    const { commitment, retryAttempts, timeoutMs, hooks } = { ...DEFAULT_OPTIONS, ...opts }

    // Serialize once
    const rawTx = tx.serialize()

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        logger.info(`Sending transaction (attempt ${attempt})`, { attempt })
        hooks.onBeforeSend?.(tx)

        const signature = await this.connection.sendRawTransaction(rawTx)
        logger.info("Transaction sent", { signature })

        // Wait for confirmation with timeout
        const confirmPromise = this.connection.confirmTransaction(signature, commitment)
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("Confirmation timeout")), timeoutMs)
        )
        const { value }: RpcResponseAndContext<SignatureResult> = await Promise.race([
          confirmPromise,
          timeoutPromise,
        ]) as any

        logger.info("Transaction confirmed", { signature, slot: value?.slot })
        hooks.onAfterConfirm?.(signature, value)

        return signature
      } catch (err: any) {
        logger.warn(`Transaction attempt ${attempt} failed`, { error: err.message })
        hooks.onError?.(err, { phase: "sendOrConfirm" })
        if (attempt === retryAttempts) {
          logger.error("All transaction attempts exhausted", { attempts: retryAttempts })
          throw new Error(`executeTransaction failed: ${err.message}`)
        }
        // exponential backoff
        await new Promise((r) => setTimeout(r, 500 * attempt))
      }
    }

    // should never reach here
    throw new Error("executeTransaction: unexpected exit")
  }

  /**
   * Initializes VaultCoreEngine and executes a vault transfer,
   * then sends the resulting transaction.
   */
  public async executeVaultOp(
    vaultConfig: Parameters<typeof VaultCoreEngine>[0],
    opts: Parameters<VaultCoreEngine["executeTransfer"]>[0],
    execOpts: ExecutionOptions = {}
  ): Promise<string> {
    try {
      logger.info("Initializing VaultCoreEngine", { vaultConfig })
      const engine = new VaultCoreEngine(vaultConfig)
      await engine.initialize()

      logger.info("Building vault transfer transaction", { opts })
      const tx: Transaction = await engine.executeTransfer(opts)

      return await this.executeTransaction(tx, execOpts)
    } catch (err: any) {
      logger.error("Vault operation failed", { error: err.message })
      execOpts.hooks?.onError?.(err, { phase: "vaultOp" })
      throw err
    }
  }
}
