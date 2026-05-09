package com.example.youzhinan.ui.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.example.youzhinan.data.api.AboutSetting
import com.example.youzhinan.data.api.RetrofitClient

/**
 * 关于我们页面 - 显示使用说明和用户须知
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AboutPage(navController: NavHostController) {
    var usage by remember { mutableStateOf<AboutSetting?>(null) }
    var agreement by remember { mutableStateOf<AboutSetting?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try {
            val apiService = RetrofitClient.getApiService()
            val response = apiService.getAboutSettings()
            if (response.isSuccessful && response.body() != null) {
                response.body()!!.forEach { setting ->
                    when (setting.type) {
                        "usage" -> usage = setting
                        "agreement" -> agreement = setting
                    }
                }
            } else {
                error = "加载失败"
            }
        } catch (e: Exception) {
            error = e.message ?: "加载失败"
        }
        isLoading = false
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("关于我们")
                        Text(
                            text = "帮助与反馈",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFF2D2D2D),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
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
                        contentAlignment = androidx.compose.ui.Alignment.Center
                    ) {
                        CircularProgressIndicator(color = Color.Black)
                    }
                }
                error != null -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = androidx.compose.ui.Alignment.Center
                    ) {
                        Text(
                            text = error!!,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
                else -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp)
                    ) {
                        usage?.let { setting ->
                            AboutSection(
                                title = setting.title ?: "使用说明",
                                content = setting.content ?: "暂无内容"
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                        }
                        agreement?.let { setting ->
                            AboutSection(
                                title = setting.title ?: "用户须知",
                                content = setting.content ?: "暂无内容"
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                        }
                        
                        if (usage == null && agreement == null) {
                            Text(
                                text = "暂无内容",
                                color = Color.Gray,
                                modifier = Modifier.padding(32.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AboutSection(title: String, content: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                text = title,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF333333)
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = content,
                fontSize = 14.sp,
                color = Color(0xFF666666),
                lineHeight = 22.sp
            )
        }
    }
}
