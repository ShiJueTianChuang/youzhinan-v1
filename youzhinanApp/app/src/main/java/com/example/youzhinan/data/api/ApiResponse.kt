package com.example.youzhinan.data.api

data class ApiResponse<T>(
    val code: Int = 0,
    val message: String? = null,
    val data: T? = null
) {
    val isSuccess: Boolean get() = code == 0 || code == 200

    fun getErrorMsg(): String = message?.takeIf { it.isNotBlank() } ?: "操作失败"
}
