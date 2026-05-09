package com.example.youzhinan.ui.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.example.youzhinan.data.api.MarkReadRequest
import com.example.youzhinan.data.api.MessageItem
import com.example.youzhinan.data.api.RetrofitClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*

enum class MessageTab(val label: String) {
    SYSTEM("系统通知"),
    PERSONAL("个人通知")
}

/**
 * 站内信页面
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessagesPage(
    navController: NavHostController, 
    userId: Int,
    profileViewModel: ProfileViewModel? = null
) {
    var allMessages by remember { mutableStateOf<List<MessageItem>>(emptyList()) }
    var unreadCount by remember { mutableStateOf(0) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var selectedMessage by remember { mutableStateOf<MessageItem?>(null) }
    var selectedTab by remember { mutableStateOf(MessageTab.SYSTEM) }
    val scope = rememberCoroutineScope()

    fun loadMessages() {
        scope.launch {
            isLoading = true
            error = null
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.getApiService().getMessages(userId = userId)
                }
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    allMessages = body.data ?: emptyList()
                    unreadCount = body.unreadCount
                } else {
                    error = "加载失败"
                }
            } catch (e: Exception) {
                error = e.message ?: "加载失败"
            }
            isLoading = false
        }
    }

    LaunchedEffect(userId) {
        loadMessages()
    }

    val filteredMessages = allMessages.filter { msg ->
        when (selectedTab) {
            MessageTab.PERSONAL -> msg.type == "personal"
            MessageTab.SYSTEM -> msg.type == "broadcast"
        }
    }

    val personalUnreadCount = allMessages.count { it.type == "personal" && !it.isRead }
    val systemUnreadCount = allMessages.count { it.type == "broadcast" && !it.isRead }

    Scaffold(
        topBar = {
            Column(
                modifier = Modifier.background(Color(0xFF2D2D2D))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "站内信",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
                
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    MessageTab.values().forEach { tab ->
                        val unread = when (tab) {
                            MessageTab.PERSONAL -> personalUnreadCount
                            MessageTab.SYSTEM -> systemUnreadCount
                        }
                        val isSelected = selectedTab == tab
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(32.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(if (isSelected) Color.White else Color.Transparent)
                                .clickable { selectedTab = tab },
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = tab.label,
                                    fontSize = 13.sp,
                                    fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal,
                                    color = if (isSelected) Color(0xFF2D2D2D) else Color(0xFF999999)
                                )
                                if (unread > 0) {
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Surface(
                                        color = Color(0xFFE91E63),
                                        shape = CircleShape,
                                        modifier = Modifier.size(if (unread > 99) 14.dp else 12.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier.fillMaxSize(),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                text = if (unread > 99) "99+" else "$unread",
                                                fontSize = 8.sp,
                                                lineHeight = 8.sp,
                                                color = Color.White
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFFF5F5F5))
        ) {
            when {
                isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = Color.Black)
                    }
                }
                error != null -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = error!!,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
                filteredMessages.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.Mail,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = Color.Gray
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "暂无${selectedTab.label}消息",
                                color = Color.Gray,
                                fontSize = 16.sp
                            )
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(filteredMessages) { msg ->
                            MessageItemCard(
                                message = msg,
                                onClick = {
                                    selectedMessage = msg
                                    if (!msg.isRead) {
                                        scope.launch {
                                            try {
                                                val response = withContext(Dispatchers.IO) {
                                                    RetrofitClient.getApiService()
                                                        .markMessageRead(msg.id, MarkReadRequest(userId))
                                                }
                                                if (response.isSuccessful) {
                                                    allMessages = allMessages.map { m ->
                                                        if (m.id == msg.id) m.copy(isRead = true) else m
                                                    }
                                                    profileViewModel?.refreshUnreadMessageCount(userId)
                                                }
                                            } catch (_: Exception) {
                                            }
                                        }
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    selectedMessage?.let { msg ->
        AlertDialog(
            onDismissRequest = { selectedMessage = null },
            title = { Text(msg.title ?: "消息") },
            text = {
                Column {
                    msg.createdAt?.let { createdAt ->
                        Text(
                            text = formatDate(createdAt),
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    Text(
                        text = msg.content ?: "",
                        fontSize = 14.sp,
                        lineHeight = 22.sp
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { selectedMessage = null },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2D2D2D)),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.height(36.dp)
                ) {
                    Text("知道了", fontSize = 14.sp, color = Color.White)
                }
            }
        )
    }
}

@Composable
private fun MessageItemCard(message: MessageItem, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (message.isRead) Color.White else Color(0xFFFFF5F5)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (!message.isRead) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFE91E63))
                )
                Spacer(modifier = Modifier.width(12.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = message.title ?: "通知",
                    fontSize = 16.sp,
                    fontWeight = if (message.isRead) FontWeight.Normal else FontWeight.SemiBold,
                    color = Color(0xFF333333),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                message.content?.takeIf { it.isNotEmpty() }?.let { content ->
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = content,
                        fontSize = 14.sp,
                        color = Color.Gray,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                message.createdAt?.let { createdAt ->
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = formatDate(createdAt),
                        fontSize = 12.sp,
                        color = Color.Gray
                    )
                }
            }
        }
    }
}

private fun formatDate(dateStr: String): String {
    return try {
        val output = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
        val parsers = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()),
            SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        )
        val date = parsers.mapNotNull { runCatching { it.parse(dateStr) }.getOrNull() }.firstOrNull()
        date?.let { output.format(it) } ?: dateStr
    } catch (_: Exception) {
        dateStr
    }
}
