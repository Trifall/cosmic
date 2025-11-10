# Cosmic - Production Dockerfile
# Multi-stage build for optimal image size and security

# Stage 1: Dependencies
FROM oven/bun:1.3.2-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Stage 2: Builder
FROM oven/bun:1.3.2-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application with default env vars
# These are just for the build process - runtime values come from docker-compose
# Note: Some of these are dummy values required for the build to succeed
RUN NODE_ENV=production \
    PUBLIC_SITE_NAME="Cosmic" \
    PUBLIC_WEB_UI_URL="http://localhost:3000" \
    BETTER_AUTH_SECRET="build-time-secret-will-be-replaced-at-runtime" \
    DB_PASSWORD="build-time-password-will-be-replaced-at-runtime" \
    bun run build

# Stage 3: Runner (Production)
FROM oven/bun:1.3.2-alpine AS runner
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S cosmic -u 1001 -G nodejs

# Copy necessary files from builder
COPY --from=builder --chown=cosmic:nodejs /app/build ./build
COPY --from=builder --chown=cosmic:nodejs /app/package.json ./
COPY --from=builder --chown=cosmic:nodejs /app/database ./database

# Copy production dependencies from deps stage
COPY --from=deps --chown=cosmic:nodejs /app/node_modules ./node_modules

# Create directories that might be needed at runtime (as root before switching users)
RUN mkdir -p /app/backups && \
    chown -R cosmic:nodejs /app/backups

# Switch to non-root user
USER cosmic

# Expose the application port
EXPOSE 3000

# Health check (uses PORT env var if set, defaults to 3000)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD bun run -e "fetch('http://localhost:' + (process.env.PORT || '3000')).then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
# The db:deploy migration runs in docker-compose command, not here
CMD ["bun", "run", "start"]
