
import React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

export interface TrendPoint {
  time: string
  value: number
}

export interface TrendOverviewViewProps {
  title: string
  data: TrendPoint[]
  highlightThreshold?: number
}

export const TrendOverviewView: React.FC<TrendOverviewViewProps> = ({
  title,
  data,
  highlightThreshold = 0
}) => {
  // derive min, max
  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return (
    <Card className="max-w-lg mx-auto my-4">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-600 mb-2">
          Min: {min.toFixed(2)}, Max: {max.toFixed(2)}
        </div>
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <XAxis dataKey="time" />
              <YAxis domain={[min, max]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              {highlightThreshold !== undefined && (
                <Line
                  type="step"
                  dataKey={() => highlightThreshold}
                  stroke="#f97316"
                  strokeDasharray="4 2"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Usage example:
// <TrendOverviewView title="SOL Price" data={[{time:'10:00',value:1.2}, ...]} highlightThreshold={2.0} />
