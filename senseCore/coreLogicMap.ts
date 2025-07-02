
export type CoreOperation =  
  | "initialize"  
  | "deposit"  
  | "withdraw"  
  | "transfer"

export interface LogicHandlerMap {
  [operation: string]: (...args: any[]) => Promise<any>
}

import { VaultTasksHandler } from "./vaultTasksHandler"

const vaultHandler = new VaultTasksHandler({
  vaultAddress: /* PublicKey instance */,
  authority: /* PublicKey instance */,
  networkRpcUrl: "https://api.mainnet-beta.solana.com",
  feePayer: /* PublicKey instance */,
})

export const coreLogicMap: LogicHandlerMap = {
  initialize: () => vaultHandler.initializeVault(),
  deposit: (amount: number) => vaultHandler.deposit(amount),
  withdraw: (amount: number) => vaultHandler.withdraw(amount),
  transfer: (opts) => vaultHandler.transfer(opts),
}