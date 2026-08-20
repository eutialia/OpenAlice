import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { connector: 'src/main.ts' },
  format: ['cjs'],
  outDir: 'dist',
  target: 'es2023',
  sourcemap: true,
  clean: true,
  splitting: false,
  // Connector Service is a separately supervised deployable. Bundle its JS
  // SDKs (discord.js / grammY / Slack / Feishu / Hono / protocol) so Docker and Electron do not
  // depend on pnpm workspace symlinks surviving prune/package collection.
  noExternal: [/.*/],
  // Bundling everything into one realm means esbuild renames any declaration
  // that collides with a global the bundle also reads. `abort-controller`
  // (grammY's AbortController shim) declares `AbortSignal`, and discord.js /
  // undici read the global one, so the shim's class became `AbortSignal2` —
  // enough for node-fetch's `constructor.name === 'AbortSignal'` duck-typing
  // to reject grammY's own signal and fail every Telegram API call with
  // "Network request for '<method>' failed!". Unbundled `pnpm dev` never sees
  // it. keepNames restores the original names, so identity checks inside the
  // bundled SDKs keep working. Guarded by adapters/telegram-bundle.spec.ts.
  keepNames: true,
  outExtension: () => ({ js: '.cjs' }),
  esbuildOptions: (options) => {
    options.conditions = ['openalice-source', ...(options.conditions ?? [])]
  },
})
