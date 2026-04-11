/**
 * Oh! Beef Mobile App - API Client
 * Connects to the existing API at packages/api
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type {
  UserProfile,
  CreditsResponse,
  WalletResponse,
  Order,
  Badge,
  BadgeProgress,
  Challenge,
  UserChallenge,
  SavedPaymentMethod,
  Location,
} from './types';

// API URL - uses env variable, falls back to localhost in development
const API_URL = process.env.EXPO_PUBLIC_API_URL
  || (__DEV__ ? 'http://localhost:4000' : 'https://api.ohbeef.com');

// Token storage key
const TOKEN_KEY = 'clerk_session_token';
const USER_ID_KEY = 'user_id';

// Platform-aware storage helpers
async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

// Store session data
export async function setSession(token: string, userId: string): Promise<void> {
  await setItem(TOKEN_KEY, token);
  await setItem(USER_ID_KEY, userId);
}

// Clear session data
export async function clearSession(): Promise<void> {
  await deleteItem(TOKEN_KEY);
  await deleteItem(USER_ID_KEY);
}

// Get stored user ID
export async function getUserId(): Promise<string | null> {
  return getItem(USER_ID_KEY);
}

// Get stored token
export async function getToken(): Promise<string | null> {
  return getItem(TOKEN_KEY);
}

// API error class
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// Generic fetch wrapper
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const userId = await getUserId();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  if (userId) {
    (headers as Record<string, string>)['x-user-id'] = userId;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || `API error: ${response.status}`,
      response.status
    );
  }

  return response.json();
}

// ==================
// USER ENDPOINTS
// ==================

/**
 * Get user profile with all computed fields
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  return fetchApi<UserProfile>(`/users/${userId}/profile`);
}

/**
 * Get user credits and transaction history
 */
export async function getUserCredits(userId: string): Promise<CreditsResponse> {
  return fetchApi<CreditsResponse>(`/users/${userId}/credits`);
}

/**
 * Get user wallet info (Apple/Google Wallet links)
 */
export async function getUserWallet(userId: string): Promise<WalletResponse> {
  return fetchApi<WalletResponse>(`/users/${userId}/wallet`);
}

/**
 * Update user phone and SMS preferences
 */
export async function updateUserPhone(
  userId: string,
  phone?: string,
  smsOptIn?: boolean
): Promise<{ success: boolean }> {
  return fetchApi(`/users/${userId}/phone`, {
    method: 'PATCH',
    body: JSON.stringify({ phone, smsOptIn }),
  });
}

// ==================
// ORDER ENDPOINTS
// ==================

/**
 * Get user's order history
 */
export async function getUserOrders(userId: string): Promise<Order[]> {
  return fetchApi<Order[]>(`/users/${userId}/orders`);
}

/**
 * Get single order details
 */
export async function getOrder(orderId: string): Promise<Order> {
  return fetchApi<Order>(`/orders/${orderId}`);
}

/**
 * Get order status by QR code
 */
export async function getOrderStatus(qrCode: string): Promise<Order> {
  return fetchApi<Order>(`/orders/status?qr=${qrCode}`);
}

// ==================
// BADGE ENDPOINTS
// ==================

/**
 * Get all available badges
 */
export async function getBadges(): Promise<Badge[]> {
  return fetchApi<Badge[]>('/badges');
}

/**
 * Get user's badge progress
 */
export async function getUserBadgeProgress(userId: string): Promise<BadgeProgress[]> {
  return fetchApi<BadgeProgress[]>(`/users/${userId}/badge-progress`);
}

// ==================
// CHALLENGE ENDPOINTS
// ==================

/**
 * Get all active challenges
 */
export async function getChallenges(): Promise<Challenge[]> {
  return fetchApi<Challenge[]>('/challenges');
}

/**
 * Get user's challenge enrollments
 */
export async function getUserChallenges(userId: string): Promise<UserChallenge[]> {
  return fetchApi<UserChallenge[]>(`/users/${userId}/challenges`);
}

/**
 * Enroll in a challenge
 */
export async function enrollInChallenge(
  userId: string,
  challengeId: string
): Promise<UserChallenge> {
  return fetchApi<UserChallenge>(
    `/users/${userId}/challenges/${challengeId}/enroll`,
    { method: 'POST' }
  );
}

/**
 * Claim challenge reward
 */
export async function claimChallengeReward(
  userId: string,
  challengeId: string
): Promise<UserChallenge> {
  return fetchApi<UserChallenge>(
    `/users/${userId}/challenges/${challengeId}/claim`,
    { method: 'POST' }
  );
}

// ==================
// PAYMENT ENDPOINTS
// ==================

/**
 * Get saved payment methods
 */
export async function getPaymentMethods(userId: string): Promise<SavedPaymentMethod[]> {
  return fetchApi<SavedPaymentMethod[]>(`/users/${userId}/payment-methods`);
}

/**
 * Delete a saved payment method
 */
export async function deletePaymentMethod(
  userId: string,
  methodId: string
): Promise<{ success: boolean }> {
  return fetchApi(`/users/${userId}/payment-methods/${methodId}`, {
    method: 'DELETE',
  });
}

// ==================
// LOCATION ENDPOINTS
// ==================

/**
 * Get all locations
 */
export async function getLocations(): Promise<Location[]> {
  return fetchApi<Location[]>('/locations');
}

/**
 * Get location availability
 */
export async function getLocationAvailability(
  locationId: string
): Promise<{ availableSeats: number; avgWaitMinutes: number }> {
  return fetchApi(`/locations/${locationId}/availability`);
}

// ==================
// GUEST SESSION
// ==================

interface GuestSession {
  id: string;
  sessionToken: string;
}

/**
 * Create a guest session (for unauthenticated ordering)
 */
export async function createGuestSession(): Promise<GuestSession> {
  return fetchApi<GuestSession>('/guests', { method: 'POST' });
}

/**
 * Validate a guest session token
 */
export async function validateGuestSession(
  token: string
): Promise<{ valid: boolean; guestId: string }> {
  return fetchApi(`/guests/session/${token}`);
}
