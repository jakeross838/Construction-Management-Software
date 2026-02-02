# =============================================================================
# Ross Built Construction Management Software - Dockerfile
# Multi-stage build for optimized production image
# =============================================================================

# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

# Copy client package files first for better layer caching
COPY client/package*.json ./

# Install client dependencies
RUN npm ci

# Copy client source code
COPY client/ ./

# Build the React frontend
RUN npm run build

# -----------------------------------------------------------------------------

# Stage 2: Build server dependencies
FROM node:20-alpine AS server-builder

WORKDIR /app

# Install build dependencies for native modules (canvas, sharp)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev

# Copy package files for server
COPY package*.json ./

# Install all dependencies (including dev for build, but production deps will be pruned)
RUN npm ci --only=production

# -----------------------------------------------------------------------------

# Stage 3: Production image
FROM node:20-alpine AS production

# Add labels for container identification
LABEL maintainer="Ross Built Custom Homes"
LABEL application="Ross Built CMS"
LABEL version="2.0.0"

# Install runtime dependencies for canvas and sharp
RUN apk add --no-cache \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg \
    pixman \
    fontconfig \
    ttf-dejavu \
    dumb-init

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S rossbuilt -u 1001 -G nodejs

# Copy built node_modules from server-builder
COPY --from=server-builder /app/node_modules ./node_modules

# Copy package files
COPY package*.json ./

# Copy server source code
COPY server/ ./server/
COPY config/ ./config/

# Copy built React frontend from frontend-builder
COPY --from=frontend-builder /app/client/dist ./client/dist

# Create necessary directories with proper ownership
RUN mkdir -p /app/logs /app/uploads && \
    chown -R rossbuilt:nodejs /app

# Switch to non-root user
USER rossbuilt

# Expose the application port
EXPOSE 3001

# Environment variables (defaults, override in docker-compose or runtime)
ENV NODE_ENV=production
ENV PORT=3001

# Health check - uses existing /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Use dumb-init as PID 1 to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the Node.js server
CMD ["node", "server/index.js"]
