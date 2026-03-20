'use client';

import { useEffect, useRef, useState } from 'react';

interface Achievement {
  code: string;
  name: string;
  description: string;
  icon: string;
  imageFile?: string | null;
}

interface Props {
  achievements: Achievement[];
  onDismiss: (code: string) => void;
}

export default function AchievementToast({ achievements, onDismiss }: Props) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      {achievements.map(a => (
        <AchievementItem key={a.code} achievement={a} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const DURATION = 5000;

function playAchievementSound() {
  try {
    const ctx = new AudioContext();
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6 — arpège montant
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const start = ctx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch { /* silently fail if audio not available */ }
}

function AchievementItem({ achievement, onDismiss }: { achievement: Achievement; onDismiss: (code: string) => void }) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; });

  useEffect(() => {
    playAchievementSound();
    const t1 = setTimeout(() => setPhase('visible'), 20);
    const t2 = setTimeout(() => setPhase('exit'), DURATION - 400);
    const t3 = setTimeout(() => onDismissRef.current(achievement.code), DURATION);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [achievement.code]);

  const visible = phase === 'visible';

  return (
    <div
      className="pointer-events-auto"
      style={{
        width: 310,
        transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
        opacity: visible ? 1 : 0,
        transition: visible
          ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease'
          : 'transform 0.35s ease-in, opacity 0.35s ease-in',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(0, 30, 40, 0.55) 0%, rgba(0, 25, 35, 0.35) 50%, rgba(0, 20, 30, 0.2) 100%)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.1)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Reflet vitré supérieur */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 38,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 100%)',
          borderRadius: '14px 14px 0 0',
          pointerEvents: 'none',
          zIndex: 1,
        }} />

        {/* Bandeau header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '7px 13px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(126, 200, 227, 0.08)',
          position: 'relative', zIndex: 2,
        }}>
          {/* Étoile */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(126,200,227,0.85)">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '0.13em',
            textTransform: 'uppercase',
            color: 'rgba(126, 200, 227, 0.85)',
          }}>
            Succès débloqué
          </span>
        </div>

        {/* Corps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 13px 13px', position: 'relative', zIndex: 2 }}>
          {/* Icône */}
          <div style={{
            width: 46, height: 46, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 10,
            fontSize: 26,
            position: 'relative',
            boxShadow: achievement.imageFile
              ? '0 0 0 1.5px rgba(0,0,0,0.25), 0 0 0 2.5px rgba(255,255,255,0.20), 0 2px 6px rgba(0,0,0,0.35)'
              : 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            {achievement.imageFile ? (
              <>
                <img src={achievement.imageFile} alt={achievement.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                {/* Reflet vitré style PP */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: '50%',
                  borderRadius: '10px 10px 0 0',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.04) 100%)',
                  pointerEvents: 'none',
                }} />
              </>
            ) : achievement.icon}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.95)',
              lineHeight: 1.25,
              marginBottom: 3,
              textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}>
              {achievement.name}
            </div>
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 1.35,
            }}>
              {achievement.description}
            </div>
          </div>
        </div>

        {/* Barre de progression */}
        <ProgressBar duration={DURATION} phase={phase} />
      </div>
    </div>
  );
}

function ProgressBar({ duration, phase }: { duration: number; phase: string }) {
  const [width, setWidth] = useState(100);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (phase !== 'visible') return;
    const start = Date.now();
    const total = duration - 420;

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / total) * 100);
      setWidth(pct);
      if (pct > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, duration]);

  return (
    <div style={{ height: 2, background: 'rgba(255,255,255,0.07)' }}>
      <div style={{
        height: '100%',
        width: `${width}%`,
        background: 'linear-gradient(90deg, rgba(74,144,217,0.7), rgba(126,200,227,0.9))',
        boxShadow: '0 0 5px rgba(126,200,227,0.4)',
      }} />
    </div>
  );
}
