import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/lib/colors';
import { getLocations } from '@/lib/api';
import type { Location } from '@/lib/types';

function LocationCard({ location }: { location: Location }) {
  return (
    <Pressable style={styles.locationCard}>
      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>{location.name}</Text>
        <Text style={styles.locationAddress}>
          {location.address}, {location.city}
        </Text>
        <View style={styles.locationMeta}>
          <View style={styles.metaItem}>
            <Ionicons
              name={location.isOpen ? 'checkmark-circle' : 'close-circle'}
              size={14}
              color={location.isOpen ? colors.success : colors.error}
            />
            <Text
              style={[
                styles.metaText,
                { color: location.isOpen ? colors.success : colors.error },
              ]}
            >
              {location.isOpen ? 'Open Now' : 'Closed'}
            </Text>
          </View>
          {location.availableSeats !== undefined && (
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={14} color={colors.textLight} />
              <Text style={styles.metaText}>
                {location.availableSeats} seats available
              </Text>
            </View>
          )}
          {location.avgWaitMinutes !== undefined && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color={colors.textLight} />
              <Text style={styles.metaText}>~{location.avgWaitMinutes} min wait</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default function OrderScreen() {
  const {
    data: locations,
    isLoading,
    error,
  } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: getLocations,
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={styles.errorText}>Unable to load locations</Text>
        <Text style={styles.errorSubtext}>Please try again later</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Hero section */}
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>Ready to Order?</Text>
        <Text style={styles.heroSubtitle}>
          Select a location to start building your perfect bowl
        </Text>
      </View>

      {/* Locations list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Our Locations</Text>
        {locations?.map((location) => (
          <LocationCard key={location.id} location={location} />
        ))}
        {(!locations || locations.length === 0) && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No locations available</Text>
          </View>
        )}
      </View>

      {/* Coming soon features */}
      <View style={styles.comingSoonSection}>
        <Text style={styles.comingSoonTitle}>Coming Soon</Text>
        <View style={styles.featureRow}>
          <View style={styles.featureItem}>
            <Ionicons name="location-outline" size={24} color={colors.primary} />
            <Text style={styles.featureText}>Nearby locations</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="star-outline" size={24} color={colors.primary} />
            <Text style={styles.featureText}>Favorite orders</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="flash-outline" size={24} color={colors.primary} />
            <Text style={styles.featureText}>Quick reorder</Text>
          </View>
        </View>
      </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 4,
  },
  heroSection: {
    padding: 24,
    paddingTop: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  heroSubtitle: {
    fontSize: 15,
    color: colors.textLight,
    marginTop: 8,
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 8,
  },
  locationMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.textLight,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  comingSoonSection: {
    marginTop: 32,
    paddingHorizontal: 16,
    paddingVertical: 24,
    backgroundColor: colors.primaryLight,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  comingSoonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  featureItem: {
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
});
