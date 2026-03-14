export default function UpdatesSidebar() {
  const updates = [
    {
      date: '14 mars 2025',
      badge: '✨ Nouveau',
      badgeColor: 'text-[#7ec8e3] bg-[#7ec8e3]/15',
      items: [
        'Le site s\'appelle maintenant BlindToss 🎉',
        'Signalement avec message : décris le problème directement',
        'Import audio via URL YouTube depuis l\'admin',
      ],
    },
    {
      date: '12 mars 2025',
      badge: '🎮 Jeu',
      badgeColor: 'text-purple-300 bg-purple-500/15',
      items: [
        'Classement ranked par catégorie',
        'Musiques "Determinoss" ajoutées',
      ],
    },
    {
      date: '8 mars 2025',
      badge: '⚙️ Système',
      badgeColor: 'text-orange-300 bg-orange-500/15',
      items: [
        'Filtres par difficulté (facile / moyen / difficile)',
        'Normalisation audio : volume uniforme sur toutes les pistes',
      ],
    },
    {
      date: 'Bientôt',
      badge: '🔜 Prévu',
      badgeColor: 'text-white/40 bg-white/5',
      items: [
        'Nouvelles musiques de jeux vidéo',
        'Mode duel 1v1',
      ],
    },
  ];

  return (
    <div className="glass rounded-xl p-5 w-72 max-h-[600px] overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-[#7ec8e3] font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">📢</span>
          Nouveautés
        </h3>
      </div>

      <div className="space-y-4">
        {updates.map((update, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${update.badgeColor}`}>
                {update.badge}
              </span>
              <span className="text-white/30 text-xs">{update.date}</span>
            </div>
            <ul className="space-y-1 pl-1">
              {update.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="text-white/20 mt-0.5 flex-shrink-0">–</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {i < updates.length - 1 && (
              <div className="border-t border-white/5 pt-1" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 text-white/40 text-xs text-center">
        Mises à jour régulières
      </div>
    </div>
  );
}
