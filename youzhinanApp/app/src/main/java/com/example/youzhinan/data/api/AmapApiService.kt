package com.example.youzhinan.data.api

import com.example.youzhinan.data.api.NearbySearchResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * 高德地图 API 服务
 * 专门用于调用高德地图周边搜索等功能
 */
interface AmapApiService {

    /**
     * 周边搜索
     * @param latitude 纬度
     * @param longitude 经度
     * @param radius 半径（米）
     * @param keywords 搜索关键词
     */
    @GET("api/nearby/search")
    suspend fun searchNearby(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius") radius: Int = 300000,
        @Query("keywords") keywords: String? = null,
        @Query("page") page: Int = 1,
        @Query("pagesize") pagesize: Int = 20
    ): Response<ApiResponse<NearbySearchResponse>>

    /**
     * 一些后端实现将附近数据放在 `data.list` 下，提供兼容方法
     */
    @GET("api/nearby/search")
    suspend fun searchNearbyList(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius") radius: Int = 300000,
        @Query("keywords") keywords: String? = null,
        @Query("page") page: Int = 1,
        @Query("pagesize") pagesize: Int = 20
    ): Response<ApiResponse<NearbyListResponse>>
}
