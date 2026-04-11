import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors } from '@/lib/colors';
import { getUserOrders } from '@/lib/api';
import type { Order, OrderStatus } from '@/lib/types';

const MAX_FAVORITES = 3;

// Order status display config
const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  PENDING_PAYMENT: { label: 'Pending', color: colors.textMuted },
  PAID: { label: 'Paid', color: colors.success },
  QUEUED: { label: 'In Queue', color: colors.orderStatus.queued },
  PREPPING: { label: 'Preparing', color: colors.orderStatus.preparing },
  READY: { label: 'Ready', color: colors.orderStatus.ready },
  SERVING: { label: 'Serving', color: colors.primary },
  COMPLETED: { label: 'Completed', color: colors.orderStatus.completed },
  CANCELLED: { label: 'Cancelled', color: colors.orderStatus.cancelled },
};

// Order card component
function OrderCard({
  order,
  isFavorite,
  onToggleFavorite,
  onReorder,
}: {
  order: Order;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onReorder: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig[order.status] || statusConfig.COMPLETED;

  // Group items by category
  const mainItems = order.items.filter((i) =>
    ['MAIN', 'SLIDER'].includes(i.menuItem.categoryType)
  );
  const extras = order.items.filter((i) =>
    ['ADDON', 'SIDE', 'DRINK', 'DESSERT'].includes(i.menuItem.categoryType)
  );

  return (
    <Pressable
      style={styles.orderCard}
      onPress={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <View style={styles.orderTitleRow}>
            <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
            <Pressable onPress={onToggleFavorite} hitSlop={8}>
              <Ionicons
                name={isFavorite ? 'star' : 'star-outline'}
                size={20}
                color={isFavorite ? '#FFD700' : colors.textMuted}
              />
            </Pressable>
          </View>
          <Text style={styles.orderLocation}>
            {order.location?.name || 'Unknown Location'}
          </Text>
          <Text style={styles.orderDate}>
            {format(new Date(order.createdAt), 'MMM d, yyyy · h:mm a')}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${status.color}20` }]}>
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* Expanded content */}
      {expanded && (
        <View style={styles.orderDetails}>
          {/* Main items */}
          {mainItems.length > 0 && (
            <View style={styles.itemSection}>
              <Text style={styles.itemSectionTitle}>The Bowl</Text>
              {mainItems.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemName}>
                    {item.quantity > 1 && `${item.quantity}x `}
                    {item.menuItem.name}
                    {item.selectedValue && ` (${item.selectedValue})`}
                  </Text>
                  <Text style={styles.itemPrice}>
                    ${(item.priceCents / 100).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Extras */}
          {extras.length > 0 && (
            <View style={styles.itemSection}>
              <Text style={styles.itemSectionTitle}>Add-ons & Extras</Text>
              {extras.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemName}>
                    {item.quantity > 1 && `${item.quantity}x `}
                    {item.menuItem.name}
                  </Text>
                  <Text style={styles.itemPrice}>
                    ${(item.priceCents / 100).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              ${(order.totalCents / 100).toFixed(2)}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.orderActions}>
            <Pressable style={styles.reorderButton} onPress={onReorder}>
              <Ionicons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.reorderButtonText}>Reorder</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Collapsed summary */}
      {!expanded && (
        <View style={styles.orderSummary}>
          <Text style={styles.summaryText} numberOfLines={1}>
            {mainItems.map((i) => i.menuItem.name).join(', ') || 'No items'}
          </Text>
          <Text style={styles.summaryTotal}>
            ${(order.totalCents / 100).toFixed(2)}
          </Text>
        </View>
      )}

      {/* Expand indicator */}
      <View style={styles.expandIndicator}>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </View>
    </Pressable>
  );
}

export default function ActivityScreen() {
  const { user } = useUser();
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from storage
  useEffect(() => {
    async function loadFavorites() {
      if (!user?.id) return;
      try {
        const stored = await AsyncStorage.getItem(`favorites_${user.id}`);
        if (stored) {
          setFavorites(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Error loading favorites:', e);
      }
    }
    loadFavorites();
  }, [user?.id]);

  // Save favorites to storage
  const saveFavorites = async (newFavorites: string[]) => {
    if (!user?.id) return;
    try {
      await AsyncStorage.setItem(
        `favorites_${user.id}`,
        JSON.stringify(newFavorites)
      );
    } catch (e) {
      console.error('Error saving favorites:', e);
    }
  };

  // Toggle favorite
  const toggleFavorite = (orderId: string) => {
    setFavorites((prev) => {
      let newFavorites: string[];
      if (prev.includes(orderId)) {
        newFavorites = prev.filter((id) => id !== orderId);
      } else if (prev.length < MAX_FAVORITES) {
        newFavorites = [...prev, orderId];
      } else {
        // At max favorites - remove oldest and add new
        newFavorites = [...prev.slice(1), orderId];
      }
      saveFavorites(newFavorites);
      return newFavorites;
    });
  };

  // Fetch orders
  const {
    data: orders,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Order[]>({
    queryKey: ['userOrders', user?.id],
    queryFn: () => getUserOrders(user!.id),
    enabled: !!user?.id,
  });

  // Sort orders with favorites first
  const sortedOrders = React.useMemo(() => {
    if (!orders) return [];
    return [...orders].sort((a, b) => {
      const aFav = favorites.includes(a.id) ? 0 : 1;
      const bFav = favorites.includes(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [orders, favorites]);

  // Loading state
  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Order History</Text>
        <Text style={styles.emptySubtitle}>
          Sign in to view your past orders
        </Text>
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

  // Empty state
  if (!orders || orders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="receipt-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No Orders Yet</Text>
        <Text style={styles.emptySubtitle}>
          Your order history will appear here
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      data={sortedOrders}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <OrderCard
          order={item}
          isFavorite={favorites.includes(item.id)}
          onToggleFavorite={() => toggleFavorite(item.id)}
          onReorder={() => {
            // TODO: Implement reorder flow
            console.log('Reorder:', item.id);
          }}
        />
      )}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        favorites.length > 0 ? (
          <View style={styles.favoritesHeader}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.favoritesHeaderText}>
              {favorites.length} favorite{favorites.length !== 1 ? 's' : ''} (max {MAX_FAVORITES})
            </Text>
          </View>
        ) : null
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
    textAlign: 'center',
  },
  favoritesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  favoritesHeaderText: {
    fontSize: 13,
    color: colors.textLight,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderInfo: {
    flex: 1,
  },
  orderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  orderLocation: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 2,
  },
  orderDate: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  orderSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    color: colors.textLight,
    marginRight: 12,
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  orderDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  itemSection: {
    marginBottom: 16,
  },
  itemSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  itemPrice: {
    fontSize: 14,
    color: colors.textLight,
    marginLeft: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  orderActions: {
    marginTop: 16,
  },
  reorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  reorderButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  expandIndicator: {
    alignItems: 'center',
    marginTop: 8,
  },
});
