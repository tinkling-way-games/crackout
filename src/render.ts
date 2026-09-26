import { HEIGHT, WIDTH } from './game/constants.ts';
import { LEVELS } from './game/levels.ts';
import type { Brick, GameState, Phase } from './game/types.ts';

const COLORS = {
  bg: '#0e1530',
  grid: '#141d3d',
  paddle: '#e8ecff',
  ball: '#ffffff',
  hud: '#9fb0dd',
  overlay: 'rgba(8, 12, 28, 0.72)',
  title: '#ffffff',
  sub: '#9fb0dd',
};

/** 耐久値ごとの色 (1: 水色, 2: 緑, 3: 橙) */
const BRICK_COLORS: Record<number, string> = { 1: '#4fc3f7', 2: '#7bd88f', 3: '#ffb454' };

const MESSAGES: Partial<Record<Phase, [title: string, sub: string]>> = {
  ready: ['', 'Space / クリック / タップ で発射'],
  paused: ['PAUSE', 'P / Esc で再開'],
  levelClear: ['STAGE CLEAR!', 'Space / クリック で次のステージへ'],
  gameOver: ['GAME OVER', 'Space / クリック でもう一度'],
  won: ['ALL CLEAR!', 'Space / クリック でもう一度'],
};

const FONT = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif';

/** 高解像度ディスプレイでもにじまないよう、表示サイズ × devicePixelRatio で描く */
export function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(w / WIDTH, 0, 0, h / HEIGHT, 0, 0);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawBrick(ctx: CanvasRenderingContext2D, b: Brick) {
  ctx.fillStyle = BRICK_COLORS[b.hp] ?? '#ffffff';
  // 傷んだブロック (hp < maxHp) は少し暗くする
  ctx.globalAlpha = b.hp < b.maxHp ? 0.75 : 1;
  roundRect(ctx, b.x, b.y, b.w, b.h, 4);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(b.x + 4, b.y + 3, b.w - 8, 3);
}

export function draw(ctx: CanvasRenderingContext2D, s: GameState, muted: boolean): void {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = COLORS.grid;
  for (let x = 0; x < WIDTH; x += 40) ctx.fillRect(x, 0, 1, HEIGHT);
  for (let y = 0; y < HEIGHT; y += 40) ctx.fillRect(0, y, WIDTH, 1);

  for (const b of s.bricks) drawBrick(ctx, b);

  ctx.fillStyle = COLORS.paddle;
  roundRect(ctx, s.paddle.x, s.paddle.y, s.paddle.w, s.paddle.h, s.paddle.h / 2);

  if (s.phase !== 'gameOver') {
    ctx.fillStyle = COLORS.ball;
    ctx.beginPath();
    ctx.arc(s.ball.x, s.ball.y, s.ball.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // HUD
  ctx.fillStyle = COLORS.hud;
  ctx.font = `600 18px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${s.score}`, 20, 32);
  ctx.textAlign = 'center';
  ctx.fillText(`STAGE ${s.level + 1} / ${LEVELS.length}`, WIDTH / 2, 32);
  ctx.textAlign = 'right';
  ctx.fillText(`${muted ? '🔇 ' : ''}${'●'.repeat(Math.max(0, s.lives))}`, WIDTH - 20, 32);

  const msg = MESSAGES[s.phase];
  if (!msg) return;
  const [title, sub] = msg;
  ctx.textAlign = 'center';
  if (title) {
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = COLORS.title;
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 20);
    if (s.phase === 'gameOver' || s.phase === 'won') {
      ctx.font = `600 24px ${FONT}`;
      ctx.fillText(`SCORE ${s.score}`, WIDTH / 2, HEIGHT / 2 + 30);
    }
  }
  ctx.fillStyle = COLORS.sub;
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(sub, WIDTH / 2, title ? HEIGHT / 2 + 70 : HEIGHT / 2 + 80);
}
