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

  const [createdCode, setCreatedCode] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  // WEEK ID
  const getWeekId = () => {
    const now = new Date();
    const year = now.getFullYear();
    const firstJan = new Date(year, 0, 1);
    const days = Math.floor((now.getTime() - firstJan.getTime()) / 86400000);
    const week = Math.ceil((days + firstJan.getDay() + 1) / 7);
    return `${year}-W${week}`;
  };

  const weekId = getWeekId();

  // LOCK (2h before game)
  const isLocked = (startTime: string) => {
    const gameTime = new Date(startTime).getTime();
    return new Date().getTime() > gameTime - 2 * 60 * 60 * 1000;
  };

  // COUNTDOWN
  const getTimeLeft = (startTime: string) => {
    const lockTime = new Date(startTime).getTime() - 2 * 60 * 60 * 1000;
    const diff = lockTime - new Date().getTime();

    if (diff <= 0) return "Locked";

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${h}h ${m}m`;
  };

  // AUTH
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace("/");
      else setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // LOAD USERNAME
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) setDisplayName(snap.data().username);
    };

    load();
  }, [user]);

  // FETCH NFL GAMES
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

      if (member.exists()) {
        const membersSnap = await getDocs(
          collection(db, "leagues", l.id, "members")
        );

        list.push({
          id: l.id,
          ...l.data(),
          memberCount: membersSnap.size,
        });
      }
    }

    setLeagues(list);
  };

  useEffect(() => {
    if (user) loadLeagues();
  }, [user]);

  // LOAD MEMBERS
  useEffect(() => {
    if (!activeLeague) return;

    const loadMembers = async () => {
      const snap = await getDocs(
        collection(db, "leagues", activeLeague.id, "members")
      );

      const list: any[] = [];
      snap.forEach((doc) =>
        list.push({ id: doc.id, ...doc.data() })
      );

      setMembers(list);
    };

    loadMembers();
  }, [activeLeague]);
    // LOAD JOIN REQUESTS (OWNER ONLY)
  useEffect(() => {
    if (!activeLeague || activeLeague.ownerId !== user?.uid) return;

    const loadRequests = async () => {
      const snap = await getDocs(
        collection(db, "leagues", activeLeague.id, "requests")
      );

      const list: any[] = [];
      snap.forEach((doc) =>
        list.push({ id: doc.id, ...doc.data() })
      );

      setRequests(list);
    };

    loadRequests();
  }, [activeLeague, user]);

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

  // SCORE CALCULATION
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
      snap.forEach((d) => data.push(d.data()));
      data.sort((a, b) => b.score - a.score);

      setLeaderboard(data);
    };

    load();
  }, [activeLeague, score]);

  // PICK HANDLER
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

  // LOGOUT
  const logout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  // CREATE LEAGUE
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

    setCreatedCode(code);
    setLeagueName("");

    loadLeagues();
  };

  // JOIN LEAGUE (REQUEST SYSTEM)
  const joinLeague = async () => {
    if (!user) return;

    const snap = await getDocs(collection(db, "leagues"));
    let found: any = null;

    snap.forEach((d) => {
      if (d.data().code === joinCode) {
        found = { id: d.id, ...d.data() };
      }
    });

    if (!found) return alert("League not found");

    await setDoc(
      doc(db, "leagues", found.id, "requests", user.uid),
      {
        username: displayName,
        userId: user.uid,
      }
    );

    alert("Request sent for approval");
    setJoinCode("");
  };

  // DELETE LEAGUE
  const deleteLeague = async () => {
    if (!activeLeague || activeLeague.ownerId !== user.uid) return;

    await deleteDoc(doc(db, "leagues", activeLeague.id));
    setActiveLeague(null);
    loadLeagues();
  };

  // LEAVE LEAGUE
  const leaveLeague = async () => {
    if (!activeLeague || !user) return;

    await deleteDoc(
      doc(db, "leagues", activeLeague.id, "members", user.uid)
    );

    setActiveLeague(null);
    loadLeagues();
  };

  // KICK MEMBER
  const kickMember = async (memberId: string) => {
    if (!activeLeague) return;

    await deleteDoc(
      doc(db, "leagues", activeLeague.id, "members", memberId)
    );

    // refresh members
    const updated = members.filter((m) => m.id !== memberId);
    setMembers(updated);
  };
    if (loading) return <p className="p-6 text-white">Loading...</p>;
  if (!user) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-4">
      <div className="max-w-xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">🏈 Pick’em</h1>
          <button onClick={logout} className="text-red-400">Logout</button>
        </div>

        <p>User: {displayName}</p>
        <p className="text-sm text-gray-400">Week: {weekId}</p>
        <p className="mb-4 font-semibold">Score: {score}</p>

        {/* CREATE / JOIN */}
        <div className="bg-gray-800 p-4 rounded mb-4 space-y-2">
          <input
            placeholder="League name"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          />
          <button
            onClick={createLeague}
            className="w-full bg-blue-600 p-2 rounded"
          >
            Create League
          </button>

          <input
            placeholder="Join code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          />
          <button
            onClick={joinLeague}
            className="w-full bg-green-600 p-2 rounded"
          >
            Request to Join
          </button>
        </div>

        {/* LEAGUES LIST */}
        {leagues.map((l) => (
          <div
            key={l.id}
            onClick={() => setActiveLeague(l)}
            className={`p-2 mb-2 rounded cursor-pointer ${
              activeLeague?.id === l.id
                ? "bg-blue-700"
                : "bg-gray-700"
            }`}
          >
            {l.name} ({l.memberCount})
          </div>
        ))}

        {/* ACTIVE LEAGUE */}
        {activeLeague && (
          <div className="bg-gray-800 p-4 rounded mt-3 space-y-3">

            {/* CODE */}
            <div className="flex justify-between bg-gray-700 p-2 rounded text-sm">
              <span>Code: <strong>{activeLeague.code}</strong></span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeLeague.code);
                  alert("Copied");
                }}
              >
                Copy
              </button>
            </div>

            {/* INVITE LINK */}
            <div className="flex gap-2">
              <input
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/join/${activeLeague.id}`}
                className="flex-1 p-2 rounded bg-gray-700 text-sm"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/join/${activeLeague.id}`
                  );
                  alert("Link copied!");
                }}
                className="bg-blue-600 px-2 rounded"
              >
                Copy
              </button>
            </div>

            {/* REGENERATE CODE */}
            {activeLeague.ownerId === user.uid && (
              <button
                onClick={async () => {
                  const newCode = Math.random().toString(36).substring(2, 8);

                  await setDoc(
                    doc(db, "leagues", activeLeague.id),
                    { code: newCode },
                    { merge: true }
                  );

                  setActiveLeague({ ...activeLeague, code: newCode });
                }}
                className="bg-purple-600 w-full py-2 rounded"
              >
                Regenerate Code
              </button>
            )}

            {/* JOIN REQUESTS */}
            {activeLeague.ownerId === user.uid && requests.length > 0 && (
              <div>
                <h3 className="font-bold mb-2">Requests</h3>

                {requests.map((r) => (
                  <div key={r.id} className="flex justify-between mb-1">
                    <span>{r.username}</span>

                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await setDoc(
                            doc(db, "leagues", activeLeague.id, "members", r.id),
                            { username: r.username }
                          );

                          await deleteDoc(
                            doc(db, "leagues", activeLeague.id, "requests", r.id)
                          );
                        }}
                        className="bg-green-600 px-2 rounded text-sm"
                      >
                        Accept
                      </button>

                      <button
                        onClick={async () => {
                          await deleteDoc(
                            doc(db, "leagues", activeLeague.id, "requests", r.id)
                          );
                        }}
                        className="bg-red-600 px-2 rounded text-sm"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MEMBERS */}
            <div>
              <h3 className="font-bold mb-2">
                Members ({members.length})
              </h3>

              {members.map((m) => (
                <div key={m.id} className="flex justify-between text-sm mb-1">
                  <span>
                    🏈 {m.username}
                    {m.username === displayName && " (You)"}
                  </span>

                  {activeLeague.ownerId === user.uid &&
                    m.id !== user.uid && (
                      <button
                        onClick={() => kickMember(m.id)}
                        className="text-red-400 text-xs"
                      >
                        Kick
                      </button>
                    )}
                </div>
              ))}
            </div>

            {/* ACTIONS */}
            <div className="flex gap-4 text-sm">
              {activeLeague.ownerId === user.uid ? (
                <button
                  onClick={deleteLeague}
                  className="text-red-400"
                >
                  Delete League
                </button>
              ) : (
                <button
                  onClick={leaveLeague}
                  className="text-yellow-400"
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
            <div key={g.id} className="bg-gray-800 p-4 rounded mt-3">
              <p className="font-semibold">
                {g.away} vs {g.home}
              </p>

              <p className="text-xs text-gray-400">
                {new Date(g.startTime).toLocaleString()}
              </p>

              <p className="text-yellow-400 text-xs">
                ⏳ {getTimeLeft(g.startTime)}
              </p>

              <p className={locked ? "text-red-400" : "text-green-400"}>
                {locked ? "🔒 Locked" : "🟢 Open"}
              </p>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handlePick(g.id, g.away)}
                  disabled={locked}
                  className="flex-1 bg-gray-700 p-2 rounded"
                >
                  {g.away}
                </button>

                <button
                  onClick={() => handlePick(g.id, g.home)}
                  disabled={locked}
                  className="flex-1 bg-gray-700 p-2 rounded"
                >
                  {g.home}
                </button>
              </div>
            </div>
          );
        })}

        {/* LEADERBOARD */}
        <div className="bg-gray-800 p-4 rounded mt-4">
          <h2 className="font-bold mb-2">Leaderboard</h2>

          {leaderboard.map((u, i) => (
            <p key={i} className="flex justify-between text-sm">
              <span>#{i + 1} {u.username}</span>
              <span>{u.score}</span>
            </p>
          ))}
        </div>

      </div>
    </main>
  );
}
