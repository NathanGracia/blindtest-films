'use client';

import { useState, useEffect, useRef } from 'react';
import { Category } from '@/types';

interface CategoryWithCount extends Category {
  trackCount: number;
  featuredImage?: string | null;
}

interface CategorySelectorProps {
  onSelectionChange: (selectedIds: string[]) => void;
  initialSelection?: string[];
  onRoundsChange?: (rounds: number) => void;
  initialRounds?: number;
}

const ICONS: Record<string, string> = {
  film: '🎬',
  tv: '📺',
  gamepad: '🎮',
  sparkles: '✨',
  music: '🎵',
  default: '📁',
};

const ROUNDS_OPTIONS = [10, 25, 50, 75] as const;

export default function CategorySelector({
  onSelectionChange,
  initialSelection,
  onRoundsChange,
  initialRounds = 25,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedRounds, setSelectedRounds] = useState(initialRounds);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const onSelectionChangeRef = useRef(onSelectionChange);

  onSelectionChangeRef.current = onSelectionChange;

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data);

          let initialSet: Set<string>;
          if (initialSelection && initialSelection.length > 0) {
            initialSet = new Set(initialSelection);
          } else {
            initialSet = new Set(data.map((c: CategoryWithCount) => c.id));
          }
          setSelected(initialSet);
          onSelectionChangeRef.current(Array.from(initialSet));
        }
      } catch (error) {
        console.error('Erreur chargement catégories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  const toggleCategory = (id: string) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        if (newSet.size > 1) newSet.delete(id);
      } else {
        newSet.add(id);
      }
      onSelectionChangeRef.current(Array.from(newSet));
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = categories.map((c) => c.id);
    setSelected(new Set(allIds));
    onSelectionChangeRef.current(allIds);
  };

  const handleRoundsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    const rounds = ROUNDS_OPTIONS[index];
    setSelectedRounds(rounds);
    if (onRoundsChange) onRoundsChange(rounds);
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

  if (categories.length === 0) return null;

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[#7ec8e3] font-semibold text-sm">Catégories</h3>
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
              className="group relative rounded-xl overflow-hidden flex flex-col transition-all duration-200"
              style={{
                aspectRatio: '2/1.3',
                boxShadow: isSelected
                  ? `0 4px 20px ${category.color}40, 0 0 0 2px ${category.color}88`
                  : '0 2px 10px rgba(0,0,0,0.3)',
                opacity: isSelected ? 1 : 0.45,
              }}
            >
              {/* Image de fond */}
              {category.featuredImage ? (
                <img
                  src={category.featuredImage}
                  alt={category.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: `${category.color}22` }}
                >
                  <span className="text-3xl opacity-20">{icon}</span>
                </div>
              )}

              {/* Barre couleur catégorie */}
              <div
                className="relative z-10 shrink-0"
                style={{ height: 3, background: `linear-gradient(90deg, ${category.color}dd, ${category.color}33)` }}
              />

              {/* Spacer */}
              <div className="flex-1 relative z-10" />

              {/* Overlay infos */}
              <div className="relative z-10">
                {/* Couche blur */}
                <div
                  className="absolute left-0 right-0 bottom-0 pointer-events-none"
                  style={{
                    top: '-100%',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 60%)',
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 60%)',
                  }}
                />
                {/* Fond sombre */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(180deg, rgba(0,10,15,0) 0%, rgba(0,10,15,0.6) 40%, rgba(0,10,15,0.88) 100%)' }}
                />
                {/* Texte */}
                <div className="relative px-2.5 pt-2 pb-2.5 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-white text-xs font-semibold leading-tight truncate">{category.name}</p>
                    <p className="text-white/40 text-xs leading-tight">{category.trackCount} musique{category.trackCount > 1 ? 's' : ''}</p>
                  </div>
                  <div
                    className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{
                      borderColor: isSelected ? '#7fba00' : 'rgba(255,255,255,0.3)',
                      background: isSelected ? '#7fba00' : 'transparent',
                    }}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
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

      {onRoundsChange && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center gap-4">
            <label className="text-white/70 text-sm font-medium whitespace-nowrap">
              Nombre de musiques:
            </label>
            <div className="flex-1 flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={ROUNDS_OPTIONS.indexOf(selectedRounds as typeof ROUNDS_OPTIONS[number])}
                onChange={handleRoundsChange}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer
                  bg-white/10
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-5
                  [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-[#7ec8e3]
                  [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(126,200,227,0.5)]
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-webkit-slider-thumb]:transition-all
                  [&::-webkit-slider-thumb]:hover:bg-[#a0d8f0]
                  [&::-webkit-slider-thumb]:hover:shadow-[0_0_15px_rgba(126,200,227,0.8)]
                  [&::-moz-range-thumb]:w-5
                  [&::-moz-range-thumb]:h-5
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-[#7ec8e3]
                  [&::-moz-range-thumb]:border-0
                  [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(126,200,227,0.5)]
                  [&::-moz-range-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:transition-all
                  [&::-moz-range-thumb]:hover:bg-[#a0d8f0]
                  [&::-moz-range-thumb]:hover:shadow-[0_0_15px_rgba(126,200,227,0.8)]"
              />
              <span className="text-[#7ec8e3] font-bold text-lg min-w-[3ch] text-center">
                {selectedRounds}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
