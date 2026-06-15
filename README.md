[![Build APK](https://github.com/sebseb7/ZebraLabel/actions/workflows/build-apk.yml/badge.svg)](https://github.com/sebseb7/ZebraLabel/actions/workflows/build-apk.yml)
[![Latest release](https://img.shields.io/badge/dynamic/json?url=https://api.github.com/repos/sebseb7/ZebraLabel/releases/latest&query=$.tag_name&label=release&color=2ea443&logo=github)](https://github.com/sebseb7/ZebraLabel/releases/latest)

# Zebra Price Label

Android app for printing price labels to a USB-connected **Zebra ZD410** printer.

![Zebra Price Label app](docs/app-screenshot.png)

## Features

- Enter a price on a numeric keypad
- Choose label size (25×13 mm, 46.8×81 mm, 50.8×25.4 mm)
- Print ZPL labels with centered price and black pill styling (small label)
- Fine-tune print position per label size (saved permanently)
- USB Zebra printer discovery and printing

## Requirements

- Node.js ≥ 22.11
- Android SDK and a connected device or emulator
- Zebra ZD410 (or compatible ZPL USB printer)

## Development

```sh
npm install
npm start
npm run android
```

In one terminal, keep Metro running (`npm start`). In another, build and launch the app (`npm run android`).

### Android emulator

1. Open **Android Studio → Device Manager** and start a virtual device (or run `emulator -list-avds` then `emulator -avd <name>`).
2. With Metro running, install and launch the app:

```sh
npm run android
```

The emulator can exercise the UI, but it has no USB host access — printer discovery and printing require a physical device.

### Physical device over Wi‑Fi

Useful when the tablet/phone stays on the desk and you do not want a USB cable for Metro/adb. USB printing still needs the OTG cable to the Zebra printer.

**One-time setup (device on the same Wi‑Fi as your PC):**

1. Enable **Developer options** and **USB debugging** on the device.
2. Connect the device with USB and confirm it appears in `adb devices`.
3. Switch adb to TCP/IP mode:

```sh
adb tcpip 5555
```

4. Find the device IP (Wi‑Fi settings, or `adb shell ip route | awk '{print $9}'`).
5. Connect over the network:

```sh
adb connect <device-ip>:5555
adb devices
```

You should see `<device-ip>:5555` listed. You can unplug USB.

**Daily dev:**

```sh
npm start
npm run android
```

If the wireless adb connection drops (sleep, reboot, network change), repeat from `adb connect <device-ip>:5555`. On Android 11+, you can also pair from **Developer options → Wireless debugging** if `adb tcpip` is unavailable.

## Build release APK

```sh
npm run build:apk
```

Output: `dist/ZebraLabel-<version>-release.apk`

### Local release signing

Copy `android/keystore.properties.example` to `android/keystore.properties` and fill in your passwords. The keystore file lives at the repo root (`zebra-label-release.keystore`, gitignored). Without `keystore.properties`, release builds fall back to the debug keystore.

### GitHub Actions signing

Add these [repository secrets](https://github.com/sebseb7/ZebraLabel/settings/secrets/actions) (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 of `zebra-label-release.keystore` (see below) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | `zebra-label` |
| `ANDROID_KEY_PASSWORD` | Key password |

Encode the keystore (Git Bash / Linux / macOS):

```sh
base64 -w 0 zebra-label-release.keystore
```

PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("zebra-label-release.keystore"))
```

Paste the single-line output into `ANDROID_KEYSTORE_BASE64`. Release tags and pushes to `main` build a Play Store–compatible signed APK; pull requests still use the debug keystore so forks do not need secrets.

### Install over Wi‑Fi (adb)

Set up wireless adb once as in [Physical device over Wi‑Fi](#physical-device-over-wi-fi), then install or update the release APK without USB:

```sh
adb connect <device-ip>:5555
adb install -r dist/ZebraLabel-<version>-release.apk
```

`-r` replaces an existing install. If adb lists multiple devices, target the tablet explicitly:

```sh
adb -s <device-ip>:5555 install -r dist/ZebraLabel-<version>-release.apk
```

Replace `<version>` with the version from `package.json` (e.g. `0.0.1`). If the connection dropped, run `adb connect <device-ip>:5555` again before installing.

## Test CI locally with act

Run the GitHub Actions workflow locally with [act](https://github.com/nektos/act). The `--artifact-server-path` flag is required so `upload-artifact` can store the built APK under `.artifacts/`:

```sh
act workflow_dispatch -W .github/workflows/build-apk.yml -j build-apk --artifact-server-path .artifacts
```

On the first run, `Cache not found for input keys: Linux-android-ndk-…` is normal — nothing has been saved yet. The NDK is downloaded by `sdkmanager`, then cached at the **end** of the job.

**Important:** `actions/cache` only saves when the job **succeeds** (`post-if: success()`). If a previous local run failed (for example at `upload-artifact` without `--artifact-server-path`), the NDK cache was never written and the next run will miss again. Gradle caches may still restore because `setup-gradle` saves independently. Once a run completes successfully, subsequent runs should restore the NDK cache.

## Capture a screenshot for the README

With the app open on a connected device:

```sh
adb exec-out screencap -p > docs/app-screenshot.png
```

If multiple devices are connected, pick one explicitly:

```sh
adb devices
adb -s <device-id> exec-out screencap -p > docs/app-screenshot.png
```

## Project layout

| Path | Purpose |
| --- | --- |
| `App.tsx` | App entry (safe area wrapper) |
| `src/components/AppContent.tsx` | Main UI |
| `src/buildZpl.ts` | ZPL label templates |
| `src/labelOffsetStorage.ts` | Persistent position offsets |
| `android/.../ZebraPrinterModule.kt` | USB print native module |
| `scripts/build-apk.js` | Release APK build script |


## Misc

keystore creation:
`keytool -genkeypair -v   -storetype PKCS12   -keystore zebra-label-release.keystore   -alias zebra-label   -keyalg RSA   -keysize 2048   -validity 10000   -dname "CN=Zebra Label, OU=Development, O=Seb Green, L=Dresden, ST=Saxony, C=DE, EMAILADDRESS=sebgreenbus@gmail.com"`