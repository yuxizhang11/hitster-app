import { Platform } from 'react-native';

import { SpotifyRemote } from '../../modules/spotify-remote';

/** Paketname und Fingerabdruck, die im Spotify Developer Dashboard unter „Android packages“ stehen müssen. */
export const ANDROID_PACKAGE = 'com.yuxizhang.hitster';
export const ANDROID_SHA1 = '5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25';

/** True in der Android-App: dort steuern wir die Spotify-App direkt (App-Remote-SDK) statt über die Web-API. */
export const remoteAvailable = () => Platform.OS === 'android' && !!SpotifyRemote;

export class RemoteError extends Error {
  constructor(
    message: string,
    public code: string,
    /** Originalmeldung des SDK, hilft bei der Fehlersuche. */
    public detail = '',
    /** True, wenn im Spotify-Dashboard Paket und SHA1 fehlen oder nicht passen. */
    public needsDashboard = false,
  ) {
    super(message);
  }
}

function timeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new RemoteError(`${what} dauert zu lange.`, 'Timeout')), ms)),
  ]);
}

/** Übersetzt Fehler des SDK in einen verständlichen Hinweis. */
export function remoteMessage(e: unknown): RemoteError {
  const code = String((e as { code?: string })?.code ?? '');
  const msg = String((e as Error)?.message ?? e);
  const has = (s: string) => code.includes(s) || msg.includes(s);
  const detail = [code, msg].filter(Boolean).join(': ');
  if (has('Timeout'))
    return new RemoteError(
      'Die Spotify-App antwortet nicht. Meist blockiert Android sie im Hintergrund: In den Handy-Einstellungen bei Spotify den Akku auf „Uneingeschränkt“ stellen und „Autostart“ bzw. „Von anderen Apps starten lassen“ erlauben. Danach in Hitster einmal „Trennen“ und neu verbinden.',
      code,
      detail,
    );
  if (has('CouldNotFindSpotifyApp')) return new RemoteError('Die Spotify-App ist auf diesem Handy nicht installiert.', code, detail);
  if (has('NotLoggedIn')) return new RemoteError('In der Spotify-App ist niemand angemeldet.', code, detail);
  if (has('UserNotAuthorized') || has('AuthenticationFailed'))
    return new RemoteError(
      'Spotify lässt Hitster noch nicht direkt steuern. Im Spotify Developer Dashboard unter „Android packages“ müssen genau diese Werte stehen. Nach dem Speichern kann es ein paar Minuten dauern.',
      code,
      detail,
      true,
    );
  if (has('UnsupportedFeatureVersion')) return new RemoteError('Die Spotify-App ist zu alt, bitte aktualisieren.', code, detail);
  if (has('OfflineMode')) return new RemoteError('Die Spotify-App ist im Offline-Modus.', code, detail);
  return new RemoteError('Verbindung zur Spotify-App fehlgeschlagen.', code || 'OTHER', detail);
}

export async function remoteConnect(clientId: string, redirectUri: string) {
  if (!SpotifyRemote) throw new RemoteError('Nur in der Android-App möglich.', 'Unavailable');
  if (SpotifyRemote.isConnected()) return;
  try {
    // Beim ersten Mal fragt Spotify einmalig nach Erlaubnis, daher großzügig warten.
    await timeout(SpotifyRemote.connect(clientId, redirectUri), 30_000, 'Die Verbindung zur Spotify-App');
  } catch (e) {
    throw remoteMessage(e);
  }
}

/** Spielt den Song über die Spotify-App und gibt true zurück, sobald Spotify meldet, dass er läuft. */
export async function remotePlay(clientId: string, redirectUri: string, uri: string, positionMs: number): Promise<boolean> {
  await remoteConnect(clientId, redirectUri);
  try {
    await timeout(SpotifyRemote!.play(uri, Math.max(0, Math.round(positionMs))), 10_000, 'Das Starten');
    for (let i = 0; i < 10; i++) {
      const state = await SpotifyRemote!.getPlayerState();
      if (!state.isPaused) return true;
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  } catch (e) {
    throw remoteMessage(e);
  }
}

export async function remotePause() {
  await SpotifyRemote?.pause().catch(() => {});
}
