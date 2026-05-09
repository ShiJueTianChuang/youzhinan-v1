package com.example.youzhinan.ui.pages

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.youzhinan.ui.components.NetworkImage
import com.example.youzhinan.data.City
import com.example.youzhinan.data.Province
import com.example.youzhinan.data.api.ApiConfig
import com.example.youzhinan.data.api.InfoDto
import com.example.youzhinan.ui.theme.*
import com.example.youzhinan.ui.viewmodel.SearchViewModel
import com.example.youzhinan.utils.LocationHelper
import com.example.youzhinan.utils.formatDistance
import android.Manifest
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import kotlinx.coroutines.withTimeoutOrNull

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun SearchPage(
    navController: androidx.navigation.NavHostController,
    paddingValues: PaddingValues = PaddingValues(0.dp)
) {
    val viewModel: SearchViewModel = viewModel()
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        try {
            viewModel.loadInfosAndExtractLocations()
        } catch (e: Exception) {
            android.util.Log.e("SearchPage", "加载数据失败", e)
        }
    }

    val context = LocalContext.current
    var currentLocation by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    val locationPermissionState = rememberPermissionState(Manifest.permission.ACCESS_FINE_LOCATION)
    var locationPermissionRequested by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (!LocationHelper.hasLocationPermission(context) && !locationPermissionRequested) {
            locationPermissionRequested = true
            locationPermissionState.launchPermissionRequest()
        }
        if (LocationHelper.hasLocationPermission(context)) {
            try {
                val location = withTimeoutOrNull(8000L) {
                    LocationHelper.getCurrentLocation(context)
                }
                currentLocation = location
            } catch (_: Exception) {
                currentLocation = null
            }
        }
    }

    LaunchedEffect(locationPermissionState.status.isGranted) {
        if (locationPermissionState.status.isGranted && currentLocation == null) {
            try {
                val location = withTimeoutOrNull(8000L) {
                    LocationHelper.getCurrentLocation(context)
                }
                currentLocation = location
            } catch (_: Exception) {
                currentLocation = null
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8F9FC))
    ) {
        Spacer(modifier = Modifier.statusBarsPadding().height(4.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                modifier = Modifier
                    .weight(1f)
                    .height(40.dp),
                color = Color.White,
                shape = RoundedCornerShape(10.dp),
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "搜索",
                        tint = Color(0xFF6C63FF),
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    BasicTextField(
                        value = uiState.searchText ?: "",
                        onValueChange = { newText ->
                            viewModel.searchLocations(newText)
                        },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        textStyle = MaterialTheme.typography.bodyMedium.copy(
                            fontSize = 14.sp,
                            color = Color(0xFF1A1A2E),
                            fontWeight = FontWeight.Normal
                        ),
                        decorationBox = { innerTextField ->
                            if (uiState.searchText.isNullOrBlank()) {
                                Text(
                                    text = "搜索省份、城市、关键词…",
                                    style = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                                    color = Color(0xFFBBBBBB),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            innerTextField()
                        }
                    )
                    if (!uiState.searchText.isNullOrBlank()) {
                        Spacer(modifier = Modifier.width(4.dp))
                        IconButton(
                            onClick = { viewModel.searchLocations("") },
                            modifier = Modifier.size(20.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "清空",
                                tint = Color(0xFF6C63FF),
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                }
            }

            Surface(
                modifier = Modifier
                    .height(40.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .clickable { navController.navigate("submit") },
                color = Color(0xFF6C63FF),
                shape = RoundedCornerShape(10.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxHeight()
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "投稿",
                        tint = Color.White,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "投稿",
                        color = Color.White,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1
                    )
                }
            }
        }

        if (!uiState.searchText.isNullOrBlank() && uiState.infoList.isNotEmpty()) {
            val searchKeyword = uiState.searchText!!
            val filteredInfos = uiState.infoList.filter { info: InfoDto ->
                (info.province?.contains(searchKeyword, ignoreCase = true) == true) ||
                (info.city?.contains(searchKeyword, ignoreCase = true) == true) ||
                (info.storeName?.contains(searchKeyword, ignoreCase = true) == true) ||
                (info.title?.contains(searchKeyword, ignoreCase = true) == true) ||
                (info.description?.contains(searchKeyword, ignoreCase = true) == true) ||
                (info.content?.contains(searchKeyword, ignoreCase = true) == true) ||
                (info.address?.contains(searchKeyword, ignoreCase = true) == true) ||
                (info.businessHours?.contains(searchKeyword, ignoreCase = true) == true)
            }

            if (filteredInfos.isNotEmpty()) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentPadding = PaddingValues(
                        start = 16.dp,
                        end = 16.dp,
                        top = 12.dp,
                        bottom = paddingValues.calculateBottomPadding() + 8.dp)
                ) {
                    items(
                        items = filteredInfos,
                        key = { it.id }
                    ) { info: InfoDto ->
                        InfoItemCompact(info = info, onClick = {
                            navController.navigate("detail/${info.id}")
                        }, currentLocation = currentLocation)
                    }
                }
            } else {
                EmptyStateHint(
                    text = "暂无相关消息",
                    icon = Icons.Default.SearchOff
                )
            }
        } else {
            val filteredInfos = remember(uiState.selectedCity, uiState.selectedCategory) {
                if (uiState.selectedCity != null && uiState.selectedCategory != null) {
                    uiState.infoList.filter { info: InfoDto ->
                        info.city == uiState.selectedCity!!.name &&
                        info.category == uiState.selectedCategory
                    }
                } else {
                    emptyList()
                }
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentPadding = PaddingValues(
                    start = 16.dp,
                    end = 16.dp,
                    bottom = paddingValues.calculateBottomPadding() + 8.dp)
            ) {
                item {
                    if (uiState.isLoading) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 48.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(32.dp),
                                    color = Color(0xFF6C63FF),
                                    strokeWidth = 2.5.dp
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = "加载中...",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF6C63FF),
                                    fontSize = 13.sp
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(24.dp))
                    }
                }

                item {
                    if (uiState.error != null) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = ErrorBackground),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp)
                            ) {
                                Text(
                                    text = "加载失败",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = ErrorRed,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = uiState.error ?: "",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = ErrorRed
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Button(
                                    onClick = {
                                        viewModel.loadInfosAndExtractLocations()
                                    },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = Color(0xFF6C63FF),
                                        contentColor = Color.White
                                    ),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("重试")
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                    }
                }

                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            tint = Color(0xFF6C63FF),
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "省份",
                            fontSize = 13.sp,
                            color = Color(0xFF6C63FF),
                            fontWeight = FontWeight.Medium
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                }

                item {
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(
                            items = uiState.provinces,
                            key = { it.name }
                        ) { province ->
                            val isSelected = uiState.selectedProvince?.name == province.name
                            Surface(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable {
                                        viewModel.selectProvince(province)
                                    },
                                color = if (isSelected) Color(0xFF6C63FF) else Color(0xFFF5F5FA),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    province.name,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) Color.White else Color(0xFF4A4A6A),
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }

                if (uiState.selectedProvince != null && uiState.cities.isNotEmpty()) {
                    item {
                        Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Home,
                            contentDescription = null,
                            tint = Color(0xFF6C63FF),
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "城市",
                            fontSize = 13.sp,
                            color = Color(0xFF6C63FF),
                            fontWeight = FontWeight.Medium
                        )
                    }
                        Spacer(modifier = Modifier.height(6.dp))
                    }

                    item {
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            items(
                                items = uiState.cities,
                                key = { it.name }
                            ) { city ->
                                val isSelected = uiState.selectedCity?.name == city.name
                                Surface(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .clickable {
                                            viewModel.selectCity(city)
                                        },
                                    color = if (isSelected) Color(0xFF6C63FF) else Color(0xFFF5F5FA),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        city.name,
                                        fontSize = 11.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isSelected) Color.White else Color(0xFF4A4A6A),
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                    }

                    if (uiState.selectedCity != null) {
                            item {
                                CityCategoriesSimple(
                                    city = uiState.selectedCity!!,
                                    allInfos = uiState.infoList,
                                    selectedCategory = uiState.selectedCategory,
                                    onCategorySelected = { categoryName: String ->
                                        viewModel.selectCategory(categoryName)
                                    }
                                )
                            }

                            if (uiState.selectedCategory != null) {
                                if (filteredInfos.isEmpty()) {
                                    item {
                                        EmptyStateHint(
                                            text = "该分类下暂无信息",
                                            icon = Icons.Default.Info
                                        )
                                    }
                                } else {
                                    items(
                                        items = filteredInfos,
                                        key = { it.id }
                                    ) { info: InfoDto ->
                                        InfoItemCompact(info = info, onClick = {
                                            navController.navigate("detail/${info.id}")
                                        }, currentLocation = currentLocation)
                                    }
                                }
                            } else {
                                item {
                                    EmptyStateHint(
                                        text = "请选择分类",
                                        icon = Icons.Default.Category
                                    )
                                }
                            }
                        } else {
                            item {
                                EmptyStateHint(
                                    text = "请选择城市",
                                    icon = Icons.Default.LocationCity
                                )
                            }
                        }
                } else {
                        item {
                            EmptyStateHint(
                                text = "请选择省份",
                                icon = Icons.Default.LocationOn
                            )
                        }
                    }
            }
        }
    }
}

@Composable
fun CityCategoriesSimple(city: City, allInfos: List<InfoDto>, selectedCategory: String?, onCategorySelected: (String) -> Unit) {
    val cityInfos = allInfos.filter { info: InfoDto ->
        info.city == city.name
    }

    val groupedByCategory = cityInfos.groupBy { info: InfoDto -> info.category ?: "其他" }
    val categoriesList = groupedByCategory.toList()

    Column(
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = "分类",
            fontSize = 13.sp,
            color = Color(0xFF6C63FF),
            fontWeight = FontWeight.Medium
        )
        Spacer(modifier = Modifier.height(4.dp))

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(
                items = categoriesList,
                key = { it.first }
            ) { pair ->
                val (category, infos) = pair
                val isSelected = selectedCategory == category
                Surface(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { onCategorySelected(category) },
                    color = if (isSelected) Color(0xFF6C63FF) else Color(0xFFF5F5FA),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        "$category (${infos.size})",
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = if (isSelected) Color.White else Color(0xFF4A4A6A),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
    }
}

@Composable
fun InfoItemCompact(info: InfoDto, onClick: () -> Unit = {}, currentLocation: Pair<Double, Double>? = null) {
    val displayName = info.storeName ?: info.title ?: "无标题"
    val imageUrl = ApiConfig.getFullImageUrl(info.images?.firstOrNull() ?: info.imageUrl)

    val fullAddress = buildString {
        if (!info.province.isNullOrBlank()) append(info.province)
        if (!info.city.isNullOrBlank()) append(" ${info.city}")
        if (!info.district.isNullOrBlank()) append(" ${info.district}")
        if (!info.address.isNullOrBlank()) append(" ${info.address}")
    }.trim()

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (!imageUrl.isNullOrBlank()) {
                NetworkImage(
                    url = imageUrl,
                    contentDescription = displayName,
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFF5F5FA)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Image,
                        contentDescription = "无图片",
                        tint = Color(0xFF9999AA),
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(10.dp))

            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = displayName,
                    fontSize = 14.sp,
                    color = Color(0xFF1A1A2E),
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                if (!info.category.isNullOrBlank()) {
                    Surface(
                        color = Color(0xFFF5F5FA),
                        shape = RoundedCornerShape(4.dp),
                        modifier = Modifier
                    ) {
                        Text(
                            text = info.category!!,
                            fontSize = 10.sp,
                            color = Color(0xFF6C63FF),
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp),
                            maxLines = 1
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                }

                if (fullAddress.isNotBlank() || (info.latitude != null && info.longitude != null && currentLocation != null)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = null,
                            modifier = Modifier.size(12.dp),
                            tint = Color(0xFF9999AA)
                        )
                        if (fullAddress.isNotBlank()) {
                            Text(
                                text = fullAddress,
                                fontSize = 11.sp,
                                color = Color(0xFF8888AA),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false)
                            )
                        }
                        if (info.latitude != null && info.longitude != null && currentLocation != null) {
                            val distMeters = LocationHelper.distanceMeters(
                                currentLocation.first,
                                currentLocation.second,
                                info.latitude,
                                info.longitude
                            ).toDouble()
                            Text(
                                text = formatDistance(distMeters),
                                fontSize = 11.sp,
                                color = Color(0xFF8888AA)
                            )
                        }
                    }
                }
            }
        }
    }

    HorizontalDivider(
        color = Color(0xFFE8E8F0),
        thickness = 1.dp,
        modifier = Modifier.padding(vertical = 4.dp)
    )
}

@Composable
fun EmptyStateHint(text: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 64.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xFFF5F5FA))
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = Color(0xFF6C63FF),
                    modifier = Modifier
                        .size(36.dp)
                        .align(Alignment.Center)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = text,
                color = Color(0xFF4A4A6A),
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
