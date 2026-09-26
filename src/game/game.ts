import {
  BALL_MAX_SPEED,
  BALL_RADIUS,
  BALL_SPEED,
  BALL_SPEED_PER_LEVEL,
  BALL_SPEEDUP_PER_HIT,
  HEIGHT,
  INITIAL_LIVES,
  LAUNCH_ANGLE,
  MAX_BALLS,
  MULTI_SPREAD,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_WIDTH,
  PADDLE_Y,
  PIERCE_DURATION,
  POWERUP_DROP_CHANCE,
  POWERUP_FALL_SPEED,
  POWERUP_HEIGHT,
  POWERUP_WIDTH,
  SCORE_BREAK_BONUS,
  SCORE_PER_HIT,
  WIDE_DURATION,
  WIDE_SCALE,
  WIDTH,
} from './constants.ts';
import { LEVELS, parseLevel } from './levels.ts';
import { circleRectHit, paddleBounce, reflect, setSpeed } from './physics.ts';
import { nextRandom } from './random.ts';
import type { Ball, Brick, GameState, Input, PowerUpKind, Rect } from './types.ts';

export type Levels = readonly (readonly string[])[];

export interface GameOptions {
  /** アイテムが落ちる確率 (既定 POWERUP_DROP_CHANCE) */
  dropChance?: number;
  /** 乱数のシード (既定は時刻由来) */
  seed?: number;
}

const POWERUP_KINDS: readonly PowerUpKind[] = ['wide', 'multi', 'pierce'];

const levelSpeed = (level: number) => BALL_SPEED + level * BALL_SPEED_PER_LEVEL;

export function createGame(levels: Levels = LEVELS, options: GameOptions = {}): GameState {
  const state: GameState = {
    phase: 'ready',
    score: 0,
    lives: INITIAL_LIVES,
    level: 0,
    paddle: { x: (WIDTH - PADDLE_WIDTH) / 2, y: PADDLE_Y, w: PADDLE_WIDTH, h: PADDLE_HEIGHT },
    balls: [],
    bricks: parseLevel(levels[0] ?? []),
    powerUps: [],
    effects: { wide: 0, pierce: 0 },
    speed: levelSpeed(0),
    events: [],
    dropChance: options.dropChance ?? POWERUP_DROP_CHANCE,
    seed: options.seed ?? (Date.now() | 0),
  };
  resetRound(state);
  return state;
}

function random(state: GameState): number {
  const [value, next] = nextRandom(state.seed);
  state.seed = next;
  return value;
}

/** 1球目を打つ前の状態に戻す: ボール1個をパドルに乗せ、効果とアイテムを消す */
function resetRound(state: GameState): void {
  state.speed = levelSpeed(state.level);
  state.powerUps = [];
  state.effects = { wide: 0, pierce: 0 };
  setPaddleWidth(state, PADDLE_WIDTH);
  state.balls = [{ x: 0, y: 0, vx: 0, vy: 0, r: BALL_RADIUS }];
  placeBallOnPaddle(state);
}

function placeBallOnPaddle(state: GameState): void {
  const ball = state.balls[0]!;
  const { paddle } = state;
  ball.x = paddle.x + paddle.w / 2;
  ball.y = paddle.y - ball.r;
  ball.vx = 0;
  ball.vy = 0;
}

/** 中心を保ったままパドルの幅を変える */
function setPaddleWidth(state: GameState, w: number): void {
  const p = state.paddle;
  const center = p.x + p.w / 2;
  p.w = w;
  p.x = Math.min(WIDTH - w, Math.max(0, center - w / 2));
}

function loadLevel(state: GameState, level: number, levels: Levels): void {
  state.level = level;
  state.bricks = parseLevel(levels[level] ?? []);
  state.phase = 'ready';
  resetRound(state);
}

function movePaddle(state: GameState, input: Input, dt: number): void {
  const p = state.paddle;
  if (input.pointerX !== null) {
    p.x = input.pointerX - p.w / 2;
  } else {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.x += dir * PADDLE_SPEED * dt;
  }
  p.x = Math.min(WIDTH - p.w, Math.max(0, p.x));
}

function launch(state: GameState, input: Input): void {
  // 押している方向に打ち出す。何も押していなければ少しだけ右へ
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const angle = dir === 0 ? LAUNCH_ANGLE : dir * LAUNCH_ANGLE * 2.5;
  const ball = state.balls[0]!;
  ball.vx = state.speed * Math.sin(angle);
  ball.vy = -state.speed * Math.cos(angle);
  state.phase = 'playing';
  state.events.push('launch');
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function maybeDropPowerUp(state: GameState, brick: Brick): void {
  if (random(state) >= state.dropChance) return;
  const kind = POWERUP_KINDS[Math.floor(random(state) * POWERUP_KINDS.length)]!;
  state.powerUps.push({
    kind,
    x: brick.x + brick.w / 2 - POWERUP_WIDTH / 2,
    y: brick.y + brick.h / 2 - POWERUP_HEIGHT / 2,
    w: POWERUP_WIDTH,
    h: POWERUP_HEIGHT,
  });
}

/** 向きを angle だけ回したボールの複製 */
function rotated(ball: Ball, angle: number): Ball {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let vx = ball.vx * cos - ball.vy * sin;
  let vy = ball.vx * sin + ball.vy * cos;
  // 回した結果、水平に近くなりすぎたら縦成分を確保する (横に往復し続けるのを防ぐ)
  const speed = Math.hypot(vx, vy);
  if (Math.abs(vy) < speed * 0.3) {
    vy = Math.sign(vy || -1) * speed * 0.3;
    vx = Math.sign(vx) * Math.sqrt(speed * speed - vy * vy);
  }
  return { ...ball, vx, vy };
}

export function applyPowerUp(state: GameState, kind: PowerUpKind): void {
  switch (kind) {
    case 'wide':
      state.effects.wide = WIDE_DURATION;
      setPaddleWidth(state, PADDLE_WIDTH * WIDE_SCALE);
      return;
    case 'pierce':
      state.effects.pierce = PIERCE_DURATION;
      return;
    case 'multi': {
      const spawned: Ball[] = [];
      for (const ball of state.balls) {
        spawned.push(rotated(ball, MULTI_SPREAD), rotated(ball, -MULTI_SPREAD));
      }
      state.balls.push(...spawned.slice(0, Math.max(0, MAX_BALLS - state.balls.length)));
      return;
    }
  }
}

function tickEffects(state: GameState, dt: number): void {
  const e = state.effects;
  if (e.wide > 0) {
    e.wide = Math.max(0, e.wide - dt);
    if (e.wide === 0) setPaddleWidth(state, PADDLE_WIDTH);
  }
  e.pierce = Math.max(0, e.pierce - dt);
}

function movePowerUps(state: GameState, dt: number): void {
  state.powerUps = state.powerUps.filter((item) => {
    item.y += POWERUP_FALL_SPEED * dt;
    if (overlaps(item, state.paddle)) {
      applyPowerUp(state, item.kind);
      state.events.push('powerUp');
      return false;
    }
    return item.y < HEIGHT;
  });
}

/** ボール1個をブロックと衝突させる */
function collideBricks(state: GameState, ball: Ball): void {
  const pierce = state.effects.pierce > 0;
  for (let b = 0; b < state.bricks.length; b++) {
    const brick = state.bricks[b]!;
    const hit = circleRectHit(ball, brick);
    if (!hit) continue;

    if (pierce) {
      // 貫通: 反射せず、耐久値に関係なく一撃で壊して進み続ける
      state.score += SCORE_PER_HIT + SCORE_BREAK_BONUS * brick.maxHp;
      state.bricks.splice(b, 1);
      b--;
      state.events.push('brickBreak');
      maybeDropPowerUp(state, brick);
      continue;
    }

    // 反転しなかった接触 (すでに離れつつある) は押し戻すだけでダメージにしない
    if (!reflect(ball, hit)) continue;
    brick.hp -= 1;
    state.score += SCORE_PER_HIT;
    state.speed = Math.min(BALL_MAX_SPEED, state.speed + BALL_SPEEDUP_PER_HIT);
    for (const other of state.balls) setSpeed(other, state.speed);
    if (brick.hp <= 0) {
      state.score += SCORE_BREAK_BONUS * brick.maxHp;
      state.bricks.splice(b, 1);
      state.events.push('brickBreak');
      maybeDropPowerUp(state, brick);
    } else {
      state.events.push('brickHit');
    }
    // 反射したら、このステップでダメージを与えるのは1個まで
    return;
  }
}

/** ボールを dt 秒進める。すり抜け防止のため、半径の半分ずつ小刻みに動かす */
function stepBalls(state: GameState, dt: number, levels: Levels): void {
  const { paddle } = state;
  const steps = Math.max(1, Math.ceil((state.speed * dt) / (BALL_RADIUS / 2)));
  const sub = dt / steps;

  for (let i = 0; i < steps; i++) {
    for (const ball of state.balls) {
      ball.x += ball.vx * sub;
      ball.y += ball.vy * sub;

      // 壁
      if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
        state.events.push('wall');
      } else if (ball.x + ball.r > WIDTH) {
        ball.x = WIDTH - ball.r;
        ball.vx = -Math.abs(ball.vx);
        state.events.push('wall');
      }
      if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
        state.events.push('wall');
      }

      // パドル (上から落ちてきたときだけ。側面や下をかすめたボールは拾わず落とす)
      if (ball.vy > 0 && ball.y <= paddle.y && circleRectHit(ball, paddle)) {
        paddleBounce(ball, paddle, state.speed);
        state.events.push('paddle');
      }

      collideBricks(state, ball);
    }

    if (state.bricks.length === 0) {
      const last = state.level >= levels.length - 1;
      state.phase = last ? 'won' : 'levelClear';
      state.powerUps = [];
      state.events.push(last ? 'won' : 'levelClear');
      return;
    }

    // 落下: 画面下に消えたボールを取り除き、全部なくなったらミス
    state.balls = state.balls.filter((ball) => ball.y - ball.r <= HEIGHT);
    if (state.balls.length === 0) {
      state.lives -= 1;
      state.events.push('lifeLost');
      if (state.lives <= 0) {
        state.phase = 'gameOver';
        state.events.push('gameOver');
      } else {
        state.phase = 'ready';
      }
      // ボール0個のままにしない (描画やテストが balls[0] を参照できるように)
      resetRound(state);
      return;
    }
  }
}

/** 1フレーム進める。state を直接書き換える */
export function update(state: GameState, input: Input, dt: number, levels: Levels = LEVELS): void {
  state.events = [];

  if (input.pause) {
    if (state.phase === 'playing') {
      state.phase = 'paused';
      return;
    }
    if (state.phase === 'paused') {
      state.phase = 'playing';
      return;
    }
  }

  switch (state.phase) {
    case 'paused':
      return;
    case 'ready':
      movePaddle(state, input, dt);
      placeBallOnPaddle(state);
      if (input.action) launch(state, input);
      return;
    case 'playing':
      tickEffects(state, dt);
      movePaddle(state, input, dt);
      movePowerUps(state, dt);
      stepBalls(state, dt, levels);
      return;
    case 'levelClear':
      if (input.action) loadLevel(state, state.level + 1, levels);
      return;
    case 'gameOver':
    case 'won':
      if (input.action) {
        Object.assign(state, createGame(levels, { dropChance: state.dropChance, seed: state.seed }));
      }
      return;
  }
}

/** 一時停止を解除する手段を持たない場面 (タブ切り替えなど) 用 */
export function pause(state: GameState): void {
  if (state.phase === 'playing') state.phase = 'paused';
}
