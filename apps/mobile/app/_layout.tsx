import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager } from 'react-native';
import { setupData } from '../src/data';
import { colors } from '../src/theme';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
setupData();

export default function Root() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }} />
    </>
  );
}
