package com.example.youzhinan.data.api

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.example.youzhinan.BuildConfig
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.ResponseBody.Companion.toResponseBody
import okhttp3.logging.HttpLoggingInterceptor
import com.google.gson.GsonBuilder
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiConfig {
    const val BASE_URL = "https://your-domain.com/"
    const val AMAP_PROXY_URL = "https://your-server-ip:3005/"

    const val CONNECT_TIMEOUT = 10L
    const val READ_TIMEOUT = 15L
    const val WRITE_TIMEOUT = 15L

    const val AI_CONNECT_TIMEOUT = 15L
    const val AI_READ_TIMEOUT = 120L
    const val AI_WRITE_TIMEOUT = 60L

    fun getFullImageUrl(imageUrl: String?): String? {
        if (imageUrl.isNullOrBlank()) return null
        return if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
            imageUrl
        } else {
            val normalizedUrl = if (imageUrl.startsWith("/")) imageUrl else "/$imageUrl"
            BASE_URL.removeSuffix("/") + normalizedUrl
        }
    }

    fun getThumbnailUrl(imageUrl: String?, size: String = "small"): String? {
        val fullUrl = getFullImageUrl(imageUrl) ?: return null
        return if (fullUrl.contains("/uploads/")) {
            "$fullUrl?size=$size"
        } else {
            fullUrl
        }
    }
}

object RetrofitClient {

    private var apiService: ApiService? = null
    private var aiChatApiService: AiChatApi? = null
    private var appVersionApiService: AppVersionApi? = null
    private var context: Context? = null

    @Volatile
    private var onUnauthorizedCallback: (() -> Unit)? = null

    private val mainHandler = Handler(Looper.getMainLooper())

    private val PUBLIC_PATHS = setOf(
        "/login", "/register", "/send-code", "/email-auth",
        "/sms/send-code", "/sms/login", "/sms/register",
        "/api/lottery/status", "/api/lottery/prizes"
    )

    fun setUnauthorizedCallback(callback: (() -> Unit)?) {
        onUnauthorizedCallback = callback
    }

    fun init(appContext: Context) {
        context = appContext.applicationContext
    }

    private fun getPreferences(): SharedPreferences {
        return context?.getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
            ?: throw IllegalStateException("RetrofitClient 未初始化，请在 Application.onCreate() 中调用 init()")
    }

    fun getToken(): String? {
        return try {
            if (context != null) getPreferences().getString("token", null) else null
        } catch (e: Exception) {
            Log.e("RetrofitClient", "获取 Token 失败", e)
            null
        }
    }

    fun saveToken(token: String) {
        if (context != null) {
            getPreferences().edit().putString("token", token).apply()
        }
    }

    fun clearToken() {
        if (context != null) {
            getPreferences().edit().remove("token").apply()
        }
    }

    fun getApiService(): ApiService {
        return apiService ?: createApiService()
    }

    fun getAiChatApiService(): AiChatApi {
        return aiChatApiService ?: createAiChatApiService()
    }

    fun getAppVersionApiService(): AppVersionApi {
        return appVersionApiService ?: createAppVersionApiService()
    }

    private fun isPublicPath(url: HttpUrl): Boolean {
        val path = url.encodedPath.trimEnd('/')
        return PUBLIC_PATHS.any { publicPath ->
            path.equals(publicPath) || path.startsWith("$publicPath/")
        }
    }

    private fun createLoggingInterceptor(): HttpLoggingInterceptor {
        return HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
    }

    private fun createAuthInterceptor(alwaysAttachToken: Boolean = false): okhttp3.Interceptor {
        return okhttp3.Interceptor { chain ->
            val original = chain.request()
            val token = getToken()
            val url = original.url

            if (BuildConfig.DEBUG) {
                val tag = if (alwaysAttachToken) "AI" else "API"
                Log.d("RetrofitClient", "$tag 请求 URL: $url, Token: ${if (token.isNullOrEmpty()) "NULL" else "存在"}")
            }

            val requestBuilder = original.newBuilder()

            // 对于 multipart 请求，不手动设置 Content-Type，让 OkHttp 自动添加带 boundary 的正确 header
            if (original.header("Content-Type") == null && original.body?.contentType()?.type != "multipart") {
                requestBuilder.header("Content-Type", "application/json")
            }

            // 添加 Authorization header
            // alwaysAttachToken=true 时总是附加，否则仅对非公开路径附加
            if (!token.isNullOrEmpty() && (alwaysAttachToken || !isPublicPath(url))) {
                requestBuilder.header("Authorization", "Bearer $token")
                if (BuildConfig.DEBUG) {
                    Log.d("RetrofitClient", "已附加 Authorization header")
                }
            }

            val request = requestBuilder.build()
            val response = chain.proceed(request)

            // 对于图片上传等特定接口，不因为 401/403 清除 token
            // 因为这些接口可能不需要认证或者认证是可选的
            val isOptionalAuth = url.encodedPath.contains("/images/upload") ||
                                 url.encodedPath.contains("/speech/") ||
                                 url.encodedPath.contains("/ai/")

            if ((response.code == 401 || response.code == 403) && !isOptionalAuth) {
                val errorBodyStr = response.body?.string()
                if (BuildConfig.DEBUG) {
                    val tag = if (alwaysAttachToken) "AI" else "API"
                    Log.w("RetrofitClient", "$tag 认证错误：url=$url, code=${response.code}, body=$errorBodyStr")
                }

                clearToken()
                onUnauthorizedCallback?.let { cb ->
                    mainHandler.post { cb() }
                }

                val mediaType = "application/json".toMediaType()
                val newBody = errorBodyStr?.toByteArray()?.toResponseBody(mediaType)
                response.newBuilder().body(newBody).build()
            } else {
                response
            }
        }
    }

    private fun buildOkHttpClient(
        connectTimeout: Long,
        readTimeout: Long,
        writeTimeout: Long,
        alwaysAttachToken: Boolean = false
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(connectTimeout, TimeUnit.SECONDS)
            .readTimeout(readTimeout, TimeUnit.SECONDS)
            .writeTimeout(writeTimeout, TimeUnit.SECONDS)
            .addInterceptor(createLoggingInterceptor())
            .addInterceptor(createAuthInterceptor(alwaysAttachToken))
            .build()
    }

    private fun buildRetrofit(client: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(ApiConfig.BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(GsonBuilder().setLenient().create()))
            .build()
    }

    private fun createApiService(): ApiService {
        synchronized(this) {
            if (apiService != null) return apiService!!
            val client = buildOkHttpClient(
                connectTimeout = ApiConfig.CONNECT_TIMEOUT,
                readTimeout = ApiConfig.READ_TIMEOUT,
                writeTimeout = ApiConfig.WRITE_TIMEOUT
            )
            apiService = buildRetrofit(client).create(ApiService::class.java)
            return apiService!!
        }
    }

    private fun createAiChatApiService(): AiChatApi {
        synchronized(this) {
            if (aiChatApiService != null) return aiChatApiService!!
            val client = buildOkHttpClient(
                connectTimeout = ApiConfig.AI_CONNECT_TIMEOUT,
                readTimeout = ApiConfig.AI_READ_TIMEOUT,
                writeTimeout = ApiConfig.AI_WRITE_TIMEOUT,
                alwaysAttachToken = true
            )
            aiChatApiService = buildRetrofit(client).create(AiChatApi::class.java)
            return aiChatApiService!!
        }
    }

    private fun createAppVersionApiService(): AppVersionApi {
        synchronized(this) {
            if (appVersionApiService != null) return appVersionApiService!!
            val client = buildOkHttpClient(
                connectTimeout = ApiConfig.CONNECT_TIMEOUT,
                readTimeout = ApiConfig.READ_TIMEOUT,
                writeTimeout = ApiConfig.WRITE_TIMEOUT
            )
            appVersionApiService = buildRetrofit(client).create(AppVersionApi::class.java)
            return appVersionApiService!!
        }
    }
}
