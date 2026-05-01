"use client";

export default function GameCard({ game, onPick, selected }: any) {
  return (
    <div className="bg-white p-4 rounded-xl mb-4 shadow">
      <p className="text-center font-bold mb-2">
        {game.away} vs {game.home}
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => onPick(game.id, game.away)}
          className={`flex-1 py-2 rounded ${
            selected === game.away
              ? "bg-blue-700 text-white"
              : "bg-gray-200"
          }`}
        >
          {game.away}
        </button>

        <button
          onClick={() => onPick(game.id, game.home)}
          className={`flex-1 py-2 rounded ${
            selected === game.home
              ? "bg-green-700 text-white"
              : "bg-gray-200"
          }`}
        >
          {game.home}
        </button>
      </div>
    </div>
  );
}