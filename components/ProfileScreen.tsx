import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/schedule';
import { readWithTimeout } from '../lib/requests';
import { Button, ErrorNotice, useUI } from './ui';

export type UserProfile = { id: string; username: string; display_name: string; avatar_url: string | null };
type Props = { userId: string; onSaved: (profile: UserProfile) => void; onBack?: () => void; onSignOut?: () => void; signingOut?: boolean };

export default function ProfileScreen({ userId, onSaved, onBack, onSignOut, signingOut }: Props) {
  const { colors, ui, mode } = useUI();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const saveLock = useRef(false);
  const alive = useRef(true);
  const dirty = username !== (profile?.username ?? '') || displayName !== (profile?.display_name ?? '');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    async function load() {
      try {
        const { data, error } = await readWithTimeout(supabase.from('profiles').select('id, username, display_name, avatar_url').eq('id', userId).maybeSingle());
        if (error) throw error;
        if (active) { setProfile(data); setUsername(data?.username ?? ''); setDisplayName(data?.display_name ?? ''); }
      } catch (error) { if (active) setLoadError(errorMessage(error)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [userId, reload]);

  function exit(action: () => void) {
    if (saveLock.current || signingOut) return;
    if (dirty) Alert.alert('Discard profile changes?', 'Your changes have not been saved.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard changes', style: 'destructive', onPress: action },
    ]);
    else action();
  }
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onBack) exit(onBack);
      return !!onBack || saveLock.current || dirty;
    });
    return () => listener.remove();
  });

  async function save() {
    if (saveLock.current || loading || loadError || signingOut) return;
    const cleanUsername = username.trim().toLowerCase();
    const cleanName = displayName.trim();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) { setSaveError('Use 3–20 lowercase letters, numbers, or underscores for your username.'); return; }
    if (!cleanName || cleanName.length > 50) { setSaveError('Use a display name of 1–50 characters.'); return; }
    saveLock.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const { data, error } = await supabase.from('profiles').upsert({ id: userId, username: cleanUsername, display_name: cleanName }, { onConflict: 'id' })
        .select('id, username, display_name, avatar_url').single();
      if (error) throw error;
      if (alive.current) { setProfile(data); setUsername(data.username); setDisplayName(data.display_name); onSaved(data); }
    } catch (error) {
      if (alive.current) setSaveError(typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
        ? 'That username is taken. Please choose another.' : errorMessage(error));
    } finally { saveLock.current = false; if (alive.current) setSaving(false); }
  }

  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={[ui.content, { flexGrow: 1, justifyContent: 'center' }]} keyboardShouldPersistTaps="handled">
      <Text style={ui.title}>{onBack ? 'Edit profile' : 'Create profile'}</Text>
      {loading ? <ActivityIndicator color={colors.green} accessibilityLabel="Loading profile" /> : loadError ? <>
        <ErrorNotice message={`Unable to load your profile: ${loadError}`} />
        <Button label="Try again" onPress={() => setReload(value => value + 1)} />
      </> : <View style={ui.card}>
        <Text style={ui.label}>Display name</Text>
        <TextInput accessibilityLabel="Display name" style={ui.input} placeholder="Your name" placeholderTextColor={colors.muted} value={displayName} onChangeText={value => { setDisplayName(value); setSaveError(null); }} maxLength={50} keyboardAppearance={mode} editable={!saving && !signingOut} />
        <Text style={ui.label}>Username</Text>
        <TextInput accessibilityLabel="Username" style={ui.input} placeholder="e.g. ihsan_23" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} value={username} onChangeText={value => { setUsername(value); setSaveError(null); }} maxLength={20} keyboardAppearance={mode} editable={!saving && !signingOut} />
        <Text style={ui.text}>3–20 letters, numbers, or underscores. Your username is unique.</Text>
        {saveError && <ErrorNotice message={saveError} />}
        <Button label={saving ? 'Saving profile...' : 'Save profile'} onPress={save} disabled={saving || signingOut} busy={saving} />
      </View>}
      {onBack && <Button label="Back to home" secondary onPress={() => exit(onBack)} disabled={saving || signingOut} />}
      {!onBack && onSignOut && <Button label={signingOut ? 'Signing out...' : 'Sign out'} secondary onPress={() => exit(onSignOut)} disabled={saving || signingOut} />}
    </ScrollView>
  </KeyboardAvoidingView>;
}
