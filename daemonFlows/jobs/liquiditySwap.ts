/**
 * liquiditySwap.ts
 * Executes a token swap on a DEX, choosing the best liquidity pool.
 */

import { Connection, PublicKey, Transaction } from "@solana/web3.js"
import { DexRouter } from "@project-serum/swap"

export interface SwapParams {
  amountIn: number
  minAmountOut: number
  sourceMint: PublicKey
  destinationMint: PublicKey
  owner: PublicKey
}

export async function liquiditySwap(
  connection: Connection,
  params: SwapParams
): Promise<string> {
  const router = new DexRouter(connection, params.owner)
  const tx = await router.swap({
    amountIn: params.amountIn,
    minAmountOut: params.minAmountOut,
    sourceMint: params.sourceMint,
    destinationMint: params.destinationMint,
  })
  const signature = await connection.sendTransaction(tx, [/* signer keypairs */])
  await connection.confirmTransaction(signature)
  return signature
}
