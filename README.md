# Hitster – Musik-Ratespiel fürs Handy

Ein Hitster-artiges Partyspiel für iPhone und Android (Expo / React Native). Ein Handy wird herumgereicht, man tippt auf
den Plattenteller, eine Animation startet und ein Song-Ausschnitt läuft über Spotify.

## Spielmodi

| Modus | Worum es geht |
| --- | --- |
| 🗓️ Klassik | Songs zeitlich in den eigenen Zeitstrahl einordnen, wer zuerst 10 Karten hat, gewinnt |
| 🧑‍🎤 Künstler raten | Wer singt das? (4 Antworten) |
| 🏷️ Titel raten | Wie heißt der Song? (4 Antworten) |
| 📅 Jahr schätzen | Bis zu 5 Punkte, je näher, desto mehr |
| ⚡ Speed-Runde | 8 s Musik, 12 s Zeit, schnelle Antworten bringen mehr Punkte |
| 🃏 Sekunden-Poker | Song startet mit 1 s, jede Verlängerung (2/4/8/15 s) kostet einen Punkt |
| 💀 Sudden Death | Ein Fehler und du bist raus |
| 🎉 Party-Mix | Jeder Zug eine zufällige Frage (Künstler, Titel, Jahr, Jahrzehnt) |
| 🏆 Hitster Profi | Künstler, Titel und Jahr in einem Zug |

Kategorien: Pop-Hits, K-Pop, 80er, 90er, 2000er, 2010er, 2020er, Deutsch, Rock-Klassiker, plus eigene Spotify-Playlists.
Die Songlisten stehen in `src/data/songs.ts` und lassen sich leicht erweitern.

## Starten

```bash
npm install
npx expo start
```

Dann den QR-Code mit der **Expo Go**-App scannen. Ohne Spotify läuft ein stummer Demo-Modus, so kann man alles schon
durchklicken.

## APK zum Testen (Android)

Unter [Releases](https://github.com/yuxizhang11/hitster-app/releases) liegt die neueste APK. Auf dem Handy herunterladen,
öffnen und „Installation aus unbekannten Quellen“ erlauben. Eine neue Release entsteht automatisch, sobald ein Tag wie
`v0.2.0` gepusht wird (GitHub Actions, `.github/workflows/android-apk.yml`). Jeder Pull Request baut die APK ebenfalls,
sie hängt dann als Artefakt am Actions-Lauf.

## Spotify einrichten (einmalig)

Spotify erlaubt das Abspielen über fremde Apps nur mit **Premium**. Die Musik läuft über die Spotify-App auf dem Handy.

1. Auf <https://developer.spotify.com/dashboard> eine App anlegen, „Web API“ ankreuzen.
2. Als Redirect-URI die Adresse eintragen, die in der App unter **Spotify** angezeigt wird
   (in der APK `hitster://spotify-auth`, in Expo Go etwas wie `exp://192.168.x.x:8081/--/spotify-auth`).
3. Unter „User Management“ die Spotify-E-Mail aller Personen eintragen, die sich einloggen sollen
   (Apps im Entwicklungsmodus sind auf wenige Nutzer beschränkt).
4. Die Client-ID in der App unter **Spotify** einfügen (oder als `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` in `.env`) und verbinden.
5. Vor dem Spielen kurz die Spotify-App öffnen, damit das Handy als Abspielgerät erkannt wird.

Hinweis: Die Expo-Go-Adresse ändert sich mit der IP im WLAN. Für eine feste Adresse einen eigenen Build machen
(`npx eas-cli@latest build --profile development`), dann gilt `hitster://spotify-auth`.

## Entwicklung

```bash
npm test           # Spiellogik-Tests
npm run typecheck  # TypeScript
```

- `src/app/` Screens (Expo Router)
- `src/game/` Spiellogik und Modi, ohne UI, getestet
- `src/spotify/` Login (PKCE), Suche und Wiedergabe
- `src/components/` Plattenteller-Animation, Antwort-Buttons, Karten
