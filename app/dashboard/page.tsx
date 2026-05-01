"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [games, setGames] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [picks, setPicks] = useState<{ [key: number]: string }>({});
  const [score, setScore] = useState(0);

  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [leagues, setLeagues] = useState<any[]>([]);
  const [activeLeague, setActiveLeague] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // WEEK
  const getWeekId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const firstJan = new Date(year, 0, 1);
    const days = Math.floor((now.getTime() - firstJan.getTime()) / 86400000);
    const week = Math.ceil((days + firstJan.getDay() + 1) / 7);
    return `${year}-W${week}`;
  };

  const weekId = getWeekId();

  // AUTH
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
      else setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // USERNAME
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) setDisplayName(snap.data().username);
    };

    load();
  }, [user]);

  // FETCH GAMES
  useEffect(() => {
    const fetchGames = async () => {
      const res = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
      );
      const data = await res.json();

      const parsed = data.events.map((g: any, i: number) => {
        const comp = g.competitions[0];
        const home = comp.competitors.find((c: any) => c.homeAway === "home");
        const away = comp.competitors.find((c: any) => c.homeAway === "away");

        let winner = "";
        if (g.status.type.completed) {
          winner = home.winner
            ? home.team.displayName
            : away.team.displayName;
        }

        return {
          id: i,
          home: home.team.displayName,
          away: away.team.displayName,
          startTime: g.date,
          winner,
        };
      });

      setGames(parsed);
    };

    fetchGames();
  }, []);

  // LOAD LEAGUES
  const loadLeagues = async () => {
    if (!user) return;

    const snap = await getDocs(collection(db, "leagues"));
    const list: any[] = [];

    for (let l of snap.docs) {
      const member = await getDoc(
        doc(db, "leagues", l.id, "members", user.uid)
      );
      if (member.exists()) list.push({ id: l.id, ...l.data() });
    }

    setLeagues(list);
  };

  useEffect(() => {
    if (user) loadLeagues();
  }, [user]);

  // INVITE AUTO JOIN
  useEffect(() => {
    if (!user) return;

    const handleInvite = async () => {
      const leagueId = localStorage.getItem("inviteLeague");
      if (!leagueId) return;

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const username = userSnap.exists()
        ? userSnap.data().username
        : "User";

      await setDoc(
        doc(db, "leagues", leagueId, "members", user.uid),
        { username }
      );

      localStorage.removeItem("inviteLeague");
      loadLeagues();
    };

    handleInvite();
  }, [user]);

  // LOAD PICKS
  useEffect(() => {
    if (!user || !activeLeague || games.length === 0) return;

    const load = async () => {
      const data: any = {};

      for (let g of games) {
        const snap = await getDoc(
          doc(
            db,
            "leagues",
            activeLeague.id,
            "weeks",
            weekId,
            "picks",
            `${user.uid}_${g.id}`
          )
        );

        if (snap.exists()) data[g.id] = snap.data().team;
      }

      setPicks(data);
    };

    load();
  }, [user, activeLeague, games]);

  // SCORE
  useEffect(() => {
    if (!activeLeague) return;

    let total = 0;

    games.forEach((g) => {
      if (g.winner && picks[g.id] === g.winner) total++;
    });

    setScore(total);

    if (user) {
      setDoc(
        doc(
          db,
          "leagues",
          activeLeague.id,
          "weeks",
          weekId,
          "scores",
          user.uid
        ),
        { username: displayName, score: total }
      );
    }
  }, [picks, displayName, games, activeLeague]);

  // LEADERBOARD
  useEffect(() => {
    if (!activeLeague) return;

    const load = async () => {
      const snap = await getDocs(
        collection(
          db,
          "leagues",
          activeLeague.id,
          "weeks",
          weekId,
          "scores"
        )
      );

      const data: any[] = [];
      snap.forEach((doc) => data.push(doc.data()));
      data.sort((a, b) => b.score - a.score);

      setLeaderboard(data);
    };

    load();
  }, [activeLeague, score]);

  // PICK
  const handlePick = async (id: number, team: string) => {
    if (!user || !activeLeague) return;

    setPicks((prev) => ({ ...prev, [id]: team }));

    await setDoc(
      doc(
        db,
        "leagues",
        activeLeague.id,
        "weeks",
        weekId,
        "picks",
        `${user.uid}_${id}`
      ),
      { team }
    );
  };

  const isLocked = (time: string) => new Date() > new Date(time);

  // ACTIONS
  const logout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  const createLeague = async () => {
    if (!user) return;

    const code = Math.random().toString(36).substring(2, 8);
    const ref = doc(collection(db, "leagues"));

    await setDoc(ref, {
      name: leagueName,
      code,
      ownerId: user.uid,
    });

    await setDoc(doc(db, "leagues", ref.id, "members", user.uid), {
      username: displayName,
    });

    loadLeagues();
  };

  const joinLeague = async () => {
    if (!user) return;

    const snap = await getDocs(collection(db, "leagues"));
    let found: any = null;

    snap.forEach((docSnap) => {
      if (docSnap.data().code === joinCode) {
        found = { id: docSnap.id, ...docSnap.data() };
      }
    });

    if (!found) return alert("League not found");

    await setDoc(
      doc(db, "leagues", found.id, "members", user.uid),
      { username: displayName }
    );

    loadLeagues();
  };

  const deleteLeague = async () => {
    if (!activeLeague || activeLeague.ownerId !== user.uid) return;
    if (!confirm("Delete this league?")) return;

    await deleteDoc(doc(db, "leagues", activeLeague.id));
    setActiveLeague(null);
    loadLeagues();
  };

  const leaveLeague = async () => {
    if (!activeLeague || !user) return;

    await deleteDoc(
      doc(db, "leagues", activeLeague.id, "members", user.uid)
    );

    setActiveLeague(null);
    loadLeagues();
  };

  if (loading) return <p className="p-6 text-white">Loading...</p>;
  if (!user) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-6">
      <div className="max-w-xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between mb-6">
          <h1 className="text-3xl font-extrabold tracking-wide">
            NFL Pick’em
          </h1>
          <button onClick={logout} className="bg-red-600 px-3 py-1 rounded">
            Logout
          </button>
        </div>

        <p className="mb-1">User: {displayName}</p>
        <p className="text-sm text-gray-400">Week: {weekId}</p>
        <p className="mb-4 font-semibold">Score: {score}</p>

        {/* LEAGUES */}
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl mb-6">
          <h2 className="font-bold mb-4">Leagues</h2>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <input
              placeholder="League name"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              className="col-span-2 p-2 rounded bg-gray-700"
            />
            <button onClick={createLeague} className="bg-blue-600 rounded">
              Create
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <input
              placeholder="Join code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="col-span-2 p-2 rounded bg-gray-700"
            />
            <button onClick={joinLeague} className="bg-green-600 rounded">
              Join
            </button>
          </div>

          {leagues.map((l) => (
            <div
              key={l.id}
              onClick={() => setActiveLeague(l)}
              className={`p-2 rounded cursor-pointer ${
                activeLeague?.id === l.id
                  ? "bg-blue-900"
                  : "hover:bg-gray-700"
              }`}
            >
              {l.name}
            </div>
          ))}
        </div>

{activeLeague && (
  <div className="mt-4 space-y-3">

    {/* 🔗 INVITE LINK */}
    <div className="flex gap-2">
      <input
        readOnly
        value={`${typeof window !== "undefined" ? window.location.origin : ""}/join/${activeLeague.id}`}
        className="flex-1 p-2 rounded bg-gray-700 text-sm text-gray-200 border border-gray-600"
      />
      <button
        onClick={() => {
          navigator.clipboard.writeText(
            `${window.location.origin}/join/${activeLeague.id}`
          );
          alert("Link copied!");
        }}
        className="bg-blue-600 hover:bg-blue-500 px-3 rounded text-sm"
      >
        Copy
      </button>
    </div>

    {/* ACTIONS */}
    <div className="flex gap-3 text-sm">
      {activeLeague.ownerId === user.uid ? (
        <button
          onClick={deleteLeague}
          className="text-red-400 hover:text-red-300"
        >
          Delete League
        </button>
      ) : (
        <button
          onClick={leaveLeague}
          className="text-yellow-400 hover:text-yellow-300"
        >
          Leave League
        </button>
      )}
    </div>

  </div>
)}




        {/* GAMES */}
        {games.map((g) => {
          const locked = isLocked(g.startTime);

          return (
            <div key={g.id} className="bg-gray-800 border border-gray-700 p-4 rounded-xl mb-4">

              <div className="text-center mb-3">
                <p className="text-lg font-bold">{g.away}</p>
                <p className="text-gray-400 text-sm">VS</p>
                <p className="text-lg font-bold">{g.home}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handlePick(g.id, g.away)}
                  disabled={locked}
                  className={`flex-1 py-2 rounded font-semibold transition ${
                    picks[g.id] === g.away
                      ? "bg-blue-600 scale-105"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  {g.away}
                </button>

                <button
                  onClick={() => handlePick(g.id, g.home)}
                  disabled={locked}
                  className={`flex-1 py-2 rounded font-semibold transition ${
                    picks[g.id] === g.home
                      ? "bg-green-600 scale-105"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  {g.home}
                </button>
              </div>
            </div>
          );
        })}

        {/* LEADERBOARD */}
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl mt-6">
          <h2 className="font-bold mb-3">Leaderboard</h2>

          {leaderboard.map((u, i) => (
            <p key={i} className="flex justify-between border-b border-gray-700 py-1">
              <span>#{i + 1} {u.username}</span>
              <span className="font-bold">{u.score}</span>
            </p>
          ))}
        </div>

      </div>
    </main>
  );
}