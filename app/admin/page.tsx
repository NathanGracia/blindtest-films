'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Category, Track } from '@/types';

interface CategoryWithCount extends Category {
  trackCount: number;
}

export default function AdminDashboard() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catRes, trackRes] = await Promise.all([
          fetch('/api/admin/categories'),
          fetch('/api/admin/tracks'),
        ]);

        if (catRes.ok) {
          setCategories(await catRes.json());
        }
        if (trackRes.ok) {
          setTracks(await trackRes.json());
        }
      } catch (error) {
        console.error('Erreur chargement données:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

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

  const totalTracks = tracks.length;
  const totalCategories = categories.length;
  const tracksWithImages = tracks.filter(t => t.imageFile).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Dashboard</h2>
        <p className="text-white/60">Vue d&apos;ensemble de votre contenu</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#4a90d9]/20 flex items-center justify-center">
              <span className="text-2xl">🎵</span>
            </div>
            <div>
              <p className="text-white/60 text-sm">Musiques</p>
              <p className="text-3xl font-bold text-white">{totalTracks}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#7fba00]/20 flex items-center justify-center">
              <span className="text-2xl">📁</span>
            </div>
            <div>
              <p className="text-white/60 text-sm">Catégories</p>
              <p className="text-3xl font-bold text-white">{totalCategories}</p>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#00b4d8]/20 flex items-center justify-center">
              <span className="text-2xl">🖼️</span>
            </div>
            <div>
              <p className="text-white/60 text-sm">Avec images</p>
              <p className="text-3xl font-bold text-white">
                {tracksWithImages}/{totalTracks}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Categories breakdown */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Catégories</h3>
          <Link
            href="/admin/categories/new"
            className="btn-aero px-4 py-2 text-white text-sm rounded-lg"
          >
            + Ajouter
          </Link>
        </div>

        {categories.length === 0 ? (
          <p className="text-white/60 text-center py-4">
            Aucune catégorie. Commencez par en créer une !
          </p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/admin/categories/${category.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-white">{category.name}</span>
                </div>
                <span className="text-white/60 text-sm">
                  {category.trackCount} musique{category.trackCount > 1 ? 's' : ''}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent tracks */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Musiques récentes</h3>
          <Link
            href="/admin/tracks/new"
            className="btn-aero px-4 py-2 text-white text-sm rounded-lg"
          >
            + Ajouter
          </Link>
        </div>

        {tracks.length === 0 ? (
          <p className="text-white/60 text-center py-4">
            Aucune musique. Commencez par en ajouter une !
          </p>
        ) : (
          <div className="space-y-2">
            {tracks.slice(0, 5).map((track) => {
              const category = categories.find(c => c.id === track.categoryId);
              return (
                <Link
                  key={track.id}
                  href={`/admin/tracks/${track.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {track.imageFile ? (
                      <div className="w-10 h-10 rounded bg-white/10 overflow-hidden">
                        <img
                          src={track.imageFile}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
                        <span className="text-white/40">🎵</span>
                      </div>
                    )}
                    <span className="text-white">{track.title}</span>
                  </div>
                  <span
                    className="text-sm px-2 py-1 rounded"
                    style={{ backgroundColor: `${category?.color}30`, color: category?.color }}
                  >
                    {category?.name || 'Sans catégorie'}
                  </span>
                </Link>
              );
            })}
            {tracks.length > 5 && (
              <Link
                href="/admin/tracks"
                className="block text-center text-[#7ec8e3] hover:text-white transition-colors py-2"
              >
                Voir toutes les musiques →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
