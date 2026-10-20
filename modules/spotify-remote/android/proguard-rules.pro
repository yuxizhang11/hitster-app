# Spotify App-Remote-SDK: Protokoll-Typen werden per Gson/Reflection gelesen, also nicht umbenennen oder entfernen.
-keep class com.spotify.protocol.** { *; }
-keep class com.spotify.android.appremote.** { *; }
# Optionale Abhängigkeiten des SDK, die wir nicht mitliefern.
-dontwarn com.fasterxml.jackson.**
-dontwarn com.spotify.base.annotations.**
