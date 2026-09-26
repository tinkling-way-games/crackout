#!/usr/bin/env bash
# プロジェクト共通の検証スクリプト。人間も Claude も CI も、これ1本を叩く。
# スタックを自動検出して lint / typecheck / test を回す。
# プロジェクト固有の手順が必要になったら、このファイルを直接書き換えること。
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

fail=0
ran=0
run() {
  ran=1
  echo "▶ $*"
  if ! "$@"; then
    echo "✖ 失敗: $*"
    fail=1
  fi
}
has_script() { [ -f package.json ] && jq -e --arg s "$1" '.scripts[$s]' package.json >/dev/null 2>&1; }

# Node.js
if [ -f package.json ]; then
  pm=npm; [ -f pnpm-lock.yaml ] && pm=pnpm
  # 定義されているものだけ、この順で実行する (e2e はビルド成果物を使うので build の後)
  for s in lint typecheck test build test:e2e; do
    has_script "$s" && run $pm run "$s"
  done
fi

# Python
if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  command -v ruff >/dev/null 2>&1 && run ruff check .
  if command -v pytest >/dev/null 2>&1 && ls tests test 2>/dev/null | grep -q .; then
    run pytest -q
  fi
fi

# Go
if [ -f go.mod ]; then
  run go vet ./...
  run go test ./...
fi

# Rust
if [ -f Cargo.toml ]; then
  run cargo clippy --quiet -- -D warnings
  run cargo test --quiet
fi

# シェルスクリプト (このテンプレート自体の検証)
if command -v shellcheck >/dev/null 2>&1; then
  mapfile -t shs < <(git ls-files '*.sh' 2>/dev/null)
  [ ${#shs[@]} -gt 0 ] && run shellcheck "${shs[@]}"
fi

# このテンプレート自体のテスト
[ -x tests/hooks_test.sh ] && run tests/hooks_test.sh

[ $ran -eq 0 ] && echo "検証対象が見つからなかった (スタック未検出)。scripts/verify.sh を編集して追加すること。"
[ $fail -eq 0 ] && [ $ran -eq 1 ] && echo "✔ verify OK"
exit $fail
