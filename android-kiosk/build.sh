#!/usr/bin/env bash
# Builds build/rumi-kiosk.apk with the Android SDK command-line tools only (no Gradle, no downloads).
# Needs: Android SDK (build-tools + a platform) and a JDK 17+ (Android Studio's bundled one works).
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
PLATFORM_JAR="$SDK/platforms/$(ls "$SDK/platforms" | sort -V | tail -1)/android.jar"
if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/javac" ]; then
  JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"

KS=signing/kiosk.jks
PASS=signing/password.txt
if [ ! -f "$KS" ]; then
  echo "Creating signing key in $KS (back it up: app updates must be signed with the same key)"
  mkdir -p signing
  head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$PASS"
  keytool -genkeypair -keystore "$KS" -storepass:file "$PASS" -keypass:file "$PASS" -alias rumi-kiosk \
    -keyalg RSA -keysize 3072 -validity 36500 -dname "CN=The Rumi Check-in Kiosk" >/dev/null
fi

VERSION_CODE="${VERSION_CODE:-$(( $(date +%s) / 60 ))}"  # minutes since 1970: always increases, fits in an int
VERSION_NAME="${VERSION_NAME:-1.0.$(date -u +%Y%m%d.%H%M)}"

OUT=build
rm -rf "$OUT"
mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"

"$BT/aapt2" compile --dir res -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$PLATFORM_JAR" --manifest AndroidManifest.xml \
  --java "$OUT/gen" --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" "$OUT/res.zip"

javac -nowarn -Xlint:none -source 8 -target 8 -bootclasspath "$PLATFORM_JAR:$BT/core-lambda-stubs.jar" -encoding UTF-8 \
  -d "$OUT/classes" $(find src "$OUT/gen" -name '*.java')

"$BT/d8" --release --min-api 30 --lib "$PLATFORM_JAR" --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')

cp "$OUT/base.apk" "$OUT/unaligned.apk"
(cd "$OUT/dex" && zip -q -X ../unaligned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unaligned.apk" "$OUT/aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-pass "file:$PASS" --out "$OUT/rumi-kiosk.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify "$OUT/rumi-kiosk.apk"

echo "Built $OUT/rumi-kiosk.apk  (version $VERSION_NAME, code $VERSION_CODE)"
