"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  const [games, setGames] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [activeLeague, setActiveLeague] = useState<any>(null);

  const [picks, setPicks] = useState<any>({});
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [score, setScore] = useState(0);

  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");

  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  const weekId = "2026-W1";

  // AUTH
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);

      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) setDisplayName(snap.data().username);

      setLoading(false);
    });
    return () => unsub();
  }, []);

  // USER LEAGUES
  useEffect(() => {
    if (!user) return;

    return onSnapshot(
      collection(db, "users", user.uid, "leagues"),
      async (snap) => {
        const list: any[] = [];
        for (let d of snap.docs) {
          const leagueDoc = await getDoc(doc(db, "leagues", d.id));
          if (leagueDoc.exists()) {
            list.push({ id: d.id, ...leagueDoc.data() });
          }
        }
        setLeagues(list);
      }
    );
  }, [user]);

  // MEMBERS
  useEffect(() => {
    if (!activeLeague) return;

    return onSnapshot(
      collection(db, "leagues", activeLeague.id, "members"),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setMembers(list);
      }
    );
  }, [activeLeague]);

  // REQUESTS
  useEffect(() => {
    if (!activeLeague || activeLeague.ownerId !== user?.uid) return;

    return onSnapshot(
      collection(db, "leagues", activeLeague.id, "requests"),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setRequests(list);
      }
    );
  }, [activeLeague, user]);

  // PICKS
  useEffect(() => {
    if (!user || !activeLeague) return;

    return onSnapshot(
      doc(
        db,
        "leagues",
        activeLeague.id,
        "weeks",
        weekId,
        "picks",
        user.uid
      ),
      (snap) => {
        setPicks(snap.exists() ? snap.data() : {});
      }
    );
  }, [user, activeLeague]);

  // LEADERBOARD
  useEffect(() => {
    if (!activeLeague) return;

    return onSnapshot(
      collection(
        db,
        "leagues",
        activeLeague.id,
        "weeks",
        weekId,
        "scores"
      ),
      (snap) => {
        const data: any[] = [];
        snap.forEach((d) => data.push(d.data()));
        data.sort((a, b) => b.score - a.score);
        setLeaderboard(data);
      }
    );
  }, [activeLeague]);

  // GAMES
  useEffect(() => {
    const loadGames = async () => {
      const res = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
      );
      const data = await res.json();

      const parsed = data.events.map((g: any) => {
        const comp = g.competitions[0];
        const home = comp.competitors.find((c: any) => c.homeAway === "home");
        const away = comp.competitors.find((c: any) => c.homeAway === "away");

        return {
          id: g.id,
          home: home.team.displayName,
          away: away.team.displayName,
          startTime: g.date,
          completed: g.status.type.completed,
          winner: home.winner
            ? home.team.displayName
            : away.team.displayName,
        };
      });

      setGames(parsed);
    };

    loadGames();
  }, []);

  // SCORE
  useEffect(() => {
    let s = 0;
    games.forEach((g) => {
      if (g.winner && picks[g.id] === g.winner) s++;
    });
    setScore(s);

    if (user && activeLeague) {
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
        { username: displayName, score: s },
        { merge: true }
      );
    }
  }, [picks, games, activeLeague]);

  // ACTIONS
  const createLeague = async () => {
    const ref = doc(collection(db, "leagues"));
    const code = Math.random().toString(36).substring(2, 8);

    await setDoc(ref, {
      name: leagueName,
      code,
      ownerId: user.uid,
    });

    await setDoc(doc(db, "users", user.uid, "leagues", ref.id), {
      joined: true,
    });

    await setDoc(doc(db, "leagues", ref.id, "members", user.uid), {
      username: displayName,
    });

    setMessage(`Created! Code: ${code}`);
    setLeagueName("");
  };

  const joinLeague = async () => {
    const q = query(
      collection(db, "leagues"),
      where("code", "==", joinCode)
    );

    const snap = await getDocs(q);
    if (snap.empty) return setMessage("Invalid code");

    const league = snap.docs[0];

    await setDoc(
      doc(db, "leagues", league.id, "requests", user.uid),
      { username: displayName }
    );

    setJoinCode("");
    setMessage("Request sent!");
  };

  const acceptRequest = async (r: any) => {
    await setDoc(
      doc(db, "leagues", activeLeague.id, "members", r.id),
      { username: r.username }
    );

    await setDoc(
      doc(db, "users", r.id, "leagues", activeLeague.id),
      { joined: true }
    );

    await deleteDoc(
      doc(db, "leagues", activeLeague.id, "requests", r.id)
    );
  };

  const denyRequest = async (id: string) => {
    await deleteDoc(
      doc(db, "leagues", activeLeague.id, "requests", id)
    );
  };

  const kickMember = async (id: string) => {
    await deleteDoc(
      doc(db, "leagues", activeLeague.id, "members", id)
    );
  };

  const leaveLeague = async () => {
    await deleteDoc(
      doc(db, "leagues", activeLeague.id, "members", user.uid)
    );
    setActiveLeague(null);
  };

  const deleteLeague = async () => {
    await deleteDoc(doc(db, "leagues", activeLeague.id));
    setActiveLeague(null);
  };

  const handlePick = async (id: string, team: string) => {
    const ref = doc(
      db,
      "leagues",
      activeLeague.id,
      "weeks",
      weekId,
      "picks",
      user.uid
    );

    const updated = { ...picks, [id]: team };
    setPicks(updated);

    await setDoc(ref, updated, { merge: true });
  };

  const isLocked = (t: string) =>
    Date.now() > new Date(t).getTime() - 7200000;

  const getTimeLeft = (t: string) => {
    const diff =
      new Date(t).getTime() - 7200000 - Date.now();
    if (diff <= 0) return "Locked";

    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const logout = async () => {
    await signOut(auth);
    location.reload();
  };

  if (loading) return <p className="p-6 text-white">Loading...</p>;

  return (
    <main className="min-h-screen bg-black text-white p-4">
      <div className="max-w-xl mx-auto">

        <div className="flex justify-between mb-4">
          <h1 className="text-2xl font-bold">🏈 Pick’em</h1>
          <button onClick={logout} className="text-red-400">
            Logout
          </button>
        </div>

        <p>User: {displayName}</p>
        <p className="mb-2">Score: {score}</p>

        {/* CREATE / JOIN */}
        <div className="bg-gray-800 p-4 rounded mb-4 space-y-2">
          <input value={leagueName} onChange={(e)=>setLeagueName(e.target.value)} placeholder="League name" className="w-full p-2 bg-gray-700 rounded"/>
          <button onClick={createLeague} className="w-full bg-blue-600 p-2 rounded">Create</button>

          <input value={joinCode} onChange={(e)=>setJoinCode(e.target.value)} placeholder="Join code" className="w-full p-2 bg-gray-700 rounded"/>
          <button onClick={joinLeague} className="w-full bg-green-600 p-2 rounded">Request</button>

          {message && <p className="text-yellow-400 text-sm">{message}</p>}
        </div>

        {/* LEAGUES */}
        {leagues.map(l => (
          <div key={l.id} onClick={()=>setActiveLeague(l)} className="bg-gray-700 p-2 mb-2 cursor-pointer">
            {l.name}
          </div>
        ))}

        {/* ACTIVE */}
        {activeLeague && (
          <div className="bg-gray-900 p-4 rounded mt-3">

            <div className="flex justify-between">
              <h2>{activeLeague.name}</h2>
              <span>Code: {activeLeague.code}</span>
            </div>

            {/* REQUESTS */}
            {requests.map(r => (
              <div key={r.id}>
                {r.username}
                <button onClick={()=>acceptRequest(r)}>✔</button>
                <button onClick={()=>denyRequest(r.id)}>✖</button>
              </div>
            ))}

            {/* MEMBERS */}
            {members.map(m => (
              <div key={m.id}>
                {m.username}
                {m.id !== user.uid && (
                  <button onClick={()=>kickMember(m.id)}>Kick</button>
                )}
              </div>
            ))}

            {/* LEADERBOARD */}
            <div className="mt-3">
              <h3 className="font-bold">Leaderboard</h3>
              {leaderboard.map((u,i)=>(
                <p key={i}>#{i+1} {u.username} - {u.score}</p>
              ))}
            </div>

            <button onClick={leaveLeague}>Leave</button>
          </div>
        )}

        {/* GAMES */}
        {games.map(g => {
          const locked = isLocked(g.startTime);

          return (
            <div key={g.id} className="bg-gray-800 p-3 mt-2">
              <p>{g.away} vs {g.home}</p>
              <p className="text-xs">{getTimeLeft(g.startTime)}</p>

              <button disabled={locked} onClick={()=>handlePick(g.id,g.away)}>
                {g.away}
              </button>

              <button disabled={locked} onClick={()=>handlePick(g.id,g.home)}>
                {g.home}
              </button>
            </div>
          );
        })}

      </div>
    </main>
  );
}
