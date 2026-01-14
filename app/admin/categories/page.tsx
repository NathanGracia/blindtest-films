'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Category } from '@/types';

interface CategoryWithCount extends Category {
  trackCount: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories');
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories(categories.filter(c => c.id !== id));
        setDeleteId(null);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la suppression');
      }
    } catch {
      setError('Erreur de connexion');
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Catégories</h2>
          <p className="text-white/60">Gérez les catégories de musiques</p>
        </div>
        <Link
          href="/admin/categories/new"
          className="btn-aero-green px-6 py-3 text-white font-semibold rounded-xl"
        >
          + Nouvelle catégorie
        </Link>
      </div>

      {error && (
        <div className="glass rounded-lg border border-red-500/50 p-4 text-red-400">
          {error}
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        {categories.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-white/60 mb-4">Aucune catégorie</p>
            <Link
              href="/admin/categories/new"
              className="btn-aero px-6 py-3 text-white rounded-xl inline-block"
            >
              Créer la première catégorie
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-white/60 font-medium">Nom</th>
                <th className="text-left p-4 text-white/60 font-medium">ID</th>
                <th className="text-left p-4 text-white/60 font-medium">Icône</th>
                <th className="text-left p-4 text-white/60 font-medium">Musiques</th>
                <th className="text-right p-4 text-white/60 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-white font-medium">{category.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-white/60 font-mono text-sm">{category.id}</td>
                  <td className="p-4 text-white/60">{category.icon}</td>
                  <td className="p-4 text-white/60">{category.trackCount}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/categories/${category.id}`}
                        className="px-3 py-1 text-sm text-[#7ec8e3] hover:text-white transition-colors"
                      >
                        Modifier
                      </Link>
                      {deleteId === category.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(category.id)}
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
                          onClick={() => setDeleteId(category.id)}
                          className="px-3 py-1 text-sm text-red-400/70 hover:text-red-400 transition-colors"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
