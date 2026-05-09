package com.example.youzhinan.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST
import com.google.gson.annotations.SerializedName

/**
 * 修改密码相关数据类
 */

/**
 * 修改密码请求
 * 后端 api/app/change-password 要求 oldPassword、newPassword（camelCase）
 */
data class ChangePasswordRequest(
    @SerializedName("oldPassword") val oldPassword: String,
    @SerializedName("newPassword") val newPassword: String
)

/**
 * 修改密码响应
 */
data class ChangePasswordResponse(
    @SerializedName("message") val message: String? = null
)
