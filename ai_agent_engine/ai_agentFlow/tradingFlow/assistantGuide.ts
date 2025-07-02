/**
 * assistantGuide.ts
 * Provides interactive guidance and walkthroughs for users.
 */

import { EventEmitter } from "events"

export interface GuideStep {
  id: string
  title: string
  content: string
  completed?: boolean
}

export interface AssistantGuideConfig {
  steps: GuideStep[]
  autoAdvance?: boolean
  advanceIntervalMs?: number
}

export class AssistantGuide extends EventEmitter {
  private steps: GuideStep[]
  private currentIndex: number = 0
  private timer?: NodeJS.Timeout

  constructor(private config: AssistantGuideConfig) {
    super()
    this.steps = config.steps
    if (config.autoAdvance && config.advanceIntervalMs) {
      this.timer = setInterval(() => this.next(), config.advanceIntervalMs)
    }
  }

  start(): void {
    this.emit("start", this.current())
  }

  next(): GuideStep | null {
    if (this.currentIndex < this.steps.length - 1) {
      this.currentIndex++
      const step = this.current()
      this.emit("stepChange", step)
      return step
    }
    this.finish()
    return null
  }

  previous(): GuideStep | null {
    if (this.currentIndex > 0) {
      this.currentIndex--
      const step = this.current()
      this.emit("stepChange", step)
      return step
    }
    return null
  }

  current(): GuideStep {
    return this.steps[this.currentIndex]
  }

  completeCurrent(): void {
    this.steps[this.currentIndex].completed = true
    this.emit("stepComplete", this.current())
  }

  finish(): void {
    if (this.timer) clearInterval(this.timer)
    this.emit("finish", this.steps)
  }
}
