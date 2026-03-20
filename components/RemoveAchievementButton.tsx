'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RemoveAchievementButton({ code }: { code: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRemove = async () => {
    setLoading(true);
    await fetch(`/api/user/achievements/${code}`, { method: 'DELETE' });
    router.refresh();
    setLoading(false);
  };

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      title="Retirer ce succès"
      className="mt-1 text-[10px] text-white/20 hover:text-red-400/70 transition-colors disabled:opacity-40 leading-none"
    >
      {loading ? '...' : '✕ retirer'}
    </button>
  );
}
