#!/bin/sh
set -e

echo "=== Blindtest Films - Demarrage ==="

DB_FILE="/app/prisma/dev.db"

# 1. Verifier si la base de donnees existe
if [ ! -f "$DB_FILE" ]; then
    echo "[1/3] Base de donnees non trouvee, creation..."
    npx prisma db push --skip-generate

    echo "[2/3] Initialisation des categories..."
    npm run db:seed
else
    echo "[1/3] Base de donnees existante detectee, conservation des donnees."
    echo "[2/3] Verification du schema..."
    npx prisma db push --skip-generate
fi

# 3. Demarrer le serveur
echo "[3/3] Demarrage du serveur..."
echo ""
echo "=== Blindtest Films - Pret! ==="
echo "Serveur accessible sur http://localhost:3000"
echo ""
echo "Pour ajouter des tracks, lancez depuis votre PC (jamais depuis le VPS - IP datacenter bloquee par YouTube) :"
echo "  python scripts/feeder.py data/mon_import.csv --targets vps --remote-url http://VOTRE_SERVEUR:3000"
echo ""

exec node server.js
