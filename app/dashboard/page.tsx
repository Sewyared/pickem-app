"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  // ================= STATE =================
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  const [games, setGames] = useState<any[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [activeLeague, setActiveLeague] = useState<any>(null);

  const [picks, setPicks] = useState<any>({});
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [seasonBoard, setSeasonBoard] = useState<any[]>([]);
  const [score, setScore] = useState(0);

  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");

  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  const [isFinalized, setIsFinalized] = useState(false);

  // ================= WEEK SYSTEM =================
  const getWeekId = () => {
    const now = new Date();
    const start = new Date("2026-09-10");

    const diff = Math.floor(
      (now.getTime() - start.getTime()) /
        (1000 * 60 * 60 * 24 * 7)
    );

    return `2026-W${Math.max(1, diff + 1)}`;
  };

  const weekId = getWeekId();

  // ================= AUTH =================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/");
        return;
      }

      setUser(u);

      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        setDisplayName(snap.data().username);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  // ================= USER LEAGUES =================
  useEffect(() => {
    if (!user) return;

    return onSnapshot(
      collection(db, "users", user.uid, "leagues"),
      async (snap) => {
        const list: any[] = [];

        for (let d of snap.docs) {
          const leagueDoc = await getDoc(
            doc(db, "leagues", d.id)
          );

          if (leagueDoc.exists()) {
            list.push({
              id: d.id,
              ...leagueDoc.data(),
            });
          }
        }

        setLeagues(list);
      }
    );
  }, [user]);

  // ================= MEMBERS =================
  useEffect(() => {
    if (!activeLeague) return;

    return onSnapshot(
      collection(
        db,
        "leagues",
        activeLeague.id,
        "members"
      ),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) =>
          list.push({ id: d.id, ...d.data() })
        );
        setMembers(list);
      }
    );
  }, [activeLeague]);

  // ================= REQUESTS =================
  useEffect(() => {
    if (!activeLeague || activeLeague.ownerId !== user?.uid)
      return;

    return onSnapshot(
      collection(
        db,
        "leagues",
        activeLeague.id,
        "requests"
      ),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) =>
          list.push({ id: d.id, ...d.data() })
        );
        setRequests(list);
      }
    );
  }, [activeLeague, user]);

  // ================= PICKS =================
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
  }, [user, activeLeague, weekId]);

  // ================= WEEK STATUS =================
  useEffect(() => {
    if (!activeLeague) return;

    return onSnapshot(
      doc(
        db,
        "leagues",
        activeLeague.id,
        "weeks",
        weekId
      ),
      (snap) => {
        setIsFinalized(snap.data()?.finalized || false);
      }
    );
  }, [activeLeague, weekId]);

  // ================= WEEKLY LEADERBOARD =================
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
  }, [activeLeague, weekId]);

  // ================= SEASON LEADERBOARD =================
  useEffect(() => {
    if (!activeLeague) return;

    return onSnapshot(
      collection(
        db,
        "leagues",
        activeLeague.id,
        "seasonScores"
      ),
      (snap) => {
        const data: any[] = [];

        snap.forEach((d) => data.push(d.data()));

        data.sort((a, b) => b.score - a.score);

        setSeasonBoard(data);
      }
    );
  }, [activeLeague]);

  // ================= GAMES =================
  useEffect(() => {
    const loadGames = async () => {
      const res = await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
      );

      const data = await res.json();

      const parsed = data.events.map((g: any) => {
        const comp = g.competitions[0];

        const home = comp.competitors.find(
          (c: any) => c.homeAway === "home"
        );

        const away = comp.competitors.find(
          (c: any) => c.homeAway === "away"
        );

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
  // ================= SAFE SCORING =================
useEffect(() => {
  if (!user || !activeLeague || games.length === 0) return;

  const run = async () => {
    const weekRef = doc(
      db,
      "leagues",
      activeLeague.id,
      "weeks",
      weekId
    );

    const weekSnap = await getDoc(weekRef);
    if (weekSnap.data()?.finalized) return;

    let s = 0;

    games.forEach((g) => {
      if (g.completed && picks[g.id] === g.winner) {
        s++;
      }
    });

    setScore(s);

    const scoreRef = doc(
      db,
      "leagues",
      activeLeague.id,
      "weeks",
      weekId,
      "scores",
      user.uid
    );

    const existing = await getDoc(scoreRef);

    if (!existing.exists()) {
      await setDoc(scoreRef, {
        username: displayName,
        score: s,
      });

      const seasonRef = doc(
        db,
        "leagues",
        activeLeague.id,
        "seasonScores",
        user.uid
      );

      const seasonSnap = await getDoc(seasonRef);

      await setDoc(
        seasonRef,
        {
          username: displayName,
          score:
            (seasonSnap.data()?.score || 0) + s,
        },
        { merge: true }
      );
    }
  };

  run();
}, [picks, games]);

// ================= FINALIZE WEEK =================
useEffect(() => {
  if (!activeLeague || games.length === 0) return;

  const finalize = async () => {
    const allDone = games.every((g) => g.completed);
    if (!allDone) return;

    const ref = doc(
      db,
      "leagues",
      activeLeague.id,
      "weeks",
      weekId
    );

    const snap = await getDoc(ref);

    if (snap.data()?.finalized) return;

    await setDoc(
      ref,
      { finalized: true },
      { merge: true }
    );
  };

  finalize();
}, [games]);

// ================= ACTIONS =================
const createLeague = async () => {
  const ref = doc(collection(db, "leagues"));
  const code = Math.random().toString(36).substring(2, 8);

  await setDoc(ref, {
    name: leagueName,
    code,
    ownerId: user.uid,
  });

  await setDoc(
    doc(db, "users", user.uid, "leagues", ref.id),
    { joined: true }
  );

  await setDoc(
    doc(db, "leagues", ref.id, "members", user.uid),
    { username: displayName }
  );

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

  await deleteDoc(
    doc(db, "users", user.uid, "leagues", activeLeague.id)
  );

  setActiveLeague(null);
};

const deleteLeague = async () => {
  if (activeLeague.ownerId !== user.uid) return;

  await deleteDoc(doc(db, "leagues", activeLeague.id));
  setActiveLeague(null);
};

const regenerateCode = async () => {
  const newCode = Math.random().toString(36).substring(2, 8);

  await setDoc(
    doc(db, "leagues", activeLeague.id),
    { code: newCode },
    { merge: true }
  );
};

// ================= PICKS =================
const handlePick = async (id: string, team: string) => {
  if (isFinalized) return;

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
  Date.now() >= new Date(t).getTime();

const getTimeLeft = (t: string) => {
  const diff = new Date(t).getTime() - Date.now();
  if (diff <= 0) return "Locked";

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);

  return `${h}h ${m}m`;
};

const logout = async () => {
  await signOut(auth);
  router.push("/");
};

if (loading)
  return <p className="p-6 text-white">Loading...</p>;

const weeklyWinner = leaderboard[0];

// ================= UI =================
return (
  <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
    <div className="max-w-xl mx-auto px-4 py-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {displayName}
          </h1>
          <p className="text-sm text-gray-400">
            Week {weekId}
          </p>
        </div>

        <button
          onClick={logout}
          className="border border-red-500/40 text-red-400 px-4 py-2 rounded-xl hover:bg-red-500/10 transition"
        >
          Logout
        </button>
      </div>

      {/* CREATE / JOIN */}
      <div className="bg-gray-800 p-4 rounded-xl mb-6 space-y-3 border border-gray-700">
        <input
          value={leagueName}
          onChange={(e) => setLeagueName(e.target.value)}
          placeholder="League name"
          className="w-full p-2 bg-gray-700 rounded"
        />

        <button
          onClick={createLeague}
          className="w-full bg-blue-600 hover:bg-blue-500 p-2 rounded"
        >
          Create League
        </button>

        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Join code"
          className="w-full p-2 bg-gray-700 rounded"
        />

        <button
          onClick={joinLeague}
          className="w-full bg-green-600 hover:bg-green-500 p-2 rounded"
        >
          Request to Join
        </button>

        {message && (
          <p className="text-yellow-400 text-sm">
            {message}
          </p>
        )}
      </div>

      {/* LEAGUES */}
      <div className="mb-6">
        {leagues.map((l) => (
          <div
            key={l.id}
            onClick={() => setActiveLeague(l)}
            className="bg-gray-800 border border-gray-700 p-3 mb-2 rounded cursor-pointer hover:bg-gray-700"
          >
            {l.name} ({l.code})
          </div>
        ))}
      </div>

      {/* ACTIVE LEAGUE */}
      {activeLeague && (
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl mb-6">

          <div className="flex justify-between mb-3">
            <h2 className="font-semibold">
              {activeLeague.name}
            </h2>

            <button
              onClick={regenerateCode}
              className="text-xs text-blue-400 hover:underline"
            >
              Regenerate Code
            </button>
          </div>

          {/* REQUESTS */}
          {requests.map((r) => (
            <div key={r.id} className="flex justify-between mb-1">
              <span>{r.username}</span>
              <div className="flex gap-2">
                <button onClick={() => acceptRequest(r)}>✔</button>
                <button onClick={() => denyRequest(r.id)}>✖</button>
              </div>
            </div>
          ))}

          {/* MEMBERS */}
          {members.map((m) => (
            <div key={m.id} className="flex justify-between text-sm">
              <span>
                {m.username}
                {m.id === user.uid && " (You)"}
              </span>

              {m.id !== user.uid && (
                <button
                  onClick={() => kickMember(m.id)}
                  className="text-red-400 text-xs"
                >
                  Kick
                </button>
              )}
            </div>
          ))}

          <div className="flex gap-4 mt-3 text-sm">
            <button onClick={leaveLeague} className="text-yellow-400">
              Leave
            </button>

            <button onClick={deleteLeague} className="text-red-400">
              Delete
            </button>
          </div>

          {/* LEADERBOARDS */}
          <div className="mt-4">
            <h3 className="font-semibold mb-1">Weekly</h3>
            {leaderboard.map((u, i) => (
              <p key={i}>
                #{i + 1} {u.username} - {u.score}
              </p>
            ))}
          </div>

          <div className="mt-4">
            <h3 className="font-semibold mb-1">Season</h3>
            {seasonBoard.map((u, i) => (
              <p key={i}>
                #{i + 1} {u.username} - {u.score}
              </p>
            ))}
          </div>

          {weeklyWinner && (
            <div className="mt-3 text-green-400 font-semibold">
              🏆 {weeklyWinner.username}
            </div>
          )}
        </div>
      )}

      {/* GAMES */}
      {activeLeague && (
        <div className="space-y-4">
          {games.map((g) => {
            const locked = isLocked(g.startTime);
            const picked = picks[g.id];

            return (
              <div
                key={g.id}
                className={`p-4 rounded-2xl border transition ${
                  locked
                    ? "bg-gray-800/60 border-gray-700 opacity-70"
                    : "bg-gray-800 border-gray-600 hover:border-green-500"
                }`}
              >
                <div className="flex justify-between mb-2">
                  <div>
                    <p className="text-xs text-gray-400">
                      {new Date(g.startTime).toLocaleString()}
                    </p>
                    <h3 className="font-bold">
                      {g.away} @ {g.home}
                    </h3>
                  </div>

                  <span className="text-xs">
                    {locked ? "LOCKED" : getTimeLeft(g.startTime)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[g.away, g.home].map((team) => (
                    <button
                      key={team}
                      disabled={locked || isFinalized}
                      onClick={() => handlePick(g.id, team)}
                      className={`p-2 rounded ${
                        picked === team
                          ? "bg-green-600"
                          : "bg-gray-700"
                      }`}
                    >
                      {team}
                    </button>
                  ))}
                </div>

                {g.completed && (
                  <p className="text-xs text-green-400 mt-1">
                    Winner: {g.winner}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  </main>
);}