package com.example.youzhinan.utils

import java.util.Locale

/**
 * 将米为单位的距离格式化为以公里为单位显示的字符串（保留一位小数），例如 "距离0.5km"。
 */
fun formatDistance(distanceMeters: Double): String {
    val km = distanceMeters / 1000.0
    val distText = if (km < 0.1) {
        "<0.1km"
    } else {
        String.format(Locale.getDefault(), "%.1fkm", km)
    }
    return "距离$distText"
}
