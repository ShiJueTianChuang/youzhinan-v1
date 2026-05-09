package com.example.youzhinan.ui.pages

import android.content.Context
import android.util.Log
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Verified
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.example.youzhinan.data.api.*
import com.example.youzhinan.utils.ApiErrorUtil
import com.example.youzhinan.utils.PasswordValidator
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.example.youzhinan.ui.pages.isAgreementAccepted
import com.example.youzhinan.PrivacyAgreementDialog

/**
 * 验证码注册页面
 * 适用于新用户：手机号/邮箱 + 验证码 + 设置密码 完成注册并登录
 * 已注册用户请使用「密码登录」
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmailAuthPage(
    navController: NavHostController,
    onLoginSuccess: () -> Unit
) {
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current
    val scope = rememberCoroutineScope()

    var authMode by remember { mutableStateOf("phone") } // "phone" 或 "email"
    var accountInput by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }
    var agreementChecked by remember { mutableStateOf(false) }
    var showAgreementDialog by remember { mutableStateOf(!isAgreementAccepted(context)) }
    
    // 倒计时相关
    var countdown by remember { mutableStateOf(0) }
    val isCountingDown = countdown > 0
    
    // 监听倒计时
    LaunchedEffect(countdown) {
        if (countdown > 0) {
            delay(1000L)
            countdown--
        }
    }
    
    // 验证邮箱格式
    fun isValidEmail(email: String): Boolean {
        return android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()
    }

    // 验证手机号格式
    fun isValidPhone(phone: String): Boolean {
        return phone.matches("^1[3-9]\\d{9}$".toRegex())
    }

    // 发送验证码 - 使用 remember 避免无限重组
    val sendVerificationCode = remember {
        {
            val trimmedInput = accountInput.trim()
            if (trimmedInput.isBlank()) {
                errorMessage = if (authMode == "email") "请输入邮箱地址" else "请输入手机号"
                return@remember
            }

            if (authMode == "email") {
                if (!isValidEmail(trimmedInput)) {
                    errorMessage = "请输入有效的邮箱地址"
                    return@remember
                }
            } else {
                if (!isValidPhone(trimmedInput)) {
                    errorMessage = "请输入有效的手机号（11位数字，以1开头）"
                    return@remember
                }
            }

            if (trimmedInput != accountInput) accountInput = trimmedInput

            isLoading = true
            scope.launch {
                try {
                    val TAG = "EmailAuthPage"
                    val apiService = RetrofitClient.getApiService()

                    if (authMode == "email") {
                        val request = VerificationCodeRequest(accountInput, "register")
                        Log.d(TAG, "发送邮箱验证码请求...")
                        Log.d(TAG, "Base URL: ${com.example.youzhinan.data.api.ApiConfig.BASE_URL}")
                        val response = apiService.sendVerificationCode(request)
                        Log.d(TAG, "响应码：${response.code()}")
                        Log.d(TAG, "响应消息：${response.message()}")

                        if (response.isSuccessful) {
                            countdown = 300
                            successMessage = "验证码已发送到您的邮箱，5 分钟内有效"
                            errorMessage = null
                            Log.d(TAG, "邮箱验证码发送成功")
                        } else {
                            errorMessage = ApiErrorUtil.fromResponse(response, "发送失败，请重试")
                            Log.e(TAG, "发送失败: $errorMessage")
                        }
                    } else {
                        val request = SmsCodeRequest(accountInput, "register")
                        Log.d(TAG, "发送手机验证码请求...")
                        Log.d(TAG, "Base URL: ${com.example.youzhinan.data.api.ApiConfig.BASE_URL}")
                        val response = apiService.sendSmsCode(request)
                        Log.d(TAG, "响应码：${response.code()}")
                        Log.d(TAG, "响应消息：${response.message()}")

                        if (response.isSuccessful) {
                            countdown = 300
                            successMessage = "验证码已发送到您的手机，5 分钟内有效"
                            errorMessage = null
                            Log.d(TAG, "手机验证码发送成功")
                        } else {
                            errorMessage = ApiErrorUtil.fromResponse(response, "发送失败，请重试")
                            Log.e(TAG, "发送失败: $errorMessage")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("EmailAuthPage", "发送验证码异常", e)
                    errorMessage = ApiErrorUtil.fromException(e, "发送失败，请检查网络后重试")
                } finally {
                    isLoading = false
                }
            }
        }
    }
    
    // 执行登录/注册 - 使用 remember 避免无限重组
    val performEmailAuth = remember {
        {
            val trimmedInput = accountInput.trim()
            if (trimmedInput.isBlank() || code.isBlank()) {
                errorMessage = if (authMode == "email") "请填写邮箱和验证码" else "请填写手机号和验证码"
                return@remember
            }

            if (code.length < 4) {
                errorMessage = "验证码长度不正确"
                return@remember
            }

            if (password.isBlank()) {
                errorMessage = "请设置密码"
                return@remember
            }

            if (!PasswordValidator.isValid(password)) {
                errorMessage = PasswordValidator.getTip(password)
                return@remember
            }

            if (password != confirmPassword) {
                errorMessage = "两次输入的密码不一致"
                return@remember
            }

            if (!agreementChecked) {
                errorMessage = "请先阅读并同意用户协议和隐私政策"
                return@remember
            }

            if (trimmedInput != accountInput) accountInput = trimmedInput

            isLoading = true
            scope.launch {
                try {
                    val TAG = "EmailAuthPage"
                    val apiService = RetrofitClient.getApiService()

                    if (authMode == "email") {
                        val request = EmailRegisterRequest(accountInput, password, code, null, true)
                        Log.d(TAG, "开始邮箱注册请求...")
                        Log.d(TAG, "Base URL: ${com.example.youzhinan.data.api.ApiConfig.BASE_URL}")
                        val response = apiService.emailRegister(request)
                        Log.d(TAG, "响应码：${response.code()}")
                        Log.d(TAG, "响应成功：${response.isSuccessful}")

                        if (response.isSuccessful && response.body() != null) {
                            val body: com.example.youzhinan.data.api.ApiResponse<com.example.youzhinan.data.api.LoginResponse> = response.body()!!
                            if (body.code == 0 || body.code == 200) {
                                RetrofitClient.saveToken(body.data!!.token)
                                saveUserInfoToPrefs(context, body.data!!.userInfo)
                                successMessage = "注册成功！"
                                errorMessage = null
                                Log.d(TAG, "邮箱注册成功，准备跳转...")
                                kotlinx.coroutines.delay(500)
                                onLoginSuccess()
                            } else {
                                Log.e(TAG, "注册失败 - 代码：${body.code}, 消息：${body.message}")
                                errorMessage = "注册失败：${body.message ?: "未知错误"} (业务代码：${body.code})"
                            }
                        } else {
                            errorMessage = ApiErrorUtil.fromResponse(response, "注册失败，请重试")
                            Log.e(TAG, "注册失败: $errorMessage")
                        }
                    } else {
                        val request = SmsRegisterRequest(accountInput, code, password, true)
                        Log.d(TAG, "开始手机注册请求...")
                        Log.d(TAG, "Base URL: ${com.example.youzhinan.data.api.ApiConfig.BASE_URL}")
                        val response = apiService.smsRegister(request)
                        Log.d(TAG, "响应码：${response.code()}")
                        Log.d(TAG, "响应成功：${response.isSuccessful}")

                        if (response.isSuccessful && response.body() != null) {
                            val body: com.example.youzhinan.data.api.ApiResponse<com.example.youzhinan.data.api.LoginResponse> = response.body()!!
                            if (body.code == 0 || body.code == 200) {
                                RetrofitClient.saveToken(body.data!!.token)
                                saveUserInfoToPrefs(context, body.data!!.userInfo)
                                successMessage = "注册成功！"
                                errorMessage = null
                                Log.d(TAG, "手机注册成功，准备跳转...")
                                kotlinx.coroutines.delay(500)
                                onLoginSuccess()
                            } else {
                                Log.e(TAG, "注册失败 - 代码：${body.code}, 消息：${body.message}")
                                errorMessage = "注册失败：${body.message ?: "未知错误"} (业务代码：${body.code})"
                            }
                        } else {
                            errorMessage = ApiErrorUtil.fromResponse(response, "注册失败，请重试")
                            Log.e(TAG, "注册失败: $errorMessage")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("EmailAuthPage", "注册异常", e)
                    errorMessage = ApiErrorUtil.fromException(e, "注册失败，请检查网络后重试")
                } finally {
                    isLoading = false
                }
            }
        }
    }
    
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(if (authMode == "email") "邮箱验证码注册" else "手机验证码注册") },
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
            
            // 成功提示
            if (successMessage != null) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Text(
                        text = successMessage ?: "",
                        modifier = Modifier.padding(16.dp),
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
            
            // 说明文字
            Text(
                text = "新用户通过手机号或邮箱验证码注册并设置密码",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 24.dp)
            )

            // 模式选择器
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                FilterChip(
                    selected = authMode == "phone",
                    onClick = {
                        authMode = "phone"
                        accountInput = ""
                        errorMessage = null
                        successMessage = null
                    },
                    label = { Text("手机号注册") }
                )
                FilterChip(
                    selected = authMode == "email",
                    onClick = {
                        authMode = "email"
                        accountInput = ""
                        errorMessage = null
                        successMessage = null
                    },
                    label = { Text("邮箱注册") }
                )
            }

            // 账号输入框（手机号或邮箱）
            OutlinedTextField(
                value = accountInput,
                onValueChange = {
                    accountInput = it
                    errorMessage = null
                    successMessage = null
                },
                label = { Text(if (authMode == "email") "邮箱地址 *" else "手机号 *") },
                leadingIcon = {
                    Icon(
                        imageVector = if (authMode == "email") Icons.Default.Email else Icons.Default.Phone,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = if (authMode == "email") KeyboardType.Email else KeyboardType.Phone,
                    imeAction = ImeAction.Next
                ),
                enabled = !isLoading && !isCountingDown
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // 验证码输入框和按钮
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = code,
                    onValueChange = { 
                        code = it
                        errorMessage = null
                        successMessage = null
                    },
                    label = { Text("验证码 *") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Verified,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Number,
                        imeAction = ImeAction.Next
                    ),
                    enabled = !isLoading
                )
                
                Button(
                    onClick = { sendVerificationCode() },
                    modifier = Modifier
                        .height(56.dp)
                        .width(140.dp),
                    enabled = !isLoading && !isCountingDown && accountInput.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isCountingDown) Color.Gray else Color(0xFF2D2D2D),
                        contentColor = Color.White,
                        disabledContainerColor = Color.Gray,
                        disabledContentColor = Color.LightGray
                    )
                ) {
                    Text(
                        text = if (isCountingDown) {
                            "${countdown / 60}:${(countdown % 60).toString().padStart(2, '0')}"
                        } else {
                            if (authMode == "email") "获取邮箱验证码" else "获取短信验证码"
                        },
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // 密码输入框（带实时强度提示）
            OutlinedTextField(
                value = password,
                onValueChange = { 
                    password = it
                    errorMessage = null
                    successMessage = null
                },
                label = { Text("设置密码 *") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Next
                ),
                supportingText = {
                    Text(
                        text = PasswordValidator.getTip(password),
                        fontSize = 12.sp,
                        color = if (PasswordValidator.isValid(password)) Color(0xFF2E7D32) else MaterialTheme.colorScheme.error
                    )
                },
                isError = password.isNotEmpty() && !PasswordValidator.isValid(password),
                enabled = !isLoading
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // 确认密码输入框
            OutlinedTextField(
                value = confirmPassword,
                onValueChange = { 
                    confirmPassword = it
                    errorMessage = null
                    successMessage = null
                },
                label = { Text("确认密码 *") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        focusManager.clearFocus()
                        if (accountInput.isNotBlank() && code.isNotBlank() && password.isNotBlank()) {
                            performEmailAuth()
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
            
            // 登录/注册按钮
            Button(
                onClick = { performEmailAuth() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                enabled = !isLoading && accountInput.isNotBlank() && code.isNotBlank() && PasswordValidator.isValid(password) && password == confirmPassword,
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
                    Text("处理中...")
                } else {
                    Text("立即登录/注册")
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
            
            // 切换到密码登录
            TextButton(
                onClick = {
                    navController.navigate("passwordLogin")
                },
                enabled = !isLoading
            ) {
                Text(
                    text = "使用密码登录",
                    color = Color(0xFF2D2D2D),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // 温馨提示
            Text(
                text = "温馨提示：",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "• 仅适用于新用户注册，已注册请用密码登录\n• 验证码有效期为 5 分钟\n• 密码需 8–20 位，含大小写字母、数字、特殊字符",
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

/**
 * 保存用户信息到 SharedPreferences
 */
fun saveUserInfoToPrefs(context: Context, userInfo: UserInfo) {
    val prefs = context.getSharedPreferences("UserInfo", Context.MODE_PRIVATE)
    prefs.edit().apply {
        putInt("userId", userInfo.id)
        putString("username", userInfo.username)
        putString("nickName", userInfo.nickName ?: "")
        putString("avatarUrl", userInfo.avatarUrl)
        putString("phone", userInfo.phone)
        putBoolean("isAdmin", userInfo.isAdmin || userInfo.admin)
        putString("symbol", userInfo.symbol)
        putFloat("points", userInfo.points.toFloat())
        apply()
    }
}
