const { withProjectBuildGradle } = require('expo/config-plugins');

/** Macht das lokale Maven-Repo mit dem Spotify-SDK für alle Gradle-Projekte sichtbar (auch für die App selbst). */
module.exports = function withSpotifyRemote(config) {
  return withProjectBuildGradle(config, (c) => {
    const line = 'maven { url "$rootDir/../modules/spotify-remote/android/libs/maven" }';
    if (!c.modResults.contents.includes(line)) {
      c.modResults.contents = c.modResults.contents.replace(/allprojects\s*\{\s*repositories\s*\{/, (m) => `${m}\n    ${line}`);
    }
    return c;
  });
};
