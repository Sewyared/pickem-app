import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyApm88nuUVx1_JwsCxPQAc9YE1aWIY3Gdo",
  authDomain: "pickem-e920b.firebaseapp.com",
  projectId: "pickem-e920b",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);