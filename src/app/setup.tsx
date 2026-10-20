import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, H1, P, Screen } from '../components/ui';
import { dedupeSongs, Scoring } from '../game/engine';
import { getMode, ModeId, MODES } from '../game/modes';
import { useGame } from '../state/GameContext';
import { colors, PLAYER_COLORS } from '../theme';

const MAX_PLAYERS = 8;

export default function SetupScreen() {
  const { setup, loaded, startGame, categories } = useGame();
  const [players, setPlayers] = useState(setup.players);
  const [modeId, setModeId] = useState<ModeId>(setup.modeId);
  const [categoryIds, setCategoryIds] = useState(setup.categoryIds);
  const [target, setTarget] = useState<number | undefined>(setup.target);
  const [scoring, setScoring] = useState<Scoring>(setup.scoring ?? 'app');
  const [step, setStep] = useState(0);

  // Gespeichertes Setup kann nach dem ersten Rendern geladen werden: einmal übernehmen, danach nicht mehr überschreiben.
  useEffect(() => {
    if (!loaded) return;
    setPlayers(setup.players);
    setModeId(setup.modeId);
    setCategoryIds(setup.categoryIds);
    setTarget(setup.target);
    setScoring(setup.scoring ?? 'app');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const mode = getMode(modeId);
  const defaultTarget = mode.end.kind === 'cards' ? mode.end.target : mode.end.kind === 'rounds' ? mode.end.rounds : undefined;
  const effectiveTarget = target ?? defaultTarget;
  const songCount = dedupeSongs(categories.filter((c) => categoryIds.includes(c.id)).flatMap((c) => c.songs)).length;
  const names = players.map((p) => p.trim()).filter(Boolean);
  const needed = mode.group
    ? Math.max(8, effectiveTarget ?? 10)
    : Math.max(8, names.length * (effectiveTarget ?? 3) + names.length);
  const canStart = names.length > 0 && categoryIds.length > 0 && songCount >= 8;

  const toggleCategory = (id: string) =>
    setCategoryIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const start = () => {
    startGame({ players: names, modeId, categoryIds, target: target === defaultTarget ? undefined : target, scoring });
    router.replace(mode.group ? '/group' : '/game');
  };

  const STEPS = ['Spieler', 'Spielmodus', 'Musik'] as const;
  const isLast = step === STEPS.length - 1;
  const back = () => (step > 0 ? setStep(step - 1) : router.back());
  const stepOk = step === 0 ? names.length > 0 : step === 1 ? true : canStart;

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <H1 style={{ flex: 1 }}>{STEPS[step]}</H1>
        <Text style={styles.stepCount}>
          {step + 1}/{STEPS.length}
        </Text>
      </View>

      {/* Jeder Schritt passt auf einen Bildschirm, nur auf sehr kleinen Handys wird hier gescrollt. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <Card style={{ gap: 8 }}>
            {players.map((name, i) => (
              <View key={i} style={styles.playerRow}>
                <View style={[styles.playerDot, { backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }]} />
                <TextInput
                  value={name}
                  onChangeText={(t) => setPlayers((ps) => ps.map((p, j) => (j === i ? t : p)))}
                  placeholder={`Spieler ${i + 1}`}
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  maxLength={20}
                />
                {players.length > 1 && (
                  <Pressable onPress={() => setPlayers((ps) => ps.filter((_, j) => j !== i))} hitSlop={10}>
                    <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            ))}
            {players.length < MAX_PLAYERS && (
              <Pressable onPress={() => setPlayers((ps) => [...ps, `Spieler ${ps.length + 1}`])} style={styles.addRow}>
                <Ionicons name="person-add" size={18} color={colors.cyan} />
                <Text style={{ color: colors.cyan, fontWeight: '700' }}>Spieler hinzufügen</Text>
              </Pressable>
            )}
          </Card>
        )}

        {step === 1 && (
          <>
            <View style={styles.grid}>
              {MODES.map((m) => {
                const selected = m.id === modeId;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      setModeId(m.id);
                      setTarget(undefined);
                    }}
                    style={styles.modeCell}
                  >
                    <LinearGradient
                      colors={selected ? m.colors : [colors.card, colors.card]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.modeCard, !selected && { borderColor: colors.cardBorder, borderWidth: 1 }]}
                    >
                      <Text style={styles.modeEmoji}>{m.emoji}</Text>
                      <Text style={styles.modeName} numberOfLines={1}>
                        {m.name}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>

            <Card style={{ gap: 4, paddingVertical: 12 }}>
              <Text style={styles.rulesTitle}>
                {mode.emoji} {mode.name}: {mode.tagline}
              </Text>
              {mode.rules.map((r) => (
                <Text key={r} style={styles.rule}>
                  • {r}
                </Text>
              ))}
              {effectiveTarget !== undefined && (
                <View style={styles.targetRow}>
                  <Text style={styles.targetLabel}>
                    {mode.end.kind === 'cards' ? 'Karten zum Sieg' : mode.group ? 'Anzahl Songs' : 'Runden pro Spieler'}
                  </Text>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => setTarget(Math.max(1, effectiveTarget - 1))} hitSlop={8}>
                      <Ionicons name="remove-circle" size={30} color={colors.pink} />
                    </Pressable>
                    <Text style={styles.targetValue}>{effectiveTarget}</Text>
                    <Pressable onPress={() => setTarget(Math.min(30, effectiveTarget + 1))} hitSlop={8}>
                      <Ionicons name="add-circle" size={30} color={colors.pink} />
                    </Pressable>
                  </View>
                </View>
              )}
              {mode.group && (
                <View style={{ gap: 6, marginTop: 8 }}>
                  <View style={styles.segment}>
                    {(
                      [
                        ['app', 'Punkte in der App'],
                        ['manual', 'Punkte auf Zettel'],
                      ] as const
                    ).map(([value, label]) => (
                      <Pressable
                        key={value}
                        onPress={() => setScoring(value)}
                        style={[styles.segmentItem, scoring === value && { backgroundColor: colors.pink }]}
                      >
                        <Text style={[styles.segmentText, scoring === value && { color: '#fff' }]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </Card>
          </>
        )}

        {step === 2 && (
          <>
            <View style={styles.chips}>
              {categories.map((c) => {
                const selected = categoryIds.includes(c.id);
                return (
                  <Pressable key={c.id} onPress={() => toggleCategory(c.id)}>
                    <LinearGradient
                      colors={selected ? c.colors : [colors.card, colors.card]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.chip, !selected && { borderColor: colors.cardBorder, borderWidth: 1 }]}
                    >
                      <Text style={styles.chipText}>
                        {c.emoji} {c.name}
                      </Text>
                      <Text style={[styles.chipCount, selected && { color: '#fff' }]}>{c.songs.length}</Text>
                    </LinearGradient>
                  </Pressable>
                );
              })}
              <Pressable onPress={() => router.push('/settings')}>
                <View style={[styles.chip, { borderColor: colors.cyan, borderWidth: 1, borderStyle: 'dashed' }]}>
                  <Text style={[styles.chipText, { color: colors.cyan }]}>＋ Eigene Playlist</Text>
                </View>
              </Pressable>
            </View>
            <Pressable onPress={() => router.push('/songs')} hitSlop={6}>
              <Text style={{ color: colors.cyan, fontWeight: '700' }}>Songlisten ansehen und bearbeiten ›</Text>
            </Pressable>
            <P style={{ color: songCount < needed ? colors.yellow : colors.textMuted }}>
              {songCount} Songs ausgewählt
              {songCount < 8
                ? ' · wähle mindestens 8 Songs'
                : songCount < needed
                  ? ' · könnte knapp werden, das Spiel endet wenn die Songs ausgehen'
                  : ''}
            </P>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <Pressable key={s} onPress={() => (i < step || stepOk ? setStep(i) : null)} hitSlop={8}>
              <View style={[styles.dotStep, i === step && { backgroundColor: colors.pink, width: 22 }]} />
            </Pressable>
          ))}
        </View>
        <Button
          title={isLast ? "Los geht's!" : 'Weiter'}
          onPress={isLast ? start : () => setStep(step + 1)}
          disabled={!stepOk}
          gradient={isLast ? mode.colors : undefined}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playerDot: { width: 14, height: 14, borderRadius: 7 },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.bgSoft,
    borderRadius: 12,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  modeCell: { width: '50%', padding: 4 },
  modeCard: { borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeEmoji: { fontSize: 22 },
  modeName: { color: colors.text, fontWeight: '800', fontSize: 15, flex: 1 },
  rulesTitle: { color: colors.text, fontWeight: '800', fontSize: 15, marginBottom: 2 },
  rule: { color: colors.textDim, fontSize: 13, lineHeight: 17 },
  stepCount: { color: colors.textDim, fontWeight: '800', fontSize: 15 },
  footer: { gap: 12, paddingTop: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dotStep: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cardBorder },
  targetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  targetLabel: { color: colors.text, fontWeight: '700', fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetValue: { color: colors.text, fontSize: 22, fontWeight: '900', minWidth: 28, textAlign: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.bgSoft, borderRadius: 14, padding: 4, gap: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segmentText: { color: colors.textDim, fontWeight: '700', fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 100, paddingVertical: 10, paddingHorizontal: 14 },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  chipCount: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
});
