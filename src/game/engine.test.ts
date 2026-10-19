import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Song } from '../data/types';
import type { ModeDef } from './modes';
import {
  answer, createGame, decadeLabel, endGroupRound, endTurn, givePoints, insertSorted, slotIsCorrect, startGroupRound, startTurn,
  turnIsDone, winners, yearPoints,
} from './engine.ts';

let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const songs: Song[] = Array.from({ length: 30 }, (_, i) => ({
  id: `s${i}`, title: `Song ${i}`, artist: `Artist ${i % 12}`, year: 1970 + i * 2, category: i % 2 ? 'a' : 'b',
}));

const base: Omit<ModeDef, 'id' | 'questions' | 'end'> = {
  name: 'x', emoji: '', tagline: '', rules: [], snippetSeconds: 10, startAt: 'middle', replays: 0, colors: ['#000', '#000'],
};

test('yearPoints', () => {
  assert.equal(yearPoints(2000, 2000), 5);
  assert.equal(yearPoints(2001, 2000), 3);
  assert.equal(yearPoints(1997, 2000), 2);
  assert.equal(yearPoints(2005, 2000), 1);
  assert.equal(yearPoints(2010, 2000), 0);
});

test('decadeLabel', () => {
  assert.equal(decadeLabel(1987), '80er');
  assert.equal(decadeLabel(2003), '2000er');
  assert.equal(decadeLabel(2024), '2020er');
});

test('timeline slots', () => {
  const tl = [songs[0], songs[5], songs[10]]; // 1970, 1980, 1990
  assert.ok(slotIsCorrect(tl, 0, 1965));
  assert.ok(slotIsCorrect(tl, 1, 1975));
  assert.ok(slotIsCorrect(tl, 1, 1980)); // Gleichstand zählt
  assert.ok(!slotIsCorrect(tl, 3, 1975));
  assert.deepEqual(insertSorted(tl, songs[7]).map((s) => s.year), [1970, 1980, 1984, 1990]);
});

test('klassik: Startkarte, richtig einordnen, Sieg bei Zielzahl', () => {
  const mode = { ...base, id: 'klassik', questions: ['timeline'], end: { kind: 'cards', target: 3 } } as ModeDef;
  let g = createGame(mode, ['A', 'B'], songs, {}, rng);
  assert.equal(g.players[0].timeline.length, 1);
  assert.equal(g.pool.length, 28);
  for (let i = 0; i < 4 && !g.finished; i++) {
    g = startTurn(g, rng);
    const p = g.players[g.turn!.playerIndex];
    const slot = p.timeline.findIndex((s) => s.year > g.turn!.song.year);
    g = answer(g, { kind: 'slot', value: slot === -1 ? p.timeline.length : slot });
    assert.ok(g.turn!.results[0].correct);
    g = endTurn(g);
  }
  assert.ok(g.finished);
  assert.equal(winners(g)[0].timeline.length, 3);
});

test('multiple choice: 4 eindeutige Optionen inkl. richtiger', () => {
  const mode = { ...base, id: 'kuenstler', questions: ['artist'], end: { kind: 'rounds', rounds: 1 } } as ModeDef;
  let g = startTurn(createGame(mode, ['A'], songs, {}, rng), rng);
  const q = g.turn!.questions[0];
  assert.equal(q.options!.length, 4);
  assert.equal(new Set(q.options).size, 4);
  assert.ok(q.options!.includes(g.turn!.song.artist));
  g = endTurn(answer(g, { kind: 'choice', value: g.turn!.song.artist }));
  assert.equal(g.players[0].score, 1);
  assert.ok(g.finished);
});

test('sudden death: falsche Antwort scheidet aus, letzter gewinnt', () => {
  const mode = { ...base, id: 'sudden', questions: { random: ['title'] }, end: { kind: 'survival' } } as ModeDef;
  let g = startTurn(createGame(mode, ['A', 'B', 'C'], songs, {}, rng), rng);
  g = answer(g, { kind: 'choice', value: 'falsch' });
  assert.ok(turnIsDone(g));
  g = startTurn(endTurn(g), rng);
  assert.equal(g.turn!.playerIndex, 1);
  g = endTurn(answer(g, { kind: 'timeout' }));
  assert.ok(g.finished);
  assert.equal(winners(g)[0].name, 'C');
});

test('speed und poker Punkte', () => {
  const speed = { ...base, id: 'speed', questions: ['song'], timeLimitSeconds: 10, end: { kind: 'rounds', rounds: 1 } } as ModeDef;
  let g = startTurn(createGame(speed, ['A'], songs, {}, rng), rng);
  g = answer(g, { kind: 'choice', value: `${g.turn!.song.title} – ${g.turn!.song.artist}` }, { remainingFraction: 1 });
  assert.equal(g.players[0].score, 5);
  const poker = { ...base, id: 'poker', questions: ['song'], pokerStages: [1, 2, 4], end: { kind: 'rounds', rounds: 1 } } as ModeDef;
  g = startTurn(createGame(poker, ['A'], songs, {}, rng), rng);
  g = answer(g, { kind: 'choice', value: `${g.turn!.song.title} – ${g.turn!.song.artist}` }, { pokerStage: 2 });
  assert.equal(g.players[0].score, 3);
});

test('Zettel-Runde: feste Songanzahl, Punkte per Hand', () => {
  const mode: ModeDef = { ...base, id: 'zettel', questions: [], end: { kind: 'rounds', rounds: 10 }, group: true };
  let g = createGame(mode, ['A', 'B', 'C'], songs, { target: 3, scoring: 'app' }, rng);
  assert.equal(g.scoring, 'app');
  const seen = new Set<string>();
  for (let r = 0; r < 3; r++) {
    assert.ok(!g.finished);
    g = startGroupRound(g);
    assert.ok(g.turn && !seen.has(g.turn.song.id));
    seen.add(g.turn!.song.id);
    if (r === 0) g = givePoints(givePoints(g, 1, 1), 1, 1);
    if (r === 1) g = givePoints(g, 2, 1);
    g = endGroupRound(g);
  }
  assert.ok(g.finished);
  assert.deepEqual(g.players.map((p) => p.score), [0, 2, 1]);
  assert.equal(givePoints(g, 0, -1).players[0].score, 0);
  assert.deepEqual(winners(g).map((p) => p.name), ['B']);
  assert.equal(createGame(mode, ['A'], songs, {}, rng).scoring, 'app');
});
