// 依存パッケージなしの静的ファイルサーバー。リポジトリ直下を配信する。
//   node scripts/serve.mjs            → http://localhost:5173
//   PORT=8080 node scripts/serve.mjs
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** @param {number} port 0 なら空いているポートを使う */
export function startServer(port = 5173) {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = normalize(join(ROOT, path));
    // リポジトリの外は配信しない
    if (!file.startsWith(ROOT) || file.split(sep).includes('.git')) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      await stat(file);
    } catch {
      res.writeHead(404).end('Not Found');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer(Number(process.env.PORT ?? 5173));
  const { port } = server.address();
  console.log(`ブロック崩し: http://localhost:${port}`);
}
