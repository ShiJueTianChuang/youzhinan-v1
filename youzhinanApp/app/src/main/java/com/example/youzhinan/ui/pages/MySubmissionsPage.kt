package com.example.youzhinan.ui.pages

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.example.youzhinan.data.api.ApiConfig
import com.example.youzhinan.data.api.SubmissionItem
import com.example.youzhinan.ui.components.NetworkImage
import com.example.youzhinan.ui.viewmodel.MySubmissionsViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MySubmissionsPage(
    navController: NavHostController,
    viewModel: MySubmissionsViewModel = run {
        val ctx = LocalContext.current.applicationContext
        viewModel(
            factory = object : ViewModelProvider.Factory {
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    @Suppress("UNCHECKED_CAST")
                    return MySubmissionsViewModel(ctx) as T
                }
            }
        )
    }
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadList()
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("我的投稿", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        Text("投稿列表", fontSize = 12.sp, color = Color.White.copy(alpha = 0.8f))
                    }
                },
                actions = {
                    IconButton(onClick = { navController.navigate("submit") }) {
                        Icon(Icons.Default.Add, "新建投稿", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFF1A1A1A),
                    titleContentColor = Color.White
                )
            )
        }
    ) { innerPadding ->
        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier
                        .padding(innerPadding)
                        .fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Color.Black)
                }
            }
            uiState.error != null -> {
                Box(
                    modifier = Modifier
                        .padding(innerPadding)
                        .fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(uiState.error!!, color = Color(0xFFB00020), fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { viewModel.loadList() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
                        ) {
                            Text("重试")
                        }
                    }
                }
            }
            uiState.list.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .padding(innerPadding)
                        .fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Add,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = Color.Gray
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("暂无投稿", fontSize = 18.sp, fontWeight = FontWeight.Medium, color = Color.Black)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("快去投稿吧", fontSize = 14.sp, color = Color.Gray, textAlign = TextAlign.Center)
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = { navController.navigate("submit") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1A1A1A)),
                            shape = RoundedCornerShape(24.dp)
                        ) {
                            Text("去投稿")
                        }
                    }
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .padding(innerPadding)
                        .fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(16.dp)
                ) {
                    items(uiState.list, key = { it.id }) { item ->
                        SubmissionListItem(
                            item = item,
                            onDelete = {
                                viewModel.deleteSubmission(
                                    item.id,
                                    onSuccess = { Toast.makeText(context, "删除成功", Toast.LENGTH_SHORT).show() },
                                    onError = { err -> Toast.makeText(context, err, Toast.LENGTH_SHORT).show() }
                                )
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun SubmissionListItem(
    item: SubmissionItem,
    onDelete: () -> Unit
) {
    val imageUrl = ApiConfig.getFullImageUrl(item.images?.firstOrNull())
    val statusText = when (item.status) {
        "pending" -> "待审核"
        "approved" -> "已通过"
        "rejected" -> "已拒绝"
        else -> item.status
    }
    val statusColor = when (item.status) {
        "pending" -> Color(0xFFF57C00)
        "approved" -> Color(0xFF388E3C)
        "rejected" -> Color(0xFFB00020)
        else -> Color.Gray
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE0E0E0))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (!imageUrl.isNullOrBlank()) {
                NetworkImage(
                    url = imageUrl,
                    contentDescription = item.storeName,
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop
                )
                Spacer(modifier = Modifier.width(16.dp))
            } else {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFFF5F5F5)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Image, null, tint = Color.Gray)
                }
                Spacer(modifier = Modifier.width(16.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    item.storeName,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "${item.province} ${item.city} ${item.district}",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
                Spacer(modifier = Modifier.height(4.dp))
                Surface(
                    color = statusColor.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(4.dp)
                ) {
                    Text(
                        statusText,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        fontSize = 12.sp,
                        color = statusColor,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            if (item.status == "pending") {
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.Delete, "删除", tint = Color(0xFFB00020))
                }
            }
        }
    }
}
