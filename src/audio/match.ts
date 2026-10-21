/** Ein Treffer aus einer Vorschau-Suche (Deezer oder iTunes). */
export type PreviewCandidate = { title: string; artist: string; url: string };

/** Kleinschreibung, ohne Akzente, Klammerzusätze und Satzzeichen. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\s+-\s+.*$/, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function overlaps(a: string, b: string) {
  return !!a && !!b && (a.includes(b) || b.includes(a));
}

/** Wählt den Treffer, der am besten zu Titel und Künstler passt, oder null, wenn keiner passt. */
export function pickBest(candidates: PreviewCandidate[], title: string, artist: string): PreviewCandidate | null {
  const t = normalize(title);
  // Bei „A feat. B“ oder „A & B“ reicht der erste Name.
  const a = normalize(artist.split(/\s+(?:feat\.?|ft\.?|featuring|x|&|,)\s+/i)[0]);
  let best: PreviewCandidate | null = null;
  let bestScore = -Infinity;
  for (const c of candidates) {
    if (!c.url) continue;
    const ct = normalize(c.title);
    const ca = normalize(c.artist);
    const artistOk = overlaps(ca, a);
    const titleOk = overlaps(ct, t);
    // Beides muss passen, sonst läuft ein anderer Song oder eine Coverversion.
    if (!artistOk || !titleOk) continue;
    const score = 2 + (ct === t ? 1 : 0) + (ca === a ? 1 : 0) - (/\b(live|karaoke|remix|cover|instrumental)\b/.test(ct) ? 2 : 0);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
