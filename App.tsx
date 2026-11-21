
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ProfileScreen, { UserProfile } from './components/ProfileScreen';
import { errorMessage } from './lib/schedule';
import { readWithTimeout } from './lib/requests';
import HomeScreen from './components/HomeScreen';
import AvailabilityScreen from './components/AvailabilityScreen';
import { Palette, ThemeProvider, useTheme } from './components/ThemeProvider';
import ThemeToggle from './components/ThemeToggle';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type Screen = 'signin' | 'signup' | 'forgot';

export default function App() {
  return <ThemeProvider><ThemedApp /></ThemeProvider>;
}

function ThemedApp() {
  const { colors, mode } = useTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 }}>
    <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
    <AppContent />
  </SafeAreaView>;
}

function AppContent() {
  const { colors, mode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [screen, setScreen] = useState<Screen>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileReload, setProfileReload] = useState(0);
  const [profileOwner, setProfileOwner] = useState<string | null>(null);
  const authBusy = useRef(false);
  const sessionId = useRef(session?.user.id);
  sessionId.current = session?.user.id;

  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [removedGamesCount, setRemovedGamesCount] = useState(0);

  useEffect(() => {
    if (removedGamesCount <= 0) return;
    const timer = setTimeout(() => setRemovedGamesCount(0), 3000);
    return () => clearTimeout(timer);
  }, [removedGamesCount]);

  useEffect(() => {
    let mounted = true;

    let authChanged = false;
    readWithTimeout(supabase.auth.getSession()).then(({ data, error }) => {
      if (!mounted || authChanged) return;
      if (error) throw error;
      setSession(data.session);
    }).catch(error => {
      if (mounted && !authChanged) Alert.alert('Session error', errorMessage(error));
    }).finally(() => { if (mounted) setInitializing(false); });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) {
          authChanged = true;
          setInitializing(false);
          setSession(newSession);
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    let cancelled = false;

    setProfile(null);
    setEditingProfile(false);
    setEditingSchedule(false);
    setScheduleSaved(false);
    setRemovedGamesCount(0);
    setProfileError(null);

    if (!userId) {
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    async function load() {
      try {
        const { data, error } = await readWithTimeout(supabase.from('profiles')
          .select('id, username, display_name, avatar_url').eq('id', userId!).maybeSingle());
        if (error) throw error;
        if (!cancelled) setProfile(data);
      } catch (error) { if (!cancelled) setProfileError(errorMessage(error)); }
      finally {
        if (!cancelled) { setProfileOwner(userId!); setProfileLoading(false); }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [session?.user.id, profileReload]);

  function handleProfileSaved(saved: UserProfile) {
    if (sessionId.current !== saved.id) return;
    setProfile(saved);
    setProfileOwner(saved.id);
    setEditingProfile(false);
  }

  async function signUp() {
    if (authBusy.current) return;
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing information',
        'Enter your email and password.'
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        'Weak password',
        'Use at least 8 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match');
      return;
    }

    authBusy.current = true;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      if (data.session) {
        Alert.alert(
          'Account created',
          'Welcome to RunIt! Complete your profile to continue.'
        );
      } else {
        Alert.alert(
          'Check your email',
          'Verify your email, then return to RunIt and sign in.'
        );
      }

      setPassword('');
      setConfirmPassword('');
      setScreen('signin');
    } catch (error) {
      Alert.alert(
        'Registration failed',
        errorMessage(error)
      );
    } finally {
      authBusy.current = false;
      setLoading(false);
    }
  }

  async function signIn() {
    if (authBusy.current) return;
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing information',
        'Enter your email and password.'
      );
      return;
    }

    authBusy.current = true;
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      setPassword('');
    } catch (error) {
      Alert.alert(
        'Sign in failed',
        errorMessage(error)
      );
    } finally {
      authBusy.current = false;
      setLoading(false);
    }
  }

  async function forgotPassword() {
    if (authBusy.current) return;
    if (!email.trim()) {
      Alert.alert(
        'Email required',
        'Enter your email address.'
      );
      return;
    }

    authBusy.current = true;
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: 'https://runit-six.vercel.app',
        }
      );

      if (error) throw error;

      Alert.alert(
        'Check your email',
        'If an account exists for this address, recovery instructions will be sent.'
      );

      setScreen('signin');
    } catch (error) {
      Alert.alert(
        'Request failed',
        errorMessage(error)
      );
    } finally {
      authBusy.current = false;
      setLoading(false);
    }
  }

  async function signOut() {
    if (authBusy.current) return;

    authBusy.current = true;
    setLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      setPassword('');
      setSession(null);
      setProfile(null);
      setEditingProfile(false);
      setEditingSchedule(false);
      setScheduleSaved(false);
      setRemovedGamesCount(0);
      setScreen('signin');
    } catch (error) {
      Alert.alert(
        'Sign out failed',
        errorMessage(error)
      );
    } finally {
      authBusy.current = false;
      setLoading(false);
    }
  }

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (session) {
    if (profileLoading || profileOwner !== session.user.id) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green} />
          <Text style={styles.loadingText}>
            Loading your profile...
          </Text>
        </View>
      );
    }

    if (profileError) {
      return (
        <View style={styles.center}>
          <Text style={styles.heading}>
            Unable to load profile
          </Text>

          <Text style={styles.subtitle}>
            {profileError}
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => setProfileReload(value => value + 1)}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={signOut}
            disabled={loading}
          >
            <Text style={styles.link}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!profile || editingProfile) {
      return <ProfileScreen
        key={session.user.id}
        userId={session.user.id}
        onSaved={handleProfileSaved}
        onBack={profile ? () => setEditingProfile(false) : undefined}
        onSignOut={signOut}
        signingOut={loading}
      />;
    }

    if (editingSchedule) {
      return <AvailabilityScreen
        key={session.user.id}
        userId={session.user.id}
        onBack={() => setEditingSchedule(false)}
        onSaved={result => {
          setRemovedGamesCount(result.removed_count);
          setScheduleSaved(result.removed_count === 0);
          setEditingSchedule(false);
        }}
      />;
    }

    return <HomeScreen
      userId={session.user.id}
      key={session.user.id}
      displayName={profile.display_name}
      onEditProfile={() => setEditingProfile(true)}
      onAvailability={() => { setScheduleSaved(false); setRemovedGamesCount(0); setEditingSchedule(true); }}
      onSignOut={signOut}
      signingOut={loading}
      scheduleSaved={scheduleSaved}
      removedGamesCount={removedGamesCount}
    />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 }}><Text style={styles.logo}>RunIt</Text><ThemeToggle /></View>

        <Text style={styles.tagline}>
          No organizer. Just play.
        </Text>

        <Text style={styles.heading}>
          {screen === 'signin'
            ? 'Welcome back'
            : screen === 'signup'
              ? 'Create your account'
              : 'Reset your password'}
        </Text>

        {screen === 'forgot' && <Text style={styles.subtitle}>
          Enter your email to receive recovery instructions.
        </Text>}

        <TextInput
          style={styles.input}
          keyboardAppearance={mode}
          placeholder="Email address"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!loading}
          accessibilityLabel="Email address"
          value={email}
          onChangeText={setEmail}
        />

        {screen !== 'forgot' && (
          <TextInput
            style={styles.input}
            keyboardAppearance={mode}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoComplete={
              screen === 'signup'
                ? 'new-password'
                : 'current-password'
            }
            editable={!loading}
            accessibilityLabel="Password"
            value={password}
            onChangeText={setPassword}
          />
        )}

        {screen === 'signup' && (
          <TextInput
            style={styles.input}
            keyboardAppearance={mode}
            placeholder="Confirm password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            editable={!loading}
            accessibilityLabel="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        )}

        <TouchableOpacity
          style={[
            styles.button,
            loading && styles.disabled,
          ]}
          onPress={
            screen === 'signin'
              ? signIn
              : screen === 'signup'
                ? signUp
                : forgotPassword
          }
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading
              ? 'Please wait...'
              : screen === 'signin'
                ? 'Sign In'
                : screen === 'signup'
                  ? 'Create Account'
                  : 'Send Recovery Email'}
          </Text>
        </TouchableOpacity>

        {screen === 'signin' && (
          <>
            <TouchableOpacity
              disabled={loading}
              onPress={() => setScreen('forgot')}
            >
              <Text style={styles.link}>
                Forgot password?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={loading}
              onPress={() => setScreen('signup')}
            >
              <Text style={styles.link}>
                Don't have an account? Sign up
              </Text>
            </TouchableOpacity>
          </>
        )}

        {screen !== 'signin' && (
          <TouchableOpacity
            disabled={loading}
            onPress={() => setScreen('signin')}
          >
            <Text style={styles.link}>
              Back to Sign In
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
  },
  center: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  profileContainer: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.green,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 48,
  },
  heading: {
    fontSize: 27,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    marginBottom: 28,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 14,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 17,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    minWidth: 200,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    backgroundColor: colors.primary,
    padding: 16,
    alignItems: 'center',
    margin: 20,
    borderRadius: 12,
  },
  signOutButton: {
    backgroundColor: colors.primary,
    padding: 16,
    alignItems: 'center',
    margin: 20,
    borderRadius: 12,
  },
  disabled: {
    opacity: 0.6,
  },
  link: {
    color: colors.green,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 22,
  },
});
