import { EventEmitter } from "events"

export interface AgentFrameConfig {
  heartbeatIntervalMs: number
}

export interface AgentTask {
  id: string
  run: () => Promise<void>
}

export class CoreAgentFrame extends EventEmitter {
  private tasks: AgentTask[] = []
  private timer?: NodeJS.Timer

  constructor(private config: AgentFrameConfig) {
    super()
  }

  registerTask(task: AgentTask): void {
    this.tasks.push(task)
  }

  start(): void {
    this.timer = setInterval(() => this.tick(), this.config.heartbeatIntervalMs)
    this.emit("started")
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.emit("stopped")
  }

  private async tick(): Promise<void> {
    this.emit("heartbeat", Date.now())
    for (const task of this.tasks) {
      try {
        await task.run()
        this.emit("taskSuccess", task.id)
      } catch (err: any) {
        this.emit("taskError", { id: task.id, error: err.message })
      }
    }
  }
}
