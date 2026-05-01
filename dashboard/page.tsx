"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]);

  // AUTH
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("AUTH:", u);

      if (!u) {
        router.replace("/");
      } else {
        setUser(u);
      }
    });

    return () => unsub();
  }, []);

  // GAMES
  useEffect(() => {
    const fetchGames = async () => {
      const res = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
      );
      const data = await res.json();

      const parsed = data.events.map((g: any, i: number) => ({
        id: i,
        home: g.competitions[0].competitors[0].team.displayName,
        away: g.competitions[0].competitors[1].team.displayName,
      }));

      setGames(parsed);
    };

    fetchGames();
  }, []);

  const handlePick = (id: number, team: string) => {
    console.log("CLICK WORKED:", id, team);
  };

  const logout = async () => {
    console.log("LOGOUT CLICKED");
    await signOut(auth);
    router.replace("/");
  };

  if (!user) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  return (
    <main style={{ padding: 20 }}>
      <h1>Dashboard</h1>

      <button
        onClick={logout}
        style={{
          padding: "10px",
          marginBottom: "20px",
          background: "red",
          color: "white",
        }}
      >
        Logout
      </button>

      {games.map((g) => (
        <div
          key={g.id}
          style={{
            border: "1px solid black",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <p>
            {g.away} vs {g.home}
          </p>

          <button onClick={() => handlePick(g.id, g.away)}>
            {g.away}
          </button>

          <button onClick={() => handlePick(g.id, g.home)}>
            {g.home}
          </button>
        </div>
      ))}
    </main>
  );
}