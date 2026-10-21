import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalize, pickBest } from './match.ts';

test('normalize entfernt Zusätze und Akzente', () => {
  assert.equal(normalize('Mr. Brightside (Remastered 2019)'), 'mr brightside');
  assert.equal(normalize('Beyoncé'), 'beyonce');
  assert.equal(normalize('Song 2 - 2012 Remaster'), 'song 2');
});

test('pickBest nimmt den passenden Künstler statt einer Coverversion', () => {
  const best = pickBest(
    [
      { title: 'Mr. Brightside', artist: 'Karaoke Hits Band', url: 'a' },
      { title: 'Mr. Brightside', artist: 'The Killers', url: 'b' },
    ],
    'Mr. Brightside',
    'The Killers',
  );
  assert.equal(best?.url, 'b');
});

test('pickBest kommt mit feat. und fehlenden Treffern klar', () => {
  assert.equal(pickBest([{ title: 'Despacito', artist: 'Luis Fonsi', url: 'x' }], 'Despacito', 'Luis Fonsi feat. Daddy Yankee')?.url, 'x');
  assert.equal(pickBest([{ title: 'Other', artist: 'Someone', url: 'x' }], 'Despacito', 'Luis Fonsi'), null);
  assert.equal(pickBest([{ title: 'Despacito', artist: 'Cover Band', url: 'x' }], 'Despacito', 'Luis Fonsi'), null);
});
