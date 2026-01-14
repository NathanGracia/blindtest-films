'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Track, Category } from '@/types';

interface CategoryWithCount extends Category {
  trackCount: number;
}

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tracksRes, catsRes] = await Promise.all([
        fetch('/api/admin/tracks'),
        fetch('/api/admin/categories'),
      ]);

      if (tracksRes.ok) {
        setTracks(await tracksRes.json());
      }
      if (catsRes.ok) {
        setCategories(await catsRes.json());
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError('');
    try {
      const res = await fetch(`/api/admin/tracks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTracks(tracks.filter(t => t.id !== id));
        setDeleteId(null);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la suppression');
      }
    } catch {
      setError('Erreur de connexion');
    }
  };

  const filteredTracks = filter
    ? tracks.filter(t => t.categoryId === filter)
    : tracks;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Musiques</h2>
          <p className="text-white/60">Gérez les musiques du blindtest</p>
        </div>
        <Link
          href="/admin/tracks/new"
          className="btn-aero-green px-6 py-3 text-white font-semibold rounded-xl"
        >
          + Nouvelle musique
        </Link>
      </div>

      {/* Filtres */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-white/60 text-sm">Filtrer par catégorie :</span>
          <button
            onClick={() => setFilter('')}
            className={`px-3 py-1 rounded-lg text-sm transition-all ${
              filter === '' ? 'bg-[#4a90d9] text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            Toutes ({tracks.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`px-3 py-1 rounded-lg text-sm transition-all ${
                filter === cat.id ? 'text-white' : 'text-white/60 hover:text-white'
              }`}
              style={{
                backgroundColor: filter === cat.id ? cat.color : 'transparent',
              }}
            >
              {cat.name} ({cat.trackCount})
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass rounded-lg border border-red-500/50 p-4 text-red-400">
          {error}
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        {filteredTracks.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-white/60 mb-4">
              {filter ? 'Aucune musique dans cette catégorie' : 'Aucune musique'}
            </p>
            <Link
              href="/admin/tracks/new"
              className="btn-aero px-6 py-3 text-white rounded-xl inline-block"
            >
              Ajouter une musique
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-white/60 font-medium">Titre</th>
                <th className="text-left p-4 text-white/60 font-medium">Catégorie</th>
                <th className="text-left p-4 text-white/60 font-medium">Audio</th>
                <th className="text-left p-4 text-white/60 font-medium">Image</th>
                <th className="text-right p-4 text-white/60 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTracks.map((track) => {
                const category = categories.find(c => c.id === track.categoryId);
                return (
                  <tr key={track.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {track.imageFile ? (
                          <img
                            src={track.imageFile}
                            alt={track.title}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
                            <span className="text-white/40">🎵</span>
                          </div>
                        )}
                        <span className="text-white font-medium">{track.title}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className="px-2 py-1 rounded text-sm"
                        style={{
                          backgroundColor: `${category?.color}30`,
                          color: category?.color,
                        }}
                      >
                        {category?.name || 'Sans catégorie'}
                      </span>
                    </td>
                    <td className="p-4">
                      {track.audioFile ? (
                        <span className="text-[#7fba00]">✓</span>
                      ) : (
                        <span className="text-red-400">✗</span>
                      )}
                    </td>
                    <td className="p-4">
                      {track.imageFile ? (
                        <span className="text-[#7fba00]">✓</span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/tracks/${track.id}`}
                          className="px-3 py-1 text-sm text-[#7ec8e3] hover:text-white transition-colors"
                        >
                          Modifier
                        </Link>
                        {deleteId === track.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(track.id)}
                              className="px-3 py-1 text-sm text-red-400 hover:text-red-300"
                            >
                              Confirmer
                            </button>
                            <button
                              onClick={() => setDeleteId(null)}
                              className="px-3 py-1 text-sm text-white/60 hover:text-white"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteId(track.id)}
                            className="px-3 py-1 text-sm text-red-400/70 hover:text-red-400 transition-colors"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
