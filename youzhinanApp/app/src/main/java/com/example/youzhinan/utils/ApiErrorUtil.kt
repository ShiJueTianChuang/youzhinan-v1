package com.example.youzhinan.utils

import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

object ApiErrorUtil {

    fun fromResponse(response: Response<*>, fallback: String): String {
        if (response.isSuccessful) return fallback
        val body = response.errorBody()?.string() ?: return fallback
        return parseMessage(body)?.takeIf { it.isNotBlank() } ?: fallback
    }

    fun fromException(e: Exception, fallback: String): String {
        if (e is HttpException) {
            val body = e.response()?.errorBody()?.string()
            if (body != null) {
                parseMessage(body)?.takeIf { it.isNotBlank() }?.let { return it }
            }
        }
        return classifyException(e) ?: e.message?.takeIf { it.isNotBlank() } ?: fallback
    }

    fun classifyException(e: Exception): String? {
        return when (e) {
            is UnknownHostException -> "无法连接服务器，请检查网络"
            is SocketTimeoutException -> "连接超时，请稍后重试"
            is ConnectException -> "服务器连接失败"
            is SSLException -> "安全连接失败"
            is IOException -> "网络异常，请检查网络连接"
            else -> null
        }
    }

    private fun parseMessage(errorBody: String): String? {
        return try {
            org.json.JSONObject(errorBody).optString("message", "").takeIf { it.isNotBlank() }
                ?: org.json.JSONObject(errorBody).optString("msg", "").takeIf { it.isNotBlank() }
        } catch (_: Exception) {
            null
        }
    }
}
