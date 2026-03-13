'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  gameStartKey: number;
}

export default function DeterminossNotif({ gameStartKey }: Props) {
  const [frameJpeg, setFrameJpeg] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFrame = async () => {
    try {
      const res = await fetch('/api/determinoss');
      if (!res.ok) return;
      const data = await res.json();
      if (data.frame_jpeg) setFrameJpeg(data.frame_jpeg);
    } catch {}
  };

  useEffect(() => {
    fetchFrame();
    const interval = setInterval(fetchFrame, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Afficher 5s au début de chaque game
  useEffect(() => {
    if (gameStartKey === 0) return;
    setVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), 5000);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [gameStartKey]);

  if (!frameJpeg || !visible) return null;

  return (
    <a
      href="https://determinoss.nathangracia.com"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-50 block group"
      onClick={() => setVisible(false)}
    >
      <div className="glass rounded-xl overflow-hidden border-2 border-white/20 group-hover:border-[#7ec8e3]/60 transition-all group-hover:scale-105 shadow-lg">
        <div className="px-3 py-2 text-sm text-white/60 text-center border-b border-white/10 group-hover:text-white/80 transition-colors font-medium">
          Seedé par Determinoss
        </div>
        <img
          src={`data:image/jpeg;base64,${frameJpeg}`}
          alt="Lava lamp live"
          className="block w-64"
        />
      </div>
    </a>
  );
}
