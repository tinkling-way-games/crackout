import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_BOUNCE_ANGLE } from '../../src/game/constants.ts';
import { circleRectHit, paddleBounce, reflect, setSpeed } from '../../src/game/physics.ts';
import type { Ball, Rect } from '../../src/game/types.ts';

const rect: Rect = { x: 100, y: 100, w: 80, h: 20 };
const ball = (x: number, y: number, vx = 0, vy = 0): Ball => ({ x, y, vx, vy, r: 8 });
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('circleRectHit', () => {
  it('離れていれば null', () => {
    assert.equal(circleRectHit(ball(50, 50), rect), null);
    assert.equal(circleRectHit(ball(140, 100 - 8), rect), null, '接しているだけなら当たらない');
  });

  it('上から当たると上向きの法線', () => {
    const hit = circleRectHit(ball(140, 95), rect);
    assert.deepEqual(hit, { nx: 0, ny: -1, depth: 3 });
  });

  it('横から当たると横向きの法線', () => {
    const hit = circleRectHit(ball(185, 110), rect);
    assert.deepEqual(hit, { nx: 1, ny: 0, depth: 3 });
  });

  it('中心がめり込んでいても一番近い辺から押し出す', () => {
    const hit = circleRectHit(ball(140, 118), rect);
    assert.ok(hit);
    assert.equal(hit.ny, 1);
    assert.equal(hit.depth, 2 + 8);
  });
});

describe('reflect', () => {
  it('面に向かっているときだけ反転し、めり込みを戻す', () => {
    const b = ball(140, 95, 50, 100);
    reflect(b, { nx: 0, ny: -1, depth: 3 });
    assert.equal(b.vy, -100);
    assert.equal(b.vx, 50);
    assert.equal(b.y, 92);
  });

  it('すでに離れる向きなら反転しない (二重反転の防止)', () => {
    const b = ball(140, 95, 0, -100);
    reflect(b, { nx: 0, ny: -1, depth: 3 });
    assert.equal(b.vy, -100);
  });
});

describe('paddleBounce', () => {
  const paddle: Rect = { x: 300, y: 500, w: 100, h: 14 };

  it('中央で打つと真上', () => {
    const b = ball(350, 495, 30, 200);
    paddleBounce(b, paddle, 400);
    assert.ok(close(b.vx, 0));
    assert.equal(b.vy, -400);
  });

  it('右端で打つと最大角で右へ、速さは保つ', () => {
    const b = ball(400, 495, 0, 200);
    paddleBounce(b, paddle, 400);
    assert.ok(close(Math.atan2(b.vx, -b.vy), MAX_BOUNCE_ANGLE));
    assert.ok(close(Math.hypot(b.vx, b.vy), 400));
  });

  it('左端より外でも角度は最大角で頭打ち', () => {
    const b = ball(290, 495, 0, 200);
    paddleBounce(b, paddle, 400);
    assert.ok(close(Math.atan2(b.vx, -b.vy), -MAX_BOUNCE_ANGLE));
  });
});

describe('setSpeed', () => {
  it('向きを保って速さを変える', () => {
    const b = ball(0, 0, 3, 4);
    setSpeed(b, 10);
    assert.ok(close(b.vx, 6) && close(b.vy, 8));
  });
});
