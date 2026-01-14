'use client';

import { useState, useEffect, useRef } from 'react';
import { Category } from '@/types';

interface CategoryWithCount extends Category {
  trackCount: number;
}

interface CategorySelectorProps {
  onSelectionChange: (selectedIds: string[]) => void;
  initialSelection?: string[];
}

const ICONS: Record<string, string> = {
  film: '🎬',
  tv: '📺',
  gamepad: '🎮',
  sparkles: '✨',
  music: '🎵',
  default: '📁',
};

export default function CategorySelector({
  onSelectionChange,
  initialSelection,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const onSelectionChangeRef = useRef(onSelectionChange);

  // Garder la ref à jour
  onSelectionChangeRef.current = onSelectionChange;

  // Charger les catégories (une seule fois)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data);

          // Initialiser la sélection
          let initialSet: Set<string>;
          if (initialSelection && initialSelection.length > 0) {
            initialSet = new Set(initialSelection);
          } else {
            // Par défaut, tout est sélectionné
            initialSet = new Set(data.map((c: CategoryWithCount) => c.id));
          }
          setSelected(initialSet);

          // Notifier le parent une seule fois après l'initialisation
          onSelectionChangeRef.current(Array.from(initialSet));
        }
      } catch (error) {
        console.error('Erreur chargement catégories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []); // Pas de dépendances - ne s'exécute qu'une fois

  const toggleCategory = (id: string) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        // Ne pas permettre de tout désélectionner
        if (newSet.size > 1) {
          newSet.delete(id);
        }
      } else {
        newSet.add(id);
      }

      // Notifier le parent directement
      onSelectionChangeRef.current(Array.from(newSet));
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = categories.map((c) => c.id);
    setSelected(new Set(allIds));
    onSelectionChangeRef.current(allIds);
  };

  const totalSelected = categories
    .filter((c) => selected.has(c.id))
    .reduce((sum, c) => sum + c.trackCount, 0);

  if (loading) {
    return (
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-center gap-2 text-white/60">
          <div className="w-4 h-4 border-2 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
          <span>Chargement des catégories...</span>
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[#7ec8e3] font-semibold text-sm">
          Catégories
        </h3>
        <button
          onClick={selectAll}
          className="text-xs text-white/50 hover:text-white transition-colors"
        >
          Tout sélectionner
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {categories.map((category) => {
          const isSelected = selected.has(category.id);
          const icon = ICONS[category.icon] || ICONS.default;

          return (
            <button
              key={category.id}
              onClick={() => toggleCategory(category.id)}
              className={`
                relative p-3 rounded-lg border transition-all duration-200
                ${isSelected
                  ? 'border-white/40 bg-white/10'
                  : 'border-white/10 bg-white/5 opacity-50'
                }
                hover:border-white/30 hover:bg-white/15
              `}
              style={{
                boxShadow: isSelected ? `0 0 15px ${category.color}30` : 'none',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">
                    {category.name}
                  </div>
                  <div className="text-white/40 text-xs">
                    {category.trackCount} musique{category.trackCount > 1 ? 's' : ''}
                  </div>
                </div>
                <div
                  className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center
                    ${isSelected ? 'border-[#7fba00] bg-[#7fba00]' : 'border-white/30'}
                  `}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-white/10 text-center">
        <span className="text-white/60 text-sm">
          {totalSelected} musique{totalSelected > 1 ? 's' : ''} sélectionnée{totalSelected > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
