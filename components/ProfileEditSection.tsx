'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface Props {
  user: {
    id: number;
    username: string;
    displayName: string | null;
    avatarFile: string | null;
  };
}

export default function ProfileEditSection({ user }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatarFile);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // 1. Upload avatar si changé
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const res = await fetch('/api/user/avatar', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setSaving(false); return; }
      }

      // 2. Mise à jour profil (displayName + mdp optionnel)
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
      router.refresh();
    } catch {
      setError('Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Modifier le profil
      </button>
    );
  }

  return (
    <div className="w-full max-w-2xl glass rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[#7ec8e3] font-semibold">Modifier le profil</h2>
        <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white/70 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative group shrink-0"
        >
          <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#4a90d9] to-[#7ec8e3] flex items-center justify-center shadow-lg">
            {avatarPreview ? (
              <Image src={avatarPreview} alt="avatar" fill className="object-cover" unoptimized />
            ) : (
              <span className="text-3xl font-bold text-white">{user.username[0].toUpperCase()}</span>
            )}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <circle cx="12" cy="13" r="3" strokeWidth="2" />
            </svg>
          </div>
        </button>
        <div className="text-sm text-white/50">
          <p>Clique sur la photo pour la changer</p>
          <p>JPG, PNG ou WebP · max 5 Mo</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Pseudo affiché */}
      <div className="mb-4">
        <label className="block text-[#7ec8e3] text-xs mb-1.5 font-semibold">
          Pseudo affiché en jeu
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={user.username}
          maxLength={20}
          className="input-aero w-full px-4 py-3 text-white rounded-xl"
        />
        <p className="text-white/30 text-xs mt-1">
          Laisse vide pour utiliser ton identifiant : <span className="text-white/50">{user.username}</span>
        </p>
      </div>

      {/* Changement de mot de passe */}
      <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-[#7ec8e3] text-xs font-semibold mb-3">Changer le mot de passe</p>
        <div className="space-y-3">
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
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {success && <p className="text-green-400 text-sm mb-4">{success}</p>}

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
  );
}
