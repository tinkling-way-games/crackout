#!/usr/bin/env bash
# SessionStart hook: セッション開始時に依存関係を整え、現在の状況を Claude に渡す。
# stdout はそのまま Claude のコンテキストに追加される。
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# クラウド (Claude Code on the web) ではコンテナが毎回まっさらなので依存を入れる。
# ローカルでは開発者の環境を尊重して何もしない。
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  {
    if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile
    elif [ -f package-lock.json ]; then npm ci
    elif [ -f package.json ]; then npm install
    fi
    if [ -f uv.lock ]; then uv sync
    elif [ -f requirements.txt ]; then pip install -r requirements.txt
    fi
    if [ -f go.mod ]; then go mod download; fi
    if [ -f Cargo.toml ]; then cargo fetch; fi
  } >/dev/null 2>&1 || echo "[session-start] 依存のインストールに一部失敗した。必要なら手動で確認すること。"
fi

echo "## セッション開始時点の状況"
echo "- ブランチ: $(git branch --show-current 2>/dev/null || echo 'N/A')"
echo "- 未コミットの変更: $(git status --porcelain 2>/dev/null | wc -l | tr -d ' ') 件"
if [ -f docs/PROGRESS.md ]; then
  echo
  echo "## docs/PROGRESS.md (末尾40行)"
  tail -n 40 docs/PROGRESS.md
fi
exit 0
