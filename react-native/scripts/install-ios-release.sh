#!/usr/bin/env bash
# Build a Release Echo binary wired to the Expo Update *production*
# channel, and install it on a connected physical iPhone.
# No Metro — JS is embedded; later `eas update --channel production`
# (or pnpm update:production) can OTA into this install when the
# runtime fingerprint matches.
#
# Usage (from anywhere):
#   ./react-native/scripts/install-ios-release.sh
#   ./react-native/scripts/install-ios-release.sh --pull
#   ./react-native/scripts/install-ios-release.sh --device 00008120-...
#   DEVICE_UDID=00008120-... ./react-native/scripts/install-ios-release.sh
#
# Prerequisites:
#   - Xcode installed; Apple Development signing identity available
#   - iPhone plugged in (or paired), unlocked, Developer Mode on
#   - react-native/.env with hosted EXPO_PUBLIC_SUPABASE_* values
#   - app.json updates.requestHeaders.expo-channel-name = production
#   - pnpm 11.17 (see packageManager in package.json)
set -euo pipefail

PULL=0
DEVICE_ARG="${DEVICE_UDID:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pull) PULL=1; shift ;;
    --device)
      DEVICE_ARG="${2:-}"
      if [[ -z "$DEVICE_ARG" ]]; then
        echo "error: --device needs a UDID" >&2
        exit 1
      fi
      shift 2
      ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "error: unknown arg: $1 (try --help)" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$RN_DIR/.." && pwd)"

if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
fi

die() { echo "error: $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

list_physical_iphones() {
  local json_out
  json_out="$(mktemp)"
  if xcrun devicectl list devices --json-output "$json_out" >/dev/null 2>&1; then
    python3 - "$json_out" <<'PY'
import json, sys
path = sys.argv[1]
try:
    data = json.load(open(path))
except Exception:
    raise SystemExit(0)
devices = data.get("result", {}).get("devices") or data.get("devices") or []
for d in devices:
    props = d.get("deviceProperties") or {}
    hw = d.get("hardwareProperties") or {}
    conn = d.get("connectionProperties") or {}
    name = props.get("name") or d.get("name") or "?"
    udid = d.get("identifier") or hw.get("udid") or props.get("udid") or ""
    dtype = str(hw.get("deviceType") or props.get("deviceType") or "")
    blob = f"{dtype} {name}".lower()
    if "simulat" in blob:
        continue
    if "iphone" not in blob and not str(udid).startswith("0000"):
        continue
    state = conn.get("tunnelState") or conn.get("pairingState") or ""
    print(f"{udid}\t{name}\t{state}")
PY
    rm -f "$json_out"
    return
  fi
  rm -f "$json_out"

  xcrun xctrace list devices 2>/dev/null | python3 -c '
import re, sys
for line in sys.stdin:
    if "iPhone" not in line or "(Simulator)" in line:
        continue
    m = re.search(r"\(([0-9A-Fa-f-]+)\)\s*$", line)
    if not m:
        continue
    name = re.sub(r" \(.*", "", line.strip())
    print(f"{m.group(1)}\t{name}")
'
}

pick_device() {
  if [[ -n "$DEVICE_ARG" ]]; then
    echo "$DEVICE_ARG"
    return
  fi

  local lines
  lines="$(list_physical_iphones | sed '/^$/d' || true)"
  if [[ -z "$lines" ]]; then
    die "no physical iPhone found. Plug it in, unlock it, tap Trust, enable Developer Mode, then retry (or pass --device <UDID> / DEVICE_UDID=...)."
  fi

  local count
  count="$(printf '%s\n' "$lines" | wc -l | tr -d ' ')"
  if [[ "$count" -gt 1 ]]; then
    echo "Multiple iPhones found:" >&2
    printf '%s\n' "$lines" | awk -F'\t' '{print "  " NR ") " $2 "  (" $1 ")"}' >&2
    die "pass --device <UDID> or DEVICE_UDID=<UDID>"
  fi

  printf '%s\n' "$lines" | awk -F'\t' 'NR==1 {print $1}'
}

echo "==> Echo iOS Release install"
echo "    project: $RN_DIR"

require_cmd pnpm
require_cmd xcrun
require_cmd python3

if [[ "$PULL" -eq 1 ]]; then
  echo "==> git pull origin main"
  git -C "$REPO_ROOT" checkout main
  git -C "$REPO_ROOT" pull --ff-only origin main
fi

ENV_FILE="$RN_DIR/.env"
[[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE — copy .env.example and set hosted EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"

if grep -Eq '^EXPO_PUBLIC_SUPABASE_URL=https?://127\.0\.0\.1' "$ENV_FILE"; then
  die ".env still points Supabase at 127.0.0.1 — a phone cannot reach that. Use your hosted https://<ref>.supabase.co URL."
fi
if ! grep -Eq '^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=.+' "$ENV_FILE"; then
  die ".env is missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
fi

# Local Release builds only receive OTAs if the production channel is
# embedded (EAS Build profiles set this automatically; expo run:ios does not).
if ! grep -q '"expo-channel-name"' "$RN_DIR/app.json" || ! grep -q '"production"' "$RN_DIR/app.json"; then
  die "app.json must set updates.requestHeaders.expo-channel-name to production for OTA"
fi
python3 - "$RN_DIR/app.json" <<'PY' || die "app.json expo-channel-name must be production"
import json, sys
cfg = json.load(open(sys.argv[1]))
headers = (cfg.get("expo") or {}).get("updates") or {}
headers = headers.get("requestHeaders") or {}
channel = headers.get("expo-channel-name")
if channel != "production":
    raise SystemExit(1)
print(f"    OTA channel: {channel}")
PY

echo "==> pnpm install"
(
  cd "$RN_DIR"
  CI=true pnpm install
)

DEVICE="$(pick_device)"
[[ -n "$DEVICE" ]] || die "empty device UDID"
echo "==> target device: $DEVICE"

# Fresh prebuild so Expo.plist gets updates URL + production channel.
# A stale ios/ tree can leave EXUpdatesEnabled=false and block all OTAs.
echo "==> expo prebuild (ios, refresh Expo.plist)"
(
  cd "$RN_DIR"
  pnpm exec expo prebuild --platform ios --no-install
)
PLIST_PRE="$RN_DIR/ios/Echo/Supporting/Expo.plist"
if [[ -f "$PLIST_PRE" ]]; then
  enabled="$(/usr/libexec/PlistBuddy -c 'Print :EXUpdatesEnabled' "$PLIST_PRE" 2>/dev/null || echo false)"
  channel="$(/usr/libexec/PlistBuddy -c 'Print :EXUpdatesRequestHeaders:expo-channel-name' "$PLIST_PRE" 2>/dev/null || true)"
  [[ "$enabled" == "true" ]] || die "Expo.plist EXUpdatesEnabled is not true after prebuild"
  [[ "$channel" == "production" ]] || die "Expo.plist channel is '$channel' (want production)"
  echo "    Expo.plist OK (enabled=$enabled, channel=$channel)"
fi

echo "==> expo run:ios (Release, production channel, no Metro)"
(
  cd "$RN_DIR"
  pnpm exec expo run:ios \
    --device "$DEVICE" \
    --configuration Release \
    --no-bundler
)

# Confirm native project kept the channel after prebuild/run
PLIST="$RN_DIR/ios/Echo/Supporting/Expo.plist"
if [[ ! -f "$PLIST" ]]; then
  PLIST="$(find "$RN_DIR/ios" -name Expo.plist 2>/dev/null | head -1 || true)"
fi
if [[ -n "${PLIST:-}" && -f "$PLIST" ]]; then
  if /usr/libexec/PlistBuddy -c 'Print :EXUpdatesRequestHeaders:expo-channel-name' "$PLIST" 2>/dev/null | grep -qx production; then
    echo "==> Expo.plist channel OK: production"
  else
    echo "warning: Expo.plist missing expo-channel-name=production — OTA may not attach" >&2
  fi
fi

echo "==> Updating ota-target-runtimes.json (mandatory after every Release install)"
TARGETS_FILE="$RN_DIR/ota-target-runtimes.json"
IOS_HASH="$(
  cd "$RN_DIR"
  npx --yes eas-cli@latest fingerprint:generate --platform ios --environment production --json --non-interactive 2>/dev/null \
    | python3 -c 'import json,sys; r=sys.stdin.read(); i=r.find("{"); print(json.loads(r[i:]).get("hash",""))' \
    || true
)"
if [[ -z "$IOS_HASH" || "$IOS_HASH" == "null" ]]; then
  echo "warning: could not generate iOS fingerprint — update $TARGETS_FILE by hand before the next OTA" >&2
else
  UPDATED_BY="install-ios-release.sh on $(hostname -s 2>/dev/null || hostname) $(date -u +%Y-%m-%d)"
  python3 - "$TARGETS_FILE" "$IOS_HASH" "$UPDATED_BY" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
ios_hash = sys.argv[2]
updated_by = sys.argv[3]
data = {}
if path.is_file():
    data = json.loads(path.read_text())
comment = data.get("_comment") or (
    "Runtime versions embedded in installed Release binaries. Agents MUST publish "
    "production OTAs against these hashes (see scripts/publish-production-ota.sh). "
    "Update this file when you install a new Release binary (install-ios-release.sh / eas build). "
    "Do not invent hashes from a Cloud Agent fingerprint:generate."
)
out = {
    "_comment": comment,
    "ios": ios_hash,
    "android": data.get("android") or "",
    "updatedAt": __import__("datetime").date.today().isoformat(),
    "updatedBy": updated_by,
}
path.write_text(json.dumps(out, indent=2) + "\n")
print(f"    wrote ios={ios_hash}")
print(f"    commit {path.name} so production OTAs pin to this phone")
PY
fi

echo
echo "Done. Unlock the phone and open Echo."
echo "OTA: this binary listens on Expo channel 'production'."
echo "Publish JS updates with: cd react-native && pnpm update:production --message '...'"
echo "Fingerprint must match (runtimeVersion policy: fingerprint) or the update is skipped."
echo "Commit react-native/ota-target-runtimes.json after this install (script refreshed the iOS hash)."
echo "If iOS blocks launch: Settings → General → VPN & Device Management → trust your Apple Development cert."
