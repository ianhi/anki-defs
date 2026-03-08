#!/usr/bin/env bash
# check-api-contract.sh -- Verify all backends implement the required API routes.
# Reads shared/api-routes.json and checks each backend's route registrations.
# Exit 0 = all required routes present. Exit 1 = missing routes found.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACT="$ROOT_DIR/shared/api-routes.json"

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not installed." >&2
  exit 1
fi

if [[ ! -f "$CONTRACT" ]]; then
  echo "ERROR: $CONTRACT not found." >&2
  exit 1
fi

# Colors (disabled if not a terminal)
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BOLD=''; RESET=''
fi

FAIL=0
WARN=0

# Read required routes into arrays
METHODS=()
PATHS=()
while IFS=$'\t' read -r method path; do
  METHODS+=("$method")
  PATHS+=("$path")
done < <(jq -r '.routes[] | [.method, .path] | @tsv' "$CONTRACT")

# Read optional routes for reference
OPT_METHODS=()
OPT_PATHS=()
while IFS=$'\t' read -r method path; do
  OPT_METHODS+=("$method")
  OPT_PATHS+=("$path")
done < <(jq -r '.optional[] | [.method, .path] | @tsv' "$CONTRACT")

# --- Normalize a route for comparison: replace :params with :param ---
normalize_route() {
  echo "$1" | sed 's|:[a-zA-Z_][a-zA-Z0-9_]*|:param|g'
}

# --- Check if a route is in the known set ---
is_known_route() {
  local method="$1" path="$2"
  local norm_path
  norm_path=$(normalize_route "$path")

  for i in "${!METHODS[@]}"; do
    local k_norm
    k_norm=$(normalize_route "${PATHS[$i]}")
    if [[ "${METHODS[$i]}" == "$method" && "$k_norm" == "$norm_path" ]]; then
      return 0
    fi
  done
  for i in "${!OPT_METHODS[@]}"; do
    local k_norm
    k_norm=$(normalize_route "${OPT_PATHS[$i]}")
    if [[ "${OPT_METHODS[$i]}" == "$method" && "$k_norm" == "$norm_path" ]]; then
      return 0
    fi
  done
  return 1
}

# --- Check route presence in Express backend ---
check_express_route() {
  local method="$1" path="$2"
  local method_lower
  method_lower="$(echo "$method" | tr '[:upper:]' '[:lower:]')"

  local file sub_path

  if [[ "$path" == /api/anki/* ]]; then
    file="$ROOT_DIR/ankiconnect-server/src/routes/anki.ts"
    sub_path="${path#/api/anki}"
  elif [[ "$path" == /api/chat/* ]]; then
    file="$ROOT_DIR/ankiconnect-server/src/routes/chat.ts"
    sub_path="${path#/api/chat}"
  elif [[ "$path" == /api/settings ]]; then
    file="$ROOT_DIR/ankiconnect-server/src/routes/settings.ts"
    sub_path="/"
  elif [[ "$path" == /api/session ]]; then
    file="$ROOT_DIR/ankiconnect-server/src/routes/session.ts"
    sub_path="/"
  elif [[ "$path" == /api/session/* ]]; then
    file="$ROOT_DIR/ankiconnect-server/src/routes/session.ts"
    sub_path="${path#/api/session}"
  elif [[ "$path" == /api/health || "$path" == /api/platform ]]; then
    file="$ROOT_DIR/ankiconnect-server/src/index.ts"
    sub_path="$path"
  else
    return 1
  fi

  [[ -f "$file" ]] || return 1

  # For grep: escape the path for use in a fixed-string-like search
  # We use fgrep-style by checking for the literal sub_path string in the right context
  # Handle parameterized paths: /notes/:id -> look for /notes/:
  local search_str="$sub_path"

  # Check: does the file contain router.METHOD('sub_path' or app.METHOD('path'?
  if grep -q "${method_lower}Router\.\|Router();" "$file" 2>/dev/null; then
    # It's a router file -- variable is named *Router
    if grep -qF ".${method_lower}('${search_str}'" "$file" 2>/dev/null; then
      return 0
    fi
    # Try with parameterized path: /notes/:id -> search for '/notes/:
    local param_prefix="${search_str%%:*}"
    if [[ "$param_prefix" != "$search_str" ]]; then
      if grep -qF ".${method_lower}('${param_prefix}" "$file" 2>/dev/null; then
        return 0
      fi
    fi
  fi

  # Check app-level routes
  if grep -qF "app.${method_lower}('${search_str}'" "$file" 2>/dev/null; then
    return 0
  fi

  return 1
}

# --- Check route presence in anki-addon ---
check_addon_route() {
  local method="$1" path="$2"
  local method_lower
  method_lower="$(echo "$method" | tr '[:upper:]' '[:lower:]')"
  local file="$ROOT_DIR/anki-addon/handlers/__init__.py"

  [[ -f "$file" ]] || return 1

  # Addon uses full paths: router.get("/api/anki/decks", handler)
  # For parameterized: router.get("/api/anki/notes/:id", ...)
  local search_str="$path"
  local param_prefix="${search_str%%:*}"

  if grep -qF "router.${method_lower}(\"${search_str}\"" "$file" 2>/dev/null; then
    return 0
  fi
  # Parameterized path
  if [[ "$param_prefix" != "$search_str" ]]; then
    if grep -qF "router.${method_lower}(\"${param_prefix}" "$file" 2>/dev/null; then
      return 0
    fi
  fi

  return 1
}

# --- Check route presence in Android backend ---
check_android_route() {
  local method="$1" path="$2"
  local server_file="$ROOT_DIR/android/app/src/main/kotlin/com/word2anki/server/LocalServer.kt"
  local anki_file="$ROOT_DIR/android/app/src/main/kotlin/com/word2anki/server/AnkiHandler.kt"
  local chat_file="$ROOT_DIR/android/app/src/main/kotlin/com/word2anki/server/ChatHandler.kt"
  local settings_file="$ROOT_DIR/android/app/src/main/kotlin/com/word2anki/server/SettingsHandler.kt"

  if [[ "$path" == /api/health || "$path" == /api/platform ]]; then
    grep -qF "\"$path\"" "$server_file" 2>/dev/null && return 0

  elif [[ "$path" == /api/anki/* ]]; then
    local sub="${path#/api/anki}"
    [[ -f "$anki_file" ]] || return 1
    # Direct match: path == "/decks"
    if grep -qF "\"$sub\"" "$anki_file" 2>/dev/null; then
      return 0
    fi
    # Regex match for parameterized: /notes/:id -> Regex("/notes/
    local param_prefix="${sub%%:*}"
    if [[ "$param_prefix" != "$sub" ]]; then
      if grep -qF "\"${param_prefix}" "$anki_file" 2>/dev/null; then
        return 0
      fi
    fi

  elif [[ "$path" == /api/chat/* ]]; then
    local sub="${path#/api/chat}"
    [[ -f "$chat_file" ]] || return 1
    if grep -qF "\"$sub\"" "$chat_file" 2>/dev/null; then
      return 0
    fi

  elif [[ "$path" == /api/settings ]]; then
    # Settings is dispatched by LocalServer to SettingsHandler which handles by method
    if grep -qF "/api/settings" "$server_file" 2>/dev/null; then
      local method_upper="$method"
      if grep -qF "Method.${method_upper}" "$settings_file" 2>/dev/null; then
        return 0
      fi
    fi

  elif [[ "$path" == /api/session* ]]; then
    # Android doesn't have session routes - will show as FAIL
    return 1
  fi

  return 1
}

# --- Check a single backend ---
check_backend() {
  local name="$1"

  echo -e "\n${BOLD}=== $name ===${RESET}"

  local missing=0

  for i in "${!METHODS[@]}"; do
    local method="${METHODS[$i]}"
    local path="${PATHS[$i]}"
    local found=false

    case "$name" in
      "ankiconnect-server") check_express_route "$method" "$path" && found=true ;;
      "anki-addon")         check_addon_route "$method" "$path" && found=true ;;
      "android")            check_android_route "$method" "$path" && found=true ;;
    esac

    if $found; then
      echo -e "  ${GREEN}PASS${RESET}  $method $path"
    else
      echo -e "  ${RED}FAIL${RESET}  $method $path"
      missing=$((missing + 1))
    fi
  done

  if [[ $missing -gt 0 ]]; then
    echo -e "  ${RED}$missing required route(s) missing${RESET}"
    FAIL=1
  fi

  # Check for extra routes
  check_extra_routes "$name"
}

# --- Detect extra routes not in the contract ---
check_extra_routes() {
  local name="$1"

  case "$name" in
    "ankiconnect-server")
      local -A prefixes=(
        ["$ROOT_DIR/ankiconnect-server/src/routes/anki.ts"]="/api/anki"
        ["$ROOT_DIR/ankiconnect-server/src/routes/chat.ts"]="/api/chat"
        ["$ROOT_DIR/ankiconnect-server/src/routes/settings.ts"]="/api/settings"
        ["$ROOT_DIR/ankiconnect-server/src/routes/session.ts"]="/api/session"
      )
      for file in "${!prefixes[@]}"; do
        [[ -f "$file" ]] || continue
        local prefix="${prefixes[$file]}"
        # Extract: ankiRouter.get('/path' -> GET, /path
        while read -r method_lower sub_path; do
          [[ -z "$method_lower" || -z "$sub_path" ]] && continue
          local method
          method=$(echo "$method_lower" | tr '[:lower:]' '[:upper:]')
          local full_path
          [[ "$sub_path" == "/" ]] && full_path="$prefix" || full_path="${prefix}${sub_path}"
          if ! is_known_route "$method" "$full_path"; then
            echo -e "  ${YELLOW}EXTRA${RESET} $method $full_path (not in contract)"
            WARN=$((WARN + 1))
          fi
        done < <(grep -oE '\.(get|post|put|delete)\('"'"'([^'"'"']*)'"'" "$file" 2>/dev/null \
                 | sed "s/^\.\([a-z]*\)('\(.*\)'/\1 \2/" || true)
      done
      # Also check app-level routes in index.ts (skip catch-all '*' route)
      local idx="$ROOT_DIR/ankiconnect-server/src/index.ts"
      if [[ -f "$idx" ]]; then
        while read -r method_lower sub_path; do
          [[ -z "$method_lower" || -z "$sub_path" ]] && continue
          [[ "$sub_path" == "*" ]] && continue
          local method
          method=$(echo "$method_lower" | tr '[:lower:]' '[:upper:]')
          if ! is_known_route "$method" "$sub_path"; then
            echo -e "  ${YELLOW}EXTRA${RESET} $method $sub_path (not in contract)"
            WARN=$((WARN + 1))
          fi
        done < <(grep -oE 'app\.(get|post|put|delete)\('"'"'([^'"'"']*)'"'" "$idx" 2>/dev/null \
                 | sed "s/^app\.\([a-z]*\)('\(.*\)'/\1 \2/" || true)
      fi
      ;;

    "anki-addon")
      local file="$ROOT_DIR/anki-addon/handlers/__init__.py"
      [[ -f "$file" ]] || return 0
      while read -r method_lower full_path; do
        [[ -z "$method_lower" || -z "$full_path" ]] && continue
        local method
        method=$(echo "$method_lower" | tr '[:lower:]' '[:upper:]')
        if ! is_known_route "$method" "$full_path"; then
          echo -e "  ${YELLOW}EXTRA${RESET} $method $full_path (not in contract)"
          WARN=$((WARN + 1))
        fi
      done < <(grep -oE 'router\.(get|post|put|delete)\("([^"]*)"' "$file" 2>/dev/null \
               | sed 's/^router\.\([a-z]*\)("\(.*\)"/\1 \2/' || true)
      ;;

    "android")
      local chat_file="$ROOT_DIR/android/app/src/main/kotlin/com/word2anki/server/ChatHandler.kt"
      if [[ -f "$chat_file" ]]; then
        # ChatHandler routes are in a when block with string patterns like "/stream"
        while read -r sub; do
          [[ -z "$sub" ]] && continue
          local full_path="/api/chat$sub"
          if ! is_known_route "POST" "$full_path"; then
            echo -e "  ${YELLOW}EXTRA${RESET} POST $full_path (not in contract)"
            WARN=$((WARN + 1))
          fi
        done < <(grep -oE '^\s+"(/[a-z]+)"' "$chat_file" 2>/dev/null \
                 | sed 's/.*"\(.*\)"/\1/' || true)
      fi
      ;;
  esac
}

echo -e "${BOLD}API Contract Check${RESET}"
echo "Contract: $CONTRACT"
echo "Required routes: ${#METHODS[@]}"
echo "Optional routes: ${#OPT_METHODS[@]}"

check_backend "ankiconnect-server"
check_backend "anki-addon"
check_backend "android"

# --- Summary ---
echo ""
if [[ $FAIL -ne 0 ]]; then
  echo -e "${RED}${BOLD}FAILED${RESET}: Some required routes are missing."
  exit 1
elif [[ $WARN -gt 0 ]]; then
  echo -e "${GREEN}${BOLD}PASSED${RESET} with ${YELLOW}$WARN warning(s)${RESET} (extra routes not in contract)."
  exit 0
else
  echo -e "${GREEN}${BOLD}PASSED${RESET}: All required routes present in all backends."
  exit 0
fi
