package com.example.youzhinan

import android.app.Application
import android.util.Log
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import com.example.youzhinan.data.api.RetrofitClient

class YouyoubanApplication : Application(), ImageLoaderFactory {

    override fun onCreate() {
        super.onCreate()
        RetrofitClient.init(this)
        Log.d("YouyoubanApplication", "应用启动成功")
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.3)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(512L * 1024 * 1024)
                    .build()
            }
            .crossfade(200)
            .respectCacheHeaders(false)
            .build()
    }
}
