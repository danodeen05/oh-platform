import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, getTierColor, getTierDisplayName, tierGradients } from '@/lib/colors';
import type { MembershipTier, TierProgress } from '@/lib/types';

interface TierCardProps {
  tier: MembershipTier;
  tierProgress: TierProgress;
  nextTier?: MembershipTier;
  onPress?: () => void;
}

export function TierCard({ tier, tierProgress, nextTier, onPress }: TierCardProps) {
  const tierKey = tier.toLowerCase().replace('_', '') as keyof typeof tierGradients;
  const gradient = tierGradients[tierKey] || tierGradients.chopstick;
  const tierColor = getTierColor(tier);

  return (
    <Pressable onPress={onPress}>
      <LinearGradient
        colors={gradient as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.header}>
          <View style={styles.tierInfo}>
            <Text style={styles.tierLabel}>Current Tier</Text>
            <Text style={styles.tierName}>{getTierDisplayName(tier)}</Text>
          </View>
          <View style={styles.iconContainer}>
            <Ionicons
              name="ribbon"
              size={32}
              color={tier === 'BEEF_BOSS' ? '#C7A878' : '#FFFFFF'}
            />
          </View>
        </View>

        {nextTier && (
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>
              Progress to {getTierDisplayName(nextTier)}
            </Text>

            {/* Orders Progress */}
            <View style={styles.progressRow}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressType}>Orders</Text>
                <Text style={styles.progressCount}>
                  {tierProgress.orders.current}/{tierProgress.orders.needed}
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${Math.min(tierProgress.orders.percent, 100)}%` },
                  ]}
                />
              </View>
            </View>

            {/* Referrals Progress */}
            <View style={styles.progressRow}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressType}>Referrals</Text>
                <Text style={styles.progressCount}>
                  {tierProgress.referrals.current}/{tierProgress.referrals.needed}
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${Math.min(tierProgress.referrals.percent, 100)}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        )}

        {!nextTier && (
          <View style={styles.maxTierSection}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.maxTierText}>You've reached the highest tier!</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tierInfo: {
    flex: 1,
  },
  tierLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tierName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSection: {
    marginTop: 20,
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressRow: {
    marginBottom: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressType: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  progressCount: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  maxTierSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  maxTierText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default TierCard;
