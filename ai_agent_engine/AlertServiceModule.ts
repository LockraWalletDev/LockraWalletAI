import { EventEmitter } from "events"

export interface Alert {
  id: string
  level: "info" | "warning" | "critical"
  message: string
  timestamp: number
}

export interface AlertServiceConfig {
  emitIntervalMs: number
  maxAlertsInQueue: number
}

export class AlertServiceModule extends EventEmitter {
  private queue: Alert[] = []
  private timer?: NodeJS.Timer

  constructor(private config: AlertServiceConfig) {
    super()
  }

  start(): void {
    this.timer = setInterval(() => this.flush(), this.config.emitIntervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.flush()
  }

  enqueue(alert: Omit<Alert, "id" | "timestamp">): void {
    const fullAlert: Alert = {
      ...alert,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
      timestamp: Date.now(),
    }
    if (this.queue.length >= this.config.maxAlertsInQueue) {
      this.queue.shift()
    }
    this.queue.push(fullAlert)
  }

  private flush(): void {
    while (this.queue.length) {
      const alert = this.queue.shift()!
      this.emit("alert", alert)
    }
  }
}
