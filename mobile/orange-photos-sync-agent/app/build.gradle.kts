import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

val localProperties = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.isFile) {
        localPropertiesFile.inputStream().use { load(it) }
    }
}

fun quotedBuildConfigValue(value: String): String =
    "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""

val debugApiBaseUrl = localProperties
    .getProperty("orangeFamily.apiBaseUrl", "http://10.0.2.2:3001/")
    .trim()
val releaseApiBaseUrl = providers.gradleProperty("orangeFamily.releaseApiBaseUrl")
    .orNull
    ?.trim()
    .orEmpty()

android {
    namespace = "com.orangefamily.photossync"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.orangefamily.photossync"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", quotedBuildConfigValue(debugApiBaseUrl))
        }
        release {
            buildConfigField("String", "API_BASE_URL", quotedBuildConfigValue(releaseApiBaseUrl))
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        buildConfig = true
        compose = true
    }
}

val validateReleaseApiBaseUrl by tasks.registering {
    doLast {
        check(releaseApiBaseUrl.startsWith("https://")) {
            "Define -PorangeFamily.releaseApiBaseUrl=https://... antes de generar release."
        }
    }
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(validateReleaseApiBaseUrl)
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    implementation(libs.androidx.work.runtime.ktx)
    ksp(libs.androidx.room.compiler)
    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
