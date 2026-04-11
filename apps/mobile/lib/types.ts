/**
 * Oh! Beef Mobile App - TypeScript Types
 * Based on API response structures
 */

// Membership tiers
export type MembershipTier = 'CHOPSTICK' | 'NOODLE_MASTER' | 'BEEF_BOSS';

// Badge categories
export type BadgeCategory = 'MILESTONE' | 'CHALLENGE' | 'REFERRAL' | 'SPECIAL' | 'STREAK';

// Credit event types
export type CreditEventType =
  | 'REFERRAL_SIGNUP'
  | 'REFERRAL_ORDER'
  | 'REFERRAL_ORDER_PENDING'
  | 'CASHBACK'
  | 'CREDIT_APPLIED'
  | 'CREDIT_EXPIRED'
  | 'ADMIN_ADJUSTMENT'
  | 'CHALLENGE_REWARD'
  | 'GIFT_EXCESS';

// Order status
export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'QUEUED'
  | 'PREPPING'
  | 'READY'
  | 'SERVING'
  | 'COMPLETED'
  | 'CANCELLED';

// Payment status
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';

// User profile
export interface User {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  membershipTier: MembershipTier;
  creditsCents: number;
  referralCode: string;
  referredById?: string;
  tierProgressOrders: number;
  tierProgressReferrals: number;
  lifetimeOrderCount: number;
  lifetimeSpentCents: number;
  currentStreak: number;
  longestStreak: number;
  lastOrderDate?: string;
  createdAt: string;
  smsOptIn: boolean;
}

// User profile with computed fields (from /users/:id/profile)
export interface UserProfile extends User {
  badges: UserBadge[];
  challenges: UserChallenge[];
  referrals: ReferralUser[];
  tierBenefits: TierBenefits;
  tierProgress: TierProgress;
  nextTier?: MembershipTier;
}

// Tier benefits
export interface TierBenefits {
  referralBonus: number;
  cashbackPercent: number;
  birthdayBonus: number;
  perks: string[];
}

// Tier progress
export interface TierProgress {
  orders: { current: number; needed: number; percent: number };
  referrals: { current: number; needed: number; percent: number };
}

// Badge
export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconEmoji: string;
  category: BadgeCategory;
  isActive: boolean;
}

// User badge (earned)
export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  badge: Badge;
  earnedAt: string;
}

// Badge progress (from /users/:id/badge-progress)
export interface BadgeProgress {
  badge: Badge;
  current: number;
  required: number;
  percent: number;
  earned: boolean;
  earnedAt?: string;
}

// Challenge
export interface Challenge {
  id: string;
  slug: string;
  name: string;
  description: string;
  rewardCents: number;
  iconEmoji: string;
  requirements: Record<string, unknown>;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
}

// User challenge enrollment
export interface UserChallenge {
  id: string;
  userId: string;
  challengeId: string;
  challenge: Challenge;
  progress: Record<string, unknown>;
  completedAt?: string;
  rewardClaimed: boolean;
  enrolledAt: string;
}

// Referral user (simplified)
export interface ReferralUser {
  id: string;
  email?: string;
  name?: string;
  createdAt: string;
  lifetimeOrderCount: number;
}

// Credit event
export interface CreditEvent {
  id: string;
  userId: string;
  type: CreditEventType;
  amountCents: number;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Credits response
export interface CreditsResponse {
  balance: number;
  referralCode: string;
  events: CreditEvent[];
  lifetimeEarningsCents: number;
  rank: number;
  totalUsers: number;
}

// Wallet response
export interface WalletResponse {
  user: {
    id: string;
    name?: string;
    tier: MembershipTier;
    credits: number;
    orders: number;
    streak: number;
    referralCode: string;
    memberSince: string;
  };
  walletLinks: {
    apple: string;
    google: string;
  };
  configured: {
    apple: boolean;
    google: boolean;
  };
}

// Menu item
export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  basePriceCents: number;
  additionalPriceCents?: number;
  includedQuantity?: number;
  categoryType: 'MAIN' | 'SLIDER' | 'ADDON' | 'SIDE' | 'DRINK' | 'DESSERT';
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  spiceLevel: number;
  imageUrl?: string;
}

// Order item
export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem: MenuItem;
  quantity: number;
  priceCents: number;
  selectedValue?: string;
}

// Location
export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  timezone: string;
  isOpen: boolean;
  availableSeats: number;
  totalSeats: number;
  avgWaitMinutes?: number;
}

// Order
export interface Order {
  id: string;
  orderNumber: string;
  kitchenOrderNumber: string;
  orderQrCode: string;
  userId?: string;
  locationId: string;
  location: Location;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalCents: number;
  taxCents: number;
  items: OrderItem[];
  childOrders?: Order[];
  seatId?: string;
  podNumber?: number;
  createdAt: string;
  paidAt?: string;
  arrivedAt?: string;
  completedTime?: string;
}

// Saved payment method
export interface SavedPaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: string;
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  createdAt: string;
}

// API response wrappers
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total?: number;
  };
}
