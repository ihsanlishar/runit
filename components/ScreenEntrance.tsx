import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useTheme } from './ThemeProvider';

export default function ScreenEntrance({ children }: { children: React.ReactNode }) {
  const { reduceMotion } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const entered = useRef(false);
  useEffect(() => {
    if (reduceMotion || entered.current) { progress.setValue(1); return; }
    entered.current = true;
    const animation = Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion]);
  return <Animated.View style={{ flex: 1, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}
