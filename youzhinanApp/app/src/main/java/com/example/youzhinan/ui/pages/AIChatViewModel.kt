package com.example.youzhinan.ui.pages

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.youzhinan.data.api.*
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStreamReader
import java.net.URL
import java.util.concurrent.TimeUnit

data class ChatMessage(
    val role: String,
    val content: String,
    val timestamp: Long,
    val thinking: String? = null,
    val imageUri: String? = null,
    val persistentUri: String? = null,
    val attachmentType: String? = null,
    val attachmentName: String? = null
)

data class AiChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val isLoading: Boolean = false,
    val isStreaming: Boolean = false,
    val streamingThinking: String = "",
    val streamingContent: String = "",
    val error: String? = null,
    val isLoggedIn: Boolean = false,
    val isBound: Boolean = false,
    val customModelName: String = "",
    val useCustomModel: Boolean = false,
    val useContext: Boolean = true,
    val enableThinking: Boolean = false,
    val autoRead: Boolean = false,
    val selectedImageUri: String? = null,
    val selectedFileUri: String? = null,
    val selectedFileName: String? = null,
    val showFirstUseDialog: Boolean = true,
    val avatarUrl: String? = null
)

class AIChatViewModel(
    application: Application
) : AndroidViewModel(application) {

    private val context: Context = application.applicationContext
    
    private val apiService: ApiService = RetrofitClient.getApiService()
    private val aiChatApiService: AiChatApi = RetrofitClient.getAiChatApiService()
    
    private val prefs: SharedPreferences = context.getSharedPreferences("AIChatPrefs", Context.MODE_PRIVATE)
    
    private val _uiState = MutableStateFlow(AiChatUiState())
    val uiState: StateFlow<AiChatUiState> = _uiState

    private val gson = Gson()
    
    private var currentUserId: Int = 0
    
    private fun getPrefKey(key: String): String {
        return if (currentUserId > 0) "user_${currentUserId}_$key" else key
    }

    private val sseClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    init {
        loadCurrentUserId()
        loadMessages()
        checkLoginStatus()
        loadAvatarFromLoginPrefs()
    }
    
    private fun loadCurrentUserId() {
        val loginPrefs = context.getSharedPreferences("UserInfo", Context.MODE_PRIVATE)
        currentUserId = loginPrefs.getInt("userId", 0)
    }

    private fun loadAvatarFromLoginPrefs() {
        val loginPrefs = context.getSharedPreferences("UserInfo", Context.MODE_PRIVATE)
        val avatarUrl = loginPrefs.getString("avatarUrl", null)
        if (avatarUrl != null) {
            _uiState.value = _uiState.value.copy(avatarUrl = avatarUrl)
        }
    }

    private suspend fun copyImageToAppStorage(sourceUri: String): String? = withContext(Dispatchers.IO) {
        try {
            val inputStream = context.contentResolver.openInputStream(Uri.parse(sourceUri)) ?: return@withContext null
            val fileName = "img_${System.currentTimeMillis()}.jpg"
            val outputFile = File(context.filesDir, fileName)
            inputStream.use { input ->
                outputFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
            Uri.fromFile(outputFile).toString()
        } catch (e: Exception) {
            Log.e("AIChatViewModel", "Failed to copy image to storage", e)
            null
        }
    }

    fun refreshLoginState() {
        loadCurrentUserId()
        loadMessages()
        checkLoginStatus()
    }

    private fun checkLoginStatus() {
        val token = RetrofitClient.getToken()
        val isLoggedIn = !token.isNullOrEmpty()
        _uiState.value = _uiState.value.copy(isLoggedIn = isLoggedIn)
        if (isLoggedIn) {
            loadBindingStatus()
        } else {
            _uiState.value = _uiState.value.copy(
                isBound = false,
                customModelName = "",
                useCustomModel = false
            )
        }
    }

    fun loadBindingStatus() {
        viewModelScope.launch {
            try {
                val response = aiChatApiService.getAiModelStatus()
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        val status = body.data
                        val isBound = status?.isBound == true
                        val customName = if (isBound) status?.modelName ?: status?.provider ?: "" else ""
                        val useCustomKey = getPrefKey("useCustomModel")
                        val useCustom = if (isBound && !prefs.contains(useCustomKey)) {
                            true
                        } else {
                            prefs.getBoolean(useCustomKey, false)
                        }
                        _uiState.value = _uiState.value.copy(
                            isBound = isBound,
                            customModelName = customName,
                            useCustomModel = useCustom
                        )
                    }
                }
            } catch (e: Exception) {
                Log.e("AIChatViewModel", "加载绑定状态失败", e)
            }
        }
    }

    fun bindAiModel(
        provider: String,
        apiKey: String,
        modelName: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val request = BindAiModelRequest(
                    provider = provider,
                    apiKey = apiKey,
                    modelName = modelName
                )
                val response = aiChatApiService.bindAiModel(request)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        val boundModelName = body.data?.modelName ?: provider
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isBound = true,
                            customModelName = boundModelName,
                            useCustomModel = true
                        )
                        onSuccess()
                    } else {
                        _uiState.value = _uiState.value.copy(isLoading = false)
                        onError(body.message ?: "绑定失败")
                    }
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    onError("绑定失败，请重试")
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                onError("绑定失败：${e.message}")
            }
        }
    }

    fun unbindAiModel(onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val response = aiChatApiService.unbindAiModel()
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isBound = false,
                            customModelName = "",
                            useCustomModel = false
                        )
                        onSuccess()
                    } else {
                        _uiState.value = _uiState.value.copy(isLoading = false)
                        onError(body.message ?: "解绑失败")
                    }
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    onError("解绑失败，请重试")
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                onError("解绑失败：${e.message}")
            }
        }
    }

    fun toggleUseCustomModel(context: Context, useCustom: Boolean) {
        if (useCustom && !_uiState.value.isBound) {
            return
        }
        _uiState.value = _uiState.value.copy(
            useCustomModel = useCustom
        )
        prefs.edit().putBoolean(getPrefKey("useCustomModel"), useCustom).apply()
    }

    fun toggleUseContext() {
        val newState = !_uiState.value.useContext
        _uiState.value = _uiState.value.copy(useContext = newState)
        prefs.edit().putBoolean(getPrefKey("useContext"), newState).apply()
    }

    fun toggleEnableThinking() {
        _uiState.value = _uiState.value.copy(
            enableThinking = !_uiState.value.enableThinking
        )
    }

    fun toggleAutoRead() {
        _uiState.value = _uiState.value.copy(
            autoRead = !_uiState.value.autoRead
        )
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun dismissFirstUseDialog() {
        _uiState.value = _uiState.value.copy(showFirstUseDialog = false)
        prefs.edit().putBoolean("hasShownFirstUse", true).apply()
    }

    fun selectImage(uri: String) {
        _uiState.value = _uiState.value.copy(
            selectedImageUri = uri,
            selectedFileUri = null,
            selectedFileName = null
        )
    }

    fun clearSelectedImage() {
        _uiState.value = _uiState.value.copy(selectedImageUri = null)
    }

    fun selectFile(uri: String, fileName: String) {
        _uiState.value = _uiState.value.copy(
            selectedFileUri = uri,
            selectedFileName = fileName,
            selectedImageUri = null
        )
    }

    fun clearSelectedFile() {
        _uiState.value = _uiState.value.copy(selectedFileUri = null, selectedFileName = null)
    }

    fun sendMessage(content: String) {
        if (content.isBlank() && _uiState.value.selectedImageUri == null) return

        _uiState.value = _uiState.value.copy(error = null)

        val selectedImage = _uiState.value.selectedImageUri
        
        if (selectedImage != null) {
            sendImageMessage(content, selectedImage)
            return
        }
        
        clearSelectedImage()
        
        val userMessage = ChatMessage(
            role = "user",
            content = content,
            timestamp = System.currentTimeMillis()
        )
        
        val updatedMessages = _uiState.value.messages + userMessage
        _uiState.value = _uiState.value.copy(
            messages = updatedMessages,
            isLoading = true,
            isStreaming = true,
            streamingThinking = "",
            streamingContent = "",
            error = null
        )
        
        saveMessage(userMessage)
        callStreamingChat(content, updatedMessages)
    }

    private fun sendImageMessage(content: String, imageUri: String) {
        clearSelectedImage()
        
        viewModelScope.launch {
            val persistentUri = copyImageToAppStorage(imageUri)
            
            val userMessage = ChatMessage(
                role = "user",
                content = content,
                timestamp = System.currentTimeMillis(),
                imageUri = imageUri,
                persistentUri = persistentUri
            )
            
            val updatedMessages = _uiState.value.messages + userMessage
            _uiState.value = _uiState.value.copy(
                messages = updatedMessages,
                isLoading = true,
                isStreaming = true,
                streamingThinking = "",
                streamingContent = "",
                error = null
            )
            
            saveMessage(userMessage)
            callImageUnderstand(content, imageUri, updatedMessages, persistentUri)
        }
    }

    private fun callStreamingChat(message: String, updatedMessages: List<ChatMessage>) {
        viewModelScope.launch {
            try {
                val token = RetrofitClient.getToken()
                val conversationHistory = if (_uiState.value.useContext) {
                    updatedMessages.takeLast(10).map { ChatHistoryItem(it.role, it.content) }
                } else {
                    emptyList()
                }

                val chatRequest = ChatRequest(
                    message = message,
                    useCustomModel = _uiState.value.useCustomModel,
                    conversationHistory = conversationHistory,
                    enableThinking = _uiState.value.enableThinking
                )

                val jsonBody = gson.toJson(chatRequest)
                val requestBody = jsonBody.toRequestBody("application/json; charset=utf-8".toMediaType())

                val request = Request.Builder()
                    .url("${ApiConfig.BASE_URL}api/ai/chat-stream")
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer $token")
                    .build()

                sseClient.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        viewModelScope.launch {
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                isStreaming = false,
                                error = "网络请求失败：${e.message}"
                            )
                        }
                    }

                    override fun onResponse(call: Call, response: Response) {
                        if (!response.isSuccessful) {
                            val errorBody = response.body?.string()
                            var errorMsg = "请求失败：HTTP ${response.code}"
                            try {
                                val errorJson = gson.fromJson(errorBody, com.google.gson.JsonObject::class.java)
                                val msg = errorJson?.get("message")?.asString
                                if (!msg.isNullOrEmpty()) {
                                    errorMsg = msg
                                }
                            } catch (e: Exception) {
                            }
                            viewModelScope.launch {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    isStreaming = false,
                                    error = errorMsg
                                )
                            }
                            return
                        }

                        val reader = response.body?.byteStream()?.bufferedReader()
                        if (reader == null) {
                            viewModelScope.launch {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    isStreaming = false,
                                    error = "响应为空"
                                )
                            }
                            return
                        }

                        var fullThinking = ""
                        var fullContent = ""
                        var finalModel = ""

                        try {
                            reader.forEachLine { line ->
                                val trimmed = line.trim()
                                if (trimmed.isEmpty() || !trimmed.startsWith("data: ")) return@forEachLine

                                val data = trimmed.substring(6)
                                if (data == "[DONE]") {
                                    viewModelScope.launch {
                                        val assistantMessage = ChatMessage(
                                            role = "assistant",
                                            content = fullContent,
                                            timestamp = System.currentTimeMillis(),
                                            thinking = if (fullThinking.isNotBlank()) fullThinking else null
                                        )
                                        
                                        _uiState.value = _uiState.value.copy(
                                            messages = _uiState.value.messages + assistantMessage,
                                            isLoading = false,
                                            isStreaming = false,
                                            streamingThinking = "",
                                            streamingContent = ""
                                        )
                                        
                                        saveMessage(assistantMessage)
                                    }
                                    return@forEachLine
                                }

                                try {
                                    val jsonObject = gson.fromJson(data, com.google.gson.JsonObject::class.java)
                                    val type = jsonObject.get("type")?.asString

                                    when (type) {
                                        "chunk" -> {
                                            val contentChunk = jsonObject.get("content")?.asString ?: ""
                                            val reasoningChunk = jsonObject.get("reasoning_content")?.asString ?: ""

                                            if (reasoningChunk.isNotBlank()) {
                                                fullThinking += reasoningChunk
                                            }
                                            if (contentChunk.isNotBlank()) {
                                                fullContent += contentChunk
                                            }

                                            viewModelScope.launch {
                                                _uiState.value = _uiState.value.copy(
                                                    streamingThinking = fullThinking,
                                                    streamingContent = fullContent
                                                )
                                            }
                                        }
                                        "complete" -> {
                                            val thinking = jsonObject.get("thinking")?.asString ?: ""
                                            val content = jsonObject.get("content")?.asString ?: ""
                                            val model = jsonObject.get("model")?.asString ?: ""
                                            val imageUrl = jsonObject.get("image")?.asString 
                                                ?: jsonObject.get("image_url")?.asString
                                                ?: jsonObject.get("imageUrl")?.asString

                                            if (thinking.isNotBlank()) fullThinking = thinking
                                            if (content.isNotBlank()) fullContent = content
                                            if (model.isNotBlank()) finalModel = model
                                            if (!imageUrl.isNullOrBlank()) {
                                                viewModelScope.launch {
                                                    val localUri = downloadAndSaveImage(imageUrl)
                                                    val assistantMessage = ChatMessage(
                                                        role = "assistant",
                                                        content = fullContent,
                                                        timestamp = System.currentTimeMillis(),
                                                        thinking = if (fullThinking.isNotBlank()) fullThinking else null,
                                                        imageUri = imageUrl,
                                                        persistentUri = localUri
                                                    )
                                                    
                                                    _uiState.value = _uiState.value.copy(
                                                        messages = _uiState.value.messages + assistantMessage,
                                                        isLoading = false,
                                                        isStreaming = false,
                                                        streamingThinking = "",
                                                        streamingContent = ""
                                                    )
                                                    
                                                    saveMessage(assistantMessage.copy(imageUri = imageUrl))
                                                }
                                                return@forEachLine
                                            }
                                        }
                                        "error" -> {
                                            val errorMsg = jsonObject.get("message")?.asString ?: "未知错误"
                                            viewModelScope.launch {
                                                _uiState.value = _uiState.value.copy(
                                                    isLoading = false,
                                                    isStreaming = false,
                                                    error = errorMsg
                                                )
                                            }
                                        }
                                    }
                                } catch (e: Exception) {
                                    Log.e("AIChatViewModel", "解析SSE数据失败", e)
                                }
                            }
                        } catch (e: Exception) {
                            viewModelScope.launch {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    isStreaming = false,
                                    error = "读取响应失败：${e.message}"
                                )
                            }
                        } finally {
                            reader.close()
                        }
                    }
                })
            } catch (e: Exception) {
                Log.e("AIChatViewModel", "发送消息失败", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isStreaming = false,
                    error = "发送失败：${e.message}"
                )
            }
        }
    }

    private fun callImageUnderstand(message: String, imageUri: String, updatedMessages: List<ChatMessage>, originalImagePersistentUri: String?) {
        viewModelScope.launch {
            try {
                val token = RetrofitClient.getToken()
                val imageBase64 = readFileAsBase64(imageUri)
                val mimeType = getImageMimeType(imageUri)

                val conversationHistory = if (_uiState.value.useContext) {
                    updatedMessages.takeLast(10).map { ChatHistoryItem(it.role, it.content) }
                } else {
                    emptyList()
                }

                val request = ImageUnderstandRequest(
                    message = message,
                    imageBase64 = imageBase64,
                    imageMimeType = mimeType,
                    useCustomModel = _uiState.value.useCustomModel,
                    conversationHistory = conversationHistory
                )

                val jsonBody = gson.toJson(request)
                val requestBody = jsonBody.toRequestBody("application/json; charset=utf-8".toMediaType())

                val httpReq = Request.Builder()
                    .url("${ApiConfig.BASE_URL}api/ai/image-understand")
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer $token")
                    .addHeader("Accept", "text/event-stream")
                    .build()

                sseClient.newCall(httpReq).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        viewModelScope.launch {
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                isStreaming = false,
                                error = "网络请求失败：${e.message}"
                            )
                        }
                    }

                    override fun onResponse(call: Call, response: Response) {
                        if (!response.isSuccessful) {
                            viewModelScope.launch {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    isStreaming = false,
                                    error = "请求失败：HTTP ${response.code}"
                                )
                            }
                            return
                        }

                        val reader = response.body?.byteStream()?.bufferedReader()
                        if (reader == null) {
                            viewModelScope.launch {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    isStreaming = false,
                                    error = "响应为空"
                                )
                            }
                            return
                        }

                        var fullThinking = ""
                        var fullContent = ""
                        var finalModel = ""

                        try {
                            reader.forEachLine { line ->
                                val trimmed = line.trim()
                                if (trimmed.isEmpty() || !trimmed.startsWith("data: ")) return@forEachLine

                                val data = trimmed.substring(6)
                                if (data == "[DONE]") {
                                    viewModelScope.launch {
                                        val responseImageUrl = extractImageUrl(fullContent)
                                        var assistantPersistentUri: String? = null
                                        var assistantImageUri: String? = null
                                        var assistantContent = fullContent

                                        if (responseImageUrl != null) {
                                            assistantImageUri = responseImageUrl
                                            assistantPersistentUri = downloadAndSaveImage(responseImageUrl)
                                            assistantContent = fullContent.replace(responseImageUrl, "").trim()
                                        } else if (originalImagePersistentUri != null) {
                                            assistantImageUri = originalImagePersistentUri
                                            assistantPersistentUri = originalImagePersistentUri
                                        }

                                        val assistantMessage = ChatMessage(
                                            role = "assistant",
                                            content = assistantContent,
                                            timestamp = System.currentTimeMillis(),
                                            thinking = if (fullThinking.isNotBlank()) fullThinking else null,
                                            imageUri = assistantImageUri,
                                            persistentUri = assistantPersistentUri
                                        )
                                        
                                        val currentMessages = _uiState.value.messages + assistantMessage
                                        _uiState.value = _uiState.value.copy(
                                            messages = currentMessages,
                                            isLoading = false,
                                            isStreaming = false,
                                            streamingThinking = "",
                                            streamingContent = "",
                                            selectedImageUri = null
                                        )
                                        
                                        saveMessage(assistantMessage)
                                    }
                                    return@forEachLine
                                }

                                try {
                                    val jsonObject = gson.fromJson(data, com.google.gson.JsonObject::class.java)
                                    val type = jsonObject.get("type")?.asString

                                    when (type) {
                                        "chunk" -> {
                                            val contentChunk = jsonObject.get("content")?.asString ?: ""
                                            val reasoningChunk = jsonObject.get("reasoning_content")?.asString ?: ""

                                            if (reasoningChunk.isNotBlank()) {
                                                fullThinking += reasoningChunk
                                            }
                                            if (contentChunk.isNotBlank()) {
                                                fullContent += contentChunk
                                            }

                                            viewModelScope.launch {
                                                _uiState.value = _uiState.value.copy(
                                                    streamingThinking = fullThinking,
                                                    streamingContent = fullContent
                                                )
                                            }
                                        }
                                        "complete" -> {
                                            val thinking = jsonObject.get("thinking")?.asString ?: ""
                                            val content = jsonObject.get("content")?.asString ?: ""
                                            val model = jsonObject.get("model")?.asString ?: ""

                                            if (thinking.isNotBlank()) fullThinking = thinking
                                            if (content.isNotBlank()) fullContent = content
                                            if (model.isNotBlank()) finalModel = model
                                        }
                                        "error" -> {
                                            val errorMsg = jsonObject.get("message")?.asString ?: "未知错误"
                                            viewModelScope.launch {
                                                _uiState.value = _uiState.value.copy(
                                                    isLoading = false,
                                                    isStreaming = false,
                                                    error = errorMsg
                                                )
                                            }
                                        }
                                    }
                                } catch (e: Exception) {
                                    Log.e("AIChatViewModel", "解析SSE数据失败", e)
                                }
                            }
                        } catch (e: Exception) {
                            viewModelScope.launch {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    isStreaming = false,
                                    error = "读取响应失败：${e.message}"
                                )
                            }
                        } finally {
                            reader.close()
                        }
                    }
                })
            } catch (e: Exception) {
                Log.e("AIChatViewModel", "图片识别失败", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isStreaming = false,
                    error = "图片识别失败：${e.message}"
                )
            }
        }
    }

    private fun extractImageUrl(content: String): String? {
        val trimmed = content.trim()
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
            return trimmed
        }
        return null
    }

    private suspend fun readFileAsBase64(uri: String): String = withContext(Dispatchers.IO) {
        val contentResolver = context.contentResolver
        val uriObj = Uri.parse(uri)
        val inputStream = contentResolver.openInputStream(uriObj)
        val bytes = inputStream?.readBytes() ?: throw IllegalArgumentException("无法读取文件")
        inputStream.close()
        android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
    }

    private fun getImageMimeType(uri: String): String {
        return try {
            val contentResolver = context.contentResolver
            val uriObj = Uri.parse(uri)
            val mimeType = contentResolver.getType(uriObj)
            mimeType ?: "image/jpeg"
        } catch (e: Exception) {
            "image/jpeg"
        }
    }

    fun sendFileMessage(content: String, fileUri: String, fileName: String) {
        if (content.isBlank() && fileUri.isBlank()) return
        
        val tempFileUri = fileUri
        val tempFileName = fileName
        clearSelectedFile()
        
        val userMessage = ChatMessage(
            role = "user",
            content = content,
            timestamp = System.currentTimeMillis(),
            attachmentType = "file",
            attachmentName = tempFileName
        )
        
        val updatedMessages = _uiState.value.messages + userMessage
        _uiState.value = _uiState.value.copy(
            messages = updatedMessages,
            isLoading = true,
            isStreaming = true,
            streamingThinking = "",
            streamingContent = "",
            error = null
        )
        
        saveMessage(userMessage)
        
        viewModelScope.launch {
            try {
                val token = RetrofitClient.getToken()
                val fileBase64 = readFileAsBase64(tempFileUri)
                
                val conversationHistory = if (_uiState.value.useContext) {
                    updatedMessages.takeLast(10).map { ChatHistoryItem(it.role, it.content) }
                } else {
                    emptyList()
                }

                val request = FileAnalyzeRequest(
                    message = content,
                    fileBase64 = fileBase64,
                    fileName = tempFileName,
                    useCustomModel = _uiState.value.useCustomModel,
                    conversationHistory = conversationHistory
                )

                val jsonBody = gson.toJson(request)
                val requestBody = jsonBody.toRequestBody("application/json; charset=utf-8".toMediaType())

                val httpReq = Request.Builder()
                    .url("${ApiConfig.BASE_URL}api/ai/file-analyze-stream")
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer $token")
                    .build()

                sseClient.newCall(httpReq).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        viewModelScope.launch {
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                isStreaming = false,
                                error = "网络请求失败：${e.message}"
                            )
                        }
                    }

                    override fun onResponse(call: Call, response: Response) {
                        if (!response.isSuccessful) {
                            viewModelScope.launch {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    isStreaming = false,
                                    error = "请求失败：HTTP ${response.code}"
                                )
                            }
                            return
                        }

                        val reader = response.body?.byteStream()?.bufferedReader()
                        if (reader == null) {
                            viewModelScope.launch {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    isStreaming = false,
                                    error = "响应为空"
                                )
                            }
                            return
                        }

                        var fullThinking = ""
                        var fullContent = ""

                        try {
                            reader.forEachLine { line ->
                                val trimmed = line.trim()
                                if (trimmed.isEmpty() || !trimmed.startsWith("data: ")) return@forEachLine

                                val data = trimmed.substring(6)
                                if (data == "[DONE]") {
                                    viewModelScope.launch {
                                        val assistantMessage = ChatMessage(
                                            role = "assistant",
                                            content = fullContent,
                                            timestamp = System.currentTimeMillis(),
                                            thinking = if (fullThinking.isNotBlank()) fullThinking else null
                                        )
                                        
                                        _uiState.value = _uiState.value.copy(
                                            messages = _uiState.value.messages + assistantMessage,
                                            isLoading = false,
                                            isStreaming = false,
                                            streamingThinking = "",
                                            streamingContent = ""
                                        )
                                        
                                        saveMessage(assistantMessage)
                                    }
                                    return@forEachLine
                                }

                                try {
                                    val jsonObject = gson.fromJson(data, com.google.gson.JsonObject::class.java)
                                    val type = jsonObject.get("type")?.asString

                                    when (type) {
                                        "chunk" -> {
                                            val contentChunk = jsonObject.get("content")?.asString ?: ""
                                            val reasoningChunk = jsonObject.get("reasoning_content")?.asString ?: ""

                                            if (reasoningChunk.isNotBlank()) {
                                                fullThinking += reasoningChunk
                                            }
                                            if (contentChunk.isNotBlank()) {
                                                fullContent += contentChunk
                                            }

                                            viewModelScope.launch {
                                                _uiState.value = _uiState.value.copy(
                                                    streamingThinking = fullThinking,
                                                    streamingContent = fullContent
                                                )
                                            }
                                        }
                                        "complete" -> {
                                            val thinking = jsonObject.get("thinking")?.asString ?: ""
                                            val content = jsonObject.get("content")?.asString ?: ""

                                            if (thinking.isNotBlank()) fullThinking = thinking
                                            if (content.isNotBlank()) fullContent = content
                                        }
                                        "error" -> {
                                            val errorMsg = jsonObject.get("message")?.asString ?: "未知错误"
                                            viewModelScope.launch {
                                                _uiState.value = _uiState.value.copy(
                                                    isLoading = false,
                                                    isStreaming = false,
                                                    error = errorMsg
                                                )
                                            }
                                        }
                                    }
                                } catch (e: Exception) {
                                    Log.e("AIChatViewModel", "解析SSE数据失败", e)
                                }
                            }
                        } catch (e: Exception) {
                            viewModelScope.launch {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    isStreaming = false,
                                    error = "读取响应失败：${e.message}"
                                )
                            }
                        } finally {
                            reader.close()
                        }
                    }
                })
            } catch (e: Exception) {
                Log.e("AIChatViewModel", "发送文件失败", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isStreaming = false,
                    error = "发送失败：${e.message}"
                )
            }
        }
    }

    private fun saveMessage(message: ChatMessage) {
        viewModelScope.launch {
            var savedMessage = message
            
            if (message.imageUri != null && message.persistentUri == null) {
                val localUri = downloadAndSaveImage(message.imageUri)
                savedMessage = message.copy(persistentUri = localUri)
            }
            
            val messagesJson = prefs.getString(getPrefKey("messages"), "[]") ?: "[]"
            val type = object : com.google.gson.reflect.TypeToken<List<ChatMessage>>() {}.type
            val messageList: MutableList<ChatMessage> = try {
                gson.fromJson(messagesJson, type)
            } catch (e: Exception) {
                mutableListOf()
            }
            
            messageList.add(savedMessage)
            val updatedJson = gson.toJson(messageList)
            prefs.edit().putString(getPrefKey("messages"), updatedJson).apply()
            
            if (savedMessage.persistentUri != null) {
                _uiState.value = _uiState.value.copy(
                    messages = _uiState.value.messages.filter { it.timestamp != savedMessage.timestamp } + savedMessage
                )
            }
        }
    }
    
    private suspend fun downloadAndSaveImage(imageUrl: String): String? = withContext(Dispatchers.IO) {
        try {
            if (imageUrl.startsWith("data:image")) {
                val base64Data = imageUrl.substringAfter(",")
                val bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                val fileName = "ai_img_${System.currentTimeMillis()}.jpg"
                val outputFile = File(context.filesDir, fileName)
                outputFile.writeBytes(bytes)
                return@withContext Uri.fromFile(outputFile).toString()
            }
            
            if (imageUrl.startsWith("file://") || imageUrl.startsWith("content://")) {
                return@withContext imageUrl
            }
            
            val fileName = "ai_img_${System.currentTimeMillis()}.jpg"
            val outputFile = File(context.filesDir, fileName)
            
            val connection = URL(imageUrl).openConnection()
            connection.connectTimeout = 15000
            connection.readTimeout = 30000
            connection.getInputStream().use { input ->
                FileOutputStream(outputFile).use { output ->
                    input.copyTo(output)
                }
            }
            
            Uri.fromFile(outputFile).toString()
        } catch (e: Exception) {
            Log.e("AIChatViewModel", "Failed to download image", e)
            null
        }
    }

    private fun loadMessages() {
        try {
            val messagesJson = prefs.getString(getPrefKey("messages"), "[]") ?: "[]"
            val type = object : com.google.gson.reflect.TypeToken<List<ChatMessage>>() {}.type
            val messageList: List<ChatMessage> = gson.fromJson(messagesJson, type)
            
            _uiState.value = _uiState.value.copy(messages = messageList)
            
            val hasShownFirstUse = prefs.getBoolean("hasShownFirstUse", false)
            val useContext = prefs.getBoolean(getPrefKey("useContext"), true)
            val useCustomModel = prefs.getBoolean(getPrefKey("useCustomModel"), false)
            val autoRead = prefs.getBoolean(getPrefKey("autoRead"), false)
            
            _uiState.value = _uiState.value.copy(
                showFirstUseDialog = !hasShownFirstUse,
                useContext = useContext,
                useCustomModel = useCustomModel,
                autoRead = autoRead
            )
        } catch (e: Exception) {
            Log.e("AIChatViewModel", "加载消息失败", e)
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(
            messages = emptyList(),
            error = null
        )
        prefs.edit().putString(getPrefKey("messages"), "[]").apply()
    }
}
