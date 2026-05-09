package com.example.youzhinan.utils

import android.os.Handler
import android.os.HandlerThread
import android.view.Choreographer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object FrameRateMonitor {

    private const val SAMPLE_INTERVAL_MS = 500L
    private const val NANOS_PER_SECOND = 1_000_000_000L
    private const val NANOS_PER_MS = 1_000_000L

    private var isMonitoring = false
    private var lastFrameTimeNanos: Long = 0
    private var frameCount = 0
    private val _fpsState = MutableStateFlow(0f)
    val fpsState: StateFlow<Float> = _fpsState.asStateFlow()

    private val _frameTimeState = MutableStateFlow(0L)
    val frameTimeState: StateFlow<Long> = _frameTimeState.asStateFlow()

    private val _jankCountState = MutableStateFlow(0)
    val jankCountState: StateFlow<Int> = _jankCountState.asStateFlow()

    private var jankCount = 0
    private const val JANK_THRESHOLD_NS = 33_000_000L

    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (!isMonitoring) return

            if (lastFrameTimeNanos != 0L) {
                val frameDuration = frameTimeNanos - lastFrameTimeNanos
                _frameTimeState.value = frameDuration / NANOS_PER_MS

                if (frameDuration > JANK_THRESHOLD_NS) {
                    jankCount++
                    _jankCountState.value = jankCount
                }

                frameCount++
            }
            lastFrameTimeNanos = frameTimeNanos

            Choreographer.getInstance().postFrameCallback(this)
        }
    }

    private var handlerThread = HandlerThread("FrameRateMonitor").apply { start() }
    private var handler = Handler(handlerThread.looper)

    private val fpsRunnable = object : Runnable {
        override fun run() {
            if (isMonitoring) {
                val fps = (frameCount * 1000f) / SAMPLE_INTERVAL_MS
                _fpsState.value = fps
                frameCount = 0
                if (handlerThread.isAlive) {
                    handler.postDelayed(this, SAMPLE_INTERVAL_MS)
                }
            }
        }
    }

    fun startMonitoring() {
        if (isMonitoring) return
        if (!handlerThread.isAlive) {
            handlerThread = HandlerThread("FrameRateMonitor").apply { start() }
            handler = Handler(handlerThread.looper)
        }
        isMonitoring = true
        frameCount = 0
        jankCount = 0
        lastFrameTimeNanos = 0
        Choreographer.getInstance().postFrameCallback(frameCallback)
        handler.post(fpsRunnable)
    }

    fun stopMonitoring() {
        isMonitoring = false
        Choreographer.getInstance().removeFrameCallback(frameCallback)
        handler.removeCallbacks(fpsRunnable)
        handlerThread.quitSafely()
    }

    fun reset() {
        frameCount = 0
        jankCount = 0
        _jankCountState.value = 0
        _fpsState.value = 0f
        _frameTimeState.value = 0L
    }
}
