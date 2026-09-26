import { nextRandom } from '../game/random.ts';
import type { Impact } from '../game/types.ts';

export type Point = readonly [x: number, y: number];
/** 割れ目1本 = 折れ線 (ブロック左上からの相対座標) */
export type Crack = readonly Point[];

/** 放射状のひびを広げる角度 (内側方向を中心に ±この値)。180°未満なので縁から外へは伸びない */
const FAN = Math.PI * 0.42;

/**
 * 1つの当たり点から放射状に伸びる割れ目を作る。
 * 当たり点はブロックの縁にあるので、ひびはブロックの内側 (中心の方) へ扇形に伸ばす。
 * 模様は (ブロック位置, 何回目の当たりか) から決まる乱数で作るので、毎フレーム同じ形になる。
 * @param size ブロックの大きさ
 * @param key ブロックごとに固定の値 (位置から作る)
 * @param index 何回目の当たりか (0 始まり)。後の当たりほど割れ目が長く、本数も多い
 */
export function crackPattern(impact: Impact, size: { w: number; h: number }, key: number, index: number): Crack[] {
  let seed = (key * 31 + index * 7919) | 0;
  const rand = () => {
    const [v, next] = nextRandom(seed);
    seed = next;
    return v;
  };

  const rays = 5 + index * 2 + Math.floor(rand() * 2);
  const reach = 22 + index * 16;
  const cracks: Crack[] = [];
  const tips: Point[] = [];
  // 内側の向き: 当たった辺の法線の逆向き (角なら対角の方)。
  // 辺なら内側は半円 (±90°) あるが、角では四分円 (±45°) しかないので扇を狭める
  const { angle: inward, corner } = inwardAngle(impact, size);
  const fan = corner ? Math.PI * 0.18 : FAN;
  const bendLimit = corner ? Math.PI / 4 - 0.02 : FAN + 0.2;

  for (let r = 0; r < rays; r++) {
    // 扇形に並べ、少しずつ角度をばらつかせる
    const spread = rays === 1 ? 0 : -fan + (2 * fan * r) / (rays - 1);
    let angle = clampAngle(inward + spread + (rand() - 0.5) * 0.25, inward, bendLimit);
    const length = reach * (0.5 + rand() * 0.7);
    const segments = 3 + Math.floor(rand() * 2);
    const line: Point[] = [[impact.x, impact.y]];
    let [x, y] = [impact.x, impact.y];
    for (let s = 0; s < segments; s++) {
      // 1節ごとに少し折れ曲がる (ガラスのひびらしいギザギザ)。外へ向かないよう扇の範囲に収める
      angle = clampAngle(angle + (rand() - 0.5) * 0.7, inward, bendLimit);
      const step = length / segments;
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
      line.push([x, y]);
      if (s === 0) tips.push([x, y]);
    }
    cracks.push(line);
  }

  // 放射状のひびの根元どうしを結ぶ、蜘蛛の巣状の短い輪 (扇形なので端と端はつながない)
  for (let r = 0; r < tips.length - 1; r++) {
    if (rand() < 0.35) continue;
    cracks.push([tips[r]!, tips[r + 1]!]);
  }
  return cracks;
}

function inwardAngle(impact: Impact, size: { w: number; h: number }): { angle: number; corner: boolean } {
  const eps = 0.5;
  const nx = impact.x <= eps ? 1 : impact.x >= size.w - eps ? -1 : 0;
  const ny = impact.y <= eps ? 1 : impact.y >= size.h - eps ? -1 : 0;
  if (nx === 0 && ny === 0) return { angle: Math.atan2(size.h / 2 - impact.y, size.w / 2 - impact.x), corner: false };
  return { angle: Math.atan2(ny, nx), corner: nx !== 0 && ny !== 0 };
}

/** angle を center ± range に収める */
function clampAngle(angle: number, center: number, range: number): number {
  let d = angle - center;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return center + Math.max(-range, Math.min(range, d));
}

/** ブロックの位置から、そのブロック固有の値を作る */
export function brickKey(x: number, y: number): number {
  return (Math.round(x) * 73856093) ^ (Math.round(y) * 19349663);
}
