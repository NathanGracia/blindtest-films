'use client';

import { useState, useEffect } from 'react';

export default function DeterminossNotif() {
  const [frameJpeg, setFrameJpeg] = useState<string | null>(null);

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

  if (!frameJpeg) return null;

  return (
    <a
      href="https://determinoss.nathangracia.com"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-50 block group"
    >
      <div className="glass rounded-xl overflow-hidden border-2 border-white/20 group-hover:border-[#7ec8e3]/60 transition-all group-hover:scale-105 shadow-lg">
        <div className="px-3 py-1.5 text-xs text-white/50 text-center border-b border-white/10 group-hover:text-white/70 transition-colors">
          Seedé par Determinoss
        </div>
        <img
          src={`data:image/jpeg;base64,${frameJpeg}`}
          alt="Lava lamp live"
          className="block w-48"
        />
      </div>
    </a>
  );
}
