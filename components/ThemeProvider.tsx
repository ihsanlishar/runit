import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo, Alert } from 'react-native';

export type ThemeMode = 'light' | 'dark';
export const lightColors = {
  green: '#15803D', primary: '#15803D', ink: '#11251B', muted: '#5F7066', paper: '#F3F4EF',
  surface: '#FFFFFF', line: '#E0E4DE', pale: '#E9F1E7', hero: '#11251B',
  danger: '#B91C1C', errorText: '#9B2525', errorBackground: '#FFF0F0', errorBorder: '#EDCCCC',
};
export type Palette = typeof lightColors;
export const darkColors: Palette = {
  green: '#78D693', primary: '#216D3D', ink: '#EDF6EF', muted: '#AABBAF', paper: '#0D1511',
  surface: '#17231D', line: '#34463A', pale: '#213F2B', hero: '#102619',
  danger: '#B91C1C', errorText: '#FFB4B4', errorBackground: '#361E22', errorBorder: '#704047',
};
const STORAGE_KEY = 'runit:theme:v1';
type Theme = { mode: ThemeMode; colors: Palette; reduceMotion: boolean; toggle: () => void };
const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [reduceMotion, setReduceMotion] = useState(true);
  const current = useRef<ThemeMode>('light');
  const changed = useRef(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (active && !changed.current && (saved === 'light' || saved === 'dark')) {
        current.current = saved;
        setMode(saved);
      }
    }).catch(() => { /* Keep the default theme if device storage cannot be read. */ });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    let changed = false;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (active && !changed) setReduceMotion(enabled);
    }).catch(() => { /* Keep motion off if the preference cannot be read. */ });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      changed = true;
      if (active) setReduceMotion(enabled);
    });
    return () => { active = false; listener.remove(); };
  }, []);
  const toggle = useCallback(() => {
    changed.current = true;
    const next = current.current === 'light' ? 'dark' : 'light';
    current.current = next;
    setMode(next);
    // Serialize rapid toggles so the saved preference always matches the latest tap.
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(STORAGE_KEY, next)).catch(() => {
      Alert.alert('Theme updated', 'Your theme changed, but could not be saved on this device.');
    });
  }, []);
  const value = useMemo(() => ({ mode, colors: mode === 'dark' ? darkColors : lightColors, reduceMotion, toggle }), [mode, reduceMotion, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeProvider is required.');
  return theme;
}
