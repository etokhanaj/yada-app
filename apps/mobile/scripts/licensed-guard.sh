# Sourced by release-ios.sh, and by src/lib/licensedGuard.test.ts, which runs these
# functions with fake values and never runs xcodebuild.
#
# Code review, 10 Oct 2026: a release or TestFlight build could carry the API.Bible key.
# expo-constants' Xcode build phase evaluates app.config.ts during `xcodebuild archive` with
# the inherited environment, after @expo/env has loaded apps/mobile/.env, .env.local and
# .env.production, and with-node.sh sources ios/.xcode.env and .xcode.env.local. Any of those
# could set the dev flag. Licensed text is display-only and its key must never reach testers
# (CLAUDE.md rules 1 and 9, docs/licensed-translations.md). Only names are reported, never
# values.

LICENSED_NAMES=(YADA_DEV_LICENSED API_BIBLE_KEY API_BIBLE_URL)

# Fails when any licensed name is non-empty in this environment, or defined in an env file
# that Expo or Xcode's node wrapper loads at build time. $1 is the apps/mobile directory.
refuse_licensed_build() {
  local app="$1" name file refused=0
  for name in "${LICENSED_NAMES[@]}"; do
    if [ -n "${!name:-}" ]; then
      echo "Refusing to build: $name is set in the environment. Unset it; licensed builds are dev-only." >&2
      refused=1
    fi
  done
  for file in "$app"/.env* "$app"/ios/.xcode.env*; do
    [ -f "$file" ] || continue
    for name in "${LICENSED_NAMES[@]}"; do
      # dotenv and bash both accept leading spaces and `export`; only the name is matched.
      if grep -qE "^[[:space:]]*(export[[:space:]]+)?$name[[:space:]]*=" "$file"; then
        echo "Refusing to build: $file defines $name, and it is loaded at build time." >&2
        refused=1
      fi
    done
  done
  return "$refused"
}

# Fails unless every EXConstants app.config inside the built .app ($1) has
# extra.apiBible.enabled not true and an empty key. Fails closed when there is none to check.
assert_no_licensed_key() {
  local bundle="$1" config found=0
  while IFS= read -r config; do
    found=1
    node -e '
      let config;
      try {
        config = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      } catch {
        console.error("The archive app.config is not JSON; cannot confirm it is free of the API.Bible key.");
        process.exit(1);
      }
      const apiBible = config?.extra?.apiBible;
      if (apiBible !== undefined && (apiBible.enabled === true || (apiBible.key !== undefined && apiBible.key !== ""))) {
        console.error("API.Bible key found in the archive");
        process.exit(1);
      }
    ' "$config" || return 1
  done < <(find "$bundle" -path "*/EXConstants.bundle/app.config" -type f)
  if [ "$found" -eq 0 ]; then
    echo "No EXConstants.bundle/app.config in $bundle; cannot confirm it is free of the API.Bible key." >&2
    return 1
  fi
}
