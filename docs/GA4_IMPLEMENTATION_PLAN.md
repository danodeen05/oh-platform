# GA4 Implementation Plan for Oh Platform

## Overview

This document outlines the GA4 (Google Analytics 4) event tracking implementation and funnel configuration for Oh Platform.

---

## 1. Environment Setup

### Enable GA4 Tracking

Add your GA4 Measurement ID to your environment files:

```bash
# .env and apps/web/.env.local
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Replace `G-XXXXXXXXXX` with your actual GA4 Measurement ID from the Google Analytics console.

---

## 2. Implemented Event Tracking

### Order Flow Events

| Event | File | Trigger | GA4 Event Name |
|-------|------|---------|----------------|
| Begin Checkout | `order/payment/payment-form.tsx:50` | Payment form loads | `begin_checkout` |
| Purchase | `order/confirmation/page.tsx:63` | Order confirmed & paid | `purchase` |
| Check-in | `order/check-in/page.tsx:43` | Customer checks in | `check_in` |
| Share | `order/confirmation/page.tsx:137` | Social share click | `share` |

### Menu & Cart Events

| Event | File | Trigger | GA4 Event Name |
|-------|------|---------|----------------|
| Add to Cart | `order/location/[locationId]/_components/enhanced-menu-builder.tsx:455` | Item quantity increased | `add_to_cart` |
| Location Selected | `order/location-selector.tsx:87` | User selects location | `location_selected` |
| Pod Selected | `enhanced-menu-builder.tsx:916` | User selects pod/seat | `pod_selected` |
| Category Viewed | `menu/page.tsx:329` | Category nav clicked | `menu_category_viewed` |

### Member & Engagement Events

| Event | File | Trigger | GA4 Event Name |
|-------|------|---------|----------------|
| Favorite Added | `member/orders/page.tsx:106` | Order favorited | `favorite_added` |
| Reorder | `member/orders/page.tsx:122` | Reorder button clicked | `reorder` |
| Copy Referral Link | `referral/referral-dashboard.tsx:223` | Link copied | `copy_referral_link` |
| Loyalty CTA Click | `loyalty/page.tsx:100` | Start earning clicked | `loyalty_cta_click` |

---

## 3. GA4 Funnel Configurations

### Primary: Order Conversion Funnel

Create this funnel in GA4 Admin > Data Display > Funnels

**Steps:**
1. `page_view` (page_location contains `/order`)
2. `location_selected`
3. `page_view` (page_location contains `/order/location/`)
4. `begin_checkout`
5. `purchase`

**Key Metrics:**
- Overall conversion rate
- Drop-off at each step
- Average time between steps

### Secondary: Member Acquisition Funnel

**Steps:**
1. `page_view` (any page)
2. `sign_up` (Clerk auth completion)
3. `page_view` (page_location contains `/member`)
4. `purchase` (first purchase)

### Retention: Reorder Funnel

**Steps:**
1. `page_view` (page_location contains `/member/orders`)
2. `reorder`
3. `begin_checkout`
4. `purchase`

### Engagement: Loyalty Funnel

**Steps:**
1. `page_view` (page_location contains `/loyalty`)
2. `loyalty_cta_click`
3. `sign_up` or `page_view` (page_location contains `/order`)
4. `purchase`

### Group Ordering Funnel

**Steps:**
1. `page_view` (page_location contains `/order?group=true`)
2. `location_selected`
3. `page_view` (page_location contains `/group/`)
4. Group members join (count unique users)
5. `purchase` (host completes payment)

---

## 4. Custom Dimensions & Metrics

Configure these in GA4 Admin > Data Display > Custom Definitions:

### Custom Dimensions

| Name | Scope | Parameter |
|------|-------|-----------|
| Location ID | Event | `location_id` |
| Location Name | Event | `location_name` |
| Pod Number | Event | `pod_number` |
| Order Number | Event | `order_number` |
| Loyalty Tier | User | `loyalty_tier` |
| Order Count | User | `order_count` |
| Referral Code | Event | `referral_code` |

### Custom Metrics

| Name | Scope | Parameter |
|------|-------|-----------|
| Arrival Deviation | Event | `arrival_deviation_minutes` |
| Cart Value | Event | `cart_value` |
| Items Count | Event | `items_count` |

---

## 5. GA4 Backend API Setup

### API Environment Variables

Add these to your API environment (`.env` or Railway):

```bash
# GA4 Property ID
GA_PROPERTY_ID=516268103

# Option A: Path to service account JSON file
GA_SERVICE_ACCOUNT_PATH=/path/to/service-account.json

# Option B: Inline JSON (for Railway/Vercel)
GA_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"..."}'
```

### API Endpoints

The following GA4 endpoints are available in the API:

| Endpoint | Description |
|----------|-------------|
| `GET /analytics/ga4/traffic` | Traffic overview with sessions, page views, bounce rate |
| `GET /analytics/ga4/pages` | Top pages by views |
| `GET /analytics/ga4/sources` | Traffic sources (source/medium) |
| `GET /analytics/ga4/devices` | Device breakdown (mobile/desktop/tablet) |
| `GET /analytics/ga4/geo` | Geographic distribution |
| `GET /analytics/ga4/realtime` | Real-time active users |
| `GET /analytics/ga4/funnel` | Order conversion funnel |
| `GET /analytics/ga4/hourly` | Hourly activity patterns |

All endpoints support `?period=` query param: `today`, `yesterday`, `week`, `month`, `quarter`, `year`

### Admin Portal Pages

- `/analytics/traffic` - Website Traffic dashboard
- `/analytics/funnel` - Conversion Funnel visualization

---

## 5b. GA4 MCP Server Setup (for Claude Code)

### Option A: mcp-google-analytics (Recommended)

```bash
claude mcp add google-analytics npx -y mcp-google-analytics \
  -e GA_PROPERTY_ID=516268103 \
  -e GA_SERVICE_ACCOUNT_JSON="$(cat ~/.config/oh-beef-noodle-soup-c9c451589012.json)"
```

### Verification

```bash
claude mcp list
```

You should see `google-analytics: ... - Connected`

---

## 6. Recommended GA4 Reports

### Real-Time Monitoring

- **Real-time Overview**: Monitor live user activity
- **Event Count by Event Name**: Track event firing in real-time

### Standard Reports

1. **Acquisition > Traffic Acquisition**: Source/medium analysis
2. **Engagement > Events**: All tracked events
3. **Monetization > Ecommerce Purchases**: Order analytics
4. **Retention**: Cohort analysis for returning customers

### Custom Explorations

1. **Funnel Exploration**: Use the funnels defined above
2. **Path Exploration**: User journey visualization
3. **Segment Overlap**: Compare user segments (new vs returning, loyalty tiers)

---

## 7. Event Debugging

### GA4 DebugView

1. Install the Google Analytics Debugger Chrome extension
2. Enable debug mode in the extension
3. Open GA4 Admin > Data Display > DebugView
4. Navigate through your app to see events fire in real-time

### Console Logging

The analytics utility already includes console logging when `window.gtag` is undefined:

```javascript
// Check browser console for these messages
console.warn("Analytics: gtag not available");
```

---

## 8. Implementation Checklist

### Before Go-Live

- [ ] Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` in production environment
- [ ] Verify GA4 data stream is receiving events
- [ ] Test all critical funnel steps
- [ ] Configure custom dimensions/metrics
- [ ] Set up funnel explorations

### Post-Launch

- [ ] Monitor real-time data for 24 hours
- [ ] Verify purchase events match actual orders
- [ ] Set up automated alerts for funnel drop-offs
- [ ] Create weekly reporting dashboards

---

## 9. Available Tracking Functions

Location: `apps/web/lib/analytics.ts`

| Function | Parameters |
|----------|------------|
| `pageview(url)` | URL string |
| `event({action, category, label, value, ...})` | Generic event |
| `trackViewItem({id, name, category, price})` | Item view |
| `trackAddToCart({id, name, category, price, quantity})` | Add to cart |
| `trackRemoveFromCart({id, name, price, quantity})` | Remove from cart |
| `trackBeginCheckout({items, total})` | Checkout start |
| `trackPurchase({orderId, total, items})` | Purchase complete |
| `trackLocationSelected({id, name, city})` | Location selection |
| `trackPodSelected({number, locationId})` | Pod selection |
| `trackCheckIn({orderId, locationId, arrivalDeviation})` | Check-in |
| `trackMenuCategoryViewed(category)` | Menu category view |
| `trackLoyaltySignup()` | Loyalty signup |
| `trackReferralCodeUsed(code)` | Referral code use |
| `trackFavoriteAdded({id, name})` | Favorite order |
| `trackReorder(orderId)` | Reorder |
| `trackSignUp(method)` | Sign up |
| `trackLogin(method)` | Login |
| `setUserProperties({tier, orderCount, lifetimeSpent})` | User properties |

---

## 10. Next Steps

1. **Immediate**: Add `NEXT_PUBLIC_GA_MEASUREMENT_ID` to production
2. **Week 1**: Configure custom dimensions and funnels in GA4
3. **Week 2**: Set up MCP server for conversational analytics
4. **Week 3**: Create automated reporting dashboards
5. **Ongoing**: Monitor funnel performance and optimize drop-off points
