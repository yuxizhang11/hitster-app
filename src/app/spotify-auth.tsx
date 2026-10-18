import { Redirect } from 'expo-router';

// Ziel der Spotify-Weiterleitung nach dem Login. Der Login selbst wird im SpotifyProvider abgeschlossen.
export default function SpotifyAuthRedirect() {
  return <Redirect href="/settings" />;
}
