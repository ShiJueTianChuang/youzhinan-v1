package com.example.youzhinan.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.youzhinan.data.api.InfoDto
import com.example.youzhinan.data.api.RetrofitClient
import com.example.youzhinan.utils.LocationHelper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
    val nearbyInfos: List<InfoDto> = emptyList(),
    val newInfos: List<InfoDto> = emptyList(),
    val highScoreInfos: List<InfoDto> = emptyList(),
    val allInfos: List<InfoDto> = emptyList(),
    val isLoading: Boolean = true,
    val error: String? = null,
    val selectedTab: Int = 0,
    val currentLocation: Pair<Double, Double>? = null,
    val hasLoadedData: Boolean = false
)

class HomeViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState

    // 保存每个标签页的滚动索引和偏移
    private val _scrollPositions = MutableStateFlow<Map<Int, Pair<Int, Int>>>(emptyMap())
    val scrollPositions: StateFlow<Map<Int, Pair<Int, Int>>> = _scrollPositions

    fun saveScrollPosition(tab: Int, index: Int, offset: Int) {
        _scrollPositions.value = _scrollPositions.value.toMutableMap().apply {
            this[tab] = Pair(index, offset)
        }
    }

    fun getScrollPosition(tab: Int): Pair<Int, Int>? = _scrollPositions.value[tab]

    fun selectTab(tab: Int) {
        _uiState.value = _uiState.value.copy(selectedTab = tab)
    }

    fun updateLocation(location: Pair<Double, Double>) {
        _uiState.value = _uiState.value.copy(currentLocation = location)
        // 如果数据已加载，重新计算附近信息
        if (_uiState.value.hasLoadedData && _uiState.value.allInfos.isNotEmpty()) {
            recalcNearby(location)
        }
    }

    fun loadData(context: android.content.Context? = null, forceRefresh: Boolean = false) {
        if (!forceRefresh && _uiState.value.hasLoadedData && _uiState.value.allInfos.isNotEmpty()) {
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            try {
                val response = RetrofitClient.getApiService().getInfoList()
                if (response.isSuccessful && response.body() != null) {
                    val loadedInfos = response.body()!!.data ?: emptyList()

                    val newInfos = loadedInfos.filter { it.rating == null || it.rating == 0.0 }
                    val highScoreInfos = loadedInfos.filter { it.rating == 100.0 }

                    val loc = _uiState.value.currentLocation
                    val nearbyInfos = if (loc != null) {
                        calcNearby(loadedInfos, loc)
                    } else {
                        loadedInfos.filter { it.latitude != null && it.longitude != null }
                    }

                    _uiState.value = _uiState.value.copy(
                        nearbyInfos = nearbyInfos,
                        newInfos = newInfos,
                        highScoreInfos = highScoreInfos,
                        allInfos = loadedInfos,
                        isLoading = false,
                        hasLoadedData = true,
                        error = null
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "加载失败：HTTP ${response.code()}"
                    )
                }
            } catch (e: Exception) {
                Log.e("HomeViewModel", "加载失败", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "加载失败：${e.message ?: "未知错误"}"
                )
            }
        }
    }

    private fun recalcNearby(loc: Pair<Double, Double>) {
        val allInfos = _uiState.value.allInfos
        _uiState.value = _uiState.value.copy(
            nearbyInfos = calcNearby(allInfos, loc)
        )
    }

    private fun calcNearby(
        infos: List<InfoDto>,
        loc: Pair<Double, Double>
    ): List<InfoDto> {
        val maxDistanceMeters = 300_000.0 // 300km
        return infos
            .filter { it.latitude != null && it.longitude != null }
            .map { info ->
                val dist = LocationHelper.distanceMeters(
                    loc.first, loc.second,
                    info.latitude!!, info.longitude!!
                )
                info to dist
            }
            .filter { it.second <= maxDistanceMeters }
            .sortedBy { it.second }
            .map { it.first }
    }

    override fun onCleared() {
        super.onCleared()
        Log.d("HomeViewModel", "onCleared")
    }
}
