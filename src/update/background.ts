import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Linking, Platform } from 'react-native';

import { checkForUpdate } from './checkUpdate';

const TASK = 'hitster-update-check';
const CHANNEL = 'updates';
const NOTIFIED_KEY = 'update-notified-version';
/** Etwa alle 3 Stunden: oft genug für neue Versionen, schont aber Akku und Daten. */
const EVERY_MINUTES = 180;

/** Meldet eine neue Version per Benachrichtigung, pro Version nur einmal. */
export async function notifyIfNewVersion(): Promise<boolean> {
  const info = await checkForUpdate();
  if (!info.available) return false;
  if ((await AsyncStorage.getItem(NOTIFIED_KEY)) === info.latest) return false;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return false;
  const first = info.notes.split('\n').find((l) => l.startsWith('- '))?.slice(2);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Hitster ${info.latest} ist da`,
      body: first ?? 'Tippen, um das Update zu installieren.',
      data: { url: '/update' },
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
  await AsyncStorage.setItem(NOTIFIED_KEY, info.latest);
  return true;
}

/** Merkt sich, dass zu dieser Version schon das Popup kam, damit keine Benachrichtigung mehr folgt. */
export function markNotified(version: string) {
  AsyncStorage.setItem(NOTIFIED_KEY, version).catch(() => {});
}

// Muss beim Laden der App definiert sein, damit Android die Aufgabe auch ohne geöffnete App starten kann.
if (Platform.OS === 'android') {
  TaskManager.defineTask(TASK, async () => {
    try {
      await notifyIfNewVersion();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Richtet Kanal und Hintergrundprüfung ein; fragt beim ersten Mal nach der Benachrichtigungs-Erlaubnis. */
export async function setupBackgroundUpdates() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Updates',
    description: 'Wenn es eine neue Version von Hitster gibt',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) await Notifications.requestPermissionsAsync();
  if (!(await TaskManager.isTaskRegisteredAsync(TASK))) {
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: EVERY_MINUTES });
  }
}

export async function notificationsAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return (await Notifications.getPermissionsAsync()).granted;
}

export function openNotificationSettings() {
  Linking.openSettings().catch(() => {});
}
