// 🔥 REPLACE WITH YOUR FIREBASE CONFIG

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyApm88nuUVx1_JwsCxPQAc9YE1aWIY3Gdo",
  authDomain: "pickem-e920b.firebaseapp.com",
  projectId: "pickem-e920b",
  storageBucket: "pickem-e920b.firebasestorage.app",
  messagingSenderId: "261097120071",
  appId: "1:261097120071:web:4a97b18751e494a1d76c62",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
