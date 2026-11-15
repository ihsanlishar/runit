
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

import { supabase } from '../lib/supabase';

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type Props = {
  userId: string;
  onSaved?: () => void | Promise<void>;
};

export default function ProfileScreen({
  userId,
  onSaved,
}: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  async function loadProfile() {
    setLoading(true);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      Alert.alert('Error loading profile', error.message);
    } else {
      setProfile(data);

      if (data) {
        setUsername(data.username);
        setDisplayName(data.display_name);
      }
    }

    setLoading(false);
  }

  async function saveProfile() {
    const cleanUsername = username.trim().toLowerCase();
    const cleanName = displayName.trim();

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      Alert.alert(
        'Invalid username',
        'Use 3–20 lowercase letters, numbers, or underscores.'
      );
      return;
    }

    if (!cleanName || cleanName.length > 50) {
      Alert.alert(
        'Invalid name',
        'Use a display name of 1–50 characters.'
      );
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            username: cleanUsername,
            display_name: cleanName,
          },
          { onConflict: 'id' }
        )
        .select('id, username, display_name, avatar_url')
        .single();

      if (error) throw error;

      setProfile(data);

      Alert.alert(
        'Success',
        'Your profile has been saved!'
      );

      if (onSaved) {
        await onSaved();
      }
    } catch (error: any) {
      if (error?.code === '23505') {
        Alert.alert(
          'Username taken',
          'Please choose another username.'
        );
      } else {
        Alert.alert(
          'Save failed',
          error instanceof Error
            ? error.message
            : 'Please try again.'
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function goHome() {
    if (onSaved) {
      await onSaved();
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16A34A" />
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
        <Text style={styles.heading}>
          {profile ? 'Edit your profile' : 'Create your profile'}
        </Text>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={50}
        />

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. ihsan_23"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          maxLength={20}
        />

        <TouchableOpacity
          style={[styles.button, saving && styles.disabled]}
          onPress={saveProfile}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Text>
        </TouchableOpacity>

        {profile && (
          <>
            <Text style={styles.saved}>
              Current username: @{profile.username}
            </Text>

            <TouchableOpacity
              style={[styles.homeButton, saving && styles.disabled]}
              onPress={goHome}
              disabled={saving}
            >
              <Text style={styles.buttonText}>
                Go to Home
              </Text>
            </TouchableOpacity>
          </>
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  heading: {
    fontSize: 27,
    fontWeight: '700',
    marginBottom: 30,
    color: '#111111',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#FAFAFA',
    color: '#111111',
  },
  button: {
    backgroundColor: '#16A34A',
    padding: 17,
    borderRadius: 12,
    alignItems: 'center',
  },
  homeButton: {
    backgroundColor: '#222222',
    padding: 17,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  saved: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666666',
  },
  disabled: {
    opacity: 0.6,
  },
});
