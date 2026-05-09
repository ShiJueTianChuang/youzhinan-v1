package com.example.youzhinan.ui.pages

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.youzhinan.data.api.*
import com.example.youzhinan.utils.ApiErrorUtil
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

class ProfileViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val context: Context = application.applicationContext
    
    private val apiService: ApiService = RetrofitClient.getApiService()
    
    private val prefs: SharedPreferences = context.getSharedPreferences("UserInfo", Context.MODE_PRIVATE)
    
    // UI 状态
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState
    
    init {
        // 初始化时检查登录状态
        checkLoginStatus()
    }
    
    /**
     * 密码登录（账号/邮箱 + 密码）
     */
    fun passwordLogin(account: String, password: String, agreementAccepted: Boolean = false, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            try {
                val request = LoginRequest(account, password, agreementAccepted)
                val response = apiService.login(request)
                
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if ((body.code == 0 || body.code == 200) && body.data != null) {
                        val loginResponse = body.data
                        RetrofitClient.saveToken(loginResponse.token)
                        saveUserInfo(loginResponse.userInfo)
                        
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isLoggedIn = true,
                            userInfo = loginResponse.userInfo
                        )
                        onSuccess()
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = "登录失败：${body.message ?: "未知错误"}"
                        )
                        onError("登录失败：${body.message ?: "未知错误"}")
                    }
                } else {
                    val errorMsg = ApiErrorUtil.fromResponse(response, "登录失败，请重试")
                    _uiState.value = _uiState.value.copy(isLoading = false, error = errorMsg)
                    onError(errorMsg)
                }
            } catch (e: Exception) {
                val errorMsg = ApiErrorUtil.fromException(e, "登录失败，请检查网络连接")
                _uiState.value = _uiState.value.copy(isLoading = false, error = errorMsg)
                onError(errorMsg)
            }
        }
    }
    
    /**
     * 注册
     */
    fun register(username: String, password: String, nickName: String, phone: String?,
                 agreementAccepted: Boolean = false,
                 onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            try {
                val request = RegisterRequest(username, password, nickName, phone, agreementAccepted)
                val response = apiService.register(request)
                
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if ((body.code == 0 || body.code == 200) && body.data != null) {
                        val loginResponse = body.data
                        RetrofitClient.saveToken(loginResponse.token)
                        saveUserInfo(loginResponse.userInfo)
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isLoggedIn = true,
                            userInfo = loginResponse.userInfo
                        )
                        onSuccess()
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = "注册失败：${body.message ?: "未知错误"}"
                        )
                        onError("注册失败：${body.message ?: "未知错误"}")
                    }
                } else {
                    val msg = ApiErrorUtil.fromResponse(response, "注册失败，请重试")
                    _uiState.value = _uiState.value.copy(isLoading = false, error = msg)
                    onError(msg)
                }
            } catch (e: Exception) {
                val msg = ApiErrorUtil.fromException(e, "注册失败，请检查网络连接")
                _uiState.value = _uiState.value.copy(isLoading = false, error = msg)
                onError(msg)
            }
        }
    }
    
    /**
     * 退出登录
     */
    fun logout() {
        RetrofitClient.clearToken()
        clearUserInfo()
        _uiState.value = ProfileUiState()
    }
    
    /**
     * 修改密码（需已登录，成功后需重新登录）
     */
    fun changePassword(oldPassword: String, newPassword: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val request = ChangePasswordRequest(oldPassword, newPassword)
                val response = apiService.changePassword(request)
                
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        _uiState.value = _uiState.value.copy(isLoading = false)
                        logout()
                        onSuccess()
                    } else {
                        _uiState.value = _uiState.value.copy(isLoading = false)
                        onError(body.message ?: "修改失败")
                    }
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    onError(ApiErrorUtil.fromResponse(response, "修改失败，请重试"))
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                onError(ApiErrorUtil.fromException(e, "修改失败，请检查网络连接"))
            }
        }
    }
    
    /**
     * 检查登录状态，若已登录则从后端拉取最新用户信息
     */
    fun checkLoginStatus() {
        val token = RetrofitClient.getToken()
        val cachedUserInfo = getUserInfo()
        val isLoggedIn = !token.isNullOrEmpty() && cachedUserInfo != null

        _uiState.value = _uiState.value.copy(
            isLoggedIn = isLoggedIn,
            userInfo = if (isLoggedIn) cachedUserInfo else null
        )
        if (isLoggedIn) {
            loadUnreadMessageCount(cachedUserInfo!!.id)
        } else {
            _uiState.value = _uiState.value.copy(unreadMessageCount = 0)
        }
    }

    fun loadUnreadMessageCount(userId: Int) {
        viewModelScope.launch {
            try {
                val response = apiService.getMessages(userId = userId, page = 1, pageSize = 1)
                if (response.isSuccessful && response.body() != null) {
                    _uiState.value = _uiState.value.copy(
                        unreadMessageCount = response.body()!!.unreadCount
                    )
                }
            } catch (_: Exception) {}
        }
    }
    
    /**
     * 刷新未读消息数（阅读消息后调用）
     */
    fun refreshUnreadMessageCount(userId: Int) {
        loadUnreadMessageCount(userId)
    }
    
    /**
     * 更新用户信息
     */
    fun updateUserInfo(
        nickName: String?,
        avatarUrl: String?,
        phone: String?,
        onSuccess: (UserInfo) -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val TAG = "ProfileViewModel"
            try {
                android.util.Log.d(TAG, "开始更新用户信息...")
                
                // 如果头像是本地 content:// Uri，先上传图片拿到可被后端识别的 URL
                val resolvedAvatarUrl = try {
                    if (!avatarUrl.isNullOrBlank() && avatarUrl.startsWith("content://")) {
                        uploadAvatarAndGetUrl(Uri.parse(avatarUrl))
                    } else {
                        avatarUrl
                    }
                } catch (e: Exception) {
                    android.util.Log.e(TAG, "头像上传失败", e)
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    onError("头像上传失败")
                    return@launch
                }

                // 获取当前用户信息
                val currentUserId = _uiState.value.userInfo?.id
                    ?: context.getSharedPreferences("UserInfo", Context.MODE_PRIVATE).getInt("userId", 0)
                
                if (currentUserId == 0) {
                    android.util.Log.e(TAG, "无法获取当前用户 ID")
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    onError("无法获取用户信息，请重新登录")
                    return@launch
                }
                
                // 构建请求体（空字符串转为 null，避免后端校验失败）
                val request = UpdateUserInfoRequest(
                    nickName = nickName?.takeIf { it.isNotBlank() },
                    avatarUrl = resolvedAvatarUrl?.takeIf { it.isNotBlank() },
                    phone = phone?.takeIf { it.isNotBlank() }
                )
                android.util.Log.d(TAG, "请求 userId=$currentUserId")
                
                val response = apiService.updateUserInfo(currentUserId, request)
                
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.error == null) {
                        val current = _uiState.value.userInfo!!
                        val updatedUserInfo = current.copy(
                            nickName = nickName ?: (current.nickName ?: ""),
                            avatarUrl = resolvedAvatarUrl ?: current.avatarUrl,
                            phone = phone ?: current.phone
                        )
                        saveUserInfo(updatedUserInfo)
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            userInfo = updatedUserInfo
                        )
                        onSuccess(updatedUserInfo)
                    } else {
                        _uiState.value = _uiState.value.copy(isLoading = false)
                        onError(body.error ?: "更新失败")
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    android.util.Log.e(TAG, "updateUserInfo HTTP ${response.code()}: $errorBody")
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    if (response.code() == 401) {
                        logout()
                        onError("未授权，请重新登录")
                    } else if (response.code() == 403) {
                        onError("权限不足，无法更新信息")
                    } else if (response.code() == 500) {
                        onError("服务器繁忙，请稍后重试")
                    } else {
                        val msg = errorBody?.takeIf { it.length < 100 } ?: response.message()
                        onError(if (msg.isNotBlank()) "请求失败：$msg" else "请求失败(HTTP ${response.code()})")
                    }
                }
            } catch (e: java.net.UnknownHostException) {
                android.util.Log.e(TAG, "无法连接服务器", e)
                _uiState.value = _uiState.value.copy(isLoading = false)
                onError("无法连接服务器，请检查网络")
            } catch (e: java.net.SocketTimeoutException) {
                android.util.Log.e(TAG, "连接超时", e)
                _uiState.value = _uiState.value.copy(isLoading = false)
                onError("连接超时，请检查网络后重试")
            } catch (e: java.io.IOException) {
                android.util.Log.e(TAG, "网络请求异常", e)
                _uiState.value = _uiState.value.copy(isLoading = false)
                onError("网络异常：${e.message ?: "请检查网络连接"}")
            } catch (e: Exception) {
                android.util.Log.e(TAG, "更新异常", e)
                _uiState.value = _uiState.value.copy(isLoading = false)
                onError("保存失败：${e.message ?: "未知错误"}")
            }
        }
    }

    private suspend fun uploadAvatarAndGetUrl(uri: Uri): String {
        val resolver = context.contentResolver
        val mimeType = resolver.getType(uri) ?: "image/jpeg"
        val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IllegalStateException("无法读取图片数据")

        val requestBody = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
        
        val avatarPart = MultipartBody.Part.createFormData(
            name = "file",
            filename = "avatar.jpg",
            body = requestBody
        )

        val currentUserId = _uiState.value.userInfo?.id
            ?: context.getSharedPreferences("UserInfo", Context.MODE_PRIVATE).getInt("userId", 0)
        
        if (currentUserId == 0) {
            throw IllegalStateException("无法获取用户ID，请重新登录")
        }

        val resp = apiService.uploadAvatar(currentUserId, avatarPart)
        
        if (!resp.isSuccessful || resp.body() == null || resp.body()!!.success == false) {
            val errorMsg = resp.body()?.message ?: "上传失败"
            throw IllegalStateException("头像上传失败: $errorMsg")
        }

        val body = resp.body()!!
        val data = body.data
        
        val fullUrl = data?.fullUrl
        val avatarUrl = data?.avatarUrl
        
        return fullUrl ?: avatarUrl?.let { 
            if (it.startsWith("http")) it else "https://your-domain.com$it" 
        } ?: throw IllegalStateException("上传成功但未返回头像URL")
    }
    
    /**
     * 清除错误
     */
    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
    
    // ==================== 用户信息管理 ====================
    
    private fun saveUserInfo(userInfo: UserInfo) {
        prefs.edit().apply {
            putInt("userId", userInfo.id)
            putString("username", userInfo.username)
            putString("nickName", userInfo.nickName ?: "")
            putString("avatarUrl", userInfo.avatarUrl)
            putString("phone", userInfo.phone)
            putBoolean("isAdmin", userInfo.isAdmin || userInfo.admin)
            putString("symbol", userInfo.symbol)
            putFloat("points", userInfo.points.toFloat())
            apply()
        }
    }
    
    private fun getUserInfo(): UserInfo? {
        return if (prefs.contains("userId")) {
            UserInfo(
                id = prefs.getInt("userId", 0),
                username = prefs.getString("username", "") ?: "",
                nickName = prefs.getString("nickName", "") ?: "",
                avatarUrl = prefs.getString("avatarUrl", null),
                phone = prefs.getString("phone", null),
                isAdmin = prefs.getBoolean("isAdmin", false),
                admin = prefs.getBoolean("isAdmin", false),
                symbol = prefs.getString("symbol", null),
                points = prefs.getFloat("points", 0f).toDouble()
            )
        } else {
            null
        }
    }
    
    private fun clearUserInfo() {
        prefs.edit().clear().apply()
    }
}

/**
 * UI 状态数据类
 */
data class ProfileUiState(
    val isLoading: Boolean = false,
    val isLoggedIn: Boolean = false,
    val userInfo: UserInfo? = null,
    val error: String? = null,
    val unreadMessageCount: Int = 0
)