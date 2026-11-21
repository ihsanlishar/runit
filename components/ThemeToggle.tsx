import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { mode, colors, toggle } = useTheme();
  const dark = mode === 'dark';
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    accessibilityHint="Changes the appearance of RunIt" onPress={toggle}
    style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.line }]}>
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.icon}>
      {dark ? <>
        <View style={[styles.sun, { borderColor: colors.ink }]} />
        {Array.from({ length: 8 }, (_, index) => <View key={index} style={[styles.rayArm, { transform: [{ rotate: `${index * 45}deg` }] }]}>
          <View style={[styles.ray, { backgroundColor: colors.ink }]} />
        </View>)}
      </> : <View style={[styles.moon, { backgroundColor: colors.ink }]}>
        <View style={[styles.cutout, { backgroundColor: colors.surface }]} />
      </View>}
    </View>
  </TouchableOpacity>;
}
const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  sun: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  rayArm: { position: 'absolute', top: 0, left: 0, width: 24, height: 24, alignItems: 'center' },
  ray: { width: 2, height: 4, borderRadius: 1 },
  moon: { width: 20, height: 20, borderRadius: 10, overflow: 'hidden' },
  cutout: { position: 'absolute', width: 19, height: 19, borderRadius: 10, top: -4, left: 7 },
});
