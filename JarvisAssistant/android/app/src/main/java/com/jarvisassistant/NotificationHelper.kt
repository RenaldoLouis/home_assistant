package com.jarvisassistant

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.service.notification.NotificationListenerService
import android.util.Log
import com.lesimoes.androidnotificationlistener.RNAndroidNotificationListener

object NotificationHelper {
    private const val TAG = "NotificationHelper"

    /**
     * Rebinds the notification listener service using the component-toggle trick.
     * Toggling DISABLED -> ENABLED forces Android's NotificationManagerService to
     * tear down any stale/dead binder connection and establish a fresh live binding.
     */
    fun rebindListener(context: Context): Boolean {
        return try {
            val componentName = ComponentName(context, RNAndroidNotificationListener::class.java)
            val pm = context.packageManager

            // Step 1: Force Android NotificationManagerService to reset stale connection
            pm.setComponentEnabledSetting(
                componentName,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP
            )
            pm.setComponentEnabledSetting(
                componentName,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP
            )

            // Step 2: Request explicit rebind
            NotificationListenerService.requestRebind(componentName)
            Log.i(TAG, "Successfully triggered notification listener component-toggle and rebind")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to rebind notification listener", e)
            false
        }
    }
}
