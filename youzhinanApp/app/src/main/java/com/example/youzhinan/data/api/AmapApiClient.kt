package com.example.youzhinan.data.api

import android.util.Log
import com.example.youzhinan.BuildConfig
import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * 高德地图 API 客户端
 * 专门用于调用高德地图 API（通过代理服务器）
 */
object AmapApiClient {
    
    private var amapApiService: AmapApiService? = null
    
    /**
     * 获取 AmapApiService 实例
     */
    fun getApiService(): AmapApiService {
        return amapApiService ?: createApiService()
    }
    
    /**
     * 创建 AmapApiService 实例
     */
    private fun createApiService(): AmapApiService {
        synchronized(this) {
            if (amapApiService != null) {
                return amapApiService!!
            }
            
            // 创建日志拦截器（仅在 DEBUG 下打印 BODY，避免生产环境泄露敏感位置信息）
            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG) {
                    HttpLoggingInterceptor.Level.BODY
                } else {
                    HttpLoggingInterceptor.Level.NONE
                }
            }
            
            // 创建 OkHttpClient
            val okHttpClient = OkHttpClient.Builder()
                .connectTimeout(ApiConfig.CONNECT_TIMEOUT, TimeUnit.SECONDS)
                .readTimeout(ApiConfig.READ_TIMEOUT, TimeUnit.SECONDS)
                .writeTimeout(ApiConfig.WRITE_TIMEOUT, TimeUnit.SECONDS)
                .addInterceptor(loggingInterceptor)
                .build()
            
            // 创建 Retrofit
            val retrofit = Retrofit.Builder()
                .baseUrl(ApiConfig.AMAP_PROXY_URL)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create(GsonBuilder().setLenient().create()))
                .build()
            
            // 创建 AmapApiService
            amapApiService = retrofit.create(AmapApiService::class.java)
            
            if (BuildConfig.DEBUG) {
                Log.d("AmapApiClient", "初始化完成，baseUrl: ${ApiConfig.AMAP_PROXY_URL}")
            }
            
            return amapApiService!!
        }
    }
}
