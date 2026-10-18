import type { Song } from '../data/types';
import type { ModeDef, QuestionType } from './modes';

export type Rng = () => number;

export type Player = {
  id: string;
  name: string;
  score: number;
  /** Nach Jahr sortierte Karten (Klassik-Modus). */
  timeline: Song[];
  alive: boolean;
  turns: number;
};

export type Question = {
  type: QuestionType;
  /** Antwortmöglichkeiten bei Multiple Choice. */
  options?: string[];
};

export type AnswerValue =
  | { kind: 'choice'; value: string }
  | { kind: 'year'; value: number }
  | { kind: 'slot'; value: number }
  | { kind: 'timeout' };

export type AnswerResult = {
  type: QuestionType;
  correct: boolean;
  points: number;
  /** Was richtig gewesen wäre, für die Auflösung. */
  solution: string;
  given: string;
};

export type Turn = {
  playerIndex: number;
  song: Song;
  questions: Question[];
  questionIndex: number;
  results: AnswerResult[];
};

export type GameState = {
  mode: ModeDef;
  players: Player[];
  pool: Song[];
  allSongs: Song[];
  turn: Turn | null;
  totalTurns: number;
  finished: boolean;
};

export type GameOptions = {
  /** Überschreibt Zielkarten (Klassik) bzw. Runden pro Spieler. */
  target?: number;
};

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function dedupeSongs(songs: Song[]): Song[] {
  const seen = new Set<string>();
  return songs.filter((s) => {
    const key = `${norm(s.title)}|${norm(s.artist)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function decadeLabel(year: number): string {
  const d = Math.floor(year / 10) * 10;
  return d >= 2000 ? `${d}er` : `${String(d).slice(2)}er`;
}

export function songLabel(song: Song): string {
  return `${song.title} – ${song.artist}`;
}

export function createGame(
  mode: ModeDef,
  playerNames: string[],
  songs: Song[],
  options: GameOptions = {},
  rng: Rng = Math.random,
): GameState {
  const end =
    options.target && mode.end.kind === 'cards'
      ? { kind: 'cards' as const, target: options.target }
      : options.target && mode.end.kind === 'rounds'
        ? { kind: 'rounds' as const, rounds: options.target }
        : mode.end;
  const allSongs = dedupeSongs(songs);
  let pool = shuffle(allSongs, rng);
  const players: Player[] = playerNames.map((name, i) => ({
    id: `p${i}`,
    name,
    score: 0,
    timeline: [],
    alive: true,
    turns: 0,
  }));
  if (Array.isArray(mode.questions) && mode.questions.includes('timeline')) {
    for (const p of players) {
      const starter = pool[0];
      if (!starter) break;
      pool = pool.slice(1);
      p.timeline = [starter];
    }
  }
  return { mode: { ...mode, end }, players, pool, allSongs, turn: null, totalTurns: 0, finished: false };
}

/** Index des nächsten Spielers, der noch im Spiel ist. */
function nextAliveIndex(players: Player[], from: number): number {
  for (let step = 1; step <= players.length; step++) {
    const i = (from + step) % players.length;
    if (players[i].alive) return i;
  }
  return from;
}

export function startTurn(state: GameState, rng: Rng = Math.random): GameState {
  if (state.finished) return state;
  const [song, ...rest] = state.pool;
  if (!song) return { ...state, finished: true, turn: null };
  const playerIndex = state.turn
    ? nextAliveIndex(state.players, state.turn.playerIndex)
    : state.players.findIndex((p) => p.alive);
  const types = Array.isArray(state.mode.questions)
    ? state.mode.questions
    : [state.mode.questions.random[Math.floor(rng() * state.mode.questions.random.length)]];
  const questions = types.map((type) => buildQuestion(type, song, state.allSongs, rng));
  return {
    ...state,
    pool: rest,
    turn: { playerIndex, song, questions, questionIndex: 0, results: [] },
  };
}

export function buildQuestion(type: QuestionType, song: Song, allSongs: Song[], rng: Rng = Math.random): Question {
  switch (type) {
    case 'artist':
      return { type, options: choiceOptions(song.artist, song, allSongs, rng, 'artist') };
    case 'title':
      return { type, options: choiceOptions(song.title, song, allSongs, rng, 'title') };
    case 'song':
      return { type, options: choiceOptions(songLabel(song), song, allSongs, rng, 'song') };
    case 'decade': {
      const d = Math.floor(song.year / 10) * 10;
      const offset = Math.floor(rng() * 4); // Position der richtigen Antwort
      const decades = [0, 1, 2, 3].map((i) => d + (i - offset) * 10);
      return { type, options: decades.map(decadeLabel) };
    }
    default:
      return { type };
  }
}

/**
 * Drei falsche Antworten + die richtige. Bevorzugt Ablenker aus derselben Kategorie,
 * damit die Auswahl nicht zu leicht ist.
 */
function choiceOptions(
  correct: string,
  song: Song,
  allSongs: Song[],
  rng: Rng,
  field: 'artist' | 'title' | 'song',
): string[] {
  const pick = (s: Song) => (field === 'artist' ? s.artist : field === 'title' ? s.title : songLabel(s));
  const same = shuffle(allSongs.filter((s) => s.category === song.category), rng).map(pick);
  const other = shuffle(allSongs.filter((s) => s.category !== song.category), rng).map(pick);
  const used = new Set([norm(correct)]);
  const wrong: string[] = [];
  for (const candidate of [...same, ...other]) {
    if (wrong.length >= 3) break;
    if (used.has(norm(candidate))) continue;
    used.add(norm(candidate));
    wrong.push(candidate);
  }
  return shuffle([correct, ...wrong], rng);
}

export function yearPoints(guess: number, actual: number): number {
  const diff = Math.abs(guess - actual);
  if (diff === 0) return 5;
  if (diff === 1) return 3;
  if (diff <= 3) return 2;
  if (diff <= 5) return 1;
  return 0;
}

export function slotIsCorrect(timeline: Song[], slot: number, year: number): boolean {
  const before = timeline[slot - 1];
  const after = timeline[slot];
  return (!before || before.year <= year) && (!after || after.year >= year);
}

export function insertSorted(timeline: Song[], song: Song): Song[] {
  const i = timeline.findIndex((s) => s.year > song.year);
  return i === -1 ? [...timeline, song] : [...timeline.slice(0, i), song, ...timeline.slice(i)];
}

export type AnswerMeta = {
  /** Wie viel vom Zeitlimit noch übrig war (0..1), für die Speed-Runde. */
  remainingFraction?: number;
  /** Stufe beim Sekunden-Poker (0 = 1 Sekunde). */
  pokerStage?: number;
};

export function answer(state: GameState, value: AnswerValue, meta: AnswerMeta = {}): GameState {
  const turn = state.turn;
  if (!turn || turn.questionIndex >= turn.questions.length) return state;
  const question = turn.questions[turn.questionIndex];
  const song = turn.song;
  const player = state.players[turn.playerIndex];
  const result = evaluate(question.type, song, player, value);

  if (result.correct) {
    if (state.mode.timeLimitSeconds && meta.remainingFraction !== undefined) {
      result.points = 1 + Math.round(4 * Math.max(0, Math.min(1, meta.remainingFraction)));
    } else if (state.mode.pokerStages && meta.pokerStage !== undefined) {
      result.points = Math.max(1, 5 - meta.pokerStage);
    }
  }

  const players = state.players.map((p, i) => {
    if (i !== turn.playerIndex) return p;
    const updated = { ...p, score: p.score + result.points };
    if (question.type === 'timeline' && result.correct) updated.timeline = insertSorted(p.timeline, song);
    if (state.mode.end.kind === 'survival' && !result.correct) updated.alive = false;
    return updated;
  });

  return {
    ...state,
    players,
    turn: { ...turn, questionIndex: turn.questionIndex + 1, results: [...turn.results, result] },
  };
}

function evaluate(type: QuestionType, song: Song, player: Player, value: AnswerValue): AnswerResult {
  const base = { type, points: 0, correct: false, given: 'Keine Antwort' };
  switch (type) {
    case 'timeline': {
      const solution = String(song.year);
      if (value.kind !== 'slot') return { ...base, solution };
      const correct = slotIsCorrect(player.timeline, value.value, song.year);
      return { type, correct, points: correct ? 1 : 0, solution, given: slotLabel(player.timeline, value.value) };
    }
    case 'year': {
      const solution = String(song.year);
      if (value.kind !== 'year') return { ...base, solution };
      const points = yearPoints(value.value, song.year);
      return { type, correct: points > 0, points, solution, given: String(value.value) };
    }
    case 'decade': {
      const solution = decadeLabel(song.year);
      if (value.kind !== 'choice') return { ...base, solution };
      const correct = value.value === solution;
      return { type, correct, points: correct ? 2 : 0, solution, given: value.value };
    }
    default: {
      const solution = type === 'artist' ? song.artist : type === 'title' ? song.title : songLabel(song);
      if (value.kind !== 'choice') return { ...base, solution };
      const correct = norm(value.value) === norm(solution);
      return { type, correct, points: correct ? 1 : 0, solution, given: value.value };
    }
  }
}

export function slotLabel(timeline: Song[], slot: number): string {
  const before = timeline[slot - 1];
  const after = timeline[slot];
  if (!before && after) return `vor ${after.year}`;
  if (before && !after) return `nach ${before.year}`;
  if (before && after) return `zwischen ${before.year} und ${after.year}`;
  return 'irgendwo';
}

/** Ob der aktuelle Spieler im Sudden-Death-Modus rausgeflogen ist und keine weiteren Fragen bekommt. */
export function turnIsDone(state: GameState): boolean {
  const turn = state.turn;
  if (!turn) return true;
  if (!state.players[turn.playerIndex].alive) return true;
  return turn.questionIndex >= turn.questions.length;
}

export function endTurn(state: GameState): GameState {
  const turn = state.turn;
  if (!turn) return state;
  const players = state.players.map((p, i) => (i === turn.playerIndex ? { ...p, turns: p.turns + 1 } : p));
  const next = { ...state, players, totalTurns: state.totalTurns + 1 };
  return { ...next, finished: isGameOver(next) };
}

export function isGameOver(state: GameState): boolean {
  const { end } = state.mode;
  if (state.pool.length === 0) return true;
  switch (end.kind) {
    case 'cards':
      return state.players.some((p) => p.timeline.length >= end.target);
    case 'rounds':
      return state.players.every((p) => p.turns >= end.rounds);
    case 'survival': {
      const alive = state.players.filter((p) => p.alive).length;
      return state.players.length > 1 ? alive <= 1 : alive === 0;
    }
  }
}

/** Spieler sortiert nach Platzierung. */
export function ranking(state: GameState): Player[] {
  const key = (p: Player) => {
    if (state.mode.end.kind === 'cards') return p.timeline.length * 1000 + p.score;
    if (state.mode.end.kind === 'survival') return (p.alive ? 1000 : 0) + p.score;
    return p.score;
  };
  return state.players.slice().sort((a, b) => key(b) - key(a));
}

export function winners(state: GameState): Player[] {
  const ranked = ranking(state);
  if (ranked.length === 0) return [];
  const top = ranked[0];
  const same = (p: Player) =>
    state.mode.end.kind === 'cards'
      ? p.timeline.length === top.timeline.length && p.score === top.score
      : state.mode.end.kind === 'survival'
        ? p.alive === top.alive && p.score === top.score
        : p.score === top.score;
  return ranked.filter(same);
}
