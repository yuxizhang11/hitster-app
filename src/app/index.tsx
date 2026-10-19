import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Equalizer } from '../components/Equalizer';
import { Button, Card, P, Screen } from '../components/ui';
import { useSpotify } from '../spotify/SpotifyContext';
import { checkForUpdate, currentVersion } from '../update/checkUpdate';
import { colors, gradients } from '../theme';

const native = Platform.OS !== 'web';

export default function Home() {
  const { connected, user } = useSpotify();
  const float = useRef(new Animated.Value(0)).current;
  // Animationen nur laufen lassen, wenn der Startbildschirm sichtbar ist.
  const focused = useIsFocused();
  const [newVersion, setNewVersion] = useState<string | null>(null);

  // Beim Start still nach einer neuen Version auf GitHub schauen.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    checkForUpdate()
      .then((info) => info.available && setNewVersion(info.latest))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!focused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float, focused]);

  return (
    <Screen>
      <View style={styles.hero}>
        <Animated.View
          style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }}
        >
          <Text style={styles.logo}>HITSTER</Text>
          <Text style={styles.logoSub}>Das Musik-Ratespiel</Text>
        </Animated.View>
        <Equalizer active={focused} colors={gradients.main} bars={13} />
      </View>

      {newVersion && (
        <Pressable onPress={() => router.push('/update')}>
          <Card style={[styles.spotify, { borderColor: colors.green }]}>
            <Ionicons name="sparkles" size={26} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.spotifyTitle}>Update verfügbar: v{newVersion}</Text>
              <P>Tippen zum Herunterladen</P>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </Pressable>
      )}

      <Button title="Neues Spiel" onPress={() => router.push('/setup')} icon={<Ionicons name="play" size={20} color="#fff" />} />

      <Pressable onPress={() => router.push('/settings')}>
        <Card style={styles.spotify}>
          <Ionicons name={connected ? 'checkmark-circle' : 'musical-notes'} size={28} color={connected ? colors.green : colors.pink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.spotifyTitle}>{connected ? 'Spotify verbunden' : 'Spotify verbinden'}</Text>
            <P>
              {connected
                ? `Angemeldet als ${user?.display_name ?? '…'}`
                : 'Für echte Musik brauchst du Spotify Premium. Ohne Verbindung läuft ein stummer Demo-Modus.'}
            </P>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/songs')}>
        <Card style={styles.spotify}>
          <Ionicons name="list" size={28} color={colors.cyan} />
          <View style={{ flex: 1 }}>
            <Text style={styles.spotifyTitle}>Songlisten</Text>
            <P>Songs pro Kategorie ansehen, ausblenden oder eigene hinzufügen.</P>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Card>
      </Pressable>

      <P style={{ textAlign: 'center', color: colors.textMuted }}>Ein Handy, das herumgereicht wird · 1 bis 8 Spieler</P>
      <Pressable onPress={() => router.push('/update')} hitSlop={8} style={{ alignSelf: 'center' }}>
        <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Version v{currentVersion()} · Nach Updates suchen</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 24, paddingVertical: 48 },
  logo: {
    color: colors.text,
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: colors.pink,
    textShadowRadius: 24,
  },
  logoSub: { color: colors.cyan, fontSize: 16, fontWeight: '700', textAlign: 'center', letterSpacing: 2 },
  spotify: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  spotifyTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 2 },
});
