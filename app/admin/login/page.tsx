'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/admin');
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur de connexion');
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen aero-bg flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full">
        <Link href="/" className="text-white/60 hover:text-white mb-6 inline-flex items-center gap-2 transition-colors">
          ← Retour au jeu
        </Link>

        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#4a90d9]/20 flex items-center justify-center glow-blue">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold text-white text-glow">
            Administration
          </h1>
          <p className="text-white/60 mt-2">
            Connectez-vous pour gérer le contenu
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 glass rounded-lg border border-red-500/50 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-aero w-full px-4 py-3 text-white rounded-xl"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-aero-green w-full px-6 py-4 text-white text-lg font-semibold rounded-xl disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Connexion...
              </span>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
