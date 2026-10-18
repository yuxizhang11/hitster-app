import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { CATEGORIES } from '../data/songs';
import type { Category } from '../data/types';
import { createGame, GameState } from '../game/engine';
import { getMode, ModeId } from '../game/modes';

const CUSTOM_KEY = 'custom-categories-v1';
const SETUP_KEY = 'last-setup-v1';

export type Setup = {
  players: string[];
  modeId: ModeId;
  categoryIds: string[];
  target?: number;
};

type GameContextValue = {
  game: GameState | null;
  setGame: (g: GameState | null) => void;
  setup: Setup;
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

  useEffect(() => {
    (async () => {
      try {
        const [c, s] = await Promise.all([AsyncStorage.getItem(CUSTOM_KEY), AsyncStorage.getItem(SETUP_KEY)]);
        if (c) setCustom(JSON.parse(c));
        if (s) setSetupState({ ...defaultSetup, ...JSON.parse(s) });
      } catch {
        // Kaputte Daten ignorieren, Standard verwenden.
      }
    })();
  }, []);

  const persistCustom = (next: Category[]) => {
    setCustom(next);
    AsyncStorage.setItem(CUSTOM_KEY, JSON.stringify(next)).catch(() => {});
  };

  const setSetup = useCallback((s: Setup) => {
    setSetupState(s);
    AsyncStorage.setItem(SETUP_KEY, JSON.stringify(s)).catch(() => {});
  }, []);

  const categories = [...CATEGORIES, ...custom];

  const startGame = useCallback(
    (s: Setup) => {
      setSetup(s);
      const songs = categories.filter((c) => s.categoryIds.includes(c.id)).flatMap((c) => c.songs);
      const g = createGame(getMode(s.modeId), s.players, songs, { target: s.target });
      setGame(g);
      return g;
    },
    [categories, setSetup],
  );

  const value: GameContextValue = {
    game,
    setGame,
    setup,
    setSetup,
    startGame,
    categories,
    addCustomCategory: (c) => persistCustom([...custom.filter((x) => x.id !== c.id), c]),
    removeCustomCategory: (id) => persistCustom(custom.filter((x) => x.id !== id)),
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame muss innerhalb von GameProvider verwendet werden.');
  return ctx;
}
