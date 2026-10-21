import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { CATEGORIES } from '../data/songs';
import type { Category, Song } from '../data/types';
import { createGame, GameState, pickSongs, Scoring } from '../game/engine';
import { getMode, ModeId } from '../game/modes';

const CUSTOM_KEY = 'custom-categories-v1';
const SETUP_KEY = 'last-setup-v1';
const SONG_PREFS_KEY = 'song-prefs-v1';

/** Eigene Anpassungen der Songlisten: ausgeblendete Songs und selbst hinzugefügte Songs pro Kategorie. */
type SongPrefs = { hidden: string[]; added: Record<string, Song[]> };
const emptyPrefs: SongPrefs = { hidden: [], added: {} };

export type Setup = {
  players: string[];
  modeId: ModeId;
  categoryIds: string[];
  /** Leer oder fehlend = alle Jahrzehnte. */
  decades?: number[];
  target?: number;
  scoring?: Scoring;
};

type GameContextValue = {
  game: GameState | null;
  setGame: (g: GameState | null) => void;
  setup: Setup;
  /** Gespeichertes Setup ist geladen. */
  loaded: boolean;
  setSetup: (s: Setup) => void;
  startGame: (s: Setup) => GameState;
  /** Kategorien mit allen aktiven Songs (ausgeblendete fehlen), so wie sie ins Spiel gehen. */
  categories: Category[];
  /** Kategorien mit allen Songs inklusive ausgeblendeter, für die Songlisten-Ansicht. */
  allCategories: Category[];
  hiddenIds: ReadonlySet<string>;
  setSongsHidden: (ids: string[], hidden: boolean) => void;
  addSong: (categoryId: string, song: { title: string; artist: string; year: number }) => void;
  removeSong: (categoryId: string, songId: string) => void;
  addCustomCategory: (c: Category) => void;
  removeCustomCategory: (id: string) => void;
};

const defaultSetup: Setup = { players: ['Spieler 1', 'Spieler 2'], modeId: 'klassik', categoryIds: ['pop', '2010er', '2020er'] };

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameState | null>(null);
  const [setup, setSetupState] = useState<Setup>(defaultSetup);
  const [custom, setCustom] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** Wurde schon etwas eingestellt, darf das spät geladene Setup es nicht überschreiben. */
  const setupTouched = useRef(false);
  const customTouched = useRef(false);
  const [prefs, setPrefs] = useState<SongPrefs>(emptyPrefs);
  const prefsTouched = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, s, p] = await Promise.all([
          AsyncStorage.getItem(CUSTOM_KEY),
          AsyncStorage.getItem(SETUP_KEY),
          AsyncStorage.getItem(SONG_PREFS_KEY),
        ]);
        if (p && !prefsTouched.current) setPrefs({ ...emptyPrefs, ...JSON.parse(p) });
        if (c && !customTouched.current) setCustom(JSON.parse(c));
        if (s && !setupTouched.current) setSetupState({ ...defaultSetup, ...JSON.parse(s) });
      } catch {
        // Kaputte Daten ignorieren, Standard verwenden.
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const updateCustom = useCallback((fn: (prev: Category[]) => Category[]) => {
    customTouched.current = true;
    setCustom((prev) => {
      const next = fn(prev);
      AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setSetup = useCallback((s: Setup) => {
    setupTouched.current = true;
    setSetupState(s);
    AsyncStorage.setItem(SETUP_KEY, JSON.stringify(s)).catch(() => {});
  }, []);

  const updatePrefs = useCallback((fn: (prev: SongPrefs) => SongPrefs) => {
    prefsTouched.current = true;
    setPrefs((prev) => {
      const next = fn(prev);
      AsyncStorage.setItem(SONG_PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const hiddenIds = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);

  const allCategories = useMemo(
    () => [...CATEGORIES, ...custom].map((c) => (prefs.added[c.id]?.length ? { ...c, songs: [...c.songs, ...prefs.added[c.id]] } : c)),
    [custom, prefs.added],
  );

  const categories = useMemo(
    () => (hiddenIds.size ? allCategories.map((c) => ({ ...c, songs: c.songs.filter((s) => !hiddenIds.has(s.id)) })) : allCategories),
    [allCategories, hiddenIds],
  );

  const setSongsHidden = useCallback(
    (ids: string[], hidden: boolean) =>
      updatePrefs((prev) => {
        const set = new Set(prev.hidden);
        ids.forEach((id) => (hidden ? set.add(id) : set.delete(id)));
        return { ...prev, hidden: [...set] };
      }),
    [updatePrefs],
  );

  const addSong = useCallback(
    (categoryId: string, song: { title: string; artist: string; year: number }) =>
      updatePrefs((prev) => {
        const entry: Song = {
          id: `${categoryId}:eigen:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          title: song.title.trim(),
          artist: song.artist.trim(),
          year: song.year,
          category: categoryId,
        };
        return { ...prev, added: { ...prev.added, [categoryId]: [...(prev.added[categoryId] ?? []), entry] } };
      }),
    [updatePrefs],
  );

  const removeSong = useCallback(
    (categoryId: string, songId: string) =>
      updatePrefs((prev) => ({
        hidden: prev.hidden.filter((id) => id !== songId),
        added: { ...prev.added, [categoryId]: (prev.added[categoryId] ?? []).filter((s) => s.id !== songId) },
      })),
    [updatePrefs],
  );

  const startGame = useCallback(
    (s: Setup) => {
      setSetup(s);
      const songs = pickSongs(categories, s.categoryIds, s.decades);
      const g = createGame(getMode(s.modeId), s.players, songs, { target: s.target, scoring: s.scoring });
      setGame(g);
      return g;
    },
    [categories, setSetup],
  );

  const addCustomCategory = useCallback(
    (c: Category) => updateCustom((prev) => [...prev.filter((x) => x.id !== c.id), c]),
    [updateCustom],
  );
  const removeCustomCategory = useCallback(
    (id: string) => updateCustom((prev) => prev.filter((x) => x.id !== id)),
    [updateCustom],
  );

  const value = useMemo<GameContextValue>(
    () => ({
      game,
      setGame,
      setup,
      loaded,
      setSetup,
      startGame,
      categories,
      allCategories,
      hiddenIds,
      setSongsHidden,
      addSong,
      removeSong,
      addCustomCategory,
      removeCustomCategory,
    }),
    [
      game,
      setup,
      loaded,
      setSetup,
      startGame,
      categories,
      allCategories,
      hiddenIds,
      setSongsHidden,
      addSong,
      removeSong,
      addCustomCategory,
      removeCustomCategory,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame muss innerhalb von GameProvider verwendet werden.');
  return ctx;
}
