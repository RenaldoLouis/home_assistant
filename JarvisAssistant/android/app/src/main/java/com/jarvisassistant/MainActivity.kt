package com.jarvisassistant

import android.content.ComponentName
import android.service.notification.NotificationListenerService
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.lesimoes.androidnotificationlistener.RNAndroidNotificationListener

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "JarvisAssistant"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onResume() {
    super.onResume()
    try {
      NotificationListenerService.requestRebind(
        ComponentName(this, RNAndroidNotificationListener::class.java)
      )
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Failed to requestRebind", e)
    }
  }
}
