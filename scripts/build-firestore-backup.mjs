import { build } from 'esbuild'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const root = fileURLToPath(new URL('..', import.meta.url)), output = resolve(root, '.vercel/firestore-backup')
await mkdir(output, { recursive: true })
await build({ entryPoints: [resolve(root, 'scripts/firestore-backup.ts')], outfile: resolve(output, 'firestore-backup.mjs'), bundle: true, packages: 'external', platform: 'node', target: 'node22', format: 'esm' })
const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'))
const version = lock.packages['node_modules/google-auth-library'].version
await writeFile(resolve(output, 'package.json'), JSON.stringify({ name: 'n009-private-backup-worker', private: true, type: 'module', dependencies: { 'google-auth-library': version } }, null, 2))
console.log('Private backup worker built under .vercel/firestore-backup. No credentials included.')
