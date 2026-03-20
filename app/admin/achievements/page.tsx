'use client';

import { useState, useEffect } from 'react';

interface Emote {
  id: number;
  code: string;
  imageFile: string | null;
  achievementCode: string | null;
}

interface AchievementDef {
  code: string;
  name: string;
  description: string;
  icon: string;
}

interface AchievementStats {
  count: number;
  pct: number;
}

const ACHIEVEMENTS: AchievementDef[] = [
  // Débutant
  { code: 'first_game',    name: 'Première partie',   description: 'Jouer sa première partie',                              icon: '🎮' },
  { code: 'first_correct', name: 'Premier sang',      description: 'Trouver sa première bonne réponse',                     icon: '🎯' },
  { code: 'emote_used',    name: 'Expressif',          description: 'Utiliser une emote dans le chat',                      icon: '🎭' },
  // Performance
  { code: 'champion',      name: 'Champion',           description: 'Finir 1er d\'une partie avec au moins 2 joueurs',      icon: '🏆' },
  { code: 'perfect',       name: 'Sans faute',          description: 'Trouver toutes les tracks d\'une partie',             icon: '💯' },
  { code: 'speed_demon',   name: 'Éclair',              description: 'Trouver une réponse dans les 3 premières secondes',   icon: '⚡' },
  // Régularité
  { code: 'habitue',       name: 'Habitué',             description: 'Jouer 100 parties',                                   icon: '📅' },
  { code: 'veteran',       name: 'Vétéran',             description: 'Jouer 1000 parties',                                  icon: '🎖️' },
  { code: 'hat_trick',     name: 'Hat-trick',           description: 'Finir 1er 3 fois de suite',                           icon: '🔥' },
  // Fun / Easter egg
  { code: 'night_owl',     name: 'Oiseau de nuit',      description: 'Jouer entre minuit et 6h du matin',                  icon: '🦉' },
  { code: 'lucky',         name: 'Chanceux',            description: 'Trouver une réponse après avoir perdu 2 vies',        icon: '🍀' },
  { code: 'chatty',        name: 'Bavard',              description: 'Envoyer 30 messages dans le chat en une partie',      icon: '💬' },
];

export default function AdminAchievementsPage() {
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [stats, setStats] = useState<Record<string, AchievementStats>>({});
  const [totalUsers, setTotalUsers] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/emotes').then(r => r.json()),
      fetch('/api/admin/achievements').then(r => r.json()),
    ]).then(([emotesData, statsData]) => {
      setEmotes(emotesData);
      setStats(statsData.stats || {});
      setTotalUsers(statsData.totalUsers || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const getLinkedEmote = (achievementCode: string) =>
    emotes.find(e => e.achievementCode === achievementCode) ?? null;

  const handleLink = async (achievementCode: string, emoteId: number | null) => {
    setSaving(achievementCode);
    try {
      await fetch(`/api/admin/achievements/${achievementCode}/emote`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoteId }),
      });
      // Mettre à jour le state local
      setEmotes(prev => prev.map(e => {
        if (e.achievementCode === achievementCode) return { ...e, achievementCode: null };
        if (emoteId && e.id === emoteId) return { ...e, achievementCode };
        return e;
      }));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Succès ({ACHIEVEMENTS.length})</h1>

      {loading ? (
        <div className="glass rounded-xl p-8 text-center text-white/40">Chargement...</div>
      ) : (
        <div className="space-y-3">
          {ACHIEVEMENTS.map(def => {
            const linked = getLinkedEmote(def.code);
            const isSaving = saving === def.code;

            return (
              <div key={def.code} className="glass rounded-xl p-5 flex items-center gap-5">
                {/* Icône succès */}
                <div className="shrink-0 w-12 h-12 flex items-center justify-center rounded-xl text-3xl"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {def.icon}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold">{def.name}</div>
                  <div className="text-white/40 text-sm">{def.description}</div>
                  <div className="text-white/25 text-xs font-mono mt-0.5">{def.code}</div>
                </div>

                {/* Stats */}
                <div className="shrink-0 text-right min-w-[80px]">
                  {stats[def.code] ? (
                    <>
                      <div className="text-white font-bold text-lg leading-none">{stats[def.code].count}</div>
                      <div className={`text-xs font-medium ${
                        stats[def.code].pct <= 5 ? 'text-yellow-400/70' :
                        stats[def.code].pct <= 20 ? 'text-[#7ec8e3]/70' :
                        'text-white/30'
                      }`}>{stats[def.code].pct}% des joueurs</div>
                    </>
                  ) : (
                    <div className="text-white/20 text-sm">0</div>
                  )}
                </div>

                {/* Emote liée actuelle */}
                <div className="shrink-0 flex items-center gap-3">
                  {linked ? (
                    <div className="flex items-center gap-2">
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, overflow: 'hidden', position: 'relative',
                        boxShadow: '0 0 0 1.5px rgba(0,0,0,0.25), 0 0 0 2.5px rgba(255,255,255,0.20)',
                      }}>
                        {linked.imageFile
                          ? <>
                              <img src={linked.imageFile} alt={linked.code} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.04) 100%)',
                                borderRadius: '8px 8px 0 0', pointerEvents: 'none',
                              }} />
                            </>
                          : <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">?</div>
                        }
                      </div>
                      <span className="text-white/60 text-sm font-mono">:{linked.code}:</span>
                    </div>
                  ) : (
                    <span className="text-white/25 text-sm italic">Aucune emote liée</span>
                  )}
                </div>

                {/* Sélecteur */}
                <div className="shrink-0">
                  <select
                    disabled={isSaving}
                    value={linked?.id ?? ''}
                    onChange={e => handleLink(def.code, e.target.value ? Number(e.target.value) : null)}
                    className="input-aero px-3 py-2 text-white rounded-lg text-sm disabled:opacity-50"
                    style={{ minWidth: 160 }}
                  >
                    <option value="">— Aucune emote —</option>
                    {emotes.filter(e => e.imageFile).map(e => (
                      <option key={e.id} value={e.id}>
                        :{e.code}: {e.achievementCode && e.achievementCode !== def.code ? `(→ ${e.achievementCode})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {isSaving && <span className="text-white/40 text-xs shrink-0">Sauvegarde...</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
