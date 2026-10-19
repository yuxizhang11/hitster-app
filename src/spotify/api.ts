import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Song } from '../data/types';

const API = 'https://api.spotify.com/v1';
const URI_CACHE_KEY = 'spotify-uri-cache-v1';

export type GetToken = () => Promise<string>;

export class SpotifyError extends Error {
  constructor(
    message: string,
    public code: 'NO_DEVICE' | 'PREMIUM_REQUIRED' | 'NOT_FOUND' | 'AUTH' | 'OTHER',
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
    throw new SpotifyError(message, 'OTHER');
  }
  return body as T;
}

export type SpotifyUser = { display_name: string; product?: string };

export function getMe(getToken: GetToken) {
  return call<SpotifyUser>(getToken, '/me');
}

type Device = { id: string; is_active: boolean; type: string; name: string };

/** Wählt das aktive Gerät, sonst bevorzugt ein Smartphone (also dieses Handy mit der Spotify-App). */
export async function pickDevice(getToken: GetToken): Promise<string> {
  const data = await call<{ devices: Device[] }>(getToken, '/me/player/devices');
  const devices = (data?.devices ?? []).filter((d) => d.id);
  const device =
    devices.find((d) => d.is_active) ?? devices.find((d) => d.type.toLowerCase() === 'smartphone') ?? devices[0];
  if (!device) {
    throw new SpotifyError(
      'Kein Spotify-Gerät gefunden. Öffne kurz die Spotify-App auf diesem Handy und komm dann zurück.',
      'NO_DEVICE',
    );
  }
  return device.id;
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
      `/search?type=track&limit=5&q=${encodeURIComponent(q)}`,
    );
    const items = data?.tracks.items ?? [];
    const match =
      items.find((t) => t.artists.some((a) => a.name.toLowerCase() === firstArtist.toLowerCase())) ?? items[0];
    if (match) {
      const result = { uri: match.uri, durationMs: match.duration_ms };
      cache[song.id] = result;
      AsyncStorage.setItem(URI_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
      return result;
    }
  }
  throw new SpotifyError(`„${song.title}“ wurde auf Spotify nicht gefunden.`, 'NOT_FOUND');
}

export async function play(getToken: GetToken, deviceId: string, uri: string, positionMs: number) {
  await call(getToken, `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [uri], position_ms: Math.max(0, Math.round(positionMs)) }),
  });
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
