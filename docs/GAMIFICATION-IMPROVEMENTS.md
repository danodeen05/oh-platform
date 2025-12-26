# Gamification System Improvements

## Overview

This document outlines the current state of Oh!'s gamification systems (tiers, badges, challenges) and provides a roadmap for improvements. Use this as a reference for implementation sessions.

---

## Current System Status

| System | Status | Completeness |
|--------|--------|--------------|
| **Tiers** | Functional | ~85% |
| **Badges** | Partial | ~70% |
| **Challenges** | Schema only | ~5% |

---

## 1. Tier System

### Current Implementation

**Location:** `packages/api/src/index.js`

| Tier | Cashback | Referral Bonus | Requirements |
|------|----------|----------------|--------------|
| CHOPSTICK | 1% | $5 | Sign up |
| NOODLE_MASTER | 2% | $5 | 10 orders OR 5 referrals |
| BEEF_BOSS | 3% | $5 | 25 orders OR 10 referrals |

### Key Code Locations

| Component | File | Lines |
|-----------|------|-------|
| Tier benefits definition | `packages/api/src/index.js` | 3897-3932 |
| Tier upgrade logic | `packages/api/src/index.js` | 3969-4020 |
| Cashback award | `packages/api/src/index.js` | 2930-2951 |

### getTierBenefits() Function
```javascript
// packages/api/src/index.js ~line 3897
function getTierBenefits(tier) {
  const benefits = {
    CHOPSTICK: {
      referralBonus: 500,      // $5.00
      cashbackPercent: 1,
      perks: ["referralBonus", "cashback1", "earlyAccess"],
    },
    NOODLE_MASTER: {
      referralBonus: 500,      // $5.00
      cashbackPercent: 2,
      perks: ["referralBonus", "cashback2", "prioritySeating", "memberEvents", "freeBowlUpgrade"],
    },
    BEEF_BOSS: {
      referralBonus: 500,      // $5.00
      cashbackPercent: 3,
      perks: ["referralBonus", "cashback3", "merchandiseDrops", "premiumAddons", "vipGift"],
    },
  };
  return benefits[tier] || benefits.CHOPSTICK;
}
```

### Issues to Fix

#### 1. Threshold Mismatch (BUG)
**Location:** `packages/api/src/index.js:3985`

```javascript
// CURRENT (WRONG):
if (user.tierProgressOrders >= 50 || user.tierProgressReferrals >= 20) {
  newTier = "BEEF_BOSS";
}

// SHOULD BE:
if (user.tierProgressOrders >= 25 || user.tierProgressReferrals >= 10) {
  newTier = "BEEF_BOSS";
}
```

The UI (`messages/en.json:375`) says "25 orders + 10 referrals" but code requires 50/20.

#### 2. Missing Tier Downgrade
No logic exists to demote users who become inactive. Consider:
- Drop 1 tier if no orders in 90 days
- Send warning email at 60 days
- Reset progress counters on downgrade

#### 3. Unimplemented Perks
These perks are mentioned in UI but have no backend logic:
- `prioritySeating` - No queue priority for higher tiers
- `merchandiseDrops` - No exclusive merch system
- `premiumAddons` - No free add-on logic
- `vipGift` - No annual gift system

---

## 2. Badge System

### Current Implementation

**Location:** `packages/api/src/index.js:4023-4084`

### Badge Status

| Badge Slug | Name | Criteria | Implemented |
|-----------|------|----------|-------------|
| `first-order` | First Bowl | 1 order | ✅ YES |
| `10-orders` | Noodle Enthusiast | 10 orders | ✅ YES |
| `50-orders` | Beef Devotee | 50 orders | ✅ YES |
| `100-orders` | Century Club | 100 orders | ✅ YES |
| `first-referral` | Share the Love | 1 referral | ✅ YES |
| `10-referrals` | Influencer | 10 referrals | ✅ YES |
| `50-referrals` | Ambassador | 50 referrals | ✅ YES |
| `3-day-streak` | Hot Streak | 3-day streak | ✅ YES |
| `7-day-streak` | Weekly Warrior | 7-day streak | ✅ YES |
| `30-day-streak` | Legend | 30-day streak | ✅ YES |
| `vip` | VIP | Reach Beef Boss | ✅ YES |
| `tried-all-items` | Menu Master | Try all items | ❌ NO |
| `spicy-challenge` | Heat Seeker | Spicy 10x | ❌ NO |
| `grand-opening` | OG Member | Launch member | ❌ NO |

### checkAndAwardBadges() Function
```javascript
// packages/api/src/index.js ~line 4023
async function checkAndAwardBadges(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      badges: { select: { badgeId: true } },
      orders: { where: { paymentStatus: "PAID" } },
    },
  });

  // ... badge checking logic with hardcoded if/else statements
}
```

### Missing Badge Implementations

#### 1. Menu Master (`tried-all-items`)
**Problem:** No tracking of unique menu items ordered per user

**Solution:**
```javascript
// Add to checkAndAwardBadges():
const uniqueItemsOrdered = await prisma.orderItem.findMany({
  where: {
    order: { userId, paymentStatus: "PAID" }
  },
  distinct: ['menuItemId'],
  select: { menuItemId: true }
});

const totalMenuItems = await prisma.menuItem.count({
  where: { isActive: true, categoryType: { in: ['SOUP', 'NOODLE', 'ADDON', 'SIDE', 'DRINK', 'DESSERT'] } }
});

if (badge.slug === "tried-all-items" && uniqueItemsOrdered.length >= totalMenuItems) {
  shouldAward = true;
}
```

#### 2. Heat Seeker (`spicy-challenge`)
**Problem:** No spice level tracking in orders

**Solution:**
1. Add spice tracking to order customizations:
```javascript
// When creating order, track spice in customizations JSON:
customizations: {
  spiceLevel: "EXTRA_SPICY", // or numeric 1-3
  // ... other customizations
}
```

2. Query for spicy orders:
```javascript
const spicyOrderCount = await prisma.order.count({
  where: {
    userId,
    paymentStatus: "PAID",
    customizations: {
      path: ['spiceLevel'],
      gte: 2  // Medium or higher
    }
  }
});

if (badge.slug === "spicy-challenge" && spicyOrderCount >= 10) {
  shouldAward = true;
}
```

#### 3. OG Member (`grand-opening`)
**Problem:** No launch date check

**Solution:**
```javascript
const LAUNCH_DATE = new Date('2025-03-01'); // Set to actual launch date

if (badge.slug === "grand-opening" && user.createdAt <= LAUNCH_DATE) {
  shouldAward = true;
}
```

### Badge System Improvements

#### 1. Badge Progress API
Create endpoint to show progress toward badges:
```javascript
// GET /users/:id/badge-progress
app.get("/users/:id/badge-progress", async (req, reply) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({ where: { id } });

  return {
    "100-orders": {
      current: user.lifetimeOrderCount,
      required: 100,
      percent: Math.min(100, (user.lifetimeOrderCount / 100) * 100)
    },
    // ... other badges
  };
});
```

#### 2. Data-Driven Badge Logic
Replace hardcoded if/else with database-driven checks:
```javascript
// badges table could have a `criteria` JSON field:
{
  "type": "order_count",
  "threshold": 100
}
// Then check dynamically based on criteria type
```

---

## 3. Challenge System

### Database Schema (Exists but Unused)

**Location:** `packages/db/prisma/schema.prisma:573-607`

```prisma
model Challenge {
  id           String          @id @default(cuid())
  tenantId     String
  tenant       Tenant          @relation(fields: [tenantId], references: [id])
  name         String
  description  String?
  requirements Json            // e.g., {"type": "order_count", "target": 5}
  rewardCents  Int             @default(0)
  rewardType   String?         // "CREDIT", "BADGE", "FREE_ITEM"
  startsAt     DateTime?
  endsAt       DateTime?
  isActive     Boolean         @default(true)
  createdAt    DateTime        @default(now())
  userChallenges UserChallenge[]
}

model UserChallenge {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  challengeId String
  challenge   Challenge @relation(fields: [challengeId], references: [id])
  progress    Int       @default(0)
  completedAt DateTime?
  rewardedAt  DateTime?
  createdAt   DateTime  @default(now())

  @@unique([userId, challengeId])
}
```

### Current API Endpoints (Empty)

```javascript
// GET /challenges - Returns active challenges (line 3332)
// GET /users/:id/challenges - Returns user challenge progress (line 3345)
```

### Implementation Plan

#### Phase 1: Challenge CRUD (Admin)
```javascript
// POST /admin/challenges - Create challenge
app.post("/admin/challenges", async (req, reply) => {
  const { name, description, requirements, rewardCents, rewardType, startsAt, endsAt } = req.body;
  // Create challenge
});

// PATCH /admin/challenges/:id - Update challenge
// DELETE /admin/challenges/:id - Delete challenge
```

#### Phase 2: Challenge Progress Tracking
```javascript
// Add to order completion logic:
async function updateChallengeProgress(userId, orderData) {
  const activeChallenges = await prisma.challenge.findMany({
    where: {
      isActive: true,
      OR: [
        { startsAt: null },
        { startsAt: { lte: new Date() } }
      ],
      OR: [
        { endsAt: null },
        { endsAt: { gte: new Date() } }
      ]
    }
  });

  for (const challenge of activeChallenges) {
    const userChallenge = await prisma.userChallenge.upsert({
      where: { userId_challengeId: { userId, challengeId: challenge.id } },
      create: { userId, challengeId: challenge.id, progress: 1 },
      update: { progress: { increment: 1 } }
    });

    // Check completion
    if (userChallenge.progress >= challenge.requirements.target && !userChallenge.completedAt) {
      await completeChallenge(userChallenge.id, challenge);
    }
  }
}
```

#### Phase 3: Challenge Rewards
```javascript
async function completeChallenge(userChallengeId, challenge) {
  await prisma.userChallenge.update({
    where: { id: userChallengeId },
    data: { completedAt: new Date() }
  });

  if (challenge.rewardType === "CREDIT") {
    await prisma.user.update({
      where: { id: userChallenge.userId },
      data: { creditsCents: { increment: challenge.rewardCents } }
    });

    await prisma.creditEvent.create({
      data: {
        userId: userChallenge.userId,
        type: "CHALLENGE_REWARD",
        amountCents: challenge.rewardCents,
        description: `Challenge completed: ${challenge.name}`
      }
    });
  }

  await prisma.userChallenge.update({
    where: { id: userChallengeId },
    data: { rewardedAt: new Date() }
  });
}
```

#### Phase 4: Challenge UI
- Add challenges section to member dashboard
- Show active challenges with progress bars
- Celebration animation on completion
- Challenge history view

---

## 4. Implementation Priority

### Session 1: Quick Fixes
- [ ] Fix Beef Boss threshold (50 → 25 orders)
- [ ] Implement OG Member badge (date check)
- [ ] Add badge progress endpoint

### Session 2: Complete Badge System
- [ ] Add spice level tracking to orders
- [ ] Implement Heat Seeker badge
- [ ] Track unique items for Menu Master badge
- [ ] Add badge progress to member dashboard UI

### Session 3: Challenge System MVP
- [ ] Create challenge admin endpoints
- [ ] Implement progress tracking on order events
- [ ] Add reward disbursement
- [ ] Basic challenge UI on member dashboard

### Session 4: Tier Enhancements
- [ ] Implement tier downgrade logic
- [ ] Add priority seating logic
- [ ] Create tier upgrade celebration UI
- [ ] Add tier forecasting ("2 more orders to Noodle Master")

### Session 5: Gamification Polish
- [ ] Referral leaderboards
- [ ] Badge achievement notifications
- [ ] Streak celebration animations
- [ ] Mystery/hidden badges

---

## 5. User Model Fields Reference

```prisma
// packages/db/prisma/schema.prisma ~line 430
model User {
  // Tier & Progress
  membershipTier        MembershipTier @default(CHOPSTICK)
  tierProgressOrders    Int            @default(0)  // Orders in current tier
  tierProgressReferrals Int            @default(0)  // Referrals in current tier

  // Lifetime Stats
  lifetimeOrderCount    Int            @default(0)  // All-time orders
  lifetimeSpentCents    Int            @default(0)  // All-time spending

  // Streaks
  currentStreak         Int            @default(0)  // Current streak days
  longestStreak         Int            @default(0)  // Best streak ever
  lastOrderDate         DateTime?

  // Credits
  creditsCents          Int            @default(0)  // Available balance

  // Referrals
  referralCode          String?        @unique
  referredById          String?
}
```

---

## 6. Testing Checklist

### Tier System
- [ ] New user starts at CHOPSTICK
- [ ] User upgrades to NOODLE_MASTER after 10 orders
- [ ] User upgrades to BEEF_BOSS after 25 orders
- [ ] Cashback correctly calculated per tier
- [ ] Tier progress resets after upgrade

### Badge System
- [ ] First order awards "First Bowl" badge
- [ ] 10 orders awards "Noodle Enthusiast" badge
- [ ] Streak badges award correctly
- [ ] VIP badge awarded on Beef Boss upgrade
- [ ] Badges display correctly on member dashboard

### Challenge System
- [ ] Active challenges appear on dashboard
- [ ] Progress increments on order completion
- [ ] Rewards disbursed on completion
- [ ] Completed challenges show in history

---

## 7. Related Files

| Purpose | File Path |
|---------|-----------|
| API logic | `packages/api/src/index.js` |
| Database schema | `packages/db/prisma/schema.prisma` |
| Member dashboard | `apps/web/app/[locale]/member/member-dashboard.tsx` |
| Loyalty page | `apps/web/app/[locale]/loyalty/page.tsx` |
| EN translations | `apps/web/messages/en.json` |
| ES translations | `apps/web/messages/es.json` |
| ZH-CN translations | `apps/web/messages/zh-CN.json` |
| ZH-TW translations | `apps/web/messages/zh-TW.json` |

---

*Last updated: December 2024*
