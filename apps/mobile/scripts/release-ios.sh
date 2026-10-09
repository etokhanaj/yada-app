#!/usr/bin/env bash
# Archive Yada for the App Store and upload it to App Store Connect (TestFlight).
#
#   ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_<id>.p8 \
#   APPLE_TEAM_ID=… apps/mobile/scripts/release-ios.sh [--no-upload]
#
# --no-upload stops after the signed .ipa is exported. Each run bumps
# expo.ios.buildNumber in app.json; commit that change after an upload.
#
# The four values come from the environment and are never printed: xcodebuild
# logs its full command line, so every log is redacted before any of it is shown
# (CLAUDE.md rule 1). Exit codes are taken from the command itself, never through
# a pipe (rule 7).

set -euo pipefail

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

build="$(node -e '
  const fs = require("fs");
  const config = JSON.parse(fs.readFileSync("app.json", "utf8"));
  const next = Number(config.expo.ios.buildNumber ?? "0") + 1;
  if (!Number.isInteger(next) || next < 1) throw new Error("expo.ios.buildNumber is not a whole number");
  config.expo.ios.buildNumber = String(next);
  fs.writeFileSync("app.json", JSON.stringify(config, null, 2) + "\n");
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

step "archive" "$out/archive.log" xcodebuild archive \
  -workspace ios/Yada.xcworkspace \
  -scheme Yada \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$out/Yada.xcarchive" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  "${auth[@]}"

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

step "export" "$out/export.log" xcodebuild -exportArchive \
  -archivePath "$out/Yada.xcarchive" \
  -exportPath "$out/export" \
  -exportOptionsPlist "$private/ExportOptions.plist" \
  "${auth[@]}"

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
