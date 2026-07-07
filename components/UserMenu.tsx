'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import UserAvatar from '@/components/UserAvatar';

interface User {
  id: number;
  username: string;
  displayName?: string | null;
  avatarFile?: string | null;
  isAdmin?: boolean;
}

interface Props {
  user: User | null;
  onLoginClick: () => void;
  onLogout: () => void;
}

export default function UserMenu({ user, onLoginClick, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/user/logout', { method: 'POST' });
    setOpen(false);
    onLogout();
  };

  if (!user) {
    return (
      <button
        onClick={onLoginClick}
        className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all text-sm"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" strokeWidth="2" />
          <path strokeWidth="2" strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
        <span className="hidden sm:block">Connexion</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-[#4a90d9]/40 hover:border-[#4a90d9]/80 transition-all"
      >
        <UserAvatar avatarFile={user.avatarFile} pseudo={user.displayName || user.username} size={28} />
        <span className="text-white text-sm font-semibold hidden sm:block max-w-[100px] truncate">
          {user.displayName || user.username}
        </span>
        <svg
          className={`w-3 h-3 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 glass rounded-xl border border-white/10 shadow-2xl overflow-hidden z-50">
          <Link
            href={`/profile/${user.username}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4" strokeWidth="2" />
              <path strokeWidth="2" strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            Mon profil
          </Link>
          <Link
            href="/notes"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Mes notes
          </Link>
          <a
            href="https://cooloss.nathangracia.com/profile/edit"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Modifier le profil
          </a>
          {user.isAdmin && (
            <>
              <div className="border-t border-white/10 mx-3" />
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <circle cx="12" cy="12" r="3" strokeWidth="2" />
                </svg>
                Administration
              </Link>
            </>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm w-full text-left"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}
