
import React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export interface TokenOverviewCardProps {
  tokenName: string
  tokenSymbol: string
  currentPrice: number
  change24hPercent: number
  totalLiquidity: number
  holderCount: number
  confidence?: number // 0–100
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "−"
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

export const TokenOverviewCard: React.FC<TokenOverviewCardProps> = ({
  tokenName,
  tokenSymbol,
  currentPrice,
  change24hPercent,
  totalLiquidity,
  holderCount,
  confidence = 76
}) => {
  const changePositive = change24hPercent >= 0

  return (
    <Card className="max-w-md mx-auto my-4">
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="text-lg font-semibold">
          {tokenName} <span className="text-sm text-muted-foreground">({tokenSymbol})</span>
        </CardTitle>
        <div className="text-xl font-medium">${currentPrice.toFixed(4)}</div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          <li className={changePositive ? "text-green-600" : "text-red-600"}>
            24h Change: {formatPercent(change24hPercent)}
          </li>
          <li>Liquidity: ${totalLiquidity.toLocaleString()}</li>
          <li>Holders: {holderCount.toLocaleString()}</li>
          <li>Confidence Score: {confidence}/100</li>
        </ul>

        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Confidence</div>
          <Progress value={confidence} max={100} className="h-2 rounded" />
        </div>
      </CardContent>
    </Card>
  )
}
