# ─── Stage 1: Build ─────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

# ─── Stage 2: Run ───────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Default config location (mount your config here)
COPY config.example.yaml /app/config.yaml

ENV NODE_ENV=production

CMD ["node", "dist/index.js", "--config", "/app/config.yaml"]
