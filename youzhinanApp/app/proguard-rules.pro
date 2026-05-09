# ==================== 通用规则 ====================
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ==================== Retrofit ====================
-keepattributes Signature, Exceptions
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-keepclassmembers,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

# ==================== OkHttp ====================
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# ==================== Gson ====================
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# 保持 JSON 序列化/反序列化用到的数据类
-keep class com.example.youzhinan.data.api.** { *; }

# ==================== Coil ====================
-dontwarn coil.**
-keep class coil.** { *; }

# ==================== Compose ====================
-dontwarn androidx.compose.**
-keep class androidx.compose.** { *; }

# ==================== Android 组件 ====================
-keep class * extends android.app.Activity
-keep class * extends android.app.Application
-keep class * extends androidx.activity.ComponentActivity
-keepclassmembers class * extends androidx.activity.ComponentActivity {
    <init>(...);
}

# ==================== Kotlin ====================
-dontwarn kotlin.**
-keep class kotlin.Metadata { *; }
-keepclassmembers class **$WhenMappings {
    <fields>;
}

# ==================== 项目自有类 ====================
-keep class com.example.youzhinan.YouyoubanApplication { *; }
-keep class com.example.youzhinan.MainActivity { *; }
-keep class com.example.youzhinan.data.api.ApiService { *; }
-keep class com.example.youzhinan.data.api.AiChatApi { *; }
-keep class com.example.youzhinan.data.api.AmapApiService { *; }

# ==================== Kotlin Coroutines ====================
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}

# ==================== Navigation ====================
-keepnames class androidx.navigation.fragment.NavHostFragment
-keepnames class android.app.Activity
-keep class * extends androidx.fragment.app.Fragment { *; }

# ==================== ViewModel & Lifecycle ====================
-keep class * extends androidx.lifecycle.ViewModel { <init>(...); }
-keep class * extends androidx.lifecycle.AndroidViewModel { <init>(...); }
-keepclassmembers class * extends androidx.lifecycle.ViewModel {
    <init>(...);
}
-keep class androidx.lifecycle.** { *; }

# ==================== DataStore / SharedPreferences ====================
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ==================== Sealed Class ====================
-keepclassmembers class * extends java.lang.Enum {
    <fields>;
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ==================== WebView ====================
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(...);
}
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public void *(...);
}

# ==================== 反射 & 序列化补充 ====================
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses
-keepattributes Exceptions
