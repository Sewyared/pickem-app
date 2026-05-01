"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params?.leagueId as string;

  useEffect(() => {
    if (!leagueId) return;

    // 💾 Save invite
    localStorage.setItem("inviteLeague", leagueId);

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/");
      }
    });

    return () => unsub();
  }, [leagueId]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p>Preparing your invite...</p>
    </main>
  );
}