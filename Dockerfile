# ===============================================
# Multi-stage Dockerfile for Production Deployment
# Optimized for security, performance, and size
# ===============================================

# Stage 1: Base image with security updates
FROM node:24-alpine AS base

# Install security updates and required packages
RUN apk add --no-cache --upgrade \
    dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Create app directory with proper permissions
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ===============================================
# Stage 2: Builder
# ===============================================
FROM base AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev dependencies for building)
RUN pnpm config set store-dir /app/.pnpm-store && \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application with optimizations
RUN pnpm build && \
    # Remove source maps in production for security
    find dist -name "*.map" -delete && \
    # Remove test files
    find dist -name "*.spec.js" -delete && \
    find dist -name "*.test.js" -delete

# ===============================================
# Stage 3: Production
# ===============================================
FROM base AS production

# Set production environment
ENV NODE_ENV=production

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm config set store-dir /app/.pnpm-store && \
    pnpm install --frozen-lockfile --prod && \
    pnpm store prune && \
    # Clean up pnpm cache
    rm -rf /app/.pnpm-store

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Create directories for logs and temp files
RUN mkdir -p /app/logs /app/tmp && \
    chown -R nestjs:nodejs /app/logs /app/tmp

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check using node instead of curl to reduce attack surface
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
