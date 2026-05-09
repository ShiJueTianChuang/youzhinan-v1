package com.example.youzhinan.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.youzhinan.utils.FrameRateMonitor

@Composable
fun PerformanceOverlay(
    modifier: Modifier = Modifier,
    showOverlay: Boolean = true
) {
    if (!showOverlay) return

    val fps by FrameRateMonitor.fpsState.collectAsState()
    val frameTime by FrameRateMonitor.frameTimeState.collectAsState()
    val jankCount by FrameRateMonitor.jankCountState.collectAsState()

    val fpsColor = when {
        fps >= 55f -> Color.Green
        fps >= 45f -> Color.Yellow
        else -> Color.Red
    }

    Column(
        modifier = modifier
            .background(
                color = Color.Black.copy(alpha = 0.7f),
                shape = RoundedCornerShape(8.dp)
            )
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = "FPS: %.1f".format(fps),
            color = fpsColor,
            fontSize = 14.sp
        )
        Text(
            text = "Frame: ${frameTime}ms",
            color = Color.White,
            fontSize = 12.sp
        )
        Text(
            text = "Janks: $jankCount",
            color = if (jankCount > 0) Color.Red else Color.Green,
            fontSize = 12.sp
        )
    }
}
