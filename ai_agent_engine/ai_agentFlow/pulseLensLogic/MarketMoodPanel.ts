import React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export interface MarketMoodCardProps {
  mood: "Bullish" | "Bearish" | "Neutral"
  sentimentScore: number // 0–100
  lastUpdated: number // epoch ms
}

export const MarketMoodCard: React.FC<MarketMoodCardProps> = ({
  mood,
  sentimentScore,
  lastUpdated,
}) => {
  const colorClass =
    sentimentScore >= 70 ? "text-green-600" :
    sentimentScore >= 40 ? "text-orange-500" :
    "text-red-600"

  return (
    <Card className="max-w-sm mx-auto my-4">
      <CardHeader>
        <CardTitle className={colorClass}>Market Mood: {mood}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>Sentiment Score: {sentimentScore}%</div>
        <div>Last Updated: {new Date(lastUpdated).toLocaleTimeString()}</div>
      </CardContent>
    </Card>
  )
}
