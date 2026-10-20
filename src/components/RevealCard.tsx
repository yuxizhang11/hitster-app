import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import type { Song } from '../data/types';

const native = Platform.OS !== 'web';

/** Hitster-Karte, die sich beim Auflösen umdreht. */
/** `compact`: kleinere Karte, wenn darunter noch mehrere Ergebnisse stehen. */
export function RevealCard({ song, gradient, compact }: { song: Song; gradient: [string, string]; compact?: boolean }) {
  const flip = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    flip.setValue(0);
    Animated.spring(flip, { toValue: 1, friction: 7, tension: 40, useNativeDriver: native }).start();
  }, [song.id, flip]);

  const rotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const scale = flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.08, 1] });

  return (
    <Animated.View style={{ transform: [{ perspective: 1000 }, { rotateY }, { scale }] }}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, compact && styles.cardCompact]}>
        <Text style={styles.artist} numberOfLines={2}>
          {song.artist}
        </Text>
        <Text style={[styles.year, compact && { fontSize: 52 }]}>{song.year}</Text>
        <Text style={styles.title} numberOfLines={3}>
          {song.title}
        </Text>
        <View style={styles.dot} />
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    minHeight: 240,
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardCompact: { width: 220, minHeight: 0, padding: 16, gap: 4 },
  artist: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  year: { color: '#fff', fontSize: 64, fontWeight: '900', letterSpacing: -2 },
  title: { color: '#fff', fontSize: 18, fontStyle: 'italic', textAlign: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.6)' },
});
