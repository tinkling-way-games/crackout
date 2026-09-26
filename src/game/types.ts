export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Brick extends Rect {
  hp: number;
  maxHp: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export type Phase = 'ready' | 'playing' | 'paused' | 'levelClear' | 'gameOver' | 'won';

export type GameEvent =
  | 'launch'
  | 'wall'
  | 'paddle'
  | 'brickHit'
  | 'brickBreak'
  | 'lifeLost'
  | 'levelClear'
  | 'gameOver'
  | 'won';

/** 1フレーム分の入力。action / pause は「押された瞬間」だけ true になる */
export interface Input {
  left: boolean;
  right: boolean;
  /** マウス・タッチ位置 (論理座標)。キーボード操作中は null */
  pointerX: number | null;
  action: boolean;
  pause: boolean;
}

export interface GameState {
  phase: Phase;
  score: number;
  lives: number;
  /** 0 始まりのステージ番号 */
  level: number;
  paddle: Rect;
  ball: Ball;
  bricks: Brick[];
  /** 現在のボール速度 (px/s) */
  speed: number;
  /** 直前の update で起きた出来事 (効果音などに使う) */
  events: GameEvent[];
}

export const NO_INPUT: Input = { left: false, right: false, pointerX: null, action: false, pause: false };
