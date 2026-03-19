'use client';

import { useState, useEffect, useRef } from 'react';

interface VolumeSliderProps {
  onVolumeChange: (volume: number) => void;
}

export default function VolumeSlider({ onVolumeChange }: VolumeSliderProps) {
  const [volume, setVolume] = useState(0.7);
  const [prevVolume, setPrevVolume] = useState(0.7);
  const [isHovered, setIsHovered] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedVolume = localStorage.getItem('blindtoss_volume');
    if (savedVolume !== null) {
      const vol = parseFloat(savedVolume);
      if (!isNaN(vol) && vol >= 0 && vol <= 1) {
        setVolume(vol);
        if (vol > 0) setPrevVolume(vol);
        onVolumeChange(vol);
      }
    } else {
      onVolumeChange(0.7);
    }
  }, [onVolumeChange]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0) setPrevVolume(newVolume);
    localStorage.setItem('blindtoss_volume', newVolume.toString());
    onVolumeChange(newVolume);
  };

  const handleMuteToggle = () => {
    if (volume === 0) {
      const restore = prevVolume > 0 ? prevVolume : 0.7;
      setVolume(restore);
      localStorage.setItem('blindtoss_volume', restore.toString());
      onVolumeChange(restore);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      localStorage.setItem('blindtoss_volume', '0');
      onVolumeChange(0);
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    showTimeoutRef.current = setTimeout(() => {
      setShowSlider(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    hideTimeoutRef.current = setTimeout(() => {
      setShowSlider(false);
    }, 300);
  };

  const getVolumeIcon = () => {
    if (volume === 0) return '🔇';
    if (volume < 0.3) return '🔈';
    if (volume < 0.7) return '🔉';
    return '🔊';
  };

  return (
    <div
      ref={containerRef}
      className="fixed top-4 right-4 z-50 flex items-center gap-3"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Slider - apparaît après hover prolongé */}
      <div
        className={`transition-all duration-200 ${
          showSlider ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
        }`}
      >
        <div className="glass rounded-lg px-3 py-2 flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-24 h-2 rounded-lg appearance-none cursor-pointer
              bg-white/10
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-[#7ec8e3]
              [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(126,200,227,0.5)]
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-all
              [&::-webkit-slider-thumb]:hover:bg-[#a0d8f0]
              [&::-webkit-slider-thumb]:hover:shadow-[0_0_12px_rgba(126,200,227,0.8)]
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-[#7ec8e3]
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(126,200,227,0.5)]
              [&::-moz-range-thumb]:cursor-pointer
              [&::-moz-range-thumb]:transition-all
              [&::-moz-range-thumb]:hover:bg-[#a0d8f0]
              [&::-moz-range-thumb]:hover:shadow-[0_0_12px_rgba(126,200,227,0.8)]"
          />
          <span className="text-white/70 text-xs font-medium min-w-[2.5rem] text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      {/* Bouton volume - toujours visible */}
      <button
        onClick={handleMuteToggle}
        className={`glass rounded-lg p-1.5 transition-all duration-200 ${
          isHovered ? 'glow-blue scale-110' : ''
        }`}
        title={volume === 0 ? 'Réactiver le son' : 'Muet'}
      >
        <span className="text-base">{getVolumeIcon()}</span>
      </button>
    </div>
  );
}
