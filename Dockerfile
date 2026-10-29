# Dockerfile — Production container for BlindSpot
# Based on the official pinned Microsoft Playwright image
# Runs as non-root user (pwuser) for secure execution on Nebius AI Cloud / Serverless Endpoints

FROM mcr.microsoft.com/playwright:v1.64.1-noble

# Set working directory
WORKDIR /app

# Set non-interactive environment and production flag
ENV NODE_ENV=production \
    PORT=3000

# Copy root manifest and workspace package files for efficient layer caching
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/engine/package.json ./packages/engine/
COPY packages/detectors/package.json ./packages/detectors/
COPY packages/ai/package.json ./packages/ai/
COPY packages/fixer/package.json ./packages/fixer/
COPY packages/report/package.json ./packages/report/
COPY packages/bench/package.json ./packages/bench/

# Install dependencies
RUN npm ci

# Copy repository source code and fixtures
COPY tsconfig.json ./
COPY fixtures ./fixtures
COPY packages ./packages
COPY apps ./apps

# Build all workspace packages and UI assets
RUN npm run build --workspace=@blindspot/engine && \
    npm run build --workspace=@blindspot/detectors && \
    npm run build --workspace=@blindspot/ai && \
    npm run build --workspace=@blindspot/fixer && \
    npm run build --workspace=@blindspot/report && \
    npm run build --workspace=@blindspot/bench && \
    npm run build --workspace=@blindspot/web

# Create data directories and set permissions for pwuser
RUN mkdir -p /app/data/replays /app/artifacts && \
    chown -R pwuser:pwuser /app

# Switch to unprivileged non-root user
USER pwuser

# Expose web server port
EXPOSE 3000

# Health check route
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/fixtures || exit 1

# Default command: Start BlindSpot Web Server
CMD ["npx", "tsx", "apps/web/server.ts"]
