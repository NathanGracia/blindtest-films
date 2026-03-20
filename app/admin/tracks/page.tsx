'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Track, Category } from '@/types';

interface CategoryWithCount extends Category {
  trackCount: number;
}

type SortField = 'title' | 'category' | 'reports' | 'default';
type SortDirection = 'asc' | 'desc';
type DifficultyFilter = '' | 'untagged' | 'easy' | 'medium' | 'hard';

interface Report {
  id: number;
  trackId: number;
  message: string;
  createdAt: string;
}

const DIFFICULTY_CONFIG = {
  easy:   { label: 'Facile',    color: '#7fba00' },
  medium: { label: 'Moyen',     color: '#f5a623' },
  hard:   { label: 'Difficile', color: '#e8445a' },
} as const;

export default function TracksPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [reloadingCache, setReloadingCache] = useState(false);

  const [filter, setFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('');
  const [searchQuery, setSearchQuery] = useState('');

  const [sortField, setSortField] = useState<SortField>('default');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const [expandedReports, setExpandedReports] = useState<number | null>(null);
  const [reportsData, setReportsData] = useState<Record<number, Report[]>>({});
  const [reportsLoading, setReportsLoading] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

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
    } catch {
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
      if (tracksRes.ok) setTracks(await tracksRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
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

  const toggleReports = async (trackId: number) => {
    if (expandedReports === trackId) { setExpandedReports(null); return; }
    setExpandedReports(trackId);
    if (!reportsData[trackId]) {
      setReportsLoading(trackId);
      try {
        const res = await fetch(`/api/admin/tracks/${trackId}/reports`);
        if (res.ok) { const data = await res.json(); setReportsData(prev => ({ ...prev, [trackId]: data })); }
      } finally {
        setReportsLoading(null);
      }
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
        setTracks(tracks.map(t => t.id === id ? { ...t, reportCount: 0 } : t));
        setReportsData(prev => ({ ...prev, [id]: [] }));
        setExpandedReports(null);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors du reset');
      }
    } catch {
      setError('Erreur de connexion');
    }
  };

  const handleSetDifficulty = async (id: number, difficulty: 'easy' | 'medium' | 'hard' | null) => {
    setTracks(tracks.map(t => t.id === id ? { ...t, difficulty } : t));
    try {
      await fetch(`/api/admin/tracks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-difficulty', difficulty }),
      });
    } catch {
      loadData();
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const { filteredTracks, totalPages, displayRange } = useMemo(() => {
    let result = [...tracks];
    if (filter) result = result.filter(t => t.categoryId === filter);
    if (difficultyFilter === 'untagged') result = result.filter(t => !t.difficulty);
    else if (difficultyFilter) result = result.filter(t => t.difficulty === difficultyFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.titleVF?.toLowerCase().includes(q));
    }
    if (sortField !== 'default') {
      result.sort((a, b) => {
        let aVal: string | number, bVal: string | number;
        if (sortField === 'title') { aVal = a.title.toLowerCase(); bVal = b.title.toLowerCase(); }
        else if (sortField === 'category') {
          aVal = categories.find(c => c.id === a.categoryId)?.name.toLowerCase() || '';
          bVal = categories.find(c => c.id === b.categoryId)?.name.toLowerCase() || '';
        } else { aVal = a.reportCount || 0; bVal = b.reportCount || 0; }
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    const total = result.length;
    const pages = Math.ceil(total / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const paginated = result.slice(start, start + itemsPerPage);
    return { filteredTracks: paginated, totalPages: pages, displayRange: { start: start + 1, end: Math.min(start + itemsPerPage, total), total } };
  }, [tracks, filter, difficultyFilter, searchQuery, sortField, sortDirection, currentPage, categories]);

  useEffect(() => { setCurrentPage(1); }, [filter, difficultyFilter, searchQuery]);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Musiques</h2>
          <p className="text-white/60">Gérez les musiques du BlindToss</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reloadCache}
            disabled={reloadingCache}
            title="Recharger le cache serveur (tracks en mémoire pour le système de vies)"
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: 'rgba(127,186,0,0.15)', color: '#7fba00', border: '1px solid rgba(127,186,0,0.3)' }}
          >
            {reloadingCache ? '⏳ Rechargement...' : '🔄 Recharger cache'}
          </button>
          <Link
            href="/admin/tracks/new"
            className="btn-aero-green px-6 py-3 text-white font-semibold rounded-xl"
          >
            + Nouvelle musique
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div className="glass rounded-xl p-4 space-y-4">
        <input
          type="text"
          placeholder="🔍 Rechercher par titre (VO ou VF)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-white/10 text-white placeholder-white/40 border border-white/10 focus:border-[#7ec8e3] focus:outline-none transition-colors"
        />

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-white/40 text-xs uppercase tracking-wider">Catégorie</span>
          <button
            onClick={() => setFilter('')}
            className={`px-3 py-1 rounded-lg text-sm transition-all ${filter === '' ? 'bg-[#4a90d9] text-white' : 'text-white/60 hover:text-white'}`}
          >
            Toutes ({tracks.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className="px-3 py-1 rounded-lg text-sm transition-all"
              style={{
                backgroundColor: filter === cat.id ? cat.color : 'transparent',
                color: filter === cat.id ? '#fff' : 'rgba(255,255,255,0.6)',
              }}
            >
              {cat.name} ({cat.trackCount})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-white/40 text-xs uppercase tracking-wider">Difficulté</span>
          {([
            { value: '', label: 'Toutes', color: '#4a90d9' },
            { value: 'untagged', label: 'Non taggué', color: '#888' },
            { value: 'easy', label: 'Facile', color: '#7fba00' },
            { value: 'medium', label: 'Moyen', color: '#f5a623' },
            { value: 'hard', label: 'Difficile', color: '#e8445a' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => setDifficultyFilter(opt.value as DifficultyFilter)}
              className="px-3 py-1 rounded-lg text-sm transition-all"
              style={{
                backgroundColor: difficultyFilter === opt.value ? opt.color : 'transparent',
                color: difficultyFilter === opt.value ? '#fff' : 'rgba(255,255,255,0.6)',
              }}
            >
              {opt.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => handleSort('title')}
              className={`px-3 py-1 rounded-lg text-sm transition-all flex items-center gap-1 ${sortField === 'title' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}
            >
              A–Z {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('reports')}
              className={`px-3 py-1 rounded-lg text-sm transition-all flex items-center gap-1 ${sortField === 'reports' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}
            >
              Reports {sortField === 'reports' && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
            {(searchQuery || filter || difficultyFilter) && (
              <button
                onClick={() => { setSearchQuery(''); setFilter(''); setDifficultyFilter(''); }}
                className="text-[#7ec8e3] hover:text-white text-sm transition-colors"
              >
                ✕ Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="glass rounded-lg border border-red-500/50 p-4 text-red-400">{error}</div>
      )}

      {displayRange && (
        <p className="text-white/40 text-sm px-1">
          {displayRange.start}–{displayRange.end} sur {displayRange.total} track{displayRange.total > 1 ? 's' : ''}
        </p>
      )}

      {/* Grille de cards */}
      {filteredTracks.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-white/40 mb-4">{searchQuery || filter ? 'Aucun résultat' : 'Aucune musique'}</p>
          {!searchQuery && !filter && (
            <Link href="/admin/tracks/new" className="btn-aero px-6 py-3 text-white rounded-xl inline-block">
              Ajouter une musique
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {filteredTracks.map(track => {
            const category = categories.find(c => c.id === track.categoryId);
            const diff = track.difficulty ? DIFFICULTY_CONFIG[track.difficulty] : null;
            const reportCount = track.reportCount || 0;
            const isDeleting = deleteId === track.id;
            const isReportsOpen = expandedReports === track.id;

            return (
              <div
                key={track.id}
                className="group relative rounded-xl overflow-hidden flex flex-col"
                style={{ aspectRatio: '2/3', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
              >
                {/* Image fond */}
                {track.imageFile ? (
                  <img src={track.imageFile} alt={track.title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <span className="text-4xl opacity-10">🎵</span>
                  </div>
                )}

                {/* Barre catégorie en haut */}
                <div
                  className="relative z-10 shrink-0"
                  style={{ height: 3, background: category ? `linear-gradient(90deg, ${category.color}dd, ${category.color}33)` : 'rgba(255,255,255,0.1)' }}
                />

                {/* Badges flottants (hors hover) */}
                <div className="relative z-10 flex items-start justify-between px-2 pt-2 shrink-0">
                  {diff ? (
                    <span
                      className="text-xs font-bold px-1.5 py-0.5 rounded leading-none"
                      style={{ background: `${diff.color}33`, color: diff.color, border: `1px solid ${diff.color}55` }}
                    >
                      {diff.label}
                    </span>
                  ) : <span />}
                  {reportCount > 0 && (
                    <button
                      onClick={() => toggleReports(track.id)}
                      className="text-xs font-bold px-1.5 py-0.5 rounded leading-none transition-all"
                      style={{ background: 'rgba(232,68,90,0.3)', color: '#e8445a', border: '1px solid rgba(232,68,90,0.5)' }}
                    >
                      ⚑ {reportCount}
                    </button>
                  )}
                </div>

                {/* Spacer */}
                <div className="flex-1 relative z-10" />

                {/* Overlay infos (toujours visible) */}
                <div
                  className="relative z-10 px-2.5 pt-2 pb-2.5 group-hover:pb-1 transition-all"
                  style={{
                    background: 'linear-gradient(180deg, rgba(0,10,15,0) 0%, rgba(0,10,15,0.7) 25%, rgba(0,10,15,0.9) 100%)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{track.title}</p>
                  {track.titleVF && (
                    <p className="text-white/40 text-xs leading-tight line-clamp-1 mt-0.5">{track.titleVF}</p>
                  )}
                  {category && (
                    <span className="text-xs mt-1 block" style={{ color: `${category.color}cc` }}>
                      {category.name}
                    </span>
                  )}
                </div>

                {/* Overlay actions (visible au hover) */}
                <div
                  className="absolute inset-0 z-20 flex flex-col justify-end p-2.5 gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ background: 'linear-gradient(180deg, rgba(0,10,20,0.15) 0%, rgba(0,10,20,0.85) 55%, rgba(0,10,20,0.97) 100%)' }}
                >
                  {/* Difficulté */}
                  <div className="flex items-center gap-1.5 justify-center">
                    {(['easy', 'medium', 'hard'] as const).map(d => {
                      const cfg = DIFFICULTY_CONFIG[d];
                      const isActive = track.difficulty === d;
                      return (
                        <button
                          key={d}
                          onClick={() => handleSetDifficulty(track.id, isActive ? null : d)}
                          title={cfg.label}
                          className="px-2 py-0.5 rounded text-xs font-bold transition-all"
                          style={{
                            background: isActive ? `${cfg.color}33` : 'rgba(255,255,255,0.08)',
                            color: isActive ? cfg.color : 'rgba(255,255,255,0.3)',
                            border: `1px solid ${isActive ? cfg.color + '55' : 'rgba(255,255,255,0.1)'}`,
                          }}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Actions principales */}
                  {isDeleting ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleDelete(track.id)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                        style={{ background: 'rgba(232,68,90,0.5)', border: '1px solid rgba(232,68,90,0.6)' }}
                      >
                        ✓ Confirmer
                      </button>
                      <button
                        onClick={() => setDeleteId(null)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:text-white transition-all"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <Link
                        href={`/admin/tracks/${track.id}`}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-center transition-all"
                        style={{ background: 'rgba(74,144,217,0.25)', color: '#7ec8e3', border: '1px solid rgba(74,144,217,0.35)' }}
                      >
                        Modifier
                      </Link>
                      <button
                        onClick={() => setDeleteId(track.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: 'rgba(232,68,90,0.15)', color: 'rgba(232,68,90,0.7)', border: '1px solid rgba(232,68,90,0.2)' }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Panel reports (expandable) */}
                {isReportsOpen && (
                  <div
                    className="absolute inset-0 z-30 flex flex-col p-3 overflow-y-auto"
                    style={{ background: 'rgba(0,5,10,0.95)', backdropFilter: 'blur(10px)' }}
                  >
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <span className="text-red-400 text-xs font-bold">⚑ Signalements ({reportCount})</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResetReports(track.id)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => setExpandedReports(null)}
                          className="text-white/50 hover:text-white text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 overflow-y-auto">
                      {reportsLoading === track.id ? (
                        <p className="text-white/30 text-xs">Chargement...</p>
                      ) : (reportsData[track.id] || []).length === 0 ? (
                        <p className="text-white/30 text-xs italic">Aucun message</p>
                      ) : (reportsData[track.id] || []).map(r => (
                        <div key={r.id} className="text-xs" style={{ borderLeft: '2px solid rgba(232,68,90,0.4)', paddingLeft: 8 }}>
                          <p className="text-white/30 mb-0.5">
                            {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-white/70">{r.message || <span className="italic text-white/20">sans message</span>}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-lg transition-colors ${currentPage === 1 ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              ← Précédent
            </button>
            <div className="flex items-center gap-2">
              {currentPage > 3 && (
                <>
                  <button onClick={() => setCurrentPage(1)} className="w-10 h-10 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">1</button>
                  {currentPage > 4 && <span className="text-white/40">…</span>}
                </>
              )}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-10 h-10 rounded-lg transition-colors ${currentPage === p ? 'bg-[#7ec8e3] text-white font-semibold' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    {p}
                  </button>
                );
              })}
              {currentPage < totalPages - 2 && (
                <>
                  {currentPage < totalPages - 3 && <span className="text-white/40">…</span>}
                  <button onClick={() => setCurrentPage(totalPages)} className="w-10 h-10 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">{totalPages}</button>
                </>
              )}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded-lg transition-colors ${currentPage === totalPages ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
