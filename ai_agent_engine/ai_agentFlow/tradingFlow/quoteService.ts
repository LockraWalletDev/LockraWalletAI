

import axios from "axios"

export interface QuoteParams {
  baseMint: string
  quoteMint: string
  amount: number
}

export interface QuoteResult {
  baseMint: string
  quoteMint: string
  inputAmount: number
  outputAmount: number
  slippagePercent: number
  rate: number
  source: string
}

export class QuoteFetcher {
  constructor(private endpoints: string[]) {}

  async fetch(params: QuoteParams): Promise<QuoteResult[]> {
    const results: QuoteResult[] = []
    await Promise.all(
      this.endpoints.map(async url => {
        try {
          const resp = await axios.get<QuoteResult>(`${url}/quote`, { params })
          results.push({ ...resp.data, source: url })
        } catch (e) {
          // ignore individual failures
        }
      })
    )
    return results
  }

  async bestQuote(params: QuoteParams): Promise<QuoteResult | null> {
    const quotes = await this.fetch(params)
    if (!quotes.length) return null
    return quotes.reduce((best, q) => (q.rate > best.rate ? q : best), quotes[0])
  }
}
