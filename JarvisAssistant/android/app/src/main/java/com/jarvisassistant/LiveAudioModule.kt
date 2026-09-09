package com.jarvisassistant

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.atomic.AtomicBoolean

class LiveAudioModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "LiveAudioModule"
        private const val SAMPLE_RATE_IN = 16000 // Gemini Live expects 16kHz PCM
        private const val SAMPLE_RATE_OUT = 24000 // Gemini Live outputs 24kHz PCM
        private const val CHUNK_SIZE_IN = 2048 // 1024 samples @ 16-bit = 64ms chunk
    }

    private val isRecording = AtomicBoolean(false)
    private var recordingThread: Thread? = null
    private var audioRecord: AudioRecord? = null
    private var audioTrack: AudioTrack? = null

    override fun getName(): String {
        return "LiveAudioModule"
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactApplicationContext.hasActiveReactInstance()) {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    @Synchronized
    private fun initAudioTrack() {
        if (audioTrack != null) return

        try {
            val minBufferSize = AudioTrack.getMinBufferSize(
                SAMPLE_RATE_OUT,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )
            val bufferSize = maxOf(minBufferSize, 8192)

            audioTrack = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANT)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(SAMPLE_RATE_OUT)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(bufferSize)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()

            audioTrack?.play()
            Log.d(TAG, "AudioTrack initialized and playing")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize AudioTrack", e)
        }
    }

    @ReactMethod
    fun startRecording(promise: Promise) {
        if (isRecording.get()) {
            promise.resolve(true)
            return
        }

        try {
            val minBufferSize = AudioRecord.getMinBufferSize(
                SAMPLE_RATE_IN,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )
            val bufferSize = maxOf(minBufferSize, CHUNK_SIZE_IN * 2)

            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE_IN,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                promise.reject("INIT_FAILED", "Failed to initialize AudioRecord")
                return
            }

            audioRecord?.startRecording()
            isRecording.set(true)

            recordingThread = Thread({
                val buffer = ByteArray(CHUNK_SIZE_IN)
                while (isRecording.get()) {
                    val readBytes = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                    if (readBytes > 0) {
                        val base64Data = Base64.encodeToString(buffer, 0, readBytes, Base64.NO_WRAP)
                        val params = Arguments.createMap()
                        params.putString("data", base64Data)
                        sendEvent("onAudioChunk", params)
                    }
                }
            }, "LiveAudioRecordingThread")

            recordingThread?.start()
            Log.d(TAG, "Audio recording started")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting recording", e)
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        try {
            isRecording.set(false)
            recordingThread?.join(500)
            recordingThread = null

            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null

            Log.d(TAG, "Audio recording stopped")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording", e)
            promise.reject("ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun playAudioChunk(base64Data: String) {
        try {
            if (audioTrack == null || audioTrack?.state != AudioTrack.STATE_INITIALIZED) {
                initAudioTrack()
            }

            val pcmBytes = Base64.decode(base64Data, Base64.DEFAULT)
            audioTrack?.write(pcmBytes, 0, pcmBytes.size)
        } catch (e: Exception) {
            Log.e(TAG, "Error playing audio chunk", e)
        }
    }

    @ReactMethod
    fun stopAudioPlayback() {
        try {
            // Immediately flush any queued audio chunks for instant interruption/barge-in
            audioTrack?.pause()
            audioTrack?.flush()
            audioTrack?.play()
            Log.d(TAG, "Audio playback flushed and stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping audio playback", e)
        }
    }

    @ReactMethod
    fun release() {
        try {
            isRecording.set(false)
            recordingThread?.join(500)
            recordingThread = null

            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null

            audioTrack?.stop()
            audioTrack?.release()
            audioTrack = null
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing audio resources", e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN NativeEventEmitter
    }
}
