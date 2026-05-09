package com.example.youzhinan.data.api

import android.util.Log
import com.google.gson.TypeAdapter
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonWriter
import com.google.gson.annotations.JsonAdapter
import java.io.StringReader

// ==================== 高德地图周边搜索 ====================

/**
 * 高德地图 POI 数据
 */
data class NearbyPoi(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("type") val type: String,
    @SerializedName("typecode") val typecode: String,
    @SerializedName("address") val address: String,
    @SerializedName("location") val location: String,
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("distance") val distance: Int,
    @SerializedName("tel") val tel: String?,
    @SerializedName("rating") val rating: String?,
    @SerializedName("cost") val cost: String?
)

/**
 * 周边搜索响应数据
 */
data class NearbySearchResponse(
    @SerializedName("pois") val pois: List<NearbyPoi>,
    @SerializedName("total") val total: Int
)

/**
 * 有些后端返回格式为 { code, message, data: { list: [...] } }
 * 这里添加一个适配类型以解析 data.list
 */
data class NearbyListResponse(
    @SerializedName("list") val list: List<NearbyPoi>
)

/**
 * 灵活的布尔类型适配器
 * 可以处理 JSON 中的 boolean (true/false) 和 number (0/1)
 */
class FlexibleBooleanAdapter : TypeAdapter<Boolean>() {
    override fun write(out: JsonWriter, value: Boolean) {
        out.value(value)
    }

    override fun read(`in`: JsonReader): Boolean {
        return when (val peek = `in`.peek()) {
            com.google.gson.stream.JsonToken.BOOLEAN -> `in`.nextBoolean()
            com.google.gson.stream.JsonToken.NUMBER -> `in`.nextInt() != 0
            com.google.gson.stream.JsonToken.STRING -> {
                val s = `in`.nextString()
                when (s.lowercase()) {
                    "true", "1" -> true
                    "false", "0" -> false
                    else -> s.toBoolean()
                }
            }
            else -> throw IllegalStateException("Expected BOOLEAN or NUMBER but was $peek")
        }
    }
}

/** 兼容 is_auto_reply 为 boolean 或 number，避免解析失败导致整条消息丢失 */
class FlexibleIntForBooleanAdapter : TypeAdapter<Int>() {
    override fun write(out: JsonWriter, value: Int) {
        out.value(value)
    }
    override fun read(`in`: JsonReader): Int = when (`in`.peek()) {
        com.google.gson.stream.JsonToken.BOOLEAN -> if (`in`.nextBoolean()) 1 else 0
        com.google.gson.stream.JsonToken.NUMBER -> `in`.nextInt()
        com.google.gson.stream.JsonToken.NULL -> { `in`.nextNull(); 0 }
        else -> { `in`.skipValue(); 0 }
    }
}

/**
 * 灵活的联系方式适配器
 * 可以处理 JSON 中的对象（ContactInfo）、字符串或字符串内包含的JSON
 * 返回ContactInfo类型的联系方式
 */
class FlexibleContactAdapter : TypeAdapter<ContactInfo?>() {
    private val gson = Gson()
    
    override fun write(out: JsonWriter, value: ContactInfo?) {
        gson.toJson(value, ContactInfo::class.java, out)
    }

    override fun read(`in`: JsonReader): ContactInfo? {
        val peek = `in`.peek()
        Log.d("FlexibleContactAdapter", "Contact字段类型: $peek")
        
        return when (peek) {
            com.google.gson.stream.JsonToken.STRING -> {
                val jsonString = `in`.nextString()
                Log.d("FlexibleContactAdapter", "Contact字符串值: $jsonString")
                
                if (jsonString.isNotBlank() && (jsonString.startsWith("{") || jsonString.startsWith("["))) {
                    try {
                        val nestedReader = JsonReader(StringReader(jsonString))
                        val result = parseContactObject(nestedReader)
                        Log.d("FlexibleContactAdapter", "嵌套JSON解析结果: $result")
                        result
                    } catch (e: Exception) {
                        Log.e("FlexibleContactAdapter", "解析嵌套JSON失败", e)
                        null
                    }
                } else {
                    ContactInfo(phone = listOf(jsonString))
                }
            }
            com.google.gson.stream.JsonToken.BEGIN_OBJECT -> {
                val result = parseContactObject(`in`)
                Log.d("FlexibleContactAdapter", "Contact对象解析结果: $result")
                result
            }
            com.google.gson.stream.JsonToken.NULL -> {
                `in`.nextNull()
                Log.d("FlexibleContactAdapter", "Contact为null")
                null
            }
            else -> {
                Log.d("FlexibleContactAdapter", "未知类型: $peek，跳过")
                `in`.skipValue()
                null
            }
        }
    }
    
    private fun parseContactObject(reader: JsonReader): ContactInfo {
        reader.beginObject()
        var phone: List<String>? = null
        var wechat: List<String>? = null
        var landline: List<String>? = null
        
        while (reader.hasNext()) {
            val name = reader.nextName()
            Log.d("FlexibleContactAdapter", "Contact对象字段: $name, 类型: ${reader.peek()}")
            
            when (name.lowercase()) {
                "phone", "手机", "手机号" -> {
                    phone = parseStringOrList(reader)
                }
                "wechat", "微信" -> {
                    wechat = parseStringOrList(reader)
                }
                "landline", "座机", "固定电话" -> {
                    landline = parseStringOrList(reader)
                    Log.d("FlexibleContactAdapter", "  landline = $landline")
                }
                else -> {
                    reader.skipValue()
                }
            }
        }
        reader.endObject()
        return ContactInfo(phone = phone, wechat = wechat, landline = landline)
    }
    
    private fun parseStringOrList(reader: JsonReader): List<String> {
        val result = mutableListOf<String>()
        when (reader.peek()) {
            com.google.gson.stream.JsonToken.STRING -> {
                result.add(reader.nextString())
            }
            com.google.gson.stream.JsonToken.BEGIN_ARRAY -> {
                reader.beginArray()
                while (reader.hasNext()) {
                    if (reader.peek() == com.google.gson.stream.JsonToken.STRING) {
                        result.add(reader.nextString())
                    } else {
                        reader.skipValue()
                    }
                }
                reader.endArray()
            }
            else -> {
                reader.skipValue()
            }
        }
        return result
    }
}

// ==================== 用户协议与隐私政策 ====================

/**
 * 协议内容响应
 */
data class AgreementContent(
    @SerializedName("title") val title: String? = null,
    @SerializedName("content") val content: String? = null
)

// ==================== 登录注册相关 ====================

/**
 * 登录请求
 */
data class LoginRequest(
    @SerializedName("account") val account: String,
    @SerializedName("password") val password: String,
    @SerializedName("agreementAccepted") val agreementAccepted: Boolean = false
)

/**
 * 注册请求
 */
data class RegisterRequest(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String,
    @SerializedName("nick_name") val nickName: String,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("agreementAccepted") val agreementAccepted: Boolean = false
)

/**
 * 更新用户信息请求
 * 注意：userId 通过 URL 路径参数传递
 */
data class UpdateUserInfoRequest(
    @SerializedName("username") val username: String? = null,
    @SerializedName("nick_name") val nickName: String? = null,
    @SerializedName("avatar_url") val avatarUrl: String? = null,
    @SerializedName("phone") val phone: String? = null
)

/**
 * 后端 PUT /api/user/:id 返回格式 - 仅返回 { message }，不返回用户对象
 */
data class UpdateUserResult(
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: String? = null
)

/**
 * 微信登录请求
 */
data class WxLoginRequest(
    @SerializedName("code") val code: String,
    @SerializedName("appid") val appid: String? = null,
    @SerializedName("nickName") val nickName: String? = null,
    @SerializedName("avatarUrl") val avatarUrl: String? = null,
    @SerializedName("agreementAccepted") val agreementAccepted: Boolean = false
)

/**
 * 发送验证码请求（后端生成）
 */
data class VerificationCodeRequest(
    val email: String,
    val type: String  // "register", "login" 或 "reset_password"
)

/**
 * 邮箱注册请求（后端生成）
 */
data class EmailRegisterRequest(
    val email: String,
    val password: String,
    val code: String,
    val nick_name: String? = null,
    @SerializedName("agreementAccepted") val agreementAccepted: Boolean = false,
    @SerializedName("invite_code") val inviteCode: String? = null
)

/**
 * 重置密码请求
 * 后端要求 email、code、newPassword（camelCase），需用 @SerializedName 防止 Gson 序列化为 snake_case
 */
data class ResetPasswordRequest(
    @SerializedName("email") val email: String,
    @SerializedName("code") val code: String,
    @SerializedName("newPassword") val newPassword: String
)

/**
 * 登录响应
 */
data class LoginResponse(
    @SerializedName("token") val token: String,
    @SerializedName("userInfo") val userInfo: UserInfo
)

/**
 * 用户信息
 */
data class UserInfo(
    @SerializedName("id") val id: Int,
    @SerializedName("username") val username: String,
    @SerializedName("nick_name") val nickName: String? = null,
    @SerializedName("avatar_url") val avatarUrl: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @JsonAdapter(FlexibleBooleanAdapter::class) @SerializedName("is_admin") val isAdmin: Boolean = false,
    @JsonAdapter(FlexibleBooleanAdapter::class) @SerializedName("isAdmin") val admin: Boolean = false,  // 兼容两种命名风格
    @SerializedName("symbol") val symbol: String? = null,
    @SerializedName("points") val points: Double = 0.0
)

// ==================== 配置信息 ====================

/**
 * 配置响应
 */
data class ConfigResponse(
    @SerializedName("apiVersion") val apiVersion: String,
    @SerializedName("serverTime") val serverTime: String,
    @SerializedName("features") val features: Features
)

/**
 * 功能特性
 */
data class Features(
    @SerializedName("lottery") val lottery: Boolean,
    @SerializedName("favorites") val favorites: Boolean,
    @SerializedName("messages") val messages: Boolean,
    @SerializedName("imageUpload") val imageUpload: Boolean
)

// ==================== 信息相关 ====================

/**
 * 信息数据（兼容后端实际返回的复杂结构）
 */
data class InfoDto(
    @SerializedName("id") val id: Int,
    @SerializedName("title") val title: String? = null,
    @SerializedName("store_name") val storeName: String? = null,  // 店铺名称
    @SerializedName("content") val content: String? = null,
    @SerializedName("description") val description: String? = null,  // 描述
    @SerializedName("category_id") val categoryId: Int? = null,
    @SerializedName("category") val category: String? = null,  // 分类：酒吧、民宿等
    @SerializedName("image_url") val imageUrl: String? = null,
    @SerializedName("images") val images: List<String>? = null,  // 图片数组
    @SerializedName("created_at") val createdAt: String? = null,
    @SerializedName("create_time") val createTime: String? = null,  // 创建时间
    @SerializedName("address") val address: String? = null,  // 地址
    @SerializedName("province") val province: String? = null,  // 省
    @SerializedName("city") val city: String? = null,  // 市
    @SerializedName("district") val district: String? = null,  // 区
    @SerializedName("price") val price: String? = null,  // 价格
    @SerializedName("business_hours") val businessHours: String? = null,  // 营业时间
    @JsonAdapter(FlexibleContactAdapter::class) @SerializedName("contact") val contact: ContactInfo? = null,  // 联系方式
    @SerializedName("rating") val rating: Double? = null,  // 评分
    @SerializedName("view_count") val viewCount: Int? = null,  // 浏览次数
    @SerializedName("is_favorited") val isFavorited: Boolean? = null,  // 是否收藏
    @SerializedName("sort_order") val sortOrder: Int? = null,  // 排序
    @SerializedName("latitude") val latitude: Double? = null,
    @SerializedName("longitude") val longitude: Double? = null
)

/**
 * 联系方式
 */
data class ContactInfo(
    @SerializedName("phone") val phone: List<String>? = null,
    @SerializedName("wechat") val wechat: List<String>? = null,
    @SerializedName("landline") val landline: List<String>? = null
)

// ==================== 分类相关 ====================

/**
 * 分类数据
 */
data class CategoryDto(
    @SerializedName("id") val id: Int,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String? = null
)

// ==================== 图片上传 ====================

/**
 * 图片上传响应 - 对应后端 /api/upload 返回格式
 * 支持两种格式：
 * 1. 直接格式: { success: true, imagePath: "/uploads/xxx", fullUrl: "https://..." }
 * 2. 包装格式: { code: 200, data: { imagePath: "/uploads/xxx", fullUrl: "..." } }
 */
data class UploadResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("imagePath") val imagePath: String? = null,
    @SerializedName("fullUrl") val fullUrl: String? = null
)

/**
 * 图片上传 API 响应包装 - 兼容 code/data 包装格式
 */
data class UploadApiResponse(
    @SerializedName("code") val code: Int? = null,
    @SerializedName("data") val data: UploadResponse? = null,
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("imagePath") val imagePath: String? = null,
    @SerializedName("fullUrl") val fullUrl: String? = null
)

// ==================== 头像上传 ====================

/**
 * 头像上传专用响应 - 对应后端 /api/user/:id/avatar 返回格式
 * { success: true, message: "头像上传成功", data: { avatar_url: "/uploads/avatars/xxx", fullUrl: "https://..." } }
 */
data class AvatarUploadResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("message") val message: String? = null,
    @SerializedName("data") val data: AvatarUploadData? = null
)

data class AvatarUploadData(
    @SerializedName("avatar_url") val avatarUrl: String? = null,
    @SerializedName("fullUrl") val fullUrl: String? = null
)

// ==================== 收藏相关 ====================

/**
 * 收藏数据
 */
data class FavoriteDto(
    @SerializedName("id") val id: Int,
    @SerializedName("user_id") val userId: Int,
    @SerializedName("info_id") val infoId: Int,
    @SerializedName("info_title") val infoTitle: String? = null
)

// ==================== 关于我们相关 ====================

/**
 * 关于我们设置项（使用说明、用户须知）
 */
data class AboutSetting(
    @SerializedName("type") val type: String,
    @SerializedName("title") val title: String? = null,
    @SerializedName("content") val content: String? = null
)

// ==================== 站内信相关 ====================

/**
 * 站内信
 */
data class MessageItem(
    @SerializedName("id") val id: Int,
    @SerializedName("type") val type: String,
    @SerializedName("title") val title: String? = null,
    @SerializedName("content") val content: String? = null,
    @JsonAdapter(FlexibleBooleanAdapter::class) @SerializedName("is_read") val isRead: Boolean = false,
    @SerializedName("created_at") val createdAt: String? = null
)

/**
 * 标记已读请求体
 */
data class MarkReadRequest(
    @SerializedName("user_id") val userId: Int
)

/**
 * 站内信列表响应
 */
data class MessagesListResponse(
    @SerializedName("success") val success: Boolean = true,
    @SerializedName("data") val data: List<MessageItem>? = null,
    @SerializedName("unread_count") val unreadCount: Int = 0
)

// ==================== 统计相关 ====================

/**
 * 统计数据
 */
data class StatsDto(
    @SerializedName("total_users") val totalUsers: Int? = null,
    @SerializedName("total_infos") val totalInfos: Int? = null,
    @SerializedName("total_categories") val totalCategories: Int? = null
)

// ==================== 地址数据 ====================

/**
 * 省市区数据响应
 * regions: { "省份": { "cities": [...], "districts": { "城市": ["区1","区2"] } } }
 */
data class RegionsResponse(
    @SerializedName("provinces") val provinces: List<String>? = null,
    @SerializedName("regions") val regions: Map<String, RegionData>? = null
)

data class RegionData(
    @SerializedName("cities") val cities: List<String>? = null,
    @SerializedName("districts") val districts: Map<String, List<String>>? = null
)

// ==================== 投稿相关 ====================

/**
 * 提交投稿成功响应
 */
data class SubmitResult(
    @SerializedName("id") val id: Int
)

/**
 * 我的投稿列表响应
 */
data class MySubmissionsResponse(
    @SerializedName("list") val list: List<SubmissionItem>
)

/**
 * 投稿列表项
 */
data class SubmissionItem(
    @SerializedName("id") val id: Int,
    @SerializedName("store_name") val storeName: String,
    @SerializedName("province") val province: String,
    @SerializedName("city") val city: String,
    @SerializedName("district") val district: String,
    @SerializedName("address") val address: String,
    @SerializedName("category") val category: String? = null,
    @SerializedName("business_hours") val businessHours: String? = null,
    @SerializedName("price") val price: Double? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("contact") val contact: String? = null,
    @SerializedName("images") val images: List<String>? = null,
    @SerializedName("status") val status: String,
    @SerializedName("reject_reason") val rejectReason: String? = null,
    @SerializedName("info_id") val infoId: Int? = null,
    @SerializedName("created_at") val createdAt: String? = null,
    @SerializedName("updated_at") val updatedAt: String? = null
)

/**
 * 投稿详情
 */
data class SubmissionDetail(
    @SerializedName("id") val id: Int,
    @SerializedName("store_name") val storeName: String,
    @SerializedName("province") val province: String,
    @SerializedName("city") val city: String,
    @SerializedName("district") val district: String,
    @SerializedName("address") val address: String,
    @SerializedName("category") val category: String? = null,
    @SerializedName("business_hours") val businessHours: String? = null,
    @SerializedName("price") val price: Double? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("contact") val contact: String? = null,
    @SerializedName("images") val images: List<String>? = null,
    @SerializedName("status") val status: String,
    @SerializedName("reject_reason") val rejectReason: String? = null,
    @SerializedName("info_id") val infoId: Int? = null,
    @SerializedName("created_at") val createdAt: String? = null,
    @SerializedName("updated_at") val updatedAt: String? = null
)

// ==================== 客服会话相关 ====================

data class CustomerServiceMessage(
    @SerializedName("id") val id: Int = 0,
    @SerializedName("user_id") val userId: Int? = null,
    @SerializedName("sender_type") val senderType: String = "admin",
    @SerializedName("content") val content: String = "",
    @JsonAdapter(FlexibleIntForBooleanAdapter::class)
    @SerializedName("is_auto_reply") val isAutoReply: Int = 0,
    @SerializedName("created_at") val createdAt: String? = null
)

data class ConversationData(
    @SerializedName("messages") val messages: List<CustomerServiceMessage>? = null
)

data class QuickQuestion(
    @SerializedName("id") val id: Int = 0,
    @SerializedName("keyword") val keyword: String? = null,
    @SerializedName("text") val text: String? = null,
    @SerializedName("question_text") val questionText: String? = null,
    /** 兼容：后端可能直接在每个问题里返回自动回复内容 */
    @SerializedName("auto_reply") val autoReply: String? = null,
    @SerializedName("reply") val reply: String? = null
)

data class QuickQuestionsData(
    @SerializedName("questions") val questions: List<QuickQuestion>? = null,
    @SerializedName("total") val total: Int? = null
)

data class SendMessageRequest(
    @SerializedName("content") val content: String,
    @SerializedName("trigger_auto_reply") val triggerAutoReply: Boolean? = null
)

data class SendMessageData(
    @SerializedName("message_id") val messageId: Int? = null,
    @SerializedName("auto_reply") val autoReply: String? = null,
    @SerializedName("autoReply") val autoReplyCamel: String? = null,
    @SerializedName("reply") val reply: String? = null,
    @SerializedName("reply_content") val replyContent: String? = null,
    @SerializedName("content") val content: String? = null,
    /** 后端可能返回嵌套 message 对象，其 content 为自动回复 */
    @SerializedName("message") val message: SendMessageNestedMessage? = null
)

data class SendMessageNestedMessage(
    @SerializedName("content") val content: String? = null,
    @SerializedName("auto_reply") val autoReply: String? = null
)

// ==================== 语音合成与识别 ====================

/**
 * 语音合成请求
 */
data class TTSTextRequest(
    @SerializedName("text") val text: String,
    @SerializedName("voiceType") val voiceType: String = "xiaofeng"
)

/**
 * 语音合成响应
 */
data class TTSResponseData(
    @SerializedName("url") val url: String,
    @SerializedName("fileName") val fileName: String
)

/**
 * 语音识别响应
 */
data class ASRResponseData(
    @SerializedName("text") val text: String
)

// ==================== AI 文件分析 ====================

/**
 * 文件分析请求
 */
data class FileAnalyzeRequest(
    @SerializedName("message") val message: String,
    @SerializedName("fileBase64") val fileBase64: String,
    @SerializedName("fileName") val fileName: String,
    @SerializedName("useCustomModel") val useCustomModel: Boolean = false,
    @SerializedName("conversationHistory") val conversationHistory: List<ChatHistoryItem>? = null
)

/**
 * 文件分析响应数据
 */
data class FileAnalyzeResponseData(
    @SerializedName("reply") val reply: String,
    @SerializedName("model") val model: String? = null,
    @SerializedName("timestamp") val timestamp: Long? = null
)

// ==================== 抽奖相关 ====================

data class LotteryActivity(
    @SerializedName("id") val id: Int,
    @SerializedName("name") val name: String,
    @SerializedName("start_time") val startTime: String? = null,
    @SerializedName("end_time") val endTime: String? = null,
    @SerializedName("daily_limit") val dailyLimit: Int = 1,
    @SerializedName("total_limit") val totalLimit: Int = 10,
    @SerializedName("win_rate") val winRate: Double = 30.0,
    @SerializedName("status") val status: String = "inactive",
    @SerializedName("prize_description") val prizeDescription: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class LotteryPrize(
    @SerializedName("id") val id: Int,
    @SerializedName("activity_id") val activityId: Int,
    @SerializedName("name") val name: String,
    @SerializedName("image") val image: String? = null,
    @SerializedName("quantity") val quantity: Int = 0,
    @SerializedName("original_quantity") val originalQuantity: Int = 0,
    @SerializedName("probability") val probability: Double = 0.0,
    @SerializedName("effective_probability") val effectiveProbability: Double = 0.0,
    @SerializedName("position") val position: String? = null,
    @SerializedName("is_thank_you") val isThankYou: Int = 0,
    @SerializedName("needs_shipping") val needsShipping: Int = 1,
    @SerializedName("out_of_stock") val outOfStock: Int = 0
)

data class LotteryStatusResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("status") val status: String,
    @SerializedName("activity") val activity: LotteryActivity? = null,
    @SerializedName("prizes") val prizes: List<LotteryPrize>? = null,
    @SerializedName("message") val message: String? = null
)

data class LotteryPrizesResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: List<LotteryPrize>? = null,
    @SerializedName("message") val message: String? = null
)

data class LotteryDrawRequest(
    @SerializedName("activity_id") val activityId: Int
)

data class LotteryDrawResponse(
    @SerializedName("success") val success: Boolean,
    @JsonAdapter(FlexibleBooleanAdapter::class) @SerializedName("is_winner") val isWinner: Boolean = false,
    @SerializedName("record_id") val recordId: Int = 0,
    @SerializedName("prize") val prize: DrawPrize? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: String? = null
)

data class DrawPrize(
    @SerializedName("id") val id: Int,
    @SerializedName("name") val name: String,
    @SerializedName("image") val image: String? = null,
    @SerializedName("position") val position: String? = null,
    @SerializedName("is_thank_you") val isThankYou: Int = 0,
    @SerializedName("needs_shipping") val needsShipping: Int = 1,
    @SerializedName("effective_probability") val effectiveProbability: Double = 0.0,
    @SerializedName("out_of_stock") val outOfStock: Int = 0,
    @SerializedName("quantity") val quantity: Int = 0
)

data class LotteryRecord(
    @SerializedName("id") val id: Int,
    @SerializedName("activity_id") val activityId: Int,
    @SerializedName("user_id") val userId: Int,
    @SerializedName("prize_id") val prizeId: Int? = null,
    @SerializedName("is_winner") val isWinner: Int = 0,
    @SerializedName("draw_time") val drawTime: String? = null,
    @SerializedName("prize_name") val prizeName: String? = null,
    @SerializedName("prize_image") val prizeImage: String? = null,
    @SerializedName("needs_shipping") val needsShipping: Int = 1,
    @JsonAdapter(FlexibleBooleanAdapter::class) @SerializedName("has_address") val hasAddress: Boolean = false,
    @SerializedName("shipping_status") val shippingStatus: String? = null,
    @SerializedName("tracking_number") val trackingNumber: String? = null,
    @SerializedName("courier_company") val courierCompany: String? = null
)

data class UserDrawInfo(
    @SerializedName("daily_used") val dailyUsed: Int = 0,
    @SerializedName("daily_bonus") val dailyBonus: Int = 0,
    @SerializedName("daily_limit") val dailyLimit: Int = 0,
    @SerializedName("invite_bonus_today") val inviteBonusToday: Int = 0,
    @SerializedName("effective_daily_limit") val effectiveDailyLimit: Int = 0,
    @SerializedName("daily_remaining") val dailyRemaining: Int = 0,
    @SerializedName("total_used") val totalUsed: Int = 0,
    @SerializedName("total_limit") val totalLimit: Int = 0,
    @SerializedName("total_remaining") val totalRemaining: Int = 0,
    @SerializedName("win_records") val winRecords: List<LotteryRecord> = emptyList(),
    @SerializedName("all_records") val allRecords: List<LotteryRecord> = emptyList()
)

data class UserDrawInfoResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: UserDrawInfo? = null
)

data class ShippingAddressRequest(
    @SerializedName("record_id") val recordId: Int,
    @SerializedName("user_id") val userId: Int,
    @SerializedName("name") val name: String,
    @SerializedName("phone") val phone: String,
    @SerializedName("province") val province: String,
    @SerializedName("city") val city: String,
    @SerializedName("district") val district: String,
    @SerializedName("detail_address") val detailAddress: String
)

data class ShippingAddress(
    @SerializedName("id") val id: Int,
    @SerializedName("record_id") val recordId: Int,
    @SerializedName("user_id") val userId: Int,
    @SerializedName("prize_id") val prizeId: Int? = null,
    @SerializedName("name") val name: String,
    @SerializedName("phone") val phone: String,
    @SerializedName("province") val province: String,
    @SerializedName("city") val city: String,
    @SerializedName("district") val district: String,
    @SerializedName("detail_address") val detailAddress: String,
    @SerializedName("shipping_status") val shippingStatus: String? = null,
    @SerializedName("tracking_number") val trackingNumber: String? = null,
    @SerializedName("courier_company") val courierCompany: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class ShippingAddressResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: List<ShippingAddress>? = null,
    @SerializedName("message") val message: String? = null
)

data class AdWatchRequest(
    @SerializedName("user_id") val userId: Int,
    @SerializedName("activity_id") val activityId: Int,
    @SerializedName("ad_id") val adId: String,
    @SerializedName("ad_duration") val adDuration: Int,
    @SerializedName("watch_duration") val watchDuration: Int
)

data class AdWatchResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("error") val error: String? = null
)

data class LotteryRecordsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: List<LotteryRecord>? = null,
    @SerializedName("pagination") val pagination: PaginationInfo? = null
)

data class PaginationInfo(
    @SerializedName("page") val page: Int = 1,
    @SerializedName("limit") val limit: Int = 20,
    @SerializedName("total") val total: Int = 0,
    @SerializedName("total_pages") val totalPages: Int = 0
)

data class InviteInfo(
    @SerializedName("invite_code") val inviteCode: String = "",
    @SerializedName("total_invites") val totalInvites: Int = 0,
    @SerializedName("today_invites") val todayInvites: Int = 0,
    @SerializedName("invite_bonus_today") val inviteBonusToday: Int = 0,
    @SerializedName("invite_records") val inviteRecords: List<InviteRecord> = emptyList()
)

data class InviteRecord(
    @SerializedName("id") val id: Int = 0,
    @SerializedName("inviter_id") val inviterId: Int = 0,
    @SerializedName("invitee_id") val inviteeId: Int = 0,
    @SerializedName("nick_name") val nickName: String? = null,
    @SerializedName("username") val username: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class InviteInfoResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: InviteInfo? = null
)

data class RecordInviteRequest(
    @SerializedName("inviter_id") val inviterId: Int? = null,
    @SerializedName("invitee_id") val inviteeId: Int,
    @SerializedName("activity_id") val activityId: Int? = null,
    @SerializedName("invite_code") val inviteCode: String? = null
)

data class RecordInviteResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String? = null,
    @SerializedName("bonus_granted") val bonusGranted: Boolean = false,
    @SerializedName("error") val error: String? = null
)
