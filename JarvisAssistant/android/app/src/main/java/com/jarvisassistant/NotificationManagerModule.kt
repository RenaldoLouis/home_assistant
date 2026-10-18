package com.jarvisassistant

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationManagerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NotificationManagerModule"

    private val notificationQueue = lazy { PendingNotificationExpenses(reactContext) }

    @ReactMethod
    fun enqueueNotificationExpense(userId: String, expenseId: String, payload: String, promise: Promise) {
        notificationQueue.value.enqueue(userId, expenseId, payload, promise)
    }

    @ReactMethod
    fun getPendingNotificationExpenses(userId: String, promise: Promise) {
        notificationQueue.value.list(userId, promise)
    }

    @ReactMethod
    fun removePendingNotificationExpense(userId: String, expenseId: String, promise: Promise) {
        notificationQueue.value.remove(userId, expenseId, promise)
    }

    override fun invalidate() {
        if (notificationQueue.isInitialized()) notificationQueue.value.shutdown()
        super.invalidate()
    }

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
