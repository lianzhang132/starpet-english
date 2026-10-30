#!/usr/bin/env bash
set -euo pipefail
cd /opt/starpet-english
mkdir -p models
if [ ! -f models/vosk-model-small-en-us-0.15/am/final.mdl ]; then
  curl --fail --location --retry 3 --max-time 600 \
    https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip \
    --output models/vosk-model-small-en-us-0.15.zip.download
  printf '%s\n' '30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498  models/vosk-model-small-en-us-0.15.zip.download' | sha256sum --check
  unzip -tq models/vosk-model-small-en-us-0.15.zip.download
  unzip -nq models/vosk-model-small-en-us-0.15.zip.download -d models
  sha256sum models/vosk-model-small-en-us-0.15.zip.download
fi
test -f models/vosk-model-small-en-us-0.15/am/final.mdl
docker compose up -d --build
