package com.jarvisassistant

import android.app.Application
import android.content.ComponentName
import android.service.notification.NotificationListenerService
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.lesimoes.androidnotificationlistener.RNAndroidNotificationListener

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(SpeechRecognizerPackage())
          add(TtsPackage())
          add(LiveAudioPackage())
          add(NotificationManagerPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    NotificationHelper.rebindListener(this)
  }
}
