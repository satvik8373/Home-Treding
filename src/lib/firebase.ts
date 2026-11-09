import { initializeApp } from '@firebase/app'
import { browserLocalPersistence, getAuth, getRedirectResult, GoogleAuthProvider, setPersistence, signInWithPopup, signInWithRedirect, signOut } from '@firebase/auth'
import { createRedirectCompletion, needsGoogleRedirect, signInDeadline } from './google-flow'

// Firebase web identifiers are public. Broker and server credentials never enter this module.
const app = initializeApp({
  apiKey: 'AIzaSyAlmxCoJhCQCncKx05iZsWNlxWlSLIldn0',
  authDomain: window.location.hostname === 'home-treding.vercel.app' ? 'home-treding.vercel.app' : 'mavrix-trading.firebaseapp.com',
  projectId: 'mavrix-trading',
  appId: '1:315103441060:web:92dbf76316165a9007b631',
})
export async function googleSignIn() {
  const auth = getAuth(app)
  await setPersistence(auth, browserLocalPersistence)
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  if (needsGoogleRedirect({ standalone: (navigator as Navigator & { standalone?: boolean }).standalone, displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches, userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints })) {
    if (window.location.hostname !== 'home-treding.vercel.app') throw new Error('Open home-treding.vercel.app to sign in from the installed app.')
    await signInWithRedirect(auth, provider)
    return null
  }
  const result = await signInWithPopup(auth, provider)
  return result.user.getIdToken(true)
}

const finishRedirect = createRedirectCompletion(async () => {
  const result = await getRedirectResult(getAuth(app))
  return result ? () => result.user.getIdToken(true) : null
}, async idToken => {
  const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }), signal: AbortSignal.timeout(15000) })
  if (!response.ok || (await response.json()).authenticated !== true) throw new Error('Google sign-in could not be completed. Please retry.')
})
export const completeGoogleRedirect = () => signInDeadline(finishRedirect())

let renewal: Promise<boolean> | null = null
export async function resumeGoogleSession(): Promise<boolean> {
  if (renewal) return renewal
  renewal = (async () => {
    const auth = getAuth(app)
    await auth.authStateReady()
    if (!auth.currentUser) return false
    let idToken: string
    try { idToken = await auth.currentUser.getIdToken(true) }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      if (['auth/user-disabled', 'auth/user-token-expired', 'auth/invalid-user-token', 'auth/user-not-found'].includes(code)) return false
      throw error
    }
    const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, resume: true }), signal: AbortSignal.timeout(15000) })
    if (response.status === 401) return false
    if (!response.ok) throw new Error('Session renewal temporarily unavailable.')
    return (await response.json()).authenticated === true
  })()
  try { return await renewal } finally { renewal = null }
}
export const googleSignOut = () => signOut(getAuth(app))
