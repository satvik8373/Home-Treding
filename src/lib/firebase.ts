import { initializeApp } from '@firebase/app'
import { browserSessionPersistence, getAuth, GoogleAuthProvider, setPersistence, signInWithPopup, signOut } from '@firebase/auth'

// Firebase web identifiers are public. Broker and server credentials never enter this module.
const app = initializeApp({
  apiKey: 'AIzaSyAlmxCoJhCQCncKx05iZsWNlxWlSLIldn0',
  authDomain: 'mavrix-trading.firebaseapp.com',
  projectId: 'mavrix-trading',
  appId: '1:315103441060:web:92dbf76316165a9007b631',
})
export async function googleSignIn() {
  const auth = getAuth(app)
  await setPersistence(auth, browserSessionPersistence)
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const result = await signInWithPopup(auth, provider)
  try { return await result.user.getIdToken(true) } finally { await signOut(auth) }
}
