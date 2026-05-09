package com.example.youzhinan.ui.pages

import android.Manifest
import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.example.youzhinan.ui.components.NetworkImage
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import java.io.File
import java.io.FileOutputStream

@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@Composable
fun PersonalInfoPage(
    navController: NavHostController,
    viewModel: ProfileViewModel,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    var nickName by remember { mutableStateOf("") }
    var account by remember { mutableStateOf("") }
    var avatarUrl by remember { mutableStateOf<String?>(null) }
    var phone by remember { mutableStateOf("") }
    var isEditing by remember { mutableStateOf(false) }
    var tempAvatarUri by remember { mutableStateOf<Uri?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var showSuccessDialog by remember { mutableStateOf(false) }
    var isSaving by remember { mutableStateOf(false) }
    var showAvatarOptions by remember { mutableStateOf(false) }
    var pendingTakePhoto by remember { mutableStateOf(false) }
    var pendingPickGallery by remember { mutableStateOf(false) }
    
    val uiState by viewModel.uiState.collectAsState()

    // 以 ViewModel 状态为准同步展示，避免 prefs / uiState 混用导致显示混乱
    LaunchedEffect(uiState.isLoggedIn, uiState.userInfo) {
        if (!uiState.isLoggedIn) {
            // 未登录时不允许停留在个人信息页
            navController.popBackStack()
            return@LaunchedEffect
        }

        val user = uiState.userInfo ?: run {
            navController.popBackStack()
            return@LaunchedEffect
        }
        val prefs = context.getSharedPreferences("UserInfo", Context.MODE_PRIVATE)

        nickName = user.nickName ?: ""
        account = user.username
        // 头像优先读本地持久化（如果存在），否则用后端返回
        avatarUrl = prefs.getString("avatarUrl", null) ?: user.avatarUrl
        phone = user.phone ?: prefs.getString("phone", "") ?: ""
    }

    // 验证图片格式
    fun isValidImageFormat(uri: Uri): Boolean {
        val mimeType = context.contentResolver.getType(uri)
        if (mimeType in listOf("image/jpeg", "image/jpg", "image/png", "image/gif")) return true
        // FileProvider 等可能返回 null，根据路径判断
        val path = uri.toString().lowercase()
        return path.endsWith(".jpg") || path.endsWith(".jpeg") || path.endsWith(".png") || path.endsWith(".gif")
    }

    // 检查文件大小（不超过 5MB）- 使用 readBytes 准确测量，available() 不可靠
    fun isFileSizeValid(uri: Uri): Boolean {
        return try {
            context.contentResolver.openInputStream(uri)?.use { stream ->
                stream.readBytes().size <= 5 * 1024 * 1024 // 5MB
            } ?: false
        } catch (e: Exception) {
            false
        }
    }

    // 复制图片到应用目录
    fun copyImageToAppDir(uri: Uri): String? {
        return try {
            val fileName = "avatar_${System.currentTimeMillis()}.jpg"
            val file = File(context.cacheDir, fileName)
            val inputStream = context.contentResolver.openInputStream(uri)
            val outputStream = FileOutputStream(file)
            inputStream?.copyTo(outputStream)
            inputStream?.close()
            outputStream.close()
            file.absolutePath
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    // 保存图片信息
    fun saveInfo() {
        isSaving = true
        errorMessage = null
        
        val TAG = "PersonalInfoPage"
        android.util.Log.d(TAG, "开始保存个人信息...")

        // 调用 ViewModel 更新用户信息
        viewModel.updateUserInfo(
            nickName = nickName,
            avatarUrl = if (tempAvatarUri != null) tempAvatarUri.toString() else avatarUrl,
            phone = phone,
            onSuccess = { userInfo ->
                android.util.Log.d(TAG, "保存成功！")
                android.util.Log.d(TAG, "返回的 userInfo: $userInfo")
                
                // 使用服务器返回的头像 URL，而非本地路径，确保跨设备同步
                avatarUrl = userInfo.avatarUrl
                if (!userInfo.avatarUrl.isNullOrBlank()) {
                    val prefs = context.getSharedPreferences("UserInfo", Context.MODE_PRIVATE)
                    prefs.edit().putString("avatarUrl", userInfo.avatarUrl).apply()
                }
                
                isSaving = false
                isEditing = false
                tempAvatarUri = null
                showSuccessDialog = true
                
                // 显示 Toast 提示
                Toast.makeText(context, "保存成功！", Toast.LENGTH_SHORT).show()
            },
            onError = { error ->
                android.util.Log.e(TAG, "保存失败：$error")
                isSaving = false
                errorMessage = error
                
                // 显示错误 Toast（使用更长的时长）
                Toast.makeText(context, "保存失败：$error", Toast.LENGTH_LONG).show()
            }
        )
    }

    // 处理选中的图片（相册或拍照）
    fun handleSelectedImage(uri: Uri?) {
        uri?.let {
            if (!isValidImageFormat(it)) {
                errorMessage = "不支持的图片格式，请选择 JPG、PNG 或 GIF"
                return@let
            }
            if (!isFileSizeValid(it)) {
                errorMessage = "图片大小不能超过 5MB"
                return@let
            }
            tempAvatarUri = it
            errorMessage = null
            isEditing = true  // 选择头像后自动进入编辑模式
        }
    }

    // 从相册选择
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? -> handleSelectedImage(uri) }

    // 拍照
    val cameraPhotoUri = remember { mutableStateOf<Uri?>(null) }
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        cameraPhotoUri.value?.takeIf { success }?.let { handleSelectedImage(it) }
    }

    // 权限
    val storagePermissionState = rememberPermissionState(Manifest.permission.READ_MEDIA_IMAGES)
    val cameraPermissionState = rememberPermissionState(Manifest.permission.CAMERA)

    fun openAvatarOptions() {
        showAvatarOptions = true
    }

    fun pickFromGallery() {
        showAvatarOptions = false
        if (storagePermissionState.status.isGranted) {
            imagePickerLauncher.launch("image/*")
        } else {
            pendingPickGallery = true
            storagePermissionState.launchPermissionRequest()
        }
    }

    fun takePhoto() {
        showAvatarOptions = false
        if (!cameraPermissionState.status.isGranted) {
            pendingTakePhoto = true
            cameraPermissionState.launchPermissionRequest()
            return
        }
        pendingTakePhoto = false
        val file = File(context.cacheDir, "avatar_capture_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        cameraPhotoUri.value = uri
        cameraLauncher.launch(uri)
    }

    // 相册权限授予后自动打开
    LaunchedEffect(storagePermissionState.status) {
        if (storagePermissionState.status.isGranted && pendingPickGallery) {
            pendingPickGallery = false
            imagePickerLauncher.launch("image/*")
        }
    }

    // 相机权限授予后自动拍照
    LaunchedEffect(cameraPermissionState.status) {
        if (cameraPermissionState.status.isGranted && pendingTakePhoto) {
            pendingTakePhoto = false
            val file = File(context.cacheDir, "avatar_capture_${System.currentTimeMillis()}.jpg")
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            cameraPhotoUri.value = uri
            cameraLauncher.launch(uri)
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "个人信息",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "个人资料",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                },
                actions = {
                    if (isEditing) {
                        IconButton(onClick = { saveInfo() }) {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = "保存",
                                tint = if (isSaving) Color.Gray else Color.White
                            )
                        }
                    } else {
                        IconButton(onClick = { isEditing = true }) {
                            Icon(
                                Icons.Default.Edit,
                                contentDescription = "编辑",
                                tint = Color.White
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFF1A1A1A)
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
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
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Error,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = errorMessage ?: "",
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            fontSize = 14.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // 头像区域 - 始终可点击，选择拍照或相册
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .background(Color(0xFFF5F5F5))
                    .clickable { openAvatarOptions() },
                contentAlignment = Alignment.Center
            ) {
                val displayAvatar = if (isEditing && tempAvatarUri != null) {
                    tempAvatarUri.toString()
                } else {
                    avatarUrl
                }

                if (displayAvatar.isNullOrBlank()) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = "头像",
                        modifier = Modifier.size(60.dp),
                        tint = Color(0xFF999999)
                    )
                } else {
                    NetworkImage(
                        url = displayAvatar,
                        contentDescription = "头像",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                }

                // 半透明遮罩 + 提示
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.25f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.CameraAlt,
                            contentDescription = "更换头像",
                            tint = Color.White,
                            modifier = Modifier.size(36.dp)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "点击更换",
                            fontSize = 12.sp,
                            color = Color.White
                        )
                    }
                }
            }

            Text(
                text = "支持 JPG、PNG、GIF，最大 5MB",
                fontSize = 12.sp,
                color = Color(0xFF666666),
                modifier = Modifier.padding(top = 8.dp)
            )

            Spacer(modifier = Modifier.height(30.dp))

            if (isEditing) {
                // 昵称输入框
                OutlinedTextField(
                    value = nickName,
                    onValueChange = { nickName = it },
                    label = { Text("昵称") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    leadingIcon = {
                        Icon(Icons.Default.Person, contentDescription = null)
                    }
                )

                Spacer(modifier = Modifier.height(16.dp))

                // 账号（后端返回，不可修改）
                InfoItem(label = "账号", value = account.ifBlank { "未获取" })

                Spacer(modifier = Modifier.height(16.dp))

                // 手机号输入框
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("手机号") },
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = {
                        Icon(Icons.Default.Phone, contentDescription = null)
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    shape = RoundedCornerShape(12.dp)
                )

                Spacer(modifier = Modifier.height(30.dp))

                // 保存按钮
                Button(
                    onClick = { saveInfo() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    enabled = !isSaving,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF1A1A1A)
                    ),
                    shape = RoundedCornerShape(26.dp)
                ) {
                    if (isSaving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.White
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("保存中...")
                    } else {
                        Text(
                            text = "保存",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            } else {
                // 查看模式
                InfoItem(label = "昵称", value = nickName)
                InfoItem(label = "账号", value = account.ifBlank { "未获取" })
                InfoItem(label = "手机号", value = phone.ifBlank { "未设置" })
            }
            
            Spacer(modifier = Modifier.height(30.dp))
            
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = {
                        onLogout()
                        navController.popBackStack("profile", inclusive = false)
                    }),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFF8F8F8)),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Logout,
                        contentDescription = null,
                        tint = Color(0xFFB85555),
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Text(
                        text = "退出登录",
                        style = MaterialTheme.typography.bodyLarge,
                        color = Color(0xFFB85555)
                    )
                }
            }
        }
    }

    // 头像来源选择 BottomSheet
    if (showAvatarOptions) {
        ModalBottomSheet(
            onDismissRequest = { showAvatarOptions = false },
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 32.dp)
            ) {
                Text(
                    text = "选择头像",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(bottom = 20.dp)
                )
                // 拍照
                TextButton(
                    onClick = { takePhoto() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                ) {
                    Icon(
                        Icons.Default.CameraAlt,
                        contentDescription = null,
                        modifier = Modifier.size(24.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text("拍照", fontSize = 16.sp)
                }
                // 从相册选择
                TextButton(
                    onClick = { pickFromGallery() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                ) {
                    Icon(
                        Icons.Default.Image,
                        contentDescription = null,
                        modifier = Modifier.size(24.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text("从相册选择", fontSize = 16.sp)
                }
                // 取消
                OutlinedButton(
                    onClick = { showAvatarOptions = false },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    Text("取消")
                }
            }
        }
    }

    // 成功对话框
    if (showSuccessDialog) {
        AlertDialog(
            onDismissRequest = { showSuccessDialog = false },
            icon = {
                Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "成功",
                    tint = Color.Green,
                    modifier = Modifier.size(48.dp)
                )
            },
            title = { Text("保存成功") },
            text = { Text("您的个人信息已更新") },
            confirmButton = {
                Button(
                    onClick = { showSuccessDialog = false }
                ) {
                    Text("确定")
                }
            }
        )
    }
}

@Composable
fun InfoItem(label: String, value: String) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.White
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge,
                color = Color(0xFF666666)
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyLarge,
                color = Color(0xFF333333),
                fontWeight = FontWeight.Medium
            )
        }
    }
}
