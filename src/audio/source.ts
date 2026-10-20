import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * Woher die Musik kommt.
 * auto: Spotify, wenn verbunden und es wirklich spielt, sonst 30-Sekunden-Ausschnitte in der App.
 * preview: immer die Ausschnitte in der App.
 */
export type MusicSource = 'auto' | 'preview';

const KEY = 'music-source-v1';
let current: MusicSource = 'auto';
const listeners = new Set<(s: MusicSource) => void>();

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === 'auto' || v === 'preview') setCurrent(v);
  })
  .catch(() => {});

function setCurrent(s: MusicSource) {
  current = s;
  listeners.forEach((l) => l(s));
}

export function getMusicSource() {
  return current;
}

export function setMusicSource(s: MusicSource) {
  setCurrent(s);
  AsyncStorage.setItem(KEY, s).catch(() => {});
}

export function useMusicSource(): [MusicSource, (s: MusicSource) => void] {
  const [s, setS] = useState(current);
  useEffect(() => {
    setS(current);
    listeners.add(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return [s, setMusicSource];
}
