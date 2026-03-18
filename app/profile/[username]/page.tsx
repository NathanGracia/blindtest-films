import { notFound } from 'next/navigation';
import Link from 'next/link';
import UserAvatar from '@/components/UserAvatar';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyUserToken } from '@/lib/userAuth';

interface Props {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const normalized = username.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { username: normalized },
    include: {
      gameHistory: { orderBy: { playedAt: 'desc' }, take: 20 },
    },
  });

  if (!user) notFound();

  const ladder = await prisma.ladderEntry.findUnique({
    where: { pseudo_weekId: { pseudo: normalized, weekId: 'all-time' } },
  });

  const rankedGames = await prisma.gameResult.findMany({
    where: { userId: user.id, roomCode: 'PUBLIC' },
    select: { score: true },
  });

  // Vérifier si le visiteur est le propriétaire du profil
  const cookieStore = await cookies();
  const session = cookieStore.get('blindtoss_user_session');
  const currentUserId = session ? verifyUserToken(session.value) : null;
  const isOwner = currentUserId === user.id;

  const displayName = user.displayName || user.username;
  const totalGames = ladder?.gamesPlayed ?? 0;
  const bestScore = ladder?.bestScore ?? 0;
  const avgScore = rankedGames.length > 0
    ? Math.round(rankedGames.reduce((s, g) => s + g.score, 0) / rankedGames.length)
    : 0;

  return (
    <div className="min-h-screen aero-bg flex flex-col items-center p-6">
      <div className="w-full max-w-2xl mb-6">
        <Link href="/" className="text-white/50 hover:text-white/80 text-sm transition-colors">
          ← Retour
        </Link>
      </div>

      {/* Header profil */}
      <div className="w-full max-w-2xl glass rounded-2xl p-6 mb-4 flex items-center gap-5">
        <UserAvatar avatarFile={user.avatarFile} pseudo={displayName} size={64} />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{displayName}</h1>
          {user.displayName && (
            <p className="text-white/30 text-xs">@{user.username}</p>
          )}
          <p className="text-white/40 text-sm">
            Membre depuis {new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        {isOwner && (
          <Link
            href="/profile/edit"
            className="ml-auto shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Modifier
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="w-full max-w-2xl grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Parties jouées', value: totalGames },
          { label: 'Meilleur score', value: bestScore.toLocaleString('fr-FR') },
          { label: 'Moy. ranked', value: avgScore > 0 ? avgScore.toLocaleString('fr-FR') : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            <div className="text-white/50 text-xs">{label}</div>
          </div>
        ))}
      </div>

      {/* Historique */}
      <div className="w-full max-w-2xl glass rounded-2xl p-6">
        <h2 className="text-[#7ec8e3] font-semibold mb-4">Historique des parties</h2>
        {user.gameHistory.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-8">Aucune partie enregistrée</p>
        ) : (
          <div className="space-y-3">
            {user.gameHistory.map((game) => {
              const categories: string[] = JSON.parse(game.categories);
              return (
                <div key={game.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-white text-sm font-semibold">
                      {game.tracksFound}/{game.totalTracks} trouvés
                    </span>
                    <span className="text-white/40 text-xs">
                      {categories.join(', ')} · {new Date(game.playedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[#7ec8e3] font-bold">{game.score.toLocaleString('fr-FR')} pts</span>
                    <span className="text-white/40 text-xs">#{game.rank} / {game.totalPlayers}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
