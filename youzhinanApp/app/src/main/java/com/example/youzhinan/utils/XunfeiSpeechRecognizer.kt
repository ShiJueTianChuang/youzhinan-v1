package com.example.youzhinan.utils

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import com.example.youzhinan.data.api.RetrofitClient

/**
 * 讯飞语音识别器
 * 使用 WAV 格式录制，兼容讯飞语音听写 API
 */
object XunfeiSpeechRecognizer {
    private const val TAG = "XunfeiSpeechRecognizer"
    private var wavRecorder: WavAudioRecorder? = null

    interface RecognitionCallback {
        fun onSuccess(text: String)
        fun onError(error: String)
        fun onRecordingStarted()
        fun onRecordingStopped()
    }

    suspend fun startRecording(context: Context, callback: RecognitionCallback) {
        withContext(Dispatchers.IO) {
            try {
                wavRecorder = WavAudioRecorder(context)
                val success = wavRecorder?.startRecording() ?: false
                
                if (success) {
                    withContext(Dispatchers.Main) {
                        callback.onRecordingStarted()
                    }
                    Log.d(TAG, "录音开始")
                } else {
                    withContext(Dispatchers.Main) {
                        callback.onError("录音启动失败")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "录音启动失败", e)
                withContext(Dispatchers.Main) {
                    callback.onError("录音启动失败: ${e.message}")
                }
            }
        }
    }

    suspend fun stopRecordingAndRecognize(callback: RecognitionCallback) {
        withContext(Dispatchers.IO) {
            try {
                val file = wavRecorder?.stopRecording()
                
                withContext(Dispatchers.Main) {
                    callback.onRecordingStopped()
                }

                if (file == null || !file.exists()) {
                    throw Exception("录音文件不存在")
                }

                Log.d(TAG, "录音文件大小: ${file.length()} bytes")

                // 使用 WAV 格式上传
                val requestFile = file.asRequestBody("audio/wav".toMediaTypeOrNull())
                val body = MultipartBody.Part.createFormData("audio", file.name, requestFile)

                val token = RetrofitClient.getToken()
                val apiService = RetrofitClient.getApiService()

                Log.d(TAG, "调用ASR接口...")
                val response = if (token != null) {
                    apiService.speechToText("Bearer $token", body)
                } else {
                    throw Exception("未登录，无法使用语音识别")
                }

                Log.d(TAG, "ASR响应: $response")

                if (response.code == 200 && response.data != null) {
                    withContext(Dispatchers.Main) {
                        callback.onSuccess(response.data.text)
                    }
                } else {
                    withContext(Dispatchers.Main) {
                        callback.onError(response.message ?: "识别失败")
                    }
                }

                file.delete()
            } catch (e: Exception) {
                Log.e(TAG, "识别失败", e)
                withContext(Dispatchers.Main) {
                    callback.onError("识别失败: ${e.message}")
                }
            }
        }
    }

    fun cancelRecording() {
        wavRecorder?.cancelRecording()
        wavRecorder = null
    }
}
