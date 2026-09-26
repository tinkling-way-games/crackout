#!/usr/bin/env bash
# Stop hook: Claude が「終わった」と言う前に検証を強制する、自走の要。
# 検証に失敗したら exit 2 で停止をブロックし、失敗内容を Claude に返して修正を続けさせる。
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# 無効化スイッチ
[ "${CLAUDE_VERIFY_ON_STOP:-1}" = "0" ] && exit 0

input=$(cat)
# すでに Stop hook による継続中なら、無限ループを避けるため一度だけで諦める
if command -v jq >/dev/null 2>&1 && [ "$(echo "$input" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

# 変更がなければ検証しない (質問への回答だけのターンなど)
[ -z "$(git status --porcelain 2>/dev/null)" ] && exit 0

out=$(scripts/verify.sh 2>&1)
status=$?
if [ $status -ne 0 ]; then
  {
    echo "scripts/verify.sh が失敗した。修正してから終了すること。"
    echo "直せない理由がある場合は、その理由を docs/PROGRESS.md に記録してから報告すること。"
    echo "----- 出力 (末尾60行) -----"
    echo "$out" | tail -n 60
  } >&2
  exit 2
fi
exit 0
