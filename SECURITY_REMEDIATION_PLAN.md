# Security Remediation Plan

**Created**: June 2, 2026
**Priority**: HIGH
**Status**: Planning

---

## Immediate Fixes Completed

- [x] Deleted `check-prod-db.js` (contained hardcoded database credentials)
- [x] Removed old credentials from `QUICK_REFERENCE.md`, `VERCEL_ENV_SETUP.md`, `DEPLOYMENT_CHECKLIST.md`
- [x] Updated `.gitignore` with missing credential file patterns
- [x] Fixed insecure default secrets in code (now fail in production if not configured)
- [x] Rotated all compromised credentials (Clerk, Stripe, Anthropic, Twilio, Railway)

---

## Phase 1: Git History Cleaning (Priority: HIGH)

### Why This Matters
Even though credentials have been rotated, the OLD credentials still exist in git history. Anyone with repo access can see them. While the old Railway database was deleted, this is still a security hygiene issue.

### Option A: BFG Repo-Cleaner (Recommended)
```bash
# 1. Clone a fresh copy
git clone --mirror git@github.com:danodeen05/oh-platform.git

# 2. Run BFG to remove sensitive data
bfg --delete-files check-prod-db.js oh-platform.git
bfg --replace-text passwords.txt oh-platform.git

# 3. Clean up
cd oh-platform.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. Force push (DANGEROUS - coordinate with team)
git push --force
```

### Option B: git filter-branch
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch check-prod-db.js" \
  --prune-empty --tag-name-filter cat -- --all
```

### Considerations
- Force pushing rewrites history for ALL collaborators
- Everyone must re-clone the repository after this
- Any open PRs will be invalidated
- **Best done during a maintenance window**

---

## Phase 2: API Security Hardening (Priority: CRITICAL)

### 2.1 Fix CORS Configuration
**Current**: `origin: true` (allows ALL origins)
**Target**: Whitelist specific domains

```javascript
// packages/api/src/index.js
await app.register(cors, {
  origin: [
    'https://ohbeef.com',
    'https://admin.ohbeef.com',
    'https://devapi.ohbeef.com',
    // Add staging domains as needed
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:3001'] : [])
  ],
  credentials: true
});
```

### 2.2 Add Authentication Middleware for Admin Routes
**Current**: ALL `/admin/*` endpoints are unprotected
**Target**: Require authentication for all admin routes

```javascript
// Create middleware
const requireAdminAuth = async (req, reply) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  try {
    // Verify with Clerk or your auth provider
    const session = await clerkClient.verifyToken(token);
    req.user = session;
  } catch (err) {
    return reply.code(401).send({ error: 'Invalid token' });
  }
};

// Apply to all admin routes
app.addHook('onRequest', async (req, reply) => {
  if (req.url.startsWith('/admin')) {
    await requireAdminAuth(req, reply);
  }
});
```

### 2.3 Add Rate Limiting
**Current**: No rate limiting
**Target**: Protect against brute force and DoS

```bash
pnpm add @fastify/rate-limit
```

```javascript
await app.register(require('@fastify/rate-limit'), {
  max: 100,        // 100 requests
  timeWindow: '1 minute',
  // Different limits for different routes
  keyGenerator: (req) => req.ip,
  errorResponseBuilder: (req, context) => ({
    code: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${context.after}`
  })
});
```

### 2.4 Fix Webhook Signature Verification
**Current**: Skipped if secret not configured
**Target**: Require verification in production

```javascript
// packages/api/src/triggers/webhooks.js
export function verifyStripeWebhook(payload, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('STRIPE_WEBHOOK_SECRET required in production');
    }
    console.warn('WARNING: Webhook verification disabled in development');
    return true;
  }
  // ... actual verification
}
```

### 2.5 Sanitize Error Messages
**Current**: Raw error messages sent to clients
**Target**: Generic messages to clients, detailed logs server-side

```javascript
// Global error handler
app.setErrorHandler((error, req, reply) => {
  // Log full error server-side
  console.error('API Error:', {
    path: req.url,
    method: req.method,
    error: error.message,
    stack: error.stack
  });

  // Send generic message to client
  const statusCode = error.statusCode || 500;
  reply.code(statusCode).send({
    error: statusCode >= 500 ? 'Internal Server Error' : error.message,
    code: error.code || 'UNKNOWN_ERROR'
  });
});
```

---

## Phase 3: Additional Security Measures (Priority: MEDIUM)

### 3.1 Add Security Headers
```bash
pnpm add @fastify/helmet
```

```javascript
await app.register(require('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Customize as needed
    }
  }
});
```

### 3.2 Implement Request Validation
```bash
pnpm add @fastify/type-provider-typebox @sinclair/typebox
```

### 3.3 Add Pre-commit Hooks for Secret Scanning
```bash
# Install git-secrets
brew install git-secrets  # or apt-get install git-secrets

# Configure for the repo
cd oh-platform
git secrets --install
git secrets --register-aws
git secrets --add 'sk_live_[a-zA-Z0-9]+'
git secrets --add 'sk_test_[a-zA-Z0-9]+'
git secrets --add 'postgresql://[^@]+@'
```

### 3.4 GitHub Secret Scanning
- Enable in repo Settings > Code security and analysis
- Enable "Secret scanning" and "Push protection"

---

## Implementation Timeline

| Phase | Task | Effort | Risk |
|-------|------|--------|------|
| 1 | Git history cleaning | 2 hours | Medium (requires coordination) |
| 2.1 | Fix CORS | 30 min | Low |
| 2.2 | Admin authentication | 2-4 hours | Medium |
| 2.3 | Rate limiting | 1 hour | Low |
| 2.4 | Webhook verification | 30 min | Low |
| 2.5 | Error sanitization | 1 hour | Low |
| 3 | Additional measures | 2-3 hours | Low |

---

## Environment Variables Checklist

Ensure these are set in production (Railway):

```env
# Required Security Variables
CRON_SECRET=<generate-secure-random-string>
WALLET_AUTH_SECRET=<generate-secure-random-string>
STRIPE_WEBHOOK_SECRET=<from-stripe-dashboard>
NODE_ENV=production

# Already rotated (verify they're set)
DATABASE_URL=<new-railway-url>
CLERK_SECRET_KEY=<new-clerk-key>
STRIPE_SECRET_KEY=<new-stripe-key>
ANTHROPIC_API_KEY=<new-anthropic-key>
TWILIO_API_KEY_SID=<new-twilio-key>
TWILIO_API_KEY_SECRET=<new-twilio-secret>
```

---

## Next Steps

1. **Review this plan** with your team
2. **Schedule maintenance window** for git history cleaning
3. **Prioritize API security fixes** (CORS, admin auth, rate limiting)
4. **Set up monitoring** for security events
5. **Consider a penetration test** after fixes are implemented

---

**Questions?** This plan was generated by the security audit. Adjust priorities based on your risk tolerance and available resources.
