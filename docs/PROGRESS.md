# PROGRESS

セッションをまたいだ作業記憶。新しいものを下に追記する。SessionStart hook が末尾をセッション冒頭で読み込む。

書式:

```
## YYYY-MM-DD <タスク名>
- やったこと:
- 判断と理由:
- 残課題 / 次にやること:
```

## 2026-09-26 自走開発テンプレートの初期構築
- やったこと: CLAUDE.md、settings.json (権限・hooks)、autopilot / steward スキル、reviewer / planner エージェント、verify.sh、GitHub Actions を追加
- 判断と理由: 言語非依存にするため、検証は `scripts/verify.sh` に集約し、スタックを自動検出する形にした
- 残課題 / 次にやること: 実プロジェクトのスタックに合わせて CLAUDE.md の TODO と verify.sh を埋める
