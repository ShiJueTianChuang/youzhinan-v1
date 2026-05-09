package com.example.youzhinan.ui.pages

import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.example.youzhinan.ui.components.NetworkImage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocalImagePage(navController: NavHostController, encodedPath: String?) {
    val path = encodedPath?.let { Uri.decode(it) }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(text = "图片预览") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(imageVector = Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    ) { innerPadding ->
        if (path.isNullOrBlank()) {
            Box(modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("未指定图片路径")
            }
            return@Scaffold
        }

        Box(modifier = Modifier
            .padding(innerPadding)
            .fillMaxSize(), contentAlignment = Alignment.TopCenter) {
            NetworkImage(
                url = "file://$path",
                contentDescription = "本地图片",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                contentScale = ContentScale.Fit
            )
        }
    }
}
