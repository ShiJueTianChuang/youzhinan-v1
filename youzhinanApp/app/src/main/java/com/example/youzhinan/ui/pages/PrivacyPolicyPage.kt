package com.example.youzhinan.ui.pages

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrivacyPolicyPage(navController: NavHostController) {
    val primaryColor = Color(0xFF1A73E8)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("隐私政策") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF2D2D2D),
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
        ) {
            // 头部标题卡片
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color(0xFFF5F8FF)
                ),
                border = BorderStroke(1.dp, Color(0xFFD0E1FF))
            ) {
                Column(
                    modifier = Modifier.padding(20.dp)
                ) {
                    Text(
                        text = "优医指南隐私政策",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1A1A1A)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "更新日期：2026年4月13日",
                        fontSize = 12.sp,
                        color = Color(0xFF999999)
                    )
                }
            }

            val sections = listOf(
                "一、我们收集的个人信息" to
                        "为了向您提供服务，我们会收集以下个人信息：\n\n" +
                        "1. 注册信息：邮箱地址、用户名、昵称；\n" +
                        "2. 身份认证信息：密码（加密存储）；\n" +
                        "3. 个人资料信息：头像、手机号（可选）；\n" +
                        "4. 位置信息：用于周边搜索功能，需获取精确定位权限（仅在使用该功能时获取）；\n" +
                        "5. 设备信息：设备型号、操作系统版本，用于兼容性适配；\n" +
                        "6. 日志信息：应用运行日志，用于问题排查。",
                "二、我们如何使用个人信息" to
                        "我们收集的个人信息将用于：\n\n" +
                        "1. 为您提供账号注册、登录及身份验证服务；\n" +
                        "2. 提供周边搜索等基于位置的功能；\n" +
                        "3. 展示和管理您的个人资料；\n" +
                        "4. 提供AI智能问答服务；\n" +
                        "5. 改善我们的产品和服务体验；\n" +
                        "6. 保障应用安全稳定运行。",
                "三、我们如何存储和保护个人信息" to
                        "1. 我们采用加密传输（HTTPS）保障数据传输安全；\n" +
                        "2. 您的密码采用加密方式存储，我们无法获取明文密码；\n" +
                        "3. 我们采取合理的技术措施保护您的个人信息安全；\n" +
                        "4. 我们的服务器位于中国大陆，数据存储在中国境内。",
                "四、我们如何共享个人信息" to
                        "我们不会将您的个人信息出售给任何第三方。仅在以下情况下共享：\n\n" +
                        "1. 获得您的明确同意后；\n" +
                        "2. 根据法律法规或政府主管部门的强制性要求；\n" +
                        "3. 与授权合作伙伴共享：为提供服务所必需，我们会委托合作伙伴处理相关信息，并要求其严格遵守保密义务。",
                "五、您的权利" to
                        "您对您的个人信息享有以下权利：\n\n" +
                        "1. 查询和更正您的个人信息；\n" +
                        "2. 删除您的个人信息；\n" +
                        "3. 撤回授权同意；\n" +
                        "4. 注销您的账号；\n" +
                        "5. 获取个人信息副本。",
                "六、未成年人保护" to
                        "我们高度重视对未成年人个人信息的保护。如果您是未满14周岁的未成年人，请在监护人的陪同和指导下使用本应用，并在监护人明确同意后向我们提供个人信息。",
                "七、隐私政策的更新" to
                        "我们可能会适时修订本隐私政策。当隐私政策条款发生变更时，我们会在应用内通过弹窗、公告等方式通知您。若您在隐私政策更新后继续使用本应用，即表示您充分理解并同意更新后的隐私政策。",
                "八、联系我们" to
                        "如您对本隐私政策有任何疑问、意见或建议，可通过以下方式与我们联系：\n\n" +
                        "邮箱：support@your-domain.com\n" +
                        "我们将在15个工作日内回复您的请求。"
            )

            // 正文内容卡片
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color.White
                ),
                elevation = CardDefaults.cardElevation(
                    defaultElevation = 2.dp
                )
            ) {
                Column(
                    modifier = Modifier.padding(20.dp)
                ) {
                    sections.forEachIndexed { index, (title, content) ->
                        // 章节标题
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(top = if (index > 0) 20.dp else 0.dp, bottom = 8.dp)
                        ) {
                            // 标题左侧竖线装饰
                            Box(
                                modifier = Modifier
                                    .background(primaryColor, RoundedCornerShape(2.dp))
                                    .size(width = 3.dp, height = 16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = title,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFF1A1A1A)
                            )
                        }
                        // 章节内容
                        Text(
                            text = content,
                            fontSize = 14.sp,
                            lineHeight = 24.sp,
                            color = Color(0xFF333333)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
