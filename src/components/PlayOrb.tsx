import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../theme';

type Props = {
  state: 'idle' | 'loading' | 'playing' | 'disabled';
  onPress: () => void;
  gradient: [string, string];
  size?: number;
};

const PARTICLES = 14;
const native = Platform.OS !== 'web';

/**
 * Großer Plattenteller-Button: pulsiert im Leerlauf, explodiert beim Tippen in Partikel
 * und dreht sich schnell, solange Musik läuft.
 */
export function PlayOrb({ state, onPress, gradient, size = 220 }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const playing = state === 'playing';

  // Plattenteller dreht sich, schneller wenn Musik läuft.
  useEffect(() => {
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: playing ? 1400 : 9000,
        easing: Easing.linear,
        useNativeDriver: native,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [playing, spin]);

  // Pulsierende Ringe.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: playing ? 900 : 2200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: native,
      }),
    );
    pulse.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [playing, pulse]);

  useEffect(() => {
    Animated.timing(glow, { toValue: playing ? 1 : 0, duration: 400, useNativeDriver: native }).start();
  }, [playing, glow]);

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2;
        const dist = size * (0.55 + (i % 3) * 0.12);
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          color: [colors.pink, colors.cyan, colors.yellow, colors.green][i % 4],
          r: 6 + (i % 3) * 3,
        };
      }),
    [size],
  );

  const handlePress = () => {
    if (state === 'disabled' || state === 'loading') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    burst.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(press, { toValue: 0.82, duration: 110, useNativeDriver: native }),
        Animated.spring(press, { toValue: 1, friction: 3, tension: 140, useNativeDriver: native }),
      ]),
      Animated.timing(burst, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
    ]).start();
    onPress();
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const disc = size * 0.78;

  return (
    <View style={{ width: size * 1.5, height: size * 1.5, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2].map((i) => {
        const p = Animated.modulo(Animated.add(pulse, i / 3), 1);
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[
              styles.ring,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: gradient[i % 2],
                opacity: p.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.6, 0] }),
                transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.45] }) }],
              },
            ]}
          />
        );
      })}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: size * 1.1,
            height: size * 1.1,
            borderRadius: size,
            backgroundColor: gradient[0],
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.4] }),
          },
        ]}
      />

      {particles.map((pt, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: pt.r * 2,
            height: pt.r * 2,
            borderRadius: pt.r,
            backgroundColor: pt.color,
            opacity: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
            transform: [
              { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, pt.x] }) },
              { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, pt.y] }) },
              { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1.4, 0.3] }) },
            ],
          }}
        />
      ))}

      <Pressable onPress={handlePress} accessibilityRole="button" accessibilityLabel="Song abspielen">
        <Animated.View style={{ transform: [{ scale: press }] }}>
          <LinearGradient colors={gradient} style={{ width: size, height: size, borderRadius: size / 2, padding: 6 }}>
            <Animated.View
              style={[
                styles.disc,
                { width: size - 12, height: size - 12, borderRadius: size, transform: [{ rotate }] },
              ]}
            >
              {[0.92, 0.8, 0.68, 0.56].map((f) => (
                <View
                  key={f}
                  style={[styles.groove, { width: disc * f + 20, height: disc * f + 20, borderRadius: size }]}
                />
              ))}
              <LinearGradient
                colors={[gradient[1], gradient[0]]}
                style={{ width: size * 0.36, height: size * 0.36, borderRadius: size, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={styles.spindle} />
              </LinearGradient>
              <View style={[styles.shine, { width: size * 0.12, height: size * 0.5, top: size * 0.08, left: size * 0.22 }]} />
            </Animated.View>
          </LinearGradient>
          <View style={styles.center} pointerEvents="none">
            {state === 'loading' ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : !playing ? (
              <Ionicons name="play" size={size * 0.2} color="#fff" style={{ marginLeft: size * 0.03 }} />
            ) : null}
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 3 },
  glow: { position: 'absolute' },
  disc: { backgroundColor: '#120A24', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  groove: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  spindle: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0B0620' },
  shine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 100, transform: [{ rotate: '35deg' }] },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
