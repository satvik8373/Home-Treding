import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBQLsyKBjUPr3CNPKjVeTCPXTkasFIOAhE",
  authDomain: "mine-treding.firebaseapp.com",
  projectId: "mine-treding",
  storageBucket: "mine-treding.firebasestorage.app",
  messagingSenderId: "205309218853",
  appId: "1:205309218853:web:c22303f679cf3b7bcf2fcc",
  measurementId: "G-R4T0B6YRD6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { app, auth, analytics, db };
