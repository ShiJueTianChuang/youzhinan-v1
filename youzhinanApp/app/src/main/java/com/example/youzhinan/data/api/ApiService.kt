package com.example.youzhinan.data.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import okhttp3.MultipartBody
import okhttp3.RequestBody

/**
 * API 接口服务
 * 基础 URL: https://your-domain.com/
 *
 * 根据文档，所有 API 路径以 /api/ 开头
 */
interface ApiService {

    // ==================== 用户协议与隐私政策 ====================

    @GET("api/app/agreement")
    suspend fun getAgreement(): Response<ApiResponse<AgreementContent>>

    @GET("api/app/privacy")
    suspend fun getPrivacy(): Response<ApiResponse<AgreementContent>>

    // ==================== 认证接口 ====================

    @POST("api/app/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<ApiResponse<LoginResponse>>

    @POST("api/app/register")
    suspend fun register(
        @Body request: RegisterRequest
    ): Response<ApiResponse<LoginResponse>>

    @POST("api/app/wx-login")
    suspend fun wxLogin(
        @Body request: WxLoginRequest
    ): Response<ApiResponse<LoginResponse>>

    @POST("api/email-auth/send-code")
    suspend fun sendVerificationCode(
        @Body request: VerificationCodeRequest
    ): Response<ApiResponse<Void>>

    @POST("api/email-auth/register")
    suspend fun emailRegister(
        @Body request: EmailRegisterRequest
    ): Response<ApiResponse<LoginResponse>>

    @POST("api/app/change-password")
    suspend fun changePassword(
        @Body request: ChangePasswordRequest
    ): Response<ApiResponse<ChangePasswordResponse>>

    /**
     * 邮箱验证码重置密码 - 调用 /api/email-auth/reset-password
     */
    @POST("api/email-auth/reset-password")
    suspend fun resetPassword(
        @Body request: ResetPasswordRequest
    ): Response<ApiResponse<Void>>

    // ==================== 手机号验证码认证 ====================

    @POST("api/sms/send-code")
    suspend fun sendSmsCode(
        @Body request: SmsCodeRequest
    ): Response<ApiResponse<Void>>

    @POST("api/sms/register")
    suspend fun smsRegister(
        @Body request: SmsRegisterRequest
    ): Response<ApiResponse<LoginResponse>>

    @POST("api/sms/login")
    suspend fun smsLogin(
        @Body request: SmsLoginRequest
    ): Response<ApiResponse<LoginResponse>>

    @POST("api/sms/reset-password")
    suspend fun smsResetPassword(
        @Body request: SmsResetPasswordRequest
    ): Response<ApiResponse<Void>>

    @PUT("api/user/{userId}")
    suspend fun updateUserInfo(
        @Path("userId") userId: Int,
        @Body request: UpdateUserInfoRequest
    ): Response<UpdateUserResult>

    @GET("api/app/config")
    suspend fun getConfig(): Response<ApiResponse<ConfigResponse>>

    // ==================== 图片上传 ====================

    @Multipart
    @POST("api/images/upload")
    suspend fun uploadImage(
        @Part image: okhttp3.MultipartBody.Part
    ): Response<UploadApiResponse>

    // ==================== 头像上传专用接口 ====================

    /**
     * 上传用户头像 - 使用专用接口 /api/user/{userId}/avatar
     * 表单字段名必须为 'file' 或 'image'（后端已兼容两种）
     */
    @Multipart
    @POST("api/user/{userId}/avatar")
    suspend fun uploadAvatar(
        @Path("userId") userId: Int,
        @Part avatar: okhttp3.MultipartBody.Part
    ): Response<AvatarUploadResponse>

    // ==================== 信息查询 ====================

    @GET("api/info/search")
    suspend fun searchInfo(
        @Query("keyword") keyword: String,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 10
    ): Response<ApiResponse<List<InfoDto>>>

    @GET("api/app/info")
    suspend fun getInfoList(): Response<ApiResponse<List<InfoDto>>>

    @GET("api/info/{id}")
    suspend fun getInfoDetail(
        @Path("id") id: Int
    ): Response<InfoDto>

    // ==================== 收藏接口 ====================

    @GET("api/favorites")
    suspend fun getFavorites(): Response<ApiResponse<List<InfoDto>>>

    @POST("api/favorites/{infoId}")
    suspend fun addFavorite(
        @Path("infoId") infoId: Int
    ): Response<ApiResponse<Void>>

    @DELETE("api/favorites/{infoId}")
    suspend fun removeFavorite(
        @Path("infoId") infoId: Int
    ): Response<ApiResponse<Void>>

    @GET("api/favorites/check/{infoId}")
    suspend fun checkFavorite(
        @Path("infoId") infoId: Int
    ): Response<ApiResponse<Boolean>>

    // ==================== 关于我们 ====================

    @GET("api/about")
    suspend fun getAboutSettings(): Response<List<AboutSetting>>

    @GET("api/about/{type}")
    suspend fun getAboutSetting(
        @Path("type") type: String
    ): Response<AboutSetting>

    // ==================== 站内信 ====================

    @GET("api/messages/user")
    suspend fun getMessages(
        @Query("user_id") userId: Int,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 20
    ): Response<MessagesListResponse>

    @POST("api/messages/{id}/read")
    suspend fun markMessageRead(
        @Path("id") messageId: Int,
        @Body body: MarkReadRequest
    ): Response<Any>

    // ==================== 地址数据 ====================

    @GET("api/regions")
    suspend fun getRegions(): Response<ApiResponse<RegionsResponse>>

    // ==================== 分类数据 ====================

    /** 获取分类列表，用于投稿等场景。若 404 则 ViewModel 会从 info 列表提取 */
    @GET("api/category")
    suspend fun getCategories(): Response<ApiResponse<List<CategoryDto>>>

    // ==================== 投稿接口 ====================

    @Multipart
    @POST("api/submissions")
    suspend fun submitInfo(
        @Part("store_name") storeName: RequestBody,
        @Part("province") province: RequestBody,
        @Part("city") city: RequestBody,
        @Part("district") district: RequestBody,
        @Part("address") address: RequestBody,
        @Part("category") category: RequestBody? = null,
        @Part("business_hours") businessHours: RequestBody? = null,
        @Part("price") price: RequestBody? = null,
        @Part("description") description: RequestBody? = null,
        @Part("contact") contact: RequestBody? = null,
        @Part("library_images") libraryImages: RequestBody? = null,
        @Part images: List<MultipartBody.Part>? = null
    ): Response<ApiResponse<SubmitResult>>

    @GET("api/submissions/my")
    suspend fun getMySubmissions(): Response<ApiResponse<MySubmissionsResponse>>

    @GET("api/submissions/{id}")
    suspend fun getSubmissionDetail(@Path("id") id: Int): Response<ApiResponse<SubmissionDetail>>

    @Multipart
    @PUT("api/submissions/{id}")
    suspend fun updateSubmission(
        @Path("id") id: Int,
        @Part("store_name") storeName: RequestBody,
        @Part("province") province: RequestBody,
        @Part("city") city: RequestBody,
        @Part("district") district: RequestBody,
        @Part("address") address: RequestBody,
        @Part("category") category: RequestBody? = null,
        @Part("business_hours") businessHours: RequestBody? = null,
        @Part("price") price: RequestBody? = null,
        @Part("description") description: RequestBody? = null,
        @Part("contact") contact: RequestBody? = null,
        @Part("library_images") libraryImages: RequestBody? = null,
        @Part images: List<MultipartBody.Part>? = null
    ): Response<ApiResponse<Void>>

    @DELETE("api/submissions/{id}")
    suspend fun deleteSubmission(@Path("id") id: Int): Response<ApiResponse<Void>>

    // ==================== 客服/帮助与反馈 ====================

    @GET("api/customer-service/conversation")
    suspend fun getCustomerServiceConversation(): Response<ApiResponse<ConversationData>>

    @GET("api/customer-service/quick-questions")
    suspend fun getQuickQuestions(): Response<ApiResponse<QuickQuestionsData>>

    @POST("api/customer-service/send")
    suspend fun sendCustomerServiceMessage(
        @Body request: SendMessageRequest
    ): Response<ApiResponse<SendMessageData>>

    @DELETE("api/customer-service/conversation")
    suspend fun clearCustomerServiceConversation(): Response<ApiResponse<Void>>

    // ==================== 高德地图周边搜索 ====================

    /**
     * 周边搜索 - 通过代理服务器调用高德地图 API
     * @param latitude 纬度
     * @param longitude 经度
     * @param radius 半径（米），默认 300000
     * @param keywords 搜索关键词
     */
    @GET("api/nearby/search")
    suspend fun searchNearby(
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("radius") radius: Int = 300000,
        @Query("keywords") keywords: String? = null,
        @Query("page") page: Int = 1,
        @Query("pagesize") pagesize: Int = 20
    ): Response<ApiResponse<NearbySearchResponse>>

    // ==================== 语音合成与识别 ====================

    @POST("api/speech/tts")
    suspend fun textToSpeech(
        @Header("Authorization") authHeader: String,
        @Body request: TTSTextRequest
    ): ApiResponse<TTSResponseData>

    @Multipart
    @POST("api/speech/asr")
    suspend fun speechToText(
        @Header("Authorization") authHeader: String,
        @Part audio: okhttp3.MultipartBody.Part
    ): ApiResponse<ASRResponseData>

    // ==================== 抽奖接口 ====================

    @GET("api/lottery/status")
    suspend fun getLotteryStatus(): Response<LotteryStatusResponse>

    @GET("api/lottery/prizes")
    suspend fun getLotteryPrizes(): Response<LotteryPrizesResponse>

    @POST("api/lottery/draw")
    suspend fun lotteryDraw(
        @Body request: LotteryDrawRequest
    ): Response<LotteryDrawResponse>

    @GET("api/lottery/user-draw-info")
    suspend fun getUserDrawInfo(
        @Query("user_id") userId: Int,
        @Query("activity_id") activityId: Int
    ): Response<UserDrawInfoResponse>

    @POST("api/lottery/shipping-address")
    suspend fun submitShippingAddress(
        @Body request: ShippingAddressRequest
    ): Response<ShippingAddressResponse>

    @GET("api/lottery/shipping-address")
    suspend fun getShippingAddress(
        @Query("user_id") userId: Int? = null,
        @Query("record_id") recordId: Int? = null
    ): Response<ShippingAddressResponse>

    @POST("api/lottery/watch-ad")
    suspend fun watchAd(
        @Body request: AdWatchRequest
    ): Response<AdWatchResponse>

    @GET("api/lottery/records")
    suspend fun getLotteryRecords(
        @Query("user_id") userId: Int,
        @Query("activity_id") activityId: Int? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<LotteryRecordsResponse>

    @GET("api/lottery/invite-info")
    suspend fun getInviteInfo(
        @Query("user_id") userId: Int,
        @Query("activity_id") activityId: Int? = null
    ): Response<InviteInfoResponse>

    @POST("api/lottery/record-invite")
    suspend fun recordInvite(
        @Body request: RecordInviteRequest
    ): Response<RecordInviteResponse>
}