# Dockerfile pour Blindtest Films
# Build multi-stage avec Node.js et Python

FROM node:20-alpine AS base

# Installer Python, pip et ffmpeg
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    libc6-compat

# Creer un virtualenv pour Python
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Copier les fichiers de dependances
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY scripts/requirements.txt ./scripts/

# Installer les dependances Node.js
RUN npm ci

# Installer les dependances Python
RUN pip install --no-cache-dir -r scripts/requirements.txt

# Generer le client Prisma
RUN npx prisma generate

# Copier le reste du code
COPY . .

# Build Next.js
RUN npm run build

# Convertir les fins de ligne Windows -> Unix et rendre executable
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Exposer le port
EXPOSE 3000

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:/app/prisma/prod.db"

# Point d'entree
ENTRYPOINT ["./docker-entrypoint.sh"]
