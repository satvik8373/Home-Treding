import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url)), isolated = process.argv.includes('--isolated')
const env = { ...process.env, VITE_ENGINE_MODE: isolated ? 'isolated' : 'account', N009_ISOLATED_ENGINE: isolated ? 'true' : 'false' }
const children = []
if (isolated) children.push(spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: root, env, stdio: 'inherit', windowsHide: true }))
else console.log('Account preview: Google login, data and controls use the hosted engine. No local execution engine is started.')
children.push(spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--force'], { cwd: root, env, stdio: 'inherit', windowsHide: true }))
let closing = false
function close() { if (closing) return; closing = true; for (const child of children) if (!child.killed) child.kill('SIGTERM') }
for (const child of children) child.on('exit', () => { close() })
process.on('SIGINT', close); process.on('SIGTERM', close)
