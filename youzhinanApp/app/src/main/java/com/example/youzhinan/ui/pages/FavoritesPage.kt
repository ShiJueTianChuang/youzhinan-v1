package com.example.youzhinan.ui.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.example.youzhinan.data.api.InfoDto
import com.example.youzhinan.ui.pages.InfoItemCompact
import com.example.youzhinan.utils.FavoritesManager
import com.example.youzhinan.ui.pages.isAgreementAccepted
import com.example.youzhinan.PrivacyAgreementDialog

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FavoritesPage(navController: NavHostController) {
    val context = LocalContext.current
    var favorites by remember { mutableStateOf<List<InfoDto>>(emptyList()) }
    var showAgreementDialog by remember { mutableStateOf(!isAgreementAccepted(context)) }
    
    LaunchedEffect(Unit) {
        favorites = FavoritesManager.getFavorites(context)
    }
    
    // 如果用户未同意协议，显示协议弹窗
    if (showAgreementDialog) {
        PrivacyAgreementDialog(
            onAgree = {
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
    
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { 
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "我的收藏",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = "收藏",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = Color(0xFF1A1A1A)
                )
            )
        }
    ) { innerPadding ->
        if (favorites.isEmpty()) {
            Box(
                modifier = Modifier
                    .padding(innerPadding)
                    .fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .background(Color(0xFFF5F5F5), androidx.compose.foundation.shape.CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Favorite,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp),
                            tint = Color.Black
                        )
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "暂无收藏",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.Black
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "快去收藏喜欢的信息吧",
                        fontSize = 14.sp,
                        color = Color(0xFF999999),
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .padding(innerPadding)
                    .fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(16.dp)
            ) {
                items(
                    items = favorites,
                    key = { it.id }
                ) { info ->
                    FavoriteItem(
                        info = info,
                        onClick = {
                            navController.navigate("detail/${info.id}")
                        },
                        onRemove = {
                            FavoritesManager.removeFavorite(context, info.id)
                            favorites = FavoritesManager.getFavorites(context)
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun FavoriteItem(
    info: InfoDto,
    onClick: () -> Unit,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color.White
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.weight(1f)
            ) {
                InfoItemCompact(info = info, onClick = onClick)
            }
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(
                onClick = onRemove,
                modifier = Modifier.size(40.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "取消收藏",
                    tint = Color(0xFFFF5252),
                    modifier = Modifier.size(24.dp)
                )
            }
        }
    }
}
