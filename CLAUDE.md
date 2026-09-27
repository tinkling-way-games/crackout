# CLAUDE.md

このリポジトリで Claude Code が自走するためのルール。短く保ち、ここに書くのは「毎回守ること」だけにする。
詳しい手順は `.claude/skills/` に置く。

## プロジェクト概要

ブラウザで動くブロック崩し。TypeScript を tsc でビルドし、Canvas 2D で描画する。実行時の依存パッケージはゼロ。

- `src/game/`: ゲームロジック。**DOM に触らない純粋な TS** に保つ (Node でそのままテストするため)
- `src/main.ts` / `render.ts` / `input.ts` / `audio.ts`: ブラウザ側 (ループ・描画・入力・効果音)
- `tests/`: `node --test` のユニットテスト (Node 22 の型ストリップで .ts を直接実行)
- `e2e/smoke.mjs`: Playwright で実ブラウザ起動を確かめるスモークテスト
- Node の型ストリップで動かすため、`enum`・`namespace`・コンストラクタ引数プロパティは使わない (`erasableSyntaxOnly`)。import は `.ts` 拡張子付きで書く

## 作業ループ (必ずこの順で)

1. **把握**: `docs/PROGRESS.md` と対象タスク (Issue / `docs/TASKS.md`) を読む。受け入れ条件が曖昧なら、推測で埋めず前提として明記する。
2. **計画**: 3ステップ以上になる作業は、先に計画を箇条書きで示す。
3. **小さく実装**: 1コミット = 1つの意味のある変更。テストを先に、または同時に書く。
4. **検証**: `scripts/verify.sh` を通す。通らない状態で「完了」と言わない (Stop hook でも強制される)。
5. **記録**: `docs/PROGRESS.md` に「やったこと / 判断したこと / 次にやること」を追記してコミットする。

## 守ること

- ユーザーへの返答・コミット以外の説明文・進捗ログは日本語で書く。技術用語やコード識別子はそのままでよい。
- サブエージェント (Explore / general-purpose / reviewer / planner など) に依頼するときは、依頼文の末尾に「報告は日本語で書くこと」と必ず明記する。組み込みのサブエージェントは言語設定を引き継がないことがある。
- main / master に直接コミット・push しない。作業ブランチを切り、PR で出す。
- テストを消したり skip したりして緑にしない。失敗の根本原因を直す。
- 依存パッケージの追加は、理由を PR 説明に書く。
- `.env` や秘密情報を読まない・書かない・ログに出さない。
- リポジトリは public。README は遊ぶ人向け (ゲームの紹介が主題、Claude Code で作ったことは副題)。開発手順は `docs/DEVELOPMENT.md`、自走の仕組みは `docs/AUTONOMOUS_DEV.md` に書き、README に作業メモを足さない。
- 分からないことが作業の方向を変える場合だけ人間に聞く。それ以外は妥当な既定値で進め、判断を記録する。

## コマンド

- 検証: `scripts/verify.sh` (typecheck → test → build → test:e2e)
- 開発サーバー: `npm run dev` (tsc --watch + http://localhost:5173)
- ビルドだけ: `npm run build` (出力は `dist/`)
- 個別テスト: `node --test tests/game/game.test.ts`
- 画面を確認したいとき: `npm run test:e2e` が `test-results/*.png` にスクリーンショットを残す

## 参照

- 自走の手順: `.claude/skills/autopilot/SKILL.md`
- PR 運用のルール: `.claude/skills/steward/SKILL.md`
- 進捗ログ: `docs/PROGRESS.md` / バックログ: `docs/TASKS.md`
- 開発・公開の手順: `docs/DEVELOPMENT.md` / 自走の仕組みの解説: `docs/AUTONOMOUS_DEV.md`
