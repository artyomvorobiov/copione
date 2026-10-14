import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useI18n } from '@/i18n';
import { colors } from '@/theme';

/** Native iOS/Android tab bar (Liquid Glass on iOS 26). */
export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <NativeTabs
      tintColor={colors.accent}
      backgroundColor={colors.bg}
      iconColor={{ default: colors.textDim, selected: colors.accent }}
      labelStyle={{ default: { color: colors.textDim }, selected: { color: colors.text } }}
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.feed')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover">
        <NativeTabs.Trigger.Label>{t('tabs.discover')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="match">
        <NativeTabs.Trigger.Label>{t('tabs.match')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'rectangle.stack', selected: 'rectangle.stack.fill' }} md="style" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
