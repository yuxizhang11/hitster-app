import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/ui';
import { colors } from '../theme';
import { markNotified, setupBackgroundUpdates } from './background';
import { checkForUpdate, currentVersion } from './checkUpdate';
import { notesFor } from './releaseNotes';

const SEEN_KEY = 'update-seen-version';
const POPUP_KEY = 'update-popup-version';

type Popup = { kind: 'new'; version: string; items: string[] } | { kind: 'whatsnew'; version: string; items: string[] };

/** Punkte („- …“) aus dem Release-Text von GitHub. */
function itemsFromBody(body: string): string[] {
  return body
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).trim());
}

/**
 * Popups rund um Updates: einmal pro neuer Version „Neue Version da“ mit den Neuerungen,
 * und nach einem Update einmal „Neu in dieser Version“. Richtet außerdem die Hintergrundprüfung ein
 * und öffnet „Updates“, wenn jemand auf die Benachrichtigung tippt.
 */
export function UpdatePopup() {
  const [popup, setPopup] = useState<Popup | null>(null);

  // Tippen auf die Update-Benachrichtigung öffnet „Updates“, auch wenn die App dadurch erst startet.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as '/update');
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    setupBackgroundUpdates().catch(() => {});
    (async () => {
      const current = currentVersion();
      const seen = await AsyncStorage.getItem(SEEN_KEY);
      await AsyncStorage.setItem(SEEN_KEY, current);
      // Nach einem Update zuerst zeigen, was neu ist. Beim allerersten Start nicht.
      const notes = notesFor(current);
      if (seen && seen !== current && notes?.items.length) {
        setPopup({ kind: 'whatsnew', version: current, items: notes.items });
        return;
      }
      const info = await checkForUpdate();
      if (!info.available || (await AsyncStorage.getItem(POPUP_KEY)) === info.latest) return;
      await AsyncStorage.setItem(POPUP_KEY, info.latest);
      markNotified(info.latest);
      setPopup({ kind: 'new', version: info.latest, items: itemsFromBody(info.notes) });
    })().catch(() => {});
  }, []);

  if (!popup) return null;
  const close = () => setPopup(null);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>
            {popup.kind === 'new' ? `Version ${popup.version} ist da` : `Neu in Version ${popup.version}`}
          </Text>
          {popup.items.length > 0 && (
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 6 }}>
              {popup.items.map((item) => (
                <Text key={item} style={styles.item}>
                  • {item}
                </Text>
              ))}
            </ScrollView>
          )}
          {popup.kind === 'new' ? (
            <>
              <Button
                title="Jetzt aktualisieren"
                onPress={() => {
                  close();
                  router.push({ pathname: '/update', params: { install: '1' } });
                }}
              />
              <Button title="Später" variant="ghost" onPress={close} />
            </>
          ) : (
            <Button title="Los geht's" onPress={close} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: colors.card, borderRadius: 24, padding: 22, gap: 14, borderWidth: 1, borderColor: colors.cardBorder },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  item: { color: colors.textDim, fontSize: 15, lineHeight: 21 },
});
