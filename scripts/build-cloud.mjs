import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const root = fileURLToPath(new URL('..', import.meta.url))
await build({ entryPoints: [resolve(root, 'server/cloud/api.ts')], outfile: resolve(root, 'cloud-runtime/dispatch.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external' })
await build({ entryPoints: [resolve(root, 'server/auth/runtime.ts')], outfile: resolve(root, 'cloud-runtime/identity.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external' })
