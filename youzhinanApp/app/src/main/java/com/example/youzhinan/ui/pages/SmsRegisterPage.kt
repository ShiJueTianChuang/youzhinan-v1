package com.example.youzhinan.ui.pages

import android.content.Context
import android.util.Log
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PersonAdd
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
 * 手机号验证码注册页面
 * 新用户通过手机号验证码注册并设置密码
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SmsRegisterPage(
    navController: NavHostController,
    initialInviteCode: String? = null,
    onLoginSuccess: () -> Unit
) {
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current
    val scope = rememberCoroutineScope()
    
    var phone by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var inviteCode by remember { mutableStateOf(initialInviteCode ?: "") }
    
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
    
    // 验证手机号格式
    fun isValidPhone(phone: String): Boolean {
        return phone.matches("^1[3-9]\\d{9}$".toRegex())
    }
    
    // 发送验证码
    val sendVerificationCode = remember {
        {
            if (phone.isBlank()) {
                errorMessage = "请输入手机号"
                return@remember
            }
            
            if (!isValidPhone(phone)) {
                errorMessage = "请输入有效的手机号"
                return@remember
            }
            
            isLoading = true
            scope.launch {
                val TAG = "SmsRegisterPage"
                try {
                    val apiService = RetrofitClient.getApiService()
                    val request = SmsCodeRequest(phone, "register")
                    
                    Log.d(TAG, "发送验证码请求...")
                    Log.d(TAG, "Base URL: ${ApiConfig.BASE_URL}")
                    
                    val response = apiService.sendSmsCode(request)
                    
                    Log.d(TAG, "响应码：${response.code()}")
                    Log.d(TAG, "响应消息：${response.message()}")
                    
                    if (response.isSuccessful) {
                        countdown = 300
                        successMessage = "验证码已发送到您的手机，5 分钟内有效"
                        errorMessage = null
                        Log.d(TAG, "验证码发送成功")
                    } else {
                        errorMessage = ApiErrorUtil.fromResponse(response, "发送失败，请重试")
                        Log.e(TAG, "发送失败：$errorMessage")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "发送验证码异常", e)
                    errorMessage = ApiErrorUtil.fromException(e, "发送失败，请检查网络后重试")
                } finally {
                    isLoading = false
                }
            }
        }
    }
    
    // 执行注册
    val performSmsRegister = remember {
        {
            if (phone.isBlank() || code.isBlank()) {
                errorMessage = "请填写手机号和验证码"
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
            
            isLoading = true
            scope.launch {
                val TAG = "SmsRegisterPage"
                try {
                    val apiService = RetrofitClient.getApiService()
                    val request = SmsRegisterRequest(phone, code, password, true, inviteCode.ifBlank { null })
                    
                    Log.d(TAG, "开始注册请求...")
                    Log.d(TAG, "Base URL: ${ApiConfig.BASE_URL}")
                    
                    val response = apiService.smsRegister(request)
                    
                    Log.d(TAG, "响应码：${response.code()}")
                    Log.d(TAG, "响应成功：${response.isSuccessful}")
                    
                    if (response.isSuccessful && response.body() != null) {
                        val body: ApiResponse<LoginResponse> = response.body()!!
                        if (body.code == 0 || body.code == 200) {
                            RetrofitClient.saveToken(body.data!!.token)
                            saveUserInfoToPrefs(context, body.data!!.userInfo)
                            
                            successMessage = "注册成功！"
                            errorMessage = null
                            
                            Log.d(TAG, "注册成功，准备跳转...")
                            
                            kotlinx.coroutines.delay(500)
                            onLoginSuccess()
                        } else {
                            Log.e(TAG, "注册失败 - 代码：${body.code}, 消息：${body.message}")
                            errorMessage = "注册失败：${body.message ?: "未知错误"} (业务代码：${body.code})"
                        }
                    } else {
                        errorMessage = ApiErrorUtil.fromResponse(response, "注册失败，请重试")
                        Log.e(TAG, "注册失败：$errorMessage")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "注册异常", e)
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
                title = { Text("手机号验证码注册") },
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
            
            Text(
                text = "新用户通过手机号验证码注册并设置密码",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 24.dp)
            )
            
            OutlinedTextField(
                value = phone,
                onValueChange = { 
                    phone = it
                    errorMessage = null
                    successMessage = null
                },
                label = { Text("手机号 *") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Phone,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Phone,
                    imeAction = ImeAction.Next
                ),
                enabled = !isLoading && !isCountingDown
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
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
                    enabled = !isLoading && !isCountingDown && phone.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isCountingDown) Color.Gray else Color(0xFF2D2D2D),
                        contentColor = Color.White,
                        disabledContainerColor = Color.Gray,
                        disabledContentColor = Color.LightGray
                    )
                ) {
                    Text(
                        text = if (isCountingDown) "${countdown / 60}:${(countdown % 60).toString().padStart(2, '0')}" else "获取验证码",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
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
                        if (phone.isNotBlank() && code.isNotBlank() && password.isNotBlank()) {
                            performSmsRegister()
                        }
                    }
                ),
                enabled = !isLoading
            )

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = inviteCode,
                onValueChange = {
                    inviteCode = it
                    errorMessage = null
                    successMessage = null
                },
                label = { Text("邀请码（可获额外抽奖机会）") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.PersonAdd,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Uri,
                    imeAction = ImeAction.Done
                ),
                enabled = !isLoading
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            AgreementCheckbox(
                agreed = agreementChecked,
                onAgreedChange = { agreementChecked = it },
                onViewAgreement = { navController.navigate("agreementDetail/agreement") },
                onViewPrivacy = { navController.navigate("agreementDetail/privacy") }
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            Button(
                onClick = { performSmsRegister() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                enabled = !isLoading && phone.isNotBlank() && code.isNotBlank() && PasswordValidator.isValid(password) && password == confirmPassword,
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
                    Text("注册中...")
                } else {
                    Text("立即注册")
                }
            }
            
            Spacer(modifier = Modifier.height(20.dp))
            
            TextButton(
                onClick = {
                    navController.navigate("passwordLogin")
                },
                enabled = !isLoading
            ) {
                Text(
                    text = "已有账号？密码登录",
                    color = Color(0xFF2D2D2D),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            Text(
                text = "温馨提示：\n• 验证码有效期为 5 分钟\n• 密码需 8–20 位，含大小写字母、数字、特殊字符",
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
