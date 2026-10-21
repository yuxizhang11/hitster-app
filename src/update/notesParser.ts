export type ReleaseNote = { version: string; date: string; items: string[] };

/** Liest „0.7.0 – 21.10.2026“ mit den Punkten darunter, neueste Version zuerst. */
export function parseReleaseNotes(text: string): ReleaseNote[] {
  const notes: ReleaseNote[] = [];
  for (const line of text.split('\n')) {
    const head = line.match(/^(\d+\.\d+(?:\.\d+)?)\s+[–-]\s+(.+)$/);
    if (head) notes.push({ version: head[1], date: head[2].trim(), items: [] });
    else if (line.startsWith('- ') && notes.length) notes[notes.length - 1].items.push(line.slice(2).trim());
  }
  return notes;
}
