/**
 * applyLogic.ts
 * Core orchestrator that applies a series of logic handlers to input data.
 */

import { AnomalousBehavior, AnomalyResult } from "./anomalousBehavior"
import { SoLanaTokenInfo, fetchTokenBalanceEnhanced } from "./fetchTokenBalanceEnhanced"
import { RiskResult, assessRisk } from "./riskAssessmentEngine"
import { EventEmitter } from "events"
import type { ExecutionContext } from "./types"

export interface LogicContext {
  walletAddress?: string
  metrics?: any
  seriesData?: any
  tokenData?: SoLanaTokenInfo
}

export type HandlerResult = LogicContext | AnomalyResult[]

export type LogicHandler = (ctx: LogicContext, execCtx: ExecutionContext) => Promise<HandlerResult>

/**
 * Coordinates and runs a pipeline of logic handlers.
 * Emits:
 *  - "anomaly" with AnomalyResult[]
 *  - "step" with updated LogicContext
 *  - "done" with final LogicContext
 *  - "error" with { handler: string; error: Error }
 */
export class LogicOrchestrator extends EventEmitter {
  private handlers: { name: string; fn: LogicHandler }[] = []

  addHandler(name: string, handler: LogicHandler): this {
    this.handlers.push({ name, fn: handler })
    return this
  }

  async run(initial: LogicContext, execCtx: ExecutionContext): Promise<LogicContext> {
    let ctx = { ...initial }

    for (const { name, fn } of this.handlers) {
      try {
        const result = await fn(ctx, execCtx)

        if (Array.isArray(result)) {
          // anomaly array
          this.emit("anomaly", { handler: name, anomalies: result })
          // keep context unchanged
        } else {
          // merge new context fields
          ctx = { ...ctx, ...result }
          this.emit("step", { handler: name, context: ctx })
        }
      } catch (error) {
        this.emit("error", { handler: name, error })
        // optionally: break or continue
        break
      }
    }

    this.emit("done", ctx)
    return ctx
  }
}

// --- Example handlers below ---

/**
 * Fetch on-chain balances and attach to ctx.metrics
 */
export const walletInspectionHandler: LogicHandler = async (ctx, execCtx) => {
  if (!ctx.walletAddress) return ctx
  const balances = await fetchTokenBalanceEnhanced(
    execCtx.connection,
    execCtx.walletPubkey,
    { accountAddress: ctx.walletAddress }
  )
  return { metrics: balances }
}

/**
 * Run anomaly detection on metrics
 */
export const anomalyDetectionHandler: LogicHandler = async (ctx) => {
  if (!ctx.metrics) return []
  const analyzer = new AnomalousBehavior()
  return analyzer.analyzeTransfers(ctx.metrics)
}

/**
 * Assess risk based on metrics and attach to ctx.seriesData
 */
export const riskAssessmentHandler: LogicHandler = async (ctx) => {
  if (!ctx.metrics) return ctx
  const risk: RiskResult = assessRisk({
    volatility: ctx.metrics.volatility ?? 0,
    transactionCount: ctx.metrics.totalTxCount ?? 0,
    averageTransferSize: ctx.metrics.averageTxValue ?? 0,
  })
  return { seriesData: risk }
}
