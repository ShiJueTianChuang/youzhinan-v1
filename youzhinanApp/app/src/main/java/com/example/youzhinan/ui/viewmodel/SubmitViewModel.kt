package com.example.youzhinan.ui.viewmodel

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.youzhinan.data.api.*
import com.example.youzhinan.utils.ApiErrorUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream

/**
 * 投稿页面 ViewModel
 * 地址数据从后端 /api/regions 获取
 */
class SubmitViewModel(
    private val context: Context
) : ViewModel() {

    private val apiService: ApiService = RetrofitClient.getApiService()

    private val _uiState = MutableStateFlow(SubmitUiState())
    val uiState: StateFlow<SubmitUiState> = _uiState.asStateFlow()

    init {
        loadRegions()
        loadCategories()
    }

    /** 加载分类列表：优先调用 api/categories，失败则从 info 列表提取 */
    fun loadCategories() {
        viewModelScope.launch {
            try {
                val response = apiService.getCategories()
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val list = body.data?.mapNotNull { it.name?.takeIf { n -> n.isNotBlank() } }?.distinct() ?: emptyList()
                    if (list.isNotEmpty()) {
                        _uiState.value = _uiState.value.copy(categories = list)
                        return@launch
                    }
                }
            } catch (e: Exception) {
                Log.d("SubmitViewModel", "getCategories failed, fallback to info list", e)
            }
            // 降级：从 info 列表提取分类
            try {
                val infoResp = apiService.getInfoList()
                if (infoResp.isSuccessful && infoResp.body() != null && (infoResp.body()!!.code == 0 || infoResp.body()!!.code == 200)) {
                    val infos = infoResp.body()!!.data ?: emptyList()
                    val cats = infos.mapNotNull { it.category?.takeIf { c -> c.isNotBlank() } }.distinct().sorted()
                    if (cats.isNotEmpty()) {
                        _uiState.value = _uiState.value.copy(categories = cats)
                    }
                }
            } catch (e: Exception) {
                Log.e("SubmitViewModel", "loadCategories fallback failed", e)
            }
        }
    }

    fun loadRegions() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val response = apiService.getRegions()
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        val data = body.data
                        val provinces = data?.provinces ?: data?.regions?.keys?.toList()?.sorted() ?: emptyList()
                        val regions = data?.regions ?: emptyMap()
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            provinces = provinces,
                            regionsData = regions,
                            error = null
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = body.message ?: "加载地址失败"
                        )
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = ApiErrorUtil.fromResponse(response, "加载地址失败")
                    )
                }
            } catch (e: Exception) {
                Log.e("SubmitViewModel", "loadRegions", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = ApiErrorUtil.fromException(e, "加载地址失败")
                )
            }
        }
    }

    fun selectProvince(province: String) {
        _uiState.value = _uiState.value.copy(
            selectedProvince = province,
            selectedCity = null,
            selectedDistrict = null
        )
    }

    fun selectCity(city: String) {
        _uiState.value = _uiState.value.copy(
            selectedCity = city,
            selectedDistrict = null
        )
    }

    fun selectDistrict(district: String) {
        _uiState.value = _uiState.value.copy(selectedDistrict = district)
    }

    fun setLocationSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(locationSearchQuery = query)
    }

    /** 根据关键词搜索省/市/区，返回匹配的 (省, 市, 区) 列表，优先省份和城市 */
    fun getSearchResults(): List<LocationMatch> {
        val query = _uiState.value.locationSearchQuery.trim()
        if (query.isBlank()) return emptyList()
        val regions = _uiState.value.regionsData
        if (regions.isEmpty()) return emptyList()

        val provinceMatches = mutableListOf<LocationMatch>()
        val cityMatches = mutableListOf<LocationMatch>()
        val districtMatches = mutableListOf<LocationMatch>()

        for ((province, data) in regions) {
            if (province.contains(query, ignoreCase = true)) {
                provinceMatches.add(LocationMatch(province, null, null))
            }
            val cities = data?.cities ?: continue
            for (city in cities) {
                if (city.contains(query, ignoreCase = true)) {
                    cityMatches.add(LocationMatch(province, city, null))
                }
                val districts = data.districts?.get(city) ?: continue
                for (district in districts) {
                    if (district.contains(query, ignoreCase = true)) {
                        districtMatches.add(LocationMatch(province, city, district))
                    }
                }
            }
        }
        return (provinceMatches + cityMatches + districtMatches).distinct().take(30)
    }

    fun addUploadedImagePath(path: String) {
        val current = _uiState.value.uploadedImagePaths
        if (current.size < 3) {
            _uiState.value = _uiState.value.copy(
                uploadedImagePaths = current + path
            )
        }
    }

    fun removeUploadedImage(index: Int) {
        val current = _uiState.value.uploadedImagePaths.toMutableList()
        if (index in current.indices) {
            current.removeAt(index)
            _uiState.value = _uiState.value.copy(uploadedImagePaths = current)
        }
    }

    fun setImageUploading(uploading: Boolean) {
        _uiState.value = _uiState.value.copy(isImageUploading = uploading)
    }

    suspend fun uploadImage(uri: Uri): String = withContext(Dispatchers.IO) {
        val compressedBytes = compressImage(uri, maxWidth = 1920, maxHeight = 1920, quality = 80)
        val ext = "jpg"
        val mimeType = "image/jpeg"
        val requestBody = compressedBytes.toRequestBody(mimeType.toMediaTypeOrNull())
        val imagePart = MultipartBody.Part.createFormData(
            name = "image",
            filename = "img_${System.currentTimeMillis()}.$ext",
            body = requestBody
        )
        val resp = apiService.uploadImage(imagePart)
        if (!resp.isSuccessful || resp.body() == null) {
            val errMsg = resp.errorBody()?.string()?.take(200) ?: "HTTP ${resp.code()}"
            throw IllegalStateException("上传失败: $errMsg")
        }
        val body = resp.body()!!
        val path = when {
            body.data != null -> {
                val d = body.data!!
                if (d.success == false && d.imagePath.isNullOrBlank() && d.fullUrl.isNullOrBlank()) throw IllegalStateException("上传失败")
                d.imagePath ?: d.fullUrl?.let { url ->
                    if (url.contains("your-domain.com")) url.substringAfter("your-domain.com") else url
                }
            }
            body.imagePath != null || body.fullUrl != null -> {
                if (body.success == false && body.imagePath.isNullOrBlank() && body.fullUrl.isNullOrBlank()) throw IllegalStateException("上传失败")
                body.imagePath ?: body.fullUrl?.let { url ->
                    if (url.contains("your-domain.com")) url.substringAfter("your-domain.com") else url
                }
            }
            else -> throw IllegalStateException("上传失败")
        }
        path ?: throw IllegalStateException("上传失败")
    }

    private fun compressImage(uri: Uri, maxWidth: Int = 1920, maxHeight: Int = 1920, quality: Int = 80): ByteArray {
        val inputStream = context.contentResolver.openInputStream(uri)
            ?: throw IllegalStateException("无法读取图片")

        val options = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeStream(inputStream, null, options)
        inputStream.close()

        var sampleSize = 1
        while (options.outWidth / sampleSize > maxWidth || options.outHeight / sampleSize > maxHeight) {
            sampleSize *= 2
        }

        val decodeOptions = BitmapFactory.Options().apply {
            inSampleSize = sampleSize
        }
        val inputStream2 = context.contentResolver.openInputStream(uri)
            ?: throw IllegalStateException("无法读取图片")
        val bitmap = BitmapFactory.decodeStream(inputStream2, null, decodeOptions)
        inputStream2.close()

        if (bitmap == null) {
            val rawStream = context.contentResolver.openInputStream(uri)
                ?: throw IllegalStateException("无法读取图片")
            return rawStream.readBytes().also { rawStream.close() }
        }

        var scaledWidth = bitmap.width
        var scaledHeight = bitmap.height
        if (scaledWidth > maxWidth || scaledHeight > maxHeight) {
            val scale = minOf(maxWidth.toFloat() / scaledWidth, maxHeight.toFloat() / scaledHeight)
            scaledWidth = (scaledWidth * scale).toInt()
            scaledHeight = (scaledHeight * scale).toInt()
        }

        val scaledBitmap = if (scaledWidth != bitmap.width || scaledHeight != bitmap.height) {
            Bitmap.createScaledBitmap(bitmap, scaledWidth, scaledHeight, true).also {
                if (it !== bitmap) bitmap.recycle()
            }
        } else {
            bitmap
        }

        val outputStream = ByteArrayOutputStream()
        scaledBitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
        if (scaledBitmap !== bitmap) scaledBitmap.recycle()

        return outputStream.toByteArray()
    }

    fun submit(
        storeName: String,
        province: String,
        city: String,
        district: String,
        address: String,
        category: String?,
        businessHours: String?,
        price: String?,
        description: String?,
        contact: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSubmitting = true, error = null)
            try {
                val storeNameBody = storeName.trim().toRequestBody("text/plain".toMediaTypeOrNull())
                val provinceBody = province.trim().toRequestBody("text/plain".toMediaTypeOrNull())
                val cityBody = city.trim().toRequestBody("text/plain".toMediaTypeOrNull())
                val districtBody = district.trim().toRequestBody("text/plain".toMediaTypeOrNull())
                val addressBody = address.trim().toRequestBody("text/plain".toMediaTypeOrNull())
                val categoryBody = category?.takeIf { it.isNotBlank() }
                    ?.toRequestBody("text/plain".toMediaTypeOrNull())
                val businessHoursBody = businessHours?.takeIf { it.isNotBlank() }
                    ?.toRequestBody("text/plain".toMediaTypeOrNull())
                val priceBody = price?.takeIf { it.isNotBlank() }
                    ?.toRequestBody("text/plain".toMediaTypeOrNull())
                val descriptionBody = description?.takeIf { it.isNotBlank() }
                    ?.toRequestBody("text/plain".toMediaTypeOrNull())
                val contactBody = contact?.takeIf { it.isNotBlank() }
                    ?.toRequestBody("text/plain".toMediaTypeOrNull())
                val libraryImages = _uiState.value.uploadedImagePaths
                val libraryImagesJson = if (libraryImages.isNotEmpty()) {
                    val jsonArray = libraryImages.joinToString(",", "[", "]") { "\"$it\"" }
                    jsonArray.toRequestBody("text/plain".toMediaTypeOrNull())
                } else null

                val response = apiService.submitInfo(
                    storeName = storeNameBody,
                    province = provinceBody,
                    city = cityBody,
                    district = districtBody,
                    address = addressBody,
                    category = categoryBody,
                    businessHours = businessHoursBody,
                    price = priceBody,
                    description = descriptionBody,
                    contact = contactBody,
                    libraryImages = libraryImagesJson,
                    images = null
                )

                _uiState.value = _uiState.value.copy(isSubmitting = false)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        _uiState.value = _uiState.value.copy(uploadedImagePaths = emptyList())
                        onSuccess()
                    } else {
                        val msg = body.message ?: "投稿失败"
                        _uiState.value = _uiState.value.copy(error = msg)
                        onError(msg)
                    }
                } else {
                    val msg = ApiErrorUtil.fromResponse(response, "投稿失败")
                    _uiState.value = _uiState.value.copy(error = msg)
                    onError(msg)
                }
            } catch (e: Exception) {
                Log.e("SubmitViewModel", "submit", e)
                val msg = ApiErrorUtil.fromException(e, "投稿失败，请检查网络")
                _uiState.value = _uiState.value.copy(isSubmitting = false, error = msg)
                onError(msg)
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}

data class LocationMatch(
    val province: String,
    val city: String?,
    val district: String?
) {
    fun displayText(): String = listOfNotNull(province, city, district).joinToString(" ")
}

data class SubmitUiState(
    val isLoading: Boolean = false,
    val isSubmitting: Boolean = false,
    val isImageUploading: Boolean = false,
    val error: String? = null,
    val provinces: List<String> = emptyList(),
    val categories: List<String> = emptyList(),
    val regionsData: Map<String, RegionData> = emptyMap(),
    val selectedProvince: String? = null,
    val selectedCity: String? = null,
    val selectedDistrict: String? = null,
    val locationSearchQuery: String = "",
    val uploadedImagePaths: List<String> = emptyList()
)
