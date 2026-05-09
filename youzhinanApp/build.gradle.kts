plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
}

tasks.register("testClasses") {
    group = "build"
    description = "Placeholder task for IDE compatibility"
}
