/**
 * シード付きの擬似乱数 (mulberry32)。状態は数値1つなので GameState にそのまま持てる。
 * 同じシードなら同じ列になるので、テストでアイテムの出方を再現できる。
 */
export function nextRandom(seed: number): [value: number, nextSeed: number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}
