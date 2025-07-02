
import axios from "axios"

export interface DexTokenData {
  mint: string
  price: number
  liquidity: number
}

export async function fetchDexData(
  marketApiUrl: string
): Promise<DexTokenData[]> {
  const resp = await axios.get<{ data: DexTokenData[] }>(`${marketApiUrl}/tokens`)
  return resp.data.data
}