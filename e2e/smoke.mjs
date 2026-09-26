// ブラウザで実際に起動して、遊べる状態かを確かめるスモークテスト。
// 前提: `npm run build` 済み。Playwright はローカル / グローバルどちらのインストールでもよい。
// Playwright が見つからなければスキップする (CI=true のときは失敗扱い)。
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { startServer } from '../scripts/serve.mjs';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    try {
      const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
      return createRequire(join(globalRoot, 'noop.js'))('playwright');
    } catch {
      return null;
    }
  }
}

const fail = (msg) => {
  console.error(`✖ e2e: ${msg}`);
  process.exitCode = 1;
};

if (!existsSync('dist/main.js')) {
  fail('dist/main.js がない。先に `npm run build` を実行すること');
  process.exit(1);
}

const pw = await loadPlaywright();
if (!pw) {
  console.log('e2e: Playwright が見つからないのでスキップ (npm i -D playwright で有効になる)');
  process.exit(process.env.CI ? 1 : 0);
}

const server = await startServer(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const game = () => page.evaluate(() => {
  const s = window.__breakout.state;
  return { phase: s.phase, score: s.score, lives: s.lives, paddleX: s.paddle.x, bricks: s.bricks.length };
});
const waitFor = (fn, ms = 5000) => page.waitForFunction(fn, null, { timeout: ms });

try {
  await page.goto(url);
  await waitFor(() => window.__breakout !== undefined);

  const start = await game();
  if (start.phase !== 'ready') fail(`開始時の phase が ${start.phase}`);
  if (start.bricks === 0) fail('ブロックが表示されていない');

  // キーボードでパドルが動く
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowRight');
  if ((await game()).paddleX <= start.paddleX) fail('→キーでパドルが動かない');

  // 発射して、ブロックに当たって得点が入る
  await page.keyboard.press('Space');
  await waitFor(() => window.__breakout.state.phase === 'playing');
  await waitFor(() => window.__breakout.state.score > 0);

  // 一時停止と再開
  await page.keyboard.press('KeyP');
  await waitFor(() => window.__breakout.state.phase === 'paused');
  mkdirSync('test-results', { recursive: true });
  await page.locator('#game').screenshot({ path: 'test-results/paused.png' });
  await page.keyboard.press('KeyP');
  await waitFor(() => window.__breakout.state.phase !== 'paused');

  // マウスでもパドルが動く
  const box = await page.locator('#game').boundingBox();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5);
  await waitFor(() => window.__breakout.state.paddle.x < 100);

  await page.waitForTimeout(300);
  await page.locator('#game').screenshot({ path: 'test-results/playing.png' });

  if (errors.length) fail(`ブラウザでエラー: ${errors.join(' / ')}`);
  const end = await game();
  if (!process.exitCode) console.log(`✔ e2e OK (score ${end.score}, bricks ${start.bricks} → ${end.bricks})`);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
  await page.screenshot({ path: 'test-results/failure.png' }).catch(() => {});
} finally {
  await browser.close();
  server.close();
}
