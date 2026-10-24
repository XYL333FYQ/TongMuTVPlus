plugins {
    id("com.android.application")
}

fun propOrEnv(propName: String, envName: String, defaultValue: String): String {
    return (project.findProperty(propName) as String?)
        ?: System.getenv(envName)
        ?: defaultValue
}

val versionNameValue = propOrEnv("VERSION_NAME", "VERSION_NAME", "1.0.0")
val versionCodeValue = propOrEnv("VERSION_CODE", "VERSION_CODE", "1").toIntOrNull() ?: 1

android {
    namespace = "com.tongmutvplus.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.tongmutvplus.mobile"
        // Android 6.0：更老的系统自带 WebView 内核跑不动 Next.js 14
        minSdk = 23
        targetSdk = 35
        versionCode = versionCodeValue
        versionName = versionNameValue
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        // 打包不被 lint 的非致命告警卡住
        checkReleaseBuilds = false
        abortOnError = false
    }

    signingConfigs {
        create("release") {
            val storeFilePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (!storeFilePath.isNullOrBlank() && file(storeFilePath).exists()) {
                storeFile = file(storeFilePath)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            isDebuggable = true
        }
        release {
            isMinifyEnabled = false
            val storeFilePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (!storeFilePath.isNullOrBlank() && file(storeFilePath).exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}
