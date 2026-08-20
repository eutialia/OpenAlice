/**
 * The Connector Service is only ever *run* as a bundle, but every other spec
 * exercises it from source — so a bundling regression reaches users without a
 * single test turning red. That is how grammY's Telegram transport shipped
 * broken: esbuild renamed `abort-controller`'s `AbortSignal` class (the global
 * of that name is read by discord.js/undici elsewhere in the bundle), and
 * node-fetch's `constructor.name === 'AbortSignal'` check then rejected
 * grammY's own signal, failing every Telegram API call with
 * "Network request for '<method>' failed!".
 *
 * This spec closes that gap for the transport: bundle a probe with the real
 * service bundling options and prove a Telegram call still completes.
 */
import { createServer, type Server } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { build, type Options } from 'tsup'
import connectorBundleConfig from '../../tsup.config.js'

const PROBE_ENTRY = 'services/connector/src/adapters/__fixtures__/telegram-bundle-probe.ts'

interface Probe {
  globalAbortSignalName: string
  run(apiRoot: string): Promise<{ ok: boolean; username?: string; cause?: string }>
}

describe('bundled Connector Service', () => {
  let outDir: string
  let server: Server
  let apiRoot: string

  beforeAll(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'connector-bundle-spec-'))
    const config = connectorBundleConfig as Options
    await build({
      config: false,
      silent: true,
      entry: { probe: PROBE_ENTRY },
      outDir,
      format: config.format,
      target: config.target,
      splitting: config.splitting,
      noExternal: config.noExternal,
      // The property under test: dropping it reintroduces the rename.
      keepNames: config.keepNames,
      esbuildOptions: config.esbuildOptions,
      sourcemap: false,
      outExtension: () => ({ js: '.cjs' }),
    })

    server = createServer((request, response) => {
      request.resume()
      request.on('end', () => {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({
          ok: true,
          result: { id: 123456, is_bot: true, first_name: 'Probe', username: 'probe_bot' },
        }))
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const port = typeof address === 'object' && address ? address.port : 0
    apiRoot = `http://127.0.0.1:${port}`
  }, 120_000)

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(outDir, { recursive: true, force: true })
  })

  it('keeps the Telegram transport working after bundling', async () => {
    const probe = createRequire(import.meta.url)(join(outDir, 'probe.cjs')) as Probe
    // Sanity: the fixture pins the global that forces the rename.
    expect(probe.globalAbortSignalName).toBe('AbortSignal')

    await expect(probe.run(apiRoot)).resolves.toEqual({ ok: true, username: 'probe_bot' })
  })
})
