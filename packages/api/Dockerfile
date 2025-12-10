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

# Generate Prisma client
RUN cd packages/db && pnpm prisma generate

# Set working directory to API
WORKDIR /app/packages/api

# Expose port
EXPOSE 4000

# Start the API
CMD ["node", "src/index.js"]
