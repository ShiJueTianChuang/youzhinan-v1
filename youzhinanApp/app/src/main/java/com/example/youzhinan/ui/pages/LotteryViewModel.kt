package com.example.youzhinan.ui.pages

import android.app.Application
import android.content.Context
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.youzhinan.data.api.*
import com.example.youzhinan.utils.ApiErrorUtil
import com.google.gson.Gson
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LotteryUiState(
    val isLoading: Boolean = false,
    val isDrawing: Boolean = false,
    val activity: LotteryActivity? = null,
    val activityStatus: String? = null,
    val prizes: List<LotteryPrize> = emptyList(),
    val drawInfo: UserDrawInfo? = null,
    val drawResult: LotteryDrawResponse? = null,
    val winRecords: List<LotteryRecord> = emptyList(),
    val allRecords: List<LotteryRecord> = emptyList(),
    val error: String? = null,
    val shippingSubmitted: Boolean = false,
    val provinces: List<String> = emptyList(),
    val regionsData: Map<String, RegionData> = emptyMap(),
    val selectedProvince: String? = null,
    val selectedCity: String? = null,
    val selectedDistrict: String? = null,
    val cities: List<String> = emptyList(),
    val districts: List<String> = emptyList(),
    val inviteInfo: InviteInfo? = null
)

class LotteryViewModel(application: Application) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(LotteryUiState())
    val uiState: StateFlow<LotteryUiState> = _uiState.asStateFlow()

    private val apiService get() = RetrofitClient.getApiService()

    private fun getUserId(): Int {
        val prefs = getApplication<Application>().getSharedPreferences("UserInfo", Context.MODE_PRIVATE)
        return prefs.getInt("userId", -1)
    }

    fun loadLotteryStatus() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null, isDrawing = false)
            try {
                val response = apiService.getLotteryStatus()
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.activity != null && (body.status == "active" || body.status == "pending")) {
                        Log.d("LotteryViewModel", "活动加载成功: ${body.activity.name}, 状态: ${body.status}, 奖品数量: ${body.prizes?.size ?: 0}")
                        body.prizes?.forEach { prize ->
                            Log.d("LotteryViewModel", "奖品: id=${prize.id}, name=${prize.name}, position=${prize.position}, isThankYou=${prize.isThankYou}, needsShipping=${prize.needsShipping}")
                        }
                        // 按 position 字段排序（如果存在），没有 position 则保持原顺序
                        val sortedPrizes = sortPrizesByPosition(body.prizes ?: emptyList())
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            activity = body.activity,
                            activityStatus = body.status,
                            prizes = sortedPrizes
                        )
                        if (body.status == "active") {
                            loadUserDrawInfo(body.activity.id)
                            loadInviteInfo()
                        }
                        if (body.prizes.isNullOrEmpty()) {
                            loadLotteryPrizes()
                        }
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            activity = null,
                            activityStatus = null,
                            prizes = emptyList(),
                            error = body?.message ?: "当前没有活跃的抽奖活动"
                        )
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "获取活动状态失败"
                    )
                }
            } catch (e: Exception) {
                Log.e("LotteryViewModel", "加载抽奖状态失败", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = ApiErrorUtil.fromException(e, "加载抽奖状态失败")
                )
            }
        }
    }

    // 独立加载奖品（当 status 接口没有返回 prizes 时调用）
    private fun loadLotteryPrizes() {
        viewModelScope.launch {
            try {
                val response = apiService.getLotteryPrizes()
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body?.success == true && body.data != null) {
                        val sortedPrizes = sortPrizesByPosition(body.data)
                        Log.d("LotteryViewModel", "独立奖品接口加载成功: ${sortedPrizes.size}个奖品")
                        _uiState.value = _uiState.value.copy(
                            prizes = sortedPrizes
                        )
                    }
                } else {
                    Log.w("LotteryViewModel", "独立奖品接口失败: HTTP ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e("LotteryViewModel", "独立奖品接口异常", e)
            }
        }
    }

    private fun sortPrizesByPosition(prizes: List<LotteryPrize>): List<LotteryPrize> {
        val hasPosition = prizes.any { !it.position.isNullOrBlank() }
        if (!hasPosition) return prizes
        return prizes.sortedBy { prize ->
            prize.position?.toIntOrNull() ?: Int.MAX_VALUE
        }
    }

    private fun refreshPrizesSilently() {
        viewModelScope.launch {
            try {
                // 优先尝试独立奖品接口
                val prizesResponse = apiService.getLotteryPrizes()
                if (prizesResponse.isSuccessful) {
                    val body = prizesResponse.body()
                    if (body?.success == true && body.data != null) {
                        _uiState.value = _uiState.value.copy(
                            prizes = sortPrizesByPosition(body.data)
                        )
                        return@launch
                    }
                }
                // 回退到 status 接口中的 prizes
                val response = apiService.getLotteryStatus()
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.prizes != null) {
                        _uiState.value = _uiState.value.copy(
                            prizes = sortPrizesByPosition(body.prizes)
                        )
                    }
                }
            } catch (e: Exception) {
                Log.e("LotteryViewModel", "静默刷新奖品失败", e)
            }
        }
    }

    fun loadUserDrawInfo(activityId: Int? = null) {
        val actId = activityId ?: _uiState.value.activity?.id ?: return
        val userId = getUserId()
        if (userId <= 0) return

        viewModelScope.launch {
            try {
                val response = apiService.getUserDrawInfo(userId, actId)
                if (response.isSuccessful) {
                    val body = response.body()
                    Log.d("LotteryViewModel", "用户抽奖信息原始响应: success=${body?.success}, data=${Gson().toJson(body?.data)}")
                    if (body?.success == true && body.data != null) {
                        val data = body.data
                        Log.d("LotteryViewModel", "用户抽奖信息: dailyRemaining=${data.dailyRemaining}, totalRemaining=${data.totalRemaining}, effectiveDailyLimit=${data.effectiveDailyLimit}")
                        _uiState.value = _uiState.value.copy(
                            drawInfo = data,
                            winRecords = data.winRecords,
                            allRecords = data.allRecords
                        )
                    } else {
                        Log.w("LotteryViewModel", "用户抽奖信息响应状态异常: success=${body?.success}, data is null=${body?.data == null}")
                    }
                } else {
                    val errorStr = response.errorBody()?.string()
                    Log.e("LotteryViewModel", "加载用户抽奖信息API失败: HTTP ${response.code()}, error=${errorStr}")
                }
            } catch (e: Exception) {
                Log.e("LotteryViewModel", "加载用户抽奖信息异常", e)
            }
        }
    }

    private fun getNoChanceReason(drawInfo: UserDrawInfo?): String? {
        if (drawInfo == null) {
            return "抽奖信息加载中，请稍后再试"
        }
        val dailyRemaining = drawInfo.dailyRemaining
        val totalRemaining = drawInfo.totalRemaining
        // 后端返回的 dailyRemaining 已包含邀请奖励和广告奖励，直接用它判断
        return when {
            totalRemaining <= 0 -> "总抽奖次数已用完"
            dailyRemaining <= 0 -> "今日抽奖次数已用完"
            else -> null
        }
    }

    fun draw(onComplete: ((LotteryDrawResponse?) -> Unit)? = null) {
        val activity = _uiState.value.activity ?: return
        val userId = getUserId()
        if (userId <= 0) {
            _uiState.value = _uiState.value.copy(error = "请先登录")
            onComplete?.invoke(null)
            return
        }
        if (_uiState.value.isDrawing) {
            onComplete?.invoke(null)
            return
        }
        val drawInfo = _uiState.value.drawInfo
        val noChanceReason = getNoChanceReason(drawInfo)
        if (noChanceReason != null) {
            _uiState.value = _uiState.value.copy(error = noChanceReason)
            onComplete?.invoke(null)
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isDrawing = true, drawResult = null, error = null)
            try {
                val response = apiService.lotteryDraw(
                    LotteryDrawRequest(activityId = activity.id)
                )
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.success) {
                        _uiState.value = _uiState.value.copy(
                            drawResult = body
                        )
                        onComplete?.invoke(body)
                        loadUserDrawInfo(activity.id)
                        refreshPrizesSilently()
                    } else if (body != null && !body.success) {
                        val errorMsg = body.error ?: body.message ?: "抽奖失败"
                        _uiState.value = _uiState.value.copy(
                            isDrawing = false,
                            error = errorMsg
                        )
                        onComplete?.invoke(null)
                        loadUserDrawInfo(activity.id)
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isDrawing = false,
                            error = "抽奖失败，请重试"
                        )
                        onComplete?.invoke(null)
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMsg = try {
                        val errorMap = Gson().fromJson(errorBody, Map::class.java)
                        errorMap["error"] as? String ?: "抽奖失败"
                    } catch (_: Exception) {
                        "抽奖失败"
                    }
                    _uiState.value = _uiState.value.copy(
                        isDrawing = false,
                        error = errorMsg
                    )
                    onComplete?.invoke(null)
                    val activityId = _uiState.value.activity?.id
                    if (activityId != null && activityId > 0) {
                        loadUserDrawInfo(activityId)
                    }
                    refreshPrizesSilently()
                }
            } catch (e: Exception) {
                Log.e("LotteryViewModel", "抽奖失败", e)
                _uiState.value = _uiState.value.copy(
                    isDrawing = false,
                    error = ApiErrorUtil.fromException(e, "抽奖失败")
                )
                onComplete?.invoke(null)
            }
        }
    }

    fun clearDrawResult() {
        _uiState.value = _uiState.value.copy(drawResult = null, isDrawing = false)
    }

    fun clearDrawResultAndError() {
        _uiState.value = _uiState.value.copy(drawResult = null, error = null, isDrawing = false)
    }

    fun loadInviteInfo() {
        val userId = getUserId()
        if (userId <= 0) return
        val activityId = _uiState.value.activity?.id

        viewModelScope.launch {
            try {
                val response = apiService.getInviteInfo(userId, activityId)
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body?.success == true && body.data != null) {
                        _uiState.value = _uiState.value.copy(inviteInfo = body.data)
                    } else {
                        Log.w("LotteryViewModel", "加载邀请信息失败: 响应格式错误")
                    }
                } else {
                    Log.e("LotteryViewModel", "加载邀请信息失败: HTTP ${response.code()}")
                }
            } catch (e: Exception) {
                Log.e("LotteryViewModel", "加载邀请信息异常", e)
            }
        }
    }

    fun submitShippingAddress(
        recordId: Int,
        name: String,
        phone: String,
        province: String,
        city: String,
        district: String,
        detailAddress: String
    ) {
        val userId = getUserId()
        if (userId <= 0) return
        if (recordId <= 0) {
            _uiState.value = _uiState.value.copy(error = "中奖记录无效，请从“我的奖品”中重新填写地址")
            return
        }

        viewModelScope.launch {
            try {
                val response = apiService.submitShippingAddress(
                    ShippingAddressRequest(
                        recordId = recordId,
                        userId = userId,
                        name = name,
                        phone = phone,
                        province = province,
                        city = city,
                        district = district,
                        detailAddress = detailAddress
                    )
                )
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body?.success == true) {
                        _uiState.value = _uiState.value.copy(shippingSubmitted = true)
                        loadUserDrawInfo()
                    } else {
                        _uiState.value = _uiState.value.copy(
                            error = body?.message ?: "提交收货地址失败"
                        )
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMsg = try {
                        val errorMap = Gson().fromJson(errorBody, Map::class.java)
                        errorMap["error"] as? String ?: "提交收货地址失败"
                    } catch (_: Exception) {
                        "提交收货地址失败"
                    }
                    _uiState.value = _uiState.value.copy(error = errorMsg)
                }
            } catch (e: Exception) {
                Log.e("LotteryViewModel", "提交收货地址失败", e)
                _uiState.value = _uiState.value.copy(error = ApiErrorUtil.fromException(e, "提交收货地址失败"))
            }
        }
    }

    fun loadRegions() {
        viewModelScope.launch {
            try {
                val response = apiService.getRegions()
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body?.code == 200 && body.data != null) {
                        _uiState.value = _uiState.value.copy(
                            provinces = body.data.provinces ?: emptyList(),
                            regionsData = body.data.regions ?: emptyMap()
                        )
                    }
                }
            } catch (e: Exception) {
                Log.e("LotteryViewModel", "加载地区数据失败", e)
            }
        }
    }

    fun selectProvince(province: String) {
        val regionsData = _uiState.value.regionsData
        val regionData = regionsData[province]
        _uiState.value = _uiState.value.copy(
            selectedProvince = province,
            selectedCity = null,
            selectedDistrict = null,
            cities = regionData?.cities ?: emptyList(),
            districts = emptyList()
        )
    }

    fun selectCity(city: String) {
        val regionsData = _uiState.value.regionsData
        val province = _uiState.value.selectedProvince ?: return
        val regionData = regionsData[province]
        val districtList = regionData?.districts?.get(city) ?: emptyList()
        _uiState.value = _uiState.value.copy(
            selectedCity = city,
            selectedDistrict = null,
            districts = districtList
        )
    }

    fun selectDistrict(district: String) {
        _uiState.value = _uiState.value.copy(selectedDistrict = district)
    }

    fun clearShippingSubmitted() {
        _uiState.value = _uiState.value.copy(
            shippingSubmitted = false,
            selectedProvince = null,
            selectedCity = null,
            selectedDistrict = null,
            cities = emptyList(),
            districts = emptyList()
        )
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun setError(message: String) {
        _uiState.value = _uiState.value.copy(error = message)
    }

    fun recordInvite(inviteCode: String, inviteeId: Int) {
        val activityId = _uiState.value.activity?.id
        viewModelScope.launch {
            try {
                val response = apiService.recordInvite(
                    RecordInviteRequest(
                        inviteCode = inviteCode,
                        inviteeId = inviteeId,
                        activityId = activityId
                    )
                )
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body?.success == true) {
                        loadInviteInfo()
                        loadUserDrawInfo(activityId)
                    }
                }
            } catch (e: Exception) {
                Log.e("LotteryViewModel", "记录邀请失败", e)
            }
        }
    }
}
