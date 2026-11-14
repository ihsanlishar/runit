
import React, { useEffect, useState } from 'react';
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

export default function App() {
  const [screen, setScreen] = useState<Screen>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) Alert.alert('Session error', error.message);
      setSession(data.session);
      setInitializing(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signUp() {
    if (!email.trim() || !password) {
      Alert.alert('Missing information', 'Enter your email and password.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      Alert.alert(
        'Check your email',
        'Open the confirmation email, verify your address, then return to RunIt and sign in.'
      );

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
      Alert.alert('Missing information', 'Enter your email and password.');
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
      Alert.alert('Email required', 'Enter your email address.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase()
      );

      if (error) throw error;

      Alert.alert(
        'Check your email',
        'If an account exists for this address, password recovery instructions will be sent.'
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
    setLoading(true);

    const { error } = await supabase.auth.signOut();

    setLoading(false);

    if (error) {
      Alert.alert('Sign out failed', error.message);
    } else {
      setPassword('');
      setSession(null);
      setScreen('signin');
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
    return (
      <View style={styles.center}>
        <Text style={styles.logo}>RunIt 🏀</Text>
        <Text style={styles.heading}>You're in!</Text>
        <Text style={styles.subtitle}>
          Signed in as {session.user.email ?? 'RunIt player'}
        </Text>
        <Text style={styles.description}>
          Your account is connected to Supabase.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={signOut}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing out...' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
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
        <Text style={styles.logo}>RunIt 🏀</Text>
        <Text style={styles.tagline}>No organizer. Just play.</Text>

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
            autoComplete={screen === 'signup' ? 'new-password' : 'current-password'}
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
          style={[styles.button, loading && styles.disabled]}
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
            <TouchableOpacity onPress={() => setScreen('forgot')}>
              <Text style={styles.link}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setScreen('signup')}>
              <Text style={styles.link}>
                Don't have an account? Sign up
              </Text>
            </TouchableOpacity>
          </>
        )}

        {screen !== 'signin' && (
          <TouchableOpacity onPress={() => setScreen('signin')}>
            <Text style={styles.link}>Back to Sign In</Text>
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
  description: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 24,
    textAlign: 'center',
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
