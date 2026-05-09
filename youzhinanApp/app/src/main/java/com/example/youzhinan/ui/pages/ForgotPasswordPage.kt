package com.example.youzhinan.ui.pages

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.example.youzhinan.data.api.*
import com.example.youzhinan.utils.ApiErrorUtil
import com.example.youzhinan.utils.PasswordValidator
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * 忘记密码页面
 * 功能：通过邮箱验证码重置密码
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ForgotPasswordPage(
    navController: NavHostController,
    onResetSuccess: () -> Unit
) {
    val focusManager = LocalFocusManager.current
    val scope = rememberCoroutineScope()
    
    var authMode by remember { mutableStateOf("email") } // "email" 或 "phone"
    var accountInput by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }
    var step by remember { mutableStateOf(1) } // 1: 输入邮箱/手机号，2: 输入验证码和新密码
    
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
    
    // 验证手机号格式（简单校验：11位数字，以1开头）
    fun isValidPhone(phone: String): Boolean {
        val trimmed = phone.trim()
        return trimmed.matches(Regex("^1[3-9]\\d{9}$"))
    }
    
    // 密码校验与后端保持一致，使用 PasswordValidator
    
    // 发送验证码
    fun sendVerificationCode() {
        val trimmedInput = accountInput.trim()
        if (trimmedInput.isBlank()) {
            errorMessage = if (authMode == "email") "请输入邮箱地址" else "请输入手机号"
            return
        }
        
        // 格式验证
        if (authMode == "email") {
            if (!isValidEmail(trimmedInput)) {
                errorMessage = "请输入有效的邮箱地址"
                return
            }
        } else {
            if (!isValidPhone(trimmedInput)) {
                errorMessage = "请输入有效的手机号（11位数字，以1开头）"
                return
            }
        }
        
        // 同步 trim 到状态
        if (trimmedInput != accountInput) accountInput = trimmedInput
        
        isLoading = true
        scope.launch {
            try {
                val TAG = "ForgotPassword"
                val apiService = RetrofitClient.getApiService()
                
                if (authMode == "email") {
                    val request = VerificationCodeRequest(accountInput.trim(), "reset_password")
                    Log.d(TAG, "发送邮箱重置密码验证码...")
                    
                    val response = apiService.sendVerificationCode(request)
                    
                    Log.d(TAG, "响应码：${response.code()}")
                    Log.d(TAG, "响应成功：${response.isSuccessful}")
                    
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        if (body.code == 0 || body.code == 200) {
                            countdown = 300 // 5 分钟有效期
                            successMessage = "验证码已发送到您的邮箱，5 分钟内有效"
                            errorMessage = null
                            step = 2 // 进入下一步
                            Log.d(TAG, "邮箱验证码发送成功")
                        } else {
                            val errorMsg = when (body.code) {
                                404 -> "该邮箱未注册，请先注册账号"
                                429 -> "发送过于频繁，请稍后再试"
                                500 -> "服务器错误，请稍后重试"
                                else -> body.message ?: "发送失败"
                            }
                            errorMessage = "$errorMsg (HTTP ${body.code})"
                        }
                    } else {
                        errorMessage = ApiErrorUtil.fromResponse(response, "发送失败，请重试")
                    }
                } else {
                    // 手机号模式
                    val request = SmsCodeRequest(accountInput.trim(), "reset_password")
                    Log.d(TAG, "发送手机重置密码验证码...")
                    
                    val response = apiService.sendSmsCode(request)
                    
                    Log.d(TAG, "响应码：${response.code()}")
                    Log.d(TAG, "响应成功：${response.isSuccessful}")
                    
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        if (body.code == 0 || body.code == 200) {
                            countdown = 300 // 5 分钟有效期
                            successMessage = "验证码已发送到您的手机，5 分钟内有效"
                            errorMessage = null
                            step = 2 // 进入下一步
                            Log.d(TAG, "手机验证码发送成功")
                        } else {
                            val errorMsg = when (body.code) {
                                404 -> "该手机号未注册，请先注册账号"
                                429 -> "发送过于频繁，请稍后再试"
                                500 -> "服务器错误，请稍后重试"
                                else -> body.message ?: "发送失败"
                            }
                            errorMessage = "$errorMsg (HTTP ${body.code})"
                        }
                    } else {
                        errorMessage = ApiErrorUtil.fromResponse(response, "发送失败，请重试")
                    }
                }
            } catch (e: Exception) {
                Log.e("ForgotPassword", "发送验证码异常", e)
                errorMessage = ApiErrorUtil.fromException(e, "发送失败，请检查网络后重试")
            } finally {
                isLoading = false
            }
        }
    }
    
    // 重置密码
    fun resetPassword() {
        val trimmedCode = code.trim()
        val trimmedNewPassword = newPassword.trim()
        val trimmedConfirmPassword = confirmPassword.trim()
        
        if (trimmedCode.isBlank()) {
            errorMessage = "请输入验证码"
            return
        }
        
        if (trimmedCode.length < 4) {
            errorMessage = "验证码长度不正确"
            return
        }
        
        if (trimmedNewPassword.isBlank()) {
            errorMessage = "请输入新密码"
            return
        }
        
        if (!PasswordValidator.isValid(trimmedNewPassword)) {
            errorMessage = PasswordValidator.getTip(trimmedNewPassword)
            return
        }
        
        if (trimmedNewPassword != trimmedConfirmPassword) {
            errorMessage = "两次输入的密码不一致"
            return
        }
        
        // 确保账户输入非空（步骤 2 时输入应来自步骤 1）
        if (accountInput.trim().isBlank()) {
            errorMessage = "账户信息缺失，请返回上一步重新输入"
            return
        }
        
        // 同步 trim 到状态
        if (trimmedCode != code) code = trimmedCode
        if (trimmedNewPassword != newPassword) newPassword = trimmedNewPassword
        if (trimmedConfirmPassword != confirmPassword) confirmPassword = trimmedConfirmPassword
        
        isLoading = true
        scope.launch {
            try {
                val TAG = "ForgotPassword"
                val apiService = RetrofitClient.getApiService()
                
                if (authMode == "email") {
                    val reqEmail = accountInput.trim()
                    val reqCode = code.trim()
                    val reqPassword = newPassword.trim()
                    val request = ResetPasswordRequest(reqEmail, reqCode, reqPassword)
                    
                    Log.d(TAG, "邮箱重置密码请求...")
                    
                    val response = apiService.resetPassword(request)
                    
                    Log.d(TAG, "响应码：${response.code()}")
                    Log.d(TAG, "响应成功：${response.isSuccessful}")
                    
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        if (body.code == 0 || body.code == 200) {
                            successMessage = "密码重置成功！"
                            errorMessage = null
                            
                            Log.d(TAG, "密码重置成功，准备跳转...")
                            
                            // 延迟跳转
                            delay(1500)
                            onResetSuccess()
                        } else {
                            val errorMsg = when (body.code) {
                                400 -> "验证码错误或已过期"
                                404 -> "该邮箱未注册"
                                500 -> "服务器错误，请稍后重试"
                                else -> body.message ?: "重置失败"
                            }
                            errorMessage = "$errorMsg (HTTP ${body.code})"
                        }
                    } else {
                        errorMessage = ApiErrorUtil.fromResponse(response, "重置失败，请重试")
                    }
                } else {
                    // 手机号模式
                    val reqPhone = accountInput.trim()
                    val reqCode = code.trim()
                    val reqPassword = newPassword.trim()
                    val request = SmsResetPasswordRequest(reqPhone, reqCode, reqPassword)
                    
                    Log.d(TAG, "手机号重置密码请求...")
                    
                    val response = apiService.smsResetPassword(request)
                    
                    Log.d(TAG, "响应码：${response.code()}")
                    Log.d(TAG, "响应成功：${response.isSuccessful}")
                    
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        if (body.code == 0 || body.code == 200) {
                            successMessage = "密码重置成功！"
                            errorMessage = null
                            
                            Log.d(TAG, "密码重置成功，准备跳转...")
                            
                            // 延迟跳转
                            delay(1500)
                            onResetSuccess()
                        } else {
                            val errorMsg = when (body.code) {
                                400 -> "验证码错误或已过期"
                                404 -> "该手机号未注册"
                                500 -> "服务器错误，请稍后重试"
                                else -> body.message ?: "重置失败"
                            }
                            errorMessage = "$errorMsg (HTTP ${body.code})"
                        }
                    } else {
                        errorMessage = ApiErrorUtil.fromResponse(response, "重置失败，请重试")
                    }
                }
            } catch (e: Exception) {
                Log.e("ForgotPassword", "重置密码异常", e)
                errorMessage = ApiErrorUtil.fromException(e, "重置失败，请检查网络后重试")
            } finally {
                isLoading = false
            }
        }
    }
    
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("忘记密码") },
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
            
            // 步骤指示
            StepperIndicator(currentStep = step, totalSteps = 2)
            
            Spacer(modifier = Modifier.height(32.dp))
            
            // 步骤 1：输入邮箱或手机号
            if (step == 1) {
                // 模式选择器
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    FilterChip(
                        selected = authMode == "email",
                        onClick = { authMode = "email" },
                        label = { Text("邮箱验证") }
                    )
                    FilterChip(
                        selected = authMode == "phone",
                        onClick = { authMode = "phone" },
                        label = { Text("手机验证") }
                    )
                }
                
                Text(
                    text = if (authMode == "email") "请输入注册时使用的邮箱" else "请输入注册时使用的手机号",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                
                OutlinedTextField(
                    value = accountInput,
                    onValueChange = { 
                        accountInput = it
                        errorMessage = null
                    },
                    label = { Text(if (authMode == "email") "邮箱地址" else "手机号") },
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
                    enabled = !isLoading
                )
                
                Spacer(modifier = Modifier.height(32.dp))
                
                Button(
                    onClick = { sendVerificationCode() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    enabled = !isLoading && accountInput.trim().isNotBlank(),
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
                        Text("发送中...")
                    } else {
                        Text(if (authMode == "email") "获取邮箱验证码" else "获取短信验证码")
                    }
                }
            }
            // 步骤 2：输入验证码和新密码
            else if (step == 2) {
                Text(
                    text = "请输入验证码和新密码",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 24.dp)
                )
                
                // 验证码输入框和重发按钮
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = code,
                        onValueChange = { 
                            code = it
                            errorMessage = null
                        },
                        label = { Text("验证码") },
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
                            .width(120.dp),
                        enabled = !isLoading && !isCountingDown && accountInput.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isCountingDown) Color.Gray else Color(0xFF2D2D2D),
                            contentColor = Color.White,
                            disabledContainerColor = Color.Gray,
                            disabledContentColor = Color.LightGray
                        ),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(26.dp)
                    ) {
                        Text(
                            text = if (isCountingDown) "${countdown / 60}:${(countdown % 60).toString().padStart(2, '0')}" else "重发",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // 新密码输入框
                var passwordVisible by remember { mutableStateOf(false) }
                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { 
                        newPassword = it
                        errorMessage = null
                    },
                    label = { Text("新密码") },
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
                        imeAction = ImeAction.Next
                    ),
                    supportingText = {
                        val tip = PasswordValidator.getTip(newPassword)
                        val color = when {
                            newPassword.isEmpty() -> MaterialTheme.colorScheme.onSurfaceVariant
                            PasswordValidator.isValid(newPassword) -> Color(0xFF2E7D32)
                            else -> MaterialTheme.colorScheme.error
                        }
                        Text(text = tip, fontSize = 12.sp, color = color)
                    },
                    isError = newPassword.isNotEmpty() && !PasswordValidator.isValid(newPassword),
                    enabled = !isLoading
                )
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // 确认密码输入框
                var confirmPasswordVisible by remember { mutableStateOf(false) }
                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { 
                        confirmPassword = it
                        errorMessage = null
                    },
                    label = { Text("确认密码") },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    trailingIcon = {
                        IconButton(onClick = { confirmPasswordVisible = !confirmPasswordVisible }) {
                            Icon(
                                imageVector = if (confirmPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                contentDescription = if (confirmPasswordVisible) "隐藏密码" else "显示密码",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    visualTransformation = if (confirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            focusManager.clearFocus()
                            if (code.isNotBlank() && newPassword.isNotBlank()) {
                                resetPassword()
                            }
                        }
                    ),
                    enabled = !isLoading
                )
                
                Spacer(modifier = Modifier.height(32.dp))
                
                Button(
                    onClick = { resetPassword() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    enabled = !isLoading && code.isNotBlank() && PasswordValidator.isValid(newPassword) && newPassword == confirmPassword,
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
                        Text("重置中...")
                    } else {
                        Text("重置密码")
                    }
                }
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
                text = "• 验证码有效期为 5 分钟\n• 密码需 8–20 位，含大小写字母、数字、特殊字符\n• 如未收到验证码，请检查垃圾邮件箱或短信拦截",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 20.sp
            )
        }
    }
}

/**
 * 步骤指示器
 */
@Composable
fun StepperIndicator(currentStep: Int, totalSteps: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center
    ) {
        for (i in 1..totalSteps) {
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .then(
                            if (i <= currentStep) {
                                Modifier.background(Color.Black, CircleShape)
                            } else {
                                Modifier.background(Color.Gray, CircleShape)
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = i.toString(),
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                }
                
                if (i < totalSteps) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(2.dp)
                            .background(
                                if (i < currentStep) Color.Black else Color.Gray
                            )
                    )
                }
            }
        }
    }
}
