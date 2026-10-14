import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { config } from '@/config';
import { useI18n } from '@/i18n';
import { RULES } from '@/i18n/extra';
import { AuthFailure, useSession } from '@/state/session';
import { colors, font, gutter, radius, space } from '@/theme';

import { Button, IconButton, Txt } from './ui';

export function Field({
  value,
  onChangeText,
  placeholder,
  secure,
  keyboard,
  autoCapitalize = 'none',
  multiline,
  maxLength,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboard?: 'email-address' | 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      secureTextEntry={secure}
      keyboardType={keyboard}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      multiline={multiline}
      maxLength={maxLength}
      style={[styles.input, multiline && styles.inputMultiline]}
    />
  );
}

export function RulesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Txt v="h2">{t('rules.title')}</Txt>
          <IconButton name="close" label={t('common.close')} onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.rules}>
          {RULES[lang].map((rule, i) => (
            <Txt key={i} style={styles.rule}>{`${i + 1}. ${rule}`}</Txt>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Shown instead of the app when Supabase is configured and nobody is signed in. */
export function SignInScreen() {
  const { t } = useI18n();
  const { signIn, signUp } = useSession();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t('auth.emailInvalid'));
      return;
    }
    if (mode === 'signUp' && !agreed) {
      setError(t('auth.mustAgree'));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        const result = await signUp({ email, password, username, displayName: name });
        if (result === 'checkEmail') {
          setNotice(t('auth.checkEmail', { email: email.trim() }));
          setMode('signIn');
        }
      }
    } catch (err) {
      setError(err instanceof AuthFailure ? t(err.key) : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="aperture" size={34} color={colors.accent} />
            </View>
            <Txt v="hero">{config.appName}</Txt>
            <Txt tone="dim" style={styles.center}>
              {t('app.tagline')}
            </Txt>
          </View>

          <View style={styles.form}>
            <Field value={email} onChangeText={setEmail} placeholder={t('auth.email')} keyboard="email-address" />
            <Field value={password} onChangeText={setPassword} placeholder={t('auth.password')} secure />
            {mode === 'signUp' ? (
              <>
                <Field
                  value={username}
                  onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder={t('auth.username')}
                  maxLength={20}
                />
                <Field value={name} onChangeText={setName} placeholder={t('auth.name')} autoCapitalize="words" maxLength={40} />
                <View style={styles.agree}>
                  <Pressable
                    style={styles.agreeToggle}
                    onPress={() => setAgreed((v) => !v)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: agreed }}
                  >
                    <Ionicons name={agreed ? 'checkbox' : 'square-outline'} size={22} color={agreed ? colors.accent : colors.textDim} />
                    <Txt v="small" tone="dim" style={styles.flex}>
                      {t('auth.agree')}
                    </Txt>
                  </Pressable>
                  <IconButton name="document-text-outline" label={t('rules.title')} color={colors.accent} onPress={() => setRulesOpen(true)} />
                </View>
              </>
            ) : null}

            {error ? (
              <Txt v="small" tone="danger">
                {error}
              </Txt>
            ) : null}
            {notice ? (
              <Txt v="small" tone="success">
                {notice}
              </Txt>
            ) : null}

            <Button
              title={mode === 'signIn' ? t('auth.signIn') : t('auth.createAccount')}
              onPress={submit}
              loading={busy}
              style={styles.submit}
            />
            <Pressable
              onPress={() => {
                setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                setError(null);
              }}
              style={styles.switch}
            >
              <Txt v="smallStrong" tone="dim">
                {mode === 'signIn' ? t('auth.noAccount') : t('auth.haveAccount')}
              </Txt>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <RulesModal visible={rulesOpen} onClose={() => setRulesOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: gutter + 8,
    gap: space.xxxl,
  },
  brand: {
    alignItems: 'center',
    gap: space.sm,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  center: {
    textAlign: 'center',
  },
  form: {
    gap: space.md,
  },
  input: {
    ...font.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  agree: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  agreeToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  submit: {
    marginTop: space.sm,
  },
  switch: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: gutter,
  },
  rules: {
    padding: gutter,
    gap: space.md,
  },
  rule: {
    lineHeight: 22,
  },
});
