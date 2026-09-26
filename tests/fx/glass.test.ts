import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { brickKey, crackPattern } from '../../src/fx/cracks.ts';
import { MAX_SHARDS, addShards, spawnShards, stepShards } from '../../src/fx/shards.ts';
import type { BrokenBrick } from '../../src/game/types.ts';

const SIZE = { w: 72, h: 24 };

describe('crackPattern (割れ目)', () => {
  const impact = { x: 30, y: 12 };

  it('同じブロック・同じ当たり順なら毎回同じ模様 (フレームごとにちらつかない)', () => {
    const key = brickKey(120, 80);
    assert.deepEqual(crackPattern(impact, SIZE, key, 0), crackPattern(impact, SIZE, key, 0));
  });

  it('ブロックが違えば模様も違う', () => {
    assert.notDeepEqual(crackPattern(impact, SIZE, brickKey(120, 80), 0), crackPattern(impact, SIZE, brickKey(196, 80), 0));
  });

  it('放射状のひびは当たった点から始まる', () => {
    const rays = crackPattern(impact, SIZE, brickKey(0, 0), 0).filter((c) => c.length > 2);
    assert.ok(rays.length >= 5);
    for (const ray of rays) assert.deepEqual(ray[0], [30, 12]);
  });

  it('縁に当たったときは、ひびがブロックの内側へ向かって伸びる', () => {
    for (let k = 0; k < 20; k++) {
      const edge = { x: 36, y: 24 }; // 下辺の中央
      const rays = crackPattern(edge, SIZE, brickKey(k * 76, 80), 0).filter((c) => c.length > 2);
      const inward = rays.filter((r) => r[1]![1] < edge.y).length;
      assert.equal(inward, rays.length, `外へ向かうひびがある (key ${k})`);
    }
  });

  it('左右の縁・角に当たったときも、ひびは内側へ伸びる', () => {
    const cases = [
      { impact: { x: 0, y: 12 }, inside: (p: readonly [number, number]) => p[0] > 0 },
      { impact: { x: 72, y: 12 }, inside: (p: readonly [number, number]) => p[0] < 72 },
      { impact: { x: 0, y: 0 }, inside: (p: readonly [number, number]) => p[0] > 0 && p[1] > 0 },
      { impact: { x: 72, y: 24 }, inside: (p: readonly [number, number]) => p[0] < 72 && p[1] < 24 },
    ];
    for (const { impact: at, inside } of cases) {
      for (let k = 0; k < 10; k++) {
        const rays = crackPattern(at, SIZE, brickKey(k * 76, 132), 0).filter((c) => c.length > 2);
        for (const ray of rays) assert.ok(inside(ray[1]!), `(${at.x},${at.y}) から外へ向かうひび: ${ray[1]}`);
      }
    }
  });

  it('2回目以降の当たりほどひびの本数が多く、長い', () => {
    const key = brickKey(40, 100);
    const measure = (index: number) => {
      const rays = crackPattern(impact, SIZE, key, index).filter((c) => c.length > 2);
      const reach = Math.max(...rays.map((r) => Math.hypot(r.at(-1)![0] - 30, r.at(-1)![1] - 12)));
      return { count: rays.length, reach };
    };
    const first = measure(0);
    const second = measure(1);
    assert.ok(second.count > first.count, `${second.count} > ${first.count}`);
    assert.ok(second.reach > first.reach, `${second.reach} > ${first.reach}`);
  });
});

/** 決まった列を返す乱数 (テスト用) */
function fixedRandom(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('shards (破片)', () => {
  const broken: BrokenBrick = { x: 100, y: 80, w: 72, h: 24, vx: 0, vy: -400 };

  it('ブロックの範囲から、大きさに応じた数の破片が出る', () => {
    const shards = spawnShards(broken, fixedRandom());
    assert.ok(shards.length >= 10 && shards.length <= 16, `${shards.length}`);
    for (const s of shards) {
      assert.ok(s.x >= 100 && s.x <= 172 && s.y >= 80 && s.y <= 104);
      assert.equal(s.points.length, 3, '三角形');
    }
  });

  it('ボールの進行方向 (ここでは上) へ飛び散る', () => {
    const up = spawnShards(broken, fixedRandom());
    const right = spawnShards({ ...broken, vx: 400, vy: 0 }, fixedRandom());
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    assert.ok(avg(up.map((s) => s.vy)) < -100);
    assert.ok(avg(right.map((s) => s.vx)) > 100);
  });

  it('重力で落ちていき、寿命が来たら消える', () => {
    let shards = spawnShards(broken, fixedRandom());
    const vy0 = shards[0]!.vy;
    shards = stepShards(shards, 0.1);
    assert.ok(shards[0]!.vy > vy0, '下向きに加速する');
    for (let i = 0; i < 20; i++) shards = stepShards(shards, 0.1);
    assert.equal(shards.length, 0);
  });

  it(`一度に大量に割っても破片は ${MAX_SHARDS} 個までで、古いものから捨てる`, () => {
    let shards = spawnShards(broken, fixedRandom());
    const oldest = shards[0];
    for (let i = 0; i < 60; i++) shards = addShards(shards, spawnShards(broken, fixedRandom(i + 2)));
    assert.equal(shards.length, MAX_SHARDS);
    assert.ok(!shards.includes(oldest!));
  });
});
