import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, H1, H2, P, Screen } from '../components/ui';
import { loadPlaylist, parsePlaylistId } from '../spotify/api';
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
        <H1>Spotify</H1>
      </View>

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
            <Button title="Trennen" variant="ghost" onPress={spotify.logout} />
          </>
        ) : (
          <>
            <P>
              Die Musik läuft über die Spotify-App auf diesem Handy. Du brauchst Spotify Premium und eine eigene
              Client-ID aus dem Spotify Developer Dashboard (Anleitung unten).
            </P>
            <Text style={styles.label}>Client-ID</Text>
            <TextInput
              value={clientId}
              onChangeText={setClientId}
              onBlur={() => spotify.setClientId(clientId)}
              placeholder="z. B. 1a2b3c4d5e…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Button
              title={spotify.busy ? 'Verbinde…' : 'Mit Spotify verbinden'}
              gradient={['#1DB954', '#0B7A3E']}
              disabled={!clientId.trim() || spotify.busy}
              onPress={() => {
                spotify.setClientId(clientId);
                spotify.login();
              }}
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
