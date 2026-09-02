#!/bin/bash
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "没有找到 Node.js。请先安装 Node.js，或在终端中启用 NVM。"
  echo
  read -r -p "按回车关闭窗口…"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1
npm run local

STATUS=$?
if [ "$STATUS" -ne 0 ]; then
  echo
  echo "旅卡没有成功启动，上面是具体原因。"
  read -r -p "按回车关闭窗口…"
fi
exit "$STATUS"
