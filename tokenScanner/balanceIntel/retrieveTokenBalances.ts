
import { Connection, PublicKey } from "@solana/web3.js"
import axios from "axios"

export interface TokenBalance {
  mint: string
  amount: number
}

export async function retrieveTokenBalances(
  connection: Connection,
  walletAddress: PublicKey
): Promise<TokenBalance[]> {
  // Example using an indexer API
  const resp = await axios.get<{ balances: TokenBalance[] }>(
    `https://api.indexer.example.com/wallets/${walletAddress.toBase58()}/balances`
  )
  return resp.data.balances
}