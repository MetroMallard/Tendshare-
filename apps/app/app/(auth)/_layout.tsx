import { Stack } from 'expo-router';

/**
 * The signed-out half of the app: sign in, then the code.
 *
 * A stack with no header of its own — each screen draws its own title, so the
 * type scale stays the design system's and not the navigator's.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'fade',
        headerShown: false,
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}
