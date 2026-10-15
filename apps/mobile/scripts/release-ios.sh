#!/usr/bin/env bash
# Archive Yada for the App Store and upload it to App Store Connect (TestFlight).
#
#   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_<id>.p8 \
#   APPLE_TEAM_ID=… apps/mobile/scripts/release-ios.sh [--no-upload]
#
# --no-upload stops after the signed .ipa is exported. Each run bumps
# build.json (read by app.config.ts as ios.buildNumber); commit that change after an upload.
#
# The four values come from the environment and are never printed: xcodebuild
# logs its full command line, so every log is redacted before any of it is shown
# (CLAUDE.md rule 1). Exit codes are taken from the command itself, never through
# a pipe (rule 7).

set -euo pipefail
# CocoaPods (prebuild's pod install) fails with an encoding error in a shell without a UTF-8 locale (15 Oct 2026).
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

upload=1
case "${1:-}" in
  "") ;;
  --no-upload) upload=0 ;;
  *) echo "usage: $0 [--no-upload]" >&2; exit 2 ;;
esac

for name in ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_PATH APPLE_TEAM_ID; do
  if [ -z "${!name:-}" ]; then
    echo "$name is not set." >&2
    exit 2
  fi
done
if [ ! -r "$ASC_KEY_PATH" ]; then
  echo "ASC_KEY_PATH does not point to a readable file." >&2
  exit 2
fi
# altool finds the key by name in API_PRIVATE_KEYS_DIR, so the file must be
# called what App Store Connect called it.
if [ "$(basename "$ASC_KEY_PATH")" != "AuthKey_${ASC_KEY_ID}.p8" ]; then
  echo "ASC_KEY_PATH must name the file AuthKey_<ASC_KEY_ID>.p8, as App Store Connect downloads it." >&2
  exit 2
fi
if ! command -v node >/dev/null; then
  echo "node is not on PATH; Xcode's bundle phase needs it. Run: export PATH=\"\$HOME/.nvm/versions/node/v24.15.0/bin:\$PATH\"" >&2
  exit 2
fi

# CocoaPods fails on a non-UTF-8 locale.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

app="$(cd "$(dirname "$0")/.." && pwd)"
cd "$app"

# Code review, 10 Oct 2026: the API.Bible key reached release builds through the environment
# and apps/mobile/.env*. Refused before anything evaluates app.config.ts (prebuild included).
# shellcheck source=licensed-guard.sh
source "$app/scripts/licensed-guard.sh"
if ! refuse_licensed_build "$app"; then
  exit 1
fi
# The proxy URL is the one licensed setting a release may carry (12 Oct 2026): not a secret, and
# app.config.ts refuses one that is not https. Without it the build offers no licensed versions.
if [ -n "${EXPO_PUBLIC_LICENSED_PROXY_URL:-}" ]; then
  echo "Licensed translations: through $EXPO_PUBLIC_LICENSED_PROXY_URL"
else
  echo "Licensed translations: off (EXPO_PUBLIC_LICENSED_PROXY_URL is not set)"
fi

redact() {
  perl -pi -e '
    for my $name (qw(ASC_KEY_PATH ASC_KEY_ID ASC_ISSUER_ID APPLE_TEAM_ID)) {
      my $value = $ENV{$name};
      s/\Q$value\E/[$name]/g if length $value;
    }' "$1"
}

# Runs a step with its output in a log, redacts the log, and on failure shows
# its tail and exits with the step's own status.
step() {
  local label="$1" log="$2"
  shift 2
  echo "→ $label"
  if "$@" >"$log" 2>&1; then
    redact "$log"
  else
    local status=$?
    redact "$log"
    tail -n 40 "$log" >&2
    echo "$label failed (exit $status). Full log: $log" >&2
    exit "$status"
  fi
}

node scripts/sync-bundles.mjs
# Rule 6: unreviewed-dev bundles are for local builds only. An upload reaches
# testers, so it is refused; --no-upload keeps the archive on this Mac.
if grep -q '"review_gate": "unreviewed-dev"' src/data/bundled.generated.ts; then
  if [ "$upload" -eq 1 ]; then
    echo "Refusing to upload: the app bundles unreviewed-dev Understand bundles (see the list above)." >&2
    echo "Package only reviewed bundles, or run with --no-upload for a local archive." >&2
    exit 1
  fi
  echo "Warning: unreviewed-dev bundles are in this archive. It must not be uploaded." >&2
fi

if [ ! -d ios/Yada.xcworkspace ]; then
  npx expo prebuild --platform ios
fi
# iCloud sync (Oct 2026) added an entitlement and a native module, and an ios/ generated before
# them archives without either: sync silently off. Prebuild only runs when ios/ is missing, so
# the project is checked instead of trusted.
if ! /usr/libexec/PlistBuddy -c "Print :com.apple.developer.ubiquity-kvstore-identifier" ios/Yada/Yada.entitlements >/dev/null 2>&1 \
  || ! grep -q "YadaCloud" ios/Podfile.lock; then
  echo "ios/ predates iCloud sync. Regenerate it: npx expo prebuild --platform ios --clean" >&2
  exit 1
fi
# Build 6 added the reminder's long-press view as its own extension (targets/notification, SX-14). An ios/
# generated before it archives without it, and the long-press shows iOS's plain text instead.
if ! grep -q "YadaNotification" ios/Yada.xcodeproj/project.pbxproj; then
  echo "ios/ predates the notification extension. Regenerate it: npx expo prebuild --platform ios --clean" >&2
  exit 1
fi

build="$(node -e '
  const fs = require("fs");
  const build = JSON.parse(fs.readFileSync("build.json", "utf8"));
  const next = Number(build.buildNumber ?? "0") + 1;
  if (!Number.isInteger(next) || next < 1) throw new Error("build.json buildNumber is not a whole number");
  build.buildNumber = String(next);
  fs.writeFileSync("build.json", JSON.stringify(build, null, 2) + "\n");
  console.log(next);
')"
# Prebuild copies buildNumber into Info.plist only when it generates the
# project, so an existing project is updated directly.
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $build" ios/Yada/Info.plist
version="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" ios/Yada/Info.plist)"
echo "Yada $version ($build)"

out="$app/build/release/$build"
mkdir -p "$out"
private="$(mktemp -d)"
trap 'rm -rf "$private"' EXIT

auth=(
  -allowProvisioningUpdates
  -authenticationKeyPath "$ASC_KEY_PATH"
  -authenticationKeyID "$ASC_KEY_ID"
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"
)

# Defence in depth (review, 10 Oct 2026): the archive's config phase never sees the licensed
# names, even if one appears between the check above and here.
step "archive" "$out/archive.log" env -u YADA_DEV_LICENSED -u API_BIBLE_KEY -u API_BIBLE_URL xcodebuild archive \
  -workspace ios/Yada.xcworkspace \
  -scheme Yada \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$out/Yada.xcarchive" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  CURRENT_PROJECT_VERSION="$build" \
  "${auth[@]}"

# Every bundle inside must carry the app's build number: build 5 shipped a widget still at 4 (ITMS-90473,
# 13 Oct 2026), because its Info.plist reads CURRENT_PROJECT_VERSION, fixed when ios/ was generated.
for plist in "$out"/Yada.xcarchive/Products/Applications/Yada.app/PlugIns/*.appex/Info.plist; do
  [ -e "$plist" ] || continue
  if [ "$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$plist")" != "$build" ]; then
    echo "$(basename "$(dirname "$plist")") is not build $build. Refusing to export." >&2
    exit 1
  fi
done

# And the result is checked: the embedded Expo config must carry no key (review, 10 Oct 2026).
if ! assert_no_licensed_key "$out/Yada.xcarchive/Products/Applications/Yada.app"; then
  echo "Refusing to export $out/Yada.xcarchive. Delete it; it must not be uploaded." >&2
  exit 1
fi
# The key's value, searched for anywhere in the app, under whatever name it might have come in
# (12 Oct 2026: the proxy made licensed text reach testers, so the key's absence is checked, not
# assumed). The value is read inside the function and never printed.
# Both this checkout's .env.local and the main checkout's, since a worktree has none of its own.
main_root="$(cd "$(git -C "$app" rev-parse --path-format=absolute --git-common-dir)/.." && pwd)"
for envfile in "$app/../../.env.local" "$main_root/.env.local"; do
  if ! assert_key_value_absent "$out/Yada.xcarchive/Products/Applications/Yada.app" "$envfile"; then
    echo "Refusing to export $out/Yada.xcarchive. Delete it; it must not be uploaded." >&2
    exit 1
  fi
done

# Holds the team id, so it lives in the private temp dir, not next to the logs.
cat >"$private/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>export</string>
  <key>signingStyle</key><string>automatic</string>
  <key>teamID</key><string>$APPLE_TEAM_ID</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST

# With the API key, export asks Apple to sign in the cloud, and a key without the Admin role is
# refused ("Cloud signing permission error", 10 Oct 2026). When this Mac holds an Apple Distribution
# certificate for the team, export signs locally and lets Xcode's signed-in account create the
# App Store profile instead; the key is still what uploads.
# Captured first, not piped into grep -q: under pipefail an early grep exit can fail the pipe on
# a match (rule 7).
export_auth=("${auth[@]}")
identities="$(security find-identity -v -p codesigning)"
while IFS= read -r line; do
  case "$line" in
    *"Apple Distribution"*"($APPLE_TEAM_ID)"*) export_auth=(-allowProvisioningUpdates) ;;
  esac
done <<<"$identities"

step "export" "$out/export.log" xcodebuild -exportArchive \
  -archivePath "$out/Yada.xcarchive" \
  -exportPath "$out/export" \
  -exportOptionsPlist "$private/ExportOptions.plist" \
  "${export_auth[@]}"

ipa="$out/export/Yada.ipa"
if [ ! -f "$ipa" ]; then
  echo "Export finished but $ipa is missing." >&2
  exit 1
fi

if [ "$upload" -eq 0 ]; then
  echo "Exported $ipa (not uploaded)."
  exit 0
fi

export API_PRIVATE_KEYS_DIR
API_PRIVATE_KEYS_DIR="$(dirname "$ASC_KEY_PATH")"
step "upload" "$out/upload.log" xcrun altool --upload-app -f "$ipa" -t ios --api-key "$ASC_KEY_ID" --api-issuer "$ASC_ISSUER_ID"
echo "Uploaded Yada $version ($build). It appears in TestFlight once App Store Connect finishes processing."
