import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useMusicSource } from '../audio/source';
import { Button, Card, H1, H2, P, Screen } from '../components/ui';
import { diagnosePlayback, DiagnoseStep, loadPlaylist, parsePlaylistId } from '../spotify/api';
import { useSpotify } from '../spotify/SpotifyContext';
import { useGame } from '../state/GameContext';
import { colors } from '../theme';

export default function SettingsScreen() {
  const spotify = useSpotify();
  const { categories, addCustomCategory, removeCustomCategory } = useGame();
  const [clientId, setClientId] = useState(spotify.clientId);
  const [playlist, setPlaylist] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testSteps, setTestSteps] = useState<DiagnoseStep[] | null>(null);
  const [musicSource, setMusicSource] = useMusicSource();

  const runTest = async () => {
    setTesting(true);
    setTestSteps(null);
    try {
      setTestSteps(await diagnosePlayback(spotify.getToken));
    } finally {
      setTesting(false);
    }
  };
  const custom = categories.filter((c) => c.id.startsWith('playlist:'));

  const importPlaylist = async () => {
    const id = parsePlaylistId(playlist);
    if (!id) {
      setImportMsg('Das sieht nicht nach einem Playlist-Link aus.');
      return;
    }
    setImporting(true);
    setImportMsg(null);
    try {
      const { name, songs } = await loadPlaylist(spotify.getToken, id);
      if (songs.length < 4) throw new Error('Die Playlist hat zu wenige Songs.');
      addCustomCategory({ id: `playlist:${id}`, name, emoji: '📀', colors: ['#1DB954', '#0B7A3E'], songs });
      setImportMsg(`„${name}“ mit ${songs.length} Songs hinzugefügt.`);
      setPlaylist('');
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <H1>Musik</H1>
      </View>

      <Card style={{ gap: 10 }}>
        <Text style={styles.label}>Musikquelle</Text>
        <View style={styles.segment}>
          {(
            [
              ['auto', 'Spotify, sonst Ausschnitt'],
              ['preview', 'Nur Ausschnitte'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setMusicSource(value)}
              style={[styles.segmentItem, musicSource === value && { backgroundColor: colors.pink }]}
            >
              <Text style={[styles.segmentText, musicSource === value && { color: '#fff' }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <P style={{ fontSize: 13 }}>
          {musicSource === 'auto'
            ? 'Mit Spotify-Verbindung spielt die Spotify-App den Song. Startet Spotify nicht, spielt die App automatisch einen 30-Sekunden-Ausschnitt.'
            : 'Die App spielt immer einen 30-Sekunden-Ausschnitt (iTunes/Deezer). Ganz ohne Spotify, nur Internet ist nötig.'}
        </P>
      </Card>

      <H2>Spotify (optional)</H2>

      <Card style={{ gap: 12 }}>
        {spotify.connected ? (
          <>
            <View style={styles.status}>
              <Ionicons name="checkmark-circle" size={26} color={colors.green} />
              <Text style={styles.statusText}>Verbunden als {spotify.user?.display_name ?? '…'}</Text>
            </View>
            {spotify.user?.product && spotify.user.product !== 'premium' && (
              <P style={{ color: colors.yellow }}>
                Dein Konto ist nicht Premium. Spotify erlaubt das Abspielen über Apps nur mit Premium.
              </P>
            )}
            <Button
              title={testing ? 'Teste…' : 'Wiedergabe testen'}
              variant="ghost"
              onPress={runTest}
              disabled={testing}
              icon={testing ? <ActivityIndicator color={colors.textDim} /> : <Ionicons name="volume-high" size={18} color={colors.textDim} />}
            />
            {testSteps?.map((step, i) => (
              <View key={i} style={styles.status}>
                <Ionicons name={step.ok ? 'checkmark-circle' : 'alert-circle'} size={20} color={step.ok ? colors.green : colors.yellow} />
                <P style={{ flex: 1, color: colors.text }}>{step.text}</P>
              </View>
            ))}
            <Button title="Trennen" variant="ghost" onPress={spotify.logout} />
          </>
        ) : (
          <>
            <P>
              Ohne Spotify spielt die App 30-Sekunden-Ausschnitte. Mit Spotify Premium und einer eigenen Client-ID aus
              dem Spotify Developer Dashboard (Anleitung unten) läuft der ganze Song über die Spotify-App.
            </P>
            <Text style={styles.label}>Client-ID</Text>
            <TextInput
              value={clientId}
              onChangeText={(t) => {
                setClientId(t);
                spotify.setClientId(t);
              }}
              placeholder="z. B. 1a2b3c4d5e…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Button
              title={spotify.busy ? 'Verbinde…' : 'Mit Spotify verbinden'}
              gradient={['#1DB954', '#0B7A3E']}
              disabled={!clientId.trim() || !spotify.ready || spotify.busy}
              onPress={spotify.login}
            />
          </>
        )}
        {spotify.error && <P style={{ color: colors.red }}>{spotify.error}</P>}
      </Card>

      <H2>Eigene Playlist als Kategorie</H2>
      <Card style={{ gap: 10 }}>
        <P>
          Füge den Link einer Spotify-Playlist ein, die dir gehört. Das Jahr kommt vom Album, bei Best-of-Alben kann es
          also abweichen.
        </P>
        <TextInput
          value={playlist}
          onChangeText={setPlaylist}
          placeholder="https://open.spotify.com/playlist/…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Button
          title="Playlist importieren"
          variant="ghost"
          onPress={importPlaylist}
          disabled={!spotify.connected || importing || !playlist.trim()}
          icon={importing ? <ActivityIndicator color={colors.textDim} /> : undefined}
        />
        {!spotify.connected && <P style={{ color: colors.textMuted }}>Dafür zuerst mit Spotify verbinden.</P>}
        {importMsg && <P style={{ color: colors.text }}>{importMsg}</P>}
        {custom.map((c) => (
          <View key={c.id} style={styles.customRow}>
            <Text style={styles.customName}>
              {c.emoji} {c.name} · {c.songs.length}
            </Text>
            <Pressable onPress={() => removeCustomCategory(c.id)} hitSlop={10}>
              <Ionicons name="trash" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </Card>

      <H2>Einrichtung (einmalig)</H2>
      <Card style={{ gap: 8 }}>
        <P>1. Auf developer.spotify.com/dashboard einloggen und „Create app“ wählen.</P>
        <P>2. Bei „Which API/SDKs are you planning to use?“ die Web API ankreuzen.</P>
        <P>3. Diese Redirect-URI eintragen (genau so):</P>
        <Text selectable style={styles.code}>
          {spotify.redirectUri}
        </Text>
        <P>4. Unter „User Management“ die Spotify-E-Mail aller Mitspieler eintragen, die sich einloggen sollen.</P>
        <P>5. Die Client-ID oben einfügen und verbinden.</P>
        <P style={{ color: colors.textMuted }}>
          Vor dem Spielen kurz die Spotify-App öffnen, damit das Handy als Abspielgerät erkannt wird.
        </P>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: colors.bgSoft, borderRadius: 14, padding: 4, gap: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center' },
  segmentText: { color: colors.textDim, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { color: colors.text, fontWeight: '800', fontSize: 17 },
  label: { color: colors.text, fontWeight: '700' },
  input: {
    color: colors.text,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.bgSoft,
    borderRadius: 12,
  },
  code: {
    color: colors.cyan,
    fontFamily: 'Courier',
    fontSize: 14,
    backgroundColor: colors.bgSoft,
    padding: 10,
    borderRadius: 10,
  },
  customRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customName: { color: colors.text, fontWeight: '700' },
});
