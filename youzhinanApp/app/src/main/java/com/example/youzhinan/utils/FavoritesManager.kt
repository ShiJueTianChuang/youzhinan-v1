package com.example.youzhinan.utils

import android.content.Context
import android.content.SharedPreferences
import com.example.youzhinan.data.api.InfoDto
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

object FavoritesManager {
    private const val PREFS_NAME = "FavoritesPrefs"
    
    private val gson = Gson()
    
    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
    
    private fun getUserId(context: Context): Int {
        val prefs = context.getSharedPreferences("UserInfo", Context.MODE_PRIVATE)
        return prefs.getInt("userId", 0)
    }
    
    private fun getFavoritesKey(context: Context): String {
        val userId = getUserId(context)
        return if (userId > 0) "user_${userId}_favorites" else "favorites"
    }
    
    fun getFavorites(context: Context): List<InfoDto> {
        val prefs = getPrefs(context)
        val json = prefs.getString(getFavoritesKey(context), null) ?: return emptyList()
        val type = object : TypeToken<List<InfoDto>>() {}.type
        return gson.fromJson(json, type) ?: emptyList()
    }
    
    fun isFavorite(context: Context, infoId: Int): Boolean {
        return getFavorites(context).any { it.id == infoId }
    }
    
    fun addFavorite(context: Context, info: InfoDto): Boolean {
        val favorites = getFavorites(context).toMutableList()
        if (favorites.any { it.id == info.id }) {
            return false
        }
        favorites.add(0, info)
        saveFavorites(context, favorites)
        return true
    }
    
    fun removeFavorite(context: Context, infoId: Int): Boolean {
        val favorites = getFavorites(context).toMutableList()
        val removed = favorites.removeAll { it.id == infoId }
        if (removed) {
            saveFavorites(context, favorites)
        }
        return removed
    }
    
    fun toggleFavorite(context: Context, info: InfoDto): Boolean {
        return if (isFavorite(context, info.id)) {
            removeFavorite(context, info.id)
            false
        } else {
            addFavorite(context, info)
            true
        }
    }
    
    private fun saveFavorites(context: Context, favorites: List<InfoDto>) {
        val prefs = getPrefs(context)
        val json = gson.toJson(favorites)
        prefs.edit().putString(getFavoritesKey(context), json).apply()
    }
}
