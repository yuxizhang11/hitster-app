export type Song = {
  id: string;
  title: string;
  artist: string;
  year: number;
  category: string;
  /** Spotify track URI, if already known (e.g. imported from a playlist). */
  uri?: string;
  /** Länge in ms, falls bekannt. */
  durationMs?: number;
};

export type Category = {
  id: string;
  name: string;
  emoji: string;
  colors: [string, string];
  songs: Song[];
};
