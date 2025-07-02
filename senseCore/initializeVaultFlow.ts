/**
 * initializeVaultFlow.ts
 * Boots up the vault engine and returns its initial status.
 */

import { VaultTasksHandler } from "./vaultTasksHandler"
import type { VaultStatus } from "./vaultCoreEngine"

export async function initializeVaultFlow(
  config: {
    vaultAddress: string
    authority: string
    networkRpcUrl: string
    feePayer: string
  }
): Promise<VaultStatus> {
  const handler = new VaultTasksHandler({
    vaultAddress: new PublicKey(config.vaultAddress),
    authority: new PublicKey(config.authority),
    networkRpcUrl: config.networkRpcUrl,
    feePayer: new PublicKey(config.feePayer),
  })
  return handler.initializeVault()
}
