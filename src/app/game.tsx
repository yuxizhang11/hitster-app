import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Equalizer } from '../components/Equalizer';
import { PlayOrb } from '../components/PlayOrb';
import { ChoiceList, CountdownBar, TimelinePicker, YearPicker } from '../components/Questions';
import { RevealCard } from '../components/RevealCard';
import { Button, Card, H1, P, Screen } from '../components/ui';
import { answer, AnswerMeta, AnswerValue, endTurn, startTurn, turnIsDone } from '../game/engine';
import type { QuestionType } from '../game/modes';
import { useSnippetPlayer } from '../spotify/useSnippetPlayer';
import { useGame } from '../state/GameContext';
import { colors, PLAYER_COLORS } from '../theme';

type Phase = 'handoff' | 'listen' | 'reveal';

const native = Platform.OS !== 'web';

const QUESTION_LABEL: Record<QuestionType, string> = {
  timeline: 'Wo gehört der Song in deinen Zeitstrahl?',
  artist: 'Wer singt das?',
  title: 'Wie heißt der Song?',
  song: 'Welcher Song ist das?',
  year: 'Aus welchem Jahr ist der Song?',
  decade: 'Aus welchem Jahrzehnt?',
};

const INTRO_MS = 650;

export default function GameScreen() {
  const { game, setGame } = useGame();
  const player = useSnippetPlayer();
  const [phase, setPhase] = useState<Phase>('handoff');
  const [hasPlayed, setHasPlayed] = useState(false);
  const [replaysLeft, setReplaysLeft] = useState(0);
  const [pokerStage, setPokerStage] = useState(0);
  const [intro, setIntro] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const questionStart = useRef(0);

  // Musik aus, wenn der Screen verlassen wird.
  const stopRef = useRef(player.stop);
  stopRef.current = player.stop;
  useEffect(() => () => void stopRef.current(), []);

  useEffect(() => {
    if (!game) router.replace('/');
  }, [game]);

  const medianYear = useMemo(() => {
    if (!game) return 2000;
    const years = game.allSongs.map((s) => s.year).sort((a, b) => a - b);
    return years[Math.floor(years.length / 2)] ?? 2000;
  }, [game]);

  if (!game) return null;
  const mode = game.mode;
  const turn = game.turn;
  const current = turn ? game.players[turn.playerIndex] : null;
  const question = turn && !turnIsDone(game) ? turn.questions[turn.questionIndex] : null;
  const pokerStages = mode.pokerStages;

  const nextPlayerIndex = (() => {
    if (!turn) return game.players.findIndex((p) => p.alive);
    for (let step = 1; step <= game.players.length; step++) {
      const i = (turn.playerIndex + step) % game.players.length;
      if (game.players[i].alive) return i;
    }
    return turn.playerIndex;
  })();
  const upNext = game.players[nextPlayerIndex];

  const beginTurn = () => {
    const next = startTurn(game);
    if (next.finished) {
      setGame(next);
      router.replace('/results');
      return;
    }
    setGame(next);
    setHasPlayed(false);
    setReplaysLeft(mode.replays);
    setPokerStage(0);
    setPhase('listen');
  };

  const snippetSeconds = pokerStages ? pokerStages[pokerStage] : mode.snippetSeconds;

  const playCurrent = async (seconds = snippetSeconds) => {
    if (!turn) return;
    setIntro(true);
    await new Promise((r) => setTimeout(r, INTRO_MS));
    setIntro(false);
    const started = player.playSnippet(turn.song, seconds, mode.startAt);
    if (!hasPlayed) {
      setHasPlayed(true);
      questionStart.current = Date.now();
    }
    await started;
  };

  const onOrbPress = () => {
    if (!hasPlayed) {
      playCurrent();
      return;
    }
    if (replaysLeft > 0) {
      setReplaysLeft((n) => n - 1);
      playCurrent();
    }
  };

  const morePoker = () => {
    if (!pokerStages || pokerStage >= pokerStages.length - 1) return;
    const stage = pokerStage + 1;
    setPokerStage(stage);
    playCurrent(pokerStages[stage]);
  };

  const submit = (value: AnswerValue) => {
    const meta: AnswerMeta = {};
    if (mode.timeLimitSeconds) {
      const elapsed = (Date.now() - questionStart.current) / 1000;
      meta.remainingFraction = 1 - elapsed / mode.timeLimitSeconds;
    }
    if (pokerStages) meta.pokerStage = pokerStage;
    const next = answer(game, value, meta);
    setGame(next);
    questionStart.current = Date.now();
    if (turnIsDone(next)) {
      const results = next.turn?.results ?? [];
      const good = results.some((r) => r.correct);
      Haptics.notificationAsync(good ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
      player.stop();
      setPhase('reveal');
    }
  };

  const finishTurn = () => {
    player.stop();
    const next = endTurn(game);
    setGame(next);
    if (next.finished) router.replace('/results');
    else setPhase('handoff');
  };

  const quit = () => {
    player.stop();
    setGame(null);
    router.replace('/');
  };

  const orbState = intro ? 'loading' : player.status === 'loading' ? 'loading' : player.status === 'playing' ? 'playing' : !hasPlayed || replaysLeft > 0 ? 'idle' : 'disabled';

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.modeLabel}>
          {mode.emoji} {mode.name}
        </Text>
        {confirmQuit ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Pressable onPress={quit}>
              <Text style={{ color: colors.red, fontWeight: '800' }}>Spiel beenden</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmQuit(false)}>
              <Text style={{ color: colors.textDim, fontWeight: '700' }}>Weiter</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmQuit(true)} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.textDim} />
          </Pressable>
        )}
      </View>

      <Scoreboard
        players={game.players}
        activeIndex={phase === 'handoff' ? nextPlayerIndex : turn?.playerIndex ?? -1}
        cards={mode.end.kind === 'cards'}
      />

      {phase === 'handoff' && upNext && (
        <Handoff
          name={upNext.name}
          color={PLAYER_COLORS[nextPlayerIndex % PLAYER_COLORS.length]}
          onReady={beginTurn}
          subtitle={
            mode.end.kind === 'cards'
              ? `${upNext.timeline.length} von ${mode.end.target} Karten`
              : mode.end.kind === 'rounds'
                ? `Runde ${upNext.turns + 1} von ${mode.end.rounds}`
                : `${game.players.filter((p) => p.alive).length} noch im Spiel`
          }
        />
      )}

      {phase === 'listen' && turn && current && (
        <View style={{ gap: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.turnOf}>{current.name} ist dran</Text>
            <PlayOrb state={orbState} onPress={onOrbPress} gradient={mode.colors} size={190} />
            <Equalizer active={player.status === 'playing'} colors={mode.colors} />
            <P style={{ marginTop: 8, textAlign: 'center' }}>
              {!hasPlayed
                ? 'Tippe auf die Platte, um den Song zu hören'
                : player.status === 'playing'
                  ? player.demo
                    ? 'Demo-Modus: kein Ton (Spotify nicht verbunden)'
                    : `Läuft… ${snippetSeconds} Sekunden`
                  : pokerStages
                    ? `Du hast ${snippetSeconds} s gehört`
                    : replaysLeft > 0
                      ? `Nochmal hören: noch ${replaysLeft}×`
                      : ' '}
            </P>
          </View>

          {player.error && (
            <Card style={{ borderColor: colors.red, gap: 10 }}>
              <P style={{ color: colors.text }}>{player.error.message}</P>
              {player.error.code === 'NO_DEVICE' && (
                <Button title="Spotify öffnen" variant="ghost" onPress={() => Linking.openURL('spotify:').catch(() => {})} />
              )}
              <Button title="Nochmal versuchen" variant="ghost" onPress={() => playCurrent()} />
            </Card>
          )}

          {hasPlayed && question && (
            <View style={{ gap: 12 }}>
              {turn.questions.length > 1 && (
                <Text style={styles.qCounter}>
                  Frage {turn.questionIndex + 1} von {turn.questions.length}
                </Text>
              )}
              <H1 style={{ fontSize: 24 }}>{QUESTION_LABEL[question.type]}</H1>
              {mode.timeLimitSeconds && (
                <CountdownBar
                  key={turn.song.id}
                  seconds={mode.timeLimitSeconds}
                  running
                  onDone={() => submit({ kind: 'timeout' })}
                />
              )}
              {pokerStages && pokerStage < pokerStages.length - 1 && (
                <Button
                  title={`Mehr hören: ${pokerStages[pokerStage + 1]} s (−1 Punkt)`}
                  variant="ghost"
                  onPress={morePoker}
                  disabled={player.status === 'playing' || intro}
                />
              )}
              {pokerStages && <Text style={styles.pokerPts}>Jetzt richtig = {Math.max(1, 5 - pokerStage)} Punkte</Text>}
              {question.options && (
                <ChoiceList
                  key={`${turn.song.id}-${turn.questionIndex}`}
                  options={question.options}
                  onPick={(v) => submit({ kind: 'choice', value: v })}
                />
              )}
              {question.type === 'year' && (
                <YearPicker key={turn.song.id} initial={medianYear} onSubmit={(y) => submit({ kind: 'year', value: y })} />
              )}
              {question.type === 'timeline' && (
                <TimelinePicker timeline={current.timeline} onPick={(slot) => submit({ kind: 'slot', value: slot })} />
              )}
            </View>
          )}
        </View>
      )}

      {phase === 'reveal' && turn && current && (
        <Reveal
          game={game}
          onNext={finishTurn}
          onListen={() => player.playSnippet(turn.song, 12, mode.startAt)}
          playing={player.status === 'playing'}
        />
      )}
    </Screen>
  );
}

function Scoreboard({
  players,
  activeIndex,
  cards,
}: {
  players: { name: string; score: number; timeline: unknown[]; alive: boolean }[];
  activeIndex: number;
  cards: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
      {players.map((p, i) => (
        <View
          key={i}
          style={[
            styles.scoreChip,
            i === activeIndex && { borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length], backgroundColor: colors.card },
            !p.alive && { opacity: 0.35 },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }]} />
          <Text style={styles.scoreName} numberOfLines={1}>
            {p.alive ? '' : '💀 '}
            {p.name}
          </Text>
          <Text style={styles.scoreValue}>{cards ? `${p.timeline.length} 🃏` : p.score}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Handoff({ name, color, subtitle, onReady }: { name: string; color: string; subtitle: string; onReady: () => void }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 60, useNativeDriver: native }).start();
  }, [name, pop]);
  return (
    <View style={styles.handoff}>
      <Text style={{ fontSize: 56 }}>📱</Text>
      <P>Gib das Handy an</P>
      <Animated.Text style={[styles.handoffName, { color, transform: [{ scale: pop }] }]}>{name}</Animated.Text>
      <P>{subtitle}</P>
      <Button title="Ich bin bereit" onPress={onReady} style={{ alignSelf: 'stretch', marginTop: 24 }} />
    </View>
  );
}

function Reveal({
  game,
  onNext,
  onListen,
  playing,
}: {
  game: NonNullable<ReturnType<typeof useGame>['game']>;
  onNext: () => void;
  onListen: () => void;
  playing: boolean;
}) {
  const turn = game.turn!;
  const player = game.players[turn.playerIndex];
  const points = turn.results.reduce((sum, r) => sum + r.points, 0);
  const allCorrect = turn.results.every((r) => r.correct);
  const anyCorrect = turn.results.some((r) => r.correct);
  const eliminated = !player.alive;
  const headline = eliminated ? 'Raus! 💀' : allCorrect ? 'Richtig! 🎉' : anyCorrect ? 'Teilweise richtig' : 'Leider falsch';

  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    bounce.setValue(0);
    Animated.spring(bounce, { toValue: 1, friction: 4, tension: 80, useNativeDriver: native }).start();
  }, [turn.song.id, bounce]);

  return (
    <View style={{ gap: 18, alignItems: 'center' }}>
      <Animated.Text
        style={[
          styles.headline,
          { color: allCorrect ? colors.green : anyCorrect ? colors.yellow : colors.red, transform: [{ scale: bounce }] },
        ]}
      >
        {headline}
      </Animated.Text>
      {points > 0 && <Text style={styles.points}>+{points} {points === 1 ? 'Punkt' : 'Punkte'}</Text>}
      <RevealCard song={turn.song} gradient={game.mode.colors} />
      <View style={{ alignSelf: 'stretch', gap: 8 }}>
        {turn.results.map((r, i) => (
          <Card key={i} style={styles.resultRow}>
            <Ionicons
              name={r.correct ? 'checkmark-circle' : 'close-circle'}
              size={22}
              color={r.correct ? colors.green : colors.red}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.resultQ}>{QUESTION_LABEL[r.type]}</Text>
              <Text style={styles.resultA}>
                Dein Tipp: {r.given}
                {!r.correct || r.type === 'year' ? ` · Lösung: ${r.solution}` : ''}
              </Text>
            </View>
          </Card>
        ))}
      </View>
      <Button
        title={playing ? 'Läuft…' : 'Song weiterhören'}
        variant="ghost"
        onPress={onListen}
        disabled={playing}
        style={{ alignSelf: 'stretch' }}
        icon={<Ionicons name="musical-notes" size={18} color={colors.textDim} />}
      />
      <Button title="Weiter" onPress={onNext} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeLabel: { color: colors.textDim, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.bgSoft,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  scoreName: { color: colors.text, fontWeight: '700', maxWidth: 110 },
  scoreValue: { color: colors.yellow, fontWeight: '900' },
  turnOf: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: -10 },
  qCounter: { color: colors.cyan, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', fontSize: 12 },
  pokerPts: { color: colors.yellow, fontWeight: '800', textAlign: 'center' },
  handoff: { alignItems: 'center', gap: 8, paddingVertical: 60 },
  handoffName: { fontSize: 48, fontWeight: '900', textAlign: 'center' },
  headline: { fontSize: 34, fontWeight: '900', textAlign: 'center' },
  points: { color: colors.yellow, fontSize: 22, fontWeight: '900', marginTop: -10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  resultQ: { color: colors.textDim, fontSize: 13 },
  resultA: { color: colors.text, fontWeight: '700', fontSize: 15 },
});
