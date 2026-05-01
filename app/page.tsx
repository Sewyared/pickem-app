"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const signup = async () => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
      username,
      email,
    });

    router.push("/dashboard");
  };

  const login = async () => {
    await signInWithEmailAndPassword(auth, email, password);
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">

      {/* HERO */}
      <section className="text-center px-4 pt-14 pb-10 sm:pt-20 sm:pb-14">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-wide mb-3">
          NFL Pick’em
        </h1>

        <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto mb-6">
          Pick winners every week, compete with friends, and climb the leaderboard.
        </p>

        <button
          onClick={() =>
            document.getElementById("auth")?.scrollIntoView({ behavior: "smooth" })
          }
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-semibold text-base"
        >
          Get Started
        </button>
      </section>

      {/* PREVIEW */}
      <section className="px-4 mb-12">
        <h2 className="text-center text-gray-300 text-sm sm:text-lg font-bold mb-4">
          This Week’s Matchups
        </h2>

        <div className="flex flex-col gap-3 max-w-md mx-auto">
          {[
            { away: "Chiefs", home: "Ravens" },
            { away: "Packers", home: "Bears" },
            { away: "Cowboys", home: "Eagles" },
          ].map((g, i) => (
            <div
              key={i}
              className="bg-gray-800 border border-gray-700 p-4 rounded-xl text-center"
            >
              <p className="text-base font-bold">{g.away}</p>
              <p className="text-gray-500 text-xs">VS</p>
              <p className="text-base font-bold">{g.home}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AUTH */}
      <section id="auth" className="px-4 pb-14">
        <div className="w-full max-w-md mx-auto bg-gray-800 border border-gray-700 p-5 rounded-2xl shadow-xl">

          <h3 className="text-lg sm:text-xl font-bold mb-4 text-center">
            Join the Competition
          </h3>

          <input
            className="w-full mb-3 p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="Username"
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            className="w-full mb-3 p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full mb-5 p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="Password"
            type="password"
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={signup}
              className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-semibold text-base"
            >
              Sign Up
            </button>

            <button
              onClick={login}
              className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-xl font-semibold text-base"
            >
              Login
            </button>
          </div>

        </div>
      </section>

    </main>
  );
}