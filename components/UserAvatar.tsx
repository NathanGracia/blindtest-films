'use client';

import Image from 'next/image';

interface Props {
  avatarFile?: string | null;
  pseudo?: string;
  size?: number;
  className?: string;
}

const PASTELS = [
  '#f28b82', // rouge doux
  '#fbbc04', // jaune
  '#34a853', // vert
  '#4a90d9', // bleu
  '#a142f4', // violet
  '#e67c73', // corail
  '#46bdc6', // cyan
  '#f6aea9', // rose
  '#ccff90', // vert lime
  '#aecbfa', // bleu clair
  '#d7aefb', // lavande
  '#fdcfe8', // rose pâle
  '#e6c9a8', // sable
  '#a8dab5', // menthe
];

function getPastelColor(pseudo: string): string {
  let hash = 0;
  for (let i = 0; i < pseudo.length; i++) {
    hash = pseudo.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PASTELS[Math.abs(hash) % PASTELS.length];
}

// Couleur de texte lisible selon le fond
function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#2d2d2d' : '#ffffff';
}

export default function UserAvatar({ avatarFile, pseudo = '?', size = 28, className = '' }: Props) {
  const radius = Math.round(size * 0.22);
  const bg = getPastelColor(pseudo);
  const fg = getTextColor(bg);
  const initial = pseudo[0]?.toUpperCase() ?? '?';
  const fontSize = Math.round(size * 0.42);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        boxShadow: `
          0 0 0 1.5px rgba(0,0,0,0.25),
          0 0 0 2.5px rgba(255,255,255,0.20),
          0 2px 6px rgba(0,0,0,0.35)
        `,
      }}
    >
      {/* Contenu */}
      <div
        className="w-full h-full overflow-hidden relative flex items-center justify-center"
        style={{ borderRadius: radius }}
      >
        {avatarFile ? (
          <Image src={avatarFile} alt={pseudo} fill className="object-cover" unoptimized />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-bold select-none"
            style={{ background: bg, color: fg, fontSize, lineHeight: 1 }}
          >
            {initial}
          </div>
        )}
      </div>

      {/* Reflet vitré */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: '50%',
          borderRadius: `${radius}px ${radius}px 0 0`,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.04) 100%)',
        }}
      />
    </div>
  );
}
