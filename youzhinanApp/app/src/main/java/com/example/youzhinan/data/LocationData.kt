package com.example.youzhinan.data

/**
 * 省份（搜索页用，数据从 getInfoList 解析）
 */
data class Province(
    val name: String,
    val cities: List<City>
)

/**
 * 城市（搜索页用，数据从 getInfoList 解析）
 */
data class City(
    val name: String,
    val category: String = ""
)
