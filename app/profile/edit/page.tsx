'use client';

import { useState, useRef, useEffect } from 'react';
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
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/user/me')
      .then(r => r.json())
      .then(data => {
        if (!data.user) { router.replace('/'); return; }
        setUser(data.user);
        setDisplayName(data.user.displayName ?? '');
        setAvatarPreview(data.user.avatarFile);
      });
  }, [router]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const res = await fetch('/api/user/avatar', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setSaving(false); return; }
      }

      const body: Record<string, string> = { displayName };
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setSaving(false); return; }

      setSuccess('Profil mis à jour !');
      setCurrentPassword('');
      setNewPassword('');
      setAvatarFile(null);
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

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <button onClick={() => fileInputRef.current?.click()} className="relative group">
            <UserAvatar avatarFile={avatarPreview} pseudo={shownName} size={96} />
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <circle cx="12" cy="13" r="3" strokeWidth="2" />
              </svg>
            </div>
          </button>
          <p className="text-white/40 text-xs">Clique pour changer · JPG, PNG, WebP · max 5 Mo</p>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* Identifiant (lecture seule) */}
        <div>
          <label className="block text-white/40 text-xs mb-1.5 font-semibold uppercase tracking-wide">Identifiant de connexion</label>
          <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm">
            @{user.username}
          </div>
        </div>

        {/* Pseudo affiché */}
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

        {/* Séparateur */}
        <div className="border-t border-white/10" />

        {/* Changer le mot de passe */}
        <div className="space-y-3">
          <label className="block text-[#7ec8e3] text-xs font-semibold uppercase tracking-wide">Changer le mot de passe</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Mot de passe actuel"
            className="input-aero w-full px-4 py-3 text-white rounded-xl"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nouveau mot de passe (6 car. min)"
            className="input-aero w-full px-4 py-3 text-white rounded-xl"
          />
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
