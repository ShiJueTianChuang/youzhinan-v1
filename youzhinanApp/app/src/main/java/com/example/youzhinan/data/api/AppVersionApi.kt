package com.example.youzhinan.data.api

import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * 版本信息相关 API 接口
 */
interface AppVersionApi {

    /**
     * 检查更新
     * GET /api/app-version/check
     */
    @GET("api/app-version/check")
    suspend fun checkUpdate(
        @Query("versionCode") versionCode: Int
    ): Response<ApiResponse<CheckUpdateResponse>>
}

/**
 * 检查更新响应
 */
data class CheckUpdateResponse(
    val hasUpdate: Boolean,
    val versionCode: Int?,
    val versionName: String?,
    val downloadUrl: String?,
    val updateDescription: String?,
    val forceUpdate: Boolean?,
    val fileSize: Long?,
    val md5: String?
)
