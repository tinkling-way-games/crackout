import { HEIGHT, MAX_BOUNCE_ANGLE, WIDTH } from './game/constants.ts';
import { brickKey, crackPattern, type Crack } from './fx/cracks.ts';
import type { Shard } from './fx/shards.ts';
import { LEVELS } from './game/levels.ts';
import type { ScoreEntry } from './highscore.ts';
import type { Ball, Brick, GameState, Phase, PowerUp, PowerUpKind, Rect } from './game/types.ts';

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

/** ガラスの色 (耐久値で色は変えず、厚みとひびで表す) */
const GLASS = { r: 170, g: 225, b: 255 };

/** アイテムの見た目。色はガラスのブロック (淡い水色) と見分けやすいものにする */
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

/** ハイスコアの表示に使う情報 */
export interface ScoreBoard {
  ranking: readonly ScoreEntry[];
  /** 直前に終わったゲームの順位 (0 = 1位)。圏外なら null */
  rank: number | null;
}

const NO_SCORES: ScoreBoard = { ranking: [], rank: null };
const GOLD = '#ffd866';

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

/** ひびの形はブロックごとにキャッシュする (当たった回数が変わったときだけ作り直す) */
const crackCache = new WeakMap<Brick, { count: number; cracks: Crack[] }>();

function cracksOf(b: Brick): Crack[] {
  const cached = crackCache.get(b);
  if (cached && cached.count === b.impacts.length) return cached.cracks;
  const key = brickKey(b.x, b.y);
  const cracks = b.impacts.flatMap((impact, i) => crackPattern(impact, b, key, i));
  crackCache.set(b, { count: b.impacts.length, cracks });
  return cracks;
}

function strokeCracks(ctx: CanvasRenderingContext2D, b: Brick, cracks: Crack[]) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // 暗い下地 + 明るい線で、ひびの縁が光って見えるようにする
  for (const [color, width] of [['rgba(5, 20, 40, 0.55)', 2.2], ['rgba(255, 255, 255, 0.9)', 1]] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const line of cracks) {
      line.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(b.x + x, b.y + y) : ctx.lineTo(b.x + x, b.y + y)));
    }
    ctx.stroke();
  }
  // 当たった点は白く砕けた粉のように
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (const p of b.impacts) {
    ctx.beginPath();
    ctx.arc(b.x + p.x, b.y + p.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * ブロックは見た目が変わる (ひびが増える・厚みが変わる・表示倍率が変わる) までは画像として使い回す。
 * グラデーションとひびを毎フレーム描くと、ひびだらけの面では重いため。
 */
const SPRITE_PAD = 2;
const spriteCache = new WeakMap<Brick, { count: number; maxHp: number; scale: number; image: HTMLCanvasElement }>();

function drawBrick(ctx: CanvasRenderingContext2D, b: Brick) {
  const scale = ctx.getTransform().a;
  let sprite = spriteCache.get(b);
  if (!sprite || sprite.count !== b.impacts.length || sprite.maxHp !== b.maxHp || sprite.scale !== scale) {
    const image = sprite?.image ?? document.createElement('canvas');
    image.width = Math.ceil((b.w + SPRITE_PAD * 2) * scale);
    image.height = Math.ceil((b.h + SPRITE_PAD * 2) * scale);
    const sctx = image.getContext('2d');
    if (!sctx) return renderBrick(ctx, b);
    sctx.setTransform(scale, 0, 0, scale, (SPRITE_PAD - b.x) * scale, (SPRITE_PAD - b.y) * scale);
    renderBrick(sctx, b);
    sprite = { count: b.impacts.length, maxHp: b.maxHp, scale, image };
    spriteCache.set(b, sprite);
  }
  ctx.drawImage(sprite.image, b.x - SPRITE_PAD, b.y - SPRITE_PAD, sprite.image.width / scale, sprite.image.height / scale);
}

/**
 * ガラスのブロック。
 * - 本体: 半透明のグラデーション (背景の格子が透けて見える)
 * - 強さ (耐久値の最大): ガラスの厚み = 不透明度と、内側に重なる縁の線の数
 * - 脆さ (残り耐久): 当たった点から入るひび
 */
function renderBrick(ctx: CanvasRenderingContext2D, b: Brick) {
  const { r, g, b: bl } = GLASS;
  const thick = b.maxHp;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 3);
  const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w * 0.5, b.y + b.h * 1.6);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${bl}, ${0.2 + 0.1 * thick})`);
  grad.addColorStop(0.55, `rgba(${r - 60}, ${g - 40}, ${bl - 20}, ${0.06 + 0.07 * thick})`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${bl}, ${0.16 + 0.09 * thick})`);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.clip();

  // 斜めに走る映り込み
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.moveTo(b.x + b.w * 0.12, b.y);
  ctx.lineTo(b.x + b.w * 0.3, b.y);
  ctx.lineTo(b.x + b.w * 0.18, b.y + b.h);
  ctx.lineTo(b.x, b.y + b.h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.fillRect(b.x + b.w * 0.34, b.y, b.w * 0.05, b.h);

  // 厚いガラスほど、内側に縁の線が重なって見える
  for (let i = 1; i < thick; i++) {
    const inset = i * 3;
    ctx.strokeStyle = `rgba(220, 245, 255, ${0.4 - i * 0.08})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2, 2);
    ctx.stroke();
  }

  if (b.impacts.length > 0) strokeCracks(ctx, b, cracksOf(b));
  ctx.restore();

  // 外周の縁: 上辺を明るく、下辺を少し暗くして立体感を出す
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(225, 248, 255, 0.85)';
  ctx.beginPath();
  ctx.roundRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 3);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.moveTo(b.x + 3, b.y + 1.5);
  ctx.lineTo(b.x + b.w - 3, b.y + 1.5);
  ctx.stroke();
}

const SHARD_FILL = `rgba(${GLASS.r}, ${GLASS.g}, ${GLASS.b}, 0.55)`;
const SHARD_EDGE = 'rgba(255, 255, 255, 0.9)';

/**
 * 破片を描く。500個でも軽いよう、座標変換は使わずに頂点を手で回し、
 * 色は固定の文字列にして透明度は globalAlpha で付ける。
 */
function drawShards(ctx: CanvasRenderingContext2D, shards: readonly Shard[]) {
  ctx.save();
  ctx.lineWidth = 0.8;
  ctx.fillStyle = SHARD_FILL;
  ctx.strokeStyle = SHARD_EDGE;
  for (const s of shards) {
    ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
    const cos = Math.cos(s.angle);
    const sin = Math.sin(s.angle);
    ctx.beginPath();
    for (let i = 0; i < s.points.length; i++) {
      const [px, py] = s.points[i]!;
      const x = s.x + px * cos - py * sin;
      const y = s.y + px * sin + py * cos;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * パドルをドーム形に描く。上面は物理と同じ円弧 (physics.ts の paddleSurfaceY) で、
 * 端で MAX_BOUNCE_ANGLE / 2 だけ傾く。下面は平ら。
 */
function drawPaddle(ctx: CanvasRenderingContext2D, p: Rect) {
  const tilt = MAX_BOUNCE_ANGLE / 2;
  const radius = p.w / 2 / Math.sin(tilt);
  const cx = p.x + p.w / 2;
  const edgeY = p.y + radius * (1 - Math.cos(tilt));
  const bottom = edgeY + 6;
  ctx.beginPath();
  ctx.arc(cx, p.y + radius, radius, -Math.PI / 2 - tilt, -Math.PI / 2 + tilt);
  ctx.arcTo(p.x + p.w, bottom, cx, bottom, 3);
  ctx.arcTo(p.x, bottom, p.x, edgeY, 3);
  ctx.closePath();
  ctx.fill();
  // 上面のハイライトで曲面らしさを出す
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, p.y + radius + 2, radius, -Math.PI / 2 - tilt * 0.8, -Math.PI / 2 + tilt * 0.8);
  ctx.stroke();
  ctx.restore();
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

export function draw(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  muted: boolean,
  shards: readonly Shard[] = [],
  scores: ScoreBoard = NO_SCORES,
): void {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = COLORS.grid;
  for (let x = 0; x < WIDTH; x += 40) ctx.fillRect(x, 0, 1, HEIGHT);
  for (let y = 0; y < HEIGHT; y += 40) ctx.fillRect(0, y, WIDTH, 1);

  for (const b of s.bricks) drawBrick(ctx, b);
  drawShards(ctx, shards);

  for (const item of s.powerUps) drawPowerUp(ctx, item);

  // 拡大中のパドルは色を変える。残り2秒を切ったら点滅して終わりを知らせる
  const wide = s.effects.wide > 0;
  const blink = wide && s.effects.wide < 2 && Math.floor(s.effects.wide * 8) % 2 === 0;
  ctx.fillStyle = wide && !blink ? POWERUP_STYLES.wide.color : COLORS.paddle;
  drawPaddle(ctx, s.paddle);

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
  // ベストスコア。今のプレイがそれを超えたら今のスコアを金色で出す
  const best = scores.ranking[0]?.score ?? 0;
  ctx.font = `700 14px ${FONT}`;
  ctx.fillStyle = s.score > best ? GOLD : COLORS.hud;
  ctx.fillText(`HI ${Math.max(best, s.score)}`, WIDTH - 20, 56);

  const msg = MESSAGES[s.phase];
  if (!msg) return;
  if (s.phase === 'gameOver' || s.phase === 'won') {
    drawResult(ctx, s, msg, scores);
    return;
  }
  const [title, sub] = msg;
  ctx.textAlign = 'center';
  if (title) {
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = COLORS.title;
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 20);
  }
  ctx.fillStyle = COLORS.sub;
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(sub, WIDTH / 2, title ? HEIGHT / 2 + 70 : HEIGHT / 2 + 80);
}

/** ゲームオーバー / オールクリアの画面: 今回のスコアとランキング */
function drawResult(ctx: CanvasRenderingContext2D, s: GameState, [title, sub]: [string, string], scores: ScoreBoard) {
  ctx.fillStyle = COLORS.overlay;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.title;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(title, WIDTH / 2, 140);
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(`SCORE ${s.score}`, WIDTH / 2, 192);
  if (scores.rank === 0) {
    ctx.fillStyle = GOLD;
    ctx.font = `800 20px ${FONT}`;
    ctx.fillText('NEW RECORD!', WIDTH / 2, 226);
  }

  // ランキング (順位・スコア・ステージ・日付)
  const top = 272;
  const rowH = 30;
  const cols = { rank: 236, score: 372, stage: 400, date: 482 };
  const rowLeft = cols.rank - 14;
  const rowWidth = 580 - rowLeft;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = COLORS.sub;
  ctx.textAlign = 'left';
  ctx.fillText('HIGH SCORES', cols.rank, top);
  if (scores.ranking.length === 0) {
    ctx.fillText('まだ記録がない', cols.rank, top + rowH);
  }
  scores.ranking.forEach((e, i) => {
    const y = top + rowH * (i + 1);
    const mine = i === scores.rank;
    if (mine) {
      ctx.fillStyle = 'rgba(255, 216, 102, 0.14)';
      ctx.fillRect(rowLeft, y - rowH / 2 + 2, rowWidth, rowH - 4);
    }
    ctx.fillStyle = mine ? GOLD : COLORS.title;
    ctx.font = `${mine ? 800 : 600} 17px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}.`, cols.rank, y);
    ctx.textAlign = 'right';
    ctx.fillText(String(e.score), cols.score, y);
    ctx.textAlign = 'left';
    ctx.font = `500 14px ${FONT}`;
    ctx.fillStyle = mine ? GOLD : COLORS.sub;
    ctx.fillText(`STAGE ${e.stage}`, cols.stage, y);
    ctx.fillText(e.date, cols.date, y);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.sub;
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText(sub, WIDTH / 2, top + rowH * 6 + 40);
}
