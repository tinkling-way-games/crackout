import { HEIGHT, WIDTH } from './game/constants.ts';
import { LEVELS } from './game/levels.ts';
import type { Ball, Brick, GameState, Phase, PowerUp, PowerUpKind } from './game/types.ts';

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

/** アイテムの見た目。色はブロック (水色・緑・橙) と被らないものにする */
export const POWERUP_STYLES: Record<PowerUpKind, { label: string; color: string; name: string }> = {
  wide: { label: 'W', color: '#c792ea', name: '拡大' },
  multi: { label: 'M', color: '#ff79c6', name: 'マルチ' },
  pierce: { label: 'P', color: '#ff5370', name: '貫通' },
};

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

function drawPowerUp(ctx: CanvasRenderingContext2D, item: PowerUp) {
  const style = POWERUP_STYLES[item.kind];
  ctx.fillStyle = style.color;
  roundRect(ctx, item.x, item.y, item.w, item.h, item.h / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.label, item.x + item.w / 2, item.y + item.h / 2 + 1);
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, pierce: boolean) {
  ctx.save();
  if (pierce) {
    // 貫通中は赤く光らせ、進行方向の後ろに残像を付ける
    const len = Math.hypot(ball.vx, ball.vy) || 1;
    for (let i = 3; i >= 1; i--) {
      ctx.globalAlpha = 0.12 * (4 - i);
      ctx.fillStyle = POWERUP_STYLES.pierce.color;
      ctx.beginPath();
      ctx.arc(ball.x - (ball.vx / len) * i * 7, ball.y - (ball.vy / len) * i * 7, ball.r * (1 - i * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = POWERUP_STYLES.pierce.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffd0d8';
  } else {
    ctx.fillStyle = COLORS.ball;
  }
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function draw(ctx: CanvasRenderingContext2D, s: GameState, muted: boolean): void {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = COLORS.grid;
  for (let x = 0; x < WIDTH; x += 40) ctx.fillRect(x, 0, 1, HEIGHT);
  for (let y = 0; y < HEIGHT; y += 40) ctx.fillRect(0, y, WIDTH, 1);

  for (const b of s.bricks) drawBrick(ctx, b);

  for (const item of s.powerUps) drawPowerUp(ctx, item);

  // 拡大中のパドルは色を変える。残り2秒を切ったら点滅して終わりを知らせる
  const wide = s.effects.wide > 0;
  const blink = wide && s.effects.wide < 2 && Math.floor(s.effects.wide * 8) % 2 === 0;
  ctx.fillStyle = wide && !blink ? POWERUP_STYLES.wide.color : COLORS.paddle;
  roundRect(ctx, s.paddle.x, s.paddle.y, s.paddle.w, s.paddle.h, s.paddle.h / 2);

  if (s.phase !== 'gameOver') {
    for (const ball of s.balls) drawBall(ctx, ball, s.effects.pierce > 0);
  }

  // HUD
  ctx.fillStyle = COLORS.hud;
  ctx.font = `600 18px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${s.score}`, 20, 32);
  // 有効な効果と残り時間
  let ex = 20;
  ctx.font = `700 14px ${FONT}`;
  for (const kind of ['wide', 'pierce'] as const) {
    const left = s.effects[kind];
    if (left <= 0) continue;
    const style = POWERUP_STYLES[kind];
    const text = `${style.label} ${style.name} ${Math.ceil(left)}s`;
    ctx.fillStyle = style.color;
    ctx.fillText(text, ex, 56);
    ex += ctx.measureText(text).width + 16;
  }
  if (s.balls.length > 1 && s.phase === 'playing') {
    ctx.fillStyle = POWERUP_STYLES.multi.color;
    ctx.fillText(`M ×${s.balls.length}`, ex, 56);
  }
  ctx.font = `600 18px ${FONT}`;
  ctx.fillStyle = COLORS.hud;
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
