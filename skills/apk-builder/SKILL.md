---
name: apk-builder
description: Build functional Android APK files entirely from the command line without Android Studio. Use this skill whenever the user wants to create an Android app, build an APK, package a web app for Android, create an Android TV app, or mentions APK compilation without an IDE. Covers Cordova-based builds, Android TV/Leanback support, HLS/streaming media apps, D-pad navigation, and JSON-driven apps. Also triggers for requests about building mobile apps from web technologies, creating radio/streaming apps, or Android TV development.
---

# APK Builder - Build Android APKs Without Android Studio

## Overview

This skill enables building fully functional Android APK files using only command-line tools. No Android Studio IDE required. The entire toolchain runs on a headless Linux server.

## Core Technology Stack

- **Apache Cordova 13+**: Wraps HTML/CSS/JS into native Android APK
- **Android SDK Command-Line Tools**: Provides build-tools, platform SDKs, etc.
- **Gradle 8.x**: Build system (invoked via Cordova or directly)
- **OpenJDK 21**: Java compilation
- **HLS.js**: HLS streaming support in WebView

## Prerequisites (must be installed)

```bash
# Environment variables (add to shell profile)
export JAVA_HOME=$HOME/jdk-21.0.5
export ANDROID_HOME=$HOME/android-sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

# Verify installations
java -version        # OpenJDK 21+
node -v              # Node.js 18+
cordova --version    # Cordova 13+
```

## Step-by-Step: Creating an APK

### 1. Create Cordova Project

```bash
cordova create myapp com.example.myapp "My App Name"
cd myapp
cordova platform add android
```

### 2. Develop the Web App (www/ directory)

Place your HTML/CSS/JS in `www/`. This is a standard web app that runs in Android's WebView.

### 3. Configure for Android TV (if needed)

Edit `platforms/android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Add to <manifest> -->
<uses-feature android:name="android.software.leanback" android:required="false" />
<uses-feature android:name="android.hardware.touchscreen" android:required="false" />

<!-- Add to <application> -->
<application android:banner="@drawable/banner" android:usesCleartextTraffic="true">

<!-- Add LEANBACK_LAUNCHER to intent-filter -->
<category android:name="android.intent.category.LEANBACK_LAUNCHER" />
```

Create a 320x180px banner at `platforms/android/app/src/main/res/drawable/banner.png`.

### 4. Build the APK

```bash
# Via Cordova CLI
cordova build android

# Or via Gradle directly (more control)
cd platforms/android
./gradlew assembleDebug --no-daemon
```

Output APK: `platforms/android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Release Build (signed)

```bash
# Generate keystore
keytool -genkey -v -keystore my-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias mykey

# Build release
cordova build android --release -- --keystore=my-release-key.jks --alias=mykey --storePassword=*** --password=***
```

## D-Pad Navigation for Android TV

TV remote D-pad maps to keyboard events in WebView:
- ArrowUp/Down/Left/Right → Navigation
- Enter/Space → Select/Click
- Escape/Backspace → Back

Implement spatial navigation in JavaScript:
- Track focused element with `.focused` class
- On arrow key press, find nearest element in that direction using bounding rects
- Prefer elements with smaller perpendicular distance (weighted scoring)

## Streaming Media Support

| Format | Method |
|--------|--------|
| MP3, AAC, WAV, OGG, FLAC | Native `<audio>` element |
| HLS (.m3u8) | HLS.js library in WebView |
| DASH (.mpd) | dash.js library |
| RTMP | Not supported in WebView (requires native ExoPlayer) |

### HLS Integration

```html
<script src="js/hls.min.js"></script>
<script>
if (Hls.isSupported()) {
    const hls = new Hls({ lowLatencyMode: true });
    hls.loadSource(streamUrl);
    hls.attachMedia(audioElement);
    hls.on(Hls.Events.MANIFEST_PARSED, () => audioElement.play());
}
</script>
```

## JSON-Driven App Pattern

Support multiple JSON formats for maximum compatibility:

1. **Categories format**: `{ categories: [{ name, stations: [{ name, url, cover }] }] }`
2. **Flat format**: `{ stations: [{ name, url }] }`
3. **Web format**: `{ genres: [{ name, radios: [{ name, stream }] }] }`
4. **Array format**: `[{ name, url, genre }]`

Always normalize incoming JSON to a consistent internal structure.

## Common Build Issues & Fixes

| Issue | Fix |
|-------|-----|
| `requireCordovaModule` error | Plugin incompatible with Cordova 13. Remove plugin and apply manifest changes manually. |
| `VANILLA_ICE_CREAM` not found | Set compileSdk to 36+ in `cdv-gradle-config.json` |
| `No usable Android build tools` | Install matching version: `sdkmanager "build-tools;36.0.0"` |
| JDK not found | Install JDK and set `JAVA_HOME`. JRE is not enough — need `javac`. |
| Missing platform | `sdkmanager "platforms;android-36"` |
| Resource compilation error | Check for namespace issues in config.xml `config-file` elements |

## config.xml Best Practices

- Do NOT use `config-file` elements with `android:` namespace prefixes — they cause XML parsing errors
- Apply manifest changes directly to `platforms/android/app/src/main/AndroidManifest.xml` after `cordova prepare`
- Use `<preference>` elements for safe configurations
- Use `<access origin="*" />` for streaming apps

## Important Reminders

- After `cordova prepare`, always re-check AndroidManifest.xml — Cordova may overwrite custom changes
- The `cordova-plugin-android-tv` plugin is incompatible with Cordova 13+; apply TV changes manually
- Always set `android:usesCleartextTraffic="true"` for HTTP streaming
- Add `WAKE_LOCK` permission for background audio playback
- Test with both `assembleDebug` and real devices
