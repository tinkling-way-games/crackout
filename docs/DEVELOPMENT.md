# 開発メモ

Crackout を手元で動かす・直す・公開するためのメモ。

## 手元で動かす

```bash
npm install      # TypeScript (開発用) を入れる
npm start        # ビルドして http://localhost:5173 を開く
npm run dev      # 開発用: 保存すると自動で再ビルド (ブラウザは手動で再読み込み)
```

Node.js 22.18 以上が必要 (`.ts` を型ストリップでそのまま実行するため)。

## コードの構成

| 場所 | 中身 |
| --- | --- |
| `src/game/` | ゲームロジック (物理・ステージ・パワーアップ)。DOM に触らない純粋な TS |
| `src/fx/` | ガラスのひび (`cracks.ts`) と破片 (`shards.ts`) |
| `src/main.ts` / `render.ts` / `input.ts` / `audio.ts` | ブラウザ側 (ループ・Canvas 描画・入力・Web Audio の効果音) |
| `src/highscore.ts` | ハイスコアの保存 (localStorage) |
| `tests/` | `node --test` のユニットテスト |
| `e2e/smoke.mjs` | Playwright で実ブラウザを開くスモークテスト |

> [!TIP]
> **ステージを追加するには**
> `src/game/levels.ts` の `LEVELS` に 10文字 × n行の文字列を足すだけ。`.` が空き、`1`〜`3` が耐久値。
> 形式の誤りやブロック同士の重なりはテストが検出する。

## 検証

```bash
scripts/verify.sh   # 型チェック → ユニットテスト → ビルド → E2E (Claude も CI もこれを使う)
```

- `src/game/` は DOM に触らない純粋なロジックなので、Node 22 で `.ts` をそのままテストできる (`node --test`)
- E2E (`e2e/smoke.mjs`) は Playwright で実際にブラウザを開き、「キー操作 → 発射 → ブロック破壊 → 一時停止 → マウス操作」を確かめる。Playwright が入っていなければスキップする

## 公開 (GitHub Pages)

`main` にマージすると、`.github/workflows/pages.yml` が型チェック・テスト・ビルドをして GitHub Pages に公開する。公開物は `index.html` と `dist/` だけ。

- 初回だけ、リポジトリの Settings → Pages → Source を「GitHub Actions」にしておく
- Settings → Environments → `github-pages` の Deployment branches に `main` が入っていないと、deploy ジョブが実行前に弾かれる
- Actions タブの「Deploy to GitHub Pages」から手動で公開し直すこともできる
- リポジトリを別のオーナーへ移管すると Pages は引き継がれない (Actions・Issue・PR は引き継がれる)。移管後は上の初回設定をやり直し、手動で公開し直す。旧 URL からのリダイレクトもない
