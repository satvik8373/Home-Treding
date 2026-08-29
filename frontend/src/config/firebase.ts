import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAlmxCoJhCQCncKx05iZsWNlxWlSLIldn0",
  authDomain: "mavrix-trading.firebaseapp.com",
  projectId: "mavrix-trading",
  storageBucket: "mavrix-trading.firebasestorage.app",
  messagingSenderId: "315103441060",
  appId: "1:315103441060:web:92dbf76316165a9007b631",
  measurementId: "G-4CJK9WP0VV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize analytics safely
let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Ignore analytics unsupported in local dev
  });
}

export { app, auth, analytics, db };
