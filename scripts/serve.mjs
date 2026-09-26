// 依存パッケージなしの静的ファイルサーバー。ゲームに必要なファイルだけを配信する。
//   node scripts/serve.mjs            → http://localhost:5173
//   PORT=8080 node scripts/serve.mjs
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** 配信してよいのはこれだけ (.env や .claude/ などを誤って出さないよう許可リスト方式) */
const ALLOWED = [/^\/$/, /^\/index\.html$/, /^\/dist\/[\w./-]+$/, /^\/docs\/images\/[\w./-]+$/];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** @returns {Promise<{ status: number, file?: string }>} */
async function resolve(url) {
  let path;
  try {
    path = decodeURIComponent(new URL(url ?? '/', 'http://x').pathname);
  } catch {
    return { status: 400 };
  }
  if (!ALLOWED.some((re) => re.test(path)) || path.split('/').some((seg) => seg === '..' || seg.startsWith('.'))) {
    return { status: 404 };
  }
  try {
    let file = join(ROOT, path === '/' ? 'index.html' : path);
    // シンボリックリンクで外へ出られないよう、実体のパスで確かめる
    file = await realpath(file);
    if (!file.startsWith(await realpath(ROOT) + sep) || !(await stat(file)).isFile()) return { status: 404 };
    return { status: 200, file };
  } catch {
    return { status: 404 };
  }
}

/** @param {number} port 0 なら空いているポートを使う */
export function startServer(port = 5173) {
  const server = createServer(async (req, res) => {
    try {
      const { status, file } = await resolve(req.url);
      if (!file) {
        res.writeHead(status).end();
        return;
      }
      const stream = createReadStream(file);
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      stream.once('open', () => {
        res.writeHead(200, {
          'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        });
        stream.pipe(res);
      });
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer(Number(process.env.PORT ?? 5173));
  const { port } = server.address();
  console.log(`ブロック崩し: http://localhost:${port}`);
}
