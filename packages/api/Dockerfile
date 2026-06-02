# Railway Dockerfile for API service
FROM node:20-slim

# Install pnpm
RUN npm install -g pnpm@9.15.9

# Set working directory
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db ./packages/db
COPY packages/api ./packages/api

# Install dependencies for db and api packages only
RUN pnpm install --filter @oh/db --filter @oh/api --frozen-lockfile

# Generate Prisma client (chmod guards against a non-executable cached prisma
# bin -> 'spawn prisma EACCES'; npx fallback fetches a fresh prisma if needed)
RUN cd packages/db && (chmod -R +x /app/node_modules/.bin /app/node_modules/.pnpm 2>/dev/null || true) && (pnpm prisma generate || npx --yes prisma@5.19.1 generate)

# Set working directory to API
WORKDIR /app/packages/api

# Expose port
EXPOSE 4000

# Start the API
CMD ["node", "src/index.js"]
