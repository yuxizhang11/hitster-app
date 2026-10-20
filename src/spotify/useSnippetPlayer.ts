import { useCallback, useEffect, useRef, useState } from 'react';

import { findPreview, playPreview, PREVIEW_SECONDS, stopPreview } from '../audio/preview';
import { getMusicSource } from '../audio/source';
import type { Song } from '../data/types';
import { Device, pause, pickDevice, play, resolveTrack, SpotifyError } from './api';
import { remoteAvailable, remotePause, remotePlay } from './remote';
import { useSpotify } from './SpotifyContext';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'error';
/** Was gerade wirklich spielt: die Spotify-App oder der 30-Sekunden-Ausschnitt in der App. */
export type PlaybackSource = 'spotify' | 'preview';

/**
 * Wenn Spotify in dieser App-Sitzung einmal nicht losgespielt hat, gleich die Ausschnitte nehmen,
 * statt bei jedem Song erneut einige Sekunden auf Spotify zu warten.
 */
let spotifyUnreliable = false;
let wasConnected = false;
/** Warum Spotify zuletzt nicht gespielt hat, für den Hinweis im Spiel. */
let lastSpotifyError: string | null = null;

/** Nach einem erfolgreichen Test in den Einstellungen Spotify wieder versuchen. */
export function retrySpotify() {
  spotifyUnreliable = false;
  lastSpotifyError = null;
}

/**
 * Spielt kurze Ausschnitte. Mit Spotify-Verbindung über die Spotify-App auf dem Handy,
 * sonst (oder wenn Spotify nicht startet) als 30-Sekunden-Vorschau direkt in der App.
 */
export function useSnippetPlayer() {
  const { connected, getToken, handleAuthError, clientId, redirectUri } = useSpotify();
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [error, setError] = useState<SpotifyError | null>(null);
  const [source, setSource] = useState<PlaybackSource | null>(null);
  /** Gesetzt, wenn Spotify gewünscht war, aber der Ausschnitt einspringen musste. */
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const device = useRef<Device | null>(null);
  const startPositions = useRef(new Map<string, number>());
  const finish = useRef<(() => void) | null>(null);
  /** Zählt Wiedergaben hoch, damit ein abgelöstes Snippet nicht das neue pausiert. */
  const generation = useRef(0);
  const active = useRef<PlaybackSource | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    // Ein abgebrochenes Snippet gilt als beendet, damit wartende Aufrufer weiterlaufen.
    finish.current?.();
    finish.current = null;
  };

  const silence = useCallback(async () => {
    const was = active.current;
    active.current = null;
    stopPreview();
    if (was === 'spotify') {
      if (remoteAvailable()) await remotePause();
      else await pause(getToken, device.current?.id).catch(() => {});
    }
  }, [getToken]);

  const stop = useCallback(async () => {
    ++generation.current;
    clearTimer();
    setStatus('idle');
    setError(null);
    await silence();
  }, [silence]);

  /** Versucht Spotify. Gibt false zurück, wenn Spotify nicht nachweislich spielt. */
  const trySpotify = useCallback(
    async (song: Song, seconds: number, startAt: 'intro' | 'middle', gen: number): Promise<boolean> => {
      try {
        const track = await resolveTrack(getToken, song);
        const key = `spotify:${song.id}`;
        let position = startPositions.current.get(key);
        if (position === undefined) {
          position =
            startAt === 'intro'
              ? 0
              : Math.min(track.durationMs * (0.25 + Math.random() * 0.3), track.durationMs - seconds * 1000 - 2000);
          position = Math.max(0, position);
          startPositions.current.set(key, position);
        }
        if (remoteAvailable()) {
          // Android: Spotify-App direkt steuern, das weckt sie auch aus dem Hintergrund.
          const ok = await remotePlay(clientId, redirectUri, track.uri, position);
          if (ok) {
            active.current = 'spotify';
            lastSpotifyError = null;
            return true;
          }
          await remotePause();
          lastSpotifyError = 'Spotify hat den Song nicht gestartet.';
          spotifyUnreliable = true;
          return false;
        }
        device.current ??= await pickDevice(getToken);
        let result;
        try {
          result = await play(getToken, device.current, track.uri, position);
        } catch (e) {
          // Gerät könnte inzwischen weg sein: einmal neu suchen.
          if (e instanceof SpotifyError && e.code === 'NO_DEVICE') {
            device.current = await pickDevice(getToken);
            result = await play(getToken, device.current, track.uri, position);
          } else throw e;
        }
        if (result.verified) {
          device.current = { ...device.current, is_active: true };
          active.current = 'spotify';
          return true;
        }
        // Spotify hat den Befehl angenommen, spielt aber nicht: sicherheitshalber anhalten.
        await pause(getToken, device.current.id).catch(() => {});
        lastSpotifyError = 'Spotify hat den Song nicht gestartet.';
        spotifyUnreliable = true;
        return false;
      } catch (e) {
        device.current = null;
        lastSpotifyError = e instanceof Error ? e.message : String(e);
        if (remoteAvailable()) spotifyUnreliable = true;
        // Bei abgelaufenem Login wird die Verbindung getrennt, gespielt wird trotzdem (als Ausschnitt).
        handleAuthError(e);
        return false;
      }
    },
    [getToken, handleAuthError, clientId, redirectUri],
  );

  /** Spielt `seconds` Sekunden des Songs. Die Startposition bleibt pro Song gleich, auch beim Nochmal-Hören. */
  const playSnippet = useCallback(
    async (song: Song, seconds: number, startAt: 'intro' | 'middle'): Promise<boolean> => {
      const gen = ++generation.current;
      clearTimer();
      setError(null);
      setStatus('loading');
      await silence();
      try {
        let used: PlaybackSource = 'preview';
        const wantSpotify = connected && getMusicSource() === 'auto' && !spotifyUnreliable;
        if (wantSpotify && (await trySpotify(song, seconds, startAt, gen))) used = 'spotify';
        if (gen !== generation.current) {
          if (active.current === 'spotify') await silence();
          return false;
        }
        if (used === 'preview') {
          const url = await findPreview(song);
          if (gen !== generation.current) return false;
          const key = `preview:${song.id}`;
          let start = startPositions.current.get(key);
          if (start === undefined) {
            const room = Math.max(0, PREVIEW_SECONDS - seconds - 1);
            start = startAt === 'intro' ? 0 : Math.round(Math.random() * room);
            startPositions.current.set(key, start);
          }
          await playPreview(url, start);
          if (gen !== generation.current) {
            stopPreview();
            return false;
          }
          active.current = 'preview';
        }
        setSource(used);
        setFallbackNote(used === 'preview' && wantSpotify ? lastSpotifyError ?? 'Spotify hat nicht gestartet.' : null);
        setStatus('playing');
        await new Promise<void>((resolve) => {
          finish.current = resolve;
          timer.current = setTimeout(resolve, seconds * 1000);
        });
        if (gen !== generation.current) return false;
        finish.current = null;
        await silence();
        setStatus('idle');
        return true;
      } catch (e) {
        if (gen !== generation.current) return false;
        await silence();
        setError(e instanceof SpotifyError ? e : new SpotifyError(String((e as Error)?.message ?? e), 'OTHER'));
        setStatus('error');
        return false;
      }
    },
    [connected, silence, trySpotify],
  );

  // Neue Spotify-Verbindung: Spotify wieder eine Chance geben.
  useEffect(() => {
    if (connected && !wasConnected) spotifyUnreliable = false;
    wasConnected = connected;
  }, [connected]);

  useEffect(
    () => () => {
      clearTimer();
      stopPreview();
    },
    [],
  );

  return { status, error, playSnippet, stop, source, fallbackNote };
}
