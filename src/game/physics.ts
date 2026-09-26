import { MAX_BOUNCE_ANGLE } from './constants.ts';
import type { Ball, Rect } from './types.ts';

export interface Hit {
  /** 押し戻す向き (軸にそろえた単位ベクトル) */
  nx: number;
  ny: number;
  /** めり込み量 */
  depth: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 円 (ボール) と矩形の当たり判定。
 * 法線は x 軸か y 軸にそろえる。斜めに反射させると角に当たったとき極端に水平な軌道になりやすいため。
 */
export function circleRectHit(ball: Ball, rect: Rect): Hit | null {
  const cx = clamp(ball.x, rect.x, rect.x + rect.w);
  const cy = clamp(ball.y, rect.y, rect.y + rect.h);
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= ball.r * ball.r) return null;

  if (d2 === 0) {
    // 中心が矩形の内側にある: いちばん近い辺から押し出す
    const left = ball.x - rect.x;
    const right = rect.x + rect.w - ball.x;
    const top = ball.y - rect.y;
    const bottom = rect.y + rect.h - ball.y;
    const min = Math.min(left, right, top, bottom);
    if (min === top) return { nx: 0, ny: -1, depth: top + ball.r };
    if (min === bottom) return { nx: 0, ny: 1, depth: bottom + ball.r };
    if (min === left) return { nx: -1, ny: 0, depth: left + ball.r };
    return { nx: 1, ny: 0, depth: right + ball.r };
  }

  const d = Math.sqrt(d2);
  const depth = ball.r - d;
  if (Math.abs(dx) > Math.abs(dy)) return { nx: Math.sign(dx), ny: 0, depth };
  return { nx: 0, ny: Math.sign(dy), depth };
}

/** 当たった面に向かって進んでいるときだけ速度を反転する (二重反転の防止) */
export function reflect(ball: Ball, hit: Hit): void {
  ball.x += hit.nx * hit.depth;
  ball.y += hit.ny * hit.depth;
  if (hit.nx !== 0 && ball.vx * hit.nx < 0) ball.vx = -ball.vx;
  if (hit.ny !== 0 && ball.vy * hit.ny < 0) ball.vy = -ball.vy;
}

/**
 * パドルで打ち返す。当たった位置が中央から離れるほど角度が付く。
 * 中央 → 真上、端 → MAX_BOUNCE_ANGLE。
 */
export function paddleBounce(ball: Ball, paddle: Rect, speed: number): void {
  const offset = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
  const angle = offset * MAX_BOUNCE_ANGLE;
  ball.vx = speed * Math.sin(angle);
  ball.vy = -speed * Math.cos(angle);
  ball.y = paddle.y - ball.r;
}

/** 向きを保ったまま速さだけ変える */
export function setSpeed(ball: Ball, speed: number): void {
  const current = Math.hypot(ball.vx, ball.vy);
  if (current === 0) return;
  ball.vx = (ball.vx / current) * speed;
  ball.vy = (ball.vy / current) * speed;
}
