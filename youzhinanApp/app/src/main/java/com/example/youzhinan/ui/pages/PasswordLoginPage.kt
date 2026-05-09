package com.example.youzhinan.ui.pages

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons

import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.example.youzhinan.ui.pages.isAgreementAccepted
import com.example.youzhinan.PrivacyAgreementDialog

/**
 * 密码登录页面
 * 支持已注册用户使用邮箱 + 密码登录
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PasswordLoginPage(
    navController: NavHostController,
    profileViewModel: ProfileViewModel,
    onLoginSuccess: () -> Unit
) {
    val focusManager = LocalFocusManager.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    
    var account by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var passwordVisible by remember { mutableStateOf(false) }
    var agreementChecked by remember { mutableStateOf(false) }
    var showAgreementDialog by remember { mutableStateOf(!isAgreementAccepted(context)) }
    
    // 执行登录（账号支持手机号、邮箱、普通账号，由后端统一校验）
    val performLogin = remember(profileViewModel) {
        {
            if (account.isBlank() || password.isBlank()) {
                errorMessage = "请填写账号和密码"
                return@remember
            }
            
            if (!agreementChecked) {
                errorMessage = "请先阅读并同意用户协议和隐私政策"
                return@remember
            }
            
            isLoading = true
            errorMessage = null
            profileViewModel.passwordLogin(
                account = account,
                password = password,
                agreementAccepted = true,
                onSuccess = {
                    isLoading = false
                    scope.launch {
                        delay(500)
                        onLoginSuccess()
                    }
                },
                onError = { msg ->
                    // 后端返回400表示未同意协议
                    if (msg.contains("协议") || msg.contains("400")) {
                        agreementChecked = false
                    }
                    errorMessage = msg
                    isLoading = false
                }
            )
        }
    }
    
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("密码登录") },
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
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // 错误提示
            if (errorMessage != null) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Text(
                        text = errorMessage ?: "",
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
            
            // 说明文字
            Text(
                text = "使用账号、手机号或邮箱 + 密码登录",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 24.dp)
            )
            
            // 账号输入框（支持手机号、邮箱、普通账号）
            OutlinedTextField(
                value = account,
                onValueChange = { 
                    account = it
                    errorMessage = null
                },
                label = { Text("账号/手机号/邮箱") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Email,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Next
                ),
                enabled = !isLoading
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // 密码输入框
            OutlinedTextField(
                value = password,
                onValueChange = { 
                    password = it
                    errorMessage = null
                },
                label = { Text("密码") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                            contentDescription = if (passwordVisible) "隐藏密码" else "显示密码",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        focusManager.clearFocus()
                        if (account.isNotBlank() && password.isNotBlank()) {
                            performLogin()
                        }
                    }
                ),
                enabled = !isLoading
            )
            
            Spacer(modifier = Modifier.height(32.dp))
            
            // 协议勾选框
            AgreementCheckbox(
                agreed = agreementChecked,
                onAgreedChange = { agreementChecked = it },
                onViewAgreement = { navController.navigate("agreementDetail/agreement") },
                onViewPrivacy = { navController.navigate("agreementDetail/privacy") }
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // 登录按钮
            Button(
                onClick = { performLogin() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                enabled = !isLoading && account.isNotBlank() && password.isNotBlank(),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(26.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF2D2D2D),
                    contentColor = Color.White,
                    disabledContainerColor = Color.Gray,
                    disabledContentColor = Color.LightGray
                )
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Text("登录中...")
                } else {
                    Text("立即登录")
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // 忘记密码链接
                TextButton(
                    onClick = {
                        navController.navigate("forgotPassword")
                    },
                    enabled = !isLoading
                ) {
                    Text(
                        text = "忘记密码？",
                        color = Color(0xFF2D2D2D),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
                
                // 切换到验证码注册
                TextButton(
                    onClick = { navController.navigate("emailAuth") },
                    enabled = !isLoading
                ) {
                    Text(
                        text = "邮箱验证码注册",
                        color = Color(0xFF2D2D2D),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
            
            // 温馨提示
            Text(
                text = "温馨提示：忘记密码可通过邮箱或手机号验证码重置",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 20.sp
            )
        }
    }
    
    // 如果用户未同意协议，显示协议弹窗
    if (showAgreementDialog) {
        PrivacyAgreementDialog(
            onAgree = {
                agreementChecked = true
                showAgreementDialog = false
            },
            onDisagree = {
                navController.popBackStack()
            },
            onViewAgreement = {
                navController.navigate("agreementDetail/agreement")
            },
            onViewPrivacy = {
                navController.navigate("agreementDetail/privacy")
            }
        )
    }
}
