package com.example.youzhinan.ui.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController

/**
 * 应用设置页面
 * 包含：使用说明、用户须知、更换登录密码
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsPage(
    navController: NavHostController,
    isLoggedIn: Boolean,
    onLogout: () -> Unit
) {
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("应用设置", fontSize = 18.sp)
                        Text(
                            text = "设置",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                },
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
                .background(Color(0xFFF5F5F5))
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            SettingsMenuItem(
                icon = Icons.Default.Description,
                title = "使用说明",
                subtitle = "查看应用使用指南",
                onClick = { navController.navigate("about") }
            )

            Spacer(modifier = Modifier.height(8.dp))

            SettingsMenuItem(
                icon = Icons.Default.VerifiedUser,
                title = "用户须知",
                subtitle = "查看用户协议与须知",
                onClick = { navController.navigate("about") }
            )

            Spacer(modifier = Modifier.height(8.dp))

            SettingsMenuItem(
                icon = Icons.Default.Info,
                title = "版本信息",
                subtitle = "版本与备案信息公示",
                onClick = { navController.navigate("versionInfo") }
            )

            if (isLoggedIn) {
                Spacer(modifier = Modifier.height(8.dp))
                SettingsMenuItem(
                    icon = Icons.Default.Lock,
                    title = "更换登录密码",
                    subtitle = "修改账号密码",
                    onClick = { navController.navigate("changePassword") }
                )
            }
        }
    }
}

@Composable
private fun SettingsMenuItem(
    icon: ImageVector,
    title: String,
    subtitle: String?,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = Color(0xFF1A1A1A),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Text(
                        text = title,
                        style = MaterialTheme.typography.bodyLarge,
                        color = Color(0xFF333333),
                        modifier = Modifier.weight(1f)
                    )
                }
                if (subtitle != null) {
                    Spacer(modifier = Modifier.height(4.dp))
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
