import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SignInScreen } from '@/components/SignInScreen';
import { useI18n } from '@/i18n';
import { CatalogsProvider } from '@/state/catalogs';
import { PlayerProvider } from '@/state/player';
import { SessionProvider, useSession } from '@/state/session';
import { SettingsProvider } from '@/state/settings';
import { ToastProvider } from '@/state/toast';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <CatalogsProvider>
            <SessionProvider>
              <PlayerProvider>
                <ThemeProvider value={navTheme}>
                  <ToastProvider>
                    <StatusBar style="light" />
                    <AppNavigator />
                  </ToastProvider>
                </ThemeProvider>
              </PlayerProvider>
            </SessionProvider>
          </CatalogsProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function AppNavigator() {
  const { status } = useSession();
  const { t } = useI18n();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (status === 'signedOut') return <SignInScreen />;

  const modal = { presentation: 'modal' as const };
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
      <Stack.Screen name="media/[type]/[id]" options={{ headerTransparent: true, title: '' }} />
      <Stack.Screen name="artist/[id]" options={{ headerTransparent: true, title: '' }} />
      <Stack.Screen name="season/[showId]/[season]" options={{ title: '' }} />
      <Stack.Screen name="entry/[id]" options={{ title: t('entry.title') }} />
      <Stack.Screen name="user/[id]" options={{ title: '' }} />
      <Stack.Screen name="follows/[id]" options={{ title: '' }} />
      <Stack.Screen name="taste/[id]" options={{ title: t('taste.title') }} />
      <Stack.Screen name="list/[id]" options={{ title: '' }} />
      <Stack.Screen name="match/[id]" options={{ title: t('match.title') }} />
      <Stack.Screen name="stats" options={{ title: t('stats.title') }} />
      <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
      <Stack.Screen name="import" options={{ title: t('import.title') }} />
      <Stack.Screen name="rules" options={{ title: t('rules.title') }} />
      <Stack.Screen name="blocked" options={{ title: t('blocked.title') }} />
      <Stack.Screen name="log" options={{ ...modal, title: t('log.title') }} />
      <Stack.Screen name="list-edit" options={{ ...modal, title: t('list.new') }} />
      <Stack.Screen name="add-to-list" options={{ ...modal, title: t('list.addTo') }} />
      <Stack.Screen name="match-new" options={{ ...modal, title: t('match.create') }} />
      <Stack.Screen name="edit-profile" options={{ ...modal, title: t('editProfile.title') }} />
      <Stack.Screen name="pick-favorites" options={{ ...modal, title: '' }} />
      <Stack.Screen name="share" options={{ ...modal, title: t('share.title') }} />
    </Stack>
  );
}
