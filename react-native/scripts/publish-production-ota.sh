#!/usr/bin/env bash
# Publish a production EAS Update that installed Release binaries can actually receive.
#
# Why this exists: app.json uses runtimeVersion.policy=fingerprint. `eas update`
# hashes *this machine's* project. Cloud Agents / CI often compute a different
# fingerprint than the Mac that ran install-ios-release.sh. Publishing that new
# fingerprint is a silent no-op on devices — the update exists on Expo but phones
# never download it.
#
# Default: pin the publish to react-native/ota-target-runtimes.json (the runtimes
# embedded in installed phones). Pass --current-fingerprint only after installing
# a new Release binary from this same tree and updating ota-target-runtimes.json.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MESSAGE=""
USE_CURRENT_FINGERPRINT=0
TARGETS_FILE="$ROOT/ota-target-runtimes.json"

usage() {
  cat <<'EOF'
Usage: ./scripts/publish-production-ota.sh --message "short description" [--current-fingerprint]

  --message TEXT            Required. Shown on the Expo dashboard / OTA notifier.
  --current-fingerprint     Publish under this machine's fingerprint. Only after a
                            new Release binary was installed from this same tree,
                            and ota-target-runtimes.json was updated to match.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --message)
      MESSAGE="${2:-}"
      shift 2
      ;;
    --current-fingerprint)
      USE_CURRENT_FINGERPRINT=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown arg: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$MESSAGE" ]]; then
  echo "error: --message is required" >&2
  usage >&2
  exit 2
fi

EAS=(npx --yes eas-cli@latest)

if [[ "$USE_CURRENT_FINGERPRINT" -eq 1 ]]; then
  echo "==> Publishing with this machine's fingerprint (--current-fingerprint)"
  echo "    Reminder: update ota-target-runtimes.json to these hashes after install."
  exec "${EAS[@]}" update \
    --channel production \
    --environment production \
    --message "$MESSAGE" \
    --non-interactive
fi

if [[ ! -f "$TARGETS_FILE" ]]; then
  cat >&2 <<EOF
error: missing $TARGETS_FILE

Refusing to publish under this machine's fingerprint (phones would ignore it).
Record the iOS/Android runtime hashes from the installed Release binary in that
file, then re-run. See SETUP_GUIDE.md — Over-the-air updates.
EOF
  exit 1
fi

read_target() {
  local platform="$1"
  python3 - "$TARGETS_FILE" "$platform" <<'PY'
import json, sys
path, platform = sys.argv[1], sys.argv[2]
data = json.loads(open(path).read())
value = data.get(platform)
if not isinstance(value, str) or not value.strip() or value.startswith("<"):
    raise SystemExit(f"error: ota-target-runtimes.json missing a real {platform} hash")
print(value.strip())
PY
}

IOS_RUNTIME="$(read_target ios)"
ANDROID_RUNTIME="$(read_target android)"

echo "==> Target runtimes from ota-target-runtimes.json (installed binaries)"
echo "    ios=$IOS_RUNTIME"
echo "    android=$ANDROID_RUNTIME"

# Warn if this machine's fingerprint already matches (normal path possible).
CURRENT_IOS="$("${EAS[@]}" fingerprint:generate --platform ios --environment production --json --non-interactive 2>/dev/null | python3 -c 'import json,sys; r=sys.stdin.read(); i=r.find("{"); print(json.loads(r[i:]).get("hash",""))' || true)"
if [[ -n "$CURRENT_IOS" && "$CURRENT_IOS" == "$IOS_RUNTIME" ]]; then
  echo "==> This machine's iOS fingerprint already matches the target — publishing normally"
  exec "${EAS[@]}" update \
    --channel production \
    --environment production \
    --message "$MESSAGE" \
    --non-interactive
fi

if [[ -n "$CURRENT_IOS" && "$CURRENT_IOS" != "$IOS_RUNTIME" ]]; then
  echo "warning: this machine fingerprint ($CURRENT_IOS) != target ios ($IOS_RUNTIME)"
  echo "         Pinning publish to the target so installed phones receive the update."
fi

echo "==> Pinning temporary platform runtimeVersion values for publish only"
cp app.json app.json.ota-bak
cleanup() {
  if [[ -f app.json.ota-bak ]]; then
    mv app.json.ota-bak app.json
  fi
}
trap cleanup EXIT

python3 - "$IOS_RUNTIME" "$ANDROID_RUNTIME" <<'PY'
import json, sys
from pathlib import Path
ios_rt, android_rt = sys.argv[1], sys.argv[2]
path = Path("app.json")
data = json.loads(path.read_text())
expo = data["expo"]
expo.pop("runtimeVersion", None)
expo.setdefault("ios", {})["runtimeVersion"] = ios_rt
expo.setdefault("android", {})["runtimeVersion"] = android_rt
path.write_text(json.dumps(data, indent=2) + "\n")
PY

"${EAS[@]}" update \
  --channel production \
  --environment production \
  --message "$MESSAGE" \
  --non-interactive

echo "==> Restored app.json fingerprint policy"
cleanup
trap - EXIT

echo "Done. Force-quit the Release app twice to download + apply."
