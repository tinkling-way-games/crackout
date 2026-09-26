import { createAudio } from './audio.ts';
import { addShards, spawnShards, stepShards, type Shard } from './fx/shards.ts';
import { createGame, pause, update } from './game/game.ts';
import type { GameState } from './game/types.ts';
import { createInput } from './input.ts';
import { draw, fitCanvas } from './render.ts';

/** 物理は固定の刻み幅で進める。フレームレートが違っても挙動が変わらないように */
const STEP = 1 / 120;
/** タブ復帰などで間が空いたときに一気に進めすぎない上限 */
const MAX_FRAME = 0.1;

declare global {
  interface Window {
    /** E2E テストから状態を覗くための読み取り口 */
    __breakout?: { readonly state: GameState; readonly shards: readonly Shard[] };
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const ctx = canvas?.getContext('2d');
if (!canvas || !ctx) throw new Error('canvas#game が見つからない');

const state = createGame();
const input = createInput(canvas);
const audio = createAudio();
/** 割れたガラスの破片 (見た目だけなので、ゲームの状態とは別に持つ) */
let shards: Shard[] = [];
window.__breakout = {
  state,
  get shards() {
    return shards;
  },
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause(state);
});

let last = performance.now();
let acc = 0;

function frame(now: number) {
  acc += Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;

  // 「押された瞬間」の入力は最初の1ステップにだけ渡す。
  // 高リフレッシュレートでステップが0回のフレームでは読まずに持ち越す (クリックの取りこぼし防止)
  let current = acc >= STEP ? input.read() : null;
  while (current && acc >= STEP) {
    update(state, current, STEP);
    if (!input.muted) audio.play(state.events);
    for (const broken of state.broken) shards = addShards(shards, spawnShards(broken));
    if (state.phase !== 'paused') shards = stepShards(shards, STEP);
    current = { ...current, action: false, pause: false };
    acc -= STEP;
  }

  fitCanvas(canvas!, ctx!);
  draw(ctx!, state, input.muted, shards);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
