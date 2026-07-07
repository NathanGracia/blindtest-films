'use client';

import { useEffect, useState } from 'react';
import UserAvatar from '@/components/UserAvatar';

interface User {
  id: number;
  username: string;
  displayName: string | null;
  avatarFile: string | null;
  isAdmin: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Utilisateurs</h2>
          <p className="text-white/60">{users.length} compte{users.length > 1 ? 's' : ''} enregistré{users.length > 1 ? 's' : ''}</p>
        </div>
        <a
          href="https://cooloss.nathangracia.com/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#7ec8e3] hover:text-white transition-colors"
        >
          Gérer les comptes (rôle, mot de passe) sur cooloss →
        </a>
      </div>

      {/*
        Liste en lecture seule : le compte (username/displayName/avatar/rôle)
        vit sur cooloss, cette table n'est qu'un miroir local (voir
        lib/sharedAuth.ts). Toggle admin retiré — modifier isAdmin ici ne
        changeait que la copie locale, écrasée au prochain login de l'user
        depuis les claims cooloss, donc silencieusement sans effet réel.
      */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left p-4 text-white/60 font-medium">Utilisateur</th>
              <th className="text-left p-4 text-white/60 font-medium">Identifiant</th>
              <th className="text-left p-4 text-white/60 font-medium">Membre depuis</th>
              <th className="text-left p-4 text-white/60 font-medium">Rôle</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar avatarFile={user.avatarFile} pseudo={user.displayName || user.username} size={36} />
                    <span className="text-white font-medium">{user.displayName || user.username}</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-white/50 text-sm">@{user.username}</span>
                </td>
                <td className="p-4">
                  <span className="text-white/50 text-sm">
                    {new Date(user.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                </td>
                <td className="p-4">
                  {user.isAdmin ? (
                    <span className="text-xs bg-[#4a90d9]/30 text-[#7ec8e3] px-2 py-1 rounded border border-[#4a90d9]/50">
                      Admin
                    </span>
                  ) : (
                    <span className="text-white/30 text-sm">Membre</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
