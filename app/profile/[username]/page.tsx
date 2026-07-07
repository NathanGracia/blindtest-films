import { notFound } from 'next/navigation';
import Link from 'next/link';
import UserAvatar from '@/components/UserAvatar';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/sharedAuth';
import { ACHIEVEMENTS } from '@/lib/achievements';
import RemoveAchievementButton from '@/components/RemoveAchievementButton';

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
      achievements: { orderBy: { unlockedAt: 'asc' } },
    },
  });

  if (!user) notFound();

  const ladder = await prisma.ladderEntry.findUnique({
    where: { pseudo_weekId: { pseudo: normalized, weekId: 'all-time' } },
  });

  // Emotes liées aux achievements (pour afficher l'icône image)
  const achievementEmotes = await prisma.emote.findMany({
    where: { achievementCode: { not: null } },
    select: { achievementCode: true, imageFile: true },
  });
  const emoteByAchievement = Object.fromEntries(achievementEmotes.map(e => [e.achievementCode!, e.imageFile]));

  // Progression des succès à barre + rareté
  const totalGamesPlayed = await prisma.gameResult.count({ where: { userId: user.id } });
  const totalUsers = await prisma.user.count();
  const achievementCounts = await prisma.userAchievement.groupBy({
    by: ['code'],
    _count: { code: true },
  });
  const rarityMap: Record<string, number> = Object.fromEntries(
    achievementCounts.map(a => [a.code, totalUsers > 0 ? Math.round((a._count.code / totalUsers) * 100) : 0])
  );
  const achievementProgress: Record<string, { value: number; max: number }> = {
    habitue:  { value: Math.min(totalGamesPlayed, 100),  max: 100  },
    veteran:  { value: Math.min(totalGamesPlayed, 1000), max: 1000 },
    chatty:   { value: Math.min(user.totalChatMessages, 30), max: 30 },
  };

  const rankedGames = await prisma.gameResult.findMany({
    where: { userId: user.id, roomCode: 'PUBLIC' },
    select: { score: true },
  });

  // Vérifier si le visiteur est le propriétaire du profil
  const currentUserId = await getCurrentUserId();
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
          <div className="ml-auto shrink-0 flex items-center gap-2">
            <Link
              href="/notes"
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Mes notes
            </Link>
            <Link
              href="/profile/edit"
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Modifier
            </Link>
          </div>
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

      {/* Succès */}
      <div className="w-full max-w-2xl glass rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#7ec8e3] font-semibold">Succès</h2>
          <span className="text-white/40 text-sm">
            {user.achievements.length} / {Object.keys(ACHIEVEMENTS).length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Object.values(ACHIEVEMENTS).map(def => {
            const unlocked = user.achievements.find(a => a.code === def.code);
            return (
              <div
                key={def.code}
                className={`rounded-xl p-3 flex flex-col items-center gap-1.5 text-center border transition-all ${
                  unlocked
                    ? 'bg-[#7ec8e3]/10 border-[#7ec8e3]/30'
                    : 'bg-white/3 border-white/5 opacity-40'
                }`}
              >
                {emoteByAchievement[def.code] ? (
                  <div style={{
                    width: 48, height: 48,
                    borderRadius: 10,
                    position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                    boxShadow: unlocked
                      ? '0 0 0 1.5px rgba(0,0,0,0.25), 0 0 0 2.5px rgba(255,255,255,0.20), 0 2px 6px rgba(0,0,0,0.35)'
                      : 'none',
                    filter: unlocked ? 'none' : 'grayscale(1)',
                    opacity: unlocked ? 1 : 0.3,
                  }}>
                    <img src={emoteByAchievement[def.code]!} alt={def.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    {unlocked && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0,
                        height: '50%',
                        borderRadius: '10px 10px 0 0',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.04) 100%)',
                        pointerEvents: 'none',
                      }} />
                    )}
                  </div>
                ) : <span className="text-3xl">{def.icon}</span>}

                <span className={`text-sm font-semibold ${unlocked ? 'text-white' : 'text-white/50'}`}>{def.name}</span>
                <span className="text-white/40 text-xs leading-tight">{def.description}</span>
                {rarityMap[def.code] !== undefined && (
                  <span className={`text-[10px] font-medium ${
                    rarityMap[def.code] <= 5 ? 'text-yellow-400/70' :
                    rarityMap[def.code] <= 20 ? 'text-[#7ec8e3]/60' :
                    'text-white/25'
                  }`}>
                    {rarityMap[def.code]}% des joueurs
                  </span>
                )}
                {unlocked && (
                  <span className="text-[#7ec8e3]/60 text-xs mt-0.5">
                    {new Date(unlocked.unlockedAt).toLocaleDateString('fr-FR')}
                  </span>
                )}
                {achievementProgress[def.code] && !unlocked && (
                  <div className="w-full mt-1.5">
                    <div className="flex justify-between text-[10px] text-white/30 mb-1">
                      <span>{achievementProgress[def.code].value.toLocaleString('fr-FR')}</span>
                      <span>{achievementProgress[def.code].max.toLocaleString('fr-FR')}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(achievementProgress[def.code].value / achievementProgress[def.code].max) * 100}%`,
                          background: 'linear-gradient(90deg, rgba(74,144,217,0.6), rgba(126,200,227,0.8))',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
