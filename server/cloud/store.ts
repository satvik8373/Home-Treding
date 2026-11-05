import { Store } from '../store.ts'
import type { SavedBroker } from '../store.ts'

/** SQLite is a working cache; encrypted PostgreSQL checkpoints are the durable cloud source. */
export class CloudStore extends Store {
  private version = 0
  private committed = 0
  private task: Promise<void> | null = null
  constructor(directory: string, key: Buffer, records: Record<string, unknown>, private commit: (records: Record<string, unknown>) => Promise<void>) {
    super(directory, key)
    for (const [name, value] of Object.entries(records)) super.put(name, value)
  }
  override put(key: string, value: unknown) { super.put(key, value); this.version++ }
  override saveBroker(value: SavedBroker | null) { super.saveBroker(value); this.version++ }
  override async persist(): Promise<void> {
    if (!this.task) {
      const task = (async () => {
        while (this.committed !== this.version) {
          const version = this.version, records = Object.fromEntries(this.keys('').map(key => [key, this.get(key)]))
          await this.commit(records)
          this.committed = version
        }
      })()
      this.task = task
      void task.then(() => { if (this.task === task) this.task = null }, () => { if (this.task === task) this.task = null })
    }
    await this.task
  }
}
