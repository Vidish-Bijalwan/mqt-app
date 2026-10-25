/**
 * Motion primitives (v2.0.2). Animated API only — no new animation
 * libraries. Every primitive respects the system reduced-motion setting:
 * when it is on, components render without any animation at all (plain
 * Views / Pressables), never a slowed-down version.
 *
 * - FadeInView: list-item entrance — subtle fade + small rise on first
 *   mount, lightly staggered by `index` (capped so a long list does not
 *   cascade for seconds). Mount-only: no re-animation on re-render.
 * - PressScale: card press feedback — gentle scale + opacity dip while
 *   pressed, springing back on release. Implemented with an Animated
 *   value on press in/out, not with a press-state style swap, so the
 *   feedback animates rather than snapping.
 * - TabFade: wraps a tab screen's content and fades it in (from 0.85)
 *   whenever the tab gains focus. Stack transitions are untouched
 *   (App.tsx, 180ms); tab switches have no navigation animation by
 *   design, so this is the only tab motion, and it is subtle.
 */
import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  View,
} from 'react-native';
import type { ReactNode } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);
  return reduceMotion;
}

export function FadeInView({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: unknown;
}) {
  const reduceMotion = useReducedMotion();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setTimeout(
      () => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      },
      Math.min(index, 8) * 40,
    );
    return () => clearTimeout(timer);
  }, [anim, index, reduceMotion]);
  if (reduceMotion) {
    return <View style={style as never}>{children}</View>;
  }
  return (
    <Animated.View
      style={[
        style as never,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

export function PressScale({
  onPress,
  onLongPress,
  accessibilityLabel,
  style,
  children,
}: {
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  style?: unknown;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));
  const animate = (toScale: number, toOpacity: number) => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: toScale,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: toOpacity,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };
  if (reduceMotion) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={accessibilityLabel}
        style={style as never}>
        {children}
      </Pressable>
    );
  }
  return (
    <Animated.View
      style={{ transform: [{ scale }], opacity } as never}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => animate(0.98, 0.85)}
        onPressOut={() => animate(1, 1)}
        accessibilityLabel={accessibilityLabel}
        style={style as never}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function TabFade({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [anim] = useState(() => new Animated.Value(1));
  useFocusEffect(
    React.useCallback(() => {
      if (reduceMotion) return;
      anim.setValue(0.85);
      Animated.timing(anim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }, [anim, reduceMotion]),
  );
  if (reduceMotion) {
    return <View style={{ flex: 1 }}>{children}</View>;
  }
  return (
    <Animated.View style={{ flex: 1, opacity: anim }}>
      {children}
    </Animated.View>
  );
}
