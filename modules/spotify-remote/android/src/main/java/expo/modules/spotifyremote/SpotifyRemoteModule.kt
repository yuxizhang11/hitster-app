package expo.modules.spotifyremote

import com.spotify.android.appremote.api.ConnectionParams
import com.spotify.android.appremote.api.Connector
import com.spotify.android.appremote.api.SpotifyAppRemote
import com.spotify.sdk.android.auth.AuthorizationClient
import com.spotify.sdk.android.auth.AuthorizationRequest
import com.spotify.sdk.android.auth.AuthorizationResponse
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Steuert die Spotify-App auf demselben Handy über Spotifys App-Remote-SDK.
 * Anders als die Web-API weckt das SDK die Spotify-App auf, auch wenn sie im Hintergrund schläft.
 */
private const val AUTH_REQUEST_CODE = 0x5107

class SpotifyRemoteModule : Module() {
  private var remote: SpotifyAppRemote? = null
  private var authPromise: Promise? = null

  private val context
    get() = appContext.currentActivity ?: appContext.reactContext ?: throw CodedException("NO_CONTEXT", "Keine Android-Activity verfügbar.", null)

  private fun fail(promise: Promise, t: Throwable) {
    // Klassenname als Code, z. B. CouldNotFindSpotifyApp, UserNotAuthorizedException, AuthenticationFailedException.
    promise.reject(t.javaClass.simpleName, t.message ?: t.javaClass.simpleName, t)
  }

  private fun connected(promise: Promise): SpotifyAppRemote? {
    val r = remote
    if (r == null || !r.isConnected) {
      promise.reject("NotConnected", "Nicht mit der Spotify-App verbunden.", null)
      return null
    }
    return r
  }

  override fun definition() = ModuleDefinition {
    Name("SpotifyRemote")

    Function("isSpotifyInstalled") {
      SpotifyAppRemote.isSpotifyInstalled(context)
    }

    Function("isConnected") {
      remote?.isConnected == true
    }

    // Holt die Erlaubnis „app-remote-control“ im Vordergrund über die Spotify-App. Das SDK selbst kann den
    // Erlaubnis-Dialog aus dem Hintergrund nicht öffnen (neuere Android-Versionen blockieren das), dann hängt connect.
    AsyncFunction("authorize") { clientId: String, redirectUri: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "Keine Android-Activity verfügbar.", null)
        return@AsyncFunction
      }
      authPromise?.reject("Cancelled", "Neue Anfrage gestartet.", null)
      authPromise = promise
      val request = AuthorizationRequest.Builder(clientId, AuthorizationResponse.Type.TOKEN, redirectUri)
        .setScopes(arrayOf("app-remote-control"))
        .build()
      AuthorizationClient.openLoginActivity(activity, AUTH_REQUEST_CODE, request)
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != AUTH_REQUEST_CODE) return@OnActivityResult
      val promise = authPromise ?: return@OnActivityResult
      authPromise = null
      val response = AuthorizationClient.getResponse(payload.resultCode, payload.data)
      when (response.type) {
        AuthorizationResponse.Type.TOKEN -> promise.resolve(null)
        AuthorizationResponse.Type.ERROR -> promise.reject("AuthorizationError", response.error ?: "Spotify-Erlaubnis fehlgeschlagen", null)
        else -> promise.reject("AuthorizationCancelled", "Spotify-Erlaubnis abgebrochen (${response.type}).", null)
      }
    }

    AsyncFunction("connect") { clientId: String, redirectUri: String, promise: Promise ->
      if (remote?.isConnected == true) {
        promise.resolve(null)
        return@AsyncFunction
      }
      val params = ConnectionParams.Builder(clientId)
        .setRedirectUri(redirectUri)
        .showAuthView(false)
        .build()
      SpotifyAppRemote.connect(context, params, object : Connector.ConnectionListener {
        override fun onConnected(appRemote: SpotifyAppRemote) {
          remote = appRemote
          promise.resolve(null)
        }

        override fun onFailure(error: Throwable) {
          remote = null
          fail(promise, error)
        }
      })
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") { uri: String, positionMs: Double, promise: Promise ->
      val r = connected(promise) ?: return@AsyncFunction
      r.playerApi.play(uri)
        .setResultCallback {
          if (positionMs > 0) {
            r.playerApi.seekTo(positionMs.toLong())
              .setResultCallback { promise.resolve(null) }
              .setErrorCallback { promise.resolve(null) }
          } else {
            promise.resolve(null)
          }
        }
        .setErrorCallback { fail(promise, it) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("seekTo") { positionMs: Double, promise: Promise ->
      val r = connected(promise) ?: return@AsyncFunction
      r.playerApi.seekTo(positionMs.toLong())
        .setResultCallback { promise.resolve(null) }
        .setErrorCallback { fail(promise, it) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") { promise: Promise ->
      val r = remote
      if (r == null || !r.isConnected) {
        promise.resolve(null)
        return@AsyncFunction
      }
      r.playerApi.pause()
        .setResultCallback { promise.resolve(null) }
        .setErrorCallback { promise.resolve(null) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getPlayerState") { promise: Promise ->
      val r = connected(promise) ?: return@AsyncFunction
      r.playerApi.playerState
        .setResultCallback { state ->
          promise.resolve(
            mapOf(
              "isPaused" to state.isPaused,
              "uri" to state.track?.uri,
              "positionMs" to state.playbackPosition.toDouble(),
            ),
          )
        }
        .setErrorCallback { fail(promise, it) }
    }.runOnQueue(Queues.MAIN)

    Function("disconnect") {
      remote?.let { SpotifyAppRemote.disconnect(it) }
      remote = null
    }

    OnDestroy {
      remote?.let { SpotifyAppRemote.disconnect(it) }
      remote = null
    }
  }
}
