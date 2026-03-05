# Dockerfile pour Blindtest Films
# Multi-stage : builder lourd (deps completes) → runner leger (Node uniquement)

# ─── Stage 1 : Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Installer les deps et generer le client Prisma
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

# Copier le reste du code et builder Next.js
COPY . .
RUN npm run build

# ─── Stage 2 : Runner (sans Python, sans ffmpeg, sans source TS) ──────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Recuperer node_modules du builder (inclut prisma CLI et tsx, necessaires au runtime)
COPY --from=builder /app/node_modules ./node_modules

# Recuperer le build Next.js et les fichiers publics (audio/images exclus via .dockerignore)
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Fichiers runtime uniquement
COPY package.json ./
COPY next.config.ts ./
COPY prisma ./prisma/
COPY server.js ./
COPY docker-entrypoint.sh ./

# Convertir fins de ligne Windows -> Unix et rendre executable
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:/app/prisma/prod.db"

ENTRYPOINT ["./docker-entrypoint.sh"]
