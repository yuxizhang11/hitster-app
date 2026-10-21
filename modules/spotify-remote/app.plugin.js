const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

/** Macht das lokale Maven-Repo mit dem Spotify-SDK für alle Gradle-Projekte sichtbar (auch für die App selbst). */
module.exports = function withSpotifyRemote(config) {
  // Die Spotify-Auth-Bibliothek verlangt diese Platzhalter. Ihr Browser-Rückweg bekommt ein eigenes Schema, damit er
  // nicht mit dem normalen Spotify-Login (hitster://spotify-auth) kollidiert. Mit installierter Spotify-App kommt das
  // Ergebnis ohnehin direkt zurück.
  config = withAppBuildGradle(config, (c) => {
    const marker = 'redirectSchemeName';
    if (!c.modResults.contents.includes(marker)) {
      c.modResults.contents = c.modResults.contents.replace(
        /defaultConfig\s*\{/,
        (m) => `${m}\n        manifestPlaceholders.putAll([redirectSchemeName: "hitster-spotify-sdk", redirectHostName: "callback", redirectPathPattern: ".*"])`,
      );
    }
    return c;
  });
  return withProjectBuildGradle(config, (c) => {
    const line = 'maven { url "$rootDir/../modules/spotify-remote/android/libs/maven" }';
    if (!c.modResults.contents.includes(line)) {
      c.modResults.contents = c.modResults.contents.replace(/allprojects\s*\{\s*repositories\s*\{/, (m) => `${m}\n    ${line}`);
    }
    return c;
  });
};
