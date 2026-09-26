#!/usr/bin/env bash
# PreToolUse(Bash) hook: permissions.deny では書きにくい危険コマンドを正規表現で止める。
# exit 2 でブロックし、stderr の理由が Claude に返る。
# 各パターンは ; & | をまたがないようにして、別コマンド同士の誤マッチを避けている。
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0

cmd=$(jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0

block() { echo "ブロック: $1 (コマンド: $cmd)" >&2; exit 2; }
match() { printf '%s\n' "$1" | grep -Eq "$2"; }

# ルート/ホーム直下の再帰削除
# shellcheck disable=SC2016 # コマンド文字列中の「$HOME」という文字そのものを探すので、展開させない
match "$cmd" 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)[a-zA-Z]*[[:space:]]+(/|~|\$HOME)([[:space:]]|$)' \
  && block "ルートまたはホームの再帰削除は禁止"
# 保護ブランチへの直接 push
match "$cmd" 'git[[:space:]]+push[^;&|]*[[:space:]](origin[[:space:]]+)?(main|master)([[:space:]]|$)' \
  && block "main/master への直接 push は禁止。作業ブランチから PR を出すこと"
# 強制 push (--force-with-lease は許可)
match "$cmd" 'git[[:space:]]+push[^;&|]*[[:space:]](--force|-f)([[:space:]]|$)' \
  && block "force push は禁止 (--force-with-lease を自分のブランチでのみ使うこと)"
# 秘密情報の読み出し (.env.example は除外してから判定)
match "${cmd//.env.example/}" '(cat|less|more|head|tail|grep|source)[^;&|]*\.env([[:space:]]|$|\.)' \
  && block ".env の中身を読むのは禁止"
# パイプでのリモートスクリプト実行
match "$cmd" '(curl|wget)[^;&|]*\|[[:space:]]*(sudo[[:space:]]+)?(ba|z)?sh([[:space:]]|$)' \
  && block "curl | sh 形式の実行は禁止"
exit 0
