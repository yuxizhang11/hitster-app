import { requireOptionalNativeModule } from 'expo';

export type RemotePlayerState = { isPaused: boolean; uri: string | null; positionMs: number };

type SpotifyRemoteNative = {
  isSpotifyInstalled(): boolean;
  isConnected(): boolean;
  authorize(clientId: string, redirectUri: string): Promise<void>;
  connect(clientId: string, redirectUri: string): Promise<void>;
  play(uri: string, positionMs: number): Promise<void>;
  seekTo(positionMs: number): Promise<void>;
  pause(): Promise<void>;
  getPlayerState(): Promise<RemotePlayerState>;
  disconnect(): void;
};

/** Nur in der Android-App vorhanden, im Web und in Expo Go null. */
export const SpotifyRemote = requireOptionalNativeModule<SpotifyRemoteNative>('SpotifyRemote');
