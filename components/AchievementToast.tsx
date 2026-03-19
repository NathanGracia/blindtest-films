'use client';

import { useEffect, useState } from 'react';

interface Achievement {
  code: string;
  name: string;
  description: string;
  icon: string;
}

interface Props {
  achievements: Achievement[];
  onDismiss: (code: string) => void;
}

export default function AchievementToast({ achievements, onDismiss }: Props) {
  return (
    <div className="fixed bottom-24 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {achievements.map(a => (
        <AchievementItem key={a.code} achievement={a} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function AchievementItem({ achievement, onDismiss }: { achievement: Achievement; onDismiss: (code: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Apparition
    requestAnimationFrame(() => setVisible(true));
    // Disparition après 4s
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(achievement.code), 400);
    }, 4000);
    return () => clearTimeout(t);
  }, [achievement.code, onDismiss]);

  return (
    <div
      className={`pointer-events-auto transition-all duration-400 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
      }`}
    >
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 border border-[#7ec8e3]/30 shadow-[0_0_20px_rgba(126,200,227,0.15)]"
        style={{ minWidth: 260 }}>
        <span className="text-3xl">{achievement.icon}</span>
        <div className="flex flex-col min-w-0">
          <span className="text-[#7ec8e3] text-xs font-semibold uppercase tracking-wide">Succès débloqué !</span>
          <span className="text-white font-bold text-sm leading-tight">{achievement.name}</span>
          <span className="text-white/50 text-xs leading-tight">{achievement.description}</span>
        </div>
      </div>
    </div>
  );
}
