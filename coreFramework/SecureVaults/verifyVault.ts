
import { Connection, PublicKey } from "@solana/web3.js"
import { VaultConfig, VaultStatus, VaultCoreEngine } from "./vaultCoreEngine"

export class VaultVerifier {
  constructor(private connection: Connection) {}

  async verifyConfig(config: VaultConfig): Promise<boolean> {
    try {
      // Check RPC connectivity
      await this.connection.getVersion()
      // Validate vault address
      const info = await this.connection.getAccountInfo(config.vaultAddress)
      if (!info) throw new Error("Vault account not found")
      // Validate authority
      const authInfo = await this.connection.getAccountInfo(config.authority)
      if (!authInfo) throw new Error("Authority account not found")
      return true
    } catch {
      return false
    }
  }

  async verifyState(config: VaultConfig): Promise<VaultStatus> {
    const engine = new VaultCoreEngine(config)
    await engine.initialize()
    const status = engine.getStatus()
    // Basic sanity checks
    if (status.totalLocked < 0) throw new Error("Invalid locked amount")
    if (status.totalWithdrawals < 0) throw new Error("Invalid withdrawal count")
    return status
  }

  async fullVerification(config: VaultConfig): Promise<VaultStatus> {
    const configOk = await this.verifyConfig(config)
    if (!configOk) throw new Error("Vault configuration invalid")
    return this.verifyState(config)
  }
}
