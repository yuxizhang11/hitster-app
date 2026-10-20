import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoDevice from 'expo-device';

import type { Song } from '../data/types';

const API = 'https://api.spotify.com/v1';
// v2: Suche jetzt mit market=from_token, alte Treffer waren evtl. im eigenen Land nicht abspielbar.
const URI_CACHE_KEY = 'spotify-uri-cache-v2';

export type GetToken = () => Promise<string>;

export class SpotifyError extends Error {
  constructor(
    message: string,
    public code: 'NO_DEVICE' | 'NOT_PLAYING' | 'PREMIUM_REQUIRED' | 'NOT_FOUND' | 'AUTH' | 'OTHER',
  ) {
    super(message);
  }
}

async function call<T>(getToken: GetToken, path: string, init: RequestInit = {}): Promise<T | null> {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 204 || res.status === 202) return null;
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const reason: string | undefined = body?.error?.reason;
    const message: string = body?.error?.message ?? `Spotify-Fehler ${res.status}`;
    if (res.status === 401) throw new SpotifyError('Spotify-Login abgelaufen. Bitte neu verbinden.', 'AUTH');
    if (reason === 'PREMIUM_REQUIRED' || (res.status === 403 && /premium/i.test(message)))
      throw new SpotifyError('Für die Wiedergabe brauchst du Spotify Premium.', 'PREMIUM_REQUIRED');
    if (reason === 'NO_ACTIVE_DEVICE' || (res.status === 404 && /device/i.test(message)))
      throw new SpotifyError('Kein aktives Spotify-Gerät gefunden.', 'NO_DEVICE');
    // 502/503 beim Abspielen heißt: Das Gerät ist nicht erreichbar (z. B. ein ausgeschalteter Rechner).
    if (res.status >= 500 && path.startsWith('/me/player'))
      throw new SpotifyError('Das Spotify-Gerät ist gerade nicht erreichbar.', 'NO_DEVICE');
    throw new SpotifyError(message, 'OTHER');
  }
  return body as T;
}

export type SpotifyUser = { display_name: string; product?: string };

export function getMe(getToken: GetToken) {
  return call<SpotifyUser>(getToken, '/me');
}

export type Device = {
  id: string;
  is_active: boolean;
  is_restricted?: boolean;
  type: string;
  name: string;
  volume_percent?: number | null;
};

export async function listDevices(getToken: GetToken): Promise<Device[]> {
  const data = await call<{ devices: Device[] }>(getToken, '/me/player/devices');
  return (data?.devices ?? []).filter((d) => d.id && !d.is_restricted);
}

const isPhone = (d: Device) => d.type.toLowerCase() === 'smartphone';

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Spotify nennt das Handy meist so wie in den Android-Einstellungen („Gerätename“) oder nach dem Modell. */
function isThisPhone(d: Device): boolean {
  const name = norm(d.name);
  const own = [ExpoDevice.deviceName, ExpoDevice.modelName].map(norm).filter((n) => n.length > 2);
  return own.some((n) => name === n || name.includes(n) || n.includes(name));
}

/**
 * Wählt das Handy, auf dem das Spiel läuft (bzw. ein Smartphone mit der Spotify-App). Rechner oder Lautsprecher, die noch bei
 * Spotify angemeldet sind, werden nie genommen, damit die Musik nicht woanders landet.
 */
export async function pickDevice(getToken: GetToken): Promise<Device> {
  const devices = await listDevices(getToken);
  // Zuerst genau dieses Handy, dann irgendein Handy. Nie Rechner oder Lautsprecher.
  const phones = devices.filter(isPhone);
  const device = phones.find(isThisPhone) ?? phones.find((d) => d.is_active) ?? phones[0];
  if (!device) {
    const others = devices.map((d) => `„${d.name}“`).join(', ');
    throw new SpotifyError(
      (others
        ? `Spotify ist gerade nur auf ${others} offen, nicht auf diesem Handy. `
        : 'Spotify läuft auf diesem Handy gerade nicht. ') +
        'Tippe auf „Spotify öffnen“, starte dort kurz einen Song und komm dann zurück.',
      'NO_DEVICE',
    );
  }
  return device;
}

let uriCache: Record<string, { uri: string; durationMs: number }> | null = null;

async function loadCache() {
  if (uriCache) return uriCache;
  try {
    uriCache = JSON.parse((await AsyncStorage.getItem(URI_CACHE_KEY)) ?? '{}');
  } catch {
    uriCache = {};
  }
  return uriCache!;
}

type SearchTrack = { uri: string; duration_ms: number; name: string; artists: { name: string }[] };

/** Findet den Spotify-Track zu einem Song aus unseren Listen (mit Cache). */
export async function resolveTrack(getToken: GetToken, song: Song): Promise<{ uri: string; durationMs: number }> {
  if (song.uri) return { uri: song.uri, durationMs: song.durationMs ?? 180_000 };
  const cache = await loadCache();
  const cached = cache[song.id];
  if (cached) return cached;

  const firstArtist = song.artist.split(/,| & | feat\.? /i)[0].trim();
  const queries = [`track:${song.title} artist:${firstArtist}`, `${song.title} ${firstArtist}`];
  for (const q of queries) {
    const data = await call<{ tracks: { items: SearchTrack[] } }>(
      getToken,
      `/search?type=track&limit=5&market=from_token&q=${encodeURIComponent(q)}`,
    );
    const items = data?.tracks.items ?? [];
    const match = items.find((t) => t.artists.some((a) => a.name.toLowerCase() === firstArtist.toLowerCase())) ?? items[0];
    if (match) {
      const result = { uri: match.uri, durationMs: match.duration_ms };
      cache[song.id] = result;
      AsyncStorage.setItem(URI_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
      return result;
    }
  }
  throw new SpotifyError(`„${song.title}“ wurde auf Spotify nicht gefunden.`, 'NOT_FOUND');
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Macht ein Gerät zum aktiven Spotify-Player, ohne schon etwas abzuspielen. */
export async function transferPlayback(getToken: GetToken, deviceId: string) {
  await call(getToken, '/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: false }) });
}

type PlayerState = {
  is_playing: boolean;
  device?: { id: string; name?: string; volume_percent?: number | null };
  item?: { uri: string; name?: string } | null;
};

export async function playerState(getToken: GetToken): Promise<PlayerState | null> {
  return call<PlayerState>(getToken, '/me/player');
}

async function sendPlay(getToken: GetToken, deviceId: string, uri: string, positionMs: number) {
  await call(getToken, `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [uri], position_ms: Math.max(0, Math.round(positionMs)) }),
  });
}

/**
 * Wartet, bis Spotify für das Gerät „spielt“ meldet. Die Track-URI wird bewusst nicht verglichen: Spotify ersetzt
 * Tracks je nach Land durch eine gleichwertige Version mit anderer URI.
 */
async function waitUntilPlaying(getToken: GetToken, deviceId: string): Promise<PlayerState | null> {
  let last: PlayerState | null = null;
  for (let i = 0; i < 8; i++) {
    await wait(500);
    last = await playerState(getToken).catch(() => null);
    if (last?.is_playing && (!last.device || last.device.id === deviceId)) return last;
  }
  return last;
}

export type PlayResult = { verified: boolean; state: PlayerState | null };

/**
 * Startet den Song auf dem Gerät und prüft, ob Spotify die Wiedergabe meldet. Inaktive Handys nehmen den Befehl
 * manchmal an, spielen aber nicht; dann einmal das Gerät aktivieren und neu starten. Das Spiel wird nie blockiert:
 * Meldet Spotify auch danach nichts, gibt es nur einen Hinweis zurück.
 */
export async function play(getToken: GetToken, device: Device, uri: string, positionMs: number): Promise<PlayResult> {
  if (!device.is_active) {
    await transferPlayback(getToken, device.id).catch(() => {});
    await wait(400);
  }
  await sendPlay(getToken, device.id, uri, positionMs);
  let state = await waitUntilPlaying(getToken, device.id);
  if (state?.is_playing) return { verified: true, state };
  await transferPlayback(getToken, device.id).catch(() => {});
  await wait(600);
  await sendPlay(getToken, device.id, uri, positionMs);
  state = await waitUntilPlaying(getToken, device.id);
  return { verified: !!state?.is_playing, state };
}

export async function pause(getToken: GetToken, deviceId?: string) {
  const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
  try {
    await call(getToken, `/me/player/pause${query}`, { method: 'PUT' });
  } catch {
    // Schon pausiert oder Gerät weg: egal.
  }
}

type PlaylistEntry = {
  track?: PlaylistTrack | null;
  item?: PlaylistTrack | null;
};
type PlaylistTrack = {
  type?: string;
  uri: string;
  name: string;
  duration_ms?: number;
  artists: { name: string }[];
  album: { release_date: string };
};

export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/playlist[/:]([A-Za-z0-9]{10,})/);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z0-9]{10,}$/.test(trimmed) ? trimmed : null;
}

/** Lädt eine eigene Playlist als Kategorie. Spotify erlaubt im Entwicklungsmodus nur eigene Playlists. */
export async function loadPlaylist(getToken: GetToken, playlistId: string): Promise<{ name: string; songs: Song[] }> {
  const meta = await call<{ name: string }>(getToken, `/playlists/${playlistId}?fields=name`);
  const songs: Song[] = [];
  for (const endpoint of ['items', 'tracks']) {
    try {
      let offset = 0;
      while (offset < 500) {
        const page = await call<{ items: PlaylistEntry[]; next: string | null }>(
          getToken,
          `/playlists/${playlistId}/${endpoint}?limit=50&offset=${offset}`,
        );
        for (const entry of page?.items ?? []) {
          const t = entry.item ?? entry.track;
          if (!t || (t.type && t.type !== 'track')) continue;
          const year = parseInt(t.album?.release_date?.slice(0, 4) ?? '', 10);
          if (!year) continue;
          songs.push({
            id: `pl:${t.uri}`,
            title: t.name,
            artist: t.artists.map((a) => a.name).join(', '),
            year,
            category: `playlist:${playlistId}`,
            uri: t.uri,
            durationMs: t.duration_ms,
          });
        }
        if (!page?.next) break;
        offset += 50;
      }
      break;
    } catch (e) {
      if (endpoint === 'tracks' || songs.length) throw e;
    }
  }
  return { name: meta?.name ?? 'Meine Playlist', songs };
}

export type DiagnoseStep = { ok: boolean; text: string };

/** Prüft Schritt für Schritt, ob Spotify auf diesem Handy abspielen kann, und spielt kurz einen Testsong. */
export async function diagnosePlayback(getToken: GetToken): Promise<DiagnoseStep[]> {
  const steps: DiagnoseStep[] = [];
  try {
    const me = await getMe(getToken);
    const premium = me?.product === 'premium';
    steps.push({
      ok: premium,
      text: premium
        ? `Angemeldet als ${me?.display_name}, Premium`
        : `Konto „${me?.product ?? '?'}“: Abspielen geht nur mit Premium`,
    });
    if (!premium) return steps;
    const devices = await listDevices(getToken);
    steps.push({
      ok: devices.length > 0,
      text: devices.length
        ? `Geräte: ${devices.map((d) => `${d.name} (${d.type}${d.is_active ? ', aktiv' : ''})`).join(', ')}`
        : 'Kein Spotify-Gerät gefunden: Spotify-App öffnen und kurz einen Song abspielen',
    });
    if (!devices.length) return steps;
    const device = await pickDevice(getToken);
    const track = await resolveTrack(getToken, {
      id: 'test:mr-brightside',
      title: 'Mr. Brightside',
      artist: 'The Killers',
      year: 2004,
      category: 'test',
    });
    const result = await play(getToken, device, track.uri, 30_000);
    const st = result.state;
    steps.push({
      ok: result.verified,
      text: result.verified
        ? `Testsong läuft auf „${st?.device?.name ?? device.name}“${st?.device?.volume_percent === 0 ? ', aber die Spotify-Lautstärke steht auf 0' : ''}`
        : `Befehl an „${device.name}“ geschickt, Spotify meldet aber: ${
            st
              ? `${st.is_playing ? 'spielt' : 'pausiert'} auf „${st.device?.name ?? '?'}“, Song „${st.item?.name ?? '–'}“`
              : 'kein aktiver Player'
          }`,
    });
    await wait(4000);
    await pause(getToken, device.id);
  } catch (e) {
    steps.push({ ok: false, text: e instanceof Error ? e.message : String(e) });
  }
  return steps;
}
