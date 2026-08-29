import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyAlmxCoJhCQCncKx05iZsWNlxWlSLIldn0",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "mavrix-trading.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "mavrix-trading",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "mavrix-trading.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "315103441060",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:315103441060:web:92dbf76316165a9007b631",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-4CJK9WP0VV"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize analytics safely (only in supported browser environments)
let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Analytics optional in local dev
  });
}

export { app, auth, analytics, db, firebaseConfig };