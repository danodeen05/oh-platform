import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors, getTierDisplayName, getTierColor } from '@/lib/colors';
import { getUserProfile, getUserBadgeProgress } from '@/lib/api';
import type { UserProfile, BadgeProgress, BadgeCategory } from '@/lib/types';

// Badge category display config
const categoryConfig: Record<BadgeCategory, { title: string; icon: string }> = {
  MILESTONE: { title: 'Milestones', icon: '🏁' },
  STREAK: { title: 'Streaks', icon: '🔥' },
  REFERRAL: { title: 'Referrals', icon: '👥' },
  CHALLENGE: { title: 'Challenges', icon: '🏆' },
  SPECIAL: { title: 'Special', icon: '⭐' },
};

// Badge card component
function BadgeCard({ badge, earned }: { badge: BadgeProgress; earned: boolean }) {
  return (
    <View style={[styles.badgeCard, earned && styles.badgeCardEarned]}>
      <View style={styles.badgeIconContainer}>
        <Text style={styles.badgeEmoji}>{badge.badge.iconEmoji}</Text>
        {earned && (
          <View style={styles.earnedBadge}>
            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
          </View>
        )}
      </View>
      <Text style={styles.badgeName} numberOfLines={2}>
        {badge.badge.name}
      </Text>
      {!earned && badge.required > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(badge.percent, 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {badge.current}/{badge.required}
          </Text>
        </View>
      )}
      {earned && badge.earnedAt && (
        <Text style={styles.earnedDate}>
          {format(new Date(badge.earnedAt), 'MMM d, yyyy')}
        </Text>
      )}
    </View>
  );
}

// Tier info card
function TierInfoCard({ profile }: { profile: UserProfile }) {
  const tierColor = getTierColor(profile.membershipTier);

  return (
    <View style={[styles.tierCard, { borderColor: tierColor }]}>
      <View style={styles.tierHeader}>
        <View>
          <Text style={styles.tierLabel}>Current Tier</Text>
          <Text style={[styles.tierName, { color: tierColor }]}>
            {getTierDisplayName(profile.membershipTier)}
          </Text>
        </View>
        <View style={[styles.tierIconCircle, { backgroundColor: tierColor }]}>
          <Ionicons name="ribbon" size={24} color="#FFFFFF" />
        </View>
      </View>

      {/* Benefits */}
      {profile.tierBenefits && (
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>Your Benefits</Text>
          <View style={styles.benefitsList}>
            {profile.tierBenefits.cashbackPercent > 0 && (
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.benefitText}>
                  {profile.tierBenefits.cashbackPercent}% cashback on orders
                </Text>
              </View>
            )}
            {profile.tierBenefits.referralBonus > 0 && (
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.benefitText}>
                  ${profile.tierBenefits.referralBonus} referral bonus
                </Text>
              </View>
            )}
            {profile.tierBenefits.birthdayBonus > 0 && (
              <View style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.benefitText}>
                  ${profile.tierBenefits.birthdayBonus} birthday bonus
                </Text>
              </View>
            )}
            {profile.tierBenefits.perks?.map((perk, index) => (
              <View key={index} style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.benefitText}>{perk}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Progress to next tier */}
      {profile.nextTier && profile.tierProgress && (
        <View style={styles.progressSection}>
          <Text style={styles.progressTitle}>
            Progress to {getTierDisplayName(profile.nextTier)}
          </Text>
          <View style={styles.tierProgressRow}>
            <View style={styles.tierProgressItem}>
              <Text style={styles.tierProgressLabel}>Orders</Text>
              <View style={styles.tierProgressBar}>
                <View
                  style={[
                    styles.tierProgressFill,
                    { width: `${Math.min(profile.tierProgress.orders.percent, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.tierProgressCount}>
                {profile.tierProgress.orders.current}/{profile.tierProgress.orders.needed}
              </Text>
            </View>
            <View style={styles.tierProgressItem}>
              <Text style={styles.tierProgressLabel}>Referrals</Text>
              <View style={styles.tierProgressBar}>
                <View
                  style={[
                    styles.tierProgressFill,
                    { width: `${Math.min(profile.tierProgress.referrals.percent, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.tierProgressCount}>
                {profile.tierProgress.referrals.current}/{profile.tierProgress.referrals.needed}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default function BadgesScreen() {
  const { user } = useUser();

  // Fetch user profile for tier info
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['userProfile', user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id,
  });

  // Fetch badge progress
  const {
    data: badges,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<BadgeProgress[]>({
    queryKey: ['badgeProgress', user?.id],
    queryFn: () => getUserBadgeProgress(user!.id),
    enabled: !!user?.id,
  });

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="ribbon-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Badges & Tiers</Text>
        <Text style={styles.emptySubtitle}>Sign in to view your badges</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Group badges by category
  const badgesByCategory = (badges || []).reduce((acc, badge) => {
    const category = badge.badge.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(badge);
    return acc;
  }, {} as Record<BadgeCategory, BadgeProgress[]>);

  // Sort badges within each category: earned first, then by progress
  Object.keys(badgesByCategory).forEach((category) => {
    badgesByCategory[category as BadgeCategory].sort((a, b) => {
      if (a.earned && !b.earned) return -1;
      if (!a.earned && b.earned) return 1;
      return b.percent - a.percent;
    });
  });

  const earnedCount = badges?.filter((b) => b.earned).length || 0;
  const totalCount = badges?.length || 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
    >
      {/* Stats */}
      <View style={styles.statsCard}>
        <Text style={styles.statsValue}>
          {earnedCount}/{totalCount}
        </Text>
        <Text style={styles.statsLabel}>Badges Earned</Text>
      </View>

      {/* Tier Info */}
      {profile && <TierInfoCard profile={profile} />}

      {/* Badges by Category */}
      {(Object.keys(categoryConfig) as BadgeCategory[]).map((category) => {
        const categoryBadges = badgesByCategory[category] || [];
        if (categoryBadges.length === 0) return null;

        const config = categoryConfig[category];
        return (
          <View key={category} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryIcon}>{config.icon}</Text>
              <Text style={styles.categoryTitle}>{config.title}</Text>
            </View>
            <View style={styles.badgesGrid}>
              {categoryBadges.map((badge) => (
                <BadgeCard
                  key={badge.badge.id}
                  badge={badge}
                  earned={badge.earned}
                />
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textLight,
    marginTop: 8,
  },
  statsCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  statsValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  tierCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    marginBottom: 24,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tierLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 4,
  },
  tierIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 16,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  benefitsList: {
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 14,
    color: colors.textLight,
  },
  progressSection: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 16,
    marginTop: 16,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  tierProgressRow: {
    flexDirection: 'row',
    gap: 16,
  },
  tierProgressItem: {
    flex: 1,
  },
  tierProgressLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  tierProgressBar: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tierProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  tierProgressCount: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 4,
    textAlign: 'right',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '30%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.6,
  },
  badgeCardEarned: {
    opacity: 1,
    borderColor: colors.primary,
  },
  badgeIconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  badgeEmoji: {
    fontSize: 36,
  },
  earnedBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeName: {
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '500',
    minHeight: 28,
  },
  progressContainer: {
    width: '100%',
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  earnedDate: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
  },
});
