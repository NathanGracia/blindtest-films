'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Track, Category } from '@/types';

interface CategoryWithCount extends Category {
  trackCount: number;
}

type SortField = 'title' | 'category' | 'reports' | 'default';
type SortDirection = 'asc' | 'desc';
type DifficultyFilter = '' | 'untagged' | 'easy' | 'medium' | 'hard';

const DIFFICULTY_CONFIG = {
  easy:   { label: 'Facile',  color: '#7fba00', dot: '🟢' },
  medium: { label: 'Moyen',   color: '#f5a623', dot: '🟡' },
  hard:   { label: 'Difficile', color: '#e74c3c', dot: '🔴' },
} as const;

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [reloadingCache, setReloadingCache] = useState(false);

  // Filtres et recherche
  const [filter, setFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Tri
  const [sortField, setSortField] = useState<SortField>('default');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    loadData();
  }, []);

  const reloadCache = async () => {
    setReloadingCache(true);
    setError('');
    try {
      const res = await fetch('/api/admin/reload-cache', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        alert(`✅ Cache rechargé ! ${data.tracksCount} tracks chargés.`);
      } else {
        setError(data.error || 'Erreur lors du rechargement');
      }
    } catch (err) {
      setError('Erreur réseau lors du rechargement du cache');
    } finally {
      setReloadingCache(false);
    }
  };

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

  const handleResetReports = async (id: number) => {
    setError('');
    try {
      const res = await fetch(`/api/admin/tracks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-reports' }),
      });

      if (res.ok) {
        // Mettre à jour le track dans la liste
        setTracks(tracks.map(t =>
          t.id === id ? { ...t, reportCount: 0 } : t
        ));
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors du reset');
      }
    } catch {
      setError('Erreur de connexion');
    }
  };

  const handleSetDifficulty = async (id: number, difficulty: 'easy' | 'medium' | 'hard' | null) => {
    // Mise à jour optimiste
    setTracks(tracks.map(t => t.id === id ? { ...t, difficulty } : t));
    try {
      await fetch(`/api/admin/tracks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-difficulty', difficulty }),
      });
    } catch {
      // En cas d'erreur, recharger les données
      loadData();
    }
  };

  // Fonction de tri
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtrage, recherche, tri et pagination
  const { filteredTracks, totalPages, displayRange } = useMemo(() => {
    let result = [...tracks];

    // Filtrer par catégorie
    if (filter) {
      result = result.filter(t => t.categoryId === filter);
    }

    // Filtrer par difficulté
    if (difficultyFilter === 'untagged') {
      result = result.filter(t => !t.difficulty);
    } else if (difficultyFilter) {
      result = result.filter(t => t.difficulty === difficultyFilter);
    }

    // Recherche par titre
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.titleVF?.toLowerCase().includes(query)
      );
    }

    // Tri
    if (sortField !== 'default') {
      result.sort((a, b) => {
        let aVal: any, bVal: any;

        switch (sortField) {
          case 'title':
            aVal = a.title.toLowerCase();
            bVal = b.title.toLowerCase();
            break;
          case 'category':
            const catA = categories.find(c => c.id === a.categoryId);
            const catB = categories.find(c => c.id === b.categoryId);
            aVal = catA?.name.toLowerCase() || '';
            bVal = catB?.name.toLowerCase() || '';
            break;
          case 'reports':
            aVal = a.reportCount || 0;
            bVal = b.reportCount || 0;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Pagination
    const total = result.length;
    const pages = Math.ceil(total / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginated = result.slice(start, end);

    return {
      filteredTracks: paginated,
      totalPages: pages,
      totalItems: total,
      displayRange: { start: start + 1, end: Math.min(end, total), total }
    };
  }, [tracks, filter, difficultyFilter, searchQuery, sortField, sortDirection, currentPage, itemsPerPage, categories]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, difficultyFilter, searchQuery, itemsPerPage]);

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
          <p className="text-white/60">Gérez les musiques du BlindToss</p>
        </div>
        <Link
          href="/admin/tracks/new"
          className="btn-aero-green px-6 py-3 text-white font-semibold rounded-xl"
        >
          + Nouvelle musique
        </Link>
      </div>

      {/* Filtres et recherche */}
      <div className="glass rounded-xl p-4 space-y-4">
        {/* Barre de recherche */}
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Rechercher par titre (VO ou VF)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/10 text-white placeholder-white/40 border border-white/10 focus:border-[#7ec8e3] focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={reloadCache}
            disabled={reloadingCache}
            className="px-4 py-2 rounded-lg bg-[#7fba00] text-white font-semibold hover:bg-[#6fa000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            title="Le serveur garde tous les tracks en mémoire pour vérifier les réponses (système de vies). Ce cache est chargé au démarrage — cliquez ici pour le mettre à jour après avoir ajouté des tracks, sans avoir à redémarrer le serveur."
          >
            {reloadingCache ? '⏳ Rechargement...' : '🔄 Recharger cache'}
          </button>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="px-4 py-2 rounded-lg bg-white/10 text-white border border-white/10 focus:border-[#7ec8e3] focus:outline-none transition-colors"
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>

        {/* Filtres catégories */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-white/60 text-sm">Catégorie :</span>
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

        {/* Filtres difficulté */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-white/60 text-sm">Difficulté :</span>
          {([
            { value: '', label: 'Toutes' },
            { value: 'untagged', label: 'Non taggué' },
            { value: 'easy', label: 'Facile', color: '#7fba00' },
            { value: 'medium', label: 'Moyen', color: '#f5a623' },
            { value: 'hard', label: 'Difficile', color: '#e74c3c' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setDifficultyFilter(opt.value as DifficultyFilter)}
              className={`px-3 py-1 rounded-lg text-sm transition-all ${
                difficultyFilter === opt.value ? 'text-white' : 'text-white/60 hover:text-white'
              }`}
              style={{
                backgroundColor: difficultyFilter === opt.value
                  ? ('color' in opt ? opt.color : '#4a90d9')
                  : 'transparent',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass rounded-lg border border-red-500/50 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Stats */}
      {displayRange && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">
              Affichage de {displayRange.start} à {displayRange.end} sur {displayRange.total} résultat{displayRange.total > 1 ? 's' : ''}
            </span>
            {(searchQuery || filter || difficultyFilter) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilter('');
                  setDifficultyFilter('');
                }}
                className="text-[#7ec8e3] hover:text-white transition-colors"
              >
                ✕ Réinitialiser les filtres
              </button>
            )}
          </div>
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        {filteredTracks.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-white/60 mb-4">
              {searchQuery || filter ? 'Aucun résultat trouvé' : 'Aucune musique'}
            </p>
            {!searchQuery && !filter && (
              <Link
                href="/admin/tracks/new"
                className="btn-aero px-6 py-3 text-white rounded-xl inline-block"
              >
                Ajouter une musique
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th
                  onClick={() => handleSort('title')}
                  className="text-left p-4 text-white/60 font-medium cursor-pointer hover:text-white transition-colors select-none"
                >
                  <div className="flex items-center gap-2">
                    Titre
                    {sortField === 'title' && (
                      <span className="text-[#7ec8e3]">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="text-left p-4 text-white/60 font-medium cursor-pointer hover:text-white transition-colors select-none"
                >
                  <div className="flex items-center gap-2">
                    Catégorie
                    {sortField === 'category' && (
                      <span className="text-[#7ec8e3]">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="text-left p-4 text-white/60 font-medium">Audio</th>
                <th className="text-left p-4 text-white/60 font-medium">Image</th>
                <th className="text-left p-4 text-white/60 font-medium">Difficulté</th>
                <th
                  onClick={() => handleSort('reports')}
                  className="text-left p-4 text-white/60 font-medium cursor-pointer hover:text-white transition-colors select-none"
                >
                  <div className="flex items-center gap-2">
                    Reports
                    {sortField === 'reports' && (
                      <span className="text-[#7ec8e3]">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
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
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {(['easy', 'medium', 'hard'] as const).map((d) => {
                          const cfg = DIFFICULTY_CONFIG[d];
                          const isActive = track.difficulty === d;
                          return (
                            <button
                              key={d}
                              onClick={() => handleSetDifficulty(track.id, isActive ? null : d)}
                              title={cfg.label}
                              className="w-7 h-7 rounded text-sm transition-all"
                              style={{
                                opacity: isActive ? 1 : 0.3,
                                backgroundColor: isActive ? `${cfg.color}30` : 'transparent',
                              }}
                            >
                              {cfg.dot}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {(track.reportCount || 0) > 0 ? (
                          <>
                            <span className="px-2 py-1 rounded text-sm bg-red-500/20 text-red-400 font-medium">
                              {track.reportCount}
                            </span>
                            <button
                              onClick={() => handleResetReports(track.id)}
                              className="px-2 py-1 text-xs rounded bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
                              title="Réinitialiser les signalements"
                            >
                              ↻
                            </button>
                          </>
                        ) : (
                          <span className="text-white/40">0</span>
                        )}
                      </div>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentPage === 1
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              ← Précédent
            </button>

            <div className="flex items-center gap-2">
              {/* Première page */}
              {currentPage > 3 && (
                <>
                  <button
                    onClick={() => setCurrentPage(1)}
                    className="w-10 h-10 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                  >
                    1
                  </button>
                  {currentPage > 4 && <span className="text-white/40">...</span>}
                </>
              )}

              {/* Pages autour de la page courante */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-[#7ec8e3] text-white font-semibold'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Dernière page */}
              {currentPage < totalPages - 2 && (
                <>
                  {currentPage < totalPages - 3 && <span className="text-white/40">...</span>}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="w-10 h-10 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded-lg transition-colors ${
                currentPage === totalPages
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
