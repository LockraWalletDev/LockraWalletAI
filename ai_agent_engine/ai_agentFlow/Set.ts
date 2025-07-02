
type ScannerFn<T> = (target: T) => Promise<any>

export interface ScannerGroupConfig<T> {
  scanners: ScannerFn<T>[]
  concurrency?: number
  timeoutMs?: number
}

export class ScannerGroup<T> {
  private pending: Promise<any>[] = []

  constructor(private config: ScannerGroupConfig<T>) {}

  async run(targets: T[]): Promise<Record<string, any[]>> {
    const results: Record<string, any[]> = {}

    for (const scanner of this.config.scanners) {
      results[this.getScannerName(scanner)] = []
    }

    const semaphore = this.createSemaphore(this.config.concurrency || 5)

    for (const target of targets) {
      await semaphore.acquire()
      const promises = this.config.scanners.map(async scanner => {
        try {
          const res = await this.runWithTimeout(scanner(target), this.config.timeoutMs || 30000)
          results[this.getScannerName(scanner)].push(res)
        } catch (err) {
          results[this.getScannerName(scanner)].push({ error: err.message })
        }
      })
      this.pending.push(...promises)
      Promise.all(promises).finally(() => semaphore.release())
    }

    await Promise.all(this.pending)
    return results
  }

  private getScannerName(fn: ScannerFn<T>): string {
    return fn.name || "anonymousScanner"
  }

  private runWithTimeout(p: Promise<any>, ms: number): Promise<any> {
    let timer: NodeJS.Timeout
    const timeout = new Promise((_, rej) => {
      timer = setTimeout(() => rej(new Error("Scanner timed out")), ms)
    })
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer))
  }

  private createSemaphore(max: number) {
    let counter = 0
    const queue: (() => void)[] = []

    return {
      acquire(): Promise<void> {
        return new Promise(res => {
          if (counter < max) {
            counter++
            res()
          } else {
            queue.push(res)
          }
        })
      },
      release(): void {
        counter--
        if (queue.length) {
          counter++
          const next = queue.shift()!
          next()
        }
      }
    }
  }
}

// Example usage:
// const group = new ScannerGroup({
//   scanners: [scannerA, scannerB],
//   concurrency: 3,
//   timeoutMs: 10000
// })
// const data = await group.run([target1, target2, target3])
