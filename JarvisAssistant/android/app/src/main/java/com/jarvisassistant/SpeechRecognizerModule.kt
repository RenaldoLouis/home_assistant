package com.jarvisassistant

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SpeechRecognizerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    private val handler = Handler(Looper.getMainLooper())

    override fun getName(): String {
        return "SpeechRecognizerModule"
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun startListening(promise: Promise) {
        if (isListening) {
            promise.resolve(null)
            return
        }
        handler.post {
            try {
                if (speechRecognizer == null) {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactApplicationContext)
                    speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                        override fun onReadyForSpeech(params: Bundle?) {}
                        override fun onBeginningOfSpeech() {
                            isListening = true
                            sendEvent("onSpeechStart", Arguments.createMap())
                        }
                        override fun onRmsChanged(rmsdB: Float) {}
                        override fun onBufferReceived(buffer: ByteArray?) {}
                        override fun onEndOfSpeech() {
                            isListening = false
                            sendEvent("onSpeechEnd", Arguments.createMap())
                        }
                        override fun onError(error: Int) {
                            isListening = false
                            val params = Arguments.createMap()
                            params.putInt("error", error)
                            sendEvent("onSpeechError", params)
                        }
                        override fun onResults(results: Bundle?) {
                            isListening = false
                            val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            if (matches != null && matches.isNotEmpty()) {
                                val params = Arguments.createMap()
                                val array = Arguments.createArray()
                                matches.forEach { array.pushString(it) }
                                params.putArray("value", array)
                                sendEvent("onSpeechResults", params)
                            }
                        }
                        override fun onPartialResults(partialResults: Bundle?) {}
                        override fun onEvent(eventType: Int, params: Bundle?) {}
                    })
                }

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
                }
                
                speechRecognizer?.startListening(intent)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("Error", e)
            }
        }
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        handler.post {
            try {
                speechRecognizer?.stopListening()
                isListening = false
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("Error", e)
            }
        }
    }
    
    @ReactMethod
    fun destroy() {
        handler.post {
            speechRecognizer?.destroy()
            speechRecognizer = null
        }
    }
    
    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN built-in Event Emitter Calls
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built-in Event Emitter Calls
    }
}
