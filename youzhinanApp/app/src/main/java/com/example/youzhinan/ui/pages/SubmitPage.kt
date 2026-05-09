package com.example.youzhinan.ui.pages

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Search
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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.example.youzhinan.data.api.ApiConfig
import com.example.youzhinan.ui.components.NetworkImage
import com.example.youzhinan.ui.theme.SurfaceDark
import com.example.youzhinan.ui.theme.TextSecondary
import com.example.youzhinan.ui.theme.TitleDark
import com.example.youzhinan.ui.viewmodel.LocationMatch
import com.example.youzhinan.ui.viewmodel.SubmitViewModel
import kotlinx.coroutines.launch

private const val CUSTOM_CATEGORY_LABEL = "自定义"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubmitPage(
    navController: NavHostController,
    viewModel: SubmitViewModel = run {
        val ctx = LocalContext.current.applicationContext
        viewModel(
            factory = object : ViewModelProvider.Factory {
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    @Suppress("UNCHECKED_CAST")
                    return SubmitViewModel(ctx) as T
                }
            }
        )
    }
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()
    val scope = rememberCoroutineScope()

    var storeName by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var isCustomCategory by remember { mutableStateOf(false) }
    var customCategoryText by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var businessHours by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var contact by remember { mutableStateOf("") }

    val province = uiState.selectedProvince ?: ""
    val city = uiState.selectedCity ?: ""
    val district = uiState.selectedDistrict ?: ""

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            scope.launch {
                viewModel.setImageUploading(true)
                try {
                    val path = viewModel.uploadImage(it)
                    viewModel.addUploadedImagePath(path)
                } catch (e: Exception) {
                    Toast.makeText(context, "图片上传失败: ${e.message}", Toast.LENGTH_SHORT).show()
                }
                viewModel.setImageUploading(false)
            }
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("信息投稿", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text("提交后等待审核", fontSize = 12.sp, color = Color.White.copy(alpha = 0.8f))
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFF1A1A1A),
                    titleContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(scrollState)
                .padding(16.dp)
        ) {
            uiState.error?.let { err ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFEBEE)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(err, color = Color(0xFFB00020), fontSize = 14.sp, modifier = Modifier.weight(1f))
                        IconButton(onClick = { viewModel.clearError() }) {
                            Icon(Icons.Default.Close, "关闭", tint = Color(0xFFB00020))
                        }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            // 店名 必填
            OutlinedTextField(
                value = storeName,
                onValueChange = { storeName = it },
                label = { Text("店名", color = TitleDark) },
                supportingText = { Text("必填", color = TextSecondary, fontSize = 11.sp) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                maxLines = 1
            )
            Spacer(modifier = Modifier.height(12.dp))

            // 地区选择：搜索 + 三级联动
            Text("省 / 市 / 区", color = TitleDark, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text("必填 - 可搜索省份或城市快速选择", fontSize = 11.sp, color = TextSecondary)
            Spacer(modifier = Modifier.height(6.dp))
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = Color(0xFFF8F8F8),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE0E0E0))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Search, null, tint = Color.Gray, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    BasicTextField(
                        value = uiState.locationSearchQuery,
                        onValueChange = { viewModel.setLocationSearchQuery(it) },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 15.sp),
                        decorationBox = { inner ->
                            if (uiState.locationSearchQuery.isBlank()) {
                                Text(
                                    "搜索省份、城市、区县",
                                    fontSize = 15.sp,
                                    color = Color.Gray.copy(alpha = 0.8f)
                                )
                            }
                            inner()
                        }
                    )
                    if (uiState.locationSearchQuery.isNotBlank()) {
                        IconButton(
                            onClick = { viewModel.setLocationSearchQuery("") },
                            modifier = Modifier.size(28.dp)
                        ) {
                            Icon(Icons.Default.Close, "清空", tint = Color.Gray, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
            if (uiState.locationSearchQuery.isNotBlank()) {
                val matches = viewModel.getSearchResults()
                Spacer(modifier = Modifier.height(6.dp))
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    color = Color(0xFFFAFAFA),
                    tonalElevation = 1.dp
                ) {
                    if (matches.isEmpty()) {
                        Text(
                            "暂无匹配，请尝试其他关键词",
                            modifier = Modifier.padding(16.dp),
                            fontSize = 14.sp,
                            color = Color.Gray
                        )
                    } else {
                        Column(modifier = Modifier.padding(vertical = 4.dp)) {
                            matches.take(12).forEach { m ->
                                Text(
                                    text = m.displayText(),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            viewModel.selectProvince(m.province)
                                            m.city?.let { viewModel.selectCity(it) }
                                            m.district?.let { viewModel.selectDistrict(it) }
                                            viewModel.setLocationSearchQuery("")
                                        }
                                        .padding(horizontal = 16.dp, vertical = 12.dp),
                                    fontSize = 15.sp,
                                    color = Color(0xFF333333)
                                )
                            }
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(12.dp))

            if (uiState.isLoading) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp))
            } else {
                Text("省份", fontSize = 12.sp, color = Color.Gray)
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(uiState.provinces) { p ->
                        FilterChip(
                            selected = uiState.selectedProvince == p,
                            onClick = { viewModel.selectProvince(p) },
                            label = { Text(p, fontSize = 13.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TitleDark,
                                selectedLabelColor = Color.White,
                                containerColor = SurfaceDark
                            )
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))

                if (uiState.selectedProvince != null) {
                    val cities = uiState.regionsData[uiState.selectedProvince]?.cities ?: emptyList()
                    Text("城市", fontSize = 12.sp, color = Color.Gray)
                    LazyRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(cities) { c ->
                            FilterChip(
                                selected = uiState.selectedCity == c,
                                onClick = { viewModel.selectCity(c) },
                                label = { Text(c, fontSize = 13.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = TitleDark,
                                    selectedLabelColor = Color.White,
                                    containerColor = SurfaceDark
                                )
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))

                    if (uiState.selectedCity != null) {
                        val districts = uiState.regionsData[uiState.selectedProvince]?.districts?.get(uiState.selectedCity) ?: emptyList()
                        Text("区县", fontSize = 12.sp, color = Color.Gray)
                        LazyRow(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(districts) { d ->
                                FilterChip(
                                    selected = uiState.selectedDistrict == d,
                                    onClick = { viewModel.selectDistrict(d) },
                                    label = { Text(d, fontSize = 13.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = TitleDark,
                                        selectedLabelColor = Color.White,
                                        containerColor = SurfaceDark
                                    )
                                )
                            }
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(12.dp))

            // 详细地址 必填
            OutlinedTextField(
                value = address,
                onValueChange = { address = it },
                label = { Text("详细地址", color = TitleDark) },
                supportingText = { Text("必填", color = TextSecondary, fontSize = 11.sp) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                maxLines = 4
            )
            Spacer(modifier = Modifier.height(12.dp))

            // 分类选择 必填 - 后端真实分类 + 自定义
            Text("分类", color = TitleDark, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text("必填 - 选择或自定义店铺类型", fontSize = 11.sp, color = TextSecondary)
            Spacer(modifier = Modifier.height(6.dp))
            val displayCategories = uiState.categories + CUSTOM_CATEGORY_LABEL
            if (displayCategories.isNotEmpty()) {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(displayCategories) { cat ->
                        FilterChip(
                            selected = if (cat == CUSTOM_CATEGORY_LABEL) isCustomCategory else (selectedCategory == cat && !isCustomCategory),
                            onClick = {
                                if (cat == CUSTOM_CATEGORY_LABEL) {
                                    isCustomCategory = true
                                    selectedCategory = null
                                } else {
                                    isCustomCategory = false
                                    customCategoryText = ""
                                    selectedCategory = if (selectedCategory == cat) null else cat
                                }
                            },
                            label = { Text(cat, fontSize = 13.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TitleDark,
                                selectedLabelColor = Color.White,
                                containerColor = SurfaceDark
                            )
                        )
                    }
                }
            } else {
                Text("加载分类中…", fontSize = 14.sp, color = Color.Gray)
            }
            if (isCustomCategory) {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = customCategoryText,
                    onValueChange = { customCategoryText = it },
                    label = { Text("请输入自定义分类") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    maxLines = 1
                )
            }
            Spacer(modifier = Modifier.height(12.dp))

            // 以下为选填
            OutlinedTextField(
                value = businessHours,
                onValueChange = { businessHours = it },
                label = { Text("营业时间") },
                supportingText = { Text("选填", color = Color.Gray, fontSize = 11.sp) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = price,
                onValueChange = { price = it },
                label = { Text("价格") },
                supportingText = { Text("选填", color = Color.Gray, fontSize = 11.sp) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
            )
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("描述") },
                supportingText = { Text("选填", color = Color.Gray, fontSize = 11.sp) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 6
            )
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = contact,
                onValueChange = { contact = it },
                label = { Text("联系方式（手机/微信等）") },
                supportingText = { Text("选填", color = Color.Gray, fontSize = 11.sp) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(16.dp))

            Text("图片", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface)
            Text("选填，最多3张", fontSize = 11.sp, color = Color.Gray)
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                uiState.uploadedImagePaths.forEachIndexed { index, path ->
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .border(1.dp, Color.LightGray, RoundedCornerShape(8.dp))
                    ) {
                        NetworkImage(
                            url = ApiConfig.getFullImageUrl(path),
                            contentDescription = "已上传",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                        IconButton(
                            onClick = { viewModel.removeUploadedImage(index) },
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .size(24.dp)
                        ) {
                            Icon(Icons.Default.Close, "删除", tint = Color.White, modifier = Modifier.background(Color.Black.copy(alpha = 0.6f)))
                        }
                    }
                }
                if (uiState.uploadedImagePaths.size < 3) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .border(1.dp, Color.LightGray, RoundedCornerShape(8.dp))
                            .clickable(enabled = !uiState.isImageUploading) {
                                // 优先直接打开选择器（GetContent 在多数设备上无需权限即可使用）
                                imagePickerLauncher.launch("image/*")
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        if (uiState.isImageUploading) {
                            CircularProgressIndicator(modifier = Modifier.size(32.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Default.Add, "添加图片", tint = Color.Gray)
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = {
                    if (storeName.isBlank()) {
                        Toast.makeText(context, "请填写店名", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    if (province.isBlank()) {
                        Toast.makeText(context, "请选择省份", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    if (city.isBlank()) {
                        Toast.makeText(context, "请选择城市", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    if (district.isBlank()) {
                        Toast.makeText(context, "请选择区县", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    if (address.isBlank()) {
                        Toast.makeText(context, "请填写详细地址", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    val categoryValue = when {
                        isCustomCategory -> customCategoryText.trim()
                        else -> selectedCategory
                    }
                    if (categoryValue.isNullOrBlank()) {
                        Toast.makeText(context, "请选择或填写分类", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    viewModel.submit(
                        storeName = storeName,
                        province = province,
                        city = city,
                        district = district,
                        address = address,
                        category = categoryValue,
                        businessHours = businessHours.takeIf { it.isNotBlank() },
                        price = price.takeIf { it.isNotBlank() },
                        description = description.takeIf { it.isNotBlank() },
                        contact = contact.takeIf { it.isNotBlank() },
                        onSuccess = {
                            Toast.makeText(context, "投稿成功，请等待审核", Toast.LENGTH_LONG).show()
                            navController.popBackStack()
                        },
                        onError = { err -> Toast.makeText(context, err, Toast.LENGTH_SHORT).show() }
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                enabled = !uiState.isSubmitting,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A1A1A)),
                shape = RoundedCornerShape(26.dp)
            ) {
                if (uiState.isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("提交投稿", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
