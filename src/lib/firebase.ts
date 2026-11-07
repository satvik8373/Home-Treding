import { initializeApp } from '@firebase/app'
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence, signInWithPopup, signOut } from '@firebase/auth'

// Firebase web identifiers are public. Broker and server credentials never enter this module.
const app = initializeApp({
  apiKey: 'AIzaSyAlmxCoJhCQCncKx05iZsWNlxWlSLIldn0',
  authDomain: 'mavrix-trading.firebaseapp.com',
  projectId: 'mavrix-trading',
  appId: '1:315103441060:web:92dbf76316165a9007b631',
})
export async function googleSignIn() {
  const auth = getAuth(app)
  await setPersistence(auth, browserLocalPersistence)
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const result = await signInWithPopup(auth, provider)
  return result.user.getIdToken(true)
}

let renewal: Promise<boolean> | null = null
export async function resumeGoogleSession(): Promise<boolean> {
  if (renewal) return renewal
  renewal = (async () => {
    const auth = getAuth(app)
    await auth.authStateReady()
    if (!auth.currentUser) return false
    const idToken = await auth.currentUser.getIdToken(true)
    const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, resume: true }), signal: AbortSignal.timeout(15000) })
    if (response.status === 401) return false
    if (!response.ok) throw new Error('Session renewal temporarily unavailable.')
    return (await response.json()).authenticated === true
  })()
  try { return await renewal } finally { renewal = null }
}
export const googleSignOut = () => signOut(getAuth(app))
