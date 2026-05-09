package com.example.youzhinan.ui.pages

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.outlined.Celebration
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.InsertDriveFile
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.setValue
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.animation.animateContentSize
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.example.youzhinan.ui.theme.AIPurple
import com.example.youzhinan.ui.theme.AIPurpleGradientEnd
import com.example.youzhinan.ui.theme.AIPurpleLight
import com.example.youzhinan.ui.theme.DividerLight
import com.example.youzhinan.ui.theme.ErrorBackground
import com.example.youzhinan.ui.theme.ErrorRedDark
import com.example.youzhinan.ui.theme.ErrorRedLight
import com.example.youzhinan.ui.theme.PageBackground
import com.example.youzhinan.ui.theme.Primary
import com.example.youzhinan.ui.theme.SuccessGreen
import com.example.youzhinan.ui.theme.TextBody
import com.example.youzhinan.ui.theme.TextHint
import com.example.youzhinan.ui.theme.TextSecondary
import com.example.youzhinan.ui.theme.TextSubtitle
import com.example.youzhinan.ui.theme.TextTertiary
import com.example.youzhinan.ui.theme.TitleDeep
import com.example.youzhinan.utils.XunfeiSpeechRecognizer
import com.example.youzhinan.utils.XunfeiSpeechSynthesizer
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job

@Composable
fun ThinkingStreamView(
    thinking: String,
    content: String
) {
    val pulse = remember { androidx.compose.animation.core.Animatable(0f) }

    LaunchedEffect(Unit) {
        while (true) {
            pulse.animateTo(1f, animationSpec = tween(600))
            pulse.animateTo(0f, animationSpec = tween(600))
        }
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFF8F6FF))
            .padding(horizontal = 10.dp, vertical = 8.dp)
    ) {
        // 顶部：思考中状态
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = Icons.Default.Lightbulb,
                contentDescription = null,
                tint = Color(0xFF9D8CDB),
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "思考中...",
                fontSize = 12.sp,
                color = Color(0xFF9D8CDB),
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.width(8.dp))
            Canvas(modifier = Modifier.size(18.dp)) {
                val cx = size.width / 2
                val cy = size.height / 2
                drawCircle(Color(0xFF9D8CDB).copy(alpha = 0.5f + 0.5f * pulse.value), radius = 2.8f, center = Offset(cx - 6f, cy))
                drawCircle(Color(0xFF9D8CDB).copy(alpha = 0.5f + 0.5f * (1 - pulse.value)), radius = 2.8f, center = Offset(cx, cy))
                drawCircle(Color(0xFF9D8CDB).copy(alpha = 0.5f + 0.5f * pulse.value), radius = 2.8f, center = Offset(cx + 6f, cy))
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        // 下方：思考内容区域 - 始终显示，即使为空也保留布局
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = if (thinking.isNotBlank()) thinking else "",
                fontSize = 12.sp,
                color = if (thinking.isNotBlank()) Color(0xFF7A7A8E) else Color.Transparent,
                lineHeight = 18.sp
            )
        }

        // 回复内容区域
        if (content.isNotBlank()) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = content,
                fontSize = 14.sp,
                color = Color(0xFF1A1A2E),
                lineHeight = 20.sp
            )
        }
    }
}
@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@Composable
fun AIChatPage(
    navController: androidx.navigation.NavHostController,
    paddingValues: PaddingValues = PaddingValues(0.dp),
    viewModel: AIChatViewModel = viewModel(),
    profileViewModel: ProfileViewModel? = null
) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    var messageText by remember { mutableStateOf("") }
    var showMenu by remember { mutableStateOf(false) }
    var showClearDialog by remember { mutableStateOf(false) }
    var voiceMode by remember { mutableStateOf(false) }
    var isSpeaking by remember { mutableStateOf(false) }
    var speakingMessageId by remember { mutableStateOf(0L) }
    val waveformOffset = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val keyboardController = LocalSoftwareKeyboardController.current
    val focusRequester = remember { FocusRequester() }
    val context = LocalContext.current
    val audioPermissionState = rememberPermissionState(android.Manifest.permission.RECORD_AUDIO)

    var pendingImageQuestion by remember { mutableStateOf<String?>(null) }
    var showImagePickerMenu by remember { mutableStateOf(false) }
    var cameraImageUri by remember { mutableStateOf<Uri?>(null) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia(),
        onResult = { uri: Uri? ->
            uri?.let {
                viewModel.selectImage(it.toString())
                pendingImageQuestion?.let { question ->
                    messageText = question
                    pendingImageQuestion = null
                }
            }
        }
    )

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture(),
        onResult = { success: Boolean ->
            if (success) {
                cameraImageUri?.let { uri ->
                    viewModel.selectImage(uri.toString())
                    pendingImageQuestion?.let { question ->
                        messageText = question
                        pendingImageQuestion = null
                    }
                }
            }
        }
    )

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = { isGranted: Boolean ->
            if (isGranted) {
                val file = File(context.cacheDir, "camera_${System.currentTimeMillis()}.jpg")
                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    file
                )
                cameraImageUri = uri
                cameraLauncher.launch(uri)
            } else {
                Toast.makeText(context, "需要相机权限才能拍照", Toast.LENGTH_SHORT).show()
            }
        }
    )

    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
        onResult = { uri: Uri? ->
            uri?.let {
                val fileName = getFileNameFromUri(context, it)
                if (fileName != null) {
                    viewModel.selectFile(it.toString(), fileName)
                    pendingImageQuestion?.let { question ->
                        messageText = question
                        pendingImageQuestion = null
                    }
                }
            }
        }
    )

    val canSend = (messageText.isNotBlank() || uiState.selectedImageUri != null || uiState.selectedFileUri != null) && !uiState.isLoading
    val hasImageOrFile = uiState.selectedImageUri != null || uiState.selectedFileUri != null

    LaunchedEffect(Unit) {
        viewModel.loadBindingStatus()
    }

    profileViewModel?.let { profVM ->
        val profileUiState by profVM.uiState.collectAsState()
        LaunchedEffect(profileUiState.isLoggedIn) {
            viewModel.refreshLoginState()
        }
    }

    val previousIsLoggedIn = remember { mutableStateOf(uiState.isLoggedIn) }
    LaunchedEffect(uiState.isLoggedIn) {
        val wasLoggedIn = previousIsLoggedIn.value
        if (wasLoggedIn != uiState.isLoggedIn) {
            viewModel.refreshLoginState()
        }
        previousIsLoggedIn.value = uiState.isLoggedIn
    }

    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    LaunchedEffect(uiState.streamingThinking, uiState.streamingContent) {
        if (uiState.isStreaming) {
            val targetIndex = uiState.messages.size
            if (listState.layoutInfo.totalItemsCount > targetIndex) {
                listState.animateScrollToItem(targetIndex)
            }
        }
    }

    LaunchedEffect(uiState.messages.size, uiState.autoRead) {
        if (uiState.messages.isNotEmpty() && uiState.autoRead && !uiState.isLoading) {
            val lastMsg = uiState.messages.last()
            if (lastMsg.role == "assistant" && lastMsg.content.length > 5 && !isSpeaking) {
                scope.launch {
                    isSpeaking = true
                    speakingMessageId = lastMsg.timestamp
                    try {
                        XunfeiSpeechSynthesizer.synthesizeAndPlay(context, lastMsg.content)
                    } catch (e: Exception) {
                        Log.e("AIChatPage", "自动朗读失败", e)
                    } finally {
                        isSpeaking = false
                        speakingMessageId = 0L
                    }
                }
            }
        }
    }

    if (uiState.showFirstUseDialog) {
        Dialog(onDismissRequest = { viewModel.dismissFirstUseDialog() }) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = Color.White,
                shadowElevation = 12.dp
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(
                                brush = Brush.linearGradient(
                                    colors = listOf(AIPurple, AIPurpleGradientEnd)
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "欢迎使用 AI 助手",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TitleDeep
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "我是你的智能助理，可以回答问题、聊天、分析图片等。",
                        fontSize = 14.sp,
                        color = TextSecondary,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "提示：在设置中可以绑定自己的 API Key 使用自定义模型。",
                        fontSize = 12.sp,
                        color = TextHint,
                        modifier = Modifier.padding(horizontal = 12.dp)
                    )
                    Spacer(modifier = Modifier.height(20.dp))
                    TextButton(
                        onClick = { viewModel.dismissFirstUseDialog() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(AIPurple, RoundedCornerShape(12.dp))
                            .padding(vertical = 4.dp)
                    ) {
                        Text(
                            "开始使用",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }

    if (!uiState.isLoggedIn) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(PageBackground),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(32.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(
                            brush = Brush.linearGradient(
                                colors = listOf(AIPurple, AIPurpleGradientEnd)
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.AutoAwesome,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(40.dp)
                    )
                }
                Spacer(modifier = Modifier.height(20.dp))
                Text(
                    text = "AI 助手",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = TitleDeep
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "登录后即可使用 AI 助手",
                    fontSize = 14.sp,
                    color = TextHint
                )
                Spacer(modifier = Modifier.height(24.dp))
                TextButton(
                    onClick = { navController.navigate("emailAuth") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(AIPurple, RoundedCornerShape(12.dp))
                        .padding(vertical = 6.dp)
                ) {
                    Text(
                        "去登录",
                        color = Color.White,
                        fontWeight = FontWeight.Medium,
                        fontSize = 15.sp
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
                TextButton(onClick = { navController.navigate("home") }) {
                    Text(
                        "先逛逛",
                        color = TextSubtitle,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp)
                    )
                }
            }
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PageBackground)
            .padding(bottom = paddingValues.calculateBottomPadding())
            .consumeWindowInsets(PaddingValues(bottom = paddingValues.calculateBottomPadding()))
            .imePadding()
    ) {
        // 顶部栏
        TopAppBar(
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(
                                brush = Brush.linearGradient(
                                    colors = listOf(AIPurple, AIPurpleGradientEnd)
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "AI 助手",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = TitleDeep
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(SuccessGreen)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = when {
                                    uiState.isBound && uiState.useCustomModel -> "我的 ${uiState.customModelName}"
                                    uiState.isBound && !uiState.useCustomModel -> "助理壹问"
                                    !uiState.isBound -> "助理壹问"
                                    else -> "助理壹问"
                                },
                                fontSize = 11.sp,
                                color = TextHint
                            )
                        }
                    }
                }
            },
            actions = {
                IconButton(onClick = { viewModel.toggleAutoRead() }) {
                    Icon(
                        imageVector = if (uiState.autoRead) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
                        contentDescription = if (uiState.autoRead) "关闭自动朗读" else "开启自动朗读",
                        tint = if (uiState.autoRead) AIPurple else TextSubtitle,
                        modifier = Modifier.size(22.dp)
                    )
                }
                Box {
                    IconButton(onClick = { showMenu = true }) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "更多",
                            tint = TextSubtitle,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false },
                        shape = RoundedCornerShape(12.dp),
                        containerColor = Color.White,
                        shadowElevation = 8.dp
                    ) {
                        DropdownMenuItem(
                            text = {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Settings,
                                        contentDescription = null,
                                        tint = AIPurple,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Text(
                                        "AI 设置",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Primary
                                    )
                                }
                            },
                            onClick = {
                                showMenu = false
                                navController.navigate("aiSettings")
                            }
                        )
                        HorizontalDivider(color = DividerLight, thickness = 1.dp)
                        DropdownMenuItem(
                            text = {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.History,
                                        contentDescription = null,
                                        tint = AIPurple,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            "上下文记忆",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Primary
                                        )
                                        Text(
                                            text = if (uiState.useContext) "AI 会记住聊天记录" else "AI 不记住聊天",
                                            fontSize = 11.sp,
                                            color = TextHint
                                        )
                                    }
                                    Switch(
                                        checked = uiState.useContext,
                                        onCheckedChange = { viewModel.toggleUseContext() },
                                        modifier = Modifier.height(24.dp),
                                        colors = SwitchDefaults.colors(
                                            checkedTrackColor = AIPurple,
                                            checkedThumbColor = Color.White
                                        )
                                    )
                                }
                            },
                            onClick = { viewModel.toggleUseContext() }
                        )
                        HorizontalDivider(color = DividerLight, thickness = 1.dp)
                        DropdownMenuItem(
                            text = {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.DeleteSweep,
                                        contentDescription = null,
                                        tint = ErrorRedLight,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Text(
                                        "清空聊天",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Primary
                                    )
                                }
                            },
                            onClick = {
                                showMenu = false
                                showClearDialog = true
                            }
                        )
                    }
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = Color.White,
                titleContentColor = TitleDeep
            )
        )

        if (showClearDialog) {
            AlertDialog(
                onDismissRequest = { showClearDialog = false },
                title = {
                    Text(
                        text = "确认清空",
                        fontWeight = FontWeight.Bold,
                        color = TitleDeep
                    )
                },
                text = {
                    Text(
                        text = "确定要清空所有聊天记录吗？此操作不可撤销。",
                        fontSize = 14.sp,
                        color = TextSecondary
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            viewModel.clearMessages()
                            showClearDialog = false
                        },
                        colors = ButtonDefaults.textButtonColors(
                            contentColor = ErrorRedLight
                        )
                    ) {
                        Text("确定清空", fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showClearDialog = false }) {
                        Text("取消", color = TextHint)
                    }
                },
                shape = RoundedCornerShape(16.dp),
                containerColor = Color.White
            )
        }

        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(
                start = 16.dp,
                end = 16.dp,
                top = 12.dp,
                bottom = 12.dp
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (uiState.messages.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .clip(CircleShape)
                                .background(
                                    brush = Brush.linearGradient(
                                        colors = listOf(AIPurple, AIPurpleGradientEnd)
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.AutoAwesome,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(36.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "你好！我是 AI 助手",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = TitleDeep
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "有什么我可以帮助你的吗？",
                            fontSize = 14.sp,
                            color = TextHint
                        )
                        Spacer(modifier = Modifier.height(32.dp))
                        val quickQuestions = listOf(
                            "推荐附近好去处" to "🔍",
                            "今天适合做什么" to "☀️",
                            "给我讲个笑话" to "😄",
                            "帮我写一段文案" to "✍️"
                        )
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            quickQuestions.chunked(2).forEach { row ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    row.forEach { (question, emoji) ->
                                        Surface(
                                            modifier = Modifier.weight(1f),
                                            shape = RoundedCornerShape(12.dp),
                                            color = Color.White,
                                            shadowElevation = 2.dp,
                                            border = null
                                        ) {
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .clickable {
                                                        viewModel.sendMessage(question)
                                                    }
                                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(text = emoji, fontSize = 18.sp)
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text(
                                                    text = question,
                                                    fontSize = 13.sp,
                                                    color = TextBody,
                                                    fontWeight = FontWeight.Medium
                                                )
                                            }
                                        }
                                    }
                                    if (row.size == 1) {
                                        Spacer(modifier = Modifier.weight(1f))
                                    }
                                }
                            }
                        }
                    }
                }
            }

            items(
                items = uiState.messages,
                key = { it.timestamp }
            ) { message ->
                AiChatMessageItem(
                    message = message,
                    avatarUrl = uiState.avatarUrl,
                    isSpeaking = isSpeaking && speakingMessageId == message.timestamp,
                    onSpeak = if (message.role == "assistant" && message.content.length > 5) {
                        {
                            if (isSpeaking && speakingMessageId == message.timestamp) {
                                XunfeiSpeechSynthesizer.stopPlayback()
                                isSpeaking = false
                                speakingMessageId = 0L
                            } else if (!isSpeaking) {
                                isSpeaking = true
                                speakingMessageId = message.timestamp
                                scope.launch {
                                    try {
                                        XunfeiSpeechSynthesizer.synthesizeAndPlay(context, message.content)
                                    } catch (e: Exception) {
                                        Log.e("AIChatPage", "语音合成失败", e)
                                    } finally {
                                        isSpeaking = false
                                        speakingMessageId = 0L
                                    }
                                }
                            }
                        }
                    } else null
                )
            }

            if (uiState.isLoading) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Start,
                        verticalAlignment = Alignment.Top
                    ) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(
                                    brush = Brush.linearGradient(
                                        colors = listOf(AIPurple, AIPurpleGradientEnd)
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.AutoAwesome,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(
                                topStart = 4.dp,
                                topEnd = 16.dp,
                                bottomStart = 16.dp,
                                bottomEnd = 16.dp
                            ),
                            color = Color.White,
                            shadowElevation = 1.dp
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                                if (uiState.isStreaming) {
                                    // 流式输出时的UI
                                    ThinkingStreamView(
                                        thinking = uiState.streamingThinking,
                                        content = uiState.streamingContent
                                    )
                                } else {
                                    // 普通加载时的UI
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            imageVector = Icons.Default.Lightbulb,
                                            contentDescription = null,
                                            tint = Color(0xFF9D8CDB),
                                            modifier = Modifier.size(14.dp)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            text = "正在思考",
                                            fontSize = 12.sp,
                                            color = Color(0xFF9D8CDB),
                                            fontWeight = FontWeight.Medium
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(12.dp),
                                            strokeWidth = 1.5.dp,
                                            color = Color(0xFF9D8CDB)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (uiState.error != null) {
                item {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = ErrorBackground
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = "⚠️", fontSize = 16.sp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = uiState.error ?: "发生错误",
                                fontSize = 13.sp,
                                color = ErrorRedDark,
                                modifier = Modifier.weight(1f)
                            )
                            TextButton(onClick = { viewModel.clearError() }) {
                                Text("关闭", fontSize = 12.sp, color = ErrorRedDark)
                            }
                        }
                    }
                }
            }
        }

        // 快捷按钮区域（壹问好客、深度思考、写PPT）
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Surface(
                modifier = Modifier
                    .width(96.dp)
                    .height(34.dp)
                    .clickable { navController.navigate("lottery") },
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD9DEE8)),
                shadowElevation = 1.dp
            ) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = "壹问好客",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF2F3442)
                    )
                }
            }

            Surface(
                modifier = Modifier
                    .width(96.dp)
                    .height(34.dp)
                    .clickable { viewModel.toggleEnableThinking() },
                shape = RoundedCornerShape(14.dp),
                color = if (uiState.enableThinking) Color(0xFF6C63FF) else Color.White,
                border = androidx.compose.foundation.BorderStroke(1.dp, if (uiState.enableThinking) Color(0xFF6C63FF) else Color(0xFFD9DEE8)),
                shadowElevation = 1.dp
            ) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = "深度思考",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (uiState.enableThinking) Color.White else Color(0xFF2F3442)
                    )
                }
            }

            Surface(
                modifier = Modifier
                    .width(96.dp)
                    .height(34.dp)
                    .clickable {
                        pendingImageQuestion = """
                            请帮我分析这张图片中的题目，给出详细的解答过程和答案。

                            要求：
                            1. 首先识别题目内容
                            2. 详细讲解解题思路
                            3. 一步步写出计算或推导过程
                            4. 最后给出正确答案
                            5. 如果是选择题，说明每个选项对错的原因
                        """.trimIndent()
                        showImagePickerMenu = true
                    },
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD9DEE8)),
                shadowElevation = 1.dp
            ) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = "壹问答题",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF2F3442)
                    )
                }
            }

            Surface(
                modifier = Modifier
                    .width(96.dp)
                    .height(34.dp)
                    .clickable {
                        messageText = """
                            请帮我生成一份 PowerPoint VBA 宏代码，运行后自动创建完整 PPT。

                            主题：
                            目标听众：
                            期望页数：
                            风格偏好（专业/简洁/科技/商务）：

                            要求：
                            1. 输出完整的 VBA Sub 过程，可直接在 PowerPoint 中按 Alt+F11 粘贴运行；
                            2. 每页幻灯片包含：标题、正文要点（3-5条）、适当配色；
                            3. 设置统一的字体、字号、主题色；
                            4. 最后一页为总结与行动建议；
                            5. 先用简短文字说明 PPT 结构，再给出完整 VBA 代码；
                            6. VBA 代码用 ```vba 代码块包裹。
                        """.trimIndent()
                    },
                shape = RoundedCornerShape(14.dp),
                color = Color.White,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFD9DEE8)),
                shadowElevation = 1.dp
            ) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = "写PPT",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF2F3442)
                    )
                }
            }
        }

        // 输入框区域
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp)
                .padding(top = 8.dp, bottom = 8.dp)
        ) {
            if (uiState.selectedImageUri != null) {
                val imageUriStr = uiState.selectedImageUri!!
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.size(52.dp)) {
                        AsyncImage(
                            model = Uri.parse(imageUriStr),
                            contentDescription = "已选图片",
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(10.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Surface(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .offset(x = 2.dp, y = (-2).dp)
                                .size(18.dp)
                                .clickable { viewModel.clearSelectedImage() },
                            color = Color(0xFF999999),
                            shape = CircleShape
                        ) {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "移除",
                                    tint = Color.White,
                                    modifier = Modifier.size(10.dp)
                                )
                            }
                        }
                    }
                    Text(
                        text = "已选择图片",
                        fontSize = 12.sp,
                        color = Color(0xFF999999),
                        modifier = Modifier.padding(start = 6.dp),
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            if (uiState.selectedFileUri != null) {
                val fileName = uiState.selectedFileName ?: "未知文件"
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFFF5F5F5)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.InsertDriveFile,
                            contentDescription = "文件",
                            tint = Color(0xFFEF6C00),
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    Text(
                        text = "已选择文件: $fileName",
                        fontSize = 12.sp,
                        color = Color(0xFF6C63FF),
                        modifier = Modifier.padding(start = 8.dp),
                        fontWeight = FontWeight.Medium
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    Surface(
                        modifier = Modifier
                            .size(18.dp)
                            .clickable { viewModel.clearSelectedFile() },
                        color = Color(0xFF999999),
                        shape = CircleShape
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "移除",
                                tint = Color.White,
                                modifier = Modifier.size(10.dp)
                            )
                        }
                    }
                }
            }

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                color = if (voiceMode) Color(0xFFF5F5F5) else Color.White,
                shadowElevation = if (messageText.isNotBlank()) 6.dp else 4.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 6.dp, end = 8.dp, top = 6.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // 语音输入按钮（点击切换语音模式）
                    if (messageText.isBlank() && uiState.selectedImageUri == null && uiState.selectedFileUri == null) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(if (voiceMode) Color(0xFFE8E8E8) else Color.Transparent)
                                .clickable {
                                    voiceMode = !voiceMode
                                    if (!voiceMode) {
                                        scope.launch { waveformOffset.snapTo(0f) }
                                    }
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Mic,
                                contentDescription = "语音输入",
                                tint = if (voiceMode) Color(0xFF6C63FF) else Color(0xFF999999),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    // 输入框（语音模式下显示波浪纹，长按说话）
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 44.dp, max = 88.dp)
                            .padding(horizontal = 16.dp, vertical = 10.dp)
                            .pointerInput(voiceMode) {
                                if (voiceMode) {
                                    awaitEachGesture {
                                        val down = awaitFirstDown()
                                        // 按下开始录音
                                        if (audioPermissionState.status.isGranted) {
                                            scope.launch {
                                                XunfeiSpeechRecognizer.startRecording(
                                                    context,
                                                    object : XunfeiSpeechRecognizer.RecognitionCallback {
                                                        override fun onSuccess(text: String) {
                                                            if (text.isNotBlank()) {
                                                                messageText = text
                                                            }
                                                        }
                                                        override fun onError(error: String) {
                                                            android.widget.Toast.makeText(context, "语音识别失败: $error", android.widget.Toast.LENGTH_SHORT).show()
                                                        }
                                                        override fun onRecordingStarted() {}
                                                        override fun onRecordingStopped() {}
                                                    }
                                                )
                                            }
                                        } else {
                                            audioPermissionState.launchPermissionRequest()
                                        }
                                        // 等待松开
                                        val up = waitForUpOrCancellation()
                                        if (up != null) {
                                            // 松开停止并识别
                                            scope.launch {
                                                XunfeiSpeechRecognizer.stopRecordingAndRecognize(
                                                    object : XunfeiSpeechRecognizer.RecognitionCallback {
                                                        override fun onSuccess(text: String) {
                                                            if (text.isNotBlank()) {
                                                                messageText = text
                                                            }
                                                        }
                                                        override fun onError(error: String) {
                                                            android.widget.Toast.makeText(context, "语音识别失败: $error", android.widget.Toast.LENGTH_SHORT).show()
                                                        }
                                                        override fun onRecordingStarted() {}
                                                        override fun onRecordingStopped() {}
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        if (voiceMode && messageText.isBlank()) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                                modifier = Modifier.fillMaxSize()
                            ) {
                                // 灰色波浪纹动画
                                Canvas(modifier = Modifier.width(120.dp).height(30.dp)) {
                                    val width = size.width
                                    val height = size.height
                                    val centerY = height / 2
                                    val waveHeight = 6f
                                    val numWaves = 8
                                    val waveWidth = width / numWaves
                                    
                                    for (i in 0 until numWaves) {
                                        val x = i * waveWidth
                                        val offset = waveformOffset.value + i * 0.5f
                                        val y = centerY + kotlin.math.sin(offset) * waveHeight
                                        
                                        drawCircle(
                                            color = Color(0xFFCCCCCC),
                                            radius = 2.5f,
                                            center = Offset(x + waveWidth / 2, y)
                                        )
                                    }
                                }
                                
                                Spacer(modifier = Modifier.height(4.dp))
                                
                                Text(
                                    text = "按住说话",
                                    fontSize = 14.sp,
                                    color = Color(0xFF999999)
                                )
                            }
                            
                            LaunchedEffect(voiceMode) {
                                waveformOffset.animateTo(
                                    targetValue = 100f,
                                    animationSpec = infiniteRepeatable(
                                        animation = tween(1500),
                                        repeatMode = androidx.compose.animation.core.RepeatMode.Reverse
                                    )
                                )
                            }
                        } else {
                            BasicTextField(
                                value = messageText,
                                onValueChange = { messageText = it },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 24.dp, max = 72.dp)
                                    .focusRequester(focusRequester),
                                maxLines = 2,
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                                keyboardActions = KeyboardActions(
                                    onSend = {
                                        if (canSend) {
                                            if (uiState.selectedFileUri != null) {
                                                viewModel.sendFileMessage(
                                                    content = messageText,
                                                    fileUri = uiState.selectedFileUri!!,
                                                    fileName = uiState.selectedFileName ?: "文件"
                                                )
                                            } else {
                                                viewModel.sendMessage(messageText)
                                            }
                                            messageText = ""
                                            keyboardController?.hide()
                                        }
                                    }
                                ),
                                textStyle = MaterialTheme.typography.bodyMedium.copy(
                                    fontSize = 15.sp,
                                    color = Color(0xFF1A1A2E),
                                    lineHeight = 24.sp
                                ),
                                decorationBox = { innerTextField ->
                                    Box {
                                        if (messageText.isBlank() && !voiceMode) {
                                            Text(
                                                text = "输入文字...",
                                                fontSize = 15.sp,
                                                color = Color(0xFFBBBBBB),
                                                lineHeight = 24.sp
                                            )
                                        }
                                        innerTextField()
                                    }
                                }
                            )
                        }
                    }

                    // 图片选择按钮
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clickable { showImagePickerMenu = !showImagePickerMenu },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "更多",
                            tint = if (messageText.isNotBlank()) Color(0xFF6C63FF) else Color(0xFF999999),
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    // 发送按钮
                    if (canSend) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF6C63FF))
                                .clickable {
                                    if (uiState.selectedFileUri != null) {
                                        viewModel.sendFileMessage(
                                            content = messageText,
                                            fileUri = uiState.selectedFileUri!!,
                                            fileName = uiState.selectedFileName ?: "文件"
                                        )
                                    } else {
                                        viewModel.sendMessage(messageText)
                                    }
                                    messageText = ""
                                    keyboardController?.hide()
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Send,
                                contentDescription = "发送",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }

            // 底部弹出式菜单（带动画）
            if (showImagePickerMenu) {
                val menuOffsetY = remember { Animatable(100f) }
                val menuAlpha = remember { Animatable(0f) }
                
                LaunchedEffect(showImagePickerMenu) {
                    menuOffsetY.animateTo(
                        targetValue = 0f,
                        animationSpec = tween(durationMillis = 200)
                    )
                    menuAlpha.animateTo(
                        targetValue = 1f,
                        animationSpec = tween(durationMillis = 200)
                    )
                }
                
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .offset(y = menuOffsetY.value.dp)
                        .alpha(menuAlpha.value)
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White,
                        shadowElevation = 8.dp
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 16.dp),
                            horizontalArrangement = Arrangement.SpaceEvenly,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(
                                modifier = Modifier
                                    .clickable {
                                        showImagePickerMenu = false
                                        photoPickerLauncher.launch(
                                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                        )
                                    }
                                    .padding(horizontal = 16.dp, vertical = 8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFFF0EDFF)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.PhotoLibrary,
                                        contentDescription = "相册",
                                        tint = AIPurple,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "相册",
                                    fontSize = 13.sp,
                                    color = TextBody,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                            Column(
                                modifier = Modifier
                                    .clickable {
                                        showImagePickerMenu = false
                                        cameraPermissionLauncher.launch(android.Manifest.permission.CAMERA)
                                    }
                                    .padding(horizontal = 16.dp, vertical = 8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFFE8F5E9)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.CameraAlt,
                                        contentDescription = "拍照",
                                        tint = Color(0xFF43A047),
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "拍照",
                                    fontSize = 13.sp,
                                    color = TextBody,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                            Column(
                                modifier = Modifier
                                    .clickable {
                                        showImagePickerMenu = false
                                        filePickerLauncher.launch("*/*")
                                    }
                                    .padding(horizontal = 16.dp, vertical = 8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFFFFF3E0)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.InsertDriveFile,
                                        contentDescription = "文件",
                                        tint = Color(0xFFEF6C00),
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "文件",
                                    fontSize = 13.sp,
                                    color = TextBody,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AiChatMessageItem(
    message: ChatMessage,
    avatarUrl: String? = null,
    isSpeaking: Boolean = false,
    onSpeak: (() -> Unit)? = null
) {
    var previewImageUri by remember { mutableStateOf<String?>(null) }
    var copiedType by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val clipboardManager = LocalContext.current.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
    val isUser = message.role == "user"
    val hasSpeaker = !isUser && onSpeak != null && message.content.length > 5
    val hasImage = !message.imageUri.isNullOrBlank()
    val hasFile = message.attachmentType == "file" && message.attachmentName != null
    val hasCodeBlock = !isUser && message.content.contains(Regex("```[\\w]*\\n[\\s\\S]*?```"))

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        if (!isUser) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(
                        brush = Brush.linearGradient(
                            colors = listOf(AIPurple, AIPurpleGradientEnd)
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.AutoAwesome,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(14.dp)
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
        }

        Column(
            horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
        ) {
            if (hasImage && isUser) {
                val userImageUri = if (message.persistentUri != null) {
                    "file://${message.persistentUri}"
                } else {
                    message.imageUri!!
                }
                Surface(
                    modifier = Modifier
                        .widthIn(max = 200.dp)
                        .heightIn(min = 80.dp, max = 200.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .clickable { previewImageUri = userImageUri },
                    shape = RoundedCornerShape(14.dp),
                    color = Color(0xFFE8E0FF),
                    shadowElevation = 3.dp
                ) {
                    AsyncImage(
                        model = Uri.parse(userImageUri),
                        contentDescription = "图片",
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 80.dp, max = 200.dp)
                            .clip(RoundedCornerShape(14.dp)),
                        contentScale = ContentScale.Crop
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
            }

            if (hasFile) {
                Surface(
                    modifier = Modifier
                        .widthIn(max = 200.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .clickable {  },
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFF5F5F5),
                    shadowElevation = 2.dp
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.InsertDriveFile,
                            contentDescription = "文件",
                            tint = Color(0xFFEF6C00),
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = message.attachmentName ?: "文件",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFF6C63FF),
                                maxLines = 1
                            )
                            Text(
                                text = "点击查看详情",
                                fontSize = 11.sp,
                                color = Color(0xFF999999)
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
            }

            if (!isUser) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End)
                ) {
                    MessageActionChip(
                        text = if (copiedType == "all") "已复制" else "复制",
                        onClick = {
                            val clip = android.content.ClipData.newPlainText("消息", message.content)
                            clipboardManager.setPrimaryClip(clip)
                            copiedType = "all"
                            Toast.makeText(context, "已复制全部内容", Toast.LENGTH_SHORT).show()
                        }
                    )
                    if (hasCodeBlock) {
                        MessageActionChip(
                            text = if (copiedType == "code") "已复制" else "复制代码",
                            onClick = {
                                val codeRegex = Regex("```[\\w]*\\n([\\s\\S]*?)```")
                                val matches = codeRegex.findAll(message.content)
                                val codeText = matches.map { it.groupValues[1].trim() }.joinToString("\n\n")
                                if (codeText.isNotBlank()) {
                                    val clip = android.content.ClipData.newPlainText("代码", codeText)
                                    clipboardManager.setPrimaryClip(clip)
                                    copiedType = "code"
                                    Toast.makeText(context, "代码已复制到剪贴板", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )
                    }
                }
            }

            Surface(
                shape = RoundedCornerShape(
                    topStart = if (isUser) 16.dp else 4.dp,
                    topEnd = if (isUser) 4.dp else 16.dp,
                    bottomStart = 16.dp,
                    bottomEnd = 16.dp
                ),
                color = if (isUser) AIPurple else Color.White,
                shadowElevation = 1.dp
            ) {
                Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                    if (hasImage && !isUser) {
                        val assistantImageUri = message.persistentUri ?: message.imageUri!!
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 100.dp, max = 180.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .clickable { previewImageUri = assistantImageUri },
                            shape = RoundedCornerShape(10.dp),
                            color = Color(0xFFF0EDFF),
                            shadowElevation = 2.dp
                        ) {
                            AsyncImage(
                                model = Uri.parse(assistantImageUri),
                                contentDescription = "图片",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 100.dp, max = 180.dp)
                                    .clip(RoundedCornerShape(10.dp)),
                                contentScale = ContentScale.Crop
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    if (!isUser && !message.thinking.isNullOrBlank()) {
                        ThinkingSection(thinkingContent = message.thinking!!)
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    if (!isUser) {
                        BasicTextField(
                            value = message.content,
                            onValueChange = {},
                            readOnly = true,
                            textStyle = MaterialTheme.typography.bodyMedium.copy(
                                fontSize = 14.sp,
                                color = Color(0xFF1A1A2E),
                                lineHeight = 20.sp
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        Text(
                            text = message.content,
                            fontSize = 14.sp,
                            color = Color.White,
                            lineHeight = 20.sp
                        )
                    }
                }
            }

            if (hasSpeaker) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (isSpeaking) Icons.Default.VolumeUp else Icons.Default.VolumeOff,
                        contentDescription = if (isSpeaking) "停止朗读" else "朗读",
                        tint = if (isSpeaking) AIPurple else TextHint,
                        modifier = Modifier
                            .size(18.dp)
                            .clickable { onSpeak?.invoke() }
                    )
                    if (isSpeaking) {
                        Spacer(modifier = Modifier.width(2.dp))
                        Text(
                            text = "朗读中...",
                            fontSize = 10.sp,
                            color = AIPurple
                        )
                    }
                }
            }
        }

        if (isUser) {
            Spacer(modifier = Modifier.width(8.dp))
            if (avatarUrl != null) {
                AsyncImage(
                    model = avatarUrl,
                    contentDescription = "头像",
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFE0E0E0)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = null,
                        tint = Color.Gray,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }

    if (!previewImageUri.isNullOrBlank()) {
        var scale by remember { mutableStateOf(1f) }
        var offsetX by remember { mutableStateOf(0f) }
        var offsetY by remember { mutableStateOf(0f) }

        Dialog(
            onDismissRequest = {
                previewImageUri = null
                scale = 1f
                offsetX = 0f
                offsetY = 0f
            },
            properties = androidx.compose.ui.window.DialogProperties(
                usePlatformDefaultWidth = false
            )
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.95f))
                    .pointerInput(Unit) {
                        detectTransformGestures { _, pan, zoom, _ ->
                            scale = (scale * zoom).coerceIn(0.5f, 5f)
                            if (scale > 1f) {
                                offsetX += pan.x
                                offsetY += pan.y
                            } else {
                                offsetX = 0f
                                offsetY = 0f
                            }
                        }
                    }
                    .pointerInput(Unit) {
                        detectDragGestures(
                            onDragEnd = {
                                if (scale <= 1f) {
                                    offsetX = 0f
                                    offsetY = 0f
                                }
                            }
                        ) { _, dragAmount ->
                            if (scale > 1f) {
                                offsetX += dragAmount.x
                                offsetY += dragAmount.y
                            }
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                AsyncImage(
                    model = Uri.parse(previewImageUri!!),
                    contentDescription = "预览图片",
                    modifier = Modifier
                        .fillMaxWidth()
                        .fillMaxHeight(0.85f)
                        .padding(horizontal = 8.dp, vertical = 48.dp)
                        .offset { androidx.compose.ui.unit.IntOffset(offsetX.toInt(), offsetY.toInt()) }
                        .graphicsLayer {
                            scaleX = scale
                            scaleY = scale
                        }
                        .clip(RoundedCornerShape(16.dp)),
                    contentScale = ContentScale.Fit
                )

                Surface(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 16.dp, end = 16.dp)
                        .size(36.dp)
                        .clickable {
                            previewImageUri = null
                            scale = 1f
                            offsetX = 0f
                            offsetY = 0f
                        },
                    color = Color.White.copy(alpha = 0.2f),
                    shape = CircleShape
                ) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "关闭",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                Text(
                    text = "双指缩放 · 单击关闭",
                    fontSize = 12.sp,
                    color = Color.White.copy(alpha = 0.5f),
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 24.dp)
                )
            }
        }
    }
}

@Composable
private fun MessageActionChip(
    text: String,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(8.dp),
        color = Color(0xFFF5F3FF)
    ) {
        Text(
            text = text,
            fontSize = 11.sp,
            color = Color(0xFF7C6FAB),
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun ThinkingSection(thinkingContent: String) {
    var isExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFF8F6FF))
            .animateContentSize()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { isExpanded = !isExpanded }
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Lightbulb,
                contentDescription = null,
                tint = Color(0xFF9D8CDB),
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = "思考过程",
                fontSize = 12.sp,
                color = Color(0xFF9D8CDB),
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.weight(1f))
            Icon(
                imageVector = if (isExpanded) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowRight,
                contentDescription = if (isExpanded) "收起" else "展开",
                tint = Color(0xFF9D8CDB),
                modifier = Modifier.size(16.dp)
            )
        }
        if (isExpanded) {
            HorizontalDivider(
                color = Color(0xFFE8E0FF),
                thickness = 0.5.dp,
                modifier = Modifier.padding(horizontal = 10.dp)
            )
            Text(
                text = thinkingContent,
                fontSize = 12.sp,
                color = Color(0xFF7A7A8E),
                lineHeight = 18.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp)
            )
        }
    }
}

private fun getFileNameFromUri(context: android.content.Context, uri: android.net.Uri): String? {
    var fileName: String? = null
    val cursor = context.contentResolver.query(uri, null, null, null, null)
    cursor?.use {
        if (it.moveToFirst()) {
            val displayNameIndex = it.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            if (displayNameIndex != -1) {
                fileName = it.getString(displayNameIndex)
            }
        }
    }
    if (fileName == null) {
        val path = uri.path
        if (path != null) {
            fileName = path.substringAfterLast('/')
        }
    }
    return fileName
}
