# Hitster – Musik-Ratespiel fürs Handy

Ein Hitster-artiges Partyspiel für iPhone und Android (Expo / React Native). Ein Handy wird herumgereicht, man tippt auf
den Plattenteller, eine Animation startet und ein Song-Ausschnitt läuft (über Spotify oder als 30-Sekunden-Vorschau).

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
| 📝 Zettel-Runde | Alle raten gleichzeitig auf Papier, Punkte zählt ihr selbst oder tippt sie in der App an |

Kategorien: Pop-Hits, K-Pop, 80er, 90er, 2000er, 2010er, 2020er, Deutsch, Rock-Klassiker, plus eigene Spotify-Playlists.
Jede Kategorie hat rund 200 Songs. In der App unter **Songlisten** lassen sich Songs ansehen, ausblenden und eigene
hinzufügen. Die Listen selbst stehen in `src/data/songs.ts`.

## Starten

```bash
npm install
npx expo start
```

Dann den QR-Code mit der **Expo Go**-App scannen. Ohne Spotify spielt die App 30-Sekunden-Ausschnitte (iTunes, sonst
Deezer), dafür braucht es nur Internet.

## APK zum Testen (Android)

Unter [Releases](https://github.com/yuxizhang11/hitster-app/releases) liegt die neueste APK. Auf dem Handy herunterladen,
öffnen und „Installation aus unbekannten Quellen“ erlauben. Eine neue Release entsteht unter **Actions → Android APK →
Run workflow** (Version wie `v0.2.0` eingeben) oder automatisch, sobald ein Tag wie `v0.2.0` gepusht wird. Jeder Pull Request baut die APK ebenfalls,
sie hängt dann als Artefakt am Actions-Lauf.

Die App sucht beim Start nach einer neuen Release und zeigt dann ein Popup mit den Neuerungen und „Jetzt aktualisieren“.
Im Hintergrund sieht sie etwa alle 3 Stunden nach und meldet eine neue Version einmal per Benachrichtigung; Tippen öffnet
**Updates**. Nach einem Update zeigt sie einmal, was neu ist. Dafür muss das Repo öffentlich sein.

So entsteht eine neue Version:
1. In `RELEASE_NOTES.txt` oben einen Abschnitt `0.8.0 – Datum` mit Punkten `- …` ergänzen, dann `npm run notes`.
2. Die Version in `app.json` anheben (beim Bauen kommt sie ohnehin aus dem Release-Tag).
3. Unter **Actions → Android APK → Run workflow** `v0.8.0` eingeben. Der Release-Text kommt aus `RELEASE_NOTES.txt`.

## Musik

Ohne Spotify spielt die App selbst einen 30-Sekunden-Ausschnitt jedes Songs (iTunes Search API, sonst Deezer).
Mit Spotify-Verbindung läuft der ganze Song über die Spotify-App; startet Spotify nicht nachweislich, fällt die App
automatisch auf den Ausschnitt zurück. Unter **Musik** lässt sich auch „Nur Ausschnitte“ einstellen.

## Spotify einrichten (optional, einmalig)

Spotify erlaubt das Abspielen über fremde Apps nur mit **Premium**. Die Musik läuft über die Spotify-App auf dem Handy.

1. Auf <https://developer.spotify.com/dashboard> eine App anlegen, „Web API“ und „Android“ ankreuzen.
   Unter „Android packages“ den Paketnamen `com.yuxizhang.hitster` und den SHA1-Fingerabdruck
   `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` eintragen (Debug-Schlüssel, mit dem die APK signiert ist).
   Damit steuert die Android-App die Spotify-App direkt über Spotifys App-Remote-SDK.
2. Als Redirect-URI die Adresse eintragen, die in der App unter **Musik** angezeigt wird
   (in der APK `hitster://spotify-auth`, in Expo Go etwas wie `exp://192.168.x.x:8081/--/spotify-auth`).
3. Unter „User Management“ die Spotify-E-Mail aller Personen eintragen, die sich einloggen sollen
   (Apps im Entwicklungsmodus sind auf wenige Nutzer beschränkt).
4. Die Client-ID in der App unter **Musik** einfügen (oder als `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` in `.env`) und verbinden.
5. In der App „Wiedergabe testen“ drücken. Beim ersten Mal fragt Spotify einmal nach Erlaubnis.

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
- `modules/spotify-remote/` natives Modul für Spotifys App-Remote-SDK (Android). Das SDK selbst lädt
  `modules/spotify-remote/scripts/fetch-sdk.sh` beim Bauen aus github.com/spotify/android-sdk.
- `src/audio/` 30-Sekunden-Ausschnitte (Suche bei iTunes/Deezer, Wiedergabe mit expo-audio)
- `src/components/` Plattenteller-Animation, Antwort-Buttons, Karten
