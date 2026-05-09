package com.example.youzhinan.ui.pages

import android.Manifest
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.RemoveRedEye
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.youzhinan.data.api.ApiConfig
import com.example.youzhinan.data.api.InfoDto
import com.example.youzhinan.ui.components.NetworkImage
import com.example.youzhinan.ui.theme.*
import com.example.youzhinan.ui.viewmodel.HomeViewModel
import com.example.youzhinan.ui.viewmodel.VersionInfoViewModel
import com.example.youzhinan.utils.LocationHelper
import com.example.youzhinan.utils.formatDistance
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import kotlinx.coroutines.withTimeoutOrNull
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalPermissionsApi::class, androidx.compose.material.ExperimentalMaterialApi::class)
@Composable
fun HomePage(
    navController: androidx.navigation.NavHostController,
    paddingValues: PaddingValues = PaddingValues(0.dp),
    viewModel: HomeViewModel = viewModel(),
    versionViewModel: VersionInfoViewModel = viewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val versionUiState by versionViewModel.uiState.collectAsState()
    
    var showUpdateDialog by remember { mutableStateOf(false) }
    
    val refreshState = rememberPullRefreshState(
        refreshing = uiState.isLoading,
        onRefresh = { viewModel.loadData(context, forceRefresh = true) }
    )

    val locationPermissionState = rememberPermissionState(Manifest.permission.ACCESS_FINE_LOCATION)
    var locationPermissionRequested by remember { mutableStateOf(false) }

    val nearbyScrollPos = viewModel.getScrollPosition(0)
    val newScrollPos = viewModel.getScrollPosition(1)
    val highScoreScrollPos = viewModel.getScrollPosition(2)

    val nearbyListState = rememberLazyGridState(
        initialFirstVisibleItemIndex = nearbyScrollPos?.first ?: 0,
        initialFirstVisibleItemScrollOffset = nearbyScrollPos?.second ?: 0
    )
    val newListState = rememberLazyGridState(
        initialFirstVisibleItemIndex = newScrollPos?.first ?: 0,
        initialFirstVisibleItemScrollOffset = newScrollPos?.second ?: 0
    )
    val highScoreListState = rememberLazyGridState(
        initialFirstVisibleItemIndex = highScoreScrollPos?.first ?: 0,
        initialFirstVisibleItemScrollOffset = highScoreScrollPos?.second ?: 0
    )

    DisposableEffect(Unit) {
        onDispose {
            viewModel.saveScrollPosition(0, nearbyListState.firstVisibleItemIndex, nearbyListState.firstVisibleItemScrollOffset)
            viewModel.saveScrollPosition(1, newListState.firstVisibleItemIndex, newListState.firstVisibleItemScrollOffset)
            viewModel.saveScrollPosition(2, highScoreListState.firstVisibleItemIndex, highScoreListState.firstVisibleItemScrollOffset)
        }
    }

    LaunchedEffect(Unit) {
        if (!LocationHelper.hasLocationPermission(context) && !locationPermissionRequested) {
            locationPermissionRequested = true
            locationPermissionState.launchPermissionRequest()
        }

        if (LocationHelper.hasLocationPermission(context) && uiState.currentLocation == null) {
            try {
                val location = withTimeoutOrNull(8000L) {
                    LocationHelper.getCurrentLocation(context)
                }
                if (location != null) {
                    viewModel.updateLocation(location)
                }
            } catch (_: Exception) { }
        }

        viewModel.loadData(context)
        
        versionViewModel.init()
        versionViewModel.checkUpdate()
    }

    LaunchedEffect(locationPermissionState.status) {
        if (locationPermissionState.status.isGranted && uiState.currentLocation == null) {
            try {
                val location = withTimeoutOrNull(8000L) {
                    LocationHelper.getCurrentLocation(context)
                }
                if (location != null) {
                    viewModel.updateLocation(location)
                }
            } catch (_: Exception) { }
        }
    }

    LaunchedEffect(versionUiState.hasUpdate) {
        if (versionUiState.hasUpdate && !versionUiState.isCheckingUpdate) {
            showUpdateDialog = true
        }
    }

    val greeting = getGreeting()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8F9FC))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .statusBarsPadding()
                .padding(top = 4.dp, bottom = 0.dp)
        ) {
            Text(
                text = greeting,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF1A1A2E)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.White,
                shape = RoundedCornerShape(12.dp),
                shadowElevation = 2.dp
            ) {
                Column(
                    modifier = Modifier.padding(start = 10.dp, end = 10.dp, top = 10.dp, bottom = 6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        listOf(
                            Triple("附近", Icons.Rounded.Place, 0),
                            Triple("新发现", Icons.Filled.Star, 1),
                            Triple("高评分", Icons.Rounded.Star, 2)
                        ).forEach { (label, icon, index) ->
                            val isSelected = uiState.selectedTab == index
                            val scale by animateFloatAsState(if (isSelected) 1.02f else 1f)

                            Surface(
                                modifier = Modifier
                                    .scale(scale)
                                    .weight(1f)
                                    .height(30.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable {
                                        if (isSelected) {
                                            viewModel.loadData(context, forceRefresh = true)
                                        } else {
                                            viewModel.selectTab(index)
                                        }
                                    },
                                color = if (isSelected) Color(0xFF6C63FF) else Color(0xFFF5F5FA),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center,
                                    modifier = Modifier.fillMaxSize()
                                ) {
                                    Icon(
                                        imageVector = icon,
                                        contentDescription = null,
                                        tint = if (isSelected) Color.White else Color(0xFF6C63FF),
                                        modifier = Modifier.size(13.dp)
                                    )
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        text = label,
                                        fontSize = 11.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = if (isSelected) Color.White else Color(0xFF4A4A6A)
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(38.dp)
                            .clip(RoundedCornerShape(19.dp))
                            .clickable { navController.navigate("search") },
                        color = Color(0xFFF5F5FA),
                        shape = RoundedCornerShape(19.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = null,
                                tint = Color(0xFF6C63FF),
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "搜索地点、活动...",
                                fontSize = 13.sp,
                                color = Color(0xFF8888AA),
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .pullRefresh(refreshState)
        ) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxSize(),
                state = when (uiState.selectedTab) {
                    0 -> nearbyListState
                    1 -> newListState
                    2 -> highScoreListState
                    else -> nearbyListState
                },
                contentPadding = PaddingValues(
                    start = 16.dp,
                    end = 16.dp,
                    top = 4.dp,
                    bottom = paddingValues.calculateBottomPadding() + 16.dp
                ),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                    item(span = { GridItemSpan(2) }) {
                        if (uiState.isLoading) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(200.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    CircularProgressIndicator(color = Primary, strokeWidth = 2.5.dp)
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Text("探索中...", color = TextSecondary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                }
                            }
                        } else if (uiState.error != null && uiState.nearbyInfos.isEmpty() && uiState.newInfos.isEmpty() && uiState.highScoreInfos.isEmpty()) {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = ErrorBackground),
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Column(modifier = Modifier.padding(20.dp)) {
                                    Text("加载失败", color = ErrorRed, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(uiState.error ?: "", color = ErrorRed, fontSize = 13.sp, lineHeight = 18.sp)
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Button(
                                        onClick = { viewModel.loadData(context, forceRefresh = true) },
                                        colors = ButtonDefaults.buttonColors(containerColor = TitleDark)
                                    ) {
                                        Text("重试")
                                    }
                                }
                            }
                        }
                    }

                    when (uiState.selectedTab) {
                        0 -> {
                            if (uiState.nearbyInfos.isNotEmpty()) {
                                itemsIndexed(uiState.nearbyInfos) { index, info ->
                                    InfoCard(
                                        info = info,
                                        index = index,
                                        onClick = {
                                            navController.navigate("detail/${info.id}")
                                        },
                                        currentLocation = uiState.currentLocation
                                    )
                                }
                            } else if (!uiState.isLoading) {
                                item(span = { GridItemSpan(2) }) {
                                    EmptySectionHint(
                                        if (uiState.currentLocation == null) "请授权定位以查看附近信息"
                                        else "暂无附近信息"
                                    )
                                }
                            }
                        }
                        1 -> {
                            if (uiState.newInfos.isNotEmpty()) {
                                itemsIndexed(uiState.newInfos) { index, info ->
                                    InfoCard(
                                        info = info,
                                        index = index,
                                        onClick = {
                                            navController.navigate("detail/${info.id}")
                                        },
                                        currentLocation = uiState.currentLocation
                                    )
                                }
                            } else if (!uiState.isLoading) {
                                item(span = { GridItemSpan(2) }) {
                                    EmptySectionHint("暂无新发现")
                                }
                            }
                        }
                        2 -> {
                            if (uiState.highScoreInfos.isNotEmpty()) {
                                itemsIndexed(uiState.highScoreInfos) { index, info ->
                                    InfoCard(
                                        info = info,
                                        index = index,
                                        onClick = {
                                            navController.navigate("detail/${info.id}")
                                        },
                                        currentLocation = uiState.currentLocation
                                    )
                                }
                            } else if (!uiState.isLoading) {
                                item(span = { GridItemSpan(2) }) {
                                    EmptySectionHint("暂无高评分信息")
                                }
                            }
                        }
                    }
                }
            }
        }
    
    if (showUpdateDialog && versionUiState.hasUpdate) {
        AlertDialog(
            onDismissRequest = { showUpdateDialog = false },
            title = {
                Text(
                    text = "发现新版本",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column {
                    Text(
                        text = "新版本: ${versionUiState.latestVersion?.versionName}",
                        fontSize = 16.sp,
                        color = Color(0xFF333333)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    if (!versionUiState.latestVersion?.updateDescription.isNullOrBlank()) {
                        Text(
                            text = "更新说明:\n${versionUiState.latestVersion?.updateDescription}",
                            fontSize = 14.sp,
                            color = Color(0xFF666666)
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showUpdateDialog = false
                        navController.navigate("versionInfo")
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF333333)
                    )
                ) {
                    Text("去更新")
                }
            },
            dismissButton = {
                TextButton(onClick = { showUpdateDialog = false }) {
                    Text("取消", color = Color(0xFF666666))
                }
            }
        )
    }
}

@Composable
fun InfoCard(info: InfoDto, index: Int = 0, onClick: () -> Unit, currentLocation: Pair<Double, Double>? = null) {
    val displayName = info.storeName ?: info.title ?: "无标题"
    val imageUrl = ApiConfig.getThumbnailUrl(info.images?.firstOrNull() ?: info.imageUrl, "small")
    val isStaggered = index % 2 != 0

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .offset(y = if (isStaggered) 12.dp else 0.dp)
            .shadow(
                elevation = 4.dp,
                shape = RoundedCornerShape(14.dp),
                ambientColor = Color(0x0D000000),
                spotColor = Color(0x0D000000)
            )
            .clip(RoundedCornerShape(14.dp))
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(150.dp)
            ) {
                if (!imageUrl.isNullOrBlank()) {
                    NetworkImage(
                        url = imageUrl,
                        contentDescription = displayName,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp)),
                        contentScale = ContentScale.Crop
                    )
                    
                    if (!info.category.isNullOrBlank()) {
                        Surface(
                            modifier = Modifier
                                .align(Alignment.TopStart)
                                .padding(8.dp),
                            color = Color(0xFF6C63FF).copy(alpha = 0.9f),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = info.category!!,
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp))
                            .background(
                                Brush.linearGradient(
                                    colors = listOf(Color(0xFFE8EAF6), Color(0xFFC5CAE9))
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Star,
                            contentDescription = null,
                            tint = Color(0xFF6C63FF),
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp)
                    .padding(top = 10.dp, bottom = 12.dp)
            ) {
                Text(
                    text = displayName,
                    fontSize = 14.sp,
                    color = Color(0xFF1A1A2E),
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    lineHeight = 20.sp,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Star,
                        contentDescription = null,
                        tint = Color(0xFFFFB800),
                        modifier = Modifier.size(13.dp)
                    )
                    Text(
                        text = String.format("%.1f", info.rating ?: 0.0),
                        color = Color(0xFFFFB800),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.weight(1f))

                    info.viewCount?.let { views ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.RemoveRedEye,
                                contentDescription = null,
                                tint = Color(0xFF999999),
                                modifier = Modifier.size(12.dp)
                            )
                            Text(
                                text = if (views > 999) "${views / 1000}k" else "$views",
                                color = Color(0xFF999999),
                                fontSize = 10.sp
                            )
                        }
                    }
                }

                if (info.latitude != null && info.longitude != null && currentLocation != null) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            tint = Color(0xFF999999),
                            modifier = Modifier.size(12.dp)
                        )
                        val distMeters = com.example.youzhinan.utils.LocationHelper.distanceMeters(
                            currentLocation.first,
                            currentLocation.second,
                            info.latitude,
                            info.longitude
                        ).toDouble()
                        Text(
                            text = formatDistance(distMeters),
                            color = Color(0xFF999999),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun EmptySectionHint(text: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 48.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFFE8EAF6))
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = text,
                color = TextSecondary,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

private fun getGreeting(): String {
    val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    return when {
        hour < 6 -> "夜深了，早点休息"
        hour < 9 -> "早上好，新的一天"
        hour < 12 -> "上午好，加油"
        hour < 14 -> "中午好，记得午休"
        hour < 17 -> "下午好，继续冲"
        hour < 19 -> "傍晚好，放松一下"
        hour < 22 -> "晚上好，辛苦了"
        else -> "夜深了，注意休息"
    }
}
