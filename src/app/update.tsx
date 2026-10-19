import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, H1, P, Screen } from '../components/ui';
import { checkForUpdate, currentVersion, RELEASES_URL, UpdateError, UpdateInfo } from '../update/checkUpdate';
import { colors } from '../theme';

/** Zeigt die installierte Version und lädt bei Bedarf die neue APK von GitHub. */
export default function UpdateScreen() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      setInfo(await checkForUpdate());
    } catch (e) {
      setError(e instanceof UpdateError ? e.message : 'Prüfen hat nicht geklappt.');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  const download = () => {
    if (!info) return;
    Linking.openURL(info.apkUrl ?? info.pageUrl).catch(() => {});
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <H1>Updates</H1>
      </View>

      <Card style={{ gap: 6 }}>
        <Text style={styles.label}>Installierte Version</Text>
        <Text style={styles.version}>v{currentVersion()}</Text>
      </Card>

      <Card style={{ gap: 12 }}>
        {checking ? (
          <View style={styles.row}>
            <ActivityIndicator color={colors.cyan} />
            <Text style={styles.status}>Suche nach Updates…</Text>
          </View>
        ) : error ? (
          <>
            <View style={styles.row}>
              <Ionicons name="cloud-offline" size={24} color={colors.yellow} />
              <Text style={[styles.status, { flex: 1 }]}>{error}</Text>
            </View>
            <Button title="Release-Seite öffnen" variant="ghost" onPress={() => Linking.openURL(RELEASES_URL).catch(() => {})} />
          </>
        ) : info?.available ? (
          <>
            <View style={styles.row}>
              <Ionicons name="sparkles" size={24} color={colors.green} />
              <Text style={[styles.status, { flex: 1 }]}>Neue Version v{info.latest} ist da!</Text>
            </View>
            {!!info.notes && (
              <Text style={styles.notes} numberOfLines={8}>
                {info.notes}
              </Text>
            )}
            {Platform.OS === 'android' ? (
              <>
                <Button title={`v${info.latest} herunterladen`} onPress={download} />
                <P style={{ fontSize: 13 }}>
                  Nach dem Download die Datei öffnen und installieren. Deine Einstellungen und Songlisten bleiben erhalten.
                  Beim ersten Mal fragt Android, ob der Browser Apps installieren darf.
                </P>
              </>
            ) : (
              <Button title="Release-Seite öffnen" variant="ghost" onPress={() => Linking.openURL(info.pageUrl).catch(() => {})} />
            )}
          </>
        ) : info ? (
          <View style={styles.row}>
            <Ionicons name="checkmark-circle" size={24} color={colors.green} />
            <Text style={[styles.status, { flex: 1 }]}>Du hast die neueste Version.</Text>
          </View>
        ) : null}
        {!checking && <Button title="Nochmal prüfen" variant="ghost" onPress={check} />}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: colors.textDim, fontWeight: '700' },
  version: { color: colors.text, fontSize: 28, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { color: colors.text, fontWeight: '800', fontSize: 16 },
  notes: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
});
