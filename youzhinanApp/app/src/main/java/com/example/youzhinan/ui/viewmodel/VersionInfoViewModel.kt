package com.example.youzhinan.ui.viewmodel

import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.youzhinan.data.api.AppVersionApi
import com.example.youzhinan.data.api.CheckUpdateResponse
import com.example.youzhinan.data.api.RetrofitClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class VersionInfoUiState(
    val currentVersionName: String = "v1.0.0",
    val currentVersionCode: Int = 1,
    val isCheckingUpdate: Boolean = false,
    val hasUpdate: Boolean = false,
    val latestVersion: CheckUpdateResponse? = null,
    val updateError: String? = null
)

class VersionInfoViewModel(application: Application) : AndroidViewModel(application) {

    private val context: Context = application.applicationContext
    private val _uiState = MutableStateFlow(VersionInfoUiState())
    val uiState: StateFlow<VersionInfoUiState> = _uiState.asStateFlow()

    private val api: AppVersionApi by lazy { RetrofitClient.getAppVersionApiService() }

    fun init() {
        try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            val versionName = "v${packageInfo.versionName}"
            val versionCode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                packageInfo.longVersionCode.toInt()
            } else {
                @Suppress("DEPRECATION")
                packageInfo.versionCode
            }

            _uiState.value = _uiState.value.copy(
                currentVersionName = versionName,
                currentVersionCode = versionCode
            )
        } catch (e: PackageManager.NameNotFoundException) {
            e.printStackTrace()
        }
    }

    fun checkUpdate() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isCheckingUpdate = true,
                updateError = null
            )

            try {
                val response = api.checkUpdate(_uiState.value.currentVersionCode)
                if (response.isSuccessful && response.body()?.code == 200) {
                    val data = response.body()?.data
                    _uiState.value = _uiState.value.copy(
                        isCheckingUpdate = false,
                        hasUpdate = data?.hasUpdate == true,
                        latestVersion = data
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isCheckingUpdate = false,
                        updateError = "检查更新失败"
                    )
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isCheckingUpdate = false,
                    updateError = e.message ?: "网络错误"
                )
            }
        }
    }
}
