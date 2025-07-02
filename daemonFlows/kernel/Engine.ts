import { Connection, Transaction } from "@solana/web3.js"
import { VaultCoreEngine } from "./vaultCoreEngine"

export class ExecutionEngine {
  constructor(private connection: Connection) {}

  async executeTransaction(tx: Transaction): Promise<string> {
    const signature = await this.connection.sendRawTransaction(tx.serialize())
    await this.connection.confirmTransaction(signature)
    return signature
  }

  async executeVaultOp(
    vaultConfig: Parameters<typeof VaultCoreEngine>[0],
    opts: Parameters<VaultCoreEngine["executeTransfer"]>[0]
  ): Promise<string> {
    const engine = new VaultCoreEngine(vaultConfig)
    await engine.initialize()
    const tx = await engine.executeTransfer(opts)
    return this.executeTransaction(tx)
  }
}
