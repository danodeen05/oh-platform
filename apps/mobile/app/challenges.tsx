import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { format, isPast, isFuture } from 'date-fns';
import { colors } from '@/lib/colors';
import {
  getChallenges,
  getUserChallenges,
  enrollInChallenge,
  claimChallengeReward,
} from '@/lib/api';
import type { Challenge, UserChallenge } from '@/lib/types';

// Challenge card component
function ChallengeCard({
  challenge,
  enrollment,
  onEnroll,
  onClaim,
  isEnrolling,
  isClaiming,
}: {
  challenge: Challenge;
  enrollment?: UserChallenge;
  onEnroll: () => void;
  onClaim: () => void;
  isEnrolling: boolean;
  isClaiming: boolean;
}) {
  const isEnrolled = !!enrollment;
  const isCompleted = !!enrollment?.completedAt;
  const isClaimed = !!enrollment?.rewardClaimed;

  // Calculate progress
  let progress = 0;
  if (enrollment?.progress && typeof enrollment.progress === 'object') {
    const values = Object.values(enrollment.progress) as number[];
    if (values.length > 0) {
      const current = values[0] || 0;
      const required = challenge.requirements
        ? (Object.values(challenge.requirements)[0] as number) || 1
        : 1;
      progress = Math.min((current / required) * 100, 100);
    }
  }

  // Check if challenge is active
  const isExpired = challenge.endsAt ? isPast(new Date(challenge.endsAt)) : false;
  const isNotStarted = challenge.startsAt ? isFuture(new Date(challenge.startsAt)) : false;

  return (
    <View style={styles.challengeCard}>
      {/* Header */}
      <View style={styles.challengeHeader}>
        <Text style={styles.challengeEmoji}>{challenge.iconEmoji}</Text>
        <View style={styles.challengeInfo}>
          <Text style={styles.challengeName}>{challenge.name}</Text>
          <Text style={styles.challengeDescription} numberOfLines={2}>
            {challenge.description}
          </Text>
        </View>
        <View style={styles.rewardBadge}>
          <Text style={styles.rewardText}>
            ${(challenge.rewardCents / 100).toFixed(0)}
          </Text>
        </View>
      </View>

      {/* Dates */}
      {(challenge.startsAt || challenge.endsAt) && (
        <View style={styles.datesRow}>
          {challenge.startsAt && (
            <Text style={styles.dateText}>
              Starts: {format(new Date(challenge.startsAt), 'MMM d')}
            </Text>
          )}
          {challenge.endsAt && (
            <Text style={styles.dateText}>
              Ends: {format(new Date(challenge.endsAt), 'MMM d')}
            </Text>
          )}
        </View>
      )}

      {/* Progress (if enrolled) */}
      {isEnrolled && !isClaimed && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%` },
                isCompleted && styles.progressFillComplete,
              ]}
            />
          </View>
        </View>
      )}

      {/* Action Button */}
      <View style={styles.actionSection}>
        {!isEnrolled && !isExpired && !isNotStarted && (
          <Pressable
            style={styles.enrollButton}
            onPress={onEnroll}
            disabled={isEnrolling}
          >
            {isEnrolling ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.enrollButtonText}>Enroll</Text>
              </>
            )}
          </Pressable>
        )}

        {isNotStarted && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>Coming Soon</Text>
          </View>
        )}

        {isExpired && !isEnrolled && (
          <View style={[styles.statusBadge, styles.statusBadgeExpired]}>
            <Text style={[styles.statusBadgeText, styles.statusBadgeTextExpired]}>
              Expired
            </Text>
          </View>
        )}

        {isEnrolled && !isCompleted && (
          <View style={[styles.statusBadge, styles.statusBadgeInProgress]}>
            <Text style={[styles.statusBadgeText, styles.statusBadgeTextInProgress]}>
              In Progress
            </Text>
          </View>
        )}

        {isCompleted && !isClaimed && (
          <Pressable
            style={styles.claimButton}
            onPress={onClaim}
            disabled={isClaiming}
          >
            {isClaiming ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="gift" size={18} color="#FFFFFF" />
                <Text style={styles.claimButtonText}>
                  Claim ${(challenge.rewardCents / 100).toFixed(0)}
                </Text>
              </>
            )}
          </Pressable>
        )}

        {isClaimed && (
          <View style={[styles.statusBadge, styles.statusBadgeClaimed]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.statusBadgeText, styles.statusBadgeTextClaimed]}>
              Claimed
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function ChallengesScreen() {
  const { user } = useUser();
  const queryClient = useQueryClient();

  // Fetch all challenges
  const {
    data: challenges,
    isLoading: isChallengesLoading,
  } = useQuery<Challenge[]>({
    queryKey: ['challenges'],
    queryFn: getChallenges,
  });

  // Fetch user enrollments
  const {
    data: enrollments,
    isLoading: isEnrollmentsLoading,
    refetch,
    isRefetching,
  } = useQuery<UserChallenge[]>({
    queryKey: ['userChallenges', user?.id],
    queryFn: () => getUserChallenges(user!.id),
    enabled: !!user?.id,
  });

  // Enroll mutation
  const enrollMutation = useMutation({
    mutationFn: (challengeId: string) => enrollInChallenge(user!.id, challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userChallenges', user?.id] });
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to enroll in challenge');
    },
  });

  // Claim mutation
  const claimMutation = useMutation({
    mutationFn: (challengeId: string) => claimChallengeReward(user!.id, challengeId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['userChallenges', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['userCredits', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id] });
      Alert.alert(
        'Reward Claimed!',
        `You earned $${(data.challenge.rewardCents / 100).toFixed(2)} in credits!`
      );
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'Failed to claim reward');
    },
  });

  // Create enrollment map for quick lookup
  const enrollmentMap = React.useMemo(() => {
    const map: Record<string, UserChallenge> = {};
    enrollments?.forEach((e) => {
      map[e.challengeId] = e;
    });
    return map;
  }, [enrollments]);

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="trophy-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Challenges</Text>
        <Text style={styles.emptySubtitle}>
          Sign in to view and join challenges
        </Text>
      </View>
    );
  }

  const isLoading = isChallengesLoading || isEnrollmentsLoading;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Separate challenges into categories
  const activeChallenges = challenges?.filter((c) => {
    const enrollment = enrollmentMap[c.id];
    const isEnrolled = !!enrollment;
    const isClaimed = enrollment?.rewardClaimed;
    return !isClaimed && (!c.endsAt || !isPast(new Date(c.endsAt)));
  }) || [];

  const completedChallenges = challenges?.filter((c) => {
    const enrollment = enrollmentMap[c.id];
    return enrollment?.rewardClaimed;
  }) || [];

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
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{enrollments?.length || 0}</Text>
          <Text style={styles.statLabel}>Enrolled</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{completedChallenges.length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            ${completedChallenges.reduce(
              (sum, c) => sum + c.rewardCents,
              0
            ) / 100}
          </Text>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
      </View>

      {/* Active Challenges */}
      {activeChallenges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Challenges</Text>
          {activeChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              enrollment={enrollmentMap[challenge.id]}
              onEnroll={() => enrollMutation.mutate(challenge.id)}
              onClaim={() => claimMutation.mutate(challenge.id)}
              isEnrolling={enrollMutation.isPending}
              isClaiming={claimMutation.isPending}
            />
          ))}
        </View>
      )}

      {/* Completed Challenges */}
      {completedChallenges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completed</Text>
          {completedChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              enrollment={enrollmentMap[challenge.id]}
              onEnroll={() => {}}
              onClaim={() => {}}
              isEnrolling={false}
              isClaiming={false}
            />
          ))}
        </View>
      )}

      {/* Empty state */}
      {activeChallenges.length === 0 && completedChallenges.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyStateText}>
            No challenges available right now
          </Text>
          <Text style={styles.emptyStateSubtext}>
            Check back soon for new challenges!
          </Text>
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  challengeCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  challengeEmoji: {
    fontSize: 36,
    marginRight: 12,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  challengeDescription: {
    fontSize: 13,
    color: colors.textLight,
    lineHeight: 18,
  },
  rewardBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  rewardText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success,
  },
  datesRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  progressSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressFillComplete: {
    backgroundColor: colors.success,
  },
  actionSection: {
    marginTop: 16,
  },
  enrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  enrollButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  claimButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  statusBadgeExpired: {
    backgroundColor: colors.errorLight,
  },
  statusBadgeInProgress: {
    backgroundColor: colors.warningLight,
  },
  statusBadgeClaimed: {
    backgroundColor: colors.successLight,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  statusBadgeTextExpired: {
    color: colors.error,
  },
  statusBadgeTextInProgress: {
    color: colors.warning,
  },
  statusBadgeTextClaimed: {
    color: colors.success,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
});
