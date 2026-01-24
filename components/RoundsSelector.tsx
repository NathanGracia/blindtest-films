'use client';

import { useState } from 'react';

interface RoundsSelectorProps {
  onRoundsChange: (rounds: number) => void;
  initialRounds?: number;
}

const ROUNDS_OPTIONS = [10, 25, 50, 75] as const;

export default function RoundsSelector({
  onRoundsChange,
  initialRounds = 25
}: RoundsSelectorProps) {
  const [selected, setSelected] = useState(initialRounds);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    const rounds = ROUNDS_OPTIONS[index];
    setSelected(rounds);
    onRoundsChange(rounds);
  };

  const currentIndex = ROUNDS_OPTIONS.indexOf(selected as typeof ROUNDS_OPTIONS[number]);

  return (
    <div className="w-full max-w-md mx-auto mt-4">
      <div className="flex items-center gap-4">
        <label className="text-white/70 text-sm font-medium whitespace-nowrap">
          Nombre de musiques:
        </label>
        <div className="flex-1 flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            value={currentIndex}
            onChange={handleChange}
            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer
              bg-white/10
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-[#7ec8e3]
              [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(126,200,227,0.5)]
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:hover:bg-[#a0d8f0]
              [&::-webkit-slider-thumb]:hover:shadow-[0_0_15px_rgba(126,200,227,0.8)]
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-[#7ec8e3]
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(126,200,227,0.5)]
              [&::-moz-range-thumb]:cursor-pointer
              [&::-moz-range-thumb]:transition-all
              [&::-moz-range-thumb]:hover:bg-[#a0d8f0]
              [&::-moz-range-thumb]:hover:shadow-[0_0_15px_rgba(126,200,227,0.8)]"
          />
          <span className="text-[#7ec8e3] font-bold text-lg min-w-[3ch] text-center">
            {selected}
          </span>
        </div>
      </div>
    </div>
  );
}
