// Die Neuerungen stehen in RELEASE_NOTES.txt; nach einer Änderung dort `npm run notes` ausführen.
import { parseReleaseNotes, ReleaseNote } from './notesParser';
import { RELEASE_NOTES_TEXT } from './releaseNotes.generated';

export type { ReleaseNote };

export const RELEASE_NOTES = parseReleaseNotes(RELEASE_NOTES_TEXT);

export function notesFor(version: string): ReleaseNote | undefined {
  return RELEASE_NOTES.find((n) => n.version === version.replace(/^v/, ''));
}
