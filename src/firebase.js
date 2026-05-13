import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// ================================================================
// 🔥 PASTE YOUR FIREBASE CONFIG HERE
// Firebase Console → Project Settings → Your apps → </> Web
// ================================================================
const firebaseConfig = {
  apiKey:            "AIzaSyAqtRgOMBncNh1N8ihOu_OXg-mWNq3sqSI",
  authDomain:        "tableflow-4a5a5.firebaseapp.com",
  databaseURL:       "https://tableflow-4a5a5-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "tableflow-4a5a5",
  storageBucket:     "tableflow-4a5a5.firebasestorage.app",
  messagingSenderId: "138610700319",
  appId:             "1:138610700319:web:72cd21154cc94fe824652a"
};

// ================================================================
// 👔 YOUR SUPER ADMIN EMAIL — change this to your email
// This email will have access to the Super Admin dashboard
// ================================================================
export const SUPER_ADMIN_EMAIL = "comanager8468@gmail.com";

const app = initializeApp(firebaseConfig);
export const db   = getDatabase(app);
export const auth = getAuth(app);
