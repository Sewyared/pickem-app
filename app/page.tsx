"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup" | "reset">("signup");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // SIGN UP
  const signup = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", cred.user.uid), {
        username,
        email,
      });

      router.push("/dashboard");
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError("Email already exists. Try logging in.");
        setMode("login");
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else {
        setError(err.message);
      }
    }

    setLoading(false);
  };

  // LOGIN
  const login = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("No account found. Sign up first.");
        setMode("signup");
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password.");
      } else {
        setError(err.message);
      }
    }

    setLoading(false);
  };

  // RESET PASSWORD
  const resetPassword = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent. Check your inbox.");
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else {
        setError(err.message);
      }
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">

      {/* HERO */}
      <section className="text-center px-4 pt-16 pb-10">
        <h1 className="text-4xl font-extrabold mb-3">
          NFL Pick’em
        </h1>
        <p className="text-gray-400 max-w-md mx-auto">
          Compete with friends, pick winners, and climb the leaderboard.
        </p>
      </section>

      {/* AUTH */}
      <section className="px-4 pb-16">
        <div className="max-w-md mx-auto bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-xl">

          {/* TOGGLE */}
          {mode !== "reset" && (
            <div className="flex mb-5 bg-gray-700 rounded-xl p-1">
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                  mode === "signup" ? "bg-blue-600" : ""
                }`}
              >
                Sign Up
              </button>
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold ${
                  mode === "login" ? "bg-green-600" : ""
                }`}
              >
                Login
              </button>
            </div>
          )}

          {/* RESET HEADER */}
          {mode === "reset" && (
            <h3 className="text-center mb-4 font-bold">
              Reset Password
            </h3>
          )}

          {/* ERROR */}
          {error && (
            <div className="mb-3 text-sm text-red-400 bg-red-900/30 p-2 rounded">
              {error}
            </div>
          )}

          {/* SUCCESS */}
          {message && (
            <div className="mb-3 text-sm text-green-400 bg-green-900/30 p-2 rounded">
              {message}
            </div>
          )}

          {/* USERNAME */}
          {mode === "signup" && (
            <input
              className="w-full mb-3 p-3 rounded bg-gray-700 border border-gray-600"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}

          {/* EMAIL */}
          <input
            className="w-full mb-3 p-3 rounded bg-gray-700 border border-gray-600"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* PASSWORD */}
          {mode !== "reset" && (
            <input
              className="w-full mb-4 p-3 rounded bg-gray-700 border border-gray-600"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}

          {/* ACTION BUTTON */}
          <button
            onClick={
              mode === "signup"
                ? signup
                : mode === "login"
                ? login
                : resetPassword
            }
            disabled={loading}
            className={`w-full py-3 rounded-xl font-semibold ${
              loading
                ? "bg-gray-600"
                : mode === "signup"
                ? "bg-blue-600 hover:bg-blue-500"
                : mode === "login"
                ? "bg-green-600 hover:bg-green-500"
                : "bg-purple-600 hover:bg-purple-500"
            }`}
          >
            {loading
              ? "Loading..."
              : mode === "signup"
              ? "Create Account"
              : mode === "login"
              ? "Login"
              : "Send Reset Email"}
          </button>

          {/* LINKS */}
          <div className="mt-4 text-sm text-center text-gray-400 space-y-2">

            {mode === "login" && (
              <p
                className="cursor-pointer hover:text-white"
                onClick={() => setMode("reset")}
              >
                Forgot password?
              </p>
            )}

            {mode === "reset" && (
              <p
                className="cursor-pointer hover:text-white"
                onClick={() => setMode("login")}
              >
                Back to login
              </p>
            )}

          </div>

        </div>
      </section>

    </main>
  );
}