import { spawnSync } from 'node:child_process'
const result = spawnSync('npm run build', { shell: true, stdio: 'inherit', env: { ...process.env, VITE_DEPLOY_TARGET: 'vercel' } })
process.exit(result.status ?? 1)
