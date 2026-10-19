import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { CATEGORIES } from '../data/songs';
import type { Category } from '../data/types';
import { createGame, GameState, Scoring } from '../game/engine';
import { getMode, ModeId } from '../game/modes';

const CUSTOM_KEY = 'custom-categories-v1';
const SETUP_KEY = 'last-setup-v1';

export type Setup = {
  players: string[];
  modeId: ModeId;
  categoryIds: string[];
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
  categories: Category[];
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

  useEffect(() => {
    (async () => {
      try {
        const [c, s] = await Promise.all([AsyncStorage.getItem(CUSTOM_KEY), AsyncStorage.getItem(SETUP_KEY)]);
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

  const categories = useMemo(() => [...CATEGORIES, ...custom], [custom]);

  const startGame = useCallback(
    (s: Setup) => {
      setSetup(s);
      const songs = categories.filter((c) => s.categoryIds.includes(c.id)).flatMap((c) => c.songs);
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
    () => ({ game, setGame, setup, loaded, setSetup, startGame, categories, addCustomCategory, removeCustomCategory }),
    [game, setup, loaded, setSetup, startGame, categories, addCustomCategory, removeCustomCategory],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame muss innerhalb von GameProvider verwendet werden.');
  return ctx;
}
