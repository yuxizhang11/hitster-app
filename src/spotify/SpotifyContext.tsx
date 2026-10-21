import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  ResponseType,
  TokenResponse,
  useAuthRequest,
} from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { getMe, GetToken, SpotifyError, SpotifyUser } from './api';
import { secureStorage } from './storage';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const SCOPES = [
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  // Erlaubt Hitster, die Spotify-App auf dem Handy direkt zu steuern (App-Remote-SDK).
  'app-remote-control',
  'playlist-read-private',
  'playlist-read-collaborative',
];

const TOKEN_KEY = 'spotify-token';
const CLIENT_ID_KEY = 'spotify-client-id';

type SpotifyContextValue = {
  clientId: string;
  setClientId: (id: string) => void;
  redirectUri: string;
  connected: boolean;
  user: SpotifyUser | null;
  busy: boolean;
  /** Login-Anfrage ist mit der aktuellen Client-ID vorbereitet. */
  ready: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: GetToken;
  /** Bei abgelaufenem oder widerrufenem Login aufrufen, damit die App sauber trennt. */
  handleAuthError: (e: unknown) => void;
};

const SpotifyContext = createContext<SpotifyContextValue | null>(null);

export function SpotifyProvider({ children }: { children: ReactNode }) {
  const [clientId, setClientIdState] = useState(process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '');
  const [token, setToken] = useState<TokenResponse | null>(null);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<TokenResponse | null>(null);
  const refreshing = useRef<Promise<TokenResponse> | null>(null);

  const redirectUri = useMemo(() => makeRedirectUri({ scheme: 'hitster', path: 'spotify-auth' }), []);

  const [request, , promptAsync] = useAuthRequest(
    {
      clientId: clientId || 'missing',
      scopes: SCOPES,
      redirectUri,
      responseType: ResponseType.Code,
      usePKCE: true,
    },
    discovery,
  );

  const saveToken = useCallback(async (next: TokenResponse | null) => {
    tokenRef.current = next;
    setToken(next);
    if (next) await secureStorage.set(TOKEN_KEY, JSON.stringify(next.getRequestConfig()));
    else await secureStorage.remove(TOKEN_KEY);
  }, []);

  // Gespeicherte Client-ID und Tokens beim Start laden.
  useEffect(() => {
    (async () => {
      const storedId = await AsyncStorage.getItem(CLIENT_ID_KEY);
      if (storedId) setClientIdState(storedId);
      const raw = await secureStorage.get(TOKEN_KEY);
      if (raw) {
        try {
          const restored = new TokenResponse(JSON.parse(raw));
          tokenRef.current = restored;
          setToken(restored);
        } catch {
          await secureStorage.remove(TOKEN_KEY);
        }
      }
    })();
  }, []);

  const setClientId = useCallback((id: string) => {
    const trimmed = id.trim();
    setClientIdState(trimmed);
    AsyncStorage.setItem(CLIENT_ID_KEY, trimmed).catch(() => {});
  }, []);

  const getToken = useCallback<GetToken>(async () => {
    const current = tokenRef.current;
    if (!current) throw new Error('Nicht mit Spotify verbunden.');
    if (!current.shouldRefresh()) return current.accessToken;
    if (!current.refreshToken) throw new Error('Spotify-Login abgelaufen. Bitte neu verbinden.');
    refreshing.current ??= refreshAsync({ clientId, refreshToken: current.refreshToken }, discovery)
      .then(async (fresh) => {
        // Spotify schickt nicht immer einen neuen Refresh-Token mit.
        const merged = new TokenResponse({
          ...fresh.getRequestConfig(),
          refreshToken: fresh.refreshToken ?? current.refreshToken,
        });
        await saveToken(merged);
        return merged;
      })
      .catch(async (e) => {
        // Refresh-Token widerrufen oder ungültig: trennen statt endlos Fehler zu werfen.
        if (tokenRef.current === current) await saveToken(null);
        throw new SpotifyError('Spotify-Login abgelaufen. Bitte neu verbinden.', 'AUTH');
      })
      .finally(() => {
        refreshing.current = null;
      });
    return (await refreshing.current).accessToken;
  }, [clientId, saveToken]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    getMe(getToken)
      .then((me) => setUser(me))
      .catch((e) => {
        if (e instanceof SpotifyError && e.code === 'AUTH') saveToken(null);
        setError(String(e.message ?? e));
      });
  }, [token, getToken, saveToken]);

  const handleAuthError = useCallback(
    (e: unknown) => {
      if (e instanceof SpotifyError && e.code === 'AUTH') saveToken(null);
    },
    [saveToken],
  );

  const login = useCallback(async () => {
    setError(null);
    if (!clientId) {
      setError('Bitte zuerst die Spotify Client-ID eintragen.');
      return;
    }
    if (!request || request.clientId !== clientId) return;
    setBusy(true);
    try {
      const result = await promptAsync();
      if (result.type !== 'success') {
        if (result.type === 'error') setError(result.error?.message ?? 'Login fehlgeschlagen.');
        return;
      }
      const fresh = await exchangeCodeAsync(
        {
          clientId,
          code: result.params.code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier ?? '' },
        },
        discovery,
      );
      await saveToken(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [clientId, request, promptAsync, redirectUri, saveToken]);

  const logout = useCallback(async () => {
    await saveToken(null);
  }, [saveToken]);

  const connected = !!token;
  const ready = !!clientId && !!request && request.clientId === clientId;
  const value = useMemo<SpotifyContextValue>(
    () => ({ clientId, setClientId, redirectUri, connected, user, busy, ready, error, login, logout, getToken, handleAuthError }),
    [clientId, setClientId, redirectUri, connected, user, busy, ready, error, login, logout, getToken, handleAuthError],
  );

  return <SpotifyContext.Provider value={value}>{children}</SpotifyContext.Provider>;
}

export function useSpotify(): SpotifyContextValue {
  const ctx = useContext(SpotifyContext);
  if (!ctx) throw new Error('useSpotify muss innerhalb von SpotifyProvider verwendet werden.');
  return ctx;
}
