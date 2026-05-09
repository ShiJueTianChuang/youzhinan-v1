package com.example.youzhinan.ui.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.VpnKey
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AIChatSettingsPage(
    navController: androidx.navigation.NavHostController,
    viewModel: AIChatViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.loadBindingStatus()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF5F5F5))
    ) {
        // 顶部区域：渐变背景 + 标题
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(Color(0xFF7C4DFF), Color(0xFF536DFE))
                    )
                )
                .statusBarsPadding()
                .padding(horizontal = 20.dp, vertical = 18.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "AI切换",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(top = 8.dp)
        ) {
            Spacer(modifier = Modifier.height(8.dp))
            
            // ============ 推荐方案：助理壹问 ============
            val isPlatformMode = !uiState.useCustomModel
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { viewModel.toggleUseCustomModel(context, false) },
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(
                    defaultElevation = if (isPlatformMode) 6.dp else 2.dp
                ),
                border = if (isPlatformMode) {
                    androidx.compose.foundation.BorderStroke(2.5.dp, Color(0xFF7C4DFF))
                } else null
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(
                                    if (isPlatformMode) {
                                        Brush.linearGradient(
                                            colors = listOf(Color(0xFF7C4DFF), Color(0xFF536DFE))
                                        )
                                    } else {
                                        Brush.linearGradient(
                                            colors = listOf(Color(0xFFF0F0F0), Color(0xFFE8E8E8))
                                        )
                                    }
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Cloud,
                                contentDescription = null,
                                tint = if (isPlatformMode) Color.White else Color(0xFF999999),
                                modifier = Modifier.size(28.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "助理壹问",
                                    fontSize = 19.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isPlatformMode) Color(0xFF1A1A2E) else Color(0xFF888888)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                if (isPlatformMode) {
                                    Surface(
                                        color = Color(0xFFE8F5E9),
                                        shape = RoundedCornerShape(8.dp)
                                    ) {
                                        Text(
                                            text = "使用中",
                                            fontSize = 11.sp,
                                            color = Color(0xFF2E7D32),
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "平台提供的智能助理，免费开箱即用",
                                fontSize = 14.sp,
                                color = if (isPlatformMode) Color(0xFF555555) else Color(0xFFAAAAAA),
                                lineHeight = 20.sp
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            color = if (isPlatformMode) Color(0xFFF3EEFF) else Color(0xFFF5F5F5),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(text = "✨", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "免费使用",
                                    fontSize = 12.sp,
                                    color = if (isPlatformMode) Color(0xFF7C4DFF) else Color(0xFF999999),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                        Surface(
                            color = if (isPlatformMode) Color(0xFFF3EEFF) else Color(0xFFF5F5F5),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(text = "🚀", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "响应快速",
                                    fontSize = 12.sp,
                                    color = if (isPlatformMode) Color(0xFF7C4DFF) else Color(0xFF999999),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // ============ 高级方案：我的 AI ============
            val isCustomMode = uiState.useCustomModel
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        if (uiState.isBound) {
                            viewModel.toggleUseCustomModel(context, true)
                        } else {
                            navController.navigate("aiModelBind")
                        }
                    },
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(
                    defaultElevation = if (isCustomMode) 6.dp else 2.dp
                ),
                border = if (isCustomMode) {
                    androidx.compose.foundation.BorderStroke(2.5.dp, Color(0xFF7C4DFF))
                } else if (uiState.isBound) {
                    androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFF7C4DFF).copy(alpha = 0.6f))
                } else {
                    androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFF7C4DFF).copy(alpha = 0.3f))
                }
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(
                                    if (isCustomMode) {
                                        Brush.linearGradient(
                                            colors = listOf(Color(0xFF7C4DFF), Color(0xFF536DFE))
                                        )
                                    } else if (uiState.isBound) {
                                        Brush.linearGradient(
                                            colors = listOf(Color(0xFF7C4DFF).copy(alpha = 0.7f), Color(0xFF536DFE).copy(alpha = 0.7f))
                                        )
                                    } else {
                                        Brush.linearGradient(
                                            colors = listOf(Color(0xFF7C4DFF).copy(alpha = 0.5f), Color(0xFF536DFE).copy(alpha = 0.5f))
                                        )
                                    }
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.VpnKey,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(28.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "我的 AI",
                                    fontSize = 19.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isCustomMode) Color(0xFF1A1A2E) else Color(0xFF333333)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                when {
                                    isCustomMode -> {
                                        Surface(
                                            color = Color(0xFFE8F5E9),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text(
                                                text = "使用中",
                                                fontSize = 11.sp,
                                                color = Color(0xFF2E7D32),
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                            )
                                        }
                                    }
                                    uiState.isBound -> {
                                        Surface(
                                            color = Color(0xFFF3EEFF),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text(
                                                text = "已绑定",
                                                fontSize = 11.sp,
                                                color = Color(0xFF7C4DFF),
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                            )
                                        }
                                    }
                                    else -> {
                                        Surface(
                                            color = Color(0xFFF3EEFF),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text(
                                                text = "去绑定",
                                                fontSize = 11.sp,
                                                color = Color(0xFF7C4DFF),
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = if (uiState.isBound) {
                                    val modelInfo = uiState.customModelName
                                    if (modelInfo.isNotEmpty()) "已绑定: $modelInfo" else "已绑定自定义模型"
                                } else {
                                    "绑定您的 API Key，使用专属 AI 模型"
                                },
                                fontSize = 14.sp,
                                color = Color(0xFF555555),
                                lineHeight = 20.sp
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            color = Color(0xFFF3EEFF),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(text = "🔧", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "自定义",
                                    fontSize = 12.sp,
                                    color = Color(0xFF7C4DFF),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                        Surface(
                            color = Color(0xFFF3EEFF),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(text = "💪", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "更强大",
                                    fontSize = 12.sp,
                                    color = Color(0xFF7C4DFF),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            }

            // ============ 管理入口 ============
            if (uiState.isBound) {
                Spacer(modifier = Modifier.height(14.dp))

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { navController.navigate("aiModelBind") },
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp, vertical = 15.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "管理我的 AI",
                            fontSize = 14.sp,
                            color = Color(0xFF7C4DFF),
                            fontWeight = FontWeight.Medium
                        )
                        Icon(
                            imageVector = Icons.Default.ChevronRight,
                            contentDescription = null,
                            tint = Color(0xFF7C4DFF).copy(alpha = 0.5f),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // ============ 底部说明 ============
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.White.copy(alpha = 0.7f),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(4.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF7C4DFF))
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "两种模式的区别",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF555555)
                        )
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Row {
                        Box(
                            modifier = Modifier
                                .padding(top = 6.dp, start = 4.dp, end = 10.dp)
                                .size(4.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFBBBBBB))
                        )
                        Text(
                            text = "助理壹问：平台提供壹问助理，免费、开箱即用，适合大多数用户",
                            fontSize = 12.sp,
                            color = Color(0xFF888888),
                            lineHeight = 18.sp
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Row {
                        Box(
                            modifier = Modifier
                                .padding(top = 6.dp, start = 4.dp, end = 10.dp)
                                .size(4.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFBBBBBB))
                        )
                        Text(
                            text = "我的 AI：使用您自己的 API Key 和 AI 模型，适合有专属需求的用户",
                            fontSize = 12.sp,
                            color = Color(0xFF888888),
                            lineHeight = 18.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}
