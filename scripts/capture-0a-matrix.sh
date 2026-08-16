#!/usr/bin/env bash
# Captures the 0A Dynamic Type screenshot matrix.
#
# Every frame is addressed by deep link rather than a tap sequence, so the
# matrix can be recaptured identically after any change and diffed against the
# committed set. Usage: scripts/capture-0a-matrix.sh [udid|booted]
set -euo pipefail

UDID="${1:-booted}"
SIMCTL=/Applications/Xcode.app/Contents/Developer/usr/bin/simctl
OUT="$(cd "$(dirname "$0")/.." && pwd)/docs/0a"
mkdir -p "$OUT"

# iOS content sizes: default, one step up, and two accessibility sizes.
sizes=(large extra-extra-large accessibility-extra-large accessibility-extra-extra-extra-large)
labels=(large xxlarge ax3 ax5)

# label:query — every parameter is always explicit so state never leaks between frames.
states=(
  "reader:passage=0&understand=0&original=0"
  "understand:passage=0&understand=1&original=0"
  "greek:passage=1&understand=1&original=1"
  "hebrew:passage=2&understand=1&original=1"
)

for index in "${!sizes[@]}"; do
  "$SIMCTL" ui "$UDID" content_size "${sizes[$index]}"
  sleep 1
  for state in "${states[@]}"; do
    name="${state%%:*}"
    query="${state#*:}"
    "$SIMCTL" openurl "$UDID" "yada:///?${query}"
    sleep 2.5
    "$SIMCTL" io "$UDID" screenshot --type=png "$OUT/${name}-${labels[$index]}.png" >/dev/null
    echo "captured ${name}-${labels[$index]}.png"
  done
done

# Leave the simulator at the default size.
"$SIMCTL" ui "$UDID" content_size large
echo "matrix written to $OUT"
