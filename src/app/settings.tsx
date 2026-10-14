import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Card, Divider, GroupTitle, Row, SwitchRow, Txt } from '@/components/ui';
import { config } from '@/config';
import { useI18n } from '@/i18n';
import type { LangSetting } from '@/i18n/lang';
import { diaryCsv } from '@/lib/exportCsv';
import { useBackend, useSession } from '@/state/session';
import { useSettings } from '@/state/settings';
import { useToast } from '@/state/toast';
import { gutter, space } from '@/theme';

export default function SettingsScreen() {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const { mode, email, signOut, deleteAccount, resetDemo } = useSession();
  const backend = useBackend();
  const toast = useToast();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const languageLabel: Record<LangSetting, string> = {
    auto: t('settings.langAuto'),
    ru: 'Русский',
    en: 'English',
  };

  const chooseLanguage = () => {
    Alert.alert(t('settings.language'), undefined, [
      { text: languageLabel.auto, onPress: () => update({ language: 'auto' }) },
      { text: languageLabel.ru, onPress: () => update({ language: 'ru' }) },
      { text: languageLabel.en, onPress: () => update({ language: 'en' }) },
    ]);
  };

  const exportDiary = async () => {
    const entries = await backend.getEntriesBetween(backend.userId, '1900-01-01', '2999-12-31');
    if (entries.length === 0) {
      toast(t('settings.exportEmpty'));
      return;
    }
    const csv = diaryCsv(entries);
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'copione-diary.csv';
      link.click();
      return;
    }
    const file = new File(Paths.cache, 'copione-diary.csv');
    if (file.exists) file.delete();
    file.create();
    file.write(csv);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  };

  const confirm = (title: string, message: string, action: () => Promise<void>, destructive = true) => {
    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: title,
        style: destructive ? 'destructive' : 'default',
        onPress: () => {
          action().catch(() => Alert.alert(t('error.title'), t('common.error')));
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <GroupTitle>{t('settings.account')}</GroupTitle>
      <Card style={styles.group}>
        <Row icon="person-circle-outline" label={t('settings.editProfile')} value={email ?? undefined} onPress={() => router.push('/edit-profile')} />
      </Card>

      <GroupTitle>{t('settings.preferences')}</GroupTitle>
      <Card style={styles.group}>
        <Row icon="language-outline" label={t('settings.language')} value={languageLabel[settings.language]} onPress={chooseLanguage} />
        <Divider />
        <SwitchRow
          icon="eye-off-outline"
          label={t('settings.blind')}
          hint={t('settings.blindHint')}
          value={settings.blindRatings}
          onChange={(v) => update({ blindRatings: v })}
        />
        <Divider />
        <SwitchRow
          icon="warning-outline"
          label={t('settings.spoilers')}
          hint={t('settings.spoilersHint')}
          value={settings.hideSpoilers}
          onChange={(v) => update({ hideSpoilers: v })}
        />
      </Card>

      <GroupTitle>{t('settings.data')}</GroupTitle>
      <Card style={styles.group}>
        <Row icon="cloud-download-outline" label={t('settings.import')} onPress={() => router.push('/import')} />
        <Divider />
        <Row icon="document-text-outline" label={t('settings.export')} onPress={exportDiary} />
        <Divider />
        <Row icon="hand-left-outline" label={t('settings.blocked')} onPress={() => router.push('/blocked')} />
      </Card>

      <GroupTitle>{t('settings.about')}</GroupTitle>
      <Card style={styles.group}>
        <Row icon="server-outline" label={t('settings.mode')} value={mode === 'cloud' ? t('settings.modeCloud') : t('settings.modeLocal')} />
        <Divider />
        <Row icon="film-outline" label={t('settings.filmCatalog')} value={config.hasTmdb ? 'TMDB' : t('settings.catalogDemo')} />
        <Divider />
        <Row
          icon="musical-notes-outline"
          label={t('settings.musicCatalog')}
          value={config.liveMusic ? 'Apple Music' : t('settings.catalogDemo')}
        />
        <Divider />
        <Row icon="shield-checkmark-outline" label={t('settings.rules')} onPress={() => router.push('/rules')} />
        {config.privacyUrl ? (
          <>
            <Divider />
            <Row icon="lock-closed-outline" label={t('settings.privacy')} onPress={() => WebBrowser.openBrowserAsync(config.privacyUrl)} />
          </>
        ) : null}
        {config.supportEmail ? (
          <>
            <Divider />
            <Row icon="mail-outline" label={t('settings.support')} onPress={() => Linking.openURL(`mailto:${config.supportEmail}`)} />
          </>
        ) : null}
      </Card>

      <View style={styles.attribution}>
        <Txt v="caption" tone="faint">
          {t('settings.tmdbAttribution')}
        </Txt>
        <Txt v="caption" tone="faint">
          {t('settings.musicAttribution')}
        </Txt>
        <Txt v="caption" tone="faint">
          {t('settings.justwatchAttribution')}
        </Txt>
        <Txt v="caption" tone="faint">
          {t('settings.version', { v: version })}
        </Txt>
      </View>

      <Card style={styles.group}>
        {mode === 'cloud' ? (
          <>
            <Row
              icon="log-out-outline"
              label={t('settings.signOut')}
              onPress={() => confirm(t('settings.signOut'), t('settings.signOutConfirm'), signOut, false)}
            />
            <Divider />
            <Row
              icon="trash-outline"
              label={t('settings.deleteAccount')}
              danger
              onPress={() => confirm(t('settings.deleteAccount'), t('settings.deleteConfirm'), deleteAccount)}
            />
          </>
        ) : (
          <Row
            icon="refresh-outline"
            label={t('settings.resetDemo')}
            danger
            onPress={() =>
              confirm(t('settings.resetDemo'), t('settings.resetConfirm'), async () => {
                await resetDemo();
                router.dismissAll();
              })
            }
          />
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 60,
  },
  group: {
    marginHorizontal: gutter,
    padding: 0,
    overflow: 'hidden',
  },
  attribution: {
    gap: space.xs,
    marginHorizontal: gutter + 4,
    marginVertical: space.xl,
  },
});
