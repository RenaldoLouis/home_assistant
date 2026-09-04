package com.jarvisassistant

import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.*
import java.util.Locale

class TtsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private val handler = Handler(Looper.getMainLooper())
    private val initPromises = mutableListOf<Promise>()

    init {
        handler.post {
            tts = TextToSpeech(reactContext, this)
        }
    }

    override fun getName(): String {
        return "TtsModule"
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isInitialized = true
            initPromises.forEach { it.resolve("SUCCESS") }
            initPromises.clear()
        } else {
            initPromises.forEach { it.reject("ERROR", "Initialization failed") }
            initPromises.clear()
        }
    }

    @ReactMethod
    fun getInitStatus(promise: Promise) {
        if (isInitialized) {
            promise.resolve("SUCCESS")
        } else {
            initPromises.add(promise)
        }
    }

    @ReactMethod
    fun setDefaultLanguage(language: String, promise: Promise) {
        if (!isInitialized || tts == null) {
            promise.reject("ERROR", "TTS not initialized")
            return
        }
        val locale = Locale.forLanguageTag(language.replace("_", "-"))
        val result = tts!!.setLanguage(locale)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            promise.reject("ERROR", "Language not supported")
        } else {
            promise.resolve("SUCCESS")
        }
    }

    @ReactMethod
    fun setDefaultRate(rate: Float, promise: Promise) {
        if (!isInitialized || tts == null) {
            promise.reject("ERROR", "TTS not initialized")
            return
        }
        tts!!.setSpeechRate(rate)
        promise.resolve("SUCCESS")
    }

    @ReactMethod
    fun speak(text: String, promise: Promise) {
        if (!isInitialized || tts == null) {
            promise.reject("ERROR", "TTS not initialized")
            return
        }
        val utteranceId = hashCode().toString() + ""
        tts!!.speak(text, TextToSpeech.QUEUE_ADD, null, utteranceId)
        promise.resolve("SUCCESS")
    }
}
