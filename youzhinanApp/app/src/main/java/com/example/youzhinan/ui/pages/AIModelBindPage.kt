package com.example.youzhinan.ui.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Info
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
fun AIModelBindPage(
    navController: androidx.navigation.NavHostController,
    viewModel: AIChatViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    
    var selectedProvider by remember { mutableStateOf("doubao") }
    var apiKeyInput by remember { mutableStateOf("") }
    var modelNameInput by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var showMessage by remember { mutableStateOf<String?>(null) }
    var isSuccess by remember { mutableStateOf(false) }
    
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
                text = "绑定 AI 模型",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
        
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // 绑定状态提示
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (uiState.isBound) Color(0xFFE8F5E9) else Color(0xFFF3EEFF)
                ),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = if (uiState.isBound) Icons.Default.CheckCircle else Icons.Default.Info,
                        contentDescription = null,
                        tint = if (uiState.isBound) Color(0xFF4CAF50) else Color(0xFF7C4DFF),
                        modifier = Modifier.size(28.dp)
                    )
                    Column {
                        Text(
                            text = if (uiState.isBound) "已绑定 AI 模型" else "未绑定 AI 模型",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (uiState.isBound) Color(0xFF2E7D32) else Color(0xFF7C4DFF)
                        )
                        Text(
                            text = if (uiState.isBound) "可以使用自定义 AI 模型进行聊天" else "绑定后可使用自己的 AI 模型",
                            fontSize = 13.sp,
                            color = Color(0xFF666666)
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // 选择服务商
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp)
                ) {
                    Text(
                        text = "选择 AI 服务商",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1A1A2E)
                    )
                    
                    Spacer(modifier = Modifier.height(20.dp))
                    
                    ProviderOption(
                        provider = "doubao",
                        name = "豆包（Doubao）",
                        description = "火山引擎豆包大模型",
                        selected = selectedProvider == "doubao",
                        onClick = { selectedProvider = "doubao" }
                    )
                    
                    Spacer(modifier = Modifier.height(14.dp))
                    
                    ProviderOption(
                        provider = "kimi",
                        name = "月之暗面（Kimi）",
                        description = "Moonshot AI 大模型",
                        selected = selectedProvider == "kimi",
                        onClick = { selectedProvider = "kimi" }
                    )
                    
                    Spacer(modifier = Modifier.height(14.dp))
                    
                    ProviderOption(
                        provider = "openai",
                        name = "OpenAI",
                        description = "GPT 系列模型",
                        selected = selectedProvider == "openai",
                        onClick = { selectedProvider = "openai" }
                    )
                    
                    Spacer(modifier = Modifier.height(14.dp))
                    
                    ProviderOption(
                        provider = "deepseek",
                        name = "深度求索（DeepSeek）",
                        description = "国产大模型",
                        selected = selectedProvider == "deepseek",
                        onClick = { selectedProvider = "deepseek" }
                    )
                    
                    Spacer(modifier = Modifier.height(14.dp))
                    
                    ProviderOption(
                        provider = "qwen",
                        name = "通义千问（Qwen）",
                        description = "阿里巴巴大模型",
                        selected = selectedProvider == "qwen",
                        onClick = { selectedProvider = "qwen" }
                    )
                    
                    Spacer(modifier = Modifier.height(14.dp))
                    
                    ProviderOption(
                        provider = "glm",
                        name = "智谱AI（GLM）",
                        description = "智谱大模型",
                        selected = selectedProvider == "glm",
                        onClick = { selectedProvider = "glm" }
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // API Key 输入
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp)
                ) {
                    Text(
                        text = "API Key",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1A1A2E)
                    )
                    
                    Spacer(modifier = Modifier.height(10.dp))
                    
                    Text(
                        text = "请输入您的 ${getProviderName(selectedProvider)} API Key",
                        fontSize = 13.sp,
                        color = Color(0xFF888888)
                    )
                    
                    Spacer(modifier = Modifier.height(14.dp))
                    
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFF8F8F8),
                        border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFE0E0E0))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.VpnKey,
                                contentDescription = null,
                                tint = Color(0xFF7C4DFF),
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(modifier = Modifier.width(14.dp))
                            BasicTextField(
                                value = apiKeyInput,
                                onValueChange = { apiKeyInput = it },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                textStyle = MaterialTheme.typography.bodyMedium.copy(
                                    fontSize = 15.sp,
                                    color = Color(0xFF1A1A2E)
                                ),
                                decorationBox = { innerTextField ->
                                    if (apiKeyInput.isBlank()) {
                                        Text(
                                            text = "请输入 API Key",
                                            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
                                            color = Color(0xFFAAAAAA)
                                        )
                                    }
                                    innerTextField()
                                }
                            )
                            if (apiKeyInput.isNotBlank()) {
                                IconButton(
                                    onClick = { apiKeyInput = "" },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "清空",
                                        tint = Color(0xFF999999),
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // 模型名称（可选）
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(20.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp)
                ) {
                    Text(
                        text = "模型名称（可选）",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1A1A2E)
                    )
                    
                    Spacer(modifier = Modifier.height(10.dp))
                    
                    Text(
                        text = "留空则使用默认模型，如需思考功能可填推理模型",
                        fontSize = 13.sp,
                        color = Color(0xFF888888)
                    )
                    
                    Spacer(modifier = Modifier.height(14.dp))
                    
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFF8F8F8),
                        border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFE0E0E0))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.AutoAwesome,
                                contentDescription = null,
                                tint = Color(0xFF7C4DFF),
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(modifier = Modifier.width(14.dp))
                            BasicTextField(
                                value = modelNameInput,
                                onValueChange = { modelNameInput = it },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                textStyle = MaterialTheme.typography.bodyMedium.copy(
                                    fontSize = 15.sp,
                                    color = Color(0xFF1A1A2E)
                                ),
                                decorationBox = { innerTextField ->
                                    if (modelNameInput.isBlank()) {
                                        Text(
                                            text = "默认: ${getDefaultModelName(selectedProvider)}",
                                            style = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
                                            color = Color(0xFFAAAAAA)
                                        )
                                    }
                                    innerTextField()
                                }
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { modelNameInput = getReasoningModelName(selectedProvider) }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "💡 推理模型（支持思考）: ",
                            fontSize = 12.sp,
                            color = Color(0xFF9D8CDB),
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = getReasoningModelName(selectedProvider),
                            fontSize = 12.sp,
                            color = Color(0xFF7C4DFF),
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = " 点击填入",
                            fontSize = 12.sp,
                            color = Color(0xFF9D8CDB)
                        )
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
            
            // 消息提示
            showMessage?.let { message ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isSuccess) Color(0xFFE8F5E9) else Color(0xFFFFEBEE)
                    ),
                    shape = RoundedCornerShape(12.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = if (isSuccess) Icons.Default.CheckCircle else Icons.Default.Error,
                            contentDescription = null,
                            tint = if (isSuccess) Color(0xFF4CAF50) else Color(0xFFF44336),
                            modifier = Modifier.size(22.dp)
                        )
                        Text(
                            text = message,
                            fontSize = 14.sp,
                            color = if (isSuccess) Color(0xFF2E7D32) else Color(0xFFC62828)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }
            
            // 操作按钮
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                if (uiState.isBound) {
                    OutlinedButton(
                        onClick = {
                            isLoading = true
                            viewModel.unbindAiModel(
                                onSuccess = {
                                    isLoading = false
                                    isSuccess = true
                                    showMessage = "解绑成功"
                                    apiKeyInput = ""
                                    modelNameInput = ""
                                },
                                onError = { error ->
                                    isLoading = false
                                    isSuccess = false
                                    showMessage = error
                                }
                            )
                        },
                        modifier = Modifier.weight(1f),
                        enabled = !isLoading,
                        border = androidx.compose.foundation.BorderStroke(2.dp, Color(0xFF7C4DFF)),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = Color(0xFF7C4DFF)
                        )
                    ) {
                        Text(
                            text = if (isLoading) "解绑中..." else "解绑",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
                
                Button(
                    onClick = {
                        if (apiKeyInput.isBlank()) {
                            showMessage = "请输入 API Key"
                            isSuccess = false
                            return@Button
                        }
                        isLoading = true
                        viewModel.bindAiModel(
                            provider = selectedProvider,
                            apiKey = apiKeyInput,
                            modelName = modelNameInput.ifBlank { null },
                            onSuccess = {
                                isLoading = false
                                isSuccess = true
                                showMessage = "绑定成功"
                            },
                            onError = { error ->
                                isLoading = false
                                isSuccess = false
                                showMessage = error
                            }
                        )
                    },
                    modifier = Modifier.weight(1f),
                    enabled = !isLoading && apiKeyInput.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (!isLoading && apiKeyInput.isNotBlank()) {
                            Color(0xFF7C4DFF)
                        } else {
                            Color(0xFFCCCCCC)
                        }
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = if (isLoading) "绑定中..." else if (uiState.isBound) "更新" else "绑定",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // 使用说明
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF8F8F8)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp)
                ) {
                    Text(
                        text = "💡 使用说明",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1A1A2E)
                    )
                    
                    Spacer(modifier = Modifier.height(14.dp))
                    
                    Text(
                        text = "1. 选择您要使用的 AI 服务商\n2. 输入对应的 API Key\n3. 可选填写自定义模型名称\n4. 点击绑定即可使用",
                        fontSize = 14.sp,
                        color = Color(0xFF666666),
                        lineHeight = 22.sp
                    )
                    
                    Spacer(modifier = Modifier.height(14.dp))
                    
                    Text(
                        text = "⚠️ 注意：请确保您的 API Key 有效且有足够的额度",
                        fontSize = 13.sp,
                        color = Color(0xFF7C4DFF),
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

@Composable
fun ProviderOption(
    provider: String,
    name: String,
    description: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .background(
                color = if (selected) Color(0xFFF3EEFF) else Color.Transparent,
                shape = RoundedCornerShape(12.dp)
            )
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) Color(0xFF7C4DFF) else Color(0xFFE0E0E0),
                shape = RoundedCornerShape(12.dp)
            )
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(
            selected = selected,
            onClick = { onClick() },
            colors = RadioButtonDefaults.colors(
                selectedColor = Color(0xFF7C4DFF),
                unselectedColor = Color(0xFFCCCCCC)
            )
        )
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = name,
                fontSize = 15.sp,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                color = if (selected) Color(0xFF7C4DFF) else Color(0xFF1A1A2E)
            )
            Text(
                text = description,
                fontSize = 12.sp,
                color = Color(0xFF888888)
            )
        }
    }
}

fun getProviderName(provider: String): String {
    return when (provider) {
        "doubao" -> "豆包"
        "kimi" -> "月之暗面"
        "openai" -> "OpenAI"
        "deepseek" -> "深度求索"
        "qwen" -> "通义千问"
        "glm" -> "智谱AI"
        else -> provider
    }
}

fun getDefaultModelName(provider: String): String {
    return when (provider) {
        "doubao" -> "doubao-seed-2-0-lite-260215"
        "kimi" -> "moonshot-v1-8k"
        "openai" -> "gpt-3.5-turbo"
        "deepseek" -> "deepseek-chat"
        "qwen" -> "qwen-turbo"
        "glm" -> "glm-4-flash"
        else -> ""
    }
}

fun getReasoningModelName(provider: String): String {
    return when (provider) {
        "doubao" -> "deepseek-r1-250120"
        "kimi" -> "moonshot-v1-8k"
        "openai" -> "o3-mini"
        "deepseek" -> "deepseek-reasoner"
        "qwen" -> "qwq-32b"
        "glm" -> "glm-4-flash"
        else -> ""
    }
}
