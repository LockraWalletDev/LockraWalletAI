/**
 * coreAgent.ts
 * Orchestrates core background tasks and health checks.
 */

import { EventEmitter } from "events"
import { AssistantGuide, GuideStep } from "./assistantGuide"

export interface CoreAgentConfig {
  heartbeatMs: number
  healthCheckMs: number
  guideSteps?: GuideStep[]
}

export class CoreAgent extends EventEmitter {
  private guide?: AssistantGuide
  private heartbeatTimer?: NodeJS.Timeout
  private healthTimer?: NodeJS.Timeout

  constructor(private config: CoreAgentConfig) {
    super()
    if (config.guideSteps) {
      this.guide = new AssistantGuide({ steps: config.guideSteps })
      this.guide.on("stepChange", step => this.emit("guideStep", step))
    }
  }

  start(): void {
    this.emit("start")
    this.heartbeatTimer = setInterval(() => this.emit("heartbeat", Date.now()), this.config.heartbeatMs)
    this.healthTimer = setInterval(() => this.emit("healthCheck", this.checkHealth()), this.config.healthCheckMs)
    this.guide?.start()
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.healthTimer) clearInterval(this.healthTimer)
    this.emit("stop")
  }

  private checkHealth(): { memoryUsage: NodeJS.MemoryUsage; uptime: number } {
    return { memoryUsage: process.memoryUsage(), uptime: process.uptime() }
  }

  advanceGuide(): void {
    this.guide?.next()
  }
}
