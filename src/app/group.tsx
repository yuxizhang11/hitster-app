import { Ionicons } from '@expo/vector-icons';
import { router, usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Equalizer } from '../components/Equalizer';
import { PlayOrb } from '../components/PlayOrb';
import { RevealCard } from '../components/RevealCard';
import { Button, Card, H1, P, Screen } from '../components/ui';
import { endGroupRound, givePoints, startGroupRound } from '../game/engine';
import { useSnippetPlayer } from '../spotify/useSnippetPlayer';
import { useGame } from '../state/GameContext';
import { colors, PLAYER_COLORS } from '../theme';

type Phase = 'ready' | 'listen' | 'reveal';

const INTRO_MS = 650;

/** Zettel-Runde: Das Handy liegt in der Mitte, alle raten gleichzeitig auf Papier. */
export default function GroupScreen() {
  const { game, setGame } = useGame();
  const player = useSnippetPlayer();
  const [phase, setPhase] = useState<Phase>('ready');
  const [hasPlayed, setHasPlayed] = useState(false);
  const [replaysLeft, setReplaysLeft] = useState(0);
  const [intro, setIntro] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  /** Punkte, die in dieser Runde vergeben wurden, pro Spieler. */
  const [roundPoints, setRoundPoints] = useState<number[]>([]);

  const mounted = useRef(true);
  const stopRef = useRef(player.stop);
  stopRef.current = player.stop;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void stopRef.current();
    };
  }, []);

  // Zurück-Taste (Android) fragt erst nach, statt das Spiel stillschweigend abzubrechen.
  const allowLeave = usePreventRemove(true, () => setConfirmQuit(true));

  useEffect(() => {
    if (!game) {
      allowLeave();
      router.dismissTo('/');
    }
  }, [game, allowLeave]);

  if (!game) return null;
  const mode = game.mode;
  const turn = game.turn;
  const rounds = mode.end.kind === 'rounds' ? mode.end.rounds : 0;
  const roundNo = game.totalTurns + 1;
  const appScoring = game.scoring === 'app';

  const beginRound = () => {
    const next = startGroupRound(game);
    setGame(next);
    if (next.finished) {
      allowLeave();
      router.replace('/results');
      return;
    }
    setHasPlayed(false);
    setReplaysLeft(mode.replays);
    setRoundPoints(game.players.map(() => 0));
    setPhase('listen');
  };

  const play = async (seconds = mode.snippetSeconds) => {
    if (!turn) return;
    setIntro(true);
    await new Promise((r) => setTimeout(r, INTRO_MS));
    if (!mounted.current) return;
    setIntro(false);
    setHasPlayed(true);
    await player.playSnippet(turn.song, seconds, mode.startAt);
  };

  const onOrbPress = () => {
    if (!hasPlayed) play();
    else if (replaysLeft > 0) {
      setReplaysLeft((n) => n - 1);
      play();
    }
  };

  const reveal = () => {
    player.stop();
    setPhase('reveal');
  };

  const changePoints = (i: number, delta: number) => {
    if (roundPoints[i] + delta < 0) return;
    setRoundPoints((pts) => pts.map((p, j) => (j === i ? p + delta : p)));
    setGame(givePoints(game, i, delta));
  };

  const nextRound = () => {
    player.stop();
    const next = endGroupRound(game);
    setGame(next);
    if (next.finished) {
      allowLeave();
      router.replace('/results');
    } else setPhase('ready');
  };

  const quit = () => {
    player.stop();
    allowLeave();
    setGame(null);
  };

  const orbState =
    intro || player.status === 'loading'
      ? 'loading'
      : player.status === 'playing'
        ? 'playing'
        : !hasPlayed || replaysLeft > 0
          ? 'idle'
          : 'disabled';

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.modeLabel}>
          {mode.emoji} Song {Math.min(roundNo, rounds)} von {rounds}
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

      {phase === 'ready' && (
        <View style={styles.center}>
          <Text style={{ fontSize: 56 }}>📝</Text>
          <H1 style={{ textAlign: 'center' }}>{roundNo === 1 ? 'Zettel bereit?' : `Song ${roundNo}`}</H1>
          <P style={{ textAlign: 'center' }}>
            Legt das Handy in die Mitte. Alle schreiben Künstler, Titel und Jahr auf, ohne abzuschreiben.
          </P>
          {appScoring && game.totalTurns > 0 && <Standings game={game} />}
          <Button title="Song starten" onPress={beginRound} style={{ alignSelf: 'stretch', marginTop: 16 }} />
        </View>
      )}

      {phase === 'listen' && turn && (
        <View style={{ gap: 16, alignItems: 'center' }}>
          <PlayOrb state={orbState} onPress={onOrbPress} gradient={mode.colors} size={210} />
          <Equalizer active={player.status === 'playing'} colors={mode.colors} />
          <P style={{ textAlign: 'center' }}>
            {!hasPlayed
              ? 'Tippe auf die Platte, dann läuft der Song für alle'
              : player.status === 'playing'
                ? 'Läuft… jetzt aufschreiben!'
                : replaysLeft > 0
                  ? `Nochmal hören: noch ${replaysLeft}×`
                  : 'Stifte weg, gleich wird aufgelöst'}
          </P>
          {player.fallbackNote && player.status === 'playing' && (
            <Text style={{ color: colors.yellow, fontSize: 13, textAlign: 'center' }}>
              Spotify ging nicht ({player.fallbackNote}), es läuft ein Ausschnitt. Mehr unter Musik › Wiedergabe testen.
            </Text>
          )}
          {player.error && (
            <Card style={{ borderColor: colors.red, gap: 10, alignSelf: 'stretch' }}>
              <P style={{ color: colors.text }}>{player.error.message}</P>
              <Button title="Nochmal versuchen" variant="ghost" onPress={() => play()} />
            </Card>
          )}
          {hasPlayed && <Button title="Auflösen" onPress={reveal} style={{ alignSelf: 'stretch' }} />}
        </View>
      )}

      {phase === 'reveal' && turn && (
        <View style={{ gap: 16, alignItems: 'center' }}>
          <RevealCard song={turn.song} gradient={mode.colors} />
          {appScoring ? (
            <View style={{ alignSelf: 'stretch', gap: 8 }}>
              <P style={{ textAlign: 'center' }}>Wer hat was richtig? Tippe Punkte an.</P>
              {game.players.map((p, i) => (
                <Card key={p.id} style={styles.pointRow}>
                  <View style={[styles.dot, { backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] }]} />
                  <Text style={styles.name} numberOfLines={1}>
                    {p.name}
                    {roundPoints[i] ? <Text style={styles.delta}>{`  +${roundPoints[i]}`}</Text> : null}
                  </Text>
                  <Pressable
                    onPress={() => changePoints(i, -1)}
                    disabled={!roundPoints[i]}
                    hitSlop={6}
                    accessibilityLabel={`Punkt abziehen: ${p.name}`}
                    style={[styles.stepBtn, !roundPoints[i] && { opacity: 0.3 }]}
                  >
                    <Ionicons name="remove" size={22} color={colors.text} />
                  </Pressable>
                  <Text style={styles.total}>{p.score}</Text>
                  <Pressable
                    onPress={() => changePoints(i, 1)}
                    hitSlop={6}
                    accessibilityLabel={`Punkt für ${p.name}`}
                    style={[styles.stepBtn, styles.plus]}
                  >
                    <Ionicons name="add" size={22} color={colors.bg} />
                  </Pressable>
                </Card>
              ))}
            </View>
          ) : (
            <P style={{ textAlign: 'center' }}>Kontrolliert eure Zettel und schreibt die Punkte selbst auf.</P>
          )}
          <Button
            title={player.status === 'playing' ? 'Läuft…' : 'Song weiterhören'}
            variant="ghost"
            onPress={() => player.playSnippet(turn.song, 15, mode.startAt)}
            disabled={player.status === 'playing'}
            style={{ alignSelf: 'stretch' }}
            icon={<Ionicons name="musical-notes" size={18} color={colors.textDim} />}
          />
          <Button
            title={roundNo >= rounds ? 'Zum Ergebnis' : 'Nächster Song'}
            onPress={nextRound}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      )}
    </Screen>
  );
}

function Standings({ game }: { game: NonNullable<ReturnType<typeof useGame>['game']> }) {
  const sorted = game.players
    .map((p, i) => ({ p, color: PLAYER_COLORS[i % PLAYER_COLORS.length] }))
    .sort((a, b) => b.p.score - a.p.score);
  return (
    <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 8 }}>
      {sorted.map(({ p, color }) => (
        <View key={p.id} style={styles.standRow}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.name} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={styles.total}>{p.score}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeLabel: { color: colors.textDim, fontWeight: '800', fontSize: 15 },
  center: { alignItems: 'center', gap: 10, paddingTop: 24 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  standRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { color: colors.text, fontSize: 17, fontWeight: '800', flex: 1, minWidth: 0 },
  total: { color: colors.yellow, fontSize: 18, fontWeight: '900', minWidth: 28, textAlign: 'center' },
  delta: { color: colors.green, fontSize: 15, fontWeight: '900' },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBorder,
  },
  plus: { backgroundColor: colors.green },
});
