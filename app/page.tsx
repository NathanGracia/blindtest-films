'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import CategorySelector from '@/components/CategorySelector';

export default function Home() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Charger la sélection sauvegardée
  useEffect(() => {
    const saved = sessionStorage.getItem('blindtest_categories');
    if (saved) {
      try {
        setSelectedCategories(JSON.parse(saved));
      } catch {
        // Ignorer les erreurs de parsing
      }
    }
  }, []);

  const handleSelectionChange = useCallback((selected: string[]) => {
    setSelectedCategories(selected);
    sessionStorage.setItem('blindtest_categories', JSON.stringify(selected));
  }, []);

  return (
    <div className="min-h-screen aero-bg flex items-center justify-center p-4">
      <div className="text-center max-w-lg w-full">
        {/* Logo / Title */}
        <div className="mb-8">
          <div className="glass rounded-full w-32 h-32 mx-auto mb-6 flex items-center justify-center glow-blue">
            <span className="text-6xl">🎬</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 text-glow tracking-wide">
            BlindTest
          </h1>
          <h2 className="text-2xl text-[#7ec8e3] font-light">
            Films Edition
          </h2>
          <p className="text-white/70 text-lg mt-4">
            Devine les films à partir de leurs musiques emblématiques !
          </p>
        </div>

        {/* Category Selector */}
        <div className="mb-6">
          <CategorySelector
            onSelectionChange={handleSelectionChange}
            initialSelection={selectedCategories.length > 0 ? selectedCategories : undefined}
          />
        </div>

        {/* Buttons */}
        <div className="space-y-4">
          <Link
            href="/game"
            className="btn-aero-green block w-full px-8 py-4 text-white text-xl font-semibold rounded-xl"
          >
            🎮 Mode Solo
          </Link>
          <Link
            href="/multi"
            className="btn-aero block w-full px-8 py-4 text-white text-xl font-semibold rounded-xl"
          >
            👥 Multijoueur
          </Link>
        </div>

        {/* Admin Link */}
        <div className="mt-6">
          <Link
            href="/admin"
            className="text-white/30 hover:text-white/60 text-sm transition-colors"
          >
            Administration
          </Link>
        </div>

        {/* How to play */}
        <div className="mt-8 glass rounded-xl p-6">
          <h3 className="font-semibold text-[#7ec8e3] mb-4 text-lg">
            Comment jouer ?
          </h3>
          <ul className="space-y-2 text-white/80 text-left">
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#4a90d9]/50 flex items-center justify-center text-sm">1</span>
              <span>Une musique de film se lance</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#4a90d9]/50 flex items-center justify-center text-sm">2</span>
              <span>Tape le nom du film</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#4a90d9]/50 flex items-center justify-center text-sm">3</span>
              <span>Tu as 30 secondes pour trouver</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[#7fba00]/50 flex items-center justify-center text-sm">✓</span>
              <span>Bonne réponse = +1 point !</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
