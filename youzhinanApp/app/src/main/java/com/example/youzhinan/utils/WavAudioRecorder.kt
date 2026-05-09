package com.example.youzhinan.utils

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * WAV 格式音频录制器
 * 使用 AudioRecord 录制原始 PCM 数据并封装为 WAV 格式
 * 讯飞语音听写 API 支持 WAV 格式
 */
class WavAudioRecorder(private val context: Context) {
    companion object {
        private const val TAG = "WavAudioRecorder"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val BUFFER_SIZE = 1024 * 2
    }

    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var recordingThread: Thread? = null
    private var outputFile: File? = null
    private val pcmData = ByteArrayOutputStream()

    fun startRecording(): Boolean {
        return try {
            outputFile = File(context.externalCacheDir, "temp_recording_${System.currentTimeMillis()}.wav")
            
            val minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
            val bufferSize = maxOf(minBufferSize, BUFFER_SIZE)
            
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize
            )
            
            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord 初始化失败")
                return false
            }
            
            pcmData.reset()
            audioRecord?.startRecording()
            isRecording = true
            
            recordingThread = Thread {
                val buffer = ByteArray(bufferSize)
                while (isRecording) {
                    val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                    if (read > 0) {
                        pcmData.write(buffer, 0, read)
                    }
                }
            }
            recordingThread?.start()
            
            Log.d(TAG, "录音开始: ${outputFile?.absolutePath}")
            true
        } catch (e: Exception) {
            Log.e(TAG, "录音启动失败", e)
            false
        }
    }

    fun stopRecording(): File? {
        return try {
            isRecording = false
            recordingThread?.join(1000)
            
            audioRecord?.apply {
                stop()
                release()
            }
            audioRecord = null
            
            // 将 PCM 数据转换为 WAV 格式
            val wavFile = outputFile ?: return null
            val pcmBytes = pcmData.toByteArray()
            
            writeWavFile(wavFile, pcmBytes, SAMPLE_RATE, 1, 16)
            
            Log.d(TAG, "录音完成: ${wavFile.absolutePath}, 大小: ${wavFile.length()} bytes")
            wavFile
        } catch (e: Exception) {
            Log.e(TAG, "录音停止失败", e)
            null
        }
    }

    fun cancelRecording() {
        isRecording = false
        recordingThread?.join(1000)
        audioRecord?.apply {
            stop()
            release()
        }
        audioRecord = null
        outputFile?.delete()
        outputFile = null
    }

    private fun writeWavFile(
        file: File,
        pcmData: ByteArray,
        sampleRate: Int,
        channels: Int,
        bitsPerSample: Int
    ) {
        val byteRate = sampleRate * channels * bitsPerSample / 8
        val blockAlign = channels * bitsPerSample / 8
        val totalDataLen = pcmData.size + 36
        val audioDataLen = pcmData.size

        FileOutputStream(file).use { fos ->
            // RIFF chunk
            fos.write("RIFF".toByteArray())
            fos.write(intToByteArray(totalDataLen))
            fos.write("WAVE".toByteArray())

            // fmt chunk
            fos.write("fmt ".toByteArray())
            fos.write(intToByteArray(16)) // Subchunk1Size
            fos.write(shortToByteArray(1)) // AudioFormat (PCM)
            fos.write(shortToByteArray(channels.toShort()))
            fos.write(intToByteArray(sampleRate))
            fos.write(intToByteArray(byteRate))
            fos.write(shortToByteArray(blockAlign.toShort()))
            fos.write(shortToByteArray(bitsPerSample.toShort()))

            // data chunk
            fos.write("data".toByteArray())
            fos.write(intToByteArray(audioDataLen))
            fos.write(pcmData)
        }
    }

    private fun intToByteArray(value: Int): ByteArray {
        return ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(value).array()
    }

    private fun shortToByteArray(value: Short): ByteArray {
        return ByteBuffer.allocate(2).order(ByteOrder.LITTLE_ENDIAN).putShort(value).array()
    }
}
