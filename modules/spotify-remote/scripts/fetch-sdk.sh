#!/usr/bin/env bash
# Lädt Spotifys App-Remote-SDK (AAR) aus github.com/spotify/android-sdk und legt es als lokales Maven-Repo ab,
# damit Gradle es wie eine normale Abhängigkeit auflöst. Läuft im Build vor `expo prebuild`.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$DIR/android/libs/maven/com/spotify/android/app-remote-local/1.0.0"
# Neueste 2.x-Version der Auth-Bibliothek von Maven Central nehmen (Fallback 2.1.0), damit die API passt.
AUTH_VERSION="$(curl -fsSL https://repo1.maven.org/maven2/com/spotify/android/auth/maven-metadata.xml 2>/dev/null | sed -n 's:.*<version>\(2\.[0-9.]*\)</version>.*:\1:p' | sort -V | tail -1 || true)"
mkdir -p "$DIR/android/libs"
echo "${AUTH_VERSION:-2.1.0}" > "$DIR/android/libs/auth-version.txt"
echo "Spotify Auth ${AUTH_VERSION:-2.1.0}"
if [ -f "$DEST/app-remote-local-1.0.0.aar" ]; then echo "Spotify SDK schon da"; exit 0; fi
TMP="$(mktemp -d)"
git clone --depth 1 https://github.com/spotify/android-sdk "$TMP/sdk"
AAR="$(find "$TMP/sdk" -name 'spotify-app-remote*.aar' | sort | tail -1)"
if [ -z "$AAR" ]; then echo "Kein App-Remote-AAR gefunden" >&2; find "$TMP/sdk" -name '*.aar' >&2; exit 1; fi
echo "Nehme $AAR"
mkdir -p "$DEST"
cp "$AAR" "$DEST/app-remote-local-1.0.0.aar"
cat > "$DEST/app-remote-local-1.0.0.pom" <<POM
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.spotify.android</groupId>
  <artifactId>app-remote-local</artifactId>
  <version>1.0.0</version>
  <packaging>aar</packaging>
</project>
POM
rm -rf "$TMP"
