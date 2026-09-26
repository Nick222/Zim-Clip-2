#!/bin/sh
set -eu

BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
EXT_DIR=$(CDPATH= cd -- "$BASE_DIR/.." && pwd)
EXT_ID=$(cat "$EXT_DIR/EXTENSION_ID")
HOST_DIR="$HOME/.config/chromium/NativeMessagingHosts"
HOST_PATH="$BASE_DIR/zimclip.py"
CONFIG_PATH="$BASE_DIR/config.json"
MANIFEST_PATH="$HOST_DIR/zimclip.json"

ZIM=$(command -v zim || true)
if [ -z "$ZIM" ]; then
    echo "ERROR: 'zim' executable was not found in PATH." >&2
    exit 1
fi

mkdir -p "$HOST_DIR"

python3 - "$CONFIG_PATH" "$MANIFEST_PATH" "$HOST_PATH" "$EXT_ID" "$ZIM" <<'PY'
import json, os, sys
config_path, manifest_path, host_path, ext_id, zim = sys.argv[1:]
with open(config_path, 'w', encoding='utf-8') as f:
    json.dump({'path': zim, 'marks': ':marks', 'clips': ':clips'}, f, ensure_ascii=False, indent=2)
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump({
        'name': 'zimclip',
        'description': 'Zim Clip Native Messaging host',
        'path': host_path,
        'type': 'stdio',
        'allowed_origins': ['chrome-extension://' + ext_id + '/']
    }, f, ensure_ascii=False, indent=2)
print('Native host:', manifest_path)
print('Extension ID:', ext_id)
print('Zim:', zim)
PY
