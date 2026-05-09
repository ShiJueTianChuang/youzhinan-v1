package com.example.youzhinan.utils

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * 定位服务工具类
 * 用于获取用户当前位置
 */
object LocationHelper {

    /**
     * 检查是否有定位权限
     */
    fun hasLocationPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * 检查 GPS 是否启用
     */
    fun isGpsEnabled(context: Context): Boolean {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
               locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }

    /**
     * 获取当前位置（一次性，带15秒超时）
     * @return Pair(latitude, longitude)
     */
    suspend fun getCurrentLocation(context: Context): Pair<Double, Double> {
        return kotlinx.coroutines.withTimeoutOrNull(15000L) {
            getCurrentLocationInternal(context)
        } ?: throw Exception("获取位置超时")
    }

    private suspend fun getCurrentLocationInternal(context: Context): Pair<Double, Double> {
        return suspendCancellableCoroutine { continuation ->
            if (!hasLocationPermission(context)) {
                continuation.resumeWithException(Exception("没有定位权限"))
                return@suspendCancellableCoroutine
            }

            val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

            try {
                fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                    if (location != null) {
                        if (continuation.isActive) {
                            continuation.resume(Pair(location.latitude, location.longitude))
                        }
                    } else {
                        // 如果 lastLocation 为 null，尝试请求更新
                        requestFreshLocation(context, fusedLocationClient, continuation)
                    }
                }.addOnFailureListener { e ->
                    if (continuation.isActive) {
                        continuation.resumeWithException(Exception("获取位置失败：${e.message}"))
                    }
                }
            } catch (e: SecurityException) {
                if (continuation.isActive) {
                    continuation.resumeWithException(Exception("没有定位权限"))
                }
            }
        }
    }

    private fun requestFreshLocation(
        context: Context,
        fusedLocationClient: FusedLocationProviderClient,
        continuation: kotlinx.coroutines.CancellableContinuation<Pair<Double, Double>>
    ) {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            10000
        ).build()

        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    if (continuation.isActive) {
                        continuation.resume(Pair(location.latitude, location.longitude))
                        fusedLocationClient.removeLocationUpdates(this)
                    }
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            if (continuation.isActive) {
                continuation.resumeWithException(Exception("没有定位权限"))
            }
        }

        continuation.invokeOnCancellation {
            try {
                fusedLocationClient.removeLocationUpdates(locationCallback)
            } catch (e: Exception) {
                // 忽略
            }
        }
    }

    /**
     * 计算两点间距离（米）
     */
    fun distanceMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Float {
        val results = FloatArray(1)
        try {
            android.location.Location.distanceBetween(lat1, lon1, lat2, lon2, results)
            return results[0]
        } catch (e: Exception) {
            return 0f
        }
    }
}
