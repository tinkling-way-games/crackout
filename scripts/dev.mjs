// 開発用: tsc --watch でビルドし続けながら静的サーバーを立てる。保存したらブラウザを再読み込みする。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { startServer } from './serve.mjs';

const localTsc = 'node_modules/.bin/tsc';
const tsc = existsSync(localTsc) ? localTsc : 'tsc';
const watcher = spawn(tsc, ['-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
watcher.on('error', () => {
  console.error('tsc が見つからない。`npm install` を実行すること。');
  process.exit(1);
});

const server = await startServer(Number(process.env.PORT ?? 5173));
console.log(`ブロック崩し: http://localhost:${server.address().port}`);

const stop = () => {
  watcher.kill();
  server.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
