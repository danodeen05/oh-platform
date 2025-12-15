#!/bin/bash
#
# Setup script for git worktrees
# Run this from any worktree to copy required .env.local files
#
# Usage:
#   ./scripts/setup-worktree.sh
#   or from worktree:
#   /path/to/main/repo/scripts/setup-worktree.sh

MAIN_REPO="/Users/ddidericksen/Projects/oh/oh-platform"

# Detect if we're in a worktree or main repo
CURRENT_DIR=$(pwd)

if [[ "$CURRENT_DIR" == "$MAIN_REPO" ]]; then
  echo "You're in the main repo. Run this from a worktree."
  exit 1
fi

echo "Setting up worktree: $CURRENT_DIR"
echo "Copying .env.local files from main repo..."

# Copy web app .env.local
if [[ -f "$MAIN_REPO/apps/web/.env.local" ]]; then
  cp "$MAIN_REPO/apps/web/.env.local" "$CURRENT_DIR/apps/web/.env.local"
  echo "  ✓ apps/web/.env.local"
else
  echo "  ⚠ apps/web/.env.local not found in main repo"
fi

# Copy admin app .env.local
if [[ -f "$MAIN_REPO/apps/admin/.env.local" ]]; then
  cp "$MAIN_REPO/apps/admin/.env.local" "$CURRENT_DIR/apps/admin/.env.local"
  echo "  ✓ apps/admin/.env.local"
else
  echo "  ⚠ apps/admin/.env.local not found in main repo"
fi

# Copy root .env if exists
if [[ -f "$MAIN_REPO/.env" ]]; then
  cp "$MAIN_REPO/.env" "$CURRENT_DIR/.env"
  echo "  ✓ .env"
fi

# Copy packages/api .env if exists
if [[ -f "$MAIN_REPO/packages/api/.env" ]]; then
  cp "$MAIN_REPO/packages/api/.env" "$CURRENT_DIR/packages/api/.env"
  echo "  ✓ packages/api/.env"
fi

echo ""
echo "Done! Worktree environment files are set up."
echo "You may need to restart any running dev servers."
