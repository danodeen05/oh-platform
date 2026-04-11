import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { TierCard } from '@/components/TierCard';
import { StatsGrid } from '@/components/StatsGrid';
import { colors, getTierDisplayName } from '@/lib/colors';
import { getUserProfile, setSession } from '@/lib/api';
import type { UserProfile } from '@/lib/types';

// Quick action button component
function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

// Challenge preview card
function ChallengePreview({
  name,
  progress,
  emoji,
  onPress,
}: {
  name: string;
  progress: number;
  emoji: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.challengeCard} onPress={onPress}>
      <Text style={styles.challengeEmoji}>{emoji}</Text>
      <View style={styles.challengeInfo}>
        <Text style={styles.challengeName} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.challengeProgressBar}>
          <View
            style={[
              styles.challengeProgressFill,
              { width: `${Math.min(progress, 100)}%` },
            ]}
          />
        </View>
      </View>
      <Text style={styles.challengePercent}>{Math.round(progress)}%</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { getToken } = useAuth();

  // Sync Clerk session to our API client
  React.useEffect(() => {
    async function syncSession() {
      if (user?.id) {
        const token = await getToken();
        if (token) {
          await setSession(token, user.id);
        }
      }
    }
    syncSession();
  }, [user?.id, getToken]);

  // Fetch user profile
  const {
    data: profile,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<UserProfile>({
    queryKey: ['userProfile', user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id,
  });

  // Loading state
  if (!isUserLoaded || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Not signed in state
  if (!user) {
    return (
      <View style={styles.signInContainer}>
        <Ionicons name="person-circle-outline" size={80} color={colors.textMuted} />
        <Text style={styles.signInTitle}>Welcome to Oh! Beef</Text>
        <Text style={styles.signInSubtitle}>
          Sign in to view your membership, credits, and order history
        </Text>
        <Pressable
          style={styles.signInButton}
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  // Get active challenges (not completed, not claimed)
  const activeChallenges = profile?.challenges?.filter(
    (c) => !c.completedAt && !c.rewardClaimed
  ) || [];

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
      {/* Greeting */}
      <View style={styles.greetingSection}>
        <Text style={styles.greeting}>
          Hello, {profile?.name || user.firstName || 'Member'}
        </Text>
        <Text style={styles.greetingSubtitle}>
          {getTierDisplayName(profile?.membershipTier || 'CHOPSTICK')} Member
        </Text>
      </View>

      {/* Tier Card */}
      {profile && (
        <TierCard
          tier={profile.membershipTier}
          tierProgress={profile.tierProgress}
          nextTier={profile.nextTier}
          onPress={() => router.push('/badges')}
        />
      )}

      {/* Stats Grid */}
      {profile && (
        <StatsGrid
          lifetimeOrders={profile.lifetimeOrderCount}
          creditsCents={profile.creditsCents}
          currentStreak={profile.currentStreak}
          referralCode={profile.referralCode}
          onCreditsPress={() => router.push('/credits')}
        />
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          <QuickAction
            icon="restaurant"
            label="Order Now"
            onPress={() => router.push('/(tabs)/order')}
          />
          <QuickAction
            icon="trophy"
            label="Challenges"
            onPress={() => router.push('/challenges')}
          />
          <QuickAction
            icon="ribbon"
            label="Badges"
            onPress={() => router.push('/badges')}
          />
          <QuickAction
            icon="wallet"
            label="Wallet"
            onPress={() => router.push('/credits')}
          />
        </View>
      </View>

      {/* Active Challenges Preview */}
      {activeChallenges.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Challenges</Text>
            <Pressable onPress={() => router.push('/challenges')}>
              <Text style={styles.seeAllLink}>See All</Text>
            </Pressable>
          </View>
          {activeChallenges.slice(0, 3).map((challenge) => {
            const progress = typeof challenge.progress === 'object'
              ? (Object.values(challenge.progress)[0] as number) || 0
              : 0;
            return (
              <ChallengePreview
                key={challenge.id}
                name={challenge.challenge.name}
                progress={progress}
                emoji={challenge.challenge.iconEmoji}
                onPress={() => router.push('/challenges')}
              />
            );
          })}
        </View>
      )}

      {/* Recent Badges Preview */}
      {profile?.badges && profile.badges.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Badges</Text>
            <Pressable onPress={() => router.push('/badges')}>
              <Text style={styles.seeAllLink}>See All</Text>
            </Pressable>
          </View>
          <View style={styles.badgesRow}>
            {profile.badges.slice(0, 5).map((userBadge) => (
              <View key={userBadge.id} style={styles.badgeItem}>
                <Text style={styles.badgeEmoji}>{userBadge.badge.iconEmoji}</Text>
                <Text style={styles.badgeName} numberOfLines={1}>
                  {userBadge.badge.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  signInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  signInTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  signInSubtitle: {
    fontSize: 15,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  signInButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  greetingSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
  },
  greetingSubtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  seeAllLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '500',
    textAlign: 'center',
  },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  challengeEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  challengeProgressBar: {
    height: 6,
    backgroundColor: colors.borderLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  challengeProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  challengePercent: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeItem: {
    alignItems: 'center',
    width: 64,
  },
  badgeEmoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  badgeName: {
    fontSize: 10,
    color: colors.textLight,
    textAlign: 'center',
  },
});
