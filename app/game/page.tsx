'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Timer from '@/components/Timer';
import AudioPlayer from '@/components/AudioPlayer';
import AnswerInput from '@/components/AnswerInput';
import ScoreBoard from '@/components/ScoreBoard';
import { Film, Attempt } from '@/types';
import { checkAnswer, shuffleArray } from '@/lib/utils';
import filmsData from '@/data/films.json';

export default function GamePage() {
  const router = useRouter();
  const [films, setFilms] = useState<Film[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  // Initialiser le jeu
  useEffect(() => {
    const shuffled = shuffleArray(filmsData as Film[]);
    setFilms(shuffled);
    if (shuffled.length > 0) {
      setTimeRemaining(shuffled[0].timeLimit);
      setIsPlaying(true);
    }
  }, []);

  const currentFilm = films[currentIndex];

  // Passer au film suivant
  const nextFilm = useCallback(() => {
    setShowResult(false);
    setAttempts([]);

    if (currentIndex + 1 >= films.length) {
      setIsFinished(true);
      setIsPlaying(false);
    } else {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setTimeRemaining(films[nextIndex].timeLimit);
      setIsPlaying(true);
    }
  }, [currentIndex, films]);

  // Gérer le timer
  useEffect(() => {
    if (!isPlaying || showResult || !currentFilm) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsPlaying(false);
          setShowResult(true);
          setWasCorrect(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, showResult, currentFilm]);

  // Soumettre une réponse
  const handleSubmit = (answer: string) => {
    if (!currentFilm || showResult) return;

    const isCorrect = checkAnswer(answer, currentFilm.acceptedAnswers);

    setAttempts((prev) => [
      ...prev,
      { text: answer, isCorrect, timestamp: Date.now() },
    ]);

    if (isCorrect) {
      setScore((prev) => prev + 1);
      setIsPlaying(false);
      setShowResult(true);
      setWasCorrect(true);
    }
  };

  // Écran de fin
  if (isFinished) {
    return (
      <div className="min-h-screen aero-bg flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#7fba00]/20 flex items-center justify-center glow-green">
            <span className="text-4xl">🏆</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-4 text-glow">Partie terminée !</h1>
          <div className="text-6xl font-bold text-[#7fba00] mb-2 text-glow">{score}</div>
          <p className="text-white/60 mb-8">
            sur {films.length} film{films.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="btn-aero-green w-full px-6 py-3 text-white rounded-xl font-semibold"
            >
              🔄 Rejouer
            </button>
            <button
              onClick={() => router.push('/')}
              className="btn-aero w-full px-6 py-3 text-white rounded-xl"
            >
              🏠 Retour à l&apos;accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Chargement
  if (films.length === 0 || !currentFilm) {
    return (
      <div className="min-h-screen aero-bg flex items-center justify-center">
        <div className="glass rounded-xl px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-3 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
            <span className="text-white text-xl">Chargement...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen aero-bg p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="glass px-4 py-2 rounded-lg text-white/70 hover:text-white transition-colors">
            ← Quitter
          </Link>
          <div className="glass px-4 py-2 rounded-lg text-[#7ec8e3]">
            🎮 Mode Solo
          </div>
        </div>

        {/* Score */}
        <ScoreBoard
          score={score}
          currentIndex={currentIndex}
          total={films.length}
        />

        {/* Timer */}
        <Timer timeRemaining={timeRemaining} totalTime={currentFilm.timeLimit} />

        {/* Audio Player */}
        <div className="flex justify-center py-6">
          <AudioPlayer src={currentFilm.audioFile} isPlaying={isPlaying} />
        </div>

        {/* Résultat */}
        {showResult && (
          <div
            className={`glass rounded-xl p-6 text-center ${
              wasCorrect ? 'glow-green' : ''
            }`}
          >
            <p className={`text-xl font-semibold ${wasCorrect ? 'text-[#7fba00]' : 'text-red-400'}`}>
              {wasCorrect ? '✓ Bravo !' : '✗ Temps écoulé !'}
            </p>
            <p className="text-3xl font-bold text-white mt-3 text-glow">
              {currentFilm.title}
            </p>
            <button
              onClick={nextFilm}
              className="btn-aero mt-6 px-8 py-3 text-white rounded-xl font-semibold"
            >
              {currentIndex + 1 >= films.length ? '📊 Voir le score' : '➡️ Film suivant'}
            </button>
          </div>
        )}

        {/* Zone de réponse */}
        {!showResult && (
          <AnswerInput
            onSubmit={handleSubmit}
            attempts={attempts}
            disabled={showResult}
          />
        )}
      </div>
    </div>
  );
}
