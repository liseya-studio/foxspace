#!/bin/bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 || ( $# -eq 3 && "$3" != "--closed" ) ]]; then
  echo "Usage: $0 <update.app> <installed.app> [--closed]" >&2
  exit 2
fi

candidate="${1%/}"
installed="${2%/}"
bundle_id="studio.liseya.foxspace"

for app in "$candidate" "$installed"; do
  [[ "$app" == *.app && -d "$app" && ! -L "$app" ]] || { echo "Expected an app bundle: $app" >&2; exit 1; }
  actual_id="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$app/Contents/Info.plist")"
  [[ "$actual_id" == "$bundle_id" ]] || { echo "This bundle is not Fox Space: $app" >&2; exit 1; }
done
[[ ! "$candidate" -ef "$installed" ]] || { echo "The candidate must be staged separately." >&2; exit 1; }

executable="$(/usr/libexec/PlistBuddy -c 'Print CFBundleExecutable' "$candidate/Contents/Info.plist")"
[[ "$executable" != */* && -x "$candidate/Contents/MacOS/$executable" ]]
/usr/bin/lipo -verify_arch arm64 "$candidate/Contents/MacOS/$executable"
/usr/bin/codesign --verify --strict --deep "$candidate"

directory="$(cd "$(dirname "$installed")" && pwd -P)"
installed="$directory/$(basename "$installed")"
stage="$(mktemp -d "$directory/.foxspace-update.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
replacement="$stage/Fox-Space.app"
/usr/bin/ditto "$candidate" "$replacement"
if ! /usr/bin/xattr -p com.apple.quarantine "$replacement" >/dev/null 2>&1; then
  if quarantine="$(/usr/bin/xattr -px com.apple.quarantine "$installed" 2>/dev/null)"; then
    /usr/bin/xattr -wx com.apple.quarantine "$(printf '%s' "$quarantine" | tr -d '[:space:]')" "$replacement"
  fi
fi
/usr/bin/codesign --verify --strict --deep "$replacement"

/usr/bin/swift -module-cache-path "$stage/swift-cache" - "$installed" "$replacement" "$bundle_id" "${3-}" <<'SWIFT'
import AppKit
import Darwin

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

let target = CommandLine.arguments[1]
let replacement = CommandLine.arguments[2]
let bundleID = CommandLine.arguments[3]
let closedConfirmed = CommandLine.arguments[4] == "--closed"
let running = NSWorkspace.shared.runningApplications

if running.contains(where: { $0.bundleIdentifier == bundleID }) {
    fail("Quit Fox Space with Command-Q before updating.")
}
if running.isEmpty && !closedConfirmed {
    fail("Cannot inspect running apps from here. After quitting Fox Space, rerun with --closed.")
}
if renamex_np(target, replacement, UInt32(RENAME_SWAP)) != 0 {
    fail("Cannot replace Fox Space: " + String(cString: strerror(errno)))
}
SWIFT
echo "Fox Space updated: $installed"
