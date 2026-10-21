import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { RELEASE_NOTES_TEXT } from './releaseNotes.generated.ts';
import { parseReleaseNotes } from './notesParser.ts';

test('eingebettete Neuerungen entsprechen RELEASE_NOTES.txt (sonst npm run notes)', () => {
  assert.equal(RELEASE_NOTES_TEXT, readFileSync(new URL('../../RELEASE_NOTES.txt', import.meta.url), 'utf8'));
});

test('liest Versionen mit ihren Punkten, neueste zuerst', () => {
  const notes = parseReleaseNotes('Kopf\n- kein Punkt\n\n1.2.0 – 2.1.2026\n- A\n- B\n\n1.1 – 1.1.2026\n- C\n');
  assert.deepEqual(notes, [
    { version: '1.2.0', date: '2.1.2026', items: ['A', 'B'] },
    { version: '1.1', date: '1.1.2026', items: ['C'] },
  ]);
});
