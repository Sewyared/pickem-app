import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();
const db = admin.firestore();

export const calculateScores = onSchedule(
  "every 5 minutes",
  async () => {
    console.log("Running score calculation...");

    const leaguesSnap = await db.collection("leagues").get();

    for (const leagueDoc of leaguesSnap.docs) {
      const leagueId = leagueDoc.id;

      const weeksSnap = await db
        .collection("leagues")
        .doc(leagueId)
        .collection("weeks")
        .get();

      for (const weekDoc of weeksSnap.docs) {
        const weekId = weekDoc.id;

        const resultsSnap = await db
          .collection("weeks")
          .doc(weekId)
          .collection("results")
          .get();

        if (resultsSnap.empty) continue;

        const results: Record<string, string> = {};

        resultsSnap.forEach(
          (d: FirebaseFirestore.QueryDocumentSnapshot) => {
            const data = d.data() as { winner: string };
            results[d.id] = data.winner;
          }
        );

        const picksSnap = await db
          .collection("leagues")
          .doc(leagueId)
          .collection("weeks")
          .doc(weekId)
          .collection("picks")
          .get();

        const scoresRef = db
          .collection("leagues")
          .doc(leagueId)
          .collection("weeks")
          .doc(weekId)
          .collection("scores");

        for (const pickDoc of picksSnap.docs) {
          const uid = pickDoc.id;
          const picks = pickDoc.data();

          let score = 0;

          for (const gameId in picks) {
            if (results[gameId] === picks[gameId]) {
              score++;
            }
          }

          const scoreDoc = await scoresRef.doc(uid).get();
          const prevScore = scoreDoc.exists
            ? scoreDoc.data()?.score || 0
            : 0;

          const diff = score - prevScore;

          await scoresRef.doc(uid).set(
            {
              score,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          const seasonRef = db
            .collection("leagues")
            .doc(leagueId)
            .collection("season")
            .doc(uid);

          await seasonRef.set(
            {
              total: admin.firestore.FieldValue.increment(diff),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }
    }

    console.log("Score calculation complete.");
  }
);