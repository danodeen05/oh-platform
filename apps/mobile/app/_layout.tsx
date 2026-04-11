import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { colors } from '@/lib/colors';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// Clerk publishable key - use env or fallback
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

// Satellite domain configuration
const IS_SATELLITE = process.env.EXPO_PUBLIC_CLERK_IS_SATELLITE === 'true';
const CLERK_DOMAIN = process.env.EXPO_PUBLIC_CLERK_DOMAIN || undefined;
const CLERK_SIGN_IN_URL = process.env.EXPO_PUBLIC_CLERK_SIGN_IN_URL || undefined;

// Token cache for Clerk - uses SecureStore on native, localStorage on web
const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Silently fail
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Silently fail
    }
  },
};

// Loading screen component
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Hide splash screen after a short delay
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // If no Clerk key, show a warning but continue
  if (!CLERK_PUBLISHABLE_KEY) {
    console.warn('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY - Auth will not work');
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        tokenCache={tokenCache}
        isSatellite={IS_SATELLITE}
        domain={CLERK_DOMAIN}
        signInUrl={CLERK_SIGN_IN_URL}
      >
        <ClerkLoaded>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerTintColor: colors.text,
              headerTitleStyle: {
                fontWeight: '500',
              },
              contentStyle: {
                backgroundColor: colors.background,
              },
            }}
          >
            <Stack.Screen
              name="(tabs)"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="(auth)"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="credits"
              options={{
                title: 'Credits',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="badges"
              options={{
                title: 'Badges',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="challenges"
              options={{
                title: 'Challenges',
                presentation: 'modal',
              }}
            />
          </Stack>
        </ClerkLoaded>
      </ClerkProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
