import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/colors';

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  sublabel?: string;
  onPress?: () => void;
}

function StatCard({ icon, label, value, sublabel, onPress }: StatCardProps) {
  return (
    <Pressable
      style={styles.statCard}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sublabel && <Text style={styles.statSublabel}>{sublabel}</Text>}
    </Pressable>
  );
}

interface StatsGridProps {
  lifetimeOrders: number;
  creditsCents: number;
  currentStreak: number;
  referralCode: string;
  onCreditsPress?: () => void;
}

export function StatsGrid({
  lifetimeOrders,
  creditsCents,
  currentStreak,
  referralCode,
  onCreditsPress,
}: StatsGridProps) {
  const creditsDisplay = (creditsCents / 100).toFixed(2);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <StatCard
          icon="receipt-outline"
          label="Lifetime Orders"
          value={lifetimeOrders}
        />
        <StatCard
          icon="wallet-outline"
          label="Available Credits"
          value={`$${creditsDisplay}`}
          onPress={onCreditsPress}
        />
      </View>
      <View style={styles.row}>
        <StatCard
          icon="flame-outline"
          label="Current Streak"
          value={currentStreak}
          sublabel={currentStreak === 1 ? 'day' : 'days'}
        />
        <StatCard
          icon="share-outline"
          label="Referral Code"
          value={referralCode.slice(0, 8).toUpperCase()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
  },
  statSublabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});

export default StatsGrid;
