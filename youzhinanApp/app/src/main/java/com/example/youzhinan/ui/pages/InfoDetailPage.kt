package com.example.youzhinan.ui.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.ContactPhone
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Directions
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.EditLocation
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.PhoneInTalk
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import com.example.youzhinan.data.api.ContactInfo
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.youzhinan.ui.components.NetworkImage
import android.util.Log
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import com.example.youzhinan.data.api.ApiConfig
import com.example.youzhinan.data.api.InfoDto
import com.example.youzhinan.data.api.RetrofitClient
import com.example.youzhinan.utils.FavoritesManager
import com.example.youzhinan.utils.LocationHelper
import com.example.youzhinan.utils.formatDistance
import androidx.navigation.NavHostController
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale

/**
 * ProfileViewModel Factory
 */
class ProfileViewModelFactory(
    private val application: android.app.Application
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(ProfileViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return ProfileViewModel(application) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InfoDetailPage(navController: NavHostController, infoId: Int?) {
    val context = LocalContext.current
    val application = context.applicationContext as android.app.Application
    val profileViewModel: ProfileViewModel = viewModel(factory = ProfileViewModelFactory(application))
    val profileUiState by profileViewModel.uiState.collectAsState()
    
    var info by remember { mutableStateOf<InfoDto?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var isFavorited by remember { mutableStateOf(false) }
    var currentLocation by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    var distanceText by remember { mutableStateOf<String?>(null) }
    var showLoginDialog by remember { mutableStateOf(false) }
    
    // 当详情加载完成后，尝试获取当前位置并计算距离（若提供经纬度）
    LaunchedEffect(info) {
        val currentInfo = info
        distanceText = null
        if (currentInfo != null && currentInfo.latitude != null && currentInfo.longitude != null) {
            if (LocationHelper.hasLocationPermission(context)) {
                try {
                    val loc = withTimeoutOrNull(8000L) {
                        LocationHelper.getCurrentLocation(context)
                    }
                    if (loc != null) {
                        currentLocation = loc
                        val distMeters = LocationHelper.distanceMeters(
                            loc.first,
                            loc.second,
                            currentInfo.latitude,
                            currentInfo.longitude
                        ).toDouble()
                        distanceText = formatDistance(distMeters)
                    }
                } catch (_: Exception) {
                    distanceText = null
                }
            }
        }
    }

    LaunchedEffect(infoId) {
        if (infoId == null) {
            isLoading = false
            loadError = "无效的信息 ID"
            return@LaunchedEffect
        }
        
        isLoading = true
        loadError = null
        
        try {
            Log.d("InfoDetailPage", "从 API 加载详情 ID: $infoId")
            Log.d("InfoDetailPage", "BASE_URL: ${ApiConfig.BASE_URL}")
            
            val apiService = RetrofitClient.getApiService()
            val response = apiService.getInfoDetail(infoId)
            
            Log.d("InfoDetailPage", "响应码：${response.code()}")
            Log.d("InfoDetailPage", "响应成功：${response.isSuccessful}")
            Log.d("InfoDetailPage", "响应体：${response.body()}")
            
            if (response.isSuccessful && response.body() != null) {
                val loadedInfo = response.body()!!
                info = loadedInfo
                isFavorited = FavoritesManager.isFavorite(context, loadedInfo.id)
                Log.d("InfoDetailPage", "加载成功：${loadedInfo.storeName ?: loadedInfo.title}")
            } else {
                val errorBody = response.errorBody()?.string()
                Log.e("InfoDetailPage", "API 错误：${response.code()} - ${response.message()}")
                Log.e("InfoDetailPage", "错误体：$errorBody")
                loadError = "加载失败：HTTP ${response.code()}"
            }
        } catch (e: Exception) {
            Log.e("InfoDetailPage", "加载详情异常", e)
            loadError = "加载失败：${e.message ?: "未知错误"}"
        }
        
        isLoading = false
    }

    Scaffold(
        topBar = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .background(Color(0xFF6C63FF))
            )
        }
    ) { innerPadding ->
        when {
            loadError != null -> {
                Box(
                    modifier = Modifier
                        .padding(innerPadding)
                        .fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = loadError!!,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(16.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { navController.popBackStack() }) {
                            Text("返回")
                        }
                    }
                }
            }
            info != null -> {
            Column(
                modifier = Modifier
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
                    .background(Color(0xFFF8F9FC))
            ) {
                val currentInfo = info!!
                val fullAddress = buildString {
                    if (!currentInfo.province.isNullOrBlank()) append(currentInfo.province)
                    if (!currentInfo.city.isNullOrBlank()) append(" ${currentInfo.city}")
                    if (!currentInfo.district.isNullOrBlank()) append(" ${currentInfo.district}")
                    if (!currentInfo.address.isNullOrBlank()) append(" ${currentInfo.address}")
                }.trim()
                
                val imageUrl = ApiConfig.getFullImageUrl(currentInfo.images?.firstOrNull() ?: currentInfo.imageUrl)
                
                if (!imageUrl.isNullOrBlank()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(280.dp)
                            .background(Color(0xFFF1F3F8))
                    ) {
                        NetworkImage(
                            url = imageUrl,
                            contentDescription = currentInfo.title,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Fit
                        )
                        
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(
                                            Color.Transparent,
                                            Color(0x80000000)
                                        )
                                    )
                                )
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .background(
                                Brush.horizontalGradient(
                                    colors = listOf(
                                        Color(0xFF667eea),
                                        Color(0xFF764ba2)
                                    )
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = null,
                                modifier = Modifier.size(60.dp),
                                tint = Color.White.copy(alpha = 0.8f)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "暂无图片",
                                fontSize = 16.sp,
                                color = Color.White.copy(alpha = 0.9f),
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .shadow(
                            elevation = 8.dp,
                            shape = RoundedCornerShape(16.dp)
                        ),
                    colors = CardDefaults.cardColors(
                        containerColor = Color.White
                    ),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp)
                    ) {
                        Text(
                            text = currentInfo.storeName ?: currentInfo.title ?: "无标题",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF333333),
                            lineHeight = 32.sp
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            currentInfo.category?.let { category ->
                                Surface(
                                    color = Color(0xFF6C63FF),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = category,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                        fontSize = 13.sp,
                                        color = Color.White,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }

                            currentInfo.rating?.let { rating ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Star,
                                        contentDescription = null,
                                        modifier = Modifier.size(18.dp),
                                        tint = Color(0xFFFFB300)
                                    )
                                    Text(
                                        text = String.format(Locale.getDefault(), "%.1f", rating),
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFFFFB300)
                                    )
                                }
                            }

                            // 如果已计算到距离，则在右侧显示（km）
                            Spacer(modifier = Modifier.weight(1f))
                            distanceText?.let { dt ->
                                Surface(
                                    color = Color(0xFF6C63FF),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        text = dt,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                        color = Color.White,
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        HorizontalDivider(
                            color = Color(0xFFEEEEEE),
                            thickness = 1.dp
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Column(modifier = Modifier.fillMaxWidth()) {
                            CompactInfoRow(
                                icon = Icons.Default.LocationOn,
                                title = "地址",
                                content = buildString {
                                    if (!currentInfo.province.isNullOrBlank()) append(currentInfo.province)
                                    if (!currentInfo.city.isNullOrBlank()) append(" ${currentInfo.city}")
                                    if (!currentInfo.district.isNullOrBlank()) append(" ${currentInfo.district}")
                                    if (!currentInfo.address.isNullOrBlank()) append(" ${currentInfo.address}")
                                },
                                contentColor = Color(0xFF666666)
                            )
                            
                            Spacer(modifier = Modifier.height(8.dp))
                            
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                Button(
                                    onClick = {
                                        if (fullAddress.isNotBlank()) {
                                            try {
                                                val uri = Uri.parse("geo:0,0?q=${Uri.encode(fullAddress)}")
                                                val intent = Intent(Intent.ACTION_VIEW, uri)
                                                intent.setPackage("com.autonavi.minimap")
                                                if (intent.resolveActivity(context.packageManager) != null) {
                                                    context.startActivity(intent)
                                                } else {
                                                    intent.setPackage("com.baidu.BaiduMap")
                                                    if (intent.resolveActivity(context.packageManager) != null) {
                                                        context.startActivity(intent)
                                                    } else {
                                                        intent.setPackage(null)
                                                        context.startActivity(Intent.createChooser(intent, "选择地图应用"))
                                                    }
                                                }
                                            } catch (e: Exception) {
                                                Toast.makeText(context, "启动导航失败", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    },
                                    modifier = Modifier
                                        .height(36.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = Color(0xFF6C63FF)
                                    ),
                                    shape = RoundedCornerShape(8.dp),
                                    contentPadding = PaddingValues(horizontal = 12.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.EditLocation,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp),
                                        tint = Color.White
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "去导航",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color.White
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        currentInfo.businessHours?.let { hours ->
                            if (hours.isNotBlank()) {
                                InfoRow(
                                    icon = Icons.Default.Schedule,
                                    title = "营业时间",
                                    content = hours,
                                    contentColor = Color(0xFF666666)
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        currentInfo.price?.let { price ->
                            if (price.isNotBlank()) {
                                InfoRow(
                                    icon = Icons.Default.ShoppingCart,
                                    title = "人均消费",
                                    content = price,
                                    contentColor = Color(0xFFFF5252),
                                    contentFontSize = 20.sp,
                                    contentFontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        val description = currentInfo.description ?: currentInfo.content
                        if (!description.isNullOrBlank()) {
                            Column {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(28.dp)
                                            .background(Color(0xFF6C63FF), RoundedCornerShape(8.dp)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Info,
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp),
                                            tint = Color.White
                                        )
                                    }
                                    Text(
                                        text = "描述",
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xFF333333)
                                    )
                                }
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = description,
                                    fontSize = 15.sp,
                                    color = Color(0xFF666666),
                                    lineHeight = 24.sp,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // 显示联系方式
                // 检查是否有任何有效的联系方式
                val hasAnyContact = 
                    !currentInfo.contact?.phone.isNullOrEmpty() ||
                    !currentInfo.contact?.landline.isNullOrEmpty() ||
                    !currentInfo.contact?.wechat.isNullOrEmpty()
                
                if (hasAnyContact) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = Color.White
                        ),
                        shape = RoundedCornerShape(16.dp),
                        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .background(Color(0xFF6C63FF), CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.ContactPhone,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                                Text(
                                    text = "联系方式",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFF333333)
                                )
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            var hasContact = false

                            // 显示手机号
                            currentInfo.contact?.phone?.let { phoneList ->
                                if (phoneList.isNotEmpty()) {
                                    hasContact = true
                                    ContactItemList(
                                        title = "手机号",
                                        icon = Icons.Default.PhoneInTalk,
                                        actionIcon = Icons.Default.Call,
                                        items = phoneList,
                                        isLoggedIn = profileUiState.isLoggedIn,
                                        onItemClick = { item ->
                                            try {
                                                val intent = Intent(Intent.ACTION_DIAL).apply {
                                                    data = Uri.parse("tel:$item")
                                                }
                                                context.startActivity(intent)
                                            } catch (e: Exception) {
                                                Toast.makeText(context, "无法启动拨号", Toast.LENGTH_SHORT).show()
                                            }
                                        },
                                        onRequireLogin = {
                                            showLoginDialog = true
                                        }
                                    )
                                }
                            }

                            // 显示座机号
                            currentInfo.contact?.landline?.let { landlineList ->
                                if (landlineList.isNotEmpty()) {
                                    if (hasContact) Spacer(modifier = Modifier.height(12.dp))
                                    hasContact = true
                                    ContactItemList(
                                        title = "座机号",
                                        icon = Icons.Default.Phone,
                                        actionIcon = Icons.Default.Call,
                                        items = landlineList,
                                        isLoggedIn = profileUiState.isLoggedIn,
                                        onItemClick = { item ->
                                            try {
                                                val intent = Intent(Intent.ACTION_DIAL).apply {
                                                    data = Uri.parse("tel:$item")
                                                }
                                                context.startActivity(intent)
                                            } catch (e: Exception) {
                                                Toast.makeText(context, "无法启动拨号", Toast.LENGTH_SHORT).show()
                                            }
                                        },
                                        onRequireLogin = {
                                            showLoginDialog = true
                                        }
                                    )
                                }
                            }

                            // 显示微信号
                            currentInfo.contact?.wechat?.let { wechatList ->
                                if (wechatList.isNotEmpty()) {
                                    if (hasContact) Spacer(modifier = Modifier.height(12.dp))
                                    hasContact = true
                                    ContactItemList(
                                        title = "微信号",
                                        icon = Icons.AutoMirrored.Filled.Chat,
                                        actionIcon = Icons.Default.ContentCopy,
                                        items = wechatList,
                                        isLoggedIn = profileUiState.isLoggedIn,
                                        onItemClick = { item ->
                                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                            val clip = ClipData.newPlainText("微信号", item)
                                            clipboard.setPrimaryClip(clip)
                                            Toast.makeText(context, "已复制到剪贴板", Toast.LENGTH_SHORT).show()
                                        },
                                        onRequireLogin = {
                                            showLoginDialog = true
                                        }
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                }

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .padding(bottom = 20.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Color.White
                    ),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(modifier = Modifier.weight(1f)) {
                            ActionButtonLarge(
                                icon = if (isFavorited) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                                text = if (isFavorited) "已收藏" else "收藏",
                                onClick = {
                                    if (!profileUiState.isLoggedIn) {
                                        showLoginDialog = true
                                        return@ActionButtonLarge
                                    }
                                    val result = FavoritesManager.toggleFavorite(context, currentInfo)
                                    isFavorited = result
                                    Toast.makeText(
                                        context,
                                        if (result) "已添加到收藏" else "已取消收藏",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                },
                                backgroundColor = Color(0xFF6C63FF),
                                contentColor = Color.White
                            )
                        }

                        Box(modifier = Modifier.weight(1f)) {
                            ActionButtonLarge(
                                icon = Icons.Default.Share,
                                text = "分享",
                                onClick = {
                                    val shareText = buildString {
                                        append("【${currentInfo.storeName ?: currentInfo.title ?: "分享"}】\n")
                                        if (!fullAddress.isBlank()) {
                                            append("📍 地址：$fullAddress\n")
                                        }
                                        val description = currentInfo.description ?: currentInfo.content
                                        if (!description.isNullOrBlank()) {
                                            append("\n$description")
                                        }
                                    }
                                    
                                    try {
                                        val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/plain"
                                            putExtra(Intent.EXTRA_TEXT, shareText)
                                            putExtra(Intent.EXTRA_SUBJECT, currentInfo.storeName ?: currentInfo.title ?: "分享")
                                        }
                                        context.startActivity(Intent.createChooser(shareIntent, "分享到"))
                                    } catch (e: Exception) {
                                        Toast.makeText(context, "分享失败", Toast.LENGTH_SHORT).show()
                                    }
                                },
                                backgroundColor = Color(0xFF6C63FF),
                                contentColor = Color.White
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
            }
        }
            else -> {
                Box(
                    modifier = Modifier
                        .padding(innerPadding)
                        .fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Color(0xFF6C63FF))
                }
            }
        }
        
        if (showLoginDialog) {
            LoginRequireDialog(
                onDismiss = { showLoginDialog = false },
                onConfirm = {
                    showLoginDialog = false
                    navController.navigate("profile")
                }
            )
        }
    }
}

@Composable
fun LoginRequireDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "需要登录",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Text(
                text = "请先登录后再查看完整联系方式",
                fontSize = 14.sp,
                color = Color(0xFF666666)
            )
        },
        confirmButton = {
            androidx.compose.material3.TextButton(
                onClick = onConfirm
            ) {
                Text(
                    text = "去登录",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        },
        dismissButton = {
            androidx.compose.material3.TextButton(
                onClick = onDismiss
            ) {
                Text(
                    text = "取消",
                    fontSize = 14.sp
                )
            }
        },
        shape = RoundedCornerShape(12.dp),
        containerColor = Color.White
    )
}

@Composable
fun InfoRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    content: String,
    contentColor: Color = Color(0xFF666666),
    contentFontSize: androidx.compose.ui.unit.TextUnit = 15.sp,
    contentFontWeight: FontWeight = FontWeight.Normal,
    contentLineHeight: androidx.compose.ui.unit.TextUnit = 24.sp
) {
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .background(Color(0xFF6C63FF), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = Color.White
                )
            }
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF1A1A2E)
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = content,
            fontSize = contentFontSize,
            color = contentColor,
            fontWeight = contentFontWeight,
            lineHeight = contentLineHeight,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
fun CompactInfoRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    content: String,
    contentColor: Color = Color(0xFF666666)
) {
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .background(Color(0xFF6C63FF), RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = Color.White
                )
            }
            Text(
                text = title,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF1A1A2E)
            )
        }

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = content,
            fontSize = 14.sp,
            color = contentColor,
            lineHeight = 20.sp,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
fun ContactItem(phone: String) {
    val context = LocalContext.current
    
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF5F5FA), RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = phone,
            fontSize = 16.sp,
            modifier = Modifier.weight(1f),
            color = Color(0xFF1A1A2E),
            fontWeight = FontWeight.Medium
        )

        Box(
            modifier = Modifier
                .size(44.dp)
                .background(Color(0xFF6C63FF), CircleShape)
                .clickable {
                    try {
                        val intent = Intent(Intent.ACTION_DIAL).apply {
                            data = Uri.parse("tel:$phone")
                        }
                        context.startActivity(intent)
                    } catch (e: Exception) {
                        Toast.makeText(context, "无法启动拨号", Toast.LENGTH_SHORT).show()
                    }
                },
            contentAlignment = Alignment.Center
        ) {
            Icon(
                Icons.Default.Call,
                contentDescription = "拨打",
                tint = Color.White,
                modifier = Modifier.size(22.dp)
            )
        }
    }
}

@Composable
fun ActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String,
    onClick: () -> Unit,
    backgroundColor: Color,
    contentColor: Color,
    shape: androidx.compose.ui.graphics.Shape = RoundedCornerShape(10.dp)
) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(44.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = backgroundColor
        ),
        shape = shape,
        contentPadding = PaddingValues(horizontal = 12.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(18.dp),
            tint = contentColor
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = text,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = contentColor
        )
    }
}

@Composable
fun ActionButtonLarge(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    text: String,
    onClick: () -> Unit,
    backgroundColor: Color,
    contentColor: Color
) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = backgroundColor
        ),
        shape = RoundedCornerShape(2.dp),
        contentPadding = PaddingValues(horizontal = 16.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(22.dp),
            tint = contentColor
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = text,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = contentColor
        )
    }
}

@Composable
fun ContactItemList(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    actionIcon: androidx.compose.ui.graphics.vector.ImageVector,
    items: List<String>,
    isLoggedIn: Boolean,
    onItemClick: (String) -> Unit,
    onRequireLogin: () -> Unit
) {
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .background(Color(0xFF6C63FF), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = Color.White
                )
            }
            Text(
                text = title,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF1A1A2E)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        items.forEach { item ->
            val maskedItem = maskContact(item)
            val canInteract = isLoggedIn
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { 
                        if (canInteract) {
                            onItemClick(item)
                        } else {
                            onRequireLogin()
                        }
                    }
                    .padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = maskedItem,
                    fontSize = 15.sp,
                    modifier = Modifier.weight(1f),
                    color = if (canInteract) Color(0xFF666666) else Color(0xFF999999)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .background(
                            if (canInteract) Color(0xFF6C63FF) else Color(0xFFE8E8F0), 
                            RoundedCornerShape(8.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = actionIcon,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                        tint = if (canInteract) Color.White else Color(0xFF999999)
                    )
                }
            }
        }
    }
}

/**
 * 脱敏函数：手机号中间 4 位用*代替，座机号和微信号部分隐藏
 */
private fun maskContact(contact: String): String {
    // 手机号：11 位数字，中间 4 位用*代替
    if (contact.matches(Regex("^1[3-9]\\d{9}$"))) {
        return contact.replaceRange(3, 7, "****")
    }
    // 座机号：带区号的格式，如 010-12345678
    if (contact.matches(Regex("^0\\d{2,3}-\\d{7,8}$"))) {
        val parts = contact.split("-")
        if (parts.size == 2) {
            val number = parts[1]
            val maskedNumber = if (number.length >= 7) {
                number.replaceRange(2, 5, "***")
            } else {
                number
            }
            return "${parts[0]}-$maskedNumber"
        }
    }
    // 微信号：超过 6 位的部分隐藏
    if (contact.length > 6) {
        return contact.take(3) + "****" + contact.takeLast(3)
    }
    // 其他格式：只显示前 3 位和后 3 位
    return if (contact.length > 6) {
        contact.take(3) + "****" + contact.takeLast(3)
    } else {
        contact
    }
}
