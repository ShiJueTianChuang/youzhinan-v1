package com.example.youzhinan.ui.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChangePasswordPage(
    navController: NavHostController,
    profileViewModel: ProfileViewModel
) {
    val context = LocalContext.current
    val uiState by profileViewModel.uiState.collectAsState()

    // 未登录时跳转回个人中心
    LaunchedEffect(uiState.isLoggedIn) {
        if (!uiState.isLoggedIn) {
            navController.popBackStack("profile", inclusive = false)
        }
    }
    val focusManager = LocalFocusManager.current
    val scope = rememberCoroutineScope()
    
    var oldPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("修改密码") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "返回"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF2D2D2D),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
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
            
            // 旧密码输入框
            OutlinedTextField(
                value = oldPassword,
                onValueChange = { 
                    oldPassword = it
                    errorMessage = null
                    successMessage = null
                },
                label = { Text("当前密码") },
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
                enabled = !isLoading
            )
            
            Spacer(modifier = Modifier.height(20.dp))
            
            // 新密码输入框
            OutlinedTextField(
                value = newPassword,
                onValueChange = { 
                    newPassword = it
                    errorMessage = null
                    successMessage = null
                },
                label = { Text("新密码") },
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
                enabled = !isLoading
            )
            
            Spacer(modifier = Modifier.height(20.dp))
            
            // 确认新密码输入框
            OutlinedTextField(
                value = confirmPassword,
                onValueChange = { 
                    confirmPassword = it
                    errorMessage = null
                    successMessage = null
                },
                label = { Text("确认新密码") },
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
                    }
                ),
                enabled = !isLoading
            )
            
            Spacer(modifier = Modifier.height(32.dp))
            
            // 修改密码按钮
            Button(
                onClick = {
                    if (oldPassword.isBlank() || newPassword.isBlank() || confirmPassword.isBlank()) {
                        errorMessage = "请填写所有字段"
                        return@Button
                    }
                    
                    if (newPassword != confirmPassword) {
                        errorMessage = "两次输入的新密码不一致"
                        return@Button
                    }
                    
                    if (newPassword.length < 6) {
                        errorMessage = "密码长度不能少于 6 位"
                        return@Button
                    }
                    
                    isLoading = true
                    errorMessage = null
                    successMessage = null
                    profileViewModel.changePassword(
                        oldPassword = oldPassword,
                        newPassword = newPassword,
                        onSuccess = {
                            successMessage = "密码修改成功，请重新登录"
                            oldPassword = ""
                            newPassword = ""
                            confirmPassword = ""
                            isLoading = false
                            scope.launch {
                                delay(1500)
                                navController.popBackStack("profile", inclusive = false)
                            }
                        },
                        onError = { msg ->
                            errorMessage = msg
                            isLoading = false
                        }
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Text("修改中...")
                } else {
                    Text("确认修改")
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // 提示信息
            Text(
                text = "温馨提示：",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = "• 密码长度不少于 6 位\n• 请确保记住新密码\n• 修改成功后需要重新登录",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                lineHeight = 20.sp
            )
        }
    }
}
