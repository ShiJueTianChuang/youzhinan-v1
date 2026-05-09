package com.example.youzhinan.data.api

import com.google.gson.annotations.SerializedName

/**
 * 邮箱验证码登录相关数据类
 */

/**
 * 发送验证码请求
 */
data class SendVerificationCodeRequest(
    @SerializedName("email") val email: String
)

/**
 * 邮箱验证码登录请求
 */
data class EmailLoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("code") val code: String
)

/**
 * 发送验证码响应
 */
data class SendVerificationCodeResponse(
    @SerializedName("message") val message: String? = null,
    @SerializedName("expires_in") val expiresIn: Int? = null  // 验证码有效期（秒）
)
