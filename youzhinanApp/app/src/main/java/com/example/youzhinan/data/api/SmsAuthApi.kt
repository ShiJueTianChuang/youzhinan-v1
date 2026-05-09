package com.example.youzhinan.data.api

import com.google.gson.annotations.SerializedName

/**
 * 手机号验证码认证相关数据类
 */

/**
 * 发送短信验证码请求
 */
data class SmsCodeRequest(
    @SerializedName("phone") val phone: String,
    @SerializedName("type") val type: String  // "register", "login" 或 "reset_password"
)

/**
 * 手机号验证码注册请求
 */
data class SmsRegisterRequest(
    @SerializedName("phone") val phone: String,
    @SerializedName("code") val code: String,
    @SerializedName("password") val password: String,
    @SerializedName("agreementAccepted") val agreementAccepted: Boolean = false,
    @SerializedName("invite_code") val inviteCode: String? = null
)

/**
 * 手机号验证码登录请求
 */
data class SmsLoginRequest(
    @SerializedName("phone") val phone: String,
    @SerializedName("code") val code: String,
    @SerializedName("agreementAccepted") val agreementAccepted: Boolean = false,
    @SerializedName("invite_code") val inviteCode: String? = null
)

/**
 * 手机号重置密码请求
 */
data class SmsResetPasswordRequest(
    @SerializedName("phone") val phone: String,
    @SerializedName("code") val code: String,
    @SerializedName("newPassword") val newPassword: String
)
