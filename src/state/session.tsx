import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthError, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { LocalBackend } from '@/backend/local';
import { SupabaseBackend } from '@/backend/supabase';
import { getSupabase } from '@/backend/supabaseClient';
import type { Backend } from '@/backend/types';
import { config } from '@/config';
import type { TKey } from '@/i18n';

import { useSettings } from './settings';

export type SessionStatus = 'loading' | 'signedOut' | 'ready';

/** Auth failure with a translation key for the message. */
export class AuthFailure extends Error {
  constructor(readonly key: TKey) {
    super(key);
  }
}

function authFailure(error: AuthError | Error): AuthFailure {
  const code = (error as AuthError).code ?? '';
  const message = error.message.toLowerCase();
  if (code === 'invalid_credentials' || message.includes('invalid login')) return new AuthFailure('auth.invalid');
  if (code === 'email_not_confirmed' || message.includes('not confirmed')) return new AuthFailure('auth.emailNotConfirmed');
  if (code === 'user_already_exists' || message.includes('already registered')) return new AuthFailure('auth.userExists');
  if (code === 'weak_password' || message.includes('password should be')) return new AuthFailure('auth.weakPassword');
  if (code === 'email_address_invalid' || message.includes('invalid email') || message.includes('is invalid'))
    return new AuthFailure('auth.emailInvalid');
  if (code.includes('rate_limit') || message.includes('rate limit')) return new AuthFailure('auth.rateLimit');
  if (/network|fetch/i.test(message)) return new AuthFailure('common.networkError');
  return new AuthFailure('common.error');
}

interface SignUpInput {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

interface SessionValue {
  status: SessionStatus;
  backend: Backend | null;
  mode: 'cloud' | 'local';
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Resolves to "checkEmail" when the project requires email confirmation. */
  signUp: (input: SignUpInput) => Promise<'signedIn' | 'checkEmail'>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  resetDemo: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { ready: settingsReady, lang } = useSettings();
  const queryClient = useQueryClient();
  const mode = config.hasSupabase ? 'cloud' : 'local';
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [backend, setBackend] = useState<Backend | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!settingsReady) return;
    let cancelled = false;

    if (mode === 'local') {
      LocalBackend.open(AsyncStorage, lang).then((local) => {
        if (cancelled) return;
        setBackend(local);
        setStatus('ready');
      });
      return () => {
        cancelled = true;
      };
    }

    const supabase = getSupabase();
    const apply = (session: Session | null) => {
      if (cancelled) return;
      const uid = session?.user?.id ?? null;
      setEmail(session?.user?.email ?? null);
      // Token refreshes fire auth events too; only react when the user changes.
      if (initializedRef.current && uid === userIdRef.current) return;
      initializedRef.current = true;
      userIdRef.current = uid;
      queryClient.clear();
      if (uid) {
        setBackend(new SupabaseBackend(supabase, uid));
        setStatus('ready');
      } else {
        setBackend(null);
        setStatus('signedOut');
      }
    };
    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => apply(null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
    // The demo database is seeded in the language active at first launch only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsReady, mode]);

  const signIn = useCallback(async (emailValue: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email: emailValue.trim(), password });
    if (error) throw authFailure(error);
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const supabase = getSupabase();
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new AuthFailure('auth.usernameInvalid');
    if (input.password.length < 6) throw new AuthFailure('auth.weakPassword');
    const available = await supabase.rpc('username_available', { p_username: username });
    if (available.error) throw authFailure(available.error);
    if (!available.data) throw new AuthFailure('auth.usernameTaken');
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: { data: { username, display_name: input.displayName.trim() } },
    });
    if (error) throw authFailure(error);
    return data.session ? 'signedIn' : 'checkEmail';
  }, []);

  const signOut = useCallback(async () => {
    if (mode === 'cloud') await getSupabase().auth.signOut();
  }, [mode]);

  const deleteAccount = useCallback(async () => {
    if (!backend) return;
    await backend.deleteAccount();
    queryClient.clear();
    if (mode === 'cloud') await getSupabase().auth.signOut();
  }, [backend, mode, queryClient]);

  const resetDemo = useCallback(async () => {
    if (backend instanceof LocalBackend) {
      await backend.reset();
      queryClient.clear();
    }
  }, [backend, queryClient]);

  const value = useMemo(
    () => ({ status, backend, mode, email, signIn, signUp, signOut, deleteAccount, resetDemo }) as SessionValue,
    [status, backend, mode, email, signIn, signUp, signOut, deleteAccount, resetDemo],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** The active backend; screens are only mounted once it exists. */
export function useBackend(): Backend {
  const { backend } = useSession();
  if (!backend) throw new Error('No backend: user is not signed in');
  return backend;
}
