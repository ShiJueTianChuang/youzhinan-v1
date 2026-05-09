package com.example.youzhinan

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.youzhinan.R
import com.example.youzhinan.data.api.AgreementContent
import com.example.youzhinan.data.api.ApiConfig
import com.example.youzhinan.data.api.RetrofitClient
import com.example.youzhinan.ui.pages.AboutPage
import com.example.youzhinan.ui.pages.AIChatPage
import com.example.youzhinan.ui.pages.AIChatSettingsPage
import com.example.youzhinan.ui.pages.AIModelBindPage
import com.example.youzhinan.ui.pages.ChangePasswordPage
import com.example.youzhinan.ui.pages.EmailAuthPage
import com.example.youzhinan.ui.pages.FavoritesPage
import com.example.youzhinan.ui.pages.ForgotPasswordPage
import com.example.youzhinan.ui.pages.HelpFeedbackPage
import com.example.youzhinan.ui.pages.HomePage
import com.example.youzhinan.ui.pages.InfoDetailPage
import com.example.youzhinan.ui.pages.LotteryPage
import com.example.youzhinan.ui.pages.MessagesPage
import com.example.youzhinan.ui.pages.MySubmissionsPage
import com.example.youzhinan.ui.pages.PasswordLoginPage
import com.example.youzhinan.ui.pages.PersonalInfoPage
import com.example.youzhinan.ui.pages.PrivacyPolicyPage
import com.example.youzhinan.ui.pages.ProfilePage
import com.example.youzhinan.ui.pages.ProfileViewModel
import com.example.youzhinan.ui.pages.SearchPage
import com.example.youzhinan.ui.pages.SettingsPage
import com.example.youzhinan.ui.pages.SmsLoginPage
import com.example.youzhinan.ui.pages.SmsRegisterPage
import com.example.youzhinan.ui.pages.SubmitPage
import com.example.youzhinan.ui.pages.VersionInfoPage
import com.example.youzhinan.ui.theme.YouzhinanTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    val newIntentTrigger = mutableStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            YouzhinanTheme {
                MainApp()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        newIntentTrigger.value++
    }
}

private fun extractInviteCode(intent: Intent): String? {
    val uri = intent.data ?: return null
    return when (uri.scheme) {
        "youzhinan" -> uri.getQueryParameter("code")
        "https", "http" -> {
            when {
                uri.host == "your-domain.com" && uri.path?.startsWith("/invite") == true -> {
                    uri.pathSegments.lastOrNull()
                }
                uri.host == "app.your-domain.com" -> {
                    uri.getQueryParameter("invite_code")
                }
                else -> null
            }
        }
        else -> null
    }
}

@Composable
fun MainApp() {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("AppPrefs", android.content.Context.MODE_PRIVATE) }
    val hasAgreedPrivacy = remember { prefs.getBoolean("agreementAccepted", false) }
    var showPrivacyDialog by remember { mutableStateOf(!hasAgreedPrivacy) }

    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val profileViewModel = remember {
        ProfileViewModel(context.applicationContext as android.app.Application)
    }

    val showBottomBar = currentRoute == "home" || currentRoute == "aichat" || currentRoute == "profile"
    val startDestination = "home"

    var pendingInviteCode by remember { mutableStateOf<String?>(null) }

    val newIntentTrigger = remember {
        (context as? MainActivity)?.newIntentTrigger ?: mutableStateOf(0)
    }

    LaunchedEffect(newIntentTrigger.value) {
        val activity = context as? ComponentActivity
        activity?.intent?.let { intent ->
            val inviteCode = extractInviteCode(intent)
            if (inviteCode != null) {
                pendingInviteCode = inviteCode
                navController.navigate("smsRegister")
            }
        }
    }

    LaunchedEffect(profileViewModel) {
        RetrofitClient.setUnauthorizedCallback { profileViewModel.logout() }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            bottomBar = {
                if (showBottomBar) {
                    val uiState by profileViewModel.uiState.collectAsStateWithLifecycle()
                    BottomNavigationBar(
                        navController = navController,
                        showProfileBadge = uiState.isLoggedIn && uiState.unreadMessageCount > 0,
                        unreadMessageCount = uiState.unreadMessageCount
                    )
                }
            }
        ) { innerPadding ->
            NavHost(
                navController = navController,
                startDestination = startDestination,
                modifier = Modifier.fillMaxSize()
            ) {
                composable(
                    route = "home",
                    arguments = emptyList(),
                    enterTransition = null,
                    exitTransition = null,
                    popEnterTransition = null,
                    popExitTransition = null
                ) {
                    HomePageWithPrivacyCheck(
                        navController = navController,
                        paddingValues = innerPadding,
                        onAgreePrivacy = {
                            prefs.edit().putBoolean("agreementAccepted", true).apply()
                        }
                    )
                }
                composable(
                    route = "search",
                    arguments = emptyList(),
                    enterTransition = null,
                    exitTransition = null,
                    popEnterTransition = null,
                    popExitTransition = null
                ) {
                    SearchPage(
                        navController = navController,
                        paddingValues = innerPadding
                    )
                }
                composable("detail/{infoId}") { backStackEntry ->
                    val idArg = backStackEntry.arguments?.getString("infoId")
                    val infoId = idArg?.toIntOrNull()
                    InfoDetailPage(navController = navController, infoId = infoId)
                }
                composable("profile") {
                    ProfilePage(
                        paddingValues = innerPadding,
                        navController = navController,
                        viewModel = profileViewModel
                    )
                }
                composable("emailAuth") {
                    EmailAuthPage(
                        navController = navController,
                        onLoginSuccess = {
                            profileViewModel.checkLoginStatus()
                            navController.popBackStack("profile", inclusive = false)
                        }
                    )
                }
                composable("passwordLogin") {
                    PasswordLoginPage(
                        navController = navController,
                        profileViewModel = profileViewModel,
                        onLoginSuccess = {
                            Log.d("MainActivity", "登录成功，准备返回")
                            profileViewModel.checkLoginStatus()
                            // 检查是否从壹问页面跳转过来
                            val previousRoute = navController.previousBackStackEntry?.destination?.route
                            Log.d("MainActivity", "前一个页面路由: $previousRoute")
                            if (previousRoute == "aichat") {
                                // 直接返回壹问页面，让壹问页面自己刷新状态
                                navController.popBackStack()
                            } else {
                                navController.popBackStack("profile", inclusive = false)
                            }
                        }
                    )
                }
                composable("smsLogin") {
                    SmsRegisterPage(
                        navController = navController,
                        onLoginSuccess = {
                            Log.d("MainActivity", "注册成功，准备返回")
                            profileViewModel.checkLoginStatus()
                            // 检查是否从壹问页面跳转过来
                            val previousRoute = navController.previousBackStackEntry?.destination?.route
                            Log.d("MainActivity", "前一个页面路由: $previousRoute")
                            if (previousRoute == "aichat") {
                                // 直接返回壹问页面，让壹问页面自己刷新状态
                                navController.popBackStack()
                            } else {
                                navController.popBackStack("profile", inclusive = false)
                            }
                        }
                    )
                }
                composable("smsRegister") {
                    SmsRegisterPage(
                        navController = navController,
                        initialInviteCode = pendingInviteCode,
                        onLoginSuccess = {
                            Log.d("MainActivity", "注册成功，准备返回")
                            profileViewModel.checkLoginStatus()
                            pendingInviteCode = null
                            val previousRoute = navController.previousBackStackEntry?.destination?.route
                            Log.d("MainActivity", "前一个页面路由: $previousRoute")
                            if (previousRoute == "aichat") {
                                navController.popBackStack()
                            } else {
                                navController.popBackStack("profile", inclusive = false)
                            }
                        }
                    )
                }
                composable("forgotPassword") {
                    ForgotPasswordPage(
                        navController = navController,
                        onResetSuccess = {
                            navController.popBackStack()
                        }
                    )
                }
                composable("changePassword") {
                    ChangePasswordPage(
                        navController = navController,
                        profileViewModel = profileViewModel
                    )
                }
                composable("personalInfo") {
                    PersonalInfoPage(
                        navController = navController,
                        viewModel = profileViewModel,
                        onLogout = { profileViewModel.logout() }
                    )
                }
                composable("favorites") {
                    FavoritesPage(navController = navController)
                }
                composable("settings") {
                    SettingsPage(
                        navController = navController,
                        isLoggedIn = profileViewModel.uiState.value.isLoggedIn,
                        onLogout = { profileViewModel.logout() }
                    )
                }
                composable("about") {
                    AboutPage(navController = navController)
                }
                composable("helpFeedback") {
                    HelpFeedbackPage(navController = navController)
                }
                composable("versionInfo") {
                    VersionInfoPage(navController = navController)
                }
                composable("messages/{userId}") { backStackEntry ->
                    val userIdStr = backStackEntry.arguments?.getString("userId")
                    val userId = userIdStr?.toIntOrNull() ?: 0
                    if (userId > 0) {
                        MessagesPage(
                            navController = navController,
                            userId = userId,
                            profileViewModel = profileViewModel
                        )
                    }
                }
                composable("submit") {
                    SubmitPage(navController = navController)
                }
                composable("mySubmissions") {
                    MySubmissionsPage(navController = navController)
                }
                composable("aichat") {
                    AIChatPage(
                        navController = navController,
                        paddingValues = innerPadding,
                        profileViewModel = profileViewModel
                    )
                }
                composable("aiSettings") {
                    AIChatSettingsPage(navController = navController)
                }
                composable("aiModelBind") {
                    AIModelBindPage(navController = navController)
                }
                composable("lottery") {
                    LotteryPage(navController = navController)
                }
                // 隐私政策和用户协议统一使用 AgreementDetailPage
                composable("agreementDetail/{type}") { backStackEntry ->
                    val type = backStackEntry.arguments?.getString("type") ?: "agreement"
                    AgreementDetailPage(navController = navController, type = type)
                }
            }
        }
    }
}

@Composable
fun BottomNavigationBar(
    navController: NavHostController,
    showProfileBadge: Boolean = false,
    unreadMessageCount: Int = 0
) {
    val items = listOf("home", "aichat", "profile")
    val iconSelectedMap = mapOf(
        "home" to R.drawable.ic_tab_home_selected,
        "aichat" to R.drawable.ic_tab_aichat_selected,
        "profile" to R.drawable.ic_tab_profile_selected
    )
    val iconUnselectedMap = mapOf(
        "home" to R.drawable.ic_tab_home_unselected,
        "aichat" to R.drawable.ic_tab_aichat_unselected,
        "profile" to R.drawable.ic_tab_profile_unselected
    )
    val labels = mapOf(
        "home" to "首页",
        "aichat" to "壹问",
        "profile" to "我的"
    )
    val badgeCounts = mapOf(
        "home" to 0,
        "aichat" to 0,
        "profile" to if (showProfileBadge) unreadMessageCount else 0
    )
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF8F8F8))
    ) {
        // Top divider line
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(Color(0xFFE5E5E5))
        )
        
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            items.forEach { route ->
                val isSelected = currentRoute == route
                val badgeCount = badgeCounts[route] ?: 0
                val showBadge = badgeCount > 0
                val iconRes = if (isSelected) iconSelectedMap[route] ?: R.drawable.ic_tab_home_selected else iconUnselectedMap[route] ?: R.drawable.ic_tab_home_unselected
                val label = labels[route] ?: ""

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(60.dp)
                        .clickable {
                            navController.navigate(route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .offset(y = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                painter = painterResource(id = iconRes),
                                contentDescription = label,
                                modifier = Modifier.size(24.dp),
                                tint = Color.Unspecified
                            )
                            if (showBadge) {
                                Surface(
                                    color = Color(0xFFE53935),
                                    shape = CircleShape,
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .offset(x = 4.dp, y = (-4).dp)
                                        .size(if (badgeCount > 99) 14.dp else 12.dp)
                                ) {
                                    Box(
                                        modifier = Modifier.fillMaxSize(),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = if (badgeCount > 99) "99+" else "$badgeCount",
                                            fontSize = 7.sp,
                                            lineHeight = 7.sp,
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = label,
                            color = if (isSelected) Color(0xFF6B4DFF) else Color(0xFF999999),
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal
                        )
                    }
                }
            }
        }
        
        // System navigation bar spacer - 延伸到屏幕最底部
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
        )
    }
}

/**
 * 首次启动用户协议与隐私政策同意弹窗
 * 国内应用商店强制要求：首次打开App必须弹出隐私政策，用户拒绝则不得收集任何信息
 */
@Composable
fun PrivacyAgreementDialog(
    onAgree: () -> Unit,
    onDisagree: () -> Unit,
    onViewAgreement: () -> Unit,
    onViewPrivacy: () -> Unit
) {
    val primaryColor = Color(0xFF1A73E8)

    AlertDialog(
        onDismissRequest = { },
        shape = RoundedCornerShape(12.dp),
        containerColor = Color.White,
        title = {
            Text(
                text = "欢迎使用 有指南",
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                color = Color(0xFF1A1A1A),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth()
            ) {
                val annotatedString = androidx.compose.ui.text.buildAnnotatedString {
                    append("本个人信息保护指引将通过《")
                    pushStringAnnotation(tag = "agreement", annotation = "agreement")
                    withStyle(style = androidx.compose.ui.text.SpanStyle(color = primaryColor)) {
                        append("用户协议")
                    }
                    pop()
                    append("》与《")
                    pushStringAnnotation(tag = "privacy", annotation = "privacy")
                    withStyle(style = androidx.compose.ui.text.SpanStyle(color = primaryColor)) {
                        append("隐私政策")
                    }
                    pop()
                    append("》帮助你了解我们如何收集、处理个人信息。\n\n")
                    append("1. 我们可能会申请系统设备权限收集设备信息、日志信息，用于推送和安全")
                }

                androidx.compose.foundation.text.ClickableText(
                    text = annotatedString,
                    onClick = { offset ->
                        annotatedString.getStringAnnotations(tag = "agreement", start = offset, end = offset)
                            .firstOrNull()?.let {
                                onViewAgreement()
                            }
                        annotatedString.getStringAnnotations(tag = "privacy", start = offset, end = offset)
                            .firstOrNull()?.let {
                                onViewPrivacy()
                            }
                    },
                    style = androidx.compose.ui.text.TextStyle(
                        fontSize = 15.sp,
                        lineHeight = 22.sp,
                        color = Color(0xFF333333)
                    )
                )
            }
        },
        confirmButton = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                TextButton(
                    onClick = onDisagree,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "不同意",
                        fontSize = 16.sp,
                        color = Color(0xFF666666),
                        fontWeight = FontWeight.Medium
                    )
                }
                androidx.compose.material3.HorizontalDivider(
                    modifier = Modifier
                        .width(1.dp)
                        .height(48.dp),
                    color = Color(0xFFE0E0E0)
                )
                TextButton(
                    onClick = onAgree,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "同意",
                        fontSize = 16.sp,
                        color = primaryColor,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    )
}

/**
 * 协议详情页面（从后端获取内容展示）
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun AgreementDetailPage(
    navController: NavHostController,
    type: String // "agreement" 或 "privacy"
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var content by remember { mutableStateOf<AgreementContent?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var retryKey by remember { mutableStateOf(0) }

    val primaryColor = Color(0xFF1A73E8)

    // 加载协议内容的函数
    fun loadAgreement() {
        isLoading = true
        errorMsg = null
        content = null
        scope.launch {
            try {
                val TAG = "AgreementDetailPage"
                val apiService = RetrofitClient.getApiService()
                val fullUrl = "${ApiConfig.BASE_URL}api/app/${type}"
                android.util.Log.d(TAG, "【协议加载】请求协议类型：$type")
                android.util.Log.d(TAG, "【协议加载】完整 URL：$fullUrl")
                
                val response = if (type == "agreement") {
                    android.util.Log.d(TAG, "【协议加载】调用 getAgreement()")
                    apiService.getAgreement()
                } else {
                    android.util.Log.d(TAG, "【协议加载】调用 getPrivacy()")
                    apiService.getPrivacy()
                }
                
                android.util.Log.d(TAG, "【协议加载】响应码：${response.code()}, 响应消息：${response.message()}")
                
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    android.util.Log.d(TAG, "【协议加载】API 响应完整内容：$body")
                    android.util.Log.d(TAG, "【协议加载】API 响应 code: ${body.code}")
                    android.util.Log.d(TAG, "【协议加载】API 响应 message: ${body.message}")
                    android.util.Log.d(TAG, "【协议加载】API 响应 data: ${body.data}")
                    
                    if ((body.code == 0 || body.code == 200) && body.data != null) {
                        content = body.data
                        android.util.Log.d(TAG, "【协议加载】✅ 协议加载成功！标题：${body.data.title}")
                        android.util.Log.d(TAG, "【协议加载】✅ 内容长度：${body.data.content?.length ?: 0} 字符")
                        android.util.Log.d(TAG, "【协议加载】✅ 内容预览：${body.data.content?.take(100) ?: "null"}")
                    } else {
                        errorMsg = "API 错误：${body.message ?: "未知错误"} (code=${body.code})"
                        android.util.Log.e(TAG, "【协议加载】❌ 协议加载失败：${errorMsg}")
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    errorMsg = "HTTP ${response.code()}：${response.message()}"
                    android.util.Log.e(TAG, "【协议加载】❌ 协议请求失败")
                    android.util.Log.e(TAG, "【协议加载】❌ 错误响应体：$errorBody")
                }
            } catch (e: Exception) {
                errorMsg = "网络异常：${e.message}"
                android.util.Log.e("AgreementDetailPage", "【协议加载】❌ 协议加载异常", e)
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(type, retryKey) {
        loadAgreement()
    }

    val displayTitle = content?.title ?: if (type == "agreement") "用户服务协议" else "隐私政策"
    val rawContent = content?.content
    val displayContent = if (rawContent.isNullOrEmpty()) {
        if (content != null) "暂无协议内容" else ""
    } else {
        rawContent.replace("\\n", "\n")
    }

    android.util.Log.d("AgreementDetailPage", "【渲染】displayTitle=$displayTitle, displayContent长度=${displayContent.length}, rawContent=${if (rawContent != null) "非null(${rawContent.length}字符)" else "null"}")

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(displayTitle) },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFF2D2D2D),
                    titleContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
        ) {
            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 80.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CircularProgressIndicator(color = primaryColor)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("正在加载协议内容...", fontSize = 14.sp, color = Color(0xFF999999))
                    }
                }
            } else {
                // 头部标题卡片
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xFFF5F8FF)
                    ),
                    border = BorderStroke(1.dp, Color(0xFFD0E1FF))
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp)
                    ) {
                        Text(
                            text = displayTitle,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF1A1A1A)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "最新版本",
                            fontSize = 12.sp,
                            color = Color(0xFF999999)
                        )
                    }
                }
                
                // 协议正文
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .padding(bottom = 16.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = Color.White
                    ),
                    elevation = CardDefaults.cardElevation(
                        defaultElevation = 2.dp
                    )
                ) {
                    Text(
                        text = displayContent,
                        fontSize = 14.sp,
                        lineHeight = 24.sp,
                        color = Color(0xFF333333),
                        modifier = Modifier.padding(20.dp)
                    )
                }
                
                // 如果加载失败，显示错误信息和重试按钮
                if (errorMsg != null && content == null) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = Color(0xFFFFF0F0)
                        ),
                        border = BorderStroke(1.dp, Color(0xFFFFD0D0))
                    ) {
                        Column(modifier = Modifier.padding(20.dp)) {
                            Text(
                                text = "加载失败",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFCC3333)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = errorMsg ?: "",
                                fontSize = 13.sp,
                                color = Color(0xFFCC3333)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "可能原因：网络连接问题 / 服务器异常",
                                fontSize = 12.sp,
                                color = Color(0xFF999999)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = { retryKey++ },
                                enabled = !isLoading,
                                modifier = Modifier.fillMaxWidth().height(44.dp),
                                shape = RoundedCornerShape(22.dp),
                                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                    containerColor = primaryColor
                                )
                            ) {
                                Text("重新加载", color = Color.White, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

/**
 * 带隐私政策检查的首页包装器
 * 首次启动时弹出隐私政策对话框
 */
@Composable
fun HomePageWithPrivacyCheck(
    navController: NavHostController,
    paddingValues: PaddingValues,
    onAgreePrivacy: () -> Unit
) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("AppPrefs", android.content.Context.MODE_PRIVATE) }
    val hasAgreedPrivacy = remember { prefs.getBoolean("agreementAccepted", false) }
    var showPrivacyDialog by remember { mutableStateOf(!hasAgreedPrivacy) }
    
    // 首次启动隐私政策同意弹窗
    if (showPrivacyDialog) {
        PrivacyAgreementDialog(
            onAgree = {
                onAgreePrivacy()
                showPrivacyDialog = false
            },
            onDisagree = {
                (context as? ComponentActivity)?.finish()
            },
            onViewAgreement = {
                navController.navigate("agreementDetail/agreement")
            },
            onViewPrivacy = {
                navController.navigate("agreementDetail/privacy")
            }
        )
    }
    
    // 延迟加载真正的 HomePage，等待对话框关闭
    if (!showPrivacyDialog) {
        HomePage(
            navController = navController,
            paddingValues = paddingValues
        )
    }
}

