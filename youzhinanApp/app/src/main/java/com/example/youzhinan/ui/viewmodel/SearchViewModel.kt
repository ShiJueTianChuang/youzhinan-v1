package com.example.youzhinan.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.youzhinan.data.City
import com.example.youzhinan.data.Province
import com.example.youzhinan.data.api.ApiService
import com.example.youzhinan.data.api.InfoDto
import com.example.youzhinan.data.api.RetrofitClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * 搜索页面 ViewModel
 * 支持从后端加载省份、城市、分类信息
 */
class SearchViewModel : ViewModel() {
    
    private val apiService: ApiService = RetrofitClient.getApiService()
    
    // UI 状态
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState
    
    /**
     * 加载信息列表并提取省份和城市
     */
    fun loadInfosAndExtractLocations(forceReload: Boolean = false) {
        val tag = "SearchViewModel"
        
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            
            try {
                val response = apiService.getInfoList()
                Log.d(tag, "获取信息列表 - HTTP 状态码：${response.code()}")
                
                if (response.isSuccessful && response.body() != null) {
                    val apiResponse = response.body()!!
                    Log.d(tag, "响应码：${apiResponse.code}, 消息：${apiResponse.message}")
                    
                    if (apiResponse.code == 0 || apiResponse.code == 200) {
                        val allInfos = apiResponse.data ?: emptyList()
                        Log.d(tag, "获取成功，共 ${allInfos.size} 条信息")
                        val provincesMap = mutableMapOf<String, MutableList<City>>()
                        allInfos.forEach { info ->
                            val provinceName = info.province ?: "未知省份"
                            val cityName = info.city ?: "未知城市"
                            val category = info.category ?: "其他"
                            if (!provincesMap.containsKey(provinceName)) {
                                provincesMap[provinceName] = mutableListOf()
                            }
                            var city = provincesMap[provinceName]!!.find { it.name == cityName }
                            if (city == null) {
                                city = City(name = cityName, category = category)
                                provincesMap[provinceName]!!.add(city)
                            }
                        }
                        val provinces = provincesMap.map { (provinceName, cities) ->
                            Province(name = provinceName, cities = cities)
                        }
                        // 保持后端返回顺序，不再前端排序
                        Log.d(tag, "提取到 ${provinces.size} 个省份")
                    
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            provinces = provinces,
                            infoList = allInfos,
                            error = null
                        )
                    } else {
                        Log.e(tag, "API 错误：code=${apiResponse.code}, message=${apiResponse.message}")
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = "加载失败：${apiResponse.message ?: "未知错误"}"
                        )
                    }
                } else {
                    Log.e(tag, "HTTP 错误：${response.code()} - ${response.message()}")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "网络错误：${response.message()}"
                    )
                }
            } catch (e: Exception) {
                Log.e(tag, "加载信息异常", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "加载失败：${e.message ?: "未知错误"}"
                )
            }
        }
    }
    
    /**
     * 加载城市列表（公共方法，供页面调用）
     */
    fun loadCities(provinceName: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            // 从本地查找省份
            val province = _uiState.value.provinces.find { it.name == provinceName }
            
            if (province != null) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    cities = province.cities
                )
            } else {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    cities = emptyList()
                )
            }
        }
    }
    
    /**
     * 搜索地点（搜索省份、城市、店名、关键词，支持拼音搜索）
     */
    fun searchLocations(keyword: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = true,
                searchText = keyword
            )
            
            if (keyword.isBlank()) {
                // 如果搜索框为空，不显示搜索结果
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    searchResults = emptyList(),
                    error = null
                )
                return@launch
            }
            
            // 在信息列表中搜索，匹配省份、城市、店名、描述等（支持汉字和拼音）
            val filteredInfos = _uiState.value.infoList.filter { info ->
                matchesKeyword(info.province, keyword) ||
                matchesKeyword(info.city, keyword) ||
                matchesKeyword(info.storeName, keyword) ||
                matchesKeyword(info.title, keyword) ||
                matchesKeyword(info.description, keyword) ||
                matchesKeyword(info.content, keyword) ||
                matchesKeyword(info.address, keyword) ||
                matchesKeyword(info.businessHours, keyword)
            }
            
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                searchResults = filteredInfos.map { info -> 
                    City(name = info.city ?: "未知", category = info.category ?: "其他") 
                },
                error = null
            )
        }
    }
    
    /**
     * 检查文本是否匹配关键词（支持汉字匹配）
     */
    private fun matchesKeyword(text: String?, keyword: String): Boolean {
        if (text.isNullOrBlank()) return false
        
        // 直接匹配汉字
        return text.contains(keyword, ignoreCase = true)
    }
    
    /**
     * 选择省份
     */
    fun selectProvince(province: Province) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                selectedProvince = province,
                selectedCity = null,
                showResults = true
            )
            
            // 加载该省份的城市
            loadCities(province.name)
        }
    }
    
    /**
     * 选择城市
     */
    fun selectCity(city: City) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                selectedCity = city,
                selectedCategory = null, // 重置分类选择
                showResults = true
            )
        }
    }
    
    /**
     * 选择分类
     */
    fun selectCategory(categoryName: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                selectedCategory = categoryName
            )
        }
    }
}

/**
 * UI 状态数据类
 */
data class SearchUiState(
    val isLoading: Boolean = false,
    val searchText: String? = null,
    val provinces: List<Province> = emptyList(),
    val cities: List<City> = emptyList(),
    val searchResults: List<City> = emptyList(),
    val infoList: List<InfoDto> = emptyList(),  // 后端信息列表
    val selectedProvince: Province? = null,
    val selectedCity: City? = null,
    val selectedCategory: String? = null,       // 选中的分类
    val showResults: Boolean = false,
    val error: String? = null
)
