#!/usr/bin/env bash
set -euo pipefail

MODEL_DIR="${MODEL_DIR:-model}"
MODEL_NAME="Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf"
MODEL_URL="${MODEL_URL:-https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf?download=true}"
DESTINATION="${MODEL_DIR}/${MODEL_NAME}"

mkdir -p "${MODEL_DIR}"

if [[ -f "${DESTINATION}" ]]; then
  echo "Model already exists: ${DESTINATION}"
  exit 0
fi

echo "Downloading ${MODEL_NAME} into ${MODEL_DIR}/ ..."
if command -v curl >/dev/null 2>&1; then
  curl --fail --location --continue-at - --output "${DESTINATION}" "${MODEL_URL}"
elif command -v wget >/dev/null 2>&1; then
  wget --continue --output-document="${DESTINATION}" "${MODEL_URL}"
else
  echo "Error: curl or wget is required to download the model." >&2
  exit 1
fi

echo "Download complete: ${DESTINATION}"

