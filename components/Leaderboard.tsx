export default function Leaderboard({ data }: any) {
  return (
    <div className="bg-white p-4 rounded-xl mt-6 shadow">
      <h2 className="font-bold mb-2">Leaderboard</h2>

      {data.map((u: any, i: number) => (
        <p key={i}>
          {i + 1}. {u.username} - {u.score}
        </p>
      ))}
    </div>
  );
}