export interface BrowserContext { standalone?: boolean; displayModeStandalone?: boolean; userAgent: string; platform: string; maxTouchPoints: number }
export function needsGoogleRedirect(context: BrowserContext) {
  return context.standalone === true || context.displayModeStandalone === true || /iPhone|iPad|iPod|Android/i.test(context.userAgent) || context.platform === 'MacIntel' && context.maxTouchPoints > 1
}

/** Consume the SDK redirect once; retain its in-memory user token supplier across a failed cookie exchange. */
export function createRedirectCompletion(read: () => Promise<(() => Promise<string>) | null>, exchange: (token: string) => Promise<void>) {
  let pending: Promise<boolean> | null = null, credential: (() => Promise<string>) | null = null, completed = false
  return () => {
    if (completed) return Promise.resolve(true)
    if (pending) return pending
    pending = (async () => {
      credential ??= await read()
      if (!credential) return false
      await exchange(await credential())
      credential = null; completed = true
      return true
    })().finally(() => { pending = null })
    return pending
  }
}

export async function signInDeadline<T>(promise: Promise<T>, milliseconds = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Google sign-in is taking too long. Check your connection and retry.')), milliseconds) })]) }
  finally { if (timer) clearTimeout(timer) }
}
