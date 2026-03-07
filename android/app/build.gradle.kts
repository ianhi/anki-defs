plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// Task: Build React frontend and copy dist/ into Android assets
val buildFrontend = tasks.register("buildFrontend", Exec::class) {
    workingDir = file("${rootProject.projectDir}/..")
    commandLine("npm", "run", "build:client")
    inputs.dir("${rootProject.projectDir}/../client/src")
    inputs.file("${rootProject.projectDir}/../client/index.html")
    inputs.file("${rootProject.projectDir}/../client/vite.config.ts")
    outputs.dir("${rootProject.projectDir}/../client/dist")
}

val copyFrontendAssets = tasks.register("copyFrontendAssets", Copy::class) {
    dependsOn(buildFrontend)
    from("${rootProject.projectDir}/../client/dist")
    into("${projectDir}/src/main/assets/www")
}

tasks.named("preBuild") {
    dependsOn(copyFrontendAssets)
}

android {
    namespace = "com.word2anki"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.word2anki"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.core.ktx)
    implementation(libs.lifecycle.runtime)
    implementation(libs.lifecycle.viewmodel)
    implementation(libs.activity.compose)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.icons)

    implementation(libs.navigation.compose)
    implementation(libs.datastore)

    implementation(libs.gemini)

    implementation(libs.nanohttpd)
    implementation(libs.gson)

    debugImplementation(libs.compose.ui.tooling)

    // Testing
    testImplementation(libs.test.junit)
    testImplementation(libs.test.coroutines)
    testImplementation(libs.test.mockk)
    testImplementation(libs.test.json)
}
