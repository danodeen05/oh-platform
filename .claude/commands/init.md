# Initialize Development Session

Run the following initialization steps for this Oh Platform development session:

## 1. Copy Environment Files (if in worktree)
If the current directory is a git worktree (check if `.git` is a file pointing elsewhere):
- Copy `.env` from main repo `/Users/ddidericksen/Projects/oh/oh-platform/.env` if missing
- Copy `.env.local` from main repo `/Users/ddidericksen/Projects/oh/oh-platform/.env.local` if missing

## 2. Install Dependencies
Run `pnpm install` if `node_modules` doesn't exist or is incomplete.

## 3. Generate Prisma Client
Run `pnpm exec prisma generate` in the `packages/db` directory.

## 4. Start Development Servers
Start all three servers in background:
- Web app: `pnpm dev` (port 3000)
- Admin: `pnpm admin:dev` (port 3001)
- API: `pnpm api:dev` (port 4000)

## 5. Verify Servers
Wait a few seconds then verify all servers are responding.

## Summary
After running, report which servers are running and any issues encountered.
