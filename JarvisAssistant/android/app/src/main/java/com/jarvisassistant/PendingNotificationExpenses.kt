package com.jarvisassistant

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

/** Durable scrubbed captures only; app-private and excluded from Android backups. */
class PendingNotificationExpenses(context: Context) : SQLiteOpenHelper(
    context,
    File(context.noBackupFilesDir, "notification-expenses.db").absolutePath,
    null,
    1
) {
    private val executor = Executors.newSingleThreadExecutor()
    private val allowedFields = setOf(
        "id", "userId", "ledgerId", "amount", "merchant", "category", "bank", "type",
        "date", "dateSource", "sourceApp", "sourceTitle", "notificationTime"
    )

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE pending (user_id TEXT NOT NULL, expense_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (user_id, expense_id))")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        throw IllegalStateException("Unsupported notification queue version")
    }

    fun enqueue(userId: String, expenseId: String, payload: String, promise: Promise) = run(promise) {
        require(payload.length <= 32768)
        val expense = JSONObject(payload)
        require(expense.keys().asSequence().all { it in allowedFields })
        require(expense.getString("userId") == userId)
        require(expense.getString("ledgerId") == userId)
        require(expense.getString("id") == expenseId)
        writableDatabase.execSQL(
            "INSERT OR IGNORE INTO pending (user_id, expense_id, payload) VALUES (?, ?, ?)",
            arrayOf(userId, expenseId, payload)
        )
        true
    }

    fun list(userId: String, promise: Promise) = run(promise) {
        val result = Arguments.createArray()
        readableDatabase.rawQuery(
            "SELECT payload FROM pending WHERE user_id = ? ORDER BY rowid",
            arrayOf(userId)
        ).use { cursor ->
            while (cursor.moveToNext()) result.pushString(cursor.getString(0))
        }
        result
    }

    fun remove(userId: String, expenseId: String, promise: Promise) = run(promise) {
        writableDatabase.execSQL(
            "DELETE FROM pending WHERE user_id = ? AND expense_id = ?",
            arrayOf(userId, expenseId)
        )
        true
    }

    private fun run(promise: Promise, action: () -> Any?) {
        executor.execute {
            try {
                promise.resolve(action())
            } catch (_: Exception) {
                // Never include notification or financial fields in bridge errors.
                promise.reject("NOTIFICATION_QUEUE_FAILED", "Unable to access pending notification expenses")
            }
        }
    }

    fun shutdown() {
        executor.execute { close() }
        executor.shutdown()
    }
}
