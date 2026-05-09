package com.example.youzhinan.ui.pages

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * 登录/注册页面的协议勾选组件
 * 供 PasswordLoginPage、EmailAuthPage、SmsLoginPage、SmsRegisterPage 复用
 *
 * 布局规范（大厂通用标准）：
 * - 放在登录表单最下方，按钮之上
 * - 文字居中对齐
 * - 协议文字用主色高亮 + 下划线，明显可点
 * - 前面有小勾选框（注册必选，登录可选）
 * - 淡色卡片包裹，视觉层次分明
 */
@Composable
fun AgreementCheckbox(
    agreed: Boolean,
    onAgreedChange: (Boolean) -> Unit,
    onViewAgreement: () -> Unit,
    onViewPrivacy: () -> Unit
) {
    val primaryColor = Color(0xFF1A73E8)
    val normalColor = Color(0xFF666666)
    val lightBg = Color(0xFFF5F8FF)
    val borderColor = Color(0xFFD0E1FF)

    val agreementTag = "agreement"
    val privacyTag = "privacy"

    // 简洁版：单行居中勾选 + 协议文字（用于登录/注册表单内嵌）
    val annotatedString = buildAnnotatedString {
        append("我已阅读并同意")

        pushStringAnnotation(tag = agreementTag, annotation = agreementTag)
        withStyle(SpanStyle(
            color = primaryColor,
            fontWeight = FontWeight.Medium,
            textDecoration = TextDecoration.Underline
        )) {
            append("【用户协议】")
        }
        pop()

        append("和")

        pushStringAnnotation(tag = privacyTag, annotation = privacyTag)
        withStyle(SpanStyle(
            color = primaryColor,
            fontWeight = FontWeight.Medium,
            textDecoration = TextDecoration.Underline
        )) {
            append("【隐私政策】")
        }
        pop()
    }

    // 淡色卡片包裹，提升视觉层次
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (agreed) lightBg else Color(0xFFFFF8F0)
        ),
        border = BorderStroke(
            1.dp,
            if (agreed) borderColor else Color(0xFFFFDDB0)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // 勾选行
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth()
            ) {
                Checkbox(
                    checked = agreed,
                    onCheckedChange = onAgreedChange,
                    colors = CheckboxDefaults.colors(
                        checkedColor = primaryColor,
                        uncheckedColor = Color(0xFFBBBBBB)
                    ),
                    modifier = Modifier.size(20.dp)
                )
                ClickableText(
                    text = annotatedString,
                    onClick = { offset ->
                        annotatedString.getStringAnnotations(
                            tag = agreementTag, start = offset, end = offset
                        ).firstOrNull()?.let {
                            onViewAgreement()
                            return@ClickableText
                        }
                        annotatedString.getStringAnnotations(
                            tag = privacyTag, start = offset, end = offset
                        ).firstOrNull()?.let {
                            onViewPrivacy()
                            return@ClickableText
                        }
                        // 点击非协议区域时切换勾选状态
                        onAgreedChange(!agreed)
                    },
                    style = TextStyle(fontSize = 12.sp, color = normalColor),
                    modifier = Modifier.padding(start = 2.dp)
                )
            }

            // 未勾选时的提示
            if (!agreed) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "请勾选同意后再进行操作",
                    fontSize = 10.sp,
                    color = Color(0xFFCC8844),
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

/**
 * 检查用户是否已同意协议（从 SharedPreferences）
 */
fun isAgreementAccepted(context: Context): Boolean {
    val prefs = context.getSharedPreferences("AppPrefs", Context.MODE_PRIVATE)
    return prefs.getBoolean("agreementAccepted", false)
}

/**
 * 获取当前协议同意状态，用于登录/注册请求
 */
@Suppress("UNUSED")
fun getAgreementAcceptedValue(context: Context): Boolean {
    return isAgreementAccepted(context)
}
