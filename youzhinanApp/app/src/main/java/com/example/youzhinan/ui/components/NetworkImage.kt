package com.example.youzhinan.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Icon
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter.State
import coil.request.ImageRequest

@Composable
fun NetworkImage(
    url: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop
) {
    if (url.isNullOrBlank()) {
        Box(
            modifier = modifier.background(Color(0xFFEEEEEE)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Image,
                contentDescription = contentDescription,
                tint = Color.Gray,
                modifier = Modifier.size(32.dp)
            )
        }
        return
    }

    var isLoading by remember { mutableStateOf(true) }

    Box(modifier = modifier) {
        if (isLoading) {
            SkeletonLoader()
        }
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(url)
                .crossfade(200)
                .memoryCacheKey(url)
                .diskCacheKey(url)
                .size(600)
                .build(),
            contentDescription = contentDescription,
            modifier = Modifier.fillMaxSize(),
            contentScale = contentScale,
            placeholder = ColorPainter(Color.Transparent),
            error = ColorPainter(Color(0xFFEEEEEE)),
            onLoading = { isLoading = true },
            onSuccess = { isLoading = false },
            onError = { isLoading = false }
        )
    }
}

@Composable
fun SkeletonLoader() {
    val shimmerColors = listOf(
        Color(0xFFEEEEEE).copy(alpha = 0.3f),
        Color(0xFFEEEEEE).copy(alpha = 0.7f),
        Color(0xFFEEEEEE).copy(alpha = 0.3f)
    )
    val transition = rememberInfiniteTransition(label = "skeleton")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "shimmer"
    )
    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset.Zero,
        end = Offset(x = translateAnim, y = translateAnim)
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(brush)
    )
}
