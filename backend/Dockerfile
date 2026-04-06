# ── Etapa 1: Builder ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifests primero (aprovecha cache de capas)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar fuentes y compilar TypeScript
COPY tsconfig.json ./
COPY .swcrc ./
COPY src ./src
RUN npm install --save-dev @swc/core @swc/cli && npx swc src -d dist --strip-leading-paths

# ── Etapa 2: Producción ───────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar artefactos compilados
COPY --from=builder /app/dist ./dist

# Usuario no-root por seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist/index.js"]
