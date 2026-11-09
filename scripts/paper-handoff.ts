import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { Store } from '../server/store.ts'
import { exportPaperHandoff, importPaperHandoff } from '../server/paperHandoff.ts'

function requireStopped(data: string) {
  const path = join(data, 'engine.pid')
  if (!existsSync(path)) return
  const pid = Number(readFileSync(path, 'utf8'))
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('Engine ownership needs review.')
  try { process.kill(pid, 0) } catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH') return; throw error }
  throw new Error('Close the source dev terminal with Ctrl+C to checkpoint the running session. Do not square off for handoff.')
}
try {
  const [mode, directory, file, rootData] = process.argv.slice(2)
  if (!['export', 'import'].includes(mode) || !directory || !file) throw new Error('Usage: export <source-data> <new-private-file> or import <target-data> <file> <engine-root-data>')
  const data = resolve(directory)
  requireStopped(mode === 'import' ? resolve(rootData || (() => { throw new Error('Engine root data is required for import.') })()) : data)
  const store = new Store(data)
  try {
    if (mode === 'export') {
      const pack = exportPaperHandoff(store)
      writeFileSync(resolve(file), JSON.stringify(pack), { mode: 0o600, flag: 'wx' })
      writeFileSync(join(data, 'execution-owner.json'), JSON.stringify({ destination: 'hosted-account', sessionId: pack.session.id, exportedAt: new Date().toISOString() }), { mode: 0o600, flag: 'wx' })
    }
    else importPaperHandoff(store, JSON.parse(readFileSync(resolve(file), 'utf8')))
  } finally { store.close() }
  console.log(JSON.stringify({ status: mode === 'export' ? 'checkpoint-exported' : 'paper-session-imported', credentialsTransferred: false, brokerOrdersPlaced: false }))
} catch (error) { console.error(error instanceof Error ? error.message : 'Handoff failed.'); process.exitCode = 1 }
