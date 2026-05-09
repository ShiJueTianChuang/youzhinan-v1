package com.example.youzhinan.ui.pages

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.youzhinan.data.api.LotteryPrize
import com.example.youzhinan.data.api.DrawPrize
import com.example.youzhinan.data.api.LotteryRecord
import com.example.youzhinan.data.api.InviteInfo
import com.example.youzhinan.data.api.ApiConfig
import com.example.youzhinan.ui.components.NetworkImage
import com.example.youzhinan.ui.components.SkeletonLoader
import com.example.youzhinan.ui.theme.DividerLight
import com.example.youzhinan.ui.theme.SuccessGreen
import com.example.youzhinan.ui.theme.TextBody
import com.example.youzhinan.ui.theme.TextSecondary
import com.example.youzhinan.ui.theme.TextTertiary
import com.example.youzhinan.ui.theme.TitleDeep
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val LotteryGold = Color(0xFFFFD700)
private val LotteryGoldDark = Color(0xFFFFA000)
private val LotteryRed = Color(0xFFE53935)
private val LotteryRedDark = Color(0xFFB71C1C)
private val LotteryPink = Color(0xFFFF6B6B)
private val LotteryOrange = Color(0xFFFF9800)
private val LotteryBlue = Color(0xFF42A5F5)
private val LotteryGreen = Color(0xFF66BB6A)
private val LotteryPurple = Color(0xFFAB47BC)

private val prizeColors = listOf(
    LotteryRed, LotteryGold, LotteryPink, LotteryBlue,
    LotteryGreen, LotteryPurple, LotteryOrange, LotteryRedDark
)

private val ThankYouColor = Color(0xFFBDBDBD)

private data class GridLayoutResult(
    val rows: Int,
    val cols: Int,
    val goRow: Int,
    val goCol: Int
)

private fun calculateGridLayout(prizeCount: Int): GridLayoutResult {
    return when {
        prizeCount <= 2 -> GridLayoutResult(1, 3, 0, 1)
        prizeCount == 3 -> GridLayoutResult(2, 2, 1, 1)
        prizeCount <= 5 -> GridLayoutResult(2, 3, 1, 1)
        prizeCount <= 8 -> GridLayoutResult(3, 3, 1, 1)
        prizeCount <= 12 -> GridLayoutResult(4, 4, 2, 2)
        else -> GridLayoutResult(5, 5, 2, 2)
    }
}

private fun calculateAnimationOrder(rows: Int, cols: Int, goCellIndex: Int): List<Int> {
    val order = mutableListOf<Int>()
    val visited = Array(rows) { BooleanArray(cols) }
    var top = 0
    var bottom = rows - 1
    var left = 0
    var right = cols - 1

    while (top <= bottom && left <= right) {
        for (c in left..right) {
            val idx = top * cols + c
            if (idx != goCellIndex && !visited[top][c]) {
                order.add(idx)
                visited[top][c] = true
            }
        }
        top++
        for (r in top..bottom) {
            val idx = r * cols + right
            if (idx != goCellIndex && !visited[r][right]) {
                order.add(idx)
                visited[r][right] = true
            }
        }
        right--
        if (top <= bottom) {
            for (c in right downTo left) {
                val idx = bottom * cols + c
                if (idx != goCellIndex && !visited[bottom][c]) {
                    order.add(idx)
                    visited[bottom][c] = true
                }
            }
            bottom--
        }
        if (left <= right) {
            for (r in bottom downTo top) {
                val idx = r * cols + left
                if (idx != goCellIndex && !visited[r][left]) {
                    order.add(idx)
                    visited[r][left] = true
                }
            }
            left++
        }
    }
    return order
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LotteryPage(
    navController: androidx.navigation.NavHostController,
    viewModel: LotteryViewModel = viewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    var isSpinning by remember { mutableStateOf(false) }
    var highlightIndex by remember { mutableStateOf(-1) }
    var cyclingJob by remember { mutableStateOf<Job?>(null) }
    var showWinDialog by remember { mutableStateOf(false) }
    var showThankYouDialog by remember { mutableStateOf(false) }
    var showErrorDialog by remember { mutableStateOf(false) }
    var showAddressDialog by remember { mutableStateOf(false) }
    var selectedRecord by remember { mutableStateOf<LotteryRecord?>(null) }
    var showRecordsPanel by remember { mutableStateOf(false) }
    var showInviteDialog by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()
    val noChanceReason = remember(uiState.drawInfo, uiState.activityStatus, uiState.activity) {
        val drawInfo = uiState.drawInfo
        val status = uiState.activityStatus
        when {
            status == "pending" -> "活动尚未开始，请耐心等待"
            status != "active" -> "活动已结束"
            drawInfo == null -> "请先登录"
            drawInfo.totalRemaining <= 0 -> "总抽奖次数已用完"
            drawInfo.dailyRemaining <= 0 -> "今日抽奖次数已用完"
            else -> null
        }
    }

    LaunchedEffect(Unit) {
        viewModel.loadLotteryStatus()
        viewModel.loadRegions()
    }

    LaunchedEffect(uiState.shippingSubmitted) {
        if (uiState.shippingSubmitted) {
            showAddressDialog = false
            viewModel.clearShippingSubmitted()
        }
    }

    LaunchedEffect(uiState.error) {
        if (uiState.error != null && !uiState.isDrawing && uiState.drawResult == null) {
            showErrorDialog = true
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        "壹问好客",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = Color.White
                    )
                },
                navigationIcon = {},
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFF6C63FF),
                    titleContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        if (uiState.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = LotteryRed)
            }
        } else if (uiState.activity == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .background(Color(0xFFF0F0F5)),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.Celebration,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = Color(0xFFCCCCCC)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = uiState.error ?: "暂无抽奖活动",
                        fontSize = 16.sp,
                        color = TextTertiary
                    )
                }
            }
        } else {
            val activity = uiState.activity
            val isPending = uiState.activityStatus == "pending"
            
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .background(Color(0xFFF5F6FB))
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = activity!!.name,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = TitleDeep
                )

                activity.startTime?.let { startTime ->
                    val timeDisplay = formatActivityTime(startTime, activity.endTime)
                    if (timeDisplay.isNotBlank()) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = timeDisplay,
                            fontSize = 12.sp,
                            color = TextSecondary
                        )
                    }
                }

                if (isPending && uiState.error != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Surface(
                        modifier = Modifier.padding(horizontal = 32.dp),
                        shape = RoundedCornerShape(16.dp),
                        color = Color(0xFFFFF3E0)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Celebration,
                                contentDescription = null,
                                tint = Color(0xFFFF9800),
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = uiState.error!!,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFFE65100)
                            )
                        }
                    }
                }

                activity!!.prizeDescription?.let { desc ->
                    if (desc.isNotBlank() && !isPending) {
                        Text(
                            text = desc,
                            fontSize = 13.sp,
                            color = TextSecondary,
                            modifier = Modifier.padding(horizontal = 32.dp, vertical = 4.dp),
                            textAlign = TextAlign.Center
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                if (!isPending) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        DrawCountChip(
                            label = "今日剩余",
                            count = uiState.drawInfo?.dailyRemaining ?: 0,
                            total = uiState.drawInfo?.effectiveDailyLimit
                                ?: uiState.drawInfo?.dailyLimit
                                ?: activity?.dailyLimit
                                ?: 0
                        )
                        DrawCountChip(
                            label = "总剩余",
                            count = uiState.drawInfo?.totalRemaining ?: 0,
                            total = (uiState.drawInfo?.totalLimit ?: activity?.totalLimit ?: 0)
                                .let { maxOf(it, uiState.drawInfo?.totalUsed ?: 0) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                val prizes = uiState.prizes.take(8)
                val gridLayout = remember(prizes.size) { calculateGridLayout(prizes.size) }
                val animationOrder = remember(gridLayout) {
                    calculateAnimationOrder(gridLayout.rows, gridLayout.cols, gridLayout.goRow * gridLayout.cols + gridLayout.goCol)
                }
                val prizeIdToAnimIndex = remember(prizes, animationOrder) {
                    val map = mutableMapOf<Int, Int>()
                    for (i in prizes.indices) {
                        if (i < animationOrder.size) {
                            map[prizes[i].id] = i
                        }
                    }
                    map
                }
                val animLoopSize = animationOrder.size

                if (prizes.isNotEmpty()) {
                    NineGridLottery(
                        prizes = prizes,
                        gridLayout = gridLayout,
                        animationOrder = animationOrder,
                        highlightIndex = highlightIndex,
                        isAnimating = isSpinning,
                        onDrawClick = {
                            if (isSpinning) return@NineGridLottery

                            if (noChanceReason != null) {
                                viewModel.setError(noChanceReason)
                                showErrorDialog = true
                                return@NineGridLottery
                            }

                            isSpinning = true
                            viewModel.clearDrawResultAndError()
                            highlightIndex = -1

                            val drawStartTime = System.currentTimeMillis()

                            cyclingJob = scope.launch {
                                var step = 0
                                while (true) {
                                    highlightIndex = step % animLoopSize
                                    step++
                                    delay(80L)
                                }
                            }

                            viewModel.draw { drawResult ->
                                cyclingJob?.cancel()
                                cyclingJob = null

                                scope.launch {
                                    val elapsed = System.currentTimeMillis() - drawStartTime
                                    val minSpinDuration = 1500L
                                    if (elapsed < minSpinDuration) {
                                        delay(minSpinDuration - elapsed)
                                    }

                                    if (drawResult == null) {
                                        for (i in 1..animLoopSize) {
                                            highlightIndex = (highlightIndex + 1) % animLoopSize
                                            delay((100L + i * 50L).coerceAtMost(500L))
                                        }
                                        isSpinning = false
                                        highlightIndex = -1
                                        showErrorDialog = true
                                        return@launch
                                    }

                                    val targetAnimIndex = drawResult.prize?.let { prize ->
                                        prizeIdToAnimIndex[prize.id]
                                            ?: prizes.indexOfFirst { it.name == prize.name }
                                                .takeIf { it >= 0 && it < animLoopSize }
                                            ?: 0
                                    } ?: 0

                                    val safeCurrentIdx = if (highlightIndex in 0 until animLoopSize) highlightIndex else 0
                                    val stepsToTarget = ((targetAnimIndex - safeCurrentIdx - 1 + animLoopSize) % animLoopSize) + animLoopSize * 2
                                    for (i in 1..stepsToTarget) {
                                        highlightIndex = (safeCurrentIdx + i) % animLoopSize
                                        val progress = i.toFloat() / stepsToTarget
                                        val delayMs = when {
                                            progress < 0.3f -> 80L
                                            progress < 0.6f -> 150L
                                            progress < 0.8f -> 300L
                                            else -> 500L
                                        }
                                        delay(delayMs)
                                    }

                                    isSpinning = false

                                    if (drawResult.isWinner && drawResult.prize != null) {
                                        showWinDialog = true
                                    } else {
                                        showThankYouDialog = true
                                    }
                                }
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp)
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                val availablePrizes = uiState.prizes.filter { it.isThankYou != 1 && it.outOfStock != 1 }
                val totalWinRate = availablePrizes.sumOf { it.effectiveProbability }
                if (totalWinRate > 0) {
                    Text(
                        text = "总中奖率 ${String.format("%.1f", totalWinRate)}%",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        modifier = Modifier.padding(horizontal = 24.dp)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Button(
                        onClick = { showRecordsPanel = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = LotteryRed
                        ),
                        shape = RoundedCornerShape(24.dp),
                        modifier = Modifier.height(40.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = Color.White
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "抽奖记录",
                            color = Color.White,
                            fontSize = 13.sp
                        )
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Button(
                        onClick = { showInviteDialog = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = LotteryGold
                        ),
                        shape = RoundedCornerShape(24.dp),
                        modifier = Modifier.height(40.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.PersonAdd,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = LotteryRedDark
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "邀请得机会",
                            color = LotteryRedDark,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                if (uiState.winRecords.isNotEmpty()) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .padding(bottom = 24.dp)
                    ) {
                        Text(
                            text = "我的奖品",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = TitleDeep,
                            modifier = Modifier.padding(start = 8.dp, bottom = 8.dp)
                        )
                        uiState.winRecords.forEach { record ->
                            WinRecordCard(
                                record = record,
                                onFillAddress = {
                                    selectedRecord = record
                                    showAddressDialog = true
                                }
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }

    if (showWinDialog && uiState.drawResult?.prize != null) {
        WinDialog(
            prize = uiState.drawResult!!.prize!!,
            onDismiss = {
                showWinDialog = false
                viewModel.clearDrawResult()
            },
            onFillAddress = {
                showWinDialog = false
                val drawResult = uiState.drawResult
                val currentRecordId = drawResult?.recordId ?: 0
                val record = if (currentRecordId > 0) {
                    uiState.winRecords.firstOrNull { it.id == currentRecordId }
                } else null
                    ?: uiState.winRecords.firstOrNull { it.id > 0 && !it.hasAddress }
                    ?: drawResult?.let { result ->
                        if (result.isWinner && result.prize != null && result.recordId > 0) {
                            LotteryRecord(
                                id = result.recordId,
                                activityId = uiState.activity?.id ?: 0,
                                userId = 0,
                                prizeId = result.prize!!.id,
                                isWinner = 1,
                                prizeName = result.prize!!.name,
                                prizeImage = result.prize!!.image,
                                drawTime = "",
                                needsShipping = result.prize!!.needsShipping,
                                hasAddress = false
                            )
                        } else null
                    }
                if (record != null) {
                    selectedRecord = record
                    showAddressDialog = true
                } else {
                    viewModel.loadUserDrawInfo(uiState.activity?.id)
                    android.widget.Toast.makeText(
                        context,
                        "中奖记录同步中，请稍后在【我的奖品】中填写地址",
                        android.widget.Toast.LENGTH_SHORT
                    ).show()
                }
                viewModel.clearDrawResult()
            }
        )
    }

    if (showThankYouDialog) {
        Dialog(onDismissRequest = {
            showThankYouDialog = false
            viewModel.clearDrawResult()
            viewModel.clearError()
        }) {
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = Color.White
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(ThankYouColor.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = Color(0xFF757575),
                            modifier = Modifier.size(32.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "谢谢参与",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        color = Color(0xFF757575)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "很遗憾未中奖，再接再厉！",
                        fontSize = 14.sp,
                        color = TextSecondary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = {
                            showThankYouDialog = false
                            viewModel.clearDrawResult()
                            viewModel.clearError()
                        },
                        shape = RoundedCornerShape(24.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF757575)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                    ) {
                        Text("继续抽奖", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    if (showErrorDialog) {
        LotteryMessageDialog(
            message = uiState.error ?: "操作失败，请重试",
            isNoChance = uiState.error?.contains("次数") == true || uiState.error?.contains("已用完") == true,
            isPrizesExhausted = uiState.error?.contains("发完") == true || uiState.error?.contains("售罄") == true || uiState.error?.contains("无可用奖品") == true,
            onDismiss = {
                showErrorDialog = false
                viewModel.clearError()
            }
        )
    }

    if (showAddressDialog && selectedRecord != null) {
        ShippingAddressDialog(
            recordId = selectedRecord!!.id,
            prizeName = selectedRecord!!.prizeName ?: "奖品",
            viewModel = viewModel,
            onDismiss = { showAddressDialog = false },
            onSubmit = { name, phone, province, city, district, detail ->
                viewModel.submitShippingAddress(
                    recordId = selectedRecord!!.id,
                    name = name,
                    phone = phone,
                    province = province,
                    city = city,
                    district = district,
                    detailAddress = detail
                )
            }
        )
    }

    if (showRecordsPanel) {
        RecordsPanel(
            allRecords = uiState.allRecords,
            winRecords = uiState.winRecords,
            onDismiss = { showRecordsPanel = false },
            onFillAddress = { record ->
                showRecordsPanel = false
                selectedRecord = record
                showAddressDialog = true
            }
        )
    }

    if (showInviteDialog) {
        InviteDialog(
            inviteInfo = uiState.inviteInfo,
            onDismiss = { showInviteDialog = false }
        )
    }
}

private fun formatActivityTime(startTime: String, endTime: String?): String {
    if (startTime.isBlank()) return ""
    return try {
        val start = java.time.Instant.parse(startTime)
            .atZone(java.time.ZoneId.systemDefault())
            .toLocalDateTime()
        val startStr = "${start.monthValue}月${start.dayOfMonth}日 ${String.format("%02d:%02d", start.hour, start.minute)}"

        if (endTime.isNullOrBlank()) {
            "活动开始时间：$startStr"
        } else {
            val end = java.time.Instant.parse(endTime)
                .atZone(java.time.ZoneId.systemDefault())
                .toLocalDateTime()
            val endStr = "${end.monthValue}月${end.dayOfMonth}日 ${String.format("%02d:%02d", end.hour, end.minute)}"
            "$startStr - $endStr"
        }
    } catch (e: Exception) {
        if (endTime.isNullOrBlank()) {
            "活动开始时间：$startTime"
        } else {
            "$startTime - $endTime"
        }
    }
}

@Composable
private fun NineGridLottery(
    prizes: List<LotteryPrize>,
    gridLayout: GridLayoutResult,
    animationOrder: List<Int>,
    highlightIndex: Int,
    isAnimating: Boolean,
    onDrawClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val cellToPrize = remember(prizes, animationOrder) {
        val map = mutableMapOf<Int, LotteryPrize>()
        for (i in prizes.indices) {
            if (i < animationOrder.size) {
                map[animationOrder[i]] = prizes[i]
            }
        }
        map
    }

    val cellToAnimIndex = remember(animationOrder) {
        animationOrder.mapIndexed { animIdx, cellIdx -> cellIdx to animIdx }.toMap()
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White, RoundedCornerShape(20.dp))
            .padding(12.dp)
    ) {
        for (row in 0 until gridLayout.rows) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                for (col in 0 until gridLayout.cols) {
                    val cellIndex = row * gridLayout.cols + col

                    if (row == gridLayout.goRow && col == gridLayout.goCol) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(
                                            Color(0xFFF5AF19),
                                            Color(0xFFF12711)
                                        )
                                    )
                                )
                                .clickable(enabled = !isAnimating) { onDrawClick() },
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = if (isAnimating) "抽" else "GO",
                                    fontSize = if (isAnimating) 20.sp else 24.sp,
                                    fontWeight = FontWeight.Black,
                                    color = Color.White
                                )
                                if (!isAnimating) {
                                    Text(
                                        text = "抽奖",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color.White.copy(alpha = 0.85f)
                                    )
                                }
                            }
                        }
                    } else {
                        val prize = cellToPrize[cellIndex]
                        val animIdx = cellToAnimIndex[cellIndex]
                        val isHighlighted = isAnimating && animIdx != null && highlightIndex == animIdx

                        if (prize != null) {
                            LotteryCell(
                                prize = prize,
                                isHighlighted = isHighlighted,
                                modifier = Modifier.weight(1f)
                            )
                        } else {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(1f)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color(0xFFF8F9FA))
                            )
                        }
                    }
                }
            }
            if (row < gridLayout.rows - 1) {
                Spacer(modifier = Modifier.height(6.dp))
            }
        }
    }
}

@Composable
private fun LotteryCell(
    prize: LotteryPrize,
    isHighlighted: Boolean,
    modifier: Modifier = Modifier
) {
    val isThankYou = prize.isThankYou == 1
    val isOutOfStock = prize.outOfStock == 1

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Top
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
        ) {
            val imageUrl = ApiConfig.getFullImageUrl(prize.image)
            if (imageUrl != null) {
                NetworkImage(
                    url = imageUrl,
                    contentDescription = prize.name,
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(14.dp)),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (isThankYou) Color(0xFFF5F5F5) else Color(0xFFF8F9FA)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isThankYou) Icons.Default.Star else Icons.Default.Celebration,
                        contentDescription = null,
                        tint = Color(0xFFBDBDBD),
                        modifier = Modifier.size(40.dp)
                    )
                }
            }

            if (isOutOfStock && !isThankYou) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.5f), RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "已领完",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            if (isHighlighted) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(14.dp))
                        .border(3.dp, Color(0xFFFFD700), RoundedCornerShape(14.dp))
                )
            }
        }

        Text(
            text = prize.name,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = when {
                isOutOfStock -> Color(0xFFBDBDBD)
                isThankYou -> Color(0xFF9E9E9E)
                isHighlighted -> Color(0xFFD32F2F)
                else -> Color(0xFF333333)
            },
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp)
        )
    }
}

@Composable
private fun DrawCountChip(label: String, count: Int, total: Int) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = LotteryRed.copy(alpha = 0.88f),
        modifier = Modifier.padding(4.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
        ) {
            Text(
                text = label,
                fontSize = 12.sp,
                color = Color.White.copy(alpha = 0.8f)
            )
            Text(
                text = "$count",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = LotteryGold
            )
            Text(
                text = "/ $total 次",
                fontSize = 11.sp,
                color = Color.White.copy(alpha = 0.6f)
            )
        }
    }
}

@Composable
private fun WinRecordCard(
    record: LotteryRecord,
    onFillAddress: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = LotteryRed.copy(alpha = 0.85f)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val prizeImageUrl = ApiConfig.getFullImageUrl(record.prizeImage)
            if (prizeImageUrl != null) {
                NetworkImage(
                    url = prizeImageUrl,
                    contentDescription = record.prizeName,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop
                )
            } else {
                Icon(
                    imageVector = Icons.Default.Celebration,
                    contentDescription = null,
                    tint = LotteryGold,
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = record.prizeName ?: "奖品",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = record.drawTime ?: "",
                    fontSize = 11.sp,
                    color = Color.White.copy(alpha = 0.6f)
                )
            }
            if (record.needsShipping == 1 && !record.hasAddress) {
                Button(
                    onClick = onFillAddress,
                    colors = ButtonDefaults.buttonColors(containerColor = LotteryGold),
                    shape = RoundedCornerShape(16.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    modifier = Modifier.height(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.LocalShipping,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = LotteryRedDark
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "填写地址",
                        fontSize = 11.sp,
                        color = LotteryRedDark,
                        fontWeight = FontWeight.Bold
                    )
                }
            } else if (record.needsShipping == 1 && record.hasAddress) {
                val statusText = when (record.shippingStatus) {
                    "shipped" -> "已发货"
                    "delivered" -> "已签收"
                    else -> "待发货"
                }
                val statusColor = when (record.shippingStatus) {
                    "shipped" -> Color(0xFF4CAF50)
                    "delivered" -> Color(0xFF2196F3)
                    else -> Color.White.copy(alpha = 0.7f)
                }
                Column {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White.copy(alpha = 0.2f)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocalShipping,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = statusColor
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = statusText,
                                fontSize = 11.sp,
                                color = statusColor,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                    if (!record.trackingNumber.isNullOrBlank()) {
                        val context = LocalContext.current
                        Row(
                            modifier = Modifier
                                .padding(top = 4.dp, start = 4.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .clickable {
                                    val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                                    val clip = android.content.ClipData.newPlainText("快递单号", record.trackingNumber)
                                    clipboard.setPrimaryClip(clip)
                                    android.widget.Toast.makeText(context, "快递单号已复制", android.widget.Toast.LENGTH_SHORT).show()
                                }
                                .padding(horizontal = 4.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = (record.courierCompany?.takeIf { it.isNotBlank() }?.let { "$it: " } ?: "") + record.trackingNumber,
                                fontSize = 10.sp,
                                color = Color.White.copy(alpha = 0.6f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Icon(
                                imageVector = Icons.Default.ContentCopy,
                                contentDescription = "复制",
                                modifier = Modifier.size(10.dp),
                                tint = Color.White.copy(alpha = 0.4f)
                            )
                        }
                    }
                }
            } else if (record.needsShipping != 1) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color.White.copy(alpha = 0.2f)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Celebration,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = LotteryGold.copy(alpha = 0.8f)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "虚拟奖品",
                            fontSize = 11.sp,
                            color = Color.White.copy(alpha = 0.7f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WinDialog(
    prize: DrawPrize,
    onDismiss: () -> Unit,
    onFillAddress: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = Color.White
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                val prizeImageUrl = ApiConfig.getFullImageUrl(prize.image)
                if (prizeImageUrl != null) {
                    NetworkImage(
                        url = prizeImageUrl,
                        contentDescription = prize.name,
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.radialGradient(
                                    colors = listOf(LotteryGold, LotteryGoldDark)
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Celebration,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(40.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "恭喜中奖！",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black,
                    color = LotteryRed
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = prize.name,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = TitleDeep
                )
                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (prize.needsShipping == 1) {
                        OutlinedButton(
                            onClick = onDismiss,
                            shape = RoundedCornerShape(24.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp)
                        ) {
                            Text("稍后填写", fontSize = 14.sp)
                        }
                        Button(
                            onClick = onFillAddress,
                            shape = RoundedCornerShape(24.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = LotteryRed),
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocalShipping,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("填写地址", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Button(
                            onClick = onDismiss,
                            shape = RoundedCornerShape(24.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = LotteryRed),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp)
                        ) {
                            Text("知道了", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ShippingAddressDialog(
    recordId: Int,
    prizeName: String,
    viewModel: LotteryViewModel,
    onDismiss: () -> Unit,
    onSubmit: (String, String, String, String, String, String) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var detailAddress by remember { mutableStateOf("") }
    var showProvincePicker by remember { mutableStateOf(false) }
    var showCityPicker by remember { mutableStateOf(false) }
    var showDistrictPicker by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(20.dp),
        containerColor = Color.White,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.LocalShipping,
                    contentDescription = null,
                    tint = LotteryRed,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    "填写收货地址",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            }
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = "奖品：$prizeName",
                    fontSize = 13.sp,
                    color = TextTertiary,
                    modifier = Modifier.padding(bottom = 12.dp)
                )

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("收货人姓名") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("手机号码") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = uiState.selectedProvince ?: "",
                        onValueChange = {},
                        label = { Text("省份") },
                        readOnly = true,
                        modifier = Modifier
                            .weight(1f),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        trailingIcon = {
                            Text("▼", fontSize = 10.sp, color = TextTertiary, modifier = Modifier.clickable { showProvincePicker = true })
                        },
                        interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
                            .also { interactionSource ->
                                LaunchedEffect(interactionSource) {
                                    interactionSource.interactions.collect {
                                        if (it is androidx.compose.foundation.interaction.PressInteraction.Release) {
                                            showProvincePicker = true
                                        }
                                    }
                                }
                            }
                    )
                    OutlinedTextField(
                        value = uiState.selectedCity ?: "",
                        onValueChange = {},
                        label = { Text("城市") },
                        readOnly = true,
                        modifier = Modifier
                            .weight(1f),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        trailingIcon = {
                            Text("▼", fontSize = 10.sp, color = TextTertiary, modifier = Modifier.clickable {
                                if (uiState.selectedProvince != null) showCityPicker = true
                            })
                        },
                        interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
                            .also { interactionSource ->
                                LaunchedEffect(interactionSource) {
                                    interactionSource.interactions.collect {
                                        if (it is androidx.compose.foundation.interaction.PressInteraction.Release) {
                                            if (uiState.selectedProvince != null) showCityPicker = true
                                        }
                                    }
                                }
                            }
                    )
                    OutlinedTextField(
                        value = uiState.selectedDistrict ?: "",
                        onValueChange = {},
                        label = { Text("区县") },
                        readOnly = true,
                        modifier = Modifier
                            .weight(1f),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        trailingIcon = {
                            Text("▼", fontSize = 10.sp, color = TextTertiary, modifier = Modifier.clickable {
                                if (uiState.selectedCity != null) showDistrictPicker = true
                            })
                        },
                        interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() }
                            .also { interactionSource ->
                                LaunchedEffect(interactionSource) {
                                    interactionSource.interactions.collect {
                                        if (it is androidx.compose.foundation.interaction.PressInteraction.Release) {
                                            if (uiState.selectedCity != null) showDistrictPicker = true
                                        }
                                    }
                                }
                            }
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = detailAddress,
                    onValueChange = { detailAddress = it },
                    label = { Text("详细地址") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    maxLines = 3,
                    shape = RoundedCornerShape(12.dp)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val province = uiState.selectedProvince ?: ""
                    val city = uiState.selectedCity ?: ""
                    val district = uiState.selectedDistrict ?: ""
                    if (name.isNotBlank() && phone.isNotBlank() && province.isNotBlank()
                        && city.isNotBlank() && district.isNotBlank() && detailAddress.isNotBlank()
                    ) {
                        onSubmit(name, phone, province, city, district, detailAddress)
                    }
                },
                enabled = name.isNotBlank() && phone.matches(Regex("^1[3-9]\\d{9}$"))
                        && uiState.selectedProvince != null
                        && uiState.selectedCity != null
                        && uiState.selectedDistrict != null
                        && detailAddress.isNotBlank(),
                shape = RoundedCornerShape(24.dp),
                colors = ButtonDefaults.buttonColors(containerColor = LotteryRed),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) {
                Text("提交收货地址", fontSize = 16.sp, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )

    if (showProvincePicker) {
        RegionPickerDialog(
            title = "选择省份",
            items = uiState.provinces,
            onSelected = {
                viewModel.selectProvince(it)
                showProvincePicker = false
            },
            onDismiss = { showProvincePicker = false }
        )
    }

    if (showCityPicker) {
        RegionPickerDialog(
            title = "选择城市",
            items = uiState.cities,
            onSelected = {
                viewModel.selectCity(it)
                showCityPicker = false
            },
            onDismiss = { showCityPicker = false }
        )
    }

    if (showDistrictPicker) {
        RegionPickerDialog(
            title = "选择区县",
            items = uiState.districts,
            onSelected = {
                viewModel.selectDistrict(it)
                showDistrictPicker = false
            },
            onDismiss = { showDistrictPicker = false }
        )
    }
}

@Composable
private fun RegionPickerDialog(
    title: String,
    items: List<String>,
    onSelected: (String) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(20.dp),
        containerColor = Color.White,
        title = {
            Text(title, fontWeight = FontWeight.Bold)
        },
        text = {
            LazyColumn(
                modifier = Modifier.heightIn(max = 400.dp)
            ) {
                items(items) { item ->
                    Text(
                        text = item,
                        fontSize = 15.sp,
                        color = TextBody,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelected(item) }
                            .padding(vertical = 12.dp, horizontal = 8.dp)
                    )
                    if (item != items.last()) {
                        HorizontalDivider(color = DividerLight)
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )
}

@Composable
private fun LotteryMessageDialog(
    message: String,
    isNoChance: Boolean,
    isPrizesExhausted: Boolean,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color.White,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(
                            when {
                                isPrizesExhausted -> Color(0xFFFF9800).copy(alpha = 0.15f)
                                isNoChance -> Color(0xFF9C27B0).copy(alpha = 0.15f)
                                else -> LotteryRed.copy(alpha = 0.15f)
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = when {
                            isPrizesExhausted -> Icons.Default.Star
                            isNoChance -> Icons.Default.Videocam
                            else -> Icons.Default.Celebration
                        },
                        contentDescription = null,
                        tint = when {
                            isPrizesExhausted -> Color(0xFFFF9800)
                            isNoChance -> Color(0xFF9C27B0)
                            else -> LotteryRed
                        },
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = when {
                        isPrizesExhausted -> "奖品已发完"
                        isNoChance -> "抽奖次数不足"
                        else -> "提示"
                    },
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF333333)
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = message,
                    fontSize = 14.sp,
                    color = TextSecondary,
                    textAlign = TextAlign.Center,
                    lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(20.dp))

                Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = when {
                            isPrizesExhausted -> Color(0xFFFF9800)
                            isNoChance -> Color(0xFF9C27B0)
                            else -> LotteryRed
                        }
                    )
                ) {
                    Text("知道了", fontSize = 15.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

@Composable
private fun RecordsPanel(
    allRecords: List<LotteryRecord>,
    winRecords: List<LotteryRecord>,
    onDismiss: () -> Unit,
    onFillAddress: (LotteryRecord) -> Unit
) {
    var showWinTab by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(20.dp),
        containerColor = Color.White,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Star,
                    contentDescription = null,
                    tint = LotteryGold,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("抽奖记录", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { showWinTab = false },
                        shape = RoundedCornerShape(8.dp),
                        color = if (!showWinTab) LotteryRed.copy(alpha = 0.1f) else Color.Transparent
                    ) {
                        Text(
                            text = "全部 (${allRecords.size})",
                            fontSize = 13.sp,
                            fontWeight = if (!showWinTab) FontWeight.Bold else FontWeight.Normal,
                            color = if (!showWinTab) LotteryRed else TextTertiary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(vertical = 8.dp)
                        )
                    }
                    Surface(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { showWinTab = true },
                        shape = RoundedCornerShape(8.dp),
                        color = if (showWinTab) LotteryRed.copy(alpha = 0.1f) else Color.Transparent
                    ) {
                        Text(
                            text = "中奖 (${winRecords.size})",
                            fontSize = 13.sp,
                            fontWeight = if (showWinTab) FontWeight.Bold else FontWeight.Normal,
                            color = if (showWinTab) LotteryRed else TextTertiary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(vertical = 8.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))

                val displayRecords = if (showWinTab) winRecords else allRecords

                if (displayRecords.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (showWinTab) "暂无中奖记录" else "暂无抽奖记录",
                            color = TextTertiary,
                            fontSize = 14.sp
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.heightIn(max = 400.dp)
                    ) {
                        items(displayRecords) { record ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                val recordPrizeImageUrl = if (record.isWinner == 1) ApiConfig.getFullImageUrl(record.prizeImage) else null
                                if (recordPrizeImageUrl != null) {
                                    NetworkImage(
                                        url = recordPrizeImageUrl,
                                        contentDescription = record.prizeName,
                                        modifier = Modifier
                                            .size(36.dp)
                                            .clip(RoundedCornerShape(6.dp)),
                                        contentScale = ContentScale.Crop
                                    )
                                } else {
                                    Icon(
                                        imageVector = if (record.isWinner == 1) Icons.Default.Celebration else Icons.Default.Star,
                                        contentDescription = null,
                                        tint = if (record.isWinner == 1) LotteryGold else TextTertiary,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = if (record.isWinner == 1) (record.prizeName ?: "奖品") else "未中奖",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = if (record.isWinner == 1) TitleDeep else TextTertiary
                                    )
                                    Text(
                                        text = record.drawTime ?: "",
                                        fontSize = 11.sp,
                                        color = TextTertiary
                                    )
                                }
                                if (record.isWinner == 1 && record.needsShipping == 1 && !record.hasAddress) {
                                    TextButton(onClick = { onFillAddress(record) }) {
                                        Text("填写地址", fontSize = 12.sp, color = LotteryRed)
                                    }
                                } else if (record.isWinner == 1 && record.needsShipping == 1 && record.hasAddress) {
                                    val statusLabel = when (record.shippingStatus) {
                                        "shipped" -> "已发货"
                                        "delivered" -> "已签收"
                                        else -> "待发货"
                                    }
                                    val statusClr = when (record.shippingStatus) {
                                        "shipped" -> Color(0xFF4CAF50)
                                        "delivered" -> Color(0xFF2196F3)
                                        else -> SuccessGreen
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text(statusLabel, fontSize = 12.sp, color = statusClr)
                                        if (!record.trackingNumber.isNullOrBlank()) {
                                            val ctx = LocalContext.current
                                            Row(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(4.dp))
                                                    .clickable {
                                                        val clipboard = ctx.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                                                        val clip = android.content.ClipData.newPlainText("快递单号", record.trackingNumber)
                                                        clipboard.setPrimaryClip(clip)
                                                        android.widget.Toast.makeText(ctx, "快递单号已复制", android.widget.Toast.LENGTH_SHORT).show()
                                                    }
                                                    .padding(horizontal = 2.dp, vertical = 1.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = (record.courierCompany?.takeIf { it.isNotBlank() }?.let { "$it: " } ?: "") + record.trackingNumber,
                                                    fontSize = 10.sp,
                                                    color = TextTertiary,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis,
                                                    modifier = Modifier.widthIn(max = 100.dp)
                                                )
                                                Spacer(modifier = Modifier.width(2.dp))
                                                Icon(
                                                    imageVector = Icons.Default.ContentCopy,
                                                    contentDescription = "复制",
                                                    modifier = Modifier.size(10.dp),
                                                    tint = TextTertiary.copy(alpha = 0.5f)
                                                )
                                            }
                                        }
                                    }
                                } else if (record.isWinner == 1 && record.needsShipping != 1) {
                                    Text("虚拟奖品", fontSize = 12.sp, color = TextTertiary)
                                } else {
                                    Surface(
                                        shape = RoundedCornerShape(4.dp),
                                        color = Color(0xFFF5F5F5)
                                    ) {
                                        Text(
                                            text = "未中",
                                            fontSize = 11.sp,
                                            color = TextTertiary,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }
                            if (record != displayRecords.last()) {
                                HorizontalDivider(color = DividerLight)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("关闭")
            }
        }
    )
}

@Composable
private fun InviteDialog(
    inviteInfo: InviteInfo?,
    onDismiss: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current

    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(20.dp),
        containerColor = Color.White,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.PersonAdd,
                    contentDescription = null,
                    tint = LotteryRed,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("邀请好友得机会", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            }
        },
        text = {
            Column {
                Text(
                    text = "邀请新用户注册，每成功邀请1人获得1次额外抽奖机会，每日最多2次",
                    fontSize = 13.sp,
                    color = TextSecondary,
                    lineHeight = 18.sp
                )
                Spacer(modifier = Modifier.height(16.dp))

                Text("我的邀请码", fontSize = 12.sp, color = TextTertiary)
                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFFFF8E1))
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = inviteInfo?.inviteCode ?: "--",
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black,
                        color = LotteryRedDark,
                        letterSpacing = 4.sp
                    )
                    IconButton(onClick = {
                        val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                        val clip = android.content.ClipData.newPlainText("邀请码", inviteInfo?.inviteCode ?: "")
                        clipboard.setPrimaryClip(clip)
                    }) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "复制",
                            tint = LotteryRed,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("今日邀请", fontSize = 12.sp, color = TextTertiary)
                        Text(
                            text = "${inviteInfo?.todayInvites ?: 0}/2",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = LotteryRed
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("今日奖励次数", fontSize = 12.sp, color = TextTertiary)
                        Text(
                            text = "+${inviteInfo?.inviteBonusToday ?: 0}",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = SuccessGreen
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("累计邀请", fontSize = 12.sp, color = TextTertiary)
                        Text(
                            text = "${inviteInfo?.totalInvites ?: 0}人",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = TitleDeep
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            val clip = android.content.ClipData.newPlainText("邀请码", inviteInfo?.inviteCode ?: "")
                            clipboard.setPrimaryClip(clip)
                            android.widget.Toast.makeText(context, "邀请码已复制", android.widget.Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = LotteryRed)
                    ) {
                        Icon(imageVector = Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("复制邀请码", fontSize = 13.sp)
                    }

                    Button(
                        onClick = {
                            val inviteCode = inviteInfo?.inviteCode ?: ""
                            val shareText = buildString {
                                append("🎁 邀请你一起抽奖赢好礼！\n\n")
                                append("1️⃣ 下载「有指南」APP：https://app.your-domain.com\n\n")
                                append("2️⃣ 注册时填写邀请码：$inviteCode\n")
                                append("即可获得额外抽奖机会！\n\n")
                                append("👉 已安装？点击直接打开：https://your-domain.com/invite/$inviteCode")
                            }
                            try {
                                val shareIntent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(android.content.Intent.EXTRA_TEXT, shareText)
                                    putExtra(android.content.Intent.EXTRA_SUBJECT, "邀请你一起抽奖")
                                }
                                context.startActivity(android.content.Intent.createChooser(shareIntent, "分享邀请到"))
                            } catch (e: Exception) {
                                android.widget.Toast.makeText(context, "分享失败", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = LotteryRed)
                    ) {
                        Icon(imageVector = Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("分享给好友", fontSize = 13.sp, color = Color.White)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "好友通过您的链接下载APP并注册，或注册时填写您的邀请码，即可获得额外抽奖机会",
                    fontSize = 12.sp,
                    color = TextTertiary,
                    lineHeight = 16.sp
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("知道了")
            }
        }
    )
}
