#!/usr/bin/env bash
# PostToolUse(Edit|Write) hook: 編集したファイルをフォーマッタで整える。
# 失敗しても作業は止めない (exit 0)。
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
file=$(jq -r '.tool_input.file_path // empty')
[ -z "$file" ] || [ ! -f "$file" ] && exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.scss|*.html|*.yml|*.yaml)
    [ -x node_modules/.bin/prettier ] && node_modules/.bin/prettier --write "$file" >/dev/null 2>&1 ;;
  *.py)
    command -v ruff >/dev/null 2>&1 && { ruff format "$file"; ruff check --fix "$file"; } >/dev/null 2>&1 ;;
  *.go)
    command -v gofmt >/dev/null 2>&1 && gofmt -w "$file" ;;
  *.rs)
    command -v rustfmt >/dev/null 2>&1 && rustfmt "$file" >/dev/null 2>&1 ;;
esac
exit 0
