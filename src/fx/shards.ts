import type { BrokenBrick } from '../game/types.ts';

/** 割れたガラスの破片 (見た目だけ。ゲームの判定には関わらない) */
export interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 回転角と角速度 */
  angle: number;
  spin: number;
  /** 三角形の頂点 (中心からの相対座標) */
  points: readonly (readonly [number, number])[];
  /** 残り時間と最初の寿命 (秒)。透明度に使う */
  life: number;
  maxLife: number;
}

export const SHARD_GRAVITY = 900;
/** 同時に出す破片の上限 (貫通で一度に大量に割ったときの負荷対策) */
export const MAX_SHARDS = 500;

/** 割れたブロック1個から破片を作る。rand はテストで固定できるよう差し替え可能 */
export function spawnShards(broken: BrokenBrick, rand: () => number = Math.random): Shard[] {
  const count = Math.max(6, Math.round((broken.w * broken.h) / 140));
  const speed = Math.hypot(broken.vx, broken.vy) || 1;
  const dirX = broken.vx / speed;
  const dirY = broken.vy / speed;
  const cx = broken.x + broken.w / 2;
  const cy = broken.y + broken.h / 2;
  const shards: Shard[] = [];

  for (let i = 0; i < count; i++) {
    const x = broken.x + rand() * broken.w;
    const y = broken.y + rand() * broken.h;
    // ボールの進行方向へ押し出しつつ、中心から外へも散らす
    const push = 80 + rand() * 160;
    const burst = 40 + rand() * 140;
    const ox = x - cx;
    const oy = y - cy;
    const olen = Math.hypot(ox, oy) || 1;
    const size = 3 + rand() * 6;
    const life = 0.6 + rand() * 0.5;
    shards.push({
      x,
      y,
      vx: dirX * push + (ox / olen) * burst,
      vy: dirY * push + (oy / olen) * burst - 60,
      angle: rand() * Math.PI * 2,
      spin: (rand() - 0.5) * 16,
      points: [0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2 + (rand() - 0.5) * 1.2;
        const r = size * (0.5 + rand() * 0.6);
        return [Math.cos(a) * r, Math.sin(a) * r] as const;
      }),
      life,
      maxLife: life,
    });
  }
  return shards;
}

/** 破片を dt 秒進め、寿命が尽きたものを取り除く */
export function stepShards(shards: Shard[], dt: number): Shard[] {
  for (const s of shards) {
    s.vy += SHARD_GRAVITY * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.angle += s.spin * dt;
    s.life -= dt;
  }
  return shards.filter((s) => s.life > 0);
}

/** 新しい破片を足す。上限を超えたら古いものから捨てる */
export function addShards(shards: Shard[], added: Shard[]): Shard[] {
  const all = shards.concat(added);
  return all.length > MAX_SHARDS ? all.slice(all.length - MAX_SHARDS) : all;
}
