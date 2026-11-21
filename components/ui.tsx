import React, { useEffect, useMemo, useRef } from 'react';
import { Palette, useTheme } from './ThemeProvider';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TouchableOpacityProps } from 'react-native';
export function useUI() {
  const { colors, mode, reduceMotion } = useTheme();
  const ui = useMemo(() => createUI(colors), [colors]);
  return { colors, mode, reduceMotion, ui };
}
export function PressSurface({ children, disabled, onPressIn, onPressOut, ...props }: TouchableOpacityProps) {
  const { reduceMotion } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion || disabled) { scale.stopAnimation(); scale.setValue(1); }
    return () => scale.stopAnimation();
  }, [disabled, reduceMotion, scale]);
  function release() {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue: 1, stiffness: 280, damping: 24, mass: 0.8, useNativeDriver: true, isInteraction: false }).start();
  }
  return <Animated.View style={{ transform: [{ scale }] }}>
    <TouchableOpacity {...props} disabled={disabled} activeOpacity={reduceMotion ? 1 : 0.86}
      onPressIn={event => {
        if (!reduceMotion && !disabled) Animated.timing(scale, { toValue: 0.985, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false }).start();
        onPressIn?.(event);
      }} onPressOut={event => { release(); onPressOut?.(event); }}>
      {children}
    </TouchableOpacity>
  </Animated.View>;
}

export function Button({ label, onPress, disabled, secondary, danger, busy }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean; busy?: boolean }) {
  const { colors, ui } = useUI();
  return <PressSurface accessibilityRole="button" accessibilityState={{ disabled: !!disabled, busy: !!busy }} disabled={disabled} onPress={onPress}
    style={[ui.button, secondary && ui.secondary, danger && { backgroundColor: colors.danger }, disabled && { opacity: 0.5 }]}>
    {busy && <ActivityIndicator color={secondary && !danger ? colors.green : '#FFF'} />}
    <Text style={[ui.buttonText, secondary && !danger && { color: colors.green }]}>{label}</Text>
  </PressSurface>;
}
export function ErrorNotice({ message }: { message: string }) {
  const { colors, ui } = useUI();
  return <View accessibilityRole="alert" style={ui.error}><Text selectable style={{ color: colors.errorText, lineHeight: 22 }}>{message}</Text></View>;
}
const createUI = (colors: Palette) => StyleSheet.create({
  label: { fontSize: 15, fontWeight: '700', color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, fontSize: 16, backgroundColor: colors.paper, color: colors.ink, minHeight: 52 },
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, paddingBottom: 40, gap: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 30, fontWeight: '700', color: colors.ink, letterSpacing: -1 },
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink },
  text: { fontSize: 15, lineHeight: 23, color: colors.muted },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: '600', color: colors.green },
  card: { padding: 18, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 12 },
  button: { minHeight: 50, borderRadius: 12, padding: 14, backgroundColor: colors.primary, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.pale },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  error: { padding: 16, borderRadius: 14, backgroundColor: colors.errorBackground, borderWidth: 1, borderColor: colors.errorBorder },
});
