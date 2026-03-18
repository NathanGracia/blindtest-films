'use client';

import { useState } from 'react';

interface Props {
  onClose: () => void;
  onSuccess: (user: { id: number; username: string }) => void;
}

export default function AuthModal({ onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = tab === 'login' ? '/api/user/login' : '/api/user/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Une erreur est survenue');
      return;
    }

    onSuccess(data.user);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        {/* Tabs */}
        <div className="flex mb-6 gap-2">
          <button
            onClick={() => { setTab('login'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'login'
                ? 'bg-[#4a90d9]/30 text-[#7ec8e3] border border-[#4a90d9]/60'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Se connecter
          </button>
          <button
            onClick={() => { setTab('register'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === 'register'
                ? 'bg-[#4a90d9]/30 text-[#7ec8e3] border border-[#4a90d9]/60'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#7ec8e3] text-xs mb-1.5 font-semibold">Pseudo</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="moviefan42"
              className="input-aero w-full px-4 py-3 text-white rounded-xl"
              maxLength={20}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[#7ec8e3] text-xs mb-1.5 font-semibold">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-aero w-full px-4 py-3 text-white rounded-xl"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-aero w-full py-3 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {tab === 'login' ? 'Connexion...' : 'Création...'}
              </span>
            ) : tab === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>

        <button
          onClick={onClose}
          className="mt-4 w-full text-white/30 hover:text-white/60 text-sm text-center transition-colors"
        >
          Continuer en guest
        </button>
      </div>
    </div>
  );
}
