# Sourced by release-ios.sh, and by src/lib/licensedBuild.test.ts, which runs these
# functions with fake values and never runs xcodebuild.
#
# Code review, 10 Oct 2026: a release or TestFlight build could carry the API.Bible key.
# expo-constants' Xcode build phase evaluates app.config.ts during `xcodebuild archive` with
# the inherited environment, after @expo/env has loaded apps/mobile/.env, .env.local and
# .env.production, and with-node.sh sources ios/.xcode.env and .xcode.env.local. Any of those
# could set the dev flag. Licensed text is display-only and its key must never reach testers
# (CLAUDE.md rules 1 and 9, docs/licensed-translations.md). Only names are reported, never
# values.
#
# 12 Oct 2026: tester builds read NKJV and NLT through Yada's proxy, whose URL
# (EXPO_PUBLIC_LICENSED_PROXY_URL) is allowed. The key is still refused under any name.

LICENSED_NAMES=(YADA_DEV_LICENSED API_BIBLE_KEY API_BIBLE_URL)

# True for a name that must never reach a release build: the three above, or any other name
# carrying API_BIBLE (EXPO_PUBLIC_API_BIBLE_KEY would be inlined into the JS bundle).
is_licensed_name() {
  case "$1" in
    YADA_DEV_LICENSED | *API_BIBLE*) return 0 ;;
    *) return 1 ;;
  esac
}

# Fails when any licensed name is non-empty in this environment, or defined in an env file
# that Expo or Xcode's node wrapper loads at build time. $1 is the apps/mobile directory.
refuse_licensed_build() {
  local app="$1" name names file refused=0
  for name in $(compgen -e); do
    is_licensed_name "$name" || continue
    if [ -n "${!name:-}" ]; then
      echo "Refusing to build: $name is set in the environment. Unset it; licensed builds are dev-only." >&2
      refused=1
    fi
  done
  for file in "$app"/.env* "$app"/ios/.xcode.env*; do
    [ -f "$file" ] || continue
    # dotenv and bash both accept leading spaces and `export`; only names are read, never values.
    # Captured first, so a file sed cannot read refuses the build instead of passing (rule 7).
    if ! names="$(sed -nE 's/^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=.*/\2/p' "$file")"; then
      echo "Refusing to build: cannot read $file to check it." >&2
      refused=1
      continue
    fi
    for name in $names; do
      if is_licensed_name "$name"; then
        echo "Refusing to build: $file defines $name, and it is loaded at build time." >&2
        refused=1
      fi
    done
  done
  return "$refused"
}

# Fails unless every EXConstants app.config inside the built .app ($1) has
# extra.apiBible.enabled not true and an empty key, and any licensedProxy URL is plain https
# with no credentials. Fails closed when there is none to check.
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
      const proxy = config?.extra?.licensedProxy?.url;
      if (proxy !== undefined && proxy !== "") {
        let url;
        try {
          url = new URL(proxy);
        } catch {
          console.error("The archived licensed proxy URL is not a URL.");
          process.exit(1);
        }
        if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.search !== "" || /(^|\.)api\.bible$/i.test(url.hostname)) {
          console.error("The archived licensed proxy URL must be https, carry no credentials or query, and not be API.Bible.");
          process.exit(1);
        }
      }
    ' "$config" || return 1
  done < <(find "$bundle" -path "*/EXConstants.bundle/app.config" -type f)
  if [ "$found" -eq 0 ]; then
    echo "No EXConstants.bundle/app.config in $bundle; cannot confirm it is free of the API.Bible key." >&2
    return 1
  fi
}

# Fails when the API.Bible key held in the env file $2 (the repo's gitignored .env.local)
# appears anywhere in the built .app ($1): JS bundle, config or any resource, whatever name it
# came in under. The value stays in this function: it reaches grep on a pipe from printf, never
# argv, and is never printed. Passes when the file or the name is absent.
assert_key_value_absent() {
  local bundle="$1" envfile="$2" value status=0
  [ -f "$envfile" ] || return 0
  if ! value="$(awk '/^[[:space:]]*(export[[:space:]]+)?API_BIBLE_KEY[[:space:]]*=/ { sub(/^[^=]*=[[:space:]]*/, ""); print; exit }' "$envfile")"; then
    echo "Cannot read $envfile; cannot confirm the archive is free of the API.Bible key." >&2
    return 1
  fi
  value="${value%$'\r'}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  [ -n "$value" ] || return 0
  if [ "${#value}" -lt 12 ]; then
    echo "API_BIBLE_KEY in $envfile is too short to search for safely; cannot confirm the archive is free of it." >&2
    return 1
  fi
  grep -rqF -f <(printf '%s\n' "$value") "$bundle" || status=$?
  case "$status" in
    0)
      echo "API.Bible key found in $bundle" >&2
      return 1
      ;;
    1) return 0 ;;
    *)
      echo "Could not search $bundle for the API.Bible key (grep exit $status)." >&2
      return 1
      ;;
  esac
}
