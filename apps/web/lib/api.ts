/**
 * API Configuration
 *
 * Centralized API URL configuration with sensible defaults for development.
 * This ensures the app doesn't crash if NEXT_PUBLIC_API_URL is not set.
 */

// Default to localhost:4000 for development if not set
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Helper for making API requests with tenant context
export function getApiUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}${normalizedPath}`;
}

// Default headers for API requests
export const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "x-tenant-slug": "oh",
};
