package com.example.youzhinan.utils

import android.content.Context
import android.media.MediaPlayer
import android.util.Log
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject
import com.example.youzhinan.data.api.ApiConfig
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object XunfeiSpeechSynthesizer {
    private const val TAG = "XunfeiSpeechSynthesizer"

    // 复用 RetrofitClient 的带认证 OkHttpClient
    private val client: OkHttpClient
        get() = com.example.youzhinan.data.api.RetrofitClient.getAiChatApiService().let {
            // 通过 OkHttp 拦截器添加 Token 的方式，构建带认证的 client
            val token = com.example.youzhinan.data.api.RetrofitClient.getToken()
            OkHttpClient.Builder()
                .addInterceptor { chain ->
                    val request = chain.request().newBuilder()
                    if (!token.isNullOrEmpty()) {
                        request.header("Authorization", "Bearer $token")
                    }
                    chain.proceed(request.build())
                }
                .build()
        }

    private var mediaPlayer: MediaPlayer? = null

    suspend fun synthesizeAndPlay(context: Context, text: String): Unit {
        return withContext(Dispatchers.IO) {
            suspendCancellableCoroutine { continuation ->
                val scope = CoroutineScope(Dispatchers.IO + Job())
                scope.launch {
                    try {
                        val audioFile = downloadTtsAudio(text, context)
                        if (audioFile != null && audioFile.exists()) {
                            withContext(Dispatchers.Main) {
                                playAudioWithMediaPlayer(audioFile, continuation)
                            }
                        } else {
                            continuation.resumeWithException(IllegalStateException("语音合成失败"))
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "TTS 异常", e)
                        continuation.resumeWithException(e)
                    }
                }

                continuation.invokeOnCancellation {
                    stopPlayback()
                    scope.cancel()
                }
            }
        }
    }

    private suspend fun downloadTtsAudio(text: String, context: Context): File? {
        return withContext(Dispatchers.IO) {
            val jsonBody = JSONObject()
            jsonBody.put("text", text)
            jsonBody.put("voiceType", "xiaofeng")

            val requestBody = RequestBody.create(
                "application/json".toMediaType(),
                jsonBody.toString()
            )

            val request = Request.Builder()
                .url(ApiConfig.BASE_URL + "api/speech/tts")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string()
            Log.d(TAG, "TTS 响应: $body")

            if (response.isSuccessful && body != null) {
                val json = JSONObject(body)
                val code = json.optInt("code", -1)
                if (code == 200) {
                    val data = json.optJSONObject("data")
                    val url = data?.optString("url")
                    if (!url.isNullOrEmpty()) {
                        val audioFile = File(context.cacheDir, "tts_${System.currentTimeMillis()}.mp3")
                        downloadFile(url, audioFile)
                        return@withContext audioFile
                    } else {
                        throw IllegalStateException(json.optString("message", "语音合成失败"))
                    }
                } else {
                    throw IllegalStateException(json.optString("message", "语音合成失败"))
                }
            } else {
                throw IllegalStateException("TTS 服务请求失败: HTTP ${response.code}")
            }
        }
    }

    private suspend fun downloadFile(url: String, destFile: File) {
        val request = Request.Builder().url(url).build()
        val response = client.newCall(request).execute()
        if (response.isSuccessful) {
            response.body?.byteStream()?.use { input ->
                destFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        } else {
            throw IllegalStateException("音频文件下载失败: HTTP ${response.code}")
        }
    }

    /**
     * 使用 MediaPlayer 播放 MP3 文件（替代之前错误的 AudioTrack PCM 播放方式）
     */
    private fun playAudioWithMediaPlayer(
        audioFile: File,
        continuation: kotlinx.coroutines.CancellableContinuation<Unit>
    ) {
        try {
            val mp = MediaPlayer()
            mediaPlayer = mp
            mp.setDataSource(audioFile.absolutePath)
            mp.setOnCompletionListener {
                mp.release()
                mediaPlayer = null
                audioFile.delete()
                if (continuation.isActive) {
                    continuation.resume(Unit)
                }
            }
            mp.setOnErrorListener { _, what, extra ->
                Log.e(TAG, "MediaPlayer 错误: what=$what, extra=$extra")
                mp.release()
                mediaPlayer = null
                audioFile.delete()
                if (continuation.isActive) {
                    continuation.resumeWithException(IllegalStateException("音频播放失败"))
                }
                true
            }
            mp.prepare()
            mp.start()
        } catch (e: Exception) {
            Log.e(TAG, "MediaPlayer 初始化失败", e)
            audioFile.delete()
            if (continuation.isActive) {
                continuation.resumeWithException(e)
            }
        }
    }

    /**
     * 停止当前播放
     */
    fun stopPlayback() {
        try {
            mediaPlayer?.apply {
                if (isPlaying) {
                    stop()
                }
                release()
            }
            mediaPlayer = null
        } catch (e: Exception) {
            Log.e(TAG, "停止播放失败", e)
            mediaPlayer = null
        }
    }
}
