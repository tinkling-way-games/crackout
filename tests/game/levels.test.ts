import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BRICK_TOP, PADDLE_Y, WIDTH } from '../../src/game/constants.ts';
import { LEVELS, parseLevel } from '../../src/game/levels.ts';

describe('LEVELS', () => {
  LEVELS.forEach((rows, i) => {
    it(`ステージ${i + 1} のブロックが画面内に重ならず収まる`, () => {
      const bricks = parseLevel(rows);
      for (const b of bricks) {
        assert.ok(b.x >= 0 && b.x + b.w <= WIDTH, '横にはみ出さない');
        assert.ok(b.y >= BRICK_TOP && b.y + b.h < PADDLE_Y - 100, 'パドルとの間に余裕がある');
      }
      for (let a = 0; a < bricks.length; a++) {
        for (let c = a + 1; c < bricks.length; c++) {
          const p = bricks[a]!;
          const q = bricks[c]!;
          const overlap = p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
          assert.ok(!overlap, `ブロック ${a} と ${c} が重なっている`);
        }
      }
    });
  });
});

describe('parseLevel', () => {
  it('文字が耐久値になり、"." は空き', () => {
    const bricks = parseLevel(['3.1.......']);
    assert.deepEqual(
      bricks.map((b) => b.hp),
      [3, 1],
    );
  });

  it('行の長さ違い・不正な文字・空ステージはエラー', () => {
    assert.throws(() => parseLevel(['111']), /長さ/);
    assert.throws(() => parseLevel(['111111111x']), /不正/);
    assert.throws(() => parseLevel(['..........']), /1つもない/);
    assert.throws(() => parseLevel([]), /空/);
  });
});
