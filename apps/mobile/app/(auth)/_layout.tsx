import { Stack } from 'expo-router';
import { colors } from '@/lib/colors';

export default function AuthLayout() {
  return (
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
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="sign-in"
        options={{
          title: 'Sign In',
        }}
      />
      <Stack.Screen
        name="sign-up"
        options={{
          title: 'Create Account',
        }}
      />
    </Stack>
  );
}
