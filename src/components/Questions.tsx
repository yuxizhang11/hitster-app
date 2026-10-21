import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Song } from '../data/types';
import { colors } from '../theme';
import { Button } from './ui';

const native = Platform.OS !== 'web';

export function ChoiceList({ options, onPick }: { options: string[]; onPick: (value: string) => void }) {
  const appear = useRef(options.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      70,
      appear.map((v) => Animated.spring(v, { toValue: 1, friction: 6, useNativeDriver: native })),
    ).start();
  }, [appear]);

  return (
    <View style={{ gap: 10 }}>
      {options.map((option, i) => (
        <Animated.View
          key={option}
          style={{
            opacity: appear[i],
            transform: [{ translateY: appear[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          }}
        >
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onPick(option);
            }}
            style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
          >
            <Text style={styles.choiceLetter}>{'ABCD'[i]}</Text>
            <Text style={styles.choiceText}>{option}</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

export function YearPicker({ initial, onSubmit }: { initial: number; onSubmit: (year: number) => void }) {
  const [year, setYear] = useState(initial);
  const max = new Date().getFullYear();
  const change = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    setYear((y) => Math.min(max, Math.max(1950, y + delta)));
  };
  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Text style={styles.bigYear}>{year}</Text>
      <View style={styles.stepRow}>
        {[-10, -1, +1, +10].map((d) => (
          <Pressable key={d} onPress={() => change(d)} style={({ pressed }) => [styles.step, pressed && styles.choicePressed]}>
            <Text style={styles.stepText}>{d > 0 ? `+${d}` : d}</Text>
          </Pressable>
        ))}
      </View>
      <Button title="Tipp abgeben" onPress={() => onSubmit(year)} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

/** Zeitstrahl des Spielers mit Lücken zum Einordnen. */
export function TimelinePicker({ timeline, onPick }: { timeline: Song[]; onPick: (slot: number) => void }) {
  const Slot = ({ index }: { index: number }) => {
    const before = timeline[index - 1];
    const after = timeline[index];
    const label = !before ? `Vor ${after?.year}` : !after ? `Nach ${before.year}` : `${before.year} – ${after.year}`;
    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPick(index);
        }}
        style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}
      >
        <Ionicons name="add-circle" size={18} color={colors.cyan} />
        <Text style={styles.slotText}>Hier einordnen · {label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: 6 }}>
      <Slot index={0} />
      {timeline.map((song, i) => (
        <View key={song.id} style={{ gap: 6 }}>
          <View style={styles.tlCard}>
            <Text style={styles.tlYear}>{song.year}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tlTitle} numberOfLines={1}>
                {song.title}
              </Text>
              <Text style={styles.tlArtist} numberOfLines={1}>
                {song.artist}
              </Text>
            </View>
          </View>
          <Slot index={i + 1} />
        </View>
      ))}
    </View>
  );
}

export function CountdownBar({ seconds, running, onDone }: { seconds: number; running: boolean; onDone: () => void }) {
  const progress = useRef(new Animated.Value(1)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!running) return;
    progress.setValue(1);
    const anim = Animated.timing(progress, { toValue: 0, duration: seconds * 1000, useNativeDriver: false });
    anim.start(({ finished }) => finished && doneRef.current());
    return () => anim.stop();
  }, [running, seconds, progress]);
  return (
    <View style={styles.barTrack}>
      <Animated.View
        style={[
          styles.barFill,
          {
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: progress.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [colors.red, colors.yellow, colors.green],
            }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  choicePressed: { borderColor: colors.pink, transform: [{ scale: 0.98 }] },
  choiceLetter: { color: colors.pink, fontWeight: '900', fontSize: 18, width: 20 },
  choiceText: { color: colors.text, fontSize: 17, fontWeight: '600', flex: 1 },
  bigYear: { color: colors.text, fontSize: 68, fontWeight: '900', letterSpacing: -3 },
  stepRow: { flexDirection: 'row', gap: 10 },
  step: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 14,
    width: 70,
    alignItems: 'center',
  },
  stepText: { color: colors.text, fontSize: 20, fontWeight: '800' },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.cyan,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  slotPressed: { backgroundColor: 'rgba(0,229,255,0.15)' },
  slotText: { color: colors.cyan, fontWeight: '700', fontSize: 14 },
  tlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.pink,
  },
  tlYear: { color: colors.text, fontSize: 20, fontWeight: '900', width: 58 },
  tlTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  tlArtist: { color: colors.textDim, fontSize: 13 },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: colors.bgSoft, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
});
