'use client';

interface TimerProps {
  timeRemaining: number;
  totalTime: number;
}

export default function Timer({ timeRemaining, totalTime }: TimerProps) {
  const percentage = (timeRemaining / totalTime) * 100;
  const isLow = timeRemaining <= 10;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-white/60 text-sm">Temps restant</span>
        <span
          className={`text-3xl font-bold tabular-nums ${
            isLow ? 'text-red-400 animate-pulse' : 'text-white text-glow'
          }`}
        >
          {timeRemaining}s
        </span>
      </div>
      <div className="progress-aero h-4 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear rounded-full ${
            isLow ? 'progress-aero-fill-danger' : 'progress-aero-fill'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
