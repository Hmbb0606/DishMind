#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="dishmind"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_NAME="${PROJECT_NAME}-deploy-${TIMESTAMP}.tar.gz"
TEMP_OUTPUT_PATH="/tmp/${OUTPUT_NAME}"
OUTPUT_PATH="${ROOT_DIR}/${OUTPUT_NAME}"

cd "$ROOT_DIR"

tar \
  --exclude='.git' \
  --exclude='.idea' \
  --exclude='.vscode' \
  --exclude='.codex' \
  --exclude='.agents' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='*.pyo' \
  --exclude='.env.docker' \
  --exclude='frontend/node_modules' \
  --exclude='frontend/dist' \
  --exclude='vector_index' \
  --exclude='*.tar.gz' \
  -czf "$TEMP_OUTPUT_PATH" \
  .

mv "$TEMP_OUTPUT_PATH" "$OUTPUT_PATH"

echo "Created deploy archive: $OUTPUT_PATH"
