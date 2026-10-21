export type QuestionType = 'timeline' | 'artist' | 'title' | 'year' | 'decade' | 'song';

export type ModeId =
  | 'klassik'
  | 'kuenstler'
  | 'titel'
  | 'jahr'
  | 'speed'
  | 'poker'
  | 'sudden'
  | 'party'
  | 'profi'
  | 'zettel'
  | 'intro'
  | 'blitz'
  | 'zeitstrahl-ko';

export type EndRule =
  | { kind: 'cards'; target: number }
  | { kind: 'rounds'; rounds: number }
  | { kind: 'survival' };

export type ModeDef = {
  id: ModeId;
  name: string;
  emoji: string;
  tagline: string;
  rules: string[];
  /** Fragen pro Zug, oder { random } für eine zufällige Frage pro Zug aus dieser Liste. */
  questions: QuestionType[] | { random: QuestionType[] };
  snippetSeconds: number;
  /** 'intro' startet den Song am Anfang, 'middle' irgendwo mittendrin. */
  startAt: 'intro' | 'middle';
  /** Zeitlimit pro Frage in Sekunden. */
  timeLimitSeconds?: number;
  /** Sekunden-Poker: Snippet wird schrittweise länger. */
  pokerStages?: number[];
  /** Wie oft man das Snippet nochmal hören darf. */
  replays: number;
  end: EndRule;
  colors: [string, string];
  /** Alle spielen gleichzeitig mit einem Song pro Runde, statt das Handy herumzureichen. */
  group?: boolean;
};

export const MODES: ModeDef[] = [
  {
    id: 'klassik',
    name: 'Klassik',
    emoji: '🗓️',
    tagline: 'Ordne Songs in deinen Zeitstrahl ein',
    rules: [
      'Jeder startet mit einer aufgedeckten Karte im Zeitstrahl.',
      'Hör den Song und tippe auf die Lücke, in die er zeitlich passt.',
      'Richtig eingeordnet? Die Karte bleibt bei dir.',
      'Wer zuerst die Zielzahl an Karten hat, gewinnt.',
    ],
    questions: ['timeline'],
    snippetSeconds: 20,
    startAt: 'middle',
    replays: 2,
    end: { kind: 'cards', target: 10 },
    colors: ['#FF4FD8', '#7A2BFF'],
  },
  {
    id: 'kuenstler',
    name: 'Künstler raten',
    emoji: '🧑‍🎤',
    tagline: 'Wer singt das?',
    rules: ['Hör den Song und wähle den richtigen Künstler aus vier Antworten.', 'Jede richtige Antwort gibt 1 Punkt.'],
    questions: ['artist'],
    snippetSeconds: 15,
    startAt: 'middle',
    replays: 1,
    end: { kind: 'rounds', rounds: 5 },
    colors: ['#00D1FF', '#7A5CFF'],
  },
  {
    id: 'titel',
    name: 'Titel raten',
    emoji: '🏷️',
    tagline: 'Wie heißt der Song?',
    rules: ['Hör den Song und wähle den richtigen Titel aus vier Antworten.', 'Jede richtige Antwort gibt 1 Punkt.'],
    questions: ['title'],
    snippetSeconds: 15,
    startAt: 'middle',
    replays: 1,
    end: { kind: 'rounds', rounds: 5 },
    colors: ['#00E5A0', '#008CFF'],
  },
  {
    id: 'jahr',
    name: 'Jahr schätzen',
    emoji: '📅',
    tagline: 'Aus welchem Jahr ist der Song?',
    rules: [
      'Schätze das Erscheinungsjahr.',
      'Genau richtig: 2 Punkte · 1 Jahr daneben: 1 Punkt.',
    ],
    questions: ['year'],
    snippetSeconds: 20,
    startAt: 'middle',
    replays: 1,
    end: { kind: 'rounds', rounds: 5 },
    colors: ['#FFD000', '#FF5E00'],
  },
  {
    id: 'speed',
    name: 'Speed-Runde',
    emoji: '⚡',
    tagline: 'Schnell sein lohnt sich',
    rules: [
      'Nur 8 Sekunden Musik und 12 Sekunden Zeit ab dem Start.',
      'Je schneller du richtig liegst, desto mehr Punkte (bis zu 5).',
    ],
    questions: ['song'],
    snippetSeconds: 8,
    startAt: 'middle',
    timeLimitSeconds: 12,
    replays: 0,
    end: { kind: 'rounds', rounds: 5 },
    colors: ['#FF8A00', '#FF2E63'],
  },
  {
    id: 'poker',
    name: 'Sekunden-Poker',
    emoji: '🃏',
    tagline: 'Wie wenig brauchst du?',
    rules: [
      'Der Song startet ganz am Anfang mit nur 1 Sekunde.',
      'Rate sofort für 5 Punkte oder hör länger: 2, 4, 8, 15 Sekunden.',
      'Jede Verlängerung kostet einen Punkt.',
    ],
    questions: ['song'],
    snippetSeconds: 1,
    startAt: 'intro',
    pokerStages: [1, 2, 4, 8, 15],
    replays: 0,
    end: { kind: 'rounds', rounds: 5 },
    colors: ['#B44CFF', '#FF6AA8'],
  },
  {
    id: 'sudden',
    name: 'Sudden Death',
    emoji: '💀',
    tagline: 'Ein Fehler und du bist raus',
    rules: [
      'Künstler oder Titel erraten, abwechselnd.',
      'Wer falsch liegt, scheidet aus.',
      'Der Letzte, der übrig bleibt, gewinnt.',
    ],
    questions: { random: ['artist', 'title'] },
    snippetSeconds: 12,
    startAt: 'middle',
    replays: 0,
    end: { kind: 'survival' },
    colors: ['#FF3B3B', '#2A0A3D'],
  },
  {
    id: 'party',
    name: 'Party-Mix',
    emoji: '🎉',
    tagline: 'Jede Runde eine Überraschung',
    rules: [
      'Jeder Zug bringt eine zufällige Frage: Künstler, Titel, Jahr oder Jahrzehnt.',
      'Punkte wie in den einzelnen Modi.',
    ],
    questions: { random: ['artist', 'title', 'year', 'decade'] },
    snippetSeconds: 15,
    startAt: 'middle',
    replays: 1,
    end: { kind: 'rounds', rounds: 6 },
    colors: ['#00F0FF', '#FF00C8'],
  },
  {
    id: 'profi',
    name: 'Hitster Profi',
    emoji: '🏆',
    tagline: 'Künstler, Titel und Jahr in einem Zug',
    rules: [
      'Pro Song beantwortest du drei Fragen hintereinander.',
      'Künstler und Titel geben je 1 Punkt, das Jahr bis zu 2 Punkte.',
    ],
    questions: ['artist', 'title', 'year'],
    snippetSeconds: 20,
    startAt: 'middle',
    replays: 2,
    end: { kind: 'rounds', rounds: 4 },
    colors: ['#FFCE00', '#FF4FD8'],
  },
  {
    id: 'zettel',
    name: 'Zettel-Runde',
    emoji: '📝',
    tagline: 'Alle raten gleichzeitig auf Papier',
    rules: [
      'Handy in die Mitte, ein Song läuft, alle schreiben Künstler, Titel und Jahr auf.',
      'Danach wird aufgelöst und es gibt Punkte.',
      'Vorschlag: Künstler 1, Titel 1, Jahr genau 2, ein Jahr daneben 1.',
    ],
    questions: [],
    snippetSeconds: 25,
    startAt: 'middle',
    replays: 2,
    end: { kind: 'rounds', rounds: 10 },
    colors: ['#2EE59D', '#00A3FF'],
    group: true,
  },
  {
    id: 'intro',
    name: 'Intro-Raten',
    emoji: '🎬',
    tagline: 'Erkennst du den Song am Anfang?',
    rules: ['Du hörst nur die ersten 5 Sekunden des Songs.', 'Welcher Song ist es? Richtig gibt 1 Punkt.'],
    questions: ['song'],
    snippetSeconds: 5,
    startAt: 'intro',
    replays: 1,
    end: { kind: 'rounds', rounds: 5 },
    colors: ['#00E5FF', '#00A36C'],
  },
  {
    id: 'blitz',
    name: 'Jahrzehnt-Blitz',
    emoji: '⏱️',
    tagline: 'Jahrzehnt raten gegen die Uhr',
    rules: ['10 Sekunden Musik und 10 Sekunden Zeit.', 'Aus welchem Jahrzehnt ist der Song? Je schneller, desto mehr Punkte.'],
    questions: ['decade'],
    snippetSeconds: 10,
    startAt: 'middle',
    timeLimitSeconds: 10,
    replays: 0,
    end: { kind: 'rounds', rounds: 8 },
    colors: ['#FF00C8', '#FFD000'],
  },
  {
    id: 'zeitstrahl-ko',
    name: 'Zeitstrahl-K.o.',
    emoji: '🥊',
    tagline: 'Ein Fehler im Zeitstrahl und du bist raus',
    rules: ['Ordne den Song in deinen Zeitstrahl ein.', 'Wer falsch einordnet, scheidet aus. Der Letzte gewinnt.'],
    questions: ['timeline'],
    snippetSeconds: 20,
    startAt: 'middle',
    replays: 1,
    end: { kind: 'survival' },
    colors: ['#2A0A3D', '#FF4FD8'],
  },

];

export function getMode(id: ModeId): ModeDef {
  const mode = MODES.find((m) => m.id === id);
  if (!mode) throw new Error(`Unbekannter Modus: ${id}`);
  return mode;
}
