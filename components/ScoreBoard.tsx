'use client';

interface ScoreBoardProps {
  score: number;
  currentIndex: number;
  total: number;
}

export default function ScoreBoard({ score, currentIndex, total }: ScoreBoardProps) {
  return (
    <div className="flex justify-between items-center glass rounded-xl p-4">
      <div className="text-center">
        <p className="text-white/60 text-sm">Film</p>
        <p className="text-2xl font-bold text-white">
          {currentIndex + 1} <span className="text-white/40">/ {total}</span>
        </p>
      </div>
      <div className="text-center">
        <p className="text-white/60 text-sm">Score</p>
        <p className="text-2xl font-bold text-[#7fba00] text-glow">{score}</p>
      </div>
    </div>
  );
}
