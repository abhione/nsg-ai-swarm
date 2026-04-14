# ── NSG AI Swarm Worker ──
# Multi-stage build for the orchestrator worker

# --- Build stage ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# --- Runtime stage ---
FROM node:22-alpine AS runtime

WORKDIR /app

# Install only production dependencies
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/dist/ ./dist/

# Config volume mount point
VOLUME /app/config

# Default command
ENTRYPOINT ["node", "dist/index.js"]
CMD ["start", "--config", "/app/config/config.yaml"]

# Health check (validate config loads)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node dist/index.js validate --config /app/config/config.yaml || exit 1

# Labels
LABEL org.opencontainers.image.title="nsg-ai-swarm-worker"
LABEL org.opencontainers.image.description="Orchestrator bridging Paperclip with AI agent runtimes"
LABEL org.opencontainers.image.source="https://github.com/nsg-ai/nsg-ai-swarm"
