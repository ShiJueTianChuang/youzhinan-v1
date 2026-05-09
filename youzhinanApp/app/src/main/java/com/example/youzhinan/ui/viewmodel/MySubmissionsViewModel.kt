package com.example.youzhinan.ui.viewmodel

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.youzhinan.data.api.*
import com.example.youzhinan.utils.ApiErrorUtil
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * 我的投稿列表 ViewModel
 */
class MySubmissionsViewModel(
    private val context: Context
) : ViewModel() {

    private val apiService: ApiService = RetrofitClient.getApiService()

    private val _uiState = MutableStateFlow(MySubmissionsUiState())
    val uiState: StateFlow<MySubmissionsUiState> = _uiState

    fun loadList() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val response = apiService.getMySubmissions()
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        val list = body.data?.list ?: emptyList()
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            list = list,
                            error = null
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = body.message ?: "加载失败"
                        )
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = ApiErrorUtil.fromResponse(response, "加载失败")
                    )
                }
            } catch (e: Exception) {
                Log.e("MySubmissionsViewModel", "loadList", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = ApiErrorUtil.fromException(e, "加载失败")
                )
            }
        }
    }

    fun deleteSubmission(id: Int, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                val response = apiService.deleteSubmission(id)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        loadList()
                        onSuccess()
                    } else {
                        onError(body.message ?: "删除失败")
                    }
                } else {
                    onError(ApiErrorUtil.fromResponse(response, "删除失败"))
                }
            } catch (e: Exception) {
                onError(ApiErrorUtil.fromException(e, "删除失败"))
            }
        }
    }
}

data class MySubmissionsUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val list: List<SubmissionItem> = emptyList()
)
