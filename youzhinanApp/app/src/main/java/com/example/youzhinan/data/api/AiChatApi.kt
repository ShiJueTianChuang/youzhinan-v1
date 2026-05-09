package com.example.youzhinan.data.api

import retrofit2.Response
import retrofit2.http.*

interface AiChatApi {

    @POST("api/ai/chat")
    suspend fun chat(
        @Body request: ChatRequest
    ): Response<ApiResponse<ChatResponse>>

    @POST("api/ai/image-understand")
    suspend fun imageUnderstand(
        @Body request: ImageUnderstandRequest
    ): Response<ApiResponse<ChatResponse>>

    @POST("api/ai-model/bind")
    suspend fun bindAiModel(
        @Body request: BindAiModelRequest
    ): Response<ApiResponse<BindAiModelResponse>>

    @POST("api/ai-model/unbind")
    suspend fun unbindAiModel(): Response<ApiResponse<Unit>>

    @GET("api/ai-model/status")
    suspend fun getAiModelStatus(): Response<ApiResponse<AiModelStatus>>

    @POST("api/ai/file-analyze")
    suspend fun fileAnalyze(
        @Body request: FileAnalyzeRequest
    ): Response<ApiResponse<ChatResponse>>
}

data class ChatHistoryItem(
    val role: String,
    val content: String
)

data class ChatRequest(
    val message: String,
    val useCustomModel: Boolean = false,
    val conversationHistory: List<ChatHistoryItem> = emptyList(),
    val enableThinking: Boolean = false
)

data class ImageUnderstandRequest(
    val message: String,
    val imageBase64: String,
    val imageMimeType: String = "image/jpeg",
    val useCustomModel: Boolean = false,
    val conversationHistory: List<ChatHistoryItem> = emptyList()
)

data class ChatResponse(
    val reply: String,
    val thinking: String? = null,
    val model: String,
    val timestamp: Long
)

data class BindAiModelRequest(
    val provider: String,
    val apiKey: String,
    val modelName: String? = null
)

data class BindAiModelResponse(
    val id: Long,
    val provider: String,
    val modelName: String,
    val bindTime: Long
)

data class AiModelStatus(
    val isBound: Boolean,
    val provider: String?,
    val modelName: String?,
    val bindTime: Long?
)
