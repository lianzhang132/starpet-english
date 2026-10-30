#!/usr/bin/env bash
set -euo pipefail
model_dir="${STARPET_MODEL_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)/server/models}"
mkdir -p -- "$model_dir"
cd -- "$model_dir"
umask 022
file=ggml-small.en-q5_1.bin
digest=bfdff4894dcb76bbf647d56263ea2a96645423f1669176f4844a1bf8e478ad30
# Upstream HF revision 5359861c739e955e79d9a303bcbc70fb988958b1,
# LFS blob bf61baaf463626fe45fc9157b8e9c69de8943c87; size and SHA-256
# verified using the repository's official revision API (?blobs=true).
verify_model() {
  [ -f "$1" ] && [ ! -L "$1" ] &&
    [ "$(stat -c%s "$1")" = 190098681 ] &&
    [ "$(sha256sum "$1" | cut -d' ' -f1)" = "$digest" ]
}
if [ -e "$file" ] || [ -L "$file" ]; then
  if verify_model "$file"; then
    sha256sum "$file"
    exit 0
  fi
  printf '%s\n' "Existing $file does not match the pinned model; preserve it and inspect before replacing." >&2
  exit 1
fi
download=$(mktemp './.ggml-small.en-q5_1.download.XXXXXXXX')
trap 'rm -f -- "$download"' EXIT
curl --fail --location --retry 3 --connect-timeout 20 --max-time 600 \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small.en-q5_1.bin \
  --output "$download"
verify_model "$download"
# Hard-link installation is atomic and fails if another installer created the
# destination; it never overwrites an existing model. The EXIT trap unlinks
# only this invocation's temporary download.
chmod 0644 "$download"
ln -- "$download" "$file"
verify_model "$file"
sha256sum "$file"
