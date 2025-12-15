#!/bin/bash
# Initialize a git worktree for Oh Platform development
# Usage: ./scripts/init-worktree.sh [worktree-path]

set -e

MAIN_REPO="/Users/ddidericksen/Projects/oh/oh-platform"
WORKTREE_PATH="${1:-$(pwd)}"

echo "Initializing worktree at: $WORKTREE_PATH"

# Check if we're in a worktree
if [ -f "$WORKTREE_PATH/.git" ]; then
    echo "Detected git worktree"
else
    echo "Not a worktree, checking if it's the main repo..."
    if [ "$WORKTREE_PATH" = "$MAIN_REPO" ]; then
        echo "Running in main repo"
    else
        echo "Warning: Not a recognized repo location"
    fi
fi

# Copy env files if missing
if [ ! -f "$WORKTREE_PATH/.env" ] && [ -f "$MAIN_REPO/.env" ]; then
    cp "$MAIN_REPO/.env" "$WORKTREE_PATH/.env"
    echo "Copied .env to root"
fi

# Copy .env.local to apps/web (where Next.js looks for it)
if [ ! -f "$WORKTREE_PATH/apps/web/.env.local" ] && [ -f "$MAIN_REPO/apps/web/.env.local" ]; then
    cp "$MAIN_REPO/apps/web/.env.local" "$WORKTREE_PATH/apps/web/.env.local"
    echo "Copied .env.local to apps/web"
fi

# Copy .env.local to apps/admin if it exists
if [ ! -f "$WORKTREE_PATH/apps/admin/.env.local" ] && [ -f "$MAIN_REPO/apps/admin/.env.local" ]; then
    cp "$MAIN_REPO/apps/admin/.env.local" "$WORKTREE_PATH/apps/admin/.env.local"
    echo "Copied .env.local to apps/admin"
fi

# Install dependencies if needed
if [ ! -d "$WORKTREE_PATH/node_modules" ]; then
    echo "Installing dependencies..."
    cd "$WORKTREE_PATH" && pnpm install
fi

# Generate Prisma client
echo "Generating Prisma client..."
cd "$WORKTREE_PATH/packages/db" && pnpm exec prisma generate

echo ""
echo "Initialization complete!"
echo ""
echo "To start servers, run:"
echo "  pnpm dev          # Web app (port 3000)"
echo "  pnpm admin:dev    # Admin (port 3001)"
echo "  pnpm api:dev      # API (port 4000)"
