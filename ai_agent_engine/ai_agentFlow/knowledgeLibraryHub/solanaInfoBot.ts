import { Connection, PublicKey } from "@solana/web3.js"

export interface SolanaAccountInfo {
  address: string
  lamports: number
  owner: string
  executable: boolean
  rentEpoch: number
}

export async function solanaInfoFetcher(
  connection: Connection,
  address: PublicKey
): Promise<SolanaAccountInfo> {
  const info = await connection.getAccountInfo(address)
  if (!info) throw new Error("Account not found")
  return {
    address: address.toBase58(),
    lamports: info.lamports,
    owner: info.owner.toBase58(),
    executable: info.executable,
    rentEpoch: info.rentEpoch,
  }
}
