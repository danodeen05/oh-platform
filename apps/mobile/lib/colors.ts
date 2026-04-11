/**
 * Oh! Beef Mobile App - Color System
 * Matches the web app's design tokens
 */

export const colors = {
  // Primary brand color
  primary: '#7C7A67',
  primaryLight: 'rgba(124, 122, 103, 0.15)',

  // Background colors
  background: '#FAFAF8',
  surface: '#FFFFFF',
  surfaceLight: 'rgba(255, 255, 255, 0.7)',

  // Text colors
  text: '#222222',
  textLight: '#666666',
  textMuted: '#999999',

  // Tier colors
  tiers: {
    chopstick: '#C7A878',
    noodleMaster: '#7C7A67',
    beefBoss: '#222222',
  },

  // Status colors
  success: '#4A5D23',
  successLight: 'rgba(74, 93, 35, 0.15)',
  warning: '#8B6914',
  warningLight: 'rgba(199, 168, 120, 0.2)',
  error: '#8B3A3A',
  errorLight: 'rgba(139, 58, 58, 0.15)',

  // Order status colors
  orderStatus: {
    queued: '#f59e0b',
    preparing: '#3b82f6',
    ready: '#22c55e',
    completed: '#666666',
    cancelled: '#ef4444',
  },

  // Pod colors
  pod: {
    available: '#22c55e',
    dualPod: '#0891b2',
    cleaning: '#f59e0b',
    occupied: '#ef4444',
    selected: '#7C7A67',
  },

  // Border colors
  border: 'rgba(124, 122, 103, 0.2)',
  borderLight: 'rgba(124, 122, 103, 0.1)',

  // Accent colors
  accent: '#7C7A67',
};

// Tier gradients for LinearGradient
export const tierGradients = {
  chopstick: ['#D4C4A8', '#C7A878'],
  noodleMaster: ['#8C8A77', '#7C7A67'],
  beefBoss: ['#333333', '#222222'],
};

// Get tier color by tier name
export function getTierColor(tier: string): string {
  switch (tier.toUpperCase()) {
    case 'CHOPSTICK':
      return colors.tiers.chopstick;
    case 'NOODLE_MASTER':
      return colors.tiers.noodleMaster;
    case 'BEEF_BOSS':
      return colors.tiers.beefBoss;
    default:
      return colors.tiers.chopstick;
  }
}

// Get tier display name
export function getTierDisplayName(tier: string): string {
  switch (tier.toUpperCase()) {
    case 'CHOPSTICK':
      return 'Chopstick';
    case 'NOODLE_MASTER':
      return 'Noodle Master';
    case 'BEEF_BOSS':
      return 'Beef Boss';
    default:
      return tier;
  }
}

export default colors;
