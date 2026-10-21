import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, H1, P, Screen } from '../components/ui';
import { decadeOf, dedupeSongs, pickSongs, Scoring } from '../game/engine';
import { getMode, ModeId, MODES } from '../game/modes';
import { useGame } from '../state/GameContext';
import { colors, gradients, PLAYER_COLORS } from '../theme';

const MAX_PLAYERS = 8;

export default function SetupScreen() {
  const { setup, loaded, startGame, categories } = useGame();
  const [players, setPlayers] = useState(setup.players);
  const [modeId, setModeId] = useState<ModeId>(setup.modeId);
  const [categoryIds, setCategoryIds] = useState(setup.categoryIds);
  const [decades, setDecades] = useState<number[]>(setup.decades ?? []);
  const [target, setTarget] = useState<number | undefined>(setup.target);
  const [scoring, setScoring] = useState<Scoring>(setup.scoring ?? 'app');

  // Gespeichertes Setup kann nach dem ersten Rendern geladen werden: einmal übernehmen, danach nicht mehr überschreiben.
  useEffect(() => {
    if (!loaded) return;
    setPlayers(setup.players);
    setModeId(setup.modeId);
    setCategoryIds(setup.categoryIds);
    setDecades(setup.decades ?? []);
    setTarget(setup.target);
    setScoring(setup.scoring ?? 'app');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const mode = getMode(modeId);
  const defaultTarget = mode.end.kind === 'cards' ? mode.end.target : mode.end.kind === 'rounds' ? mode.end.rounds : undefined;
  const effectiveTarget = target ?? defaultTarget;
  const selectedSongs = dedupeSongs(categories.filter((c) => categoryIds.includes(c.id)).flatMap((c) => c.songs));
  // Nur Jahrzehnte anbieten, aus denen die gewählten Kategorien Songs haben.
  const availableDecades = [...new Set(selectedSongs.map((s) => decadeOf(s.year)))].sort((x, y) => x - y);
  const activeDecades = decades.filter((d) => availableDecades.includes(d));
  const songCount = pickSongs(categories, categoryIds, activeDecades).length;
  const partyMix = categories.length > 0 && categories.every((c) => categoryIds.includes(c.id));
  const names = players.map((p) => p.trim()).filter(Boolean);
  const needed = mode.group
    ? Math.max(8, effectiveTarget ?? 10)
    : Math.max(8, names.length * (effectiveTarget ?? 3) + names.length);
  const canStart = names.length > 0 && categoryIds.length > 0 && songCount >= 8;

  const toggleCategory = (id: string) => setCategoryIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const toggleDecade = (d: number) => setDecades((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]));

  const start = () => {
    startGame({
      players: names,
      modeId,
      categoryIds,
      decades: activeDecades.length ? activeDecades : undefined,
      target: target === defaultTarget ? undefined : target,
      scoring,
    });
    router.replace(mode.group ? '/group' : '/game');
  };

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <H1 style={{ flex: 1 }}>Neues Spiel</H1>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Spieler</Text>
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
        <Text style={styles.section}>Spielmodus</Text>
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
                    style={[
                      styles.modeCard,
                      !selected && {
                        borderColor: colors.cardBorder,
                        borderWidth: 1,
                      },
                    ]}
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
              {mode.emoji} {mode.name}: <Text style={styles.tagline}>{mode.tagline}</Text>
            </Text>
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
        <Text style={styles.section}>Musik</Text>
        <>
          <Pressable onPress={() => setCategoryIds(partyMix ? [] : categories.map((c) => c.id))}>
            <LinearGradient
              colors={partyMix ? gradients.main : [colors.card, colors.card]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.party, !partyMix && { borderColor: colors.cardBorder, borderWidth: 1 }]}
            >
              <Text style={styles.partyTitle}>🎲 Alle Kategorien</Text>
              <Text style={[styles.chipCount, partyMix && { color: '#fff' }]}>
                {partyMix ? 'Alles gemischt' : 'Antippen zum Mischen'}
              </Text>
            </LinearGradient>
          </Pressable>
          <View style={styles.chips}>
            {categories.map((c) => {
              const selected = categoryIds.includes(c.id);
              return (
                <Pressable key={c.id} onPress={() => toggleCategory(c.id)}>
                  <LinearGradient
                    colors={selected ? c.colors : [colors.card, colors.card]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.chip,
                      !selected && {
                        borderColor: colors.cardBorder,
                        borderWidth: 1,
                      },
                    ]}
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
              <View
                style={[
                  styles.chip,
                  {
                    borderColor: colors.cyan,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.cyan }]}>＋ Eigene Playlist</Text>
              </View>
            </Pressable>
          </View>
          {availableDecades.length > 1 && (
            <>
              <Text style={styles.subLabel}>Jahrzehnte {activeDecades.length === 0 && '· alle'}</Text>
              <View style={styles.chips}>
                {availableDecades.map((d) => {
                  const selected = activeDecades.includes(d);
                  return (
                    <Pressable
                      key={d}
                      onPress={() => toggleDecade(d)}
                      style={[styles.decade, selected && { backgroundColor: colors.pink, borderColor: colors.pink }]}
                    >
                      <Text style={[styles.decadeText, selected && { color: '#fff' }]}>{String(d).slice(2)}er</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          <Pressable onPress={() => router.push('/songs')} hitSlop={6}>
            <Text style={{ color: colors.cyan, fontWeight: '700' }}>Songlisten ansehen und bearbeiten ›</Text>
          </Pressable>
          <P
            style={{
              color: songCount < needed ? colors.yellow : colors.textMuted,
            }}
          >
            {songCount} Songs ausgewählt
            {songCount < 8
              ? ' · wähle mindestens 8 Songs'
              : songCount < needed
                ? ' · könnte knapp werden, das Spiel endet wenn die Songs ausgehen'
                : ''}
          </P>
        </>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Los geht's!" onPress={start} disabled={!canStart} gradient={mode.colors} />
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  modeCell: { width: '50%', padding: 4 },
  modeCard: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeEmoji: { fontSize: 22 },
  modeName: { color: colors.text, fontWeight: '800', fontSize: 15, flex: 1 },
  rulesTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 2,
  },
  section: {
    color: colors.textDim,
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  tagline: { color: colors.textDim, fontWeight: '600' },
  footer: { paddingTop: 8 },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  targetLabel: { color: colors.text, fontWeight: '700', fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    minWidth: 28,
    textAlign: 'center',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentText: { color: colors.textDim, fontWeight: '700', fontSize: 14 },
  party: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partyTitle: { color: colors.text, fontWeight: '900', fontSize: 16 },
  subLabel: { color: colors.textDim, fontWeight: '700', fontSize: 13 },
  decade: {
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  decadeText: { color: colors.textDim, fontWeight: '800', fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  chipCount: { color: colors.textMuted, fontWeight: '700', fontSize: 12 },
});
