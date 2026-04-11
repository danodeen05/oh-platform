import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors } from '@/lib/colors';
import { getUserCredits } from '@/lib/api';
import type { CreditsResponse, CreditEvent, CreditEventType } from '@/lib/types';

// Event type display config
const eventTypeConfig: Record<CreditEventType, { icon: string; color: string; label: string }> = {
  CASHBACK: { icon: '💰', color: colors.success, label: 'Cashback' },
  REFERRAL_SIGNUP: { icon: '🎁', color: colors.primary, label: 'Referral Signup Bonus' },
  REFERRAL_ORDER: { icon: '👥', color: colors.primary, label: 'Referral Order Credit' },
  REFERRAL_ORDER_PENDING: { icon: '⏳', color: colors.warning, label: 'Pending Referral Credit' },
  CREDIT_APPLIED: { icon: '🛒', color: colors.error, label: 'Credit Applied' },
  CREDIT_EXPIRED: { icon: '⌛', color: colors.textMuted, label: 'Credit Expired' },
  ADMIN_ADJUSTMENT: { icon: '⚙️', color: colors.textLight, label: 'Adjustment' },
  CHALLENGE_REWARD: { icon: '🏆', color: colors.success, label: 'Challenge Reward' },
  GIFT_EXCESS: { icon: '🎁', color: colors.primary, label: 'Gift Excess' },
};

// Get rank message based on position
function getRankMessage(rank: number, total: number): { message: string; emoji: string } {
  const percentile = (rank / total) * 100;
  if (rank === 1) return { message: 'Reigning Champion!', emoji: '👑' };
  if (rank <= 3) return { message: 'Elite Earner', emoji: '🏆' };
  if (rank <= 10) return { message: 'Top 10 Earner', emoji: '⭐' };
  if (percentile <= 10) return { message: 'Rising Star', emoji: '🌟' };
  if (percentile <= 25) return { message: 'On the Rise', emoji: '📈' };
  return { message: 'Building Momentum', emoji: '💪' };
}

// Transaction item component
function TransactionItem({ event }: { event: CreditEvent }) {
  const config = eventTypeConfig[event.type] || eventTypeConfig.ADMIN_ADJUSTMENT;
  const isPositive = event.amountCents > 0;

  return (
    <View style={styles.transactionItem}>
      <Text style={styles.transactionIcon}>{config.icon}</Text>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionLabel}>{config.label}</Text>
        <Text style={styles.transactionDate}>
          {format(new Date(event.createdAt), 'MMM d, yyyy · h:mm a')}
        </Text>
        {event.description && (
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {event.description}
          </Text>
        )}
      </View>
      <Text
        style={[
          styles.transactionAmount,
          { color: isPositive ? colors.success : colors.error },
        ]}
      >
        {isPositive ? '+' : ''}${(event.amountCents / 100).toFixed(2)}
      </Text>
    </View>
  );
}

export default function CreditsScreen() {
  const { user } = useUser();

  const {
    data: credits,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<CreditsResponse>({
    queryKey: ['userCredits', user?.id],
    queryFn: () => getUserCredits(user!.id),
    enabled: !!user?.id,
  });

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="wallet-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Your Credits</Text>
        <Text style={styles.emptySubtitle}>Sign in to view your credits</Text>
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

  const balance = credits?.balance || 0;
  const lifetimeEarnings = credits?.lifetimeEarningsCents || 0;
  const rank = credits?.rank || 0;
  const totalUsers = credits?.totalUsers || 1;
  const rankInfo = getRankMessage(rank, totalUsers);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      data={credits?.events || []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TransactionItem event={item} />}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <>
          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Credits</Text>
            <Text style={styles.balanceAmount}>
              ${(balance / 100).toFixed(2)}
            </Text>
            <Text style={styles.transactionCount}>
              {credits?.events?.length || 0} transactions
            </Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                ${(lifetimeEarnings / 100).toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>Lifetime Earnings</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.rankRow}>
                <Text style={styles.rankEmoji}>{rankInfo.emoji}</Text>
                <Text style={styles.statValue}>#{rank}</Text>
              </View>
              <Text style={styles.statLabel}>{rankInfo.message}</Text>
            </View>
          </View>

          {/* How to Earn */}
          <View style={styles.howToEarn}>
            <Text style={styles.howToEarnTitle}>How to Earn Credits</Text>
            <View style={styles.earnMethod}>
              <Text style={styles.earnIcon}>👥</Text>
              <View style={styles.earnInfo}>
                <Text style={styles.earnLabel}>Refer Friends</Text>
                <Text style={styles.earnDescription}>
                  Earn $5 when friends sign up + a % of their orders
                </Text>
              </View>
            </View>
            <View style={styles.earnMethod}>
              <Text style={styles.earnIcon}>🏆</Text>
              <View style={styles.earnInfo}>
                <Text style={styles.earnLabel}>Complete Challenges</Text>
                <Text style={styles.earnDescription}>
                  Earn credits by completing challenges
                </Text>
              </View>
            </View>
            <View style={styles.earnMethod}>
              <Text style={styles.earnIcon}>💰</Text>
              <View style={styles.earnInfo}>
                <Text style={styles.earnLabel}>Cashback</Text>
                <Text style={styles.earnDescription}>
                  Higher tiers earn automatic cashback on orders
                </Text>
              </View>
            </View>
          </View>

          {/* Transaction History Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyTransactions}>
          <Text style={styles.emptyTransactionsText}>
            No transactions yet. Start earning credits!
          </Text>
        </View>
      }
    />
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
  balanceCard: {
    backgroundColor: colors.primary,
    margin: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  transactionCount: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
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
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 4,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rankEmoji: {
    fontSize: 20,
  },
  howToEarn: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  howToEarnTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  earnMethod: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  earnIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  earnInfo: {
    flex: 1,
  },
  earnLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  earnDescription: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 18,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transactionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  transactionDescription: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 4,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyTransactions: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTransactionsText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
