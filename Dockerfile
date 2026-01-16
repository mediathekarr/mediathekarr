# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

# Copy package files and prisma schema (needed for postinstall)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Move standalone files to fixed location (folder name varies based on project dir)
RUN mkdir -p /app/standalone-out && cp -r /app/.next/standalone/*/* /app/standalone-out/

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

# Install runtime dependencies for FFmpeg extraction
RUN apk add --no-cache \
    tar \
    xz \
    wget \
    && rm -rf /var/cache/apk/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public folder
COPY --from=builder /app/public ./public

# Copy standalone build
COPY --from=builder /app/standalone-out/ ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma files
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create directories for data and downloads
RUN mkdir -p /app/prisma/data /app/downloads /app/ffmpeg \
    && chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 3000

# Environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:./prisma/data/mediathekarr.db"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/download?mode=version || exit 1

# Start the application
CMD ["node", "server.js"]
