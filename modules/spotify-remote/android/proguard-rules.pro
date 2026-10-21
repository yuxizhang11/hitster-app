# Spotify App-Remote-SDK: Protokoll-Typen werden per Gson/Reflection gelesen, also nicht umbenennen oder entfernen.
-keep class com.spotify.protocol.** { *; }
-keep class com.spotify.android.appremote.** { *; }
-keep class com.spotify.sdk.android.auth.** { *; }
# Optionale Abhängigkeiten des SDK, die wir nicht mitliefern.
-dontwarn com.fasterxml.jackson.**
-dontwarn com.spotify.base.annotations.**
