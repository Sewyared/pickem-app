"use client";



import { useEffect, useState } from "react";

import { auth, db } from "@/lib/firebase";

import { onAuthStateChanged, signOut } from "firebase/auth";

import { doc, setDoc, getDoc } from "firebase/firestore";

import { useRouter } from "next/navigation";



export default function Dashboard() {

  const router = useRouter();



  const [user, setUser] = useState<any>(null);

  const [games, setGames] = useState<any[]>([]);

  const [picks, setPicks] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);



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



  // FETCH GAMES

  useEffect(() => {

    const fetchGames = async () => {

      try {

        const res = await fetch(

          "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"

        );

        const data = await res.json();



        const parsed = data.events.map((g: any) => ({

          id: g.id, // ✅ FIXED (real ID)

          home: g.competitions[0].competitors[0].team.displayName,

          away: g.competitions[0].competitors[1].team.displayName,

        }));



        setGames(parsed);

      } catch (err) {

        console.error("Error fetching games:", err);

      } finally {

        setLoading(false);

      }

    };



    fetchGames();

  }, []);



  // LOAD USER PICKS

  useEffect(() => {

    const loadPicks = async () => {

      if (!user || games.length === 0) return;



      const newPicks: Record<string, string> = {};



      for (const game of games) {

        const ref = doc(db, "picks", `${user.uid}_${game.id}`);

        const snap = await getDoc(ref);



        if (snap.exists()) {

          newPicks[game.id] = snap.data().team;

        }

      }



      setPicks(newPicks);

    };



    loadPicks();

  }, [user, games]);



  // HANDLE PICK

  const handlePick = async (gameId: string, team: string) => {

    if (!user) return;



    // prevent duplicate pick

    if (picks[gameId]) return;



    try {

      await setDoc(doc(db, "picks", `${user.uid}_${gameId}`), {

        userId: user.uid,

        gameId,

        team,

        createdAt: new Date(),

      });



      // update UI instantly

      setPicks((prev) => ({

        ...prev,

        [gameId]: team,

      }));



      console.log("Pick saved");

    } catch (err) {

      console.error("Error saving pick:", err);

    }

  };



  const logout = async () => {

    await signOut(auth);

    router.replace("/");

  };



  if (!user) {

    return <p style={{ padding: 20 }}>Loading...</p>;

  }



  if (loading) {

    return <p style={{ padding: 20 }}>Loading games...</p>;

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



      {games.map((g) => {

        const picked = picks[g.id];



        return (

          <div

            key={g.id}

            style={{

              border: "1px solid black",

              padding: "10px",

              marginBottom: "10px",

              background: picked ? "#f5f5f5" : "white",

            }}

          >

            <p>

              {g.away} vs {g.home}

            </p>



            <button

              onClick={() => handlePick(g.id, g.away)}

              disabled={!!picked}

              style={{

                marginRight: "10px",

                background: picked === g.away ? "green" : "",

                color: picked === g.away ? "white" : "",

              }}

            >

              {g.away}

            </button>



            <button

              onClick={() => handlePick(g.id, g.home)}

              disabled={!!picked}

              style={{

                background: picked === g.home ? "green" : "",

                color: picked === g.home ? "white" : "",

              }}

            >

              {g.home}

            </button>



            {picked && (

              <p style={{ marginTop: "8px" }}>

                Picked: <strong>{picked}</strong>

              </p>

            )}

          </div>

        );

      })}

    </main>

  );

}

