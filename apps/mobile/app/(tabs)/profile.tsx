import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser, useAuth, useClerk } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { colors, getTierDisplayName } from '@/lib/colors';
import { getUserProfile, getPaymentMethods, updateUserPhone, clearSession } from '@/lib/api';
import type { UserProfile, SavedPaymentMethod } from '@/lib/types';

// Section header component
function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// Menu item component
function MenuItem({
  icon,
  label,
  value,
  onPress,
  showChevron = true,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={styles.menuItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.menuIconContainer, danger && styles.menuIconDanger]}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.error : colors.primary}
        />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>
          {label}
        </Text>
        {value && <Text style={styles.menuValue}>{value}</Text>}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

// Payment method card
function PaymentMethodCard({ method }: { method: SavedPaymentMethod }) {
  const brandIcons: Record<string, string> = {
    visa: 'card',
    mastercard: 'card',
    amex: 'card',
    discover: 'card',
  };

  return (
    <View style={styles.paymentCard}>
      <Ionicons
        name={brandIcons[method.brand.toLowerCase()] as keyof typeof Ionicons.glyphMap || 'card'}
        size={24}
        color={colors.primary}
      />
      <View style={styles.paymentInfo}>
        <Text style={styles.paymentBrand}>
          {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} ****{method.last4}
        </Text>
        <Text style={styles.paymentExpiry}>
          Expires {method.expiryMonth}/{method.expiryYear}
        </Text>
      </View>
      {method.isDefault && (
        <View style={styles.defaultBadge}>
          <Text style={styles.defaultBadgeText}>Default</Text>
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();

  // Fetch user profile
  const {
    data: profile,
    isLoading: isProfileLoading,
  } = useQuery<UserProfile>({
    queryKey: ['userProfile', user?.id],
    queryFn: () => getUserProfile(user!.id),
    enabled: !!user?.id,
  });

  // Fetch payment methods
  const { data: paymentMethods } = useQuery<SavedPaymentMethod[]>({
    queryKey: ['paymentMethods', user?.id],
    queryFn: () => getPaymentMethods(user!.id),
    enabled: !!user?.id,
  });

  // SMS toggle mutation
  const smsMutation = useMutation({
    mutationFn: (smsOptIn: boolean) =>
      updateUserPhone(user!.id, undefined, smsOptIn),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id] });
    },
  });

  // Handle SMS toggle
  const handleSmsToggle = (value: boolean) => {
    smsMutation.mutate(value);
  };

  // Handle sign out
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await clearSession();
            await signOut();
          },
        },
      ]
    );
  };

  // Handle share referral code
  const handleShareReferral = async () => {
    if (!profile?.referralCode) return;
    try {
      await Share.share({
        message: `Join me at Oh! Beef Noodle House! Use my referral code ${profile.referralCode.toUpperCase()} to get $5 off your first order. https://ohbeef.com/r/${profile.referralCode}`,
      });
    } catch (e) {
      console.error('Error sharing:', e);
    }
  };

  // Loading state
  if (!isUserLoaded || isProfileLoading) {
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
        <Text style={styles.signInTitle}>Your Profile</Text>
        <Text style={styles.signInSubtitle}>
          Sign in to manage your account
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Profile header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {(profile?.name || user.firstName || 'M').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.profileName}>
          {profile?.name || user.fullName || 'Member'}
        </Text>
        <Text style={styles.profileTier}>
          {getTierDisplayName(profile?.membershipTier || 'CHOPSTICK')} Member
        </Text>
      </View>

      {/* Account section */}
      <SectionHeader title="Account" />
      <View style={styles.menuSection}>
        <MenuItem
          icon="mail-outline"
          label="Email"
          value={profile?.email || user.primaryEmailAddress?.emailAddress}
          showChevron={false}
        />
        <MenuItem
          icon="call-outline"
          label="Phone"
          value={profile?.phone || 'Not set'}
          onPress={() => {
            // TODO: Edit phone modal
          }}
        />
        <View style={styles.menuItemWithSwitch}>
          <View style={styles.menuIconContainer}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuLabel}>SMS Notifications</Text>
            <Text style={styles.menuSubtext}>
              Receive order updates via text
            </Text>
          </View>
          <Switch
            value={profile?.smsOptIn || false}
            onValueChange={handleSmsToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* Referral section */}
      <SectionHeader title="Referral Program" />
      <View style={styles.menuSection}>
        <Pressable style={styles.referralCard} onPress={handleShareReferral}>
          <View style={styles.referralInfo}>
            <Text style={styles.referralLabel}>Your Referral Code</Text>
            <Text style={styles.referralCode}>
              {profile?.referralCode?.toUpperCase() || '---'}
            </Text>
            <Text style={styles.referralHint}>
              Share & earn $5 for each friend who orders
            </Text>
          </View>
          <Ionicons name="share-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>

      {/* Payment methods */}
      <SectionHeader title="Payment Methods" />
      <View style={styles.menuSection}>
        {paymentMethods && paymentMethods.length > 0 ? (
          paymentMethods.map((method) => (
            <PaymentMethodCard key={method.id} method={method} />
          ))
        ) : (
          <View style={styles.emptyPayment}>
            <Text style={styles.emptyPaymentText}>No saved payment methods</Text>
          </View>
        )}
      </View>

      {/* Support section */}
      <SectionHeader title="Support" />
      <View style={styles.menuSection}>
        <MenuItem
          icon="help-circle-outline"
          label="Help & FAQ"
          onPress={() => {
            // TODO: Open help
          }}
        />
        <MenuItem
          icon="chatbubbles-outline"
          label="Contact Us"
          onPress={() => {
            // TODO: Open contact
          }}
        />
        <MenuItem
          icon="document-text-outline"
          label="Privacy Policy"
          onPress={() => {
            // TODO: Open privacy policy
          }}
        />
      </View>

      {/* Sign out */}
      <View style={styles.signOutSection}>
        <MenuItem
          icon="log-out-outline"
          label="Sign Out"
          onPress={handleSignOut}
          showChevron={false}
          danger
        />
      </View>

      {/* Version */}
      <Text style={styles.versionText}>Oh! Beef v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: 48,
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
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  profileTier: {
    fontSize: 14,
    color: colors.textLight,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuSection: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuItemWithSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIconDanger: {
    backgroundColor: colors.errorLight,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  menuLabelDanger: {
    color: colors.error,
  },
  menuValue: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 2,
  },
  menuSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  referralInfo: {
    flex: 1,
  },
  referralLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  referralCode: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: 4,
  },
  referralHint: {
    fontSize: 13,
    color: colors.textLight,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  paymentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  paymentBrand: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  paymentExpiry: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.success,
  },
  emptyPayment: {
    padding: 20,
    alignItems: 'center',
  },
  emptyPaymentText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  signOutSection: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  versionText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
});
