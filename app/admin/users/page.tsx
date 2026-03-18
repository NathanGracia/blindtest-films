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
  const [toggling, setToggling] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  const toggleAdmin = async (user: User) => {
    setToggling(user.id);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin: !user.isAdmin }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, isAdmin: updated.isAdmin } : u));
    }
    setToggling(null);
  };

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
      <div>
        <h2 className="text-2xl font-bold text-white">Utilisateurs</h2>
        <p className="text-white/60">{users.length} compte{users.length > 1 ? 's' : ''} enregistré{users.length > 1 ? 's' : ''}</p>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left p-4 text-white/60 font-medium">Utilisateur</th>
              <th className="text-left p-4 text-white/60 font-medium">Identifiant</th>
              <th className="text-left p-4 text-white/60 font-medium">Membre depuis</th>
              <th className="text-left p-4 text-white/60 font-medium">Rôle</th>
              <th className="text-right p-4 text-white/60 font-medium">Actions</th>
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
                <td className="p-4 text-right">
                  <button
                    onClick={() => toggleAdmin(user)}
                    disabled={toggling === user.id}
                    className={`px-3 py-1 text-sm rounded-lg transition-all disabled:opacity-50 ${
                      user.isAdmin
                        ? 'text-red-400/70 hover:text-red-400 transition-colors'
                        : 'text-[#7ec8e3]/70 hover:text-[#7ec8e3] transition-colors'
                    }`}
                  >
                    {toggling === user.id ? '...' : user.isAdmin ? 'Retirer admin' : 'Passer admin'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
