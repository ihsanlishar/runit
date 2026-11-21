import React, { useEffect, useRef } from 'react';
import { Animated, AppState, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from './ThemeProvider';

export default function AmbientBackground({ paused = false }: { paused?: boolean }) {
  const { colors, mode, reduceMotion } = useTheme();
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion || paused) { phase.setValue(0); return; }
    const options = { duration: 14000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false };
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(phase, { ...options, toValue: 1 }),
      Animated.timing(phase, { ...options, toValue: 0 }),
    ]));
    if (AppState.currentState === 'active' || AppState.currentState === null) loop.start();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') loop.start(); else loop.stop(); });
    return () => { loop.stop(); listener.remove(); phase.stopAnimation(); };
  }, [paused, phase, reduceMotion]);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    <Animated.View style={[styles.orbit, {
      opacity: mode === 'dark' ? 0.13 : 0.08,
      borderColor: colors.green,
      transform: [
        { translateX: phase.interpolate({ inputRange: [0, 1], outputRange: [-12, 12] }) },
        { translateY: phase.interpolate({ inputRange: [0, 1], outputRange: [6, -6] }) },
      ],
    }]}>
      <View style={[styles.inner, { borderColor: colors.green }]} />
      <View style={[styles.line, { backgroundColor: colors.green }]} />
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  orbit: { position: 'absolute', width: 420, height: 420, borderRadius: 210, borderWidth: 1, right: -230, top: -130 },
  inner: { position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 1, top: 69, left: 69 },
  line: { position: 'absolute', width: 1, height: 420, top: 0, left: 209 },
});
