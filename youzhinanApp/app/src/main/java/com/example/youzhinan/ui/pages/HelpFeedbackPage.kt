package com.example.youzhinan.ui.pages

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Headset
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.example.youzhinan.data.api.CustomerServiceMessage
import com.example.youzhinan.ui.viewmodel.HelpFeedbackViewModel
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

/**
 * 帮助与反馈 / 客服聊天页
 * 每批展示 3 条快捷问题，点击「换一批」切换
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HelpFeedbackPage(
    navController: NavHostController,
    viewModel: HelpFeedbackViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    var isQuickReplyExpanded by remember { mutableStateOf(false) }
    var showClearConfirmDialog by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current

    LaunchedEffect(Unit) {
        viewModel.loadConversation()
        viewModel.loadQuickQuestions()
    }

    // 每 30 秒从后端拉取最新客服数据
    LaunchedEffect(Unit) {
        while (true) {
            delay(30_000L)
            viewModel.loadQuickQuestions()
            viewModel.refreshConversation()
        }
    }

    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) {
            delay(150)
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "帮助与反馈",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "客服",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFF1A1A1A),
                    titleContentColor = Color.White
                ),
                actions = {
                    if (uiState.messages.isNotEmpty()) {
                        IconButton(
                            onClick = { showClearConfirmDialog = true },
                            modifier = Modifier.padding(end = 4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.DeleteSweep,
                                contentDescription = "清空聊天记录",
                                tint = Color.White
                            )
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        if (showClearConfirmDialog) {
            AlertDialog(
                onDismissRequest = { showClearConfirmDialog = false },
                title = { Text("清空聊天记录") },
                text = { Text("确定要清空所有聊天记录吗？此操作不可恢复。") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showClearConfirmDialog = false
                            viewModel.clearConversation()
                        }
                    ) {
                        Text("确定", color = Color(0xFFB00020), fontWeight = FontWeight.Medium)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showClearConfirmDialog = false }) {
                        Text("取消", color = Color(0xFF616161))
                    }
                }
            )
        }
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFFF5F5F5))
                .imePadding()
        ) {
            // ─── 分隔线 + 对话区标题 ───
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HorizontalDivider(
                    modifier = Modifier.weight(1f),
                    color = Color(0xFFE0E0E0),
                    thickness = 1.dp
                )
                Text(
                    text = " 对话记录 ",
                    fontSize = 13.sp,
                    color = Color(0xFF757575),
                    modifier = Modifier.padding(horizontal = 12.dp)
                )
                HorizontalDivider(
                    modifier = Modifier.weight(1f),
                    color = Color(0xFFE0E0E0),
                    thickness = 1.dp
                )
            }

            // ─── 区域二：聊天消息 ───
            when {
                uiState.isLoading && uiState.messages.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = Color(0xFF1A1A1A))
                    }
                }
                uiState.error != null && uiState.messages.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.Headset,
                                contentDescription = null,
                                modifier = Modifier.size(48.dp),
                                tint = Color.Gray
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = uiState.error!!,
                                fontSize = 15.sp,
                                color = Color.Gray,
                                textAlign = TextAlign.Center
                            )
                            if (uiState.error == "请先登录") {
                                Spacer(modifier = Modifier.height(16.dp))
                                Button(
                                    onClick = {
                                        navController.navigate("passwordLogin") {
                                            popUpTo("profile") { inclusive = false }
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A1A1A))
                                ) {
                                    Text("去登录")
                                }
                            }
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        state = listState,
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        if (uiState.messages.isEmpty() && !uiState.isLoading) {
                            item {
                                Box(
                                    modifier = Modifier.fillMaxWidth(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "暂无消息，发送内容开始咨询",
                                        fontSize = 14.sp,
                                        color = Color.Gray
                                    )
                                }
                            }
                        }
                        items(
                            items = uiState.messages,
                            key = { msg -> "${msg.id}_${msg.createdAt}_${msg.content.take(20)}" }
                        ) { msg ->
                            ChatMessageItem(message = msg)
                        }
                    }
                }
            }

            uiState.error?.let { err ->
                if (err != "请先登录" && uiState.messages.isNotEmpty()) {
                    Text(
                        text = err,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                    )
                }
            }

            // ─── 智能快捷回复（输入框上方，加粗边框更明显） ───
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0xFFF8F8F8),
                shadowElevation = 3.dp,
                tonalElevation = 0.dp,
                border = BorderStroke(1.dp, Color(0xFFE0E0E0))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { isQuickReplyExpanded = !isQuickReplyExpanded },
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .width(4.dp)
                                    .height(16.dp)
                                    .background(Color(0xFF424242), RoundedCornerShape(2.dp))
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "智能快捷回复",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF333333)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(
                                imageVector = if (isQuickReplyExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                contentDescription = if (isQuickReplyExpanded) "收起" else "展开",
                                modifier = Modifier.size(20.dp),
                                tint = Color(0xFF424242)
                            )
                        }
                        if (!isQuickReplyExpanded) {
                            Text(
                                text = "点击展开",
                                fontSize = 12.sp,
                                color = Color(0xFF616161),
                                fontWeight = FontWeight.Medium
                            )
                        }
                        if (isQuickReplyExpanded) {
                            TextButton(
                                onClick = { viewModel.nextBatch() },
                                enabled = !uiState.isRefreshingQuestions,
                                colors = ButtonDefaults.textButtonColors(contentColor = Color(0xFF757575)),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                modifier = Modifier.height(32.dp)
                            ) {
                                if (uiState.isRefreshingQuestions) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        color = Color(0xFF757575),
                                        strokeWidth = 2.dp
                                    )
                                } else {
                                    Text("换一批", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                }
                            }
                        }
                    }
                    if (isQuickReplyExpanded) {
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "点下方问题可快速获得回复",
                            fontSize = 11.sp,
                            color = Color(0xFF9E9E9E)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        val questionsToShow = viewModel.displayedQuestions
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 165.dp)
                                .verticalScroll(rememberScrollState()),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            if (questionsToShow.isEmpty() && !uiState.isRefreshingQuestions) {
                                Text(
                                    text = "暂无常见问题，点击换一批刷新",
                                    fontSize = 12.sp,
                                    color = Color(0xFF9E9E9E),
                                    modifier = Modifier.padding(vertical = 6.dp)
                                )
                            } else {
                                questionsToShow.forEach { q ->
                                    Surface(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                focusManager.clearFocus()
                                                keyboardController?.hide()
                                                viewModel.sendQuickQuestion(q)
                                            },
                                        shape = RoundedCornerShape(8.dp),
                                        color = Color.White,
                                        border = BorderStroke(1.dp, Color(0xFFD0D0D0))
                                    ) {
                                        Text(
                                            text = q.text ?: q.questionText ?: q.keyword ?: "",
                                            fontSize = 14.sp,
                                            color = Color(0xFF333333),
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                                if (viewModel.totalQuestionCount > 3) {
                                    Text(
                                        text = "↑ 第 ${viewModel.currentBatchInfo.first}/${viewModel.currentBatchInfo.second} 批",
                                        fontSize = 10.sp,
                                        color = Color(0xFF9E9E9E),
                                        modifier = Modifier.padding(top = 2.dp)
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Box(
                            modifier = Modifier.fillMaxWidth(),
                            contentAlignment = Alignment.Center
                        ) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFF0F0F0),
                                modifier = Modifier.clickable { isQuickReplyExpanded = false }
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 5.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.ExpandLess,
                                        contentDescription = null,
                                        modifier = Modifier.size(14.dp),
                                        tint = Color(0xFF757575)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "收起",
                                        fontSize = 11.sp,
                                        color = Color(0xFF616161),
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ─── 输入框区域（浅灰底+边框，易分辨） ───
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF5F5F5))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(18.dp),
                    color = Color.White,
                    shadowElevation = 1.dp,
                    border = BorderStroke(1.dp, Color(0xFFD0D0D0))
                ) {
                    BasicTextField(
                        value = uiState.inputText,
                        onValueChange = { viewModel.setInputText(it) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 6.dp)
                            .heightIn(min = 28.dp, max = 80.dp),
                        singleLine = false,
                        maxLines = 4,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(
                            onSend = {
                                if (!uiState.isSending && uiState.inputText.trim().isNotBlank()) {
                                    focusManager.clearFocus()
                                    keyboardController?.hide()
                                    viewModel.sendMessage(uiState.inputText)
                                }
                            }
                        ),
                        textStyle = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 13.sp,
                            color = Color(0xFF333333)
                        ),
                        cursorBrush = SolidColor(Color(0xFF1A1A1A)),
                        decorationBox = { inner ->
                            Box {
                                if (uiState.inputText.isBlank()) {
                                    Text(
                                        text = "直接输入消息与客服对话...",
                                        fontSize = 13.sp,
                                        color = Color(0xFF9E9E9E)
                                    )
                                }
                                inner()
                            }
                        }
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                FilledIconButton(
                    onClick = {
                        focusManager.clearFocus()
                        keyboardController?.hide()
                        viewModel.sendMessage(uiState.inputText)
                    },
                    modifier = Modifier.size(38.dp),
                    colors = IconButtonDefaults.filledIconButtonColors(
                        containerColor = Color(0xFF1A1A1A),
                        contentColor = Color.White
                    ),
                    enabled = !uiState.isSending && uiState.inputText.trim().isNotBlank()
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Send,
                        contentDescription = "发送",
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun ChatMessageItem(message: CustomerServiceMessage) {
    val isUser = message.senderType == "user"
    val isAutoReply = message.isAutoReply == 1

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Column(
            modifier = Modifier.widthIn(max = 280.dp),
            horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
        ) {
            // 仅智能回复显示标签，人工客服不显示
            if (!isUser && isAutoReply) {
                Text(
                    text = "智能回复",
                    fontSize = 11.sp,
                    color = Color(0xFF888888),
                    modifier = Modifier.padding(bottom = 4.dp)
                )
            }
            Surface(
                shape = RoundedCornerShape(
                    topStart = 16.dp,
                    topEnd = 16.dp,
                    bottomStart = if (isUser) 16.dp else 6.dp,
                    bottomEnd = if (isUser) 6.dp else 16.dp
                ),
                color = when {
                    isUser -> Color(0xFF1A1A1A)       // 用户：黑色
                    else -> Color(0xFFEBEBEB)        // 回复：浅灰（智能/客服统一）
                },
                shadowElevation = if (isUser) 2.dp else 1.dp,
                border = if (!isUser) BorderStroke(0.5.dp, Color(0xFFE0E0E0)) else null
            ) {
                Text(
                    text = message.content,
                    fontSize = 15.sp,
                    color = when {
                        isUser -> Color.White
                        else -> Color(0xFF333333)    // 回复文字统一深灰
                    },
                    lineHeight = 22.sp,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp)
                )
            }
            message.createdAt?.let { createdAt ->
                val timeStr = try {
                    val input = createdAt.take(19)
                    val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
                    val date = sdf.parse(input)
                    if (date != null) {
                        SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)
                    } else createdAt.take(16)
                } catch (_: Exception) {
                    createdAt.take(16)
                }
                Text(
                    text = timeStr,
                    fontSize = 11.sp,
                    color = Color(0xFF999999),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}
