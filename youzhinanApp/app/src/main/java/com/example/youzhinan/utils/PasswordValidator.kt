package com.example.youzhinan.utils

/**
 * 密码校验规则，与后端 validatePasswordComplexity 保持一致
 * 后端要求：至少 8 位，包含小写、大写、数字、特殊字符
 */
object PasswordValidator {

    /** 密码长度至少 8 位 */
    const val MIN_LENGTH = 8

    /** 密码长度最多 20 位 */
    const val MAX_LENGTH = 20

    /**
     * 是否符合后端密码规则
     */
    fun isValid(password: String): Boolean {
        if (password.length < MIN_LENGTH) return false
        if (password.length > MAX_LENGTH) return false
        if (!password.any { it.isLowerCase() }) return false
        if (!password.any { it.isUpperCase() }) return false
        if (!password.any { it.isDigit() }) return false
        if (!password.any { it in SPECIAL_CHARS }) return false
        return true
    }

    /**
     * 获取当前密码的提示语（用于输入框下方提示）
     */
    fun getTip(password: String): String {
        if (password.isEmpty()) return "密码需 8–20 位，含大小写字母、数字、特殊字符"
        if (password.length < MIN_LENGTH) return "密码至少 8 位"
        if (password.length > MAX_LENGTH) return "密码不能超过 20 位"
        if (!password.any { it.isLowerCase() }) return "需包含小写字母"
        if (!password.any { it.isUpperCase() }) return "需包含大写字母"
        if (!password.any { it.isDigit() }) return "需包含数字"
        if (!password.any { it in SPECIAL_CHARS }) return "需包含特殊字符 (!@#\$%^&* 等)"
        return "密码强度：合格"
    }

    private val SPECIAL_CHARS = "!@#$%^&*(),.?\":{}|<>".toSet()
}
