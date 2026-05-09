package com.example.youzhinan.ui.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Headset
import androidx.compose.material.icons.filled.Mail
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.sp
import com.example.youzhinan.ui.components.NetworkImage
import com.example.youzhinan.ui.theme.AIPurple
import com.example.youzhinan.ui.theme.AIPurpleLight
import com.google.accompanist.systemuicontroller.rememberSystemUiController
import com.example.youzhinan.data.api.UserInfo

@Composable
fun ProfilePage(
    paddingValues: PaddingValues = PaddingValues(0.dp),
    navController: androidx.navigation.NavHostController? = null,
    viewModel: ProfileViewModel
) {
    val uiState by viewModel.uiState.collectAsState()
    val systemUiController = rememberSystemUiController()
    var showLoginTypeDialog by remember { mutableStateOf(false) }
    
    LaunchedEffect(Unit) {
        systemUiController.setStatusBarColor(
            color = AIPurpleLight,
            darkIcons = true
        )
    }
    LaunchedEffect(Unit) {
        if (uiState.isLoggedIn && uiState.userInfo != null) {
            viewModel.loadUnreadMessageCount(uiState.userInfo!!.id)
        }
    }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AIPurpleLight)
    ) {
        // 状态栏占位
        Spacer(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(
                    start = 16.dp,
                    end = 16.dp,
                    top = 8.dp,
                    bottom = 16.dp + paddingValues.calculateBottomPadding()
                )
        ) {
            ProfileHeaderCard(
                avatarUrl = uiState.userInfo?.avatarUrl,
                userInfo = uiState.userInfo,
                isLoggedIn = uiState.isLoggedIn,
                onAvatarClick = {
                    if (uiState.isLoggedIn) {
                        navController?.navigate("personalInfo")
                    }
                }
            )
            
            Spacer(modifier = Modifier.height(20.dp))
            
            if (uiState.isLoggedIn) {
                LoggedInMenu(
                    navController = navController,
                    userId = uiState.userInfo?.id,
                    unreadMessageCount = uiState.unreadMessageCount
                )
            } else {
                LoggedOutMenu(
                    navController = navController,
                    onLoginClick = { showLoginTypeDialog = true }
                )
            }
            
            Spacer(modifier = Modifier.height(20.dp))
        }
    }
    
    LoginTypeDialog(
        showDialog = showLoginTypeDialog,
        onDismiss = { showLoginTypeDialog = false },
        onPasswordLogin = {
            showLoginTypeDialog = false
            navController?.navigate("passwordLogin")
        },
        onEmailAuthLogin = {
            showLoginTypeDialog = false
            navController?.navigate("emailAuth")
        },
        onSmsLogin = {
            showLoginTypeDialog = false
            navController?.navigate("smsRegister")
        }
    )
}

@Composable
fun ProfileHeaderCard(
    avatarUrl: String?,
    userInfo: UserInfo?,
    isLoggedIn: Boolean,
    onAvatarClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(bottomStart = 24.dp, bottomEnd = 24.dp),
        colors = CardDefaults.cardColors(containerColor = AIPurpleLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                contentAlignment = Alignment.BottomEnd,
                modifier = Modifier.then(
                    if (isLoggedIn) Modifier.clickable { onAvatarClick() }
                    else Modifier
                )
            ) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(AIPurpleLight)
                        .border(
                            width = 2.dp,
                            color = AIPurple,
                            shape = CircleShape
                        )
                ) {
                    if (!avatarUrl.isNullOrBlank()) {
                        NetworkImage(
                            url = avatarUrl,
                            contentDescription = "用户头像",
                            modifier = Modifier.fillMaxSize().clip(CircleShape),
                            contentScale = ContentScale.Crop
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            modifier = Modifier
                                .size(36.dp)
                                .align(Alignment.Center),
                            tint = Color(0xFF666666)
                        )
                    }
                }
                if (isLoggedIn) {
                    Box(
                        modifier = Modifier
                            .offset(x = (-2).dp, y = (-2).dp)
                            .size(18.dp)
                            .background(AIPurple, CircleShape)
                        .border(2.dp, Color.White, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "✓",
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.width(20.dp))
            
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = if (isLoggedIn && userInfo != null) (userInfo.nickName ?: "").ifBlank { userInfo.username } else "游客",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.Black,
                    fontSize = 18.sp
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                if (isLoggedIn && userInfo != null) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = Color(0x22000000)
                        ) {
                            Text(
                                text = "账号",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF666666),
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = userInfo.username.ifBlank { "—" },
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF333333),
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = Color(0x33000000)
                        ) {
                            Text(
                                text = "已登录",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                color = Color(0xFF555555),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                    
                    if (userInfo.points > 0) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "积分 ${userInfo.points.toInt()}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF000000),
                            fontSize = 12.sp
                        )
                    }
                } else {
                    Text(
                        text = "登录后享受更多功能",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color(0xFF666666),
                        fontSize = 13.sp
                    )
                }
            }
        }
    }
}

@Composable
fun LoggedInMenu(
    navController: androidx.navigation.NavHostController?,
    userId: Int?,
    unreadMessageCount: Int = 0
) {
    ProfileMenuItemIcon(
        icon = Icons.Default.Person,
        title = "个人信息",
        onClick = { navController?.navigate("personalInfo") }
    )
    
    ProfileMenuItemIcon(
        icon = Icons.Default.Favorite,
        title = "我的收藏",
        onClick = { navController?.navigate("favorites") }
    )
    
    ProfileMenuItemIcon(
        icon = Icons.AutoMirrored.Filled.Send,
        title = "我的投稿",
        onClick = { navController?.navigate("mySubmissions") }
    )
    
    ProfileMenuItemIcon(
        icon = Icons.Default.Mail,
        title = "站内信",
        badgeCount = if (unreadMessageCount > 0) unreadMessageCount else null,
        onClick = {
            userId?.let { id ->
                // 通过 bundle 传递 userId，ProfileViewModel 会在 MessagesPage 中通过 sharedViewModel 获取
                navController?.navigate("messages/$id")
            }
        }
    )
    
    ProfileMenuItemIcon(
        icon = Icons.Default.Headset,
        title = "帮助与反馈",
        onClick = { navController?.navigate("helpFeedback") }
    )
    
    ProfileMenuItemIcon(
        icon = Icons.Default.Settings,
        title = "设置",
        onClick = { navController?.navigate("settings") }
    )
}

@Composable
fun LoggedOutMenu(
    navController: androidx.navigation.NavHostController?,
    onLoginClick: () -> Unit
) {
    // 未登录时不显示设置，只显示登录提示
    
    Spacer(modifier = Modifier.height(16.dp))
    
    Button(
        onClick = onLoginClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = AIPurple
        ),
        shape = RoundedCornerShape(26.dp)
    ) {
        Text(
            text = "立即登录 / 注册",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
    
    Spacer(modifier = Modifier.height(24.dp))
    
    Text(
        text = "登录后可使用更多功能",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
fun LoginTypeDialog(
    showDialog: Boolean,
    onDismiss: () -> Unit,
    onPasswordLogin: () -> Unit,
    onEmailAuthLogin: () -> Unit,
    onSmsLogin: () -> Unit
) {
    if (showDialog) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("选择登录方式") },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "• 密码登录 • 手机号注册 • 邮箱注册",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = onPasswordLogin,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = AIPurple),
                        shape = RoundedCornerShape(26.dp)
                    ) {
                        Text("密码登录", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = onSmsLogin,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AIPurple,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(26.dp)
                    ) {
                        Text("手机号注册", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = onEmailAuthLogin,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AIPurple,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(26.dp)
                    ) {
                        Text("邮箱注册", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            },
            confirmButton = {},
            dismissButton = null
        )
    }
}

@Composable
fun ProfileMenuItemIcon(
    icon: ImageVector,
    title: String,
    subtitle: String? = null,
    badgeCount: Int? = null,
    onClick: (() -> Unit)? = null
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .then(
                if (onClick != null) Modifier.clickable { onClick() }
                else Modifier
            ),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(contentAlignment = Alignment.TopEnd) {
                Icon(
                imageVector = icon,
                contentDescription = null,
                tint = AIPurple,
                modifier = Modifier.size(24.dp)
            )
                if (badgeCount != null && badgeCount > 0) {
                    Surface(
                        color = Color(0xFFE53935),
                        shape = CircleShape,
                        modifier = Modifier
                            .offset(x = 8.dp, y = (-4).dp)
                            .size(if (badgeCount > 99) 18.dp else 16.dp)
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (badgeCount > 99) "99+" else "$badgeCount",
                                color = Color.White,
                                fontSize = 10.sp,
                                lineHeight = 10.sp,
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color(0xFF2C2C2C)
                )
                if (subtitle != null) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}
