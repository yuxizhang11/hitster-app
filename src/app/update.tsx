import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, H1, P, Screen } from '../components/ui';
import { checkForUpdate, currentVersion, RELEASES_URL, UpdateError, UpdateInfo } from '../update/checkUpdate';
import { downloadAndInstall } from '../update/installUpdate';
import { colors } from '../theme';

/** Zeigt die installierte Version und lädt bei Bedarf die neue APK von GitHub. */
export default function UpdateScreen() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  /** Download-Fortschritt 0..1, null wenn gerade nichts geladen wird. */
  const [progress, setProgress] = useState<number | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

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

  const download = async () => {
    if (!info) return;
    if (!info.apkUrl) {
      Linking.openURL(info.pageUrl).catch(() => {});
      return;
    }
    setInstallError(null);
    setProgress(0);
    try {
      await downloadAndInstall(info.apkUrl, info.latest, setProgress);
    } catch {
      setInstallError('Direkt installieren hat nicht geklappt. Du kannst die APK stattdessen im Browser laden.');
    } finally {
      setProgress(null);
    }
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
                <Button
                  title={progress !== null ? `Lädt… ${Math.round(progress * 100)} %` : `Auf v${info.latest} aktualisieren`}
                  onPress={download}
                  disabled={progress !== null}
                />
                {progress !== null && (
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                )}
                <P style={{ fontSize: 13 }}>
                  Die App lädt das Update und öffnet gleich danach die Installation, dort nur noch auf „Installieren“ tippen.
                  Beim ersten Mal fragt Android einmalig, ob Hitster Apps installieren darf. Einstellungen und Songlisten
                  bleiben erhalten.
                </P>
                {installError && (
                  <>
                    <P style={{ color: colors.yellow }}>{installError}</P>
                    <Button
                      title="Im Browser herunterladen"
                      variant="ghost"
                      onPress={() => Linking.openURL(info.apkUrl ?? info.pageUrl).catch(() => {})}
                    />
                  </>
                )}
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
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.bgSoft, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.green },
});
