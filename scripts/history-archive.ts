import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { captureDaily, dailyScope, syncDailyBatch } from '../server/backup/dailyArchives.ts'
import { firestoreClient } from '../server/backup/accountSync.ts'

/** Archives/read-decrypt verification only. No broker or strategy-control imports. */
async function main() {
const root = resolve(process.env.N009_DATA_DIR || 'data')
let days = 0, checked = 0
for (const workspace of ['owner', ...readdirSync(join(root, 'tenants')).filter(name => /^[a-f0-9]{64}$/.test(name))]) {
  const directory = workspace === 'owner' ? root : join(root, 'tenants', workspace)
  for (let attempt = 0; attempt < 200; attempt++) {
    const batch = captureDaily(directory, workspace)
    if (!batch.length) break
    await syncDailyBatch(directory, workspace, batch)
    for (const day of batch) {
      const read = await firestoreClient(workspace).restore(dailyScope(workspace, day.day))
      if (!read.records.some(row => row.key === 'archive:meta' && JSON.parse(row.value).day === day.day)) throw new Error('Daily archive read-back mismatch.')
      days++
    }
  }
  if (captureDaily(directory, workspace, 1).length) throw new Error('More days remain. Rerun the archive worker.')
  checked++
}
console.log(JSON.stringify({ workspacesChecked: checked, dailyArchivesSavedAndReadBack: days, brokerOrdersPlaced: false }))
}
void main().catch(() => { console.error('Daily archive synchronization failed. Local history is retained; check the private server configuration and retry.'); process.exitCode = 1 })
