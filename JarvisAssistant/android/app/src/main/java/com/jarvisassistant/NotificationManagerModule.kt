package com.jarvisassistant

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationManagerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NotificationManagerModule"

    @ReactMethod
    fun rebindListener(promise: Promise) {
        val success = NotificationHelper.rebindListener(reactContext)
        if (success) {
            promise.resolve(true)
        } else {
            promise.reject("REBIND_FAILED", "Failed to rebind notification listener")
        }
    }
}
