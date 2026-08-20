/**
 * Bundled-runtime probe for `telegram-bundle.spec.ts`.
 *
 * The Connector Service ships as a single esbuild bundle, and grammY's Telegram
 * transport only breaks *after* bundling — nothing this file does is
 * interesting when it runs from source. Keep it minimal: the spec bundles it
 * the way `tsup.config.ts` bundles the service and then drives `run` against a
 * stub Bot API.
 */
import { Api } from 'grammy'

/**
 * discord.js and undici read the global `AbortSignal` in the real bundle, which
 * is what pressures esbuild into renaming `abort-controller`'s same-named
 * class out from under node-fetch's `constructor.name` duck-typing. Reading it
 * here reproduces that pressure in a fixture small enough to bundle inside a
 * unit test.
 */
export const globalAbortSignalName = AbortSignal.name

export async function run(apiRoot: string): Promise<{ ok: boolean; username?: string; cause?: string }> {
  const api = new Api('123456:probe-token', { apiRoot })
  try {
    const me = await api.getMe()
    return { ok: true, username: me.username }
  } catch (error) {
    const cause = (error as { error?: unknown }).error
    return { ok: false, cause: cause instanceof Error ? cause.message : String(cause) }
  }
}
