import java.io.File
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
val keystoreFile = providers.gradleProperty("orangeFamily.keystoreFile").orNull?.trim().orEmpty()
val keystorePassword = providers.gradleProperty("orangeFamily.keystorePassword").orNull.orEmpty()
val releaseKeyAlias = providers.gradleProperty("orangeFamily.keyAlias").orNull?.trim().orEmpty()
val releaseKeyPassword = providers.gradleProperty("orangeFamily.keyPassword").orNull.orEmpty()
val resolvedKeystorePath = keystoreFile.takeIf(String::isNotEmpty)?.let { rootProject.file(it).absolutePath }.orEmpty()

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
        versionCode = 3
        versionName = "1.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            if (keystoreFile.isNotEmpty()) {
                storeFile = rootProject.file(keystoreFile)
            }
            storePassword = keystorePassword
            keyAlias = releaseKeyAlias
            keyPassword = releaseKeyPassword
        }
    }
    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", quotedBuildConfigValue(debugApiBaseUrl))
        }
        release {
            buildConfigField("String", "API_BASE_URL", quotedBuildConfigValue(releaseApiBaseUrl))
            signingConfig = signingConfigs.getByName("release")
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

val validateReleaseConfiguration by tasks.registering {
    inputs.property("releaseApiBaseUrl", releaseApiBaseUrl)
    inputs.property("keystoreFile", keystoreFile)
    inputs.property("resolvedKeystorePath", resolvedKeystorePath)
    inputs.property("keystorePassword", keystorePassword)
    inputs.property("releaseKeyAlias", releaseKeyAlias)
    inputs.property("keyPassword", releaseKeyPassword)
    doLast {
        val releaseUrl = inputs.properties.getValue("releaseApiBaseUrl") as String
        val configuredKeystoreFile = inputs.properties.getValue("keystoreFile") as String
        val keystorePath = inputs.properties.getValue("resolvedKeystorePath") as String
        val configuredKeystorePassword = inputs.properties.getValue("keystorePassword") as String
        val configuredKeyAlias = inputs.properties.getValue("releaseKeyAlias") as String
        val configuredKeyPassword = inputs.properties.getValue("keyPassword") as String
        check(releaseUrl.isNotEmpty()) {
            "Falta -PorangeFamily.releaseApiBaseUrl."
        }
        check(releaseUrl.startsWith("https://")) {
            "orangeFamily.releaseApiBaseUrl debe comenzar por https://."
        }
        check(releaseUrl.endsWith("/")) {
            "orangeFamily.releaseApiBaseUrl debe terminar en /."
        }
        check(configuredKeystoreFile.isNotEmpty()) {
            "Falta -PorangeFamily.keystoreFile."
        }
        check(File(keystorePath).isFile) {
            "No existe el fichero indicado por orangeFamily.keystoreFile."
        }
        check(configuredKeystorePassword.isNotEmpty()) {
            "Falta -PorangeFamily.keystorePassword."
        }
        check(configuredKeyAlias.isNotEmpty()) {
            "Falta -PorangeFamily.keyAlias."
        }
        check(configuredKeyPassword.isNotEmpty()) {
            "Falta -PorangeFamily.keyPassword."
        }
    }
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(validateReleaseConfiguration)
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
