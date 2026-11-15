
import React, { useEffect, useState } from 'react';
import ProfileScreen from './components/ProfileScreen';
import HomeScreen from './components/HomeScreen';
import MatchmakingTestScreen from './components/MatchmakingTestScreen';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type Screen = 'signin' | 'signup' | 'forgot';

type Profile = {
  username: string;
  display_name: string;
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  // Temporary matchmaking testing screen
  const [testingMatchmaking, setTestingMatchmaking] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        Alert.alert('Session error', error.message);
      }

      setSession(data.session);
      setInitializing(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) {
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
    setTestingMatchmaking(false);
    setProfileError(null);

    if (!userId) {
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          setProfileError(error.message);
        } else {
          setProfile(data);
        }

        setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  async function loadUserProfile(userId: string) {
    setProfileLoading(true);
    setProfileError(null);

    const { data, error } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      setProfileError(error.message);
    } else {
      setProfile(data);
    }

    setProfileLoading(false);
    return !error && !!data;
  }

  async function handleProfileSaved() {
    if (!session) return;

    const success = await loadUserProfile(session.user.id);

    if (success) {
      setEditingProfile(false);
    }
  }

  async function signUp() {
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
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function signIn() {
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing information',
        'Enter your email and password.'
      );
      return;
    }

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
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    if (!email.trim()) {
      Alert.alert(
        'Email required',
        'Enter your email address.'
      );
      return;
    }

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
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (loading) return;

    setLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      setPassword('');
      setSession(null);
      setProfile(null);
      setEditingProfile(false);
      setTestingMatchmaking(false);
      setScreen('signin');
    } catch (error) {
      Alert.alert(
        'Sign out failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  if (session) {
    if (profileLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16A34A" />
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
            onPress={() => loadUserProfile(session.user.id)}
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
      return (
        <View style={styles.profileContainer}>
          <ProfileScreen
            userId={session.user.id}
            onSaved={handleProfileSaved}
          />

          {profile && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setEditingProfile(false)}
            >
              <Text style={styles.buttonText}>
                Back to Home
              </Text>
            </TouchableOpacity>
          )}

          {!profile && (
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={signOut}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Sign Out</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Authenticated home and matchmaking testing
    return (
      <View style={{ flex: 1 }}>
        {testingMatchmaking ? (
          <MatchmakingTestScreen
            onBack={() => setTestingMatchmaking(false)}
          />
        ) : (
          <>
            <HomeScreen
              displayName={profile.display_name}
              onEditProfile={() => setEditingProfile(true)}
              onSignOut={signOut}
            />

            <TouchableOpacity
              style={styles.testButton}
              onPress={() => setTestingMatchmaking(true)}
            >
              <Text style={styles.buttonText}>
                Test Matchmaking
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
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
        <Text style={styles.logo}>RunIt</Text>

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

        <Text style={styles.subtitle}>
          {screen === 'signin'
            ? 'Sign in to find your next game.'
            : screen === 'signup'
              ? 'Join RunIt and start playing.'
              : 'Enter your email to receive recovery instructions.'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#888"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />

        {screen !== 'forgot' && (
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            autoComplete={
              screen === 'signup'
                ? 'new-password'
                : 'current-password'
            }
            value={password}
            onChangeText={setPassword}
          />
        )}

        {screen === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor="#888"
            secureTextEntry
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
              onPress={() => setScreen('forgot')}
            >
              <Text style={styles.link}>
                Forgot password?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
  },
  center: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  profileContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: '#16A34A',
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 48,
  },
  heading: {
    fontSize: 27,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    marginBottom: 28,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#666666',
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 14,
    backgroundColor: '#FAFAFA',
    color: '#111111',
  },
  button: {
    backgroundColor: '#16A34A',
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
    backgroundColor: '#222222',
    padding: 16,
    alignItems: 'center',
    margin: 20,
    borderRadius: 12,
  },
  signOutButton: {
    backgroundColor: '#222222',
    padding: 16,
    alignItems: 'center',
    margin: 20,
    borderRadius: 12,
  },
  testButton: {
    backgroundColor: '#2563EB',
    padding: 17,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  link: {
    color: '#16A34A',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 22,
  },
});
