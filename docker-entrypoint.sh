#!/bin/sh
set -e

echo "=== Blindtest Films - Demarrage ==="

# 1. Supprimer l'ancienne base de donnees
echo "[1/5] Suppression de l'ancienne base de donnees..."
rm -f /app/prisma/prod.db /app/prisma/prod.db-journal

# 2. Creer la base de donnees avec Prisma
echo "[2/5] Creation de la base de donnees..."
npx prisma db push --skip-generate

# 3. Lancer le seed Prisma (categories)
echo "[3/5] Initialisation des categories..."
npm run db:seed

# 4. Demarrer le serveur en arriere-plan
echo "[4/5] Demarrage du serveur..."
node server.js &
SERVER_PID=$!

# Attendre que le serveur soit pret
echo "Attente du serveur..."
sleep 5

# Verifier que le serveur repond
MAX_RETRIES=30
RETRY_COUNT=0
until wget -q --spider http://localhost:3000 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "ERREUR: Le serveur n'a pas demarre dans les temps"
        exit 1
    fi
    echo "Serveur pas encore pret, nouvelle tentative dans 2s... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

echo "Serveur pret!"

# 5. Lancer les fixtures Python
echo "[5/5] Import des donnees (fixtures)..."
if [ -n "$OMDB_API_KEY" ]; then
    cd /app
    python scripts/fixtures.py --categories films --api-key "$OMDB_API_KEY" --api-url http://localhost:3000 || {
        echo "AVERTISSEMENT: L'import des fixtures a echoue, mais le serveur continue..."
    }
else
    echo "AVERTISSEMENT: OMDB_API_KEY non definie, fixtures ignorees"
fi

echo "=== Blindtest Films - Pret! ==="
echo "Serveur accessible sur http://localhost:3000"

# Ramener le serveur au premier plan
wait $SERVER_PID
