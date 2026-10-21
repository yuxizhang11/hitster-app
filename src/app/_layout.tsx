import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SpotifyProvider } from '../spotify/SpotifyContext';
import { GameProvider } from '../state/GameContext';
import { colors } from '../theme';
import { UpdatePopup } from '../update/UpdatePopup';

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg } };

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <SpotifyProvider>
          <GameProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
              <Stack.Screen name="game" options={{ gestureEnabled: false }} />
              <Stack.Screen name="group" options={{ gestureEnabled: false }} />
              <Stack.Screen name="results" options={{ gestureEnabled: false }} />
            </Stack>
            <UpdatePopup />
          </GameProvider>
        </SpotifyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
