import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import type { Song } from '../data/types';
import { pickBest, PreviewCandidate } from './match';

/** Länge der Vorschau-Clips von iTunes und Deezer. */
export const PREVIEW_SECONDS = 30;

const CACHE_KEY = 'preview-cache-v1';
/** Deezer-Links laufen nach einiger Zeit ab, iTunes-Links nicht. */
const DEEZER_TTL_MS = 60 * 60 * 1000;

type CacheEntry = { url: string | null; at: number; source: 'itunes' | 'deezer' | 'none' };
let cache: Record<string, CacheEntry> | null = null;

async function loadCache() {
  if (!cache) {
    try {
      cache = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) ?? '{}');
    } catch {
      cache = {};
    }
  }
  return cache!;
}

function saveCache() {
  if (cache) AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache)).catch(() => {});
}

async function getJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function searchItunes(song: Song): Promise<string | null> {
  const term = encodeURIComponent(`${song.artist} ${song.title}`);
  const data = await getJson(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=15&country=DE`);
  const list: PreviewCandidate[] = (data?.results ?? []).map((r: any) => ({
    title: String(r.trackName ?? ''),
    artist: String(r.artistName ?? ''),
    url: String(r.previewUrl ?? ''),
  }));
  return pickBest(list, song.title, song.artist)?.url ?? null;
}

async function searchDeezer(song: Song): Promise<string | null> {
  const q = encodeURIComponent(`artist:"${song.artist}" track:"${song.title}"`);
  let data = await getJson(`https://api.deezer.com/search?q=${q}&limit=15`);
  if (!data?.data?.length) data = await getJson(`https://api.deezer.com/search?q=${encodeURIComponent(`${song.artist} ${song.title}`)}&limit=15`);
  const list: PreviewCandidate[] = (data?.data ?? []).map((r: any) => ({
    title: String(r.title ?? ''),
    artist: String(r.artist?.name ?? ''),
    url: String(r.preview ?? ''),
  }));
  return pickBest(list, song.title, song.artist)?.url ?? null;
}

export class PreviewError extends Error {}

/** Sucht einen 30-Sekunden-Ausschnitt des Songs, erst bei iTunes, dann bei Deezer. */
export async function findPreview(song: Song): Promise<string> {
  const c = await loadCache();
  const key = `${song.artist}|${song.title}`.toLowerCase();
  const hit = c[key];
  if (hit && (hit.source === 'itunes' || Date.now() - hit.at < DEEZER_TTL_MS)) {
    if (hit.url) return hit.url;
  }
  let entry: CacheEntry = { url: null, at: Date.now(), source: 'none' };
  let failed = 0;
  for (const [source, search] of [
    ['itunes', searchItunes],
    ['deezer', searchDeezer],
  ] as const) {
    try {
      const url = await search(song);
      if (url) {
        entry = { url, at: Date.now(), source };
        break;
      }
    } catch {
      failed++;
    }
  }
  if (!entry.url) {
    if (failed === 2) throw new PreviewError('Keine Internetverbindung zum Musikdienst. Bist du online?');
    throw new PreviewError(`Für „${song.title}“ gibt es leider keinen Ausschnitt. Überspring den Song einfach.`);
  }
  c[key] = entry;
  saveCache();
  return entry.url;
}

let player: AudioPlayer | null = null;
let modeSet = false;

function getPlayer() {
  if (!modeSet) {
    modeSet = true;
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix', shouldPlayInBackground: false }).catch(() => {});
  }
  player ??= createAudioPlayer(null);
  return player;
}

/** Lädt den Ausschnitt, springt an `startSeconds` und startet ihn. Wartet, bis wirklich Ton kommt. */
export async function playPreview(url: string, startSeconds: number): Promise<void> {
  const p = getPlayer();
  p.pause();
  p.replace({ uri: url });
  const deadline = Date.now() + 10000;
  while (!p.isLoaded) {
    if (Date.now() > deadline) throw new PreviewError('Der Ausschnitt lädt nicht. Ist die Internetverbindung langsam?');
    await new Promise((r) => setTimeout(r, 100));
  }
  if (startSeconds > 0) await p.seekTo(startSeconds);
  p.play();
  // Manche Player ignorieren das Springen vor dem Start, dann nochmal.
  if (startSeconds > 0 && p.currentTime < startSeconds - 1) await p.seekTo(startSeconds);
}

export function stopPreview() {
  player?.pause();
}
