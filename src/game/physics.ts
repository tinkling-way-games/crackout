import { MAX_BOUNCE_ANGLE } from './constants.ts';
import type { Ball, Rect } from './types.ts';

export interface Hit {
  /** 反射させる軸の向き (各成分は -1 / 0 / 1。角に正面から当たったときだけ両方が非0) */
  nx: number;
  ny: number;
  /** めり込みを解消する押し戻し量 */
  px: number;
  py: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 円 (ボール) と矩形の当たり判定。
 * 法線は x 軸か y 軸にそろえる。斜めに反射させると角に当たったとき極端に水平な軌道になりやすいため。
 * 角に当たったときは、ボールが「向かってきている」軸を選ぶ (離れつつある軸で反射させると、
 * 反転せずにめり込んだまま次のステップでも当たり続けてしまう)。
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
    if (min === top) return { nx: 0, ny: -1, px: 0, py: -(top + ball.r) };
    if (min === bottom) return { nx: 0, ny: 1, px: 0, py: bottom + ball.r };
    if (min === left) return { nx: -1, ny: 0, px: -(left + ball.r), py: 0 };
    return { nx: 1, ny: 0, px: right + ball.r, py: 0 };
  }

  const d = Math.sqrt(d2);
  // 浮動小数点の誤差で「押し戻したのにまだ接触」とならないよう、ごくわずかに余分に押す
  const depth = ball.r - d + 1e-6;
  // 押し戻しは実際の方向へ (角でも接触が確実に解消される)
  const px = (dx / d) * depth;
  const py = (dy / d) * depth;

  const approachX = dx !== 0 && ball.vx * dx < 0;
  const approachY = dy !== 0 && ball.vy * dy < 0;
  // 角に両方向から向かってきた: 両軸とも反転して来た方向へ返す (片方だけだと同じ角にもう一度当たる)
  if (approachX && approachY) return { nx: Math.sign(dx), ny: Math.sign(dy), px, py };
  const useX = approachX || (!approachY && Math.abs(dx) > Math.abs(dy));
  return useX ? { nx: Math.sign(dx), ny: 0, px, py } : { nx: 0, ny: Math.sign(dy), px, py };
}

/**
 * めり込みを戻し、当たった面に向かって進んでいれば速度を反転する。
 * @returns 反転したら true。離れつつある (= すでに反射済み) なら false
 */
export function reflect(ball: Ball, hit: Hit): boolean {
  ball.x += hit.px;
  ball.y += hit.py;
  let flipped = false;
  if (hit.nx !== 0 && ball.vx * hit.nx < 0) {
    ball.vx = -ball.vx;
    flipped = true;
  }
  if (hit.ny !== 0 && ball.vy * hit.ny < 0) {
    ball.vy = -ball.vy;
    flipped = true;
  }
  return flipped;
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
