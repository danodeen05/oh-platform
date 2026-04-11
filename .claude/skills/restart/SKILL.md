---
name: restart
description: Kill and restart all three dev servers (API, Web, Admin) cleanly.
user-invocable: true
allowed-tools: Bash
model: haiku
---

# Restart Dev Servers

Kill and restart all three Oh Platform development servers.

## Steps

1. **Kill existing servers** - Find and kill all running dev server processes
2. **Start servers** - Start API (port 4000), Web (port 3000), and Admin (port 3001)
3. **Verify** - Confirm all servers are responding

## Commands to Execute

### Step 1: Kill existing servers
```bash
# Kill any processes using the dev server ports (most reliable method)
fuser -k 4000/tcp 3000/tcp 3001/tcp 2>/dev/null || true
sleep 2
```

### Step 2: Start servers
```bash
cd /home/claude-user/projects/oh-platform

# Start API server (port 4000)
nohup pnpm api:dev > /tmp/oh-api.log 2>&1 &

# Start Web server (port 3000)
nohup pnpm dev > /tmp/oh-web.log 2>&1 &

# Start Admin server (port 3001)
nohup pnpm admin:dev > /tmp/oh-admin.log 2>&1 &

sleep 5
```

### Step 3: Verify servers are running
```bash
# Check API
curl -s -o /dev/null -w "API (4000): %{http_code}\n" http://localhost:4000/locations

# Check Web
curl -s -o /dev/null -w "Web (3000): %{http_code}\n" http://localhost:3000

# Check Admin
curl -s -o /dev/null -w "Admin (3001): %{http_code}\n" http://localhost:3001
```

## Output

Report the status of each server:

| Server | Port | Status |
|--------|------|--------|
| API    | 4000 | [status] |
| Web    | 3000 | [status] |
| Admin  | 3001 | [status] |
