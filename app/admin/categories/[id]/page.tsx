'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Category } from '@/types';

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

export default function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('film');
  const [color, setColor] = useState('#4a90d9');
  const [rankedEnabled, setRankedEnabled] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategory = async () => {
      try {
        const res = await fetch(`/api/admin/categories/${id}`);
        if (res.ok) {
          const data = await res.json();
          setCategory(data);
          setName(data.name);
          setIcon(data.icon);
          setColor(data.color);
          setRankedEnabled(data.rankedEnabled ?? true);
        } else {
          setError('Catégorie non trouvée');
        }
      } catch {
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    loadCategory();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, color, rankedEnabled }),
      });

      if (res.ok) {
        router.push('/admin/categories');
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la mise à jour');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
          <span className="text-white">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-red-400 mb-4">{error || 'Catégorie non trouvée'}</p>
        <Link href="/admin/categories" className="btn-aero px-6 py-3 text-white rounded-xl">
          Retour aux catégories
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/categories" className="text-white/60 hover:text-white transition-colors">
          ← Retour aux catégories
        </Link>
        <h2 className="text-2xl font-bold text-white mt-2">Modifier la catégorie</h2>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-xl p-6 space-y-6 max-w-xl">
        {error && (
          <div className="p-3 rounded-lg border border-red-500/50 bg-red-500/10 text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
            ID (non modifiable)
          </label>
          <input
            type="text"
            value={id}
            disabled
            className="input-aero w-full px-4 py-3 text-white/50 rounded-xl font-mono cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
            Nom de la catégorie *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Films"
            className="input-aero w-full px-4 py-3 text-white rounded-xl"
            required
          />
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

        <div>
          <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
            Incluse dans les ranked
          </label>
          <button
            type="button"
            onClick={() => setRankedEnabled(!rankedEnabled)}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${rankedEnabled ? 'bg-green-500' : 'bg-white/20'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${rankedEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
          </button>
          <p className="text-white/40 text-xs mt-1">
            {rankedEnabled ? 'Activée — apparaît dans les parties ranked' : 'Désactivée — exclue des parties ranked'}
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-aero-green px-6 py-3 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
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
