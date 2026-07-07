'use client';

import { useState, useEffect } from 'react';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  displayName: string | null;
  avatarFile: string | null;
}

export default function ProfileEditPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/user/me')
      .then(r => r.json())
      .then(data => {
        if (!data.user) { router.replace('/'); return; }
        setUser(data.user);
        setDisplayName(data.user.displayName ?? '');
      });
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setSaving(false); return; }

      setSuccess('Profil mis à jour !');
      setUser(data.user);
    } catch {
      setError('Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const shownName = user.displayName || user.username;

  return (
    <div className="min-h-screen aero-bg flex flex-col items-center p-6">
      <div className="w-full max-w-md mb-6 flex items-center gap-3">
        <Link href={`/profile/${user.username}`} className="text-white/50 hover:text-white/80 text-sm transition-colors">
          ← Retour au profil
        </Link>
      </div>

      <div className="w-full max-w-md glass rounded-2xl p-6 space-y-6">
        <h1 className="text-xl font-bold text-white">Modifier le profil</h1>

        {/* Avatar — géré sur cooloss (compte partagé), lecture seule ici */}
        <div className="flex flex-col items-center gap-3">
          <UserAvatar avatarFile={user.avatarFile} pseudo={shownName} size={96} />
          <a
            href="https://cooloss.nathangracia.com/profile/edit"
            className="text-[#7ec8e3] hover:text-white text-xs transition-colors"
          >
            Changer la photo sur cooloss →
          </a>
        </div>

        {/* Identifiant (lecture seule) */}
        <div>
          <label className="block text-white/40 text-xs mb-1.5 font-semibold uppercase tracking-wide">Identifiant de connexion</label>
          <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm">
            @{user.username}
          </div>
          <a
            href="https://cooloss.nathangracia.com/login"
            className="text-white/30 hover:text-white/60 text-xs mt-1 inline-block transition-colors"
          >
            Changer le mot de passe sur cooloss →
          </a>
        </div>

        {/* Pseudo affiché (propre à Blindtoss) */}
        <div>
          <label className="block text-[#7ec8e3] text-xs mb-1.5 font-semibold uppercase tracking-wide">Pseudo affiché en jeu</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={user.username}
            maxLength={20}
            className="input-aero w-full px-4 py-3 text-white rounded-xl"
          />
          <p className="text-white/30 text-xs mt-1">Laisse vide pour utiliser @{user.username}</p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">{success}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-aero w-full py-3 text-white font-semibold rounded-xl disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sauvegarde...
            </span>
          ) : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}
