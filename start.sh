#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
CONDA_ENV_NAME="${CONDA_ENV_NAME:-cook-rag}"
PORT="${PORT:-3000}"

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "缺少命令: $command_name"
    exit 1
  fi
}

check_conda_env() {
  if ! conda env list | awk '{print $1}' | grep -qx "$CONDA_ENV_NAME"; then
    echo "未找到 conda 环境: $CONDA_ENV_NAME"
    echo "请先创建并安装该环境依赖。"
    exit 1
  fi
}

check_frontend_dependencies() {
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    echo "前端依赖未安装: $FRONTEND_DIR/node_modules 不存在"
    echo "请先执行:"
    echo "  cd frontend && npm install"
    exit 1
  fi
}

print_startup_info() {
  cat <<EOF
========================================
DishMind 启动脚本
========================================
项目目录: $ROOT_DIR
前端目录: $FRONTEND_DIR
Conda 环境: $CONDA_ENV_NAME
端口: $PORT

说明:
- 前端服务由 frontend/server.ts 启动
- Python 后端桥接会在收到请求时自动通过 $CONDA_ENV_NAME 拉起
========================================
EOF
}

main() {
  require_command conda
  require_command npm

  check_conda_env
  check_frontend_dependencies
  print_startup_info

  cd "$FRONTEND_DIR"
  exec env PORT="$PORT" npm run dev
}

main "$@"
