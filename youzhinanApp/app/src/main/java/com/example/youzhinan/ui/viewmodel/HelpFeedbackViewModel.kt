package com.example.youzhinan.ui.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.youzhinan.data.api.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class HelpFeedbackUiState(
    val messages: List<CustomerServiceMessage> = emptyList(),
    val quickQuestions: List<QuickQuestion> = emptyList(),
    val quickQuestionBatchIndex: Int = 0,
    val inputText: String = "",
    val isLoading: Boolean = true,
    val isSending: Boolean = false,
    val isRefreshingQuestions: Boolean = false,
    val error: String? = null
)

class HelpFeedbackViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(HelpFeedbackUiState())
    val uiState: StateFlow<HelpFeedbackUiState> = _uiState.asStateFlow()

    /** 每批展示 3 条，按 batchIndex 切片 */
    val displayedQuestions: List<QuickQuestion>
        get() {
            val all = _uiState.value.quickQuestions
            val idx = _uiState.value.quickQuestionBatchIndex
            val start = idx * 3
            return if (start >= all.size) emptyList() else all.drop(start).take(3)
        }

    /** 总条数 */
    val totalQuestionCount: Int get() = _uiState.value.quickQuestions.size

    /** 当前批次（1-based），共几批 */
    val currentBatchInfo: Pair<Int, Int>
        get() {
            val total = totalQuestionCount
            if (total == 0) return 0 to 0
            val batches = (total + 2) / 3
            val batch = (_uiState.value.quickQuestionBatchIndex % batches).coerceAtLeast(0)
            return (batch + 1) to batches
        }

    /** 清空聊天记录：调用后端接口并清空本地消息 */
    fun clearConversation() {
        viewModelScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.getApiService().clearCustomerServiceConversation()
                }
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        _uiState.update {
                            it.copy(messages = emptyList(), error = null)
                        }
                    } else {
                        _uiState.update {
                            it.copy(error = body.message ?: "清空失败")
                        }
                    }
                } else {
                    _uiState.update {
                        it.copy(error = when (response.code()) {
                            401 -> "请先登录"
                            else -> "清空失败"
                        })
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message ?: "清空失败")
                }
            }
        }
    }

    /** 后台刷新会话（不显示全屏 loading） */
    fun refreshConversation() {
        viewModelScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.getApiService().getCustomerServiceConversation()
                }
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        _uiState.update {
                            it.copy(messages = body.data?.messages ?: emptyList(), error = null)
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    fun loadConversation() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.getApiService().getCustomerServiceConversation()
                }
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        _uiState.update {
                            it.copy(
                                messages = body.data?.messages ?: emptyList(),
                                error = null,
                                isLoading = false
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                error = body.message ?: "加载失败",
                                isLoading = false
                            )
                        }
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            error = when (response.code()) {
                                401 -> "请先登录"
                                else -> "加载失败"
                            },
                            isLoading = false
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        error = e.message ?: "加载失败",
                        isLoading = false
                    )
                }
            }
        }
    }

    fun loadQuickQuestions() {
        viewModelScope.launch {
            _uiState.update { it.copy(isRefreshingQuestions = true) }
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.getApiService().getQuickQuestions()
                }
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val questions = body.data?.questions ?: emptyList()
                    if (body.code == 0 || body.code == 200) {
                        _uiState.update {
                            it.copy(
                                quickQuestions = questions,
                                quickQuestionBatchIndex = 0,
                                isRefreshingQuestions = false
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                quickQuestions = emptyList(),
                                quickQuestionBatchIndex = 0,
                                isRefreshingQuestions = false
                            )
                        }
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            quickQuestions = emptyList(),
                            quickQuestionBatchIndex = 0,
                            isRefreshingQuestions = false
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        quickQuestions = emptyList(),
                        quickQuestionBatchIndex = 0,
                        isRefreshingQuestions = false
                    )
                }
            }
        }
    }

    companion object {
        private const val TAG = "HelpFeedbackVM"
    }

    /** 从发送接口返回的 data 中提取自动回复，兼容多种后端字段名 */
    private fun extractAutoReply(data: SendMessageData): String? {
        val candidates = listOfNotNull(
            data.autoReply,
            data.autoReplyCamel,
            data.reply,
            data.replyContent,
            data.content,
            data.message?.content,
            data.message?.autoReply
        )
        val result = candidates.firstOrNull { it.isNotBlank() }
        if (result == null && Log.isLoggable(TAG, Log.DEBUG)) {
            Log.d(TAG, "send响应data无自动回复: autoReply=${data.autoReply}, reply=${data.reply}, content=${data.content}")
        }
        return result
    }

    /** 换一批：显示下一批 3 条，循环；若本地无数据则从后端拉取 */
    fun nextBatch() {
        val all = _uiState.value.quickQuestions
        if (all.isEmpty()) {
            loadQuickQuestions()
            return
        }
        val batches = (all.size + 2) / 3
        _uiState.update {
            val next = (it.quickQuestionBatchIndex + 1) % batches
            it.copy(quickQuestionBatchIndex = next)
        }
    }

    fun sendQuickQuestion(question: QuickQuestion) {
        if (_uiState.value.isSending) return
        _uiState.update { it.copy(isSending = true, error = null) }  // 同步设置，防止连点并发
        viewModelScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.getApiService().sendCustomerServiceMessage(
                        SendMessageRequest(content = question.keyword ?: question.text ?: question.questionText ?: "", triggerAutoReply = true)
                    )
                }
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        val data = body.data
                        val replyText = data?.let { extractAutoReply(it) }
                            ?: question.autoReply ?: question.reply
                        val ts = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).format(Date())
                        val userMsg = CustomerServiceMessage(
                            id = -1,
                            userId = null,
                            senderType = "user",
                            content = question.keyword ?: question.text ?: question.questionText ?: "",
                            isAutoReply = 0,
                            createdAt = ts
                        )
                        val autoReplyMsg = replyText?.takeIf { it.isNotBlank() }?.let { reply ->
                            CustomerServiceMessage(
                                id = -2,
                                senderType = "admin",
                                content = reply,
                                isAutoReply = 1,
                                createdAt = ts
                            )
                        }
                        val toAdd = listOf(userMsg) + (autoReplyMsg?.let { listOf(it) } ?: emptyList())
                        _uiState.update {
                            it.copy(
                                messages = it.messages + toAdd,
                                isSending = false,
                                error = null
                            )
                        }
                        // 不再调用 loadConversation，避免用可能未刷新的服务端数据覆盖刚发的消息
                    } else {
                        _uiState.update {
                            it.copy(
                                error = body.message ?: "发送失败",
                                isSending = false
                            )
                        }
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            error = when (response.code()) {
                                401 -> "请先登录"
                                400 -> "消息为空或超过 2000 字"
                                else -> "发送失败"
                            },
                            isSending = false
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(error = e.message ?: "发送失败", isSending = false)
                }
            }
        }
    }

    fun sendMessage(content: String) {
        val trimmed = content.trim()
        if (trimmed.isBlank() || _uiState.value.isSending) return
        if (trimmed.length > 2000) {
            _uiState.update { it.copy(error = "消息不能超过 2000 字") }
            return
        }
        _uiState.update { it.copy(isSending = true, error = null, inputText = "") }  // 同步设置
        viewModelScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.getApiService().sendCustomerServiceMessage(
                        SendMessageRequest(content = trimmed, triggerAutoReply = false)
                    )
                }
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.code == 0 || body.code == 200) {
                        val data = body.data
                        val replyText = data?.let { extractAutoReply(it) }
                        val ts = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).format(Date())
                        val userMsg = CustomerServiceMessage(
                            id = -1,
                            userId = null,
                            senderType = "user",
                            content = trimmed,
                            isAutoReply = 0,
                            createdAt = ts
                        )
                        val autoReplyMsg = replyText?.takeIf { it.isNotBlank() }?.let { reply ->
                            CustomerServiceMessage(
                                id = -2,
                                senderType = "admin",
                                content = reply,
                                isAutoReply = 1,
                                createdAt = ts
                            )
                        }
                        val toAdd = listOf(userMsg) + (autoReplyMsg?.let { listOf(it) } ?: emptyList())
                        _uiState.update {
                            it.copy(
                                messages = it.messages + toAdd,
                                isSending = false,
                                error = null,
                                inputText = ""
                            )
                        }
                        // 不再调用 loadConversation，避免覆盖刚发的消息
                    } else {
                        _uiState.update {
                            it.copy(
                                error = body.message ?: "发送失败",
                                inputText = trimmed,
                                isSending = false
                            )
                        }
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            error = when (response.code()) {
                                401 -> "请先登录"
                                400 -> "消息为空或超过 2000 字"
                                else -> "发送失败"
                            },
                            inputText = trimmed,
                            isSending = false
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        error = e.message ?: "发送失败",
                        inputText = trimmed,
                        isSending = false
                    )
                }
            }
        }
    }

    fun setInputText(text: String) {
        if (text.length <= 2000) {
            _uiState.update { it.copy(inputText = text) }
        }
    }
}
