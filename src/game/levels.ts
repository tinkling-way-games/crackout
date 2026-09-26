import { BRICK_COLS, BRICK_GAP, BRICK_HEIGHT, BRICK_SIDE, BRICK_TOP, BRICK_WIDTH } from './constants.ts';
import type { Brick } from './types.ts';

/**
 * ステージ定義。1文字 = 1ブロック。
 * '.' は空き、'1'〜'3' はブロックの耐久値。
 */
export const LEVELS: readonly (readonly string[])[] = [
  [
    '1111111111',
    '1111111111',
    '1111111111',
    '1111111111',
  ],
  [
    '2222222222',
    '2111111112',
    '2111111112',
    '2222222222',
    '1.1.1.1.1.',
  ],
  [
    '...3333...',
    '..322223..',
    '.32111123.',
    '3211111123',
    '.32111123.',
    '..322223..',
    '...3333...',
  ],
];

export function parseLevel(rows: readonly string[]): Brick[] {
  if (rows.length === 0) throw new Error('ステージが空');
  const bricks: Brick[] = [];
  rows.forEach((row, r) => {
    if (row.length !== BRICK_COLS) {
      throw new Error(`${r + 1}行目の長さが ${row.length} (${BRICK_COLS} であるべき): "${row}"`);
    }
    [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const hp = Number(ch);
      if (!Number.isInteger(hp) || hp < 1 || hp > 3) {
        throw new Error(`${r + 1}行${c + 1}列目の文字 "${ch}" は不正`);
      }
      bricks.push({
        x: BRICK_SIDE + c * (BRICK_WIDTH + BRICK_GAP),
        y: BRICK_TOP + r * (BRICK_HEIGHT + BRICK_GAP),
        w: BRICK_WIDTH,
        h: BRICK_HEIGHT,
        hp,
        maxHp: hp,
      });
    });
  });
  if (bricks.length === 0) throw new Error('ブロックが1つもない');
  return bricks;
}
