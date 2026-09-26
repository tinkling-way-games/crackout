import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_BOUNCE_ANGLE } from '../../src/game/constants.ts';
import { circleRectHit, paddleBounce, paddleSurfaceY, reflect, setSpeed } from '../../src/game/physics.ts';
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
    assert.ok(hit);
    assert.deepEqual([hit.nx, hit.ny], [0, -1]);
    assert.ok(close(hit.px, 0) && Math.abs(hit.py + 3) < 1e-5, 'めり込み3px分だけ上へ押し戻す');
  });

  it('横から当たると横向きの法線', () => {
    const hit = circleRectHit(ball(185, 110), rect);
    assert.ok(hit);
    assert.deepEqual([hit.nx, hit.ny], [1, 0]);
    assert.ok(Math.abs(hit.px - 3) < 1e-5 && close(hit.py, 0));
  });

  it('中心がめり込んでいても一番近い辺から押し出す', () => {
    const hit = circleRectHit(ball(140, 118), rect);
    assert.ok(hit);
    assert.equal(hit.ny, 1);
    assert.equal(hit.py, 2 + 8);
  });

  it('角では、ボールが向かってきている軸を法線に選ぶ', () => {
    // 左下の角。x のずれの方が大きいが、ボールは左へ離れつつ上へ向かっている → y 軸
    const hit = circleRectHit(ball(95, 123, -200, -300), rect);
    assert.ok(hit);
    assert.deepEqual([hit.nx, hit.ny], [0, 1]);
  });

  it('角では実際の方向に押し戻し、接触を解消する', () => {
    const b = ball(95, 123, -200, -300);
    const hit = circleRectHit(b, rect);
    assert.ok(hit);
    reflect(b, hit);
    assert.equal(circleRectHit(b, rect), null);
  });

  it('角に両方向から向かってきたら、両軸とも反転して来た方向へ返す', () => {
    const b = ball(95, 123, 200, -300);
    const hit = circleRectHit(b, rect);
    assert.ok(hit);
    assert.deepEqual([hit.nx, hit.ny], [-1, 1]);
    reflect(b, hit);
    assert.deepEqual([b.vx, b.vy], [-200, 300]);
  });
});

describe('reflect', () => {
  it('面に向かっているときだけ反転し、めり込みを戻す', () => {
    const b = ball(140, 95, 50, 100);
    assert.equal(reflect(b, { nx: 0, ny: -1, px: 0, py: -3 }), true);
    assert.equal(b.vy, -100);
    assert.equal(b.vx, 50);
    assert.equal(b.y, 92);
  });

  it('すでに離れる向きなら反転しない (二重反転の防止)', () => {
    const b = ball(140, 95, 0, -100);
    assert.equal(reflect(b, { nx: 0, ny: -1, px: 0, py: -3 }), false);
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

describe('paddleSurfaceY (パドル上面の曲面)', () => {
  const paddle: Rect = { x: 300, y: 500, w: 110, h: 14 };
  // 端で出る角度が MAX_BOUNCE_ANGLE (60°) なら、真上から落ちたボールでそうなる面の傾きは半分の 30°
  const tilt = MAX_BOUNCE_ANGLE / 2;

  it('中央が一番高く (= paddle.y)、左右対称に下がる', () => {
    assert.equal(paddleSurfaceY(paddle, 355), 500);
    assert.ok(close(paddleSurfaceY(paddle, 330), paddleSurfaceY(paddle, 380)));
    assert.ok(paddleSurfaceY(paddle, 330) > 500);
  });

  it('端の下がり幅は、傾き30°の円弧の盛り上がり (幅 × (1 − cos30°))', () => {
    const sag = paddle.w * (1 - Math.cos(tilt));
    assert.ok(close(paddleSurfaceY(paddle, 300), 500 + sag));
    assert.ok(Math.abs(sag - 14.74) < 0.01, `110px のパドルで約15px: ${sag}`);
  });

  it('端より外は端の高さのまま', () => {
    assert.equal(paddleSurfaceY(paddle, 250), paddleSurfaceY(paddle, 300));
  });

  it('円弧の傾きから計算した反射角と、実際の打ち返し角がほぼ一致する (差 1.5° 未満)', () => {
    // 端ちょうどは外側が平らなので数値微分が崩れる。すぐ内側 (±0.99) までを調べる
    const offsets = [-0.99, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 0.99];
    for (const offset of offsets) {
      const x = 355 + offset * 55;
      const h = 1e-4;
      const slope = (paddleSurfaceY(paddle, x + h) - paddleSurfaceY(paddle, x - h)) / (2 * h);
      const mirror = 2 * Math.atan(slope); // 真上から落ちたボールが曲面で跳ね返る角度
      const b = ball(x, 480, 0, 300);
      paddleBounce(b, paddle, 300);
      const actual = Math.atan2(b.vx, -b.vy);
      assert.ok(Math.abs(mirror - actual) < (1.5 * Math.PI) / 180, `offset=${offset.toFixed(1)}: ${mirror} vs ${actual}`);
    }
  });

  it('打ち返したボールは、その位置の曲面にちょうど接する高さに置かれる', () => {
    const b = ball(305, 510, 0, 300);
    paddleBounce(b, paddle, 300);
    assert.ok(close(b.y, paddleSurfaceY(paddle, 305) - b.r));
  });
});
