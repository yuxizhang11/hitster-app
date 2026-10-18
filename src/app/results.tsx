import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Card, H1, P, Screen } from '../components/ui';
import { ranking, winners } from '../game/engine';
import { useGame } from '../state/GameContext';
import { colors, PLAYER_COLORS } from '../theme';

const native = Platform.OS !== 'web';
const CONFETTI = 36;

export default function ResultsScreen() {
  const { game, setup, startGame, setGame } = useGame();

  useEffect(() => {
    if (!game) router.replace('/');
  }, [game]);

  if (!game) return null;
  const ranked = ranking(game);
  const top = winners(game);
  const cards = game.mode.end.kind === 'cards';
  const colorOf = (id: string) => PLAYER_COLORS[game.players.findIndex((p) => p.id === id) % PLAYER_COLORS.length];

  return (
    <Screen>
      <Confetti />
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 30 }}>
        <Text style={{ fontSize: 72 }}>🏆</Text>
        <P>{top.length > 1 ? 'Unentschieden!' : game.players.length > 1 ? 'Gewonnen hat' : 'Dein Ergebnis'}</P>
        <H1 style={{ textAlign: 'center', color: colorOf(top[0]?.id ?? '') }}>{top.map((p) => p.name).join(' & ')}</H1>
      </View>

      <View style={{ gap: 8 }}>
        {ranked.map((p, i) => (
          <Card key={p.id} style={[styles.row, i === 0 && { borderColor: colors.yellow }]}>
            <Text style={styles.place}>{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</Text>
            <View style={[styles.dot, { backgroundColor: colorOf(p.id) }]} />
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.score}>
              {cards ? `${p.timeline.length} Karten` : `${p.score} ${p.score === 1 ? 'Punkt' : 'Punkte'}`}
            </Text>
          </Card>
        ))}
      </View>

      {cards && ranked[0] && (
        <Card style={{ gap: 6 }}>
          <Text style={styles.tlTitle}>Zeitstrahl von {ranked[0].name}</Text>
          {ranked[0].timeline.map((s) => (
            <P key={s.id}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{s.year}</Text> · {s.title} – {s.artist}
            </P>
          ))}
        </Card>
      )}

      <Button
        title="Nochmal spielen"
        onPress={() => {
          startGame(setup);
          router.replace('/game');
        }}
      />
      <Button
        title="Zum Menü"
        variant="ghost"
        onPress={() => {
          setGame(null);
          router.replace('/');
        }}
      />
    </Screen>
  );
}

function Confetti() {
  const { width, height } = Dimensions.get('window');
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => ({
        x: Math.random() * width,
        delay: Math.random() * 900,
        drift: (Math.random() - 0.5) * 120,
        color: [colors.pink, colors.cyan, colors.yellow, colors.green, colors.purple][i % 5],
        size: 8 + Math.random() * 8,
        value: new Animated.Value(0),
      })),
    [width],
  );
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    Animated.parallel(
      pieces.map((p) =>
        Animated.timing(p.value, {
          toValue: 1,
          duration: 2600,
          delay: p.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: native,
        }),
      ),
    ).start();
  }, [pieces]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -20,
            width: p.size,
            height: p.size * 1.6,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.value.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.value.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
              { translateX: p.value.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${360 + i * 40}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  place: { fontSize: 24, width: 34, textAlign: 'center', color: colors.text, fontWeight: '800' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { color: colors.text, fontSize: 18, fontWeight: '800', flex: 1 },
  score: { color: colors.yellow, fontSize: 16, fontWeight: '900' },
  tlTitle: { color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 4 },
});
