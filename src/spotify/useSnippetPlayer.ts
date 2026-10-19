import { useCallback, useEffect, useRef, useState } from 'react';

import type { Song } from '../data/types';
import { pause, pickDevice, play, resolveTrack, SpotifyError } from './api';
import { useSpotify } from './SpotifyContext';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'error';

/**
 * Spielt kurze Ausschnitte über die Spotify-App auf dem Handy ab.
 * Ohne Spotify-Verbindung läuft ein stummer Demo-Modus, damit man die App trotzdem ausprobieren kann.
 */
export function useSnippetPlayer() {
  const { connected, getToken, handleAuthError } = useSpotify();
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [error, setError] = useState<SpotifyError | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceId = useRef<string | null>(null);
  const startPositions = useRef(new Map<string, number>());
  const finish = useRef<(() => void) | null>(null);
  /** Zählt Wiedergaben hoch, damit ein abgelöstes Snippet nicht das neue pausiert. */
  const generation = useRef(0);
  const stoppedAt = useRef(-1);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    // Ein abgebrochenes Snippet gilt als beendet, damit wartende Aufrufer weiterlaufen.
    finish.current?.();
    finish.current = null;
  };

  const stop = useCallback(async () => {
    stoppedAt.current = ++generation.current;
    clearTimer();
    setStatus('idle');
    setError(null);
    if (connected) await pause(getToken, deviceId.current ?? undefined).catch(() => {});
  }, [connected, getToken]);

  /** Spielt `seconds` Sekunden des Songs. Die Startposition bleibt pro Song gleich, auch beim Nochmal-Hören. */
  const playSnippet = useCallback(
    async (song: Song, seconds: number, startAt: 'intro' | 'middle'): Promise<boolean> => {
      const gen = ++generation.current;
      clearTimer();
      setError(null);
      setStatus('loading');
      try {
        if (connected) {
          const track = await resolveTrack(getToken, song);
          let position = startPositions.current.get(song.id);
          if (position === undefined) {
            position =
              startAt === 'intro'
                ? 0
                : Math.min(track.durationMs * (0.25 + Math.random() * 0.3), track.durationMs - seconds * 1000 - 2000);
            startPositions.current.set(song.id, Math.max(0, position));
          }
          deviceId.current ??= await pickDevice(getToken);
          try {
            await play(getToken, deviceId.current, track.uri, position);
          } catch (e) {
            // Gerät könnte inzwischen weg sein: einmal neu suchen.
            if (e instanceof SpotifyError && e.code === 'NO_DEVICE') {
              deviceId.current = await pickDevice(getToken);
              await play(getToken, deviceId.current, track.uri, position);
            } else throw e;
          }
        }
        if (gen !== generation.current) {
          // Während des Ladens wurde gestoppt: Musik gleich wieder aus.
          if (connected && stoppedAt.current === generation.current) await pause(getToken, deviceId.current ?? undefined);
          return false;
        }
        setStatus('playing');
        await new Promise<void>((resolve) => {
          finish.current = resolve;
          timer.current = setTimeout(resolve, seconds * 1000);
        });
        if (gen !== generation.current) return false;
        finish.current = null;
        if (connected) await pause(getToken, deviceId.current ?? undefined);
        setStatus('idle');
        return true;
      } catch (e) {
        if (gen !== generation.current) return false;
        deviceId.current = null;
        handleAuthError(e);
        setError(e instanceof SpotifyError ? e : new SpotifyError(String((e as Error)?.message ?? e), 'OTHER'));
        setStatus('error');
        return false;
      }
    },
    [connected, getToken, handleAuthError],
  );

  useEffect(() => () => clearTimer(), []);

  return { status, error, playSnippet, stop, demo: !connected };
}
