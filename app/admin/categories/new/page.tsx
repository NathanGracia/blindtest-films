'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ICONS = [
  { value: 'film', label: '🎬 Film' },
  { value: 'tv', label: '📺 Série' },
  { value: 'gamepad', label: '🎮 Jeu vidéo' },
  { value: 'sparkles', label: '✨ Anime' },
  { value: 'music', label: '🎵 Musique' },
  { value: 'globe', label: '🌍 Autre' },
];

const COLORS = [
  '#4a90d9',
  '#7ec8e3',
  '#7fba00',
  '#00b4d8',
  '#e74c3c',
  '#9b59b6',
  '#f39c12',
  '#1abc9c',
];

export default function NewCategoryPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [icon, setIcon] = useState('film');
  const [color, setColor] = useState('#4a90d9');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generateId = (value: string) => {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!id || id === generateId(name)) {
      setId(generateId(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, icon, color }),
      });

      if (res.ok) {
        router.push('/admin/categories');
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la création');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/categories" className="text-white/60 hover:text-white transition-colors">
          ← Retour aux catégories
        </Link>
        <h2 className="text-2xl font-bold text-white mt-2">Nouvelle catégorie</h2>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-xl p-6 space-y-6 max-w-xl">
        {error && (
          <div className="p-3 rounded-lg border border-red-500/50 bg-red-500/10 text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
            Nom de la catégorie *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ex: Films"
            className="input-aero w-full px-4 py-3 text-white rounded-xl"
            required
          />
        </div>

        <div>
          <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
            ID (identifiant unique) *
          </label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(generateId(e.target.value))}
            placeholder="Ex: films"
            className="input-aero w-full px-4 py-3 text-white rounded-xl font-mono"
            required
          />
          <p className="text-white/40 text-xs mt-1">
            Lettres minuscules, chiffres et tirets uniquement
          </p>
        </div>

        <div>
          <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
            Icône
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ICONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setIcon(item.value)}
                className={`
                  p-3 rounded-lg border transition-all
                  ${icon === item.value
                    ? 'border-[#4a90d9] bg-[#4a90d9]/20 text-white'
                    : 'border-white/10 text-white/60 hover:border-white/30'
                  }
                `}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
            Couleur
          </label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`
                  w-10 h-10 rounded-lg transition-all
                  ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''}
                `}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-aero-green px-6 py-3 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {isLoading ? 'Création...' : 'Créer la catégorie'}
          </button>
          <Link
            href="/admin/categories"
            className="btn-aero px-6 py-3 text-white rounded-xl"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
