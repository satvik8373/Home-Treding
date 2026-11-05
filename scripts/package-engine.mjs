import { build } from 'esbuild'
import { mkdir, copyFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const output = resolve(root, process.argv[2] || '.vercel/aws-engine')
if (!output.startsWith(resolve(root, '.vercel') + sep)) throw new Error('Package output must stay under .vercel.')
await mkdir(resolve(output, 'server'), { recursive: true })
await build({ entryPoints: [resolve(root, 'server/index.ts')], outfile: resolve(output, 'server/index.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external' })
await Promise.all(['package.json', 'package-lock.json'].map(name => copyFile(resolve(root, name), resolve(output, name))))
console.log(`Engine package prepared: ${output}`)
